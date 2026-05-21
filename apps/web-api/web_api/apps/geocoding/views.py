"""Pelias proxy views. JWT-protected; forward to the typed ORS client."""

from __future__ import annotations

from dataclasses import asdict
from typing import TYPE_CHECKING, Any, ClassVar

from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from web_api.apps.geocoding.serializers import (
    AutocompleteRequestSerializer,
    FeaturesEnvelopeSerializer,
    ReverseRequestSerializer,
    SearchRequestSerializer,
)
from web_api.integrations.openrouteservice import (
    OrsRateLimitError,
    OrsRequestError,
    OrsUpstreamError,
    PeliasFeature,
    geocode_autocomplete,
    geocode_reverse,
    geocode_search,
)

if TYPE_CHECKING:
    from rest_framework.request import Request


def _features_payload(features: list[PeliasFeature]) -> list[dict[str, Any]]:
    return [asdict(f) for f in features]


def _ors_error_response(exc: Exception) -> Response:
    if isinstance(exc, OrsRateLimitError):
        return Response(
            {"detail": "Geocoder rate limit reached. Try again shortly.", "errors": None},
            status=status.HTTP_429_TOO_MANY_REQUESTS,
        )
    if isinstance(exc, OrsRequestError):
        return Response(
            {"detail": "Geocoder rejected the request.", "errors": None},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if isinstance(exc, OrsUpstreamError):
        return Response(
            {"detail": "Geocoder upstream error.", "errors": None},
            status=status.HTTP_502_BAD_GATEWAY,
        )
    raise exc


class GeocodeAutocompleteView(APIView):
    """As-you-type Pelias autocomplete. ``GET /api/geocode/autocomplete/?text=…``."""

    permission_classes: ClassVar[list[type[BasePermission]]] = [IsAuthenticated]  # type: ignore[misc]
    throttle_scope = "geocode_autocomplete"

    @extend_schema(
        parameters=[AutocompleteRequestSerializer],
        responses={200: FeaturesEnvelopeSerializer},
    )
    def get(self, request: Request) -> Response:
        serializer = AutocompleteRequestSerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        text: str = data["text"]
        size: int = data.get("size", 5)
        focus: tuple[float, float] | None = None
        if "focus_lat" in data and "focus_lon" in data:
            focus = (float(data["focus_lat"]), float(data["focus_lon"]))

        try:
            features = geocode_autocomplete(text, focus=focus, size=size)
        except (OrsRateLimitError, OrsRequestError, OrsUpstreamError) as exc:
            return _ors_error_response(exc)

        return Response({"features": _features_payload(features)})


class GeocodeSearchView(APIView):
    """Full-string Pelias search. ``GET /api/geocode/search/?text=…``."""

    permission_classes: ClassVar[list[type[BasePermission]]] = [IsAuthenticated]  # type: ignore[misc]
    throttle_scope = "geocode_search"

    @extend_schema(
        parameters=[SearchRequestSerializer],
        responses={200: FeaturesEnvelopeSerializer},
    )
    def get(self, request: Request) -> Response:
        serializer = SearchRequestSerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        text: str = data["text"]
        size: int = data.get("size", 1)

        try:
            features = geocode_search(text, size=size)
        except (OrsRateLimitError, OrsRequestError, OrsUpstreamError) as exc:
            return _ors_error_response(exc)

        return Response({"features": _features_payload(features)})


class GeocodeReverseView(APIView):
    """Coordinate-to-address Pelias reverse. ``GET /api/geocode/reverse/?lat=&lon=``.

    Powers the "Use my current location" UX in web-app (spec 11b): the FE calls
    ``navigator.geolocation.getCurrentPosition`` and hands the resulting (lat,
    lon) to this endpoint to resolve the user-visible label. Same `PeliasFeature`
    envelope as autocomplete + search so the FE consumes one type.
    """

    permission_classes: ClassVar[list[type[BasePermission]]] = [IsAuthenticated]  # type: ignore[misc]
    throttle_scope = "geocode_reverse"

    @extend_schema(
        parameters=[ReverseRequestSerializer],
        responses={200: FeaturesEnvelopeSerializer},
    )
    def get(self, request: Request) -> Response:
        serializer = ReverseRequestSerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        lat: float = float(data["lat"])
        lon: float = float(data["lon"])
        size: int = data.get("size", 1)

        try:
            features = geocode_reverse(lat, lon, size=size)
        except (OrsRateLimitError, OrsRequestError, OrsUpstreamError) as exc:
            return _ors_error_response(exc)

        return Response({"features": _features_payload(features)})
