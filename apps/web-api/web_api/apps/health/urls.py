from __future__ import annotations

from django.urls import path

from web_api.apps.health.views import HealthzView

urlpatterns = [
    path("healthz/", HealthzView.as_view(), name="api_healthz"),
]
