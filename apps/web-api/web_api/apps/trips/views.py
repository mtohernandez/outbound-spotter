"""Trip endpoints — list + create + retrieve + destroy + plan with ownership.

``TripListCreateView`` answers both ``GET /api/trips/`` (paginated owned
trips, thin serializer) and ``POST /api/trips/`` (the bespoke ORS+HOS create
flow from spec 04). Per-method throttle scopes (``trip_list`` vs
``trip_create``) are wired via ``get_throttles`` since DRF's
``ScopedRateThrottle`` reads ``view.throttle_scope`` at request time.

``TripRetrieveDestroyView`` answers ``GET /api/trips/<id>/`` (verbatim
spec-04 retrieve) and ``DELETE /api/trips/<id>/`` (spec 09 — hard delete,
cascade via FK ``on_delete=CASCADE``, 204 on success). DELETE is throttled
under ``trip_delete``; GET keeps the pre-spec-09 unthrottled behavior.

Django paths are path-only — two ``path("")`` entries (or two
``path("<uuid:id>/")`` entries) would collide on the first match — so these
multi-method views are how the same URL serves both verbs (spec 09
deviation; see plan file).

POST validation runs BEFORE any row persists; planner / ORS failures
return the project ``{detail, errors}`` envelope so the FE can toast.
``TripPlanView`` returns the persisted HOS plan envelope. All ownership
filtering happens in ``get_queryset`` so foreign trips surface as 404
(no oracle).
"""

from __future__ import annotations

from typing import TYPE_CHECKING, ClassVar

from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.exceptions import APIException
from rest_framework.generics import ListAPIView, RetrieveAPIView, RetrieveDestroyAPIView
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.response import Response

from web_api.apps.trips.models import Trip
from web_api.apps.trips.serializers import (
    TripCreateRequestSerializer,
    TripListItemSerializer,
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
    from django.db.models import QuerySet
    from rest_framework.request import Request
    from rest_framework.throttling import BaseThrottle


# User-facing copy. Avoid naming internal subsystems ("HOS planner",
# "fuel-stop solver", etc.) in error messages — security-auditor M-3.
_PLANNER_FAILED = (
    "Couldn't plan this trip. Try slightly different coordinates or a different start time."
)


class _MissingUserIdentity(APIException):
    """500: the JWT layer passed ``IsAuthenticated`` but didn't set ``user_id``.

    This is a server-side invariant violation (a misconfigured authentication
    class, not a client problem), so we fail loud rather than leaking 403 to
    a signed-in user. Security-auditor M-1.
    """

    status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
    default_detail = "Authentication state is incomplete on the server."
    default_code = "missing_user_identity"


def _request_user_id(request: Request) -> str:
    user_id = getattr(request, "user_id", None)
    if not isinstance(user_id, str) or not user_id:
        raise _MissingUserIdentity
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


class TripListCreateView(ListAPIView[Trip]):
    """``POST /api/trips/`` (custom ORS+HOS create) + ``GET /api/trips/`` (list).

    POST keeps the bespoke validate-then-persist pipeline so ORS failures
    short-circuit before any row hits the DB. GET answers the spec-09 list:
    ownership-filtered, ordered newest-first, paginated by the project-wide
    ``LimitOffsetPagination``, annotated with ``days_count`` via the manager
    so the response stays a single grouped JOIN.
    """

    permission_classes: ClassVar[list[type[BasePermission]]] = [IsAuthenticated]  # type: ignore[misc]
    # serializer_class powers GET. POST returns ``TripResponseSerializer`` directly.
    serializer_class = TripListItemSerializer

    def get_throttles(self) -> list[BaseThrottle]:
        # Per-method scope: ScopedRateThrottle reads ``view.throttle_scope``
        # at request time, so flipping it here is safe.
        self.throttle_scope = "trip_list" if self.request.method == "GET" else "trip_create"
        return super().get_throttles()

    def get_queryset(self) -> QuerySet[Trip]:
        # Used by GET only. POST never reads it.
        return (
            Trip.objects.with_days_count()
            .filter(user_id=_request_user_id(self.request))
            .order_by("-created_at")
        )

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


class TripRetrieveDestroyView(RetrieveDestroyAPIView[Trip]):
    """``GET /api/trips/<uuid:id>/`` + ``DELETE /api/trips/<uuid:id>/``.

    GET returns the spec-04 retrieve envelope. DELETE (spec 09) hard-deletes
    the row; FK ``on_delete=CASCADE`` removes ``TripStop`` / ``LogEvent`` /
    ``LogDay`` in the same statement. Ownership filtering lives in
    ``get_queryset`` so foreign UUIDs surface as 404 (no oracle — matches
    the spec-04 ``TripRetrieveView`` and spec-06 ``TripPlanView`` precedents).
    """

    permission_classes: ClassVar[list[type[BasePermission]]] = [IsAuthenticated]  # type: ignore[misc]
    serializer_class = TripResponseSerializer
    lookup_field = "id"

    def get_throttles(self) -> list[BaseThrottle]:
        # GET keeps the pre-spec-09 unthrottled behavior; DELETE is scoped.
        # Leaving ``throttle_scope`` unset on GET makes ``PerUserScopedThrottle``
        # a no-op (see ``web_api/throttling.py``).
        if self.request.method == "DELETE":
            self.throttle_scope = "trip_delete"
        return super().get_throttles()

    def get_queryset(self) -> QuerySet[Trip]:
        return Trip.objects.filter(user_id=_request_user_id(self.request))


class TripPlanView(RetrieveAPIView[Trip]):
    """``GET /api/trips/<uuid:id>/plan/`` — the persisted HOS plan envelope.

    ``get_queryset`` scopes to the requesting user so a foreign trip surfaces
    as 404 (no oracle). The three reverse relations are prefetched so the
    composed serializer issues no extra queries per row — the retrieve runs
    in 4 queries total: 1 for the Trip lookup + ownership filter, plus one
    batched prefetch per reverse relation (``stops`` / ``log_events`` /
    ``log_days``). Django does NOT batch multiple ``prefetch_related``
    targets into a single SQL statement; each target gets its own
    ``SELECT … WHERE trip_id IN (…)``.
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
