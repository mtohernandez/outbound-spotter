"""Trip data model and route cache.

Spec 04 adds: a ``TripStatus`` enum, four nullable route fields populated by
the ORS Directions pipeline (``services.plan_trip``), and a sibling
``TripRouteCache`` table keyed by SHA256 of the canonical coordinate string
(spec 04 decision 12) so reviewers can re-run trips without burning the
HeiGIT daily quota.
"""

from __future__ import annotations

from decimal import Decimal
import uuid

from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models


class TripStatus(models.TextChoices):
    """States `services.plan_trip` transitions a Trip through.

    Spec 04 drops the spec-03 ``"pending"`` value: the pipeline now writes
    PLANNING on row creation and transitions to PLANNED or FAILED inside the
    request handler. Migration 0002 ports any existing ``"pending"`` row.
    """

    PLANNING = "planning", "Planning"
    PLANNED = "planned", "Planned"
    FAILED = "failed", "Failed"


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

    status = models.CharField(
        max_length=16,
        choices=TripStatus.choices,
        default=TripStatus.PLANNING,
    )
    route_polyline = models.JSONField(null=True, blank=True)
    route_segments = models.JSONField(null=True, blank=True)
    route_summary = models.JSONField(null=True, blank=True)
    route_error_code = models.CharField(max_length=32, null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = (models.Index(fields=["user_id", "-created_at"]),)
        ordering = ("-created_at",)


class TripRouteCache(models.Model):
    """SHA256-keyed ORS Directions response cache (spec 04 decision 11).

    ``coords_canonical`` is denormalized so an operator can decode which trip a
    row caches without rebuilding the hash. ``payload`` stores the
    ``dataclasses.asdict(DirectionsResult)`` shape — hydrated back into the
    dataclass on cache hit in ``services.plan_trip``.
    """

    cache_key = models.CharField(primary_key=True, max_length=64)
    coords_canonical = models.CharField(max_length=255)
    payload = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)
