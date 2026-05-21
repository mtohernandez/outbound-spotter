"""DRF tests for ``TripExportListCreateView`` + ``TripExportDestroyView`` (spec 10).

Ownership: 404 for foreign trips and foreign exports so existence isn't
leakable across users (no oracle — matches the spec-09 destroy-view
precedent). Denormalized trip labels survive trip deletion via
``on_delete=SET_NULL``: the row's three label columns + ``trip_id IS NULL``
let the FE render history past the original trip's lifetime.

Mode contract: the wire is kebab-case (``"multi-page"`` / ``"single-page"``);
the DB stores snake_case. Tests assert both halves of the translation.
"""

from __future__ import annotations

from typing import TYPE_CHECKING
from unittest.mock import patch
import uuid

from django.core.cache import cache
import pytest

from web_api.apps.exports.models import ExportMode, TripExport
from web_api.apps.trips.models import Trip

if TYPE_CHECKING:
    from pytest_django import DjangoAssertNumQueries
    from rest_framework.test import APIClient

    from tests.conftest import LogDayFactory, TripExportFactory, TripFactory


@pytest.fixture(autouse=True)
def _clear_throttle_cache() -> None:
    cache.clear()


# -- LIST ---------------------------------------------------------------------


def test_list_without_token_returns_401(unauthenticated_client: APIClient) -> None:
    response = unauthenticated_client.get("/api/exports/")

    assert response.status_code == 401


@pytest.mark.django_db
def test_list_returns_only_own_exports(
    authenticated_client: APIClient,
    trip_export_factory: type[TripExportFactory],
) -> None:
    own = [trip_export_factory.create() for _ in range(3)]
    trip_export_factory.create_batch(2, user_id="user_someone_else")

    response = authenticated_client.get("/api/exports/")

    assert response.status_code == 200
    body = response.json()
    assert body["count"] == 3
    returned_ids = {row["id"] for row in body["results"]}
    assert returned_ids == {str(e.id) for e in own}


@pytest.mark.django_db
def test_list_orders_newest_first(
    authenticated_client: APIClient,
    trip_export_factory: type[TripExportFactory],
) -> None:
    older = trip_export_factory.create()
    newer = trip_export_factory.create()

    response = authenticated_client.get("/api/exports/")

    assert response.status_code == 200
    ordered_ids = [row["id"] for row in response.json()["results"]]
    # Default ordering ("-created_at",) — newer first.
    assert ordered_ids[0] == str(newer.id)
    assert ordered_ids[1] == str(older.id)


@pytest.mark.django_db
def test_list_paginates_at_50_rows(
    authenticated_client: APIClient,
    trip_export_factory: type[TripExportFactory],
) -> None:
    trip_export_factory.create_batch(60)

    page_one = authenticated_client.get("/api/exports/")

    assert page_one.status_code == 200
    body_one = page_one.json()
    assert body_one["count"] == 60
    assert len(body_one["results"]) == 50

    page_two = authenticated_client.get("/api/exports/?limit=50&offset=50")
    assert len(page_two.json()["results"]) == 10


@pytest.mark.django_db
def test_list_returns_kebab_case_mode(
    authenticated_client: APIClient,
    trip_export_factory: type[TripExportFactory],
) -> None:
    trip_export_factory.create(mode=ExportMode.MULTI_PAGE)
    trip_export_factory.create(mode=ExportMode.SINGLE_PAGE)

    response = authenticated_client.get("/api/exports/")

    modes = {row["mode"] for row in response.json()["results"]}
    assert modes == {"multi-page", "single-page"}


@pytest.mark.django_db
def test_list_runs_in_constant_query_count(
    authenticated_client: APIClient,
    trip_export_factory: type[TripExportFactory],
    django_assert_num_queries: DjangoAssertNumQueries,
) -> None:
    """List query stays constant: 1 COUNT + 1 SELECT regardless of row count.

    Locks the contract so a future serializer change that introduces N+1
    against ``trip`` (e.g. nesting Trip via a sub-serializer instead of
    using the denormalized labels) fails this assertion.
    """
    trip_export_factory.create_batch(15)

    with django_assert_num_queries(2):
        response = authenticated_client.get("/api/exports/")
    assert response.status_code == 200
    assert response.json()["count"] == 15


@pytest.mark.django_db
def test_list_throttle_enforces_per_user_limit(
    authenticated_client: APIClient,
    trip_export_factory: type[TripExportFactory],
) -> None:
    trip_export_factory.create()

    with patch(
        "rest_framework.throttling.ScopedRateThrottle.THROTTLE_RATES",
        new={"export_list": "1/min"},
    ):
        first = authenticated_client.get("/api/exports/")
        assert first.status_code == 200
        second = authenticated_client.get("/api/exports/")
    assert second.status_code == 429


