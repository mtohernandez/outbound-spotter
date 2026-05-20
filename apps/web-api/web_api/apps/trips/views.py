"""Trip endpoints — create + retrieve + plan with ownership enforcement.

``TripCreateView`` runs ORS validation BEFORE persisting any row and runs
the HOS planner inside the same atomic block (spec 06). Any failure — ORS
4xx/5xx, ORS rate limit, planner ``ValueError`` — returns the project
``{detail, errors}`` envelope; the row never persists. The FE renders
``detail`` as a toast and preserves the form state (senior-review directive,
post-live-smoke).

``TripPlanView`` returns the persisted HOS plan envelope. ``get_queryset``
filters on ``request.user_id`` so foreign trips surface as 404 (no oracle).
"""

from __future__ import annotations

from typing import TYPE_CHECKING, ClassVar

from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.generics import RetrieveAPIView
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from web_api.apps.trips.models import Trip
from web_api.apps.trips.serializers import (
    TripCreateRequestSerializer,
    TripPlanSerializer,
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

    from django.db.models import QuerySet
    from rest_framework.request import Request


_TRIP_NOT_FOUND = "Trip not found."
_PLANNER_FAILED = (
    "Couldn't plan this trip. The HOS planner refused these inputs."
    " Try slightly different coordinates or a different start time."
)


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
        except ValueError:
            # The planner refused the inputs (PlannerInputs.__post_init__ or
            # the fuel-stop polyline-vs-summary sanity check). The atomic
            # block already rolled back the Trip insert. 422 distinguishes
            # planner faults from routing faults.
            return Response(
                {"detail": _PLANNER_FAILED, "errors": None},
                status=status.HTTP_422_UNPROCESSABLE_ENTITY,
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
        trip = Trip.objects.filter(pk=id, user_id=_request_user_id(request)).first()
        if trip is None:
            raise NotFound(_TRIP_NOT_FOUND)
        return Response(TripResponseSerializer(trip).data)


class TripPlanView(RetrieveAPIView[Trip]):
    """``GET /api/trips/<uuid:id>/plan/`` — the persisted HOS plan envelope.

    ``get_queryset`` scopes to the requesting user so a foreign trip surfaces
    as 404 (no oracle). The three reverse relations are prefetched so the
    composed serializer issues a single batched query — the retrieve runs
    in exactly 2 queries (assert via ``django_assert_num_queries(2)`` in the
    view test).
    """

    permission_classes: ClassVar[list[type[BasePermission]]] = [IsAuthenticated]  # type: ignore[misc]
    serializer_class = TripPlanSerializer
    lookup_field = "id"
    throttle_scope = "trip_plan_retrieve"

    def get_queryset(self) -> QuerySet[Trip]:
        return Trip.objects.filter(user_id=_request_user_id(self.request)).prefetch_related(
            "stops",
            "log_events",
            "log_days",
        )
