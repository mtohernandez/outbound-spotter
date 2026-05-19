"""Development settings.

The DRF permission override below is a scaffolding seam — it MUST be removed
once the Clerk JWT middleware + authentication class land in the auth spec.
Until then it lets local dev exercise endpoints without a real session, but
hides 401s that would fire in prod. See architecture.md invariant #5.
"""

from web_api.settings.base import *  # noqa: F403

DEBUG = True
ALLOWED_HOSTS = ["*"]

# WhiteNoise is a prod static-file concern; dev uses Django's built-in handler.
MIDDLEWARE = [m for m in MIDDLEWARE if "whitenoise" not in m]  # noqa: F405

REST_FRAMEWORK = {
    **REST_FRAMEWORK,  # noqa: F405
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.AllowAny"],
}
