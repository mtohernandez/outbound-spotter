"""Trip data model, route cache, and persisted HOS plan rows.

A Trip row exists ⇔ the route was successfully resolved via ORS AND the HOS
planner produced a non-empty plan. Both happen inside one ``transaction.atomic``
in ``services.plan_trip``; any failure rolls back the entire row + its plan.

``TripRouteCache`` is keyed by SHA256 of the canonical coordinate string so
reviewers can re-run trips without burning the HeiGIT 2000/day quota.

The three plan tables — ``TripStop``, ``LogEvent``, ``LogDay`` — are populated
by ``hos_adapter.materialize_plan`` (the only one-way bridge between the
pure-Python planner in ``web_api/hos/`` and the Django ORM, per architecture
invariant #1). ``DutyStatusChoices`` mirrors ``web_api.hos.types.DutyStatus``
members and the parity is asserted by
``apps/web-api/tests/hos/test_boundary.py::test_duty_status_parity_with_django_choices``;
extending the enum requires updating both sides plus a migration.
"""

from __future__ import annotations

from decimal import Decimal
import uuid

from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from web_api.apps.trips.managers import TripManager


class StopKind(models.TextChoices):
    PICKUP = "pickup", "Pickup"
    DROPOFF = "dropoff", "Dropoff"
    FUEL = "fuel", "Fuel"
    BREAK = "break", "Break"
    SLEEPER = "sleeper", "Sleeper"
    RESTART = "restart", "Restart"


class DutyStatusChoices(models.TextChoices):
    """§395.8 duty-status categories. Mirrors ``web_api.hos.types.DutyStatus``.

    Parity is enforced by ``test_duty_status_parity_with_django_choices``.
    """

    OFF_DUTY = "off_duty", "Off duty"
    SLEEPER_BERTH = "sleeper_berth", "Sleeper berth"
    DRIVING = "driving", "Driving"
    ON_DUTY_NOT_DRIVING = "on_duty_not_driving", "On duty (not driving)"


class Trip(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user_id = models.CharField(max_length=64)

    current_label = models.CharField(max_length=255)
    current_lat = models.FloatField()
    current_lon = models.FloatField()

    pickup_label = models.CharField(max_length=255)
    pickup_lat = models.FloatField()
    pickup_lon = models.FloatField()

    dropoff_label = models.CharField(max_length=255)
    dropoff_lat = models.FloatField()
    dropoff_lon = models.FloatField()

    cycle_hours_used = models.DecimalField(
        max_digits=3,
        decimal_places=1,
        validators=[MinValueValidator(Decimal("0")), MaxValueValidator(Decimal("70"))],
    )

    # Driver-chosen shift start in their home-terminal time zone. Stored
    # tz-aware (USE_TZ=True). Required at create-time; migration 0004
    # backfills any pre-existing rows to ``created_at`` for reversibility.
    start_at = models.DateTimeField()

    # Populated by ``services.plan_trip`` before the row is saved; nullable
    # at the column level only to keep the existing migration history reversible.
    route_polyline = models.JSONField(null=True, blank=True)
    route_segments = models.JSONField(null=True, blank=True)
    route_summary = models.JSONField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    objects: TripManager = TripManager()

    class Meta:
        indexes = (models.Index(fields=["user_id", "-created_at"]),)
        ordering = ("-created_at",)


class TripRouteCache(models.Model):
    """SHA256-keyed ORS Directions response cache.

    ``coords_canonical`` is denormalized so an operator can decode which trip a
    row caches without rebuilding the hash. ``payload`` stores the
    ``dataclasses.asdict(DirectionsResult)`` shape — hydrated back into the
    dataclass on cache hit in ``services.plan_trip``.
    """

    cache_key = models.CharField(primary_key=True, max_length=64)
    coords_canonical = models.CharField(max_length=255)
    payload = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)


class TripStop(models.Model):
    """A driver-observable stop along the route (pickup, dropoff, fuel, rest)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    trip = models.ForeignKey(Trip, on_delete=models.CASCADE, related_name="stops")
    kind = models.CharField(max_length=16, choices=StopKind.choices)
    sequence = models.PositiveSmallIntegerField()
    polyline_index = models.PositiveIntegerField()
    lat = models.DecimalField(max_digits=9, decimal_places=6)
    lon = models.DecimalField(max_digits=9, decimal_places=6)
    label = models.CharField(max_length=128, blank=True)
    scheduled_at = models.DateTimeField()
    duration_s = models.PositiveIntegerField()

    class Meta:
        indexes = (models.Index(fields=["trip", "sequence"]),)
        constraints = (
            models.UniqueConstraint(fields=["trip", "sequence"], name="unique_trip_stop_seq"),
        )
        ordering = ("trip", "sequence")


class LogEvent(models.Model):
    """One §395.8 duty-status change. Invariant #2: one row per change."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    trip = models.ForeignKey(Trip, on_delete=models.CASCADE, related_name="log_events")
    sequence = models.PositiveSmallIntegerField()
    # max_length=32 leaves ~12 chars of slack for future §395.8 enum additions
    # (architect-review m3 against the spec text).
    status = models.CharField(max_length=32, choices=DutyStatusChoices.choices)
    start = models.DateTimeField()
    duration_s = models.PositiveIntegerField()
    location = models.CharField(max_length=128)
    note = models.CharField(max_length=255, blank=True)

    class Meta:
        indexes = (
            models.Index(fields=["trip", "sequence"]),
            models.Index(fields=["trip", "start"]),
        )
        constraints = (
            models.UniqueConstraint(fields=["trip", "sequence"], name="unique_trip_log_event_seq"),
        )
        ordering = ("trip", "sequence")


class LogDay(models.Model):
    """Per-24h-period rollup keyed on the home-terminal local date.

    Denormalized at write time. Midnight-crossing events split per-day in the
    per-status second totals; the corresponding ``LogEvent`` rows stay one
    block (invariant #2). See ``hos_adapter._attribute_to_days``.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    trip = models.ForeignKey(Trip, on_delete=models.CASCADE, related_name="log_days")
    date = models.DateField()
    off_duty_s = models.PositiveIntegerField()
    sleeper_s = models.PositiveIntegerField()
    driving_s = models.PositiveIntegerField()
    on_duty_not_driving_s = models.PositiveIntegerField()
    total_miles = models.DecimalField(max_digits=7, decimal_places=1)

    class Meta:
        indexes = (models.Index(fields=["trip", "date"]),)
        constraints = (
            models.UniqueConstraint(fields=["trip", "date"], name="unique_trip_log_day_date"),
        )
        ordering = ("trip", "date")