# -- CREATE -------------------------------------------------------------------


def test_create_without_token_returns_401(unauthenticated_client: APIClient) -> None:
    response = unauthenticated_client.post(
        "/api/exports/",
        data={"trip_id": str(uuid.uuid4()), "mode": "multi-page"},
        format="json",
    )

    assert response.status_code == 401


@pytest.mark.django_db
def test_create_persists_row_with_denormalized_labels(
    authenticated_client: APIClient,
    trip_factory: type[TripFactory],
    log_day_factory: type[LogDayFactory],
) -> None:
    trip = trip_factory.create()
    log_day_factory.create_batch(2, trip=trip)

    response = authenticated_client.post(
        "/api/exports/",
        data={"trip_id": str(trip.id), "mode": "multi-page"},
        format="json",
    )

    assert response.status_code == 201
    body = response.json()
    assert body["trip_id"] == str(trip.id)
    assert body["mode"] == "multi-page"
    assert body["sheet_count"] == 2
    # Denormalized labels are persisted from the Trip at create time.
    assert body["trip_current_label"] == trip.current_label
    assert body["trip_pickup_label"] == trip.pickup_label
    assert body["trip_dropoff_label"] == trip.dropoff_label


@pytest.mark.django_db
def test_create_persists_snake_case_mode(
    authenticated_client: APIClient,
    trip_factory: type[TripFactory],
    log_day_factory: type[LogDayFactory],
) -> None:
    """Wire ``"single-page"`` → DB ``"single_page"`` (and back on read)."""
    trip = trip_factory.create()
    log_day_factory.create(trip=trip)

    response = authenticated_client.post(
        "/api/exports/",
        data={"trip_id": str(trip.id), "mode": "single-page"},
        format="json",
    )

    assert response.status_code == 201
    export = TripExport.objects.get(id=response.json()["id"])
    assert export.mode == ExportMode.SINGLE_PAGE.value == "single_page"
    assert response.json()["mode"] == "single-page"


@pytest.mark.django_db
def test_create_returns_404_for_foreign_trip(
    authenticated_client: APIClient,
    trip_factory: type[TripFactory],
    log_day_factory: type[LogDayFactory],
) -> None:
    """404 (not 403) — existence of a UUID isn't leakable across users."""
    foreign = trip_factory.create(user_id="user_someone_else")
    log_day_factory.create(trip=foreign)

    response = authenticated_client.post(
        "/api/exports/",
        data={"trip_id": str(foreign.id), "mode": "multi-page"},
        format="json",
    )

    assert response.status_code == 404
    assert not TripExport.objects.filter(trip_id=foreign.id).exists()


@pytest.mark.django_db
def test_create_returns_404_for_unknown_trip(
    authenticated_client: APIClient,
) -> None:
    response = authenticated_client.post(
        "/api/exports/",
        data={"trip_id": str(uuid.uuid4()), "mode": "multi-page"},
        format="json",
    )

    assert response.status_code == 404


@pytest.mark.django_db
def test_create_returns_422_when_trip_has_no_log_days(
    authenticated_client: APIClient,
    trip_factory: type[TripFactory],
) -> None:
    """Defensive — spec 06's invariant guarantees this can't happen, but the
    view stays defensive so a future data-migration bug surfaces here.
    """
    trip = trip_factory.create()  # No LogDay rows attached.

    response = authenticated_client.post(
        "/api/exports/",
        data={"trip_id": str(trip.id), "mode": "multi-page"},
        format="json",
    )

    assert response.status_code == 422
    assert not TripExport.objects.filter(trip_id=trip.id).exists()


@pytest.mark.django_db
def test_create_rejects_invalid_mode(
    authenticated_client: APIClient,
    trip_factory: type[TripFactory],
    log_day_factory: type[LogDayFactory],
) -> None:
    trip = trip_factory.create()
    log_day_factory.create(trip=trip)

    response = authenticated_client.post(
        "/api/exports/",
        data={"trip_id": str(trip.id), "mode": "compact_grid"},
        format="json",
    )

    assert response.status_code == 400


