"""Base Django settings.

JWT-only API: no `contrib.admin`, no `contrib.sessions`, no session-based
middleware. `clerk-backend-api` wires JWT verification + a DRF authentication
class in the auth feature spec; until that lands, no authenticated endpoints
will work in prod (only `/healthz` and `/api/docs/`).
"""

from __future__ import annotations

from pathlib import Path
from urllib.parse import urlparse

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class WebApiSettings(BaseSettings):
    """Strongly-typed environment configuration.

    Each value either comes from the environment or has a safe default for the
    dev environment. Production overrides happen via real env vars on Fly.io.
    """

    model_config = SettingsConfigDict(
        env_file=(".env", ".env.local"),
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    DEBUG: bool = False
    SECRET_KEY: str = Field(default="dev-insecure-key-replace-in-prod", min_length=8)
    ALLOWED_HOSTS: list[str] = Field(default_factory=lambda: ["localhost", "127.0.0.1"])

    DATABASE_URL: str = Field(default="postgresql://outbound:outbound@localhost:5432/outbound_dev")

    CORS_ALLOWED_ORIGINS: list[str] = Field(
        default_factory=lambda: ["http://localhost:5173", "http://localhost:5174"]
    )

    CLERK_PUBLISHABLE_KEY: str = Field(default="")
    CLERK_SECRET_KEY: str = Field(default="")
    CLERK_JWT_ISSUER: str = Field(default="")

    OPENROUTESERVICE_API_KEY: SecretStr = Field(default=SecretStr(""))
    OPENROUTESERVICE_BASE_URL: str = Field(default="https://api.openrouteservice.org")

    @field_validator("OPENROUTESERVICE_BASE_URL")
    @classmethod
    def _validate_ors_base_url(cls, value: str) -> str:
        # SSRF defense: a misconfigured env mustn't ship the API key to an
        # arbitrary host. Enforce HTTPS to the documented HeiGIT endpoint.
        allowed = {"https://api.openrouteservice.org"}
        if value not in allowed:
            raise ValueError(
                f"OPENROUTESERVICE_BASE_URL must be one of {sorted(allowed)}; got {value!r}.",
            )
        return value


settings_obj = WebApiSettings()
_db_url = urlparse(settings_obj.DATABASE_URL)

BASE_DIR = Path(__file__).resolve().parent.parent.parent

SECRET_KEY = settings_obj.SECRET_KEY
DEBUG = settings_obj.DEBUG
ALLOWED_HOSTS = settings_obj.ALLOWED_HOSTS

INSTALLED_APPS = [
    "django.contrib.contenttypes",
    "django.contrib.auth",
    "django.contrib.staticfiles",
    "corsheaders",
    "rest_framework",
    "drf_spectacular",
    "web_api.apps.geocoding",
    "web_api.apps.trips",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    # GZip the JSON envelopes (~5-7x ratio on the plan endpoint's repetitive
    # key set). WhiteNoise gzips static assets only. Performance-engineer M1.
    "django.middleware.gzip.GZipMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.middleware.common.CommonMiddleware",
]

ROOT_URLCONF = "web_api.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
            ],
        },
    },
]

WSGI_APPLICATION = "web_api.wsgi.application"
ASGI_APPLICATION = "web_api.asgi.application"

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": _db_url.path.lstrip("/") or "outbound_dev",
        "USER": _db_url.username or "",
        "PASSWORD": _db_url.password or "",
        "HOST": _db_url.hostname or "localhost",
        "PORT": str(_db_url.port) if _db_url.port else "5432",
        "OPTIONS": {"pool": True},
        "CONN_MAX_AGE": 60,
    }
}

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STORAGES = {
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
}

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

CORS_ALLOWED_ORIGINS = settings_obj.CORS_ALLOWED_ORIGINS
CORS_ALLOW_CREDENTIALS = True

REST_FRAMEWORK = {
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    "DEFAULT_PARSER_CLASSES": ["rest_framework.parsers.JSONParser"],
    "DEFAULT_PAGINATION_CLASS": "web_api.pagination.CappedLimitOffsetPagination",
    "PAGE_SIZE": 50,
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_AUTHENTICATION_CLASSES": ["web_api.auth.ClerkAuthentication"],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    "DEFAULT_THROTTLE_CLASSES": ["web_api.throttling.PerUserScopedThrottle"],
    "DEFAULT_THROTTLE_RATES": {
        "geocode_autocomplete": "60/min",
        "geocode_search": "20/min",
        "trip_create": "30/hour",
        "trip_list": "60/min",
        "trip_delete": "20/min",
        "trip_plan_retrieve": "120/min",
    },
    "EXCEPTION_HANDLER": "web_api.exception_handler.exception_handler",
}

SPECTACULAR_SETTINGS = {
    "TITLE": "Outbound Spotter API",
    "DESCRIPTION": "HOS-compliant trip planning and ELD log generation.",
    "VERSION": "0.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "COMPONENT_SPLIT_REQUEST": True,
}

CLERK_PUBLISHABLE_KEY = settings_obj.CLERK_PUBLISHABLE_KEY
CLERK_SECRET_KEY = settings_obj.CLERK_SECRET_KEY
CLERK_JWT_ISSUER = settings_obj.CLERK_JWT_ISSUER

OPENROUTESERVICE_API_KEY = settings_obj.OPENROUTESERVICE_API_KEY
OPENROUTESERVICE_BASE_URL = settings_obj.OPENROUTESERVICE_BASE_URL
