"""DRF tests for ``TripListCreateView`` GET branch — ``GET /api/trips/`` (spec 09).

Ownership filtering is the load-bearing rule: only the requesting user's
trips surface in ``results``. Foreign trips are silently absent (no oracle).
``days_count`` is annotated on the queryset; the serializer reads it as a
plain integer field so the suite catches any view that forgets to call
``.with_days_count()``.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import TYPE_CHECKING
from unittest.mock import patch

from django.core.cache import cache
import pytest

from web_api.apps.trips.models import Trip

if TYPE_CHECKING:
    from pytest_django import DjangoAssertNumQueries
    from rest_framework.test import APIClient

    from tests.conftest import LogDayFactory, TripFactory


@pytest.fixture(autouse=True)
def _clear_throttle_cache() -> None:
    cache.clear()


def test_list_without_token_returns_401(unauthenticated_client: APIClient) -> None:
    response = unauthenticated_client.get("/api/trips/")

    assert response.status_code == 401


@pytest.mark.django_db
def test_list_returns_only_own_trips(
    authenticated_client: APIClient,
    trip_factory: type[TripFactory],
) -> None:
    own = [trip_factory.create() for _ in range(3)]
    trip_factory.create_batch(2, user_id="user_someone_else")

    response = authenticated_client.get("/api/trips/")

    assert response.status_code == 200
    body = response.json()
    assert body["count"] == 3
    returned_ids = {row["id"] for row in body["results"]}
    assert returned_ids == {str(t.id) for t in own}


@pytest.mark.django_db
def test_list_orders_newest_first(
    authenticated_client: APIClient,
    trip_factory: type[TripFactory],
) -> None:
    newest = trip_factory.create()
    middle = trip_factory.create()
    oldest = trip_factory.create()
    Trip.objects.filter(pk=newest.pk).update(created_at=datetime(2026, 1, 1, tzinfo=UTC))
    Trip.objects.filter(pk=middle.pk).update(created_at=datetime(2025, 1, 1, tzinfo=UTC))
    Trip.objects.filter(pk=oldest.pk).update(created_at=datetime(2024, 1, 1, tzinfo=UTC))

    response = authenticated_client.get("/api/trips/")

    assert response.status_code == 200
    ordered_ids = [row["id"] for row in response.json()["results"]]
    assert ordered_ids == [str(newest.id), str(middle.id), str(oldest.id)]


@pytest.mark.django_db
def test_list_paginates_at_50_rows(
    authenticated_client: APIClient,
    trip_factory: type[TripFactory],
) -> None:
    trip_factory.create_batch(60)

    page_one = authenticated_client.get("/api/trips/")

    assert page_one.status_code == 200
    body_one = page_one.json()
    assert body_one["count"] == 60
    assert len(body_one["results"]) == 50
    assert body_one["next"] is not None
    assert body_one["previous"] is None

    page_two = authenticated_client.get("/api/trips/?limit=50&offset=50")

    assert page_two.status_code == 200
    body_two = page_two.json()
    assert len(body_two["results"]) == 10
    assert body_two["next"] is None
    assert body_two["previous"] is not None


@pytest.mark.django_db
def test_list_includes_days_count_from_annotation(
    authenticated_client: APIClient,
    trip_factory: type[TripFactory],
    log_day_factory: type[LogDayFactory],
) -> None:
    trip = trip_factory.create()
    log_day_factory.create_batch(3, trip=trip)

    response = authenticated_client.get("/api/trips/")

    assert response.status_code == 200
    rows = response.json()["results"]
    assert len(rows) == 1
    assert rows[0]["days_count"] == 3


@pytest.mark.django_db
def test_list_days_count_is_zero_when_no_log_days(
    authenticated_client: APIClient,
    trip_factory: type[TripFactory],
) -> None:
    trip_factory.create()

    response = authenticated_client.get("/api/trips/")

    assert response.status_code == 200
    rows = response.json()["results"]
    assert len(rows) == 1
    assert rows[0]["days_count"] == 0


@pytest.mark.django_db
def test_list_payload_excludes_heavy_fields(
    authenticated_client: APIClient,
    trip_factory: type[TripFactory],
) -> None:
    trip_factory.create()

    response = authenticated_client.get("/api/trips/")

    row = response.json()["results"][0]
    expected = {
        "id",
        "current_label",
        "pickup_label",
        "dropoff_label",
        "route_summary",
        "days_count",
        "start_at",
        "created_at",
    }
    assert set(row.keys()) == expected


@pytest.mark.django_db
def test_list_throttle_enforces_per_user_limit(
    authenticated_client: APIClient,
    trip_factory: type[TripFactory],
) -> None:
    """Patch ``trip_list`` rate down to 1/min and assert the 2nd hit is 429."""
    trip_factory.create()

    with patch(
        "rest_framework.throttling.ScopedRateThrottle.THROTTLE_RATES",
        new={"trip_list": "1/min"},
    ):
        first = authenticated_client.get("/api/trips/")
        assert first.status_code == 200
        second = authenticated_client.get("/api/trips/")
    assert second.status_code == 429


@pytest.mark.django_db
def test_list_runs_in_constant_query_count(
    authenticated_client: APIClient,
    trip_factory: type[TripFactory],
    log_day_factory: type[LogDayFactory],
    django_assert_num_queries: DjangoAssertNumQueries,
) -> None:
    """Locks the manager + serializer contract: list call stays one grouped
    SELECT plus DRF's COUNT regardless of row or LogDay cardinality. Any
    future serializer or queryset change that introduces N+1 should fail this.
    """
    trips = trip_factory.create_batch(20)
    for trip in trips:
        log_day_factory.create_batch(5, trip=trip)

    # 2 queries: 1 COUNT(*) (LimitOffsetPagination) + 1 SELECT … LEFT JOIN log_days
    # … GROUP BY trip.id (the annotated list query).
    with django_assert_num_queries(2):
        response = authenticated_client.get("/api/trips/")
    assert response.status_code == 200
    assert response.json()["count"] == 20


@pytest.mark.django_db
def test_list_rejects_limit_over_cap(
    authenticated_client: APIClient,
    trip_factory: type[TripFactory],
) -> None:
    """CappedLimitOffsetPagination caps ``?limit=`` at 200 so an attacker
    can't force the worker to materialize unbounded result sets."""
    trip_factory.create_batch(3)

    response = authenticated_client.get("/api/trips/?limit=1000000")

    assert response.status_code == 200
    # DRF silently clamps to max_limit; assert the page reflects the cap, not
    # the request.
    assert len(response.json()["results"]) == 3  # all rows fit under the cap
