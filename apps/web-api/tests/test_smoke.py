"""Smoke tests: the project boots and the URL graph resolves."""

from __future__ import annotations

from django.test import Client
from django.urls import reverse
import pytest


def test_django_settings_load() -> None:
    """The settings module imports without raising."""
    from web_api.settings import dev  # noqa: F401,PLC0415


def test_healthcheck_url_resolves() -> None:
    """`/healthz` is registered and reachable."""
    assert reverse("healthz") == "/healthz"


def test_healthcheck_returns_ok() -> None:
    """`/healthz` returns 200 + `{"status": "ok"}` without hitting the DB."""
    response = Client().get("/healthz")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_api_healthz_url_resolves() -> None:
    """`/api/healthz/` is registered for the DB-aware probe (spec 12)."""
    assert reverse("api_healthz") == "/api/healthz/"


@pytest.mark.django_db
def test_api_healthz_returns_ok_with_db() -> None:
    """`/api/healthz/` returns 200 + `{"status": "ok", "db": true}` after a SELECT 1."""
    response = Client().get("/api/healthz/")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "db": True}
