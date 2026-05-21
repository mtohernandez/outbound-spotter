"""Custom manager for ``TripExport``.

``for_user`` is the standard ownership-filtered queryset every endpoint
applies on read; ``for_trip`` exists so the FE-side cleanup path (delete-all-
exports-for-a-deleted-trip) can be added later without leaking the field name.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from django.db.models import Manager

if TYPE_CHECKING:
    from uuid import UUID

    from django.db.models import QuerySet

    from web_api.apps.exports.models import TripExport


class TripExportManager(Manager["TripExport"]):
    def for_user(self, user_id: str) -> QuerySet[TripExport]:
        return self.filter(user_id=user_id)

    def for_trip(self, trip_id: UUID) -> QuerySet[TripExport]:
        return self.filter(trip_id=trip_id)
