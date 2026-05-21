from __future__ import annotations

from django.urls import path

from web_api.apps.trips.views import (
    TripListCreateView,
    TripPlanView,
    TripRetrieveDestroyView,
)

urlpatterns = [
    path("", TripListCreateView.as_view(), name="trip-list-create"),
    path("<uuid:id>/", TripRetrieveDestroyView.as_view(), name="trip-retrieve-destroy"),
    path("<uuid:id>/plan/", TripPlanView.as_view(), name="trip-plan"),
]
