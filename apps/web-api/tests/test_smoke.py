"""Smoke tests: the project boots and the URL graph resolves."""

from __future__ import annotations

from django.test import Client
from django.urls import reverse


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