@pytest.mark.django_db
def test_create_throttle_enforces_per_user_limit(
    authenticated_client: APIClient,
    trip_factory: type[TripFactory],
    log_day_factory: type[LogDayFactory],
) -> None:
    trip = trip_factory.create()
    log_day_factory.create(trip=trip)

    with patch(
        "rest_framework.throttling.ScopedRateThrottle.THROTTLE_RATES",
        new={"export_create": "1/hour"},
    ):
        first = authenticated_client.post(
            "/api/exports/",
            data={"trip_id": str(trip.id), "mode": "multi-page"},
            format="json",
        )
        assert first.status_code == 201
        second = authenticated_client.post(
            "/api/exports/",
            data={"trip_id": str(trip.id), "mode": "multi-page"},
            format="json",
        )
    assert second.status_code == 429


# -- TRIP-DELETION SURVIVAL ---------------------------------------------------


@pytest.mark.django_db
def test_export_survives_trip_deletion_with_denormalized_labels(
    authenticated_client: APIClient,
    trip_factory: type[TripFactory],
    log_day_factory: type[LogDayFactory],
) -> None:
    """SET_NULL + denormalized labels keep history past trip deletion."""
    trip = trip_factory.create()
    log_day_factory.create(trip=trip)

    create_response = authenticated_client.post(
        "/api/exports/",
        data={"trip_id": str(trip.id), "mode": "multi-page"},
        format="json",
    )
    assert create_response.status_code == 201
    export_id = create_response.json()["id"]

    # Delete the trip; CASCADE removes plan tables but exports survive.
    Trip.objects.filter(pk=trip.id).delete()

    list_response = authenticated_client.get("/api/exports/")
    assert list_response.status_code == 200
    rows = list_response.json()["results"]
    assert len(rows) == 1
    row = rows[0]
    assert row["id"] == export_id
    assert row["trip_id"] is None
    assert row["trip_current_label"] == "Richmond, VA"
    assert row["trip_pickup_label"] == "Fredericksburg, VA"
    assert row["trip_dropoff_label"] == "Newark, NJ"


# -- DESTROY ------------------------------------------------------------------


def test_destroy_without_token_returns_401(unauthenticated_client: APIClient) -> None:
    response = unauthenticated_client.delete(f"/api/exports/{uuid.uuid4()}/")

    assert response.status_code == 401


@pytest.mark.django_db
def test_destroy_returns_204_and_removes_row(
    authenticated_client: APIClient,
    trip_export_factory: type[TripExportFactory],
) -> None:
    export = trip_export_factory.create()

    response = authenticated_client.delete(f"/api/exports/{export.id}/")

    assert response.status_code == 204
    assert response.content == b""
    assert not TripExport.objects.filter(pk=export.id).exists()


@pytest.mark.django_db
def test_destroy_does_not_affect_trip(
    authenticated_client: APIClient,
    trip_export_factory: type[TripExportFactory],
) -> None:
    """Deleting an audit row never deletes the underlying Trip."""
    export = trip_export_factory.create()
    trip_id = export.trip_id
    assert trip_id is not None  # Factory always wires a Trip.

    response = authenticated_client.delete(f"/api/exports/{export.id}/")

    assert response.status_code == 204
    assert Trip.objects.filter(pk=trip_id).exists()


@pytest.mark.django_db
def test_destroy_returns_404_for_foreign_export(
    authenticated_client: APIClient,
    trip_export_factory: type[TripExportFactory],
) -> None:
    foreign = trip_export_factory.create(user_id="user_someone_else")

    response = authenticated_client.delete(f"/api/exports/{foreign.id}/")

    assert response.status_code == 404
    assert TripExport.objects.filter(pk=foreign.id).exists()


@pytest.mark.django_db
def test_destroy_returns_404_for_unknown_id(authenticated_client: APIClient) -> None:
    response = authenticated_client.delete(f"/api/exports/{uuid.uuid4()}/")

    assert response.status_code == 404


def test_destroy_invalid_uuid_returns_404(authenticated_client: APIClient) -> None:
    response = authenticated_client.delete("/api/exports/not-a-uuid/")

    assert response.status_code == 404


@pytest.mark.django_db
def test_destroy_throttle_enforces_per_user_limit(
    authenticated_client: APIClient,
    trip_export_factory: type[TripExportFactory],
) -> None:
    first_export = trip_export_factory.create()
    second_export = trip_export_factory.create()

    with patch(
        "rest_framework.throttling.ScopedRateThrottle.THROTTLE_RATES",
        new={"export_delete": "1/min"},
    ):
        first = authenticated_client.delete(f"/api/exports/{first_export.id}/")
        assert first.status_code == 204
        second = authenticated_client.delete(f"/api/exports/{second_export.id}/")
    assert second.status_code == 429
