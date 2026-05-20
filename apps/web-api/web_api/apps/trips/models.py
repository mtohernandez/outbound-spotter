"""Trip data model and route cache.

A Trip row exists ⇔ the route was successfully resolved via ORS. Failure is
surfaced as an HTTP error response by ``TripCreateView`` and no row is ever
persisted (senior-review directive, post-live-smoke): the user stays on the
form with a toast and can retry without navigating to a half-resolved trip.

``TripRouteCache`` is keyed by SHA256 of the canonical coordinate string so
reviewers can re-run trips without burning the HeiGIT 2000/day quota.
"""

from __future__ import annotations

from decimal import Decimal
import uuid

from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models


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

    # Populated by ``services.plan_trip`` before the row is saved; nullable
    # at the column level only to keep the existing migration history reversible.
    route_polyline = models.JSONField(null=True, blank=True)
    route_segments = models.JSONField(null=True, blank=True)
    route_summary = models.JSONField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

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
