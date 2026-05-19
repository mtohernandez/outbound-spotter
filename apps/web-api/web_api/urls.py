"""Root URL configuration."""

from django.http import JsonResponse
from django.urls import path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView


def healthcheck(_request: object) -> JsonResponse:
    """Liveness probe. Used by Fly.io health checks."""
    return JsonResponse({"status": "ok"})


urlpatterns = [
    path("healthz", healthcheck, name="healthz"),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="docs"),
    # Feature URL configs land under `web_api.apps.*.urls` and are
    # included here once the first feature spec lands.
]
