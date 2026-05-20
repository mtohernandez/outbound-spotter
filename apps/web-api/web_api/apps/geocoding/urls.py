from __future__ import annotations

from django.urls import path

from web_api.apps.geocoding.views import GeocodeAutocompleteView, GeocodeSearchView

urlpatterns = [
    path("autocomplete/", GeocodeAutocompleteView.as_view(), name="geocode-autocomplete"),
    path("search/", GeocodeSearchView.as_view(), name="geocode-search"),
]
