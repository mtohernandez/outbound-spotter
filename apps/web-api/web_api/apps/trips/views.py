"""Trip endpoints — create + retrieve with ownership enforcement.

Spec 04: ``TripCreateView`` delegates to ``services.plan_trip``, which runs
the ORS Directions pipeline and writes the resulting status (PLANNED / FAILED)
back on the Trip row. The view always returns 201 with the discriminated
resource; the FE branches on ``data.status`` (spec 04 decision 14).
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
from web_api.apps.trips.services import plan_trip

if TYPE_CHECKING:
    import uuid

    from rest_framework.request import Request


# Sentinel for the retrieve path: 403 vs 404 leaks existence to a probe, so we
# always return 404 when the trip either doesn't exist or isn't owned by the
# caller. UUIDv4 entropy makes brute-force infeasible, but the principle holds.
_TRIP_NOT_FOUND = "Trip not found."


def _request_user_id(request: Request) -> str:
    user_id = getattr(request, "user_id", None)
    if not isinstance(user_id, str) or not user_id:
        raise PermissionDenied("Missing user identity on authenticated request.")
    return user_id


class TripCreateView(APIView):
    """``POST /api/trips/`` — create a trip and resolve its route via ORS.

    Always returns 201 with the trip resource. Route success/failure is
    discriminated by the ``status`` field (PLANNED vs FAILED), not by HTTP
    code — see spec 04 decision 14.
    """

    permission_classes: ClassVar[list[type[BasePermission]]] = [IsAuthenticated]  # type: ignore[misc]
    throttle_scope = "trip_create"

    @extend_schema(
        request=TripCreateRequestSerializer,
        responses={201: TripResponseSerializer},
    )
    def post(self, request: Request) -> Response:
        serializer = TripCreateRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        trip = plan_trip(serializer.validated_data, _request_user_id(request))
        return Response(
            TripResponseSerializer(trip).data,
            status=status.HTTP_201_CREATED,
        )


class TripRetrieveView(APIView):
    """``GET /api/trips/<uuid:id>/`` — fetch a trip; ownership enforced."""

    permission_classes: ClassVar[list[type[BasePermission]]] = [IsAuthenticated]  # type: ignore[misc]

    @extend_schema(responses={200: TripResponseSerializer})
    def get(self, request: Request, id: uuid.UUID) -> Response:
        trip = Trip.objects.filter(pk=id, user_id=_request_user_id(request)).first()
        if trip is None:
            raise NotFound(_TRIP_NOT_FOUND)
        return Response(TripResponseSerializer(trip).data)
