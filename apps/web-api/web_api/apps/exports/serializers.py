"""Request + response serializers for ``/api/exports/``.

The dual mode contract (snake_case at DB / kebab-case on the wire) is
handled by ``ExportMode.to_wire`` / ``from_wire`` on the model enum so
the translation has a single source of truth; adding a new mode requires
only an ``ExportMode`` member, never a serializer edit.

``trip_id`` is exposed under the FK column name. DRF auto-renders it as
``null`` when the FK has been set to NULL after trip deletion; the FE
schema declares it ``z.string().uuid().nullable()`` so the Recreate
action can branch.
"""

from __future__ import annotations

from typing import ClassVar

from rest_framework import serializers

from web_api.apps.exports.models import ExportMode, TripExport

# Wire-form choices: the snake_case DB enum mapped to its kebab-case form.
_WIRE_CHOICES: tuple[str, ...] = tuple(ExportMode.to_wire(value) for value in ExportMode.values)


class TripExportCreateRequestSerializer(serializers.Serializer[None]):
    """Validates a POST payload from the FE export-pdf hook.

    ``mode`` is kebab-case on the wire; ``validated_data["mode"]`` is the
    translated snake_case value the view writes to the model.
    """

    trip_id = serializers.UUIDField()
    mode = serializers.ChoiceField(choices=_WIRE_CHOICES)

    def validate_mode(self, value: str) -> str:
        # ChoiceField already gated on _WIRE_CHOICES; returning the snake_case
        # form means ``validated_data["mode"]`` is ready to hand to ORM create.
        return ExportMode.from_wire(value)


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
        return ExportMode.to_wire(obj.mode)
