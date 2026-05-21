"""Request + response serializers for ``/api/exports/``.

The dual mode contract (snake_case at DB / kebab-case on the wire) is
handled here. ``TripExportCreateRequestSerializer`` accepts kebab-case,
translates to snake_case in ``validated_data["mode"]``. The read
serializers do the reverse: a method field maps the DB value to its
kebab-case wire form before serialization.

``trip_id`` is exposed under the FK column name (DRF auto-renders it as
``null`` when the FK is set to NULL after trip deletion). The FE schema
declares it ``z.string().uuid().nullable()`` so the Recreate action can
branch on null.
"""

from __future__ import annotations

from typing import ClassVar

from rest_framework import serializers

from web_api.apps.exports.models import ExportMode, TripExport

# Wire ↔ DB translation tables. Keep these in sync with the FE
# ``EXPORT_MODES`` constant + the model's ``ExportMode.choices``.
_WIRE_TO_DB: dict[str, str] = {
    "multi-page": ExportMode.MULTI_PAGE.value,
    "single-page": ExportMode.SINGLE_PAGE.value,
}
_DB_TO_WIRE: dict[str, str] = {db: wire for wire, db in _WIRE_TO_DB.items()}


class TripExportCreateRequestSerializer(serializers.Serializer[None]):
    """Validates a POST payload from the FE export-pdf hook.

    ``mode`` is kebab-case on the wire; ``validated_data["mode"]`` is the
    translated snake_case value the view writes to the model.
    """

    trip_id = serializers.UUIDField()
    mode = serializers.ChoiceField(choices=tuple(_WIRE_TO_DB.keys()))

    def validate_mode(self, value: str) -> str:
        # ChoiceField already gated on _WIRE_TO_DB.keys(), so the lookup
        # cannot KeyError here. Returning the snake_case DB form means
        # ``validated_data["mode"]`` is ready to hand to ``Model.objects.create``.
        return _WIRE_TO_DB[value]


class TripExportListItemSerializer(serializers.ModelSerializer[TripExport]):
    """Read shape for ``GET /api/exports/`` and the POST 201 response.

    ``trip_id`` is the FK column, which DRF surfaces as a UUID string
    (or ``None`` when the trip has been deleted and SET_NULL fired).
    ``mode`` is translated back to kebab-case for the FE.
    """

    mode = serializers.SerializerMethodField()

    class Meta:
        model = TripExport
        fields: ClassVar[list[str]] = [
            "id",
            "trip_id",
            "mode",
            "sheet_count",
            "trip_current_label",
            "trip_pickup_label",
            "trip_dropoff_label",
            "created_at",
        ]
        read_only_fields = fields

    def get_mode(self, obj: TripExport) -> str:
        return _DB_TO_WIRE[obj.mode]


TripExportResponseSerializer = TripExportListItemSerializer
