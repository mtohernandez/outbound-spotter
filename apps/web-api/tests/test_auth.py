"""Unit tests for `web_api.auth.ClerkAuthentication`.

We don't exercise the live Clerk JWKS — the SDK's `authenticate_request` is mocked at the
module boundary. The contract under test is the DRF wiring: header parsing, status mapping,
`request.user_id` set, and the 401 paths.
"""

from __future__ import annotations

from typing import Any
from unittest.mock import patch

from clerk_backend_api.security import AuthStatus, RequestState
from django.test import RequestFactory, override_settings
import pytest
from rest_framework import exceptions
from rest_framework.test import APIClient

from web_api.auth.authentication import ClerkAuthentication


@override_settings(CLERK_SECRET_KEY="sk_test_unit")
def test_missing_authorization_header_returns_none() -> None:
    """No header → authenticate returns None so DRF falls through to other authenticators."""
    request = RequestFactory().get("/api/me/")

    result = ClerkAuthentication().authenticate(request)

    assert result is None


@override_settings(CLERK_SECRET_KEY="")
def test_missing_secret_key_raises_401() -> None:
    """The class refuses to verify when the deployment forgot the secret key."""
    request = RequestFactory().get("/api/me/", HTTP_AUTHORIZATION="Bearer faketoken")

    with pytest.raises(exceptions.AuthenticationFailed, match="not configured"):
        ClerkAuthentication().authenticate(request)


@override_settings(CLERK_SECRET_KEY="sk_test_unit")
def test_valid_token_sets_request_user_id_and_returns_user() -> None:
    """Happy path: the SDK signals SIGNED_IN, the class builds a ClerkUser, request.user_id set."""
    request = RequestFactory().get("/api/me/", HTTP_AUTHORIZATION="Bearer goodtoken")
    fake_state = RequestState(
        status=AuthStatus.SIGNED_IN,
        token="goodtoken",
        payload={"sub": "user_abc123", "sid": "sess_xyz", "email": "driver@example.com"},
    )

    with patch(
        "web_api.auth.authentication.authenticate_request", return_value=fake_state
    ) as mocked:
        result = ClerkAuthentication().authenticate(request)

    mocked.assert_called_once()
    assert result is not None
    user, token = result
    assert user.id == "user_abc123"
    assert user.session_id == "sess_xyz"
    assert token == "goodtoken"
    assert request.user_id == "user_abc123"  # type: ignore[attr-defined]


@override_settings(CLERK_SECRET_KEY="sk_test_unit")
def test_signed_out_state_raises_401() -> None:
    """Expired/invalid token → SDK returns SIGNED_OUT → DRF raises 401."""
    request = RequestFactory().get("/api/me/", HTTP_AUTHORIZATION="Bearer expired")
    fake_state = RequestState(status=AuthStatus.SIGNED_OUT, token="expired", payload=None)

    with (
        patch("web_api.auth.authentication.authenticate_request", return_value=fake_state),
        pytest.raises(exceptions.AuthenticationFailed),
    ):
        ClerkAuthentication().authenticate(request)


@override_settings(CLERK_SECRET_KEY="sk_test_unit")
def test_missing_sub_claim_raises_401() -> None:
    """Token verifies but has no `sub` → can't bind to a user → 401."""
    request = RequestFactory().get("/api/me/", HTTP_AUTHORIZATION="Bearer no_sub")
    fake_state = RequestState(
        status=AuthStatus.SIGNED_IN,
        token="no_sub",
        payload={"sid": "sess_xyz"},  # no `sub`
    )

    with (
        patch("web_api.auth.authentication.authenticate_request", return_value=fake_state),
        pytest.raises(exceptions.AuthenticationFailed, match="sub"),
    ):
        ClerkAuthentication().authenticate(request)


@override_settings(CLERK_SECRET_KEY="sk_test_unit")
def test_me_endpoint_401_without_token() -> None:
    """End-to-end: `/api/me/` without Authorization → 401 (DRF's default)."""
    client = APIClient()

    response = client.get("/api/me/")

    assert response.status_code == 401


@override_settings(CLERK_SECRET_KEY="sk_test_unit")
def test_me_endpoint_returns_user_with_valid_token() -> None:
    """End-to-end: valid Bearer → 200 + JSON shape `{user_id, session_id, email}`."""
    client = APIClient()
    fake_state = RequestState(
        status=AuthStatus.SIGNED_IN,
        token="goodtoken",
        payload={"sub": "user_abc", "sid": "sess_xyz", "email": "driver@example.com"},
    )

    with patch("web_api.auth.authentication.authenticate_request", return_value=fake_state):
        response = client.get("/api/me/", HTTP_AUTHORIZATION="Bearer goodtoken")

    assert response.status_code == 200
    body: dict[str, Any] = response.json()
    assert body == {
        "user_id": "user_abc",
        "session_id": "sess_xyz",
        "email": "driver@example.com",
    }
