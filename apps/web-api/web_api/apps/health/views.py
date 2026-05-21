"""`/api/healthz/` — DB-aware liveness probe.

The root `/healthz` endpoint stays the cheap liveness ping (no DB). This one
runs a single `SELECT 1` so the Vercel runtime + Neon connection are exercised
end-to-end. Used by the post-deploy smoke check in `context/specs/12-*`.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, ClassVar

from django.db import DatabaseError, connection
from rest_framework.permissions import AllowAny, BasePermission
from rest_framework.response import Response
from rest_framework.views import APIView

if TYPE_CHECKING:
    from rest_framework.authentication import BaseAuthentication
    from rest_framework.request import Request
    from rest_framework.throttling import BaseThrottle


class HealthzView(APIView):
    authentication_classes: ClassVar[list[type[BaseAuthentication]]] = []  # type: ignore[misc]
    permission_classes: ClassVar[list[type[BasePermission]]] = [AllowAny]  # type: ignore[misc]
    throttle_classes: ClassVar[list[type[BaseThrottle]]] = []  # type: ignore[misc]

    def get(self, _request: Request) -> Response:
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
                cursor.fetchone()
        except DatabaseError:
            return Response({"status": "degraded", "db": False}, status=503)
        return Response({"status": "ok", "db": True})
