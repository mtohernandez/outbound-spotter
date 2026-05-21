"""Custom manager for ``TripExport``.

``for_user`` is the standard ownership-filtered queryset every endpoint
applies on read.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from django.db.models import Manager

if TYPE_CHECKING:
    from django.db.models import QuerySet

    from web_api.apps.exports.models import TripExport


class TripExportManager(Manager["TripExport"]):
    def for_user(self, user_id: str) -> QuerySet[TripExport]:
        return self.filter(user_id=user_id)
