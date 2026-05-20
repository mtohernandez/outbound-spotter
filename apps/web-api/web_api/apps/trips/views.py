"""Stub Trip endpoints — create + retrieve with ownership enforcement.

Spec 04 swaps the create body for a real ORS Directions pipeline. For now the
endpoint persists the three addresses + cycle hours and echoes the row back so
the FE can navigate to ``/trips/:id``.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, ClassVar

from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from web_api.apps.trips.models import Trip
from web_api.apps.trips.serializers import (
    TripCreateRequestSerializer,
    TripResponseSerializer,
)

if TYPE_CHECKING:
    import uuid

    from rest_framework.request import Request


def _request_user_id(request: Request) -> str:
    user_id = getattr(request, "user_id", None)
    if not isinstance(user_id, str) or not user_id:
        raise PermissionDenied("Missing user identity on authenticated request.")
    return user_id


class TripCreateView(APIView):
    """``POST /api/trips/`` — create a trip and echo it back."""

    permission_classes: ClassVar[list[type[BasePermission]]] = [IsAuthenticated]  # type: ignore[misc]

    @extend_schema(
        request=TripCreateRequestSerializer,
        responses={201: TripResponseSerializer},
    )
    def post(self, request: Request) -> Response:
        serializer = TripCreateRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        trip = Trip.objects.create(
            user_id=_request_user_id(request),
            current_label=data["current"]["label"],
            current_lat=data["current"]["lat"],
            current_lon=data["current"]["lon"],
            pickup_label=data["pickup"]["label"],
            pickup_lat=data["pickup"]["lat"],
            pickup_lon=data["pickup"]["lon"],
            dropoff_label=data["dropoff"]["label"],
            dropoff_lat=data["dropoff"]["lat"],
            dropoff_lon=data["dropoff"]["lon"],
            cycle_hours_used=data["cycle_hours_used"],
        )
        return Response(
            TripResponseSerializer(trip).data,
            status=status.HTTP_201_CREATED,
        )


class TripRetrieveView(APIView):
    """``GET /api/trips/<uuid:id>/`` — fetch a trip; ownership enforced."""

    permission_classes: ClassVar[list[type[BasePermission]]] = [IsAuthenticated]  # type: ignore[misc]

    @extend_schema(responses={200: TripResponseSerializer})
    def get(self, request: Request, id: uuid.UUID) -> Response:
        try:
            trip = Trip.objects.get(pk=id)
        except Trip.DoesNotExist as exc:
            raise NotFound("Trip not found.") from exc

        if trip.user_id != _request_user_id(request):
            raise PermissionDenied("You do not have access to this trip.")

        return Response(TripResponseSerializer(trip).data)
