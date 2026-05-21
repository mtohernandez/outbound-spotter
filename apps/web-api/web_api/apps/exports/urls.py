from __future__ import annotations

from django.urls import path

from web_api.apps.exports.views import (
    TripExportDestroyView,
    TripExportListCreateView,
)

urlpatterns = [
    path("", TripExportListCreateView.as_view(), name="export-list-create"),
    path("<uuid:id>/", TripExportDestroyView.as_view(), name="export-destroy"),
]
