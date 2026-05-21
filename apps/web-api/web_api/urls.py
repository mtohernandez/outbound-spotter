"""Root URL configuration."""

from django.http import JsonResponse
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

from web_api.auth.views import MeView


def healthcheck(_request: object) -> JsonResponse:
    """Cheap liveness ping (no DB). DB-aware probe lives at `/api/healthz/`."""
    return JsonResponse({"status": "ok"})


urlpatterns = [
    path("healthz", healthcheck, name="healthz"),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="docs"),
    path("api/me/", MeView.as_view(), name="me"),
    path("api/", include("web_api.apps.health.urls")),
    path("api/geocode/", include("web_api.apps.geocoding.urls")),
    path("api/trips/", include("web_api.apps.trips.urls")),
    path("api/exports/", include("web_api.apps.exports.urls")),
]
