"""DRF authentication that verifies Clerk session JWTs.

The flow is documented at <https://clerk.com/docs/guides/development/authentication/session-tokens>
and validated against the installed `clerk-backend-api` 5.0.6 surface:
`security.authenticate_request` accepts anything that exposes `.headers` and returns a
`RequestState` whose `.payload['sub']` carries the canonical user id. We adapt Django's
`HttpRequest` to that protocol, surface a lightweight `ClerkUser` to DRF, and let `request.user_id`
remain the source of truth used elsewhere in the project.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, Any, cast

from clerk_backend_api.security import (
    AuthenticateRequestOptions,
    AuthStatus,
    RequestState,
    authenticate_request,
)
from django.conf import settings
from rest_framework import authentication, exceptions

if TYPE_CHECKING:
    from collections.abc import Mapping

    from django.http import HttpRequest


@dataclass(frozen=True, slots=True)
class ClerkUser:
    """Read-only user-shaped record sourced from a verified Clerk session token.

    DRF expects `request.user` to expose `is_authenticated`. We carry the decoded `sub`
    (Clerk user id), the session id, and the full claim payload so views can reach into
    organisation membership / role data when those endpoints land.
    """

    id: str
    session_id: str | None
    claims: Mapping[str, Any]

    @property
    def is_authenticated(self) -> bool:
        return True

    @property
    def is_anonymous(self) -> bool:
        return False


class _DjangoRequestAdapter:
    """Bridge `HttpRequest.META` to the simple `.headers` shape Clerk's SDK expects."""

    __slots__ = ("_headers",)

    def __init__(self, request: HttpRequest) -> None:
        # `HttpRequest.headers` is a case-insensitive view already; we wrap it as a dict so the
        # SDK's `Requestish.headers` Protocol (which only requires `Mapping[str, str]`) is met.
        self._headers = dict(request.headers.items())

    @property
    def headers(self) -> Mapping[str, str]:
        return self._headers


class ClerkAuthentication(authentication.BaseAuthentication):
    """DRF auth class verifying the `Authorization: Bearer <jwt>` Clerk session token.

    On success returns `(ClerkUser, token)` so `request.user.is_authenticated` is `True` for
    `IsAuthenticated` permissions, and `request.auth` carries the raw JWT for downstream
    inspection. On a missing/invalid/expired token raises `AuthenticationFailed` (HTTP 401).
    Missing Authorization header returns `None`, letting other authenticators run.
    """

    def authenticate(self, request: HttpRequest) -> tuple[ClerkUser, str] | None:
        if "Authorization" not in request.headers and "authorization" not in request.headers:
            return None

        secret_key = settings.CLERK_SECRET_KEY
        if not secret_key:
            raise exceptions.AuthenticationFailed(
                "Clerk secret key is not configured — web-api cannot verify session tokens."
            )

        adapter = _DjangoRequestAdapter(request)
        options = AuthenticateRequestOptions(secret_key=secret_key)
        state: RequestState = authenticate_request(adapter, options)

        if state.status != AuthStatus.SIGNED_IN or state.payload is None:
            message = state.message or "Invalid or expired Clerk session token."
            raise exceptions.AuthenticationFailed(message)

        sub = state.payload.get("sub")
        if not isinstance(sub, str) or not sub:
            raise exceptions.AuthenticationFailed("Clerk token is missing a `sub` claim.")

        user = ClerkUser(
            id=sub,
            session_id=cast("str | None", state.payload.get("sid")),
            claims=state.payload,
        )
        # Mirror the architecture-doc invariant: `request.user_id` is the canonical user id
        # everywhere ownership is checked downstream. Set it on the request object so views
        # never have to destructure `request.user.id` themselves. The dynamic attribute
        # assignment is documented in `apps/web-api/web_api/auth/authentication.py`.
        request.user_id = sub  # type: ignore[attr-defined]
        token = state.token or ""
        return user, token

    def authenticate_header(self, request: HttpRequest) -> str:  # noqa: ARG002
        return 'Bearer realm="api"'
