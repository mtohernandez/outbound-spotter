"""Per-user scoped DRF throttle (spec 04 decision 16).

The upstream ``ScopedRateThrottle`` keys on ``request.user`` — which is
``AnonymousUser`` under our JWT-only auth — and falls back to the client IP.
That collapses every user behind a NAT into one bucket. ``ClerkAuthentication``
sets ``request.user_id`` (the JWT ``sub``) on success, so we key on that
instead.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from rest_framework.throttling import ScopedRateThrottle

if TYPE_CHECKING:
    from rest_framework.request import Request
    from rest_framework.views import APIView


class PerUserScopedThrottle(ScopedRateThrottle):
    def get_cache_key(self, request: Request, view: APIView) -> str | None:  # noqa: ARG002 — required by upstream signature
        user_id = getattr(request, "user_id", None)
        if not isinstance(user_id, str) or not user_id or not self.scope:
            return None
        return self.cache_format % {"scope": self.scope, "ident": user_id}
