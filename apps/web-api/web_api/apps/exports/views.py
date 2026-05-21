"""Export-audit endpoints: list + create + destroy with ownership filter.

Mirrors the spec-09 ``TripListCreateView`` / ``TripRetrieveDestroyView``
shape so the same per-method throttle-scope flip works here. POST re-checks
ownership of the supplied ``trip_id`` against ``Trip`` (404 on foreign IDs
— no oracle). ``sheet_count`` is server-computed from
``trip.log_days.count()`` so a malicious client can't inflate it. The row
write is wrapped in ``transaction.atomic`` for parity with
``services.plan_trip``.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, ClassVar

from django.db import transaction
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.exceptions import APIException
from rest_framework.generics import ListAPIView, RetrieveDestroyAPIView
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.response import Response

from web_api.apps.exports.models import TripExport
from web_api.apps.exports.serializers import (
    TripExportCreateRequestSerializer,
    TripExportListItemSerializer,
    TripExportResponseSerializer,
)
from web_api.apps.trips.models import Trip

if TYPE_CHECKING:
    from django.db.models import QuerySet
    from rest_framework.request import Request
    from rest_framework.throttling import BaseThrottle


# User-facing copy. Avoid naming internal subsystems ("HOS planner",
# "TripExport row", etc.) in error messages — security-auditor M-3 from
# spec 06.
_TRIP_HAS_NO_LOG_DAYS = "This trip has no log days to export."


class _MissingUserIdentity(APIException):
    """500: JWT layer passed ``IsAuthenticated`` but didn't set ``user_id``.

    Server-side invariant violation (misconfigured authentication class),
    not a client problem. Failing loud surfaces the misconfig to operators;
    403 would have leaked "permission" context for a server-only fault.
    Security-auditor M-1 from spec 06.
    """

    status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
    default_detail = "Authentication state is incomplete on the server."
    default_code = "missing_user_identity"


def _request_user_id(request: Request) -> str:
    user_id = getattr(request, "user_id", None)
    if not isinstance(user_id, str) or not user_id:
        raise _MissingUserIdentity
    return user_id


class TripExportListCreateView(ListAPIView[TripExport]):
    """``GET /api/exports/`` (paginated, ownership-filtered) + ``POST /api/exports/``.

    GET returns the user's exports ordered newest-first. POST writes an
    audit row after a server-side ownership re-check + sheet-count compute.
    """

    permission_classes: ClassVar[list[type[BasePermission]]] = [IsAuthenticated]  # type: ignore[misc]
    serializer_class = TripExportListItemSerializer

    def get_throttles(self) -> list[BaseThrottle]:
        self.throttle_scope = "export_list" if self.request.method == "GET" else "export_create"
        return super().get_throttles()

    def get_queryset(self) -> QuerySet[TripExport]:
        return TripExport.objects.for_user(_request_user_id(self.request))

    @extend_schema(
        request=TripExportCreateRequestSerializer,
        responses={201: TripExportResponseSerializer},
    )
    def post(self, request: Request) -> Response:
        serializer = TripExportCreateRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user_id = _request_user_id(request)

        # Ownership re-check: 404 (not 403) so the existence of a Trip UUID
        # isn't leakable across users (no oracle — matches the spec-09
        # destroy-view precedent).
        trip = Trip.objects.filter(
            id=serializer.validated_data["trip_id"],
            user_id=user_id,
        ).first()
        if trip is None:
            return Response(
                {"detail": "Trip not found.", "errors": None},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Server-side compute; FE-supplied count would be tamperable.
        sheet_count = trip.log_days.count()
        if sheet_count == 0:
            # Spec 06's plan-table invariant guarantees this can't happen on
            # any persisted Trip, but the view stays defensive so a future
            # data-migration bug surfaces here as 422 rather than persisting
            # a misleading audit row.
            return Response(
                {"detail": _TRIP_HAS_NO_LOG_DAYS, "errors": None},
                status=status.HTTP_422_UNPROCESSABLE_ENTITY,
            )

        with transaction.atomic():
            export = TripExport.objects.create(
                user_id=user_id,
                trip=trip,
                trip_current_label=trip.current_label,
                trip_pickup_label=trip.pickup_label,
                trip_dropoff_label=trip.dropoff_label,
                mode=serializer.validated_data["mode"],
                sheet_count=sheet_count,
            )

        return Response(
            TripExportResponseSerializer(export).data,
            status=status.HTTP_201_CREATED,
        )


class TripExportDestroyView(RetrieveDestroyAPIView[TripExport]):
    """``DELETE /api/exports/<uuid:id>/`` — remove an audit row.

    The PDF on the user's disk is unaffected; deleting an audit row only
    removes the history entry. GET is also exposed (free with
    ``RetrieveDestroyAPIView``) and harmless — mirrors the trips precedent.
    """

    permission_classes: ClassVar[list[type[BasePermission]]] = [IsAuthenticated]  # type: ignore[misc]
    serializer_class = TripExportListItemSerializer
    lookup_field = "id"
    throttle_scope = "export_delete"

    def get_queryset(self) -> QuerySet[TripExport]:
        return TripExport.objects.for_user(_request_user_id(self.request))
