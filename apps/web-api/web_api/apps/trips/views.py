"""Trip endpoints — create + retrieve with ownership enforcement.

``TripCreateView`` runs ORS validation BEFORE persisting any row: if the
routing service rejects the coordinates (or is temporarily unavailable), the
view returns the project ``{detail, errors}`` error envelope and no Trip is
created. The FE renders the ``detail`` text as a toast so the form state is
preserved and the user can retry without navigating away (senior-review
directive, post-live-smoke).
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
from web_api.integrations.openrouteservice import (
    OrsRateLimitError,
    OrsRequestError,
    OrsUpstreamError,
)

if TYPE_CHECKING:
    import uuid

    from rest_framework.request import Request


_TRIP_NOT_FOUND = "Trip not found."


def _request_user_id(request: Request) -> str:
    user_id = getattr(request, "user_id", None)
    if not isinstance(user_id, str) or not user_id:
        raise PermissionDenied("Missing user identity on authenticated request.")
    return user_id


# Copy shown to the user when the routing service rejects or stalls. Keep in
# sync with the equivalent FE strings in ``route-summary.tsx`` if/when that
# component re-introduces server-side messaging; today the FE just renders
# whatever ``detail`` the view emits.
_RATE_LIMIT_PER_MINUTE = (
    "Routing service is busy. We hit the per-minute routing quota. Try again in a moment."
)
_RATE_LIMIT_DAILY = (
    "Daily routing quota exhausted. The routing service is rate-limited"
    " until tomorrow. Try again then."
)
_VALIDATION = (
    "Couldn't plan this route. The routing service refused these"
    " coordinates. Try slightly different addresses."
)
_UPSTREAM = (
    "Couldn't reach the routing service. The routing service didn't respond. Try again in a moment."
)


def _routing_error_response(exc: Exception) -> Response:
    if isinstance(exc, OrsRateLimitError):
        detail = _RATE_LIMIT_DAILY if exc.window == "daily" else _RATE_LIMIT_PER_MINUTE
        return Response(
            {"detail": detail, "errors": None},
            status=status.HTTP_429_TOO_MANY_REQUESTS,
        )
    if isinstance(exc, OrsRequestError):
        return Response(
            {"detail": _VALIDATION, "errors": None},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if isinstance(exc, OrsUpstreamError):
        return Response(
            {"detail": _UPSTREAM, "errors": None},
            status=status.HTTP_502_BAD_GATEWAY,
        )
    raise exc


class TripCreateView(APIView):
    """``POST /api/trips/`` — validate via ORS, then persist on success.

    On routing failure the response is an HTTP error envelope; no row is
    persisted. The FE toasts ``detail`` and keeps the form state.
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

        try:
            trip = plan_trip(serializer.validated_data, _request_user_id(request))
        except (OrsRateLimitError, OrsRequestError, OrsUpstreamError) as exc:
            return _routing_error_response(exc)

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
