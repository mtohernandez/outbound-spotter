"""Request + response serializers for the Pelias proxy.

Request validation is what keeps the upstream blast radius small: ``text`` is
length-bounded, ``size`` is clamped at the client layer too, and ``focus``
coordinates are kept inside their valid ranges.
"""

from __future__ import annotations

from rest_framework import serializers


class AutocompleteRequestSerializer(serializers.Serializer[None]):
    text = serializers.CharField(min_length=1, max_length=200, trim_whitespace=True)
    size = serializers.IntegerField(min_value=1, max_value=10, required=False, default=5)
    focus_lat = serializers.FloatField(min_value=-90, max_value=90, required=False)
    focus_lon = serializers.FloatField(min_value=-180, max_value=180, required=False)

    def validate(self, attrs: dict[str, object]) -> dict[str, object]:
        focus_lat_present = "focus_lat" in attrs
        focus_lon_present = "focus_lon" in attrs
        if focus_lat_present != focus_lon_present:
            raise serializers.ValidationError(
                "focus_lat and focus_lon must be provided together.",
            )
        return attrs


class SearchRequestSerializer(serializers.Serializer[None]):
    text = serializers.CharField(min_length=1, max_length=200, trim_whitespace=True)
    size = serializers.IntegerField(min_value=1, max_value=10, required=False, default=1)


class PeliasFeatureSerializer(serializers.Serializer[None]):
    # `label` shadows `Field.label` from the DRF base; the wire contract uses
    # `label` so we suppress the assignment-type warning here rather than rename.
    label = serializers.CharField()  # type: ignore[assignment]
    country_a = serializers.CharField(allow_null=True)
    region_a = serializers.CharField(allow_null=True)
    locality = serializers.CharField(allow_null=True)
    confidence = serializers.FloatField(allow_null=True)
    match_type = serializers.CharField(allow_null=True)
    lat = serializers.FloatField()
    lon = serializers.FloatField()


class FeaturesEnvelopeSerializer(serializers.Serializer[None]):
    """Wrapper used only for the OpenAPI schema — `{"features": [...]}`."""

    features = PeliasFeatureSerializer(many=True)
