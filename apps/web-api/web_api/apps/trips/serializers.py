"""Request + response serializers for the stub Trip endpoints."""

from __future__ import annotations

from typing import ClassVar

from rest_framework import serializers

from web_api.apps.trips.models import Trip


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


class TripResponseSerializer(serializers.ModelSerializer[Trip]):
    class Meta:
        model = Trip
        fields: ClassVar[list[str]] = [
            "id",
            "status",
            "created_at",
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
        ]
        read_only_fields = fields
