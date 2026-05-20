from __future__ import annotations

from django.urls import path

from web_api.apps.trips.views import TripCreateView, TripRetrieveView

urlpatterns = [
    path("", TripCreateView.as_view(), name="trip-create"),
    path("<uuid:id>/", TripRetrieveView.as_view(), name="trip-retrieve"),
]
