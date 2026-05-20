"""Auth-adjacent views — currently just the protected `me` ping that proves the JWT chain."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any, ClassVar

from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

if TYPE_CHECKING:
    from rest_framework.request import Request

    from web_api.auth.authentication import ClerkUser


class MeView(APIView):
    """Returns the decoded Clerk session for the current request.

    Used by the web-app to confirm the JWT round-trip works and to pick up the canonical user id
    server-side. Any unauthenticated request gets a 401 from DRF's `IsAuthenticated` permission.
    """

    permission_classes: ClassVar[list[type[BasePermission]]] = [IsAuthenticated]  # type: ignore[misc]

    def get(self, request: Request) -> Response:
        user: ClerkUser = request.user  # type: ignore[assignment]
        payload: dict[str, Any] = {
            "user_id": user.id,
            "session_id": user.session_id,
            "email": user.claims.get("email"),
        }
        return Response(payload)
