"""Trip export audit-row model (spec 10).

A ``TripExport`` row is written every time the driver clicks Export PDF.
The row stores only metadata — mode, sheet count, denormalized trip route
labels, timestamp — never the PDF bytes (architecture invariant #6, as
strengthened by spec 10).

**Dual mode contract**: ``ExportMode`` values are stored as snake_case
(``"multi_page"``, ``"single_page"``) at the DB layer, matching the
``StopKind`` / ``DutyStatusChoices`` precedent in ``apps/trips/models.py``.
The wire contract — what ``TripExportCreateRequestSerializer`` accepts and
what ``TripExportListItemSerializer`` returns — is kebab-case
(``"multi-page"`` / ``"single-page"``), matching the FE ``ExportMode`` type
in ``apps/web-app/src/features/pdf-export/types/export-mode.ts``. The
serializer translates in both directions; the model + DB only ever see
snake_case. Any breakage of this contract should fail loudly in the view
tests (``test_exports_views.py::test_create_persists_snake_case_mode``).

**Denormalized trip labels**: the FK to ``Trip`` is ``on_delete=SET_NULL``,
not ``CASCADE``. When the user deletes a trip, their export history must
survive so they can still browse past exports. The ``trip_current_label`` /
``trip_pickup_label`` / ``trip_dropoff_label`` columns are populated from
``Trip`` at create time and remain readable after the FK clears. The FE
``Recreate`` action handles ``trip_id IS NULL`` by surfacing a graceful-
degradation toast ("Original trip is no longer available — delete this
row?") rather than attempting to re-render against a missing plan.
"""

from __future__ import annotations

import uuid

from django.db import models

from web_api.apps.exports.managers import TripExportManager


class ExportMode(models.TextChoices):
    MULTI_PAGE = "multi_page", "Multi-page"
    SINGLE_PAGE = "single_page", "Single-page"

    @classmethod
    def to_wire(cls, db_value: str) -> str:
        """Translate the snake_case DB value to its kebab-case wire form.

        The wire contract uses kebab-case (``"multi-page"`` / ``"single-page"``)
        to mirror the FE ``ExportMode`` discriminated union. Derived from
        ``choices`` so a new member is automatically supported without
        editing the serializer.
        """
        return db_value.replace("_", "-")

    @classmethod
    def from_wire(cls, wire_value: str) -> str:
        """Translate the kebab-case wire value to its snake_case DB form."""
        return wire_value.replace("-", "_")


class TripExport(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user_id = models.CharField(max_length=64)

    # String FK reference decouples the model file from the trips app at
    # import time; Django resolves the relation at migration time.
    trip = models.ForeignKey(
        "trips.Trip",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="exports",
    )

    trip_current_label = models.CharField(max_length=255)
    trip_pickup_label = models.CharField(max_length=255)
    trip_dropoff_label = models.CharField(max_length=255)

    mode = models.CharField(max_length=16, choices=ExportMode.choices)
    sheet_count = models.PositiveSmallIntegerField()

    created_at = models.DateTimeField(auto_now_add=True)

    objects: TripExportManager = TripExportManager()

    class Meta:
        indexes = (
            models.Index(fields=["user_id", "-created_at"]),
            models.Index(fields=["trip"]),
        )
        ordering = ("-created_at",)
