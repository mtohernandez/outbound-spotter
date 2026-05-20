"""DRF tests for ``TripPlanView`` (``GET /api/trips/<uuid:id>/plan/``).

Ownership: 404 on missing AND on foreign (no oracle). Throttle: per-user
keyed via ``PerUserScopedThrottle``. N+1 closure: assert exactly 4 queries
on a successful retrieve (one Trip lookup + one prefetch batch per reverse
relation: stops / log_events / log_days; Django does NOT batch multiple
``prefetch_related`` targets into one SQL statement).
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import TYPE_CHECKING
from unittest.mock import patch
import uuid

import pytest

from web_api.apps.trips.models import (
    DutyStatusChoices,
    LogDay,
    LogEvent,
    StopKind,
    Trip,
    TripStop,
)

if TYPE_CHECKING:
    from pytest_django import DjangoAssertNumQueries
    from rest_framework.test import APIClient

    from tests.conftest import TripFactory


def _seed_plan(trip: Trip) -> None:
    """Populate one of each: a stop, an event, a day. Enough to exercise prefetch."""
    start = datetime(2030, 1, 15, 13, 0, 0, tzinfo=UTC)
    TripStop.objects.create(
        trip=trip,
        kind=StopKind.PICKUP,
        sequence=0,
        polyline_index=1,
        lat=Decimal("38.303200"),
        lon=Decimal("-77.460500"),
        label="",
        scheduled_at=start,
        duration_s=3600,
    )
    LogEvent.objects.create(
        trip=trip,
        sequence=0,
        status=DutyStatusChoices.DRIVING,
        start=start,
        duration_s=3600,
        location="37.5407, -77.4360",
        note="",
    )
    LogDay.objects.create(
        trip=trip,
        date=start.date(),
        off_duty_s=0,
        sleeper_s=0,
        driving_s=3600,
        on_duty_not_driving_s=3600,
        total_miles=Decimal("55.0"),
    )


def test_plan_without_token_returns_401(unauthenticated_client: APIClient) -> None:
    response = unauthenticated_client.get(f"/api/trips/{uuid.uuid4()}/plan/")
    assert response.status_code == 401


@pytest.mark.django_db
def test_plan_returns_200_for_owner_with_envelope(
    authenticated_client: APIClient,
    trip_factory: type[TripFactory],
) -> None:
    trip = trip_factory.create()
    _seed_plan(trip)

    response = authenticated_client.get(f"/api/trips/{trip.id}/plan/")

    assert response.status_code == 200
    body = response.json()
    assert body["trip_id"] == str(trip.id)
    assert body["home_terminal_tz"] == "America/New_York"
    assert body["start_at"] == trip.start_at.isoformat()
    assert len(body["stops"]) == 1
    assert body["stops"][0]["kind"] == StopKind.PICKUP
    assert len(body["events"]) == 1
    assert body["events"][0]["status"] == DutyStatusChoices.DRIVING
    assert len(body["days"]) == 1


@pytest.mark.django_db
def test_plan_returns_404_for_unknown_id(authenticated_client: APIClient) -> None:
    response = authenticated_client.get(f"/api/trips/{uuid.uuid4()}/plan/")
    assert response.status_code == 404


@pytest.mark.django_db
def test_plan_returns_404_for_other_users_trip(
    authenticated_client: APIClient,
    trip_factory: type[TripFactory],
) -> None:
    """404 (not 403) so we don't leak whether a UUID exists for some other user."""
    foreign = trip_factory.create(user_id="user_someone_else")
    _seed_plan(foreign)

    response = authenticated_client.get(f"/api/trips/{foreign.id}/plan/")

    assert response.status_code == 404


@pytest.mark.django_db
def test_plan_invalid_uuid_returns_404(authenticated_client: APIClient) -> None:
    response = authenticated_client.get("/api/trips/not-a-uuid/plan/")
    assert response.status_code == 404


@pytest.mark.django_db
def test_plan_throttle_enforces_per_user_limit(
    authenticated_client: APIClient,
    trip_factory: type[TripFactory],
) -> None:
    """Patch the throttle rate down to 1/min and assert the 2nd hit is 429."""
    from django.core.cache import cache  # noqa: PLC0415

    cache.clear()  # throttle counters bleed between tests via LocMem cache

    trip = trip_factory.create()
    _seed_plan(trip)

    with patch(
        "rest_framework.throttling.ScopedRateThrottle.THROTTLE_RATES",
        new={"trip_plan_retrieve": "1/min"},
    ):
        first = authenticated_client.get(f"/api/trips/{trip.id}/plan/")
        assert first.status_code == 200
        second = authenticated_client.get(f"/api/trips/{trip.id}/plan/")
    assert second.status_code == 429


@pytest.mark.django_db
def test_plan_runs_in_four_queries_via_prefetch(
    authenticated_client: APIClient,
    trip_factory: type[TripFactory],
    django_assert_num_queries: DjangoAssertNumQueries,
) -> None:
    """prefetch_related closes the N+1 — 1 Trip lookup + 3 prefetch batches."""
    trip = trip_factory.create()
    _seed_plan(trip)
    # Add a few more rows to make the N+1 visible if the prefetch is missing.
    for offset in range(1, 4):
        TripStop.objects.create(
            trip=trip,
            kind=StopKind.FUEL,
            sequence=offset,
            polyline_index=offset * 10,
            lat=Decimal("38.500000"),
            lon=Decimal("-77.000000"),
            label="",
            scheduled_at=datetime(2030, 1, 15, 13, 0, tzinfo=UTC) + timedelta(hours=offset),
            duration_s=900,
        )
        LogEvent.objects.create(
            trip=trip,
            sequence=offset,
            status=DutyStatusChoices.ON_DUTY_NOT_DRIVING,
            start=datetime(2030, 1, 15, 13, 0, tzinfo=UTC) + timedelta(hours=offset),
            duration_s=900,
            location="38.5, -77.0",
            note="Fueling",
        )

    # 1 query for the Trip + ownership filter (RetrieveAPIView.get_object)
    # 1 prefetch batch for stops + log_events + log_days (Django batches
    # multiple prefetch_related targets into separate queries — adjust the
    # expected count if Django's prefetch internals change).
    with django_assert_num_queries(4):
        # 1 (Trip) + 3 (one per prefetch_related target)
        response = authenticated_client.get(f"/api/trips/{trip.id}/plan/")
    assert response.status_code == 200
