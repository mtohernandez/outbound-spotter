from __future__ import annotations

from django.apps import AppConfig


class GeocodingConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "web_api.apps.geocoding"
    label = "geocoding"
