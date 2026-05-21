"""DRF throttles (spec 04 + spec 11 follow-up).

The upstream ``ScopedRateThrottle`` keys on ``request.user`` — which is
``AnonymousUser`` under our JWT-only auth — and falls back to the client IP.
That collapses every user behind a NAT into one bucket. ``ClerkAuthentication``
sets ``request.user_id`` (the JWT ``sub``) on success, so we key on that
instead.

``PeliasGlobalThrottle`` adds a tenant-wide bucket across every Pelias proxy
endpoint (autocomplete + search + reverse) so one misbehaving user cannot
exhaust the shared HeiGIT 1000/day Pelias quota for everyone else. The
per-user throttles still apply on top.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, ClassVar

from rest_framework.throttling import ScopedRateThrottle, SimpleRateThrottle

if TYPE_CHECKING:
    from rest_framework.request import Request
    from rest_framework.views import APIView


class PerUserScopedThrottle(ScopedRateThrottle):
    def get_cache_key(self, request: Request, view: APIView) -> str | None:  # noqa: ARG002 — required by upstream signature
        user_id = getattr(request, "user_id", None)
        if not isinstance(user_id, str) or not user_id or not self.scope:
            return None
        return self.cache_format % {"scope": self.scope, "ident": user_id}


class PeliasGlobalThrottle(SimpleRateThrottle):
    """Single global bucket shared by every Pelias proxy view.

    Keys on a constant identity so all callers (every user, every endpoint)
    increment the same counter. Rate is configured under the
    ``pelias_global`` scope in ``REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]``
    and is tuned under the HeiGIT 1000/day Pelias cap so we surface a clean
    DRF 429 before the upstream does. The per-user ``PerUserScopedThrottle``
    still runs alongside this — both must pass for the request to proceed.
    """

    scope: ClassVar[str] = "pelias_global"  # type: ignore[misc]

    def get_cache_key(self, request: Request, view: APIView) -> str | None:  # noqa: ARG002 — upstream signature
        return self.cache_format % {"scope": self.scope, "ident": "global"}
