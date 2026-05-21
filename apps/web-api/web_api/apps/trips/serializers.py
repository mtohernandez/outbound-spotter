"""Request + response serializers for the Trip endpoints.

The ``start_at`` validator is intentionally a callable that reads
``timezone.now()`` per request — using ``MinValueValidator(timezone.now() - …)``
would freeze the cutoff at worker boot time. Architect-review M1.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, ClassVar

from django.utils import timezone
from rest_framework import serializers

from web_api.apps.trips.hos_adapter import HOME_TERMINAL_TZ
from web_api.apps.trips.models import LogDay, LogEvent, StopKind, Trip, TripStop

_PAST_SLACK = timedelta(minutes=5)


def _validate_start_at_not_past(value: datetime) -> None:
    """Reject ``start_at`` strictly more than 5 min in the past at request time.

    Fresh ``timezone.now()`` reads each call so the cutoff never freezes.
    The 5-min slack absorbs clock skew between FE and BE without admitting
    yesterday's submissions.
    """
    if value < timezone.now() - _PAST_SLACK:
        raise serializers.ValidationError("Start time cannot be in the past.")


class AddressInputSerializer(serializers.Serializer[None]):
    # `label` shadows DRF's `Field.label`; the wire contract uses `label`.
    label = serializers.CharField(  # type: ignore[assignment]
        min_length=1,
        max_length=255,
        trim_whitespace=True,
    )
    lat = serializers.FloatField(min_value=-90, max_value=90)
    lon = serializers.FloatField(min_value=-180, max_value=180)
    confidence = serializers.FloatField(min_value=0, max_value=1, required=False, allow_null=True)


class TripCreateRequestSerializer(serializers.Serializer[None]):
    current = AddressInputSerializer()
    pickup = AddressInputSerializer()
    dropoff = AddressInputSerializer()
    cycle_hours_used = serializers.DecimalField(
        max_digits=3,
        decimal_places=1,
        min_value=0,
        max_value=70,
    )
    # ISO 8601 with offset; the callable validator above re-reads timezone.now
    # at request time so a long-running worker can't ship a stale cutoff.
    start_at = serializers.DateTimeField(validators=[_validate_start_at_not_past])


class TripResponseSerializer(serializers.ModelSerializer[Trip]):
    class Meta:
        model = Trip
        fields: ClassVar[list[str]] = [
            "id",
            "created_at",
            "start_at",
            "current_label",
            "current_lat",
            "current_lon",
            "pickup_label",
            "pickup_lat",
            "pickup_lon",
            "dropoff_label",
            "dropoff_lat",
            "dropoff_lon",
            "cycle_hours_used",
            "route_polyline",
            "route_segments",
            "route_summary",
        ]
        read_only_fields = fields


class TripListItemSerializer(serializers.ModelSerializer[Trip]):
    """Thin row shape for ``GET /api/trips/`` (spec 09).

    ``days_count`` is sourced from the queryset annotation in
    ``TripManager.with_days_count``; the view that forgets to annotate will
    raise at serialization time (loud failure beats a wrong number).
    """

    days_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Trip
        fields: ClassVar[list[str]] = [
            "id",
            "current_label",
            "pickup_label",
            "dropoff_label",
            "route_summary",
            "days_count",
            "start_at",
            "created_at",
        ]
        read_only_fields = fields


class TripStopSerializer(serializers.ModelSerializer[TripStop]):
    kind = serializers.ChoiceField(choices=StopKind.choices)

    class Meta:
        model = TripStop
        fields: ClassVar[list[str]] = [
            "id",
            "kind",
            "sequence",
            "polyline_index",
            "lat",
            "lon",
            "label",
            "scheduled_at",
            "duration_s",
        ]
        read_only_fields = fields


class LogEventReadSerializer(serializers.ModelSerializer[LogEvent]):
    class Meta:
        model = LogEvent
        fields: ClassVar[list[str]] = [
            "id",
            "sequence",
            "status",
            "start",
            "duration_s",
            "location",
            "note",
        ]
        read_only_fields = fields


class LogDaySerializer(serializers.ModelSerializer[LogDay]):
    class Meta:
        model = LogDay
        fields: ClassVar[list[str]] = [
            "id",
            "date",
            "off_duty_s",
            "sleeper_s",
            "driving_s",
            "on_duty_not_driving_s",
            "total_miles",
        ]
        read_only_fields = fields


class TripPlanSerializer(serializers.Serializer[Trip]):
    """Composed read-only envelope for ``GET /api/trips/<id>/plan/``.

    ``to_representation`` reads the three reverse relations that
    ``TripPlanView`` already prefetched, so the serializer adds zero queries
    of its own. The retrieve runs in 4 queries total (1 Trip lookup + 3
    prefetch batches — one per reverse relation; Django does not batch
    multiple prefetch targets into a single SQL statement).
    """

    def to_representation(self, instance: Trip) -> dict[str, Any]:
        return {
            "trip_id": str(instance.id),
            "start_at": instance.start_at.isoformat() if instance.start_at else None,
            "home_terminal_tz": str(HOME_TERMINAL_TZ),
            "stops": TripStopSerializer(instance.stops.all(), many=True).data,
            "events": LogEventReadSerializer(instance.log_events.all(), many=True).data,
            "days": LogDaySerializer(instance.log_days.all(), many=True).data,
        }
