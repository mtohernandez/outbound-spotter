"""Test settings.

SQLite in-memory keeps pytest hermetic — no Postgres needed in CI or locally.
The Trip model + indexes round-trip correctly because Django's adapters handle
``UUIDField``/``DecimalField`` against SQLite. Tests that exercise the real
``IsAuthenticated`` path get the full base permission stack (no dev.py
``AllowAny`` override).
"""

from web_api.settings.base import *  # noqa: F403

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": ":memory:",
    },
}

# WhiteNoise is a prod static-file concern; the test runner doesn't need it.
MIDDLEWARE = [m for m in MIDDLEWARE if "whitenoise" not in m]  # noqa: F405

# Tests stub `authenticate_request` at the module boundary; a stand-in secret
# keeps the `ClerkAuthentication.authenticate` config check from short-circuiting.
CLERK_SECRET_KEY = "sk_test_unit"  # noqa: S105 — fixture value, never reaches a real Clerk instance.
