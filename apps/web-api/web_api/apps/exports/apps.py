from __future__ import annotations

from django.apps import AppConfig


class ExportsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "web_api.apps.exports"
    label = "exports"
