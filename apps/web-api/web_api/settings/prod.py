"""Production settings — Vercel Python runtime + Neon Postgres.

Neon recommendations (sslmode=require, DISABLE_SERVER_SIDE_CURSORS,
CONN_HEALTH_CHECKS, CONN_MAX_AGE ≤ Neon's 5-min scale-to-zero) are sourced from
<https://neon.com/docs/guides/django>. Vercel's CDN serves collected static
files automatically — WhiteNoise stays in MIDDLEWARE so `vercel dev` works
locally, but in production it's a no-op behind the CDN.
"""

from web_api.settings.base import *  # noqa: F403
from web_api.settings.base import settings_obj

DEBUG = False

SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_HSTS_SECONDS = 31_536_000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "same-origin"
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True

CSRF_TRUSTED_ORIGINS = settings_obj.CSRF_TRUSTED_ORIGINS

# Neon serverless tuning. psycopg's app-level pool conflicts with Neon's
# pgbouncer-style pooler, so we drop OPTIONS["pool"] and rely on the `-pooler`
# hostname in DATABASE_URL. CONN_MAX_AGE stays under Neon's 5-min idle suspend
# so reused connections never wake up dead.
DATABASES["default"]["OPTIONS"] = {"sslmode": "require"}  # noqa: F405
DATABASES["default"]["CONN_MAX_AGE"] = 240  # noqa: F405
DATABASES["default"]["CONN_HEALTH_CHECKS"] = True  # noqa: F405
DATABASES["default"]["DISABLE_SERVER_SIDE_CURSORS"] = True  # noqa: F405

# Vercel captures stdout per-invocation into the function log stream. No file
# handlers — serverless containers have ephemeral filesystems. We keep the
# format plain so non-ASCII / quoted messages can never produce invalid JSON;
# Vercel's log search treats each line as text and code-reviewer M3 (spec 12)
# flagged that `%(message)r` (Python repr) emits single-quoted output that
# breaks JSON parsers. Switch to structured logging via `python-json-logger`
# if Vercel's log query layer ever needs field-level filtering.
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "stdout": {
            "format": "%(levelname)s %(name)s %(message)s",
        },
    },
    "handlers": {
        "stdout": {
            "class": "logging.StreamHandler",
            "formatter": "stdout",
        },
    },
    "root": {"handlers": ["stdout"], "level": "INFO"},
    "loggers": {
        "django.request": {"handlers": ["stdout"], "level": "WARNING", "propagate": False},
        "web_api": {"handlers": ["stdout"], "level": "INFO", "propagate": False},
    },
}
