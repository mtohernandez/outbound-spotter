"""DRF exception handler that emits a consistent error envelope.

Shape: { "detail": str, "errors": { field: [str, ...] } | null }.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from rest_framework.views import exception_handler as drf_default_exception_handler

if TYPE_CHECKING:
    from rest_framework.response import Response


def exception_handler(exc: Exception, context: dict[str, Any]) -> Response | None:
    response = drf_default_exception_handler(exc, context)
    if response is None:
        return None

    data = response.data
    if isinstance(data, dict) and "detail" in data:
        response.data = {"detail": str(data["detail"]), "errors": None}
    elif isinstance(data, dict):
        response.data = {"detail": "Validation failed.", "errors": data}
    elif isinstance(data, list):
        response.data = {"detail": "Validation failed.", "errors": {"non_field_errors": data}}
    return response
