"""Custom managers for ``Trip``.

``TripManager.with_days_count`` annotates the queryset with ``days_count`` so
``TripListView`` answers the list endpoint in one SQL query plus pagination's
COUNT — no N+1 across ``LogDay`` rows. ``distinct=True`` is defensive: this
queryset can grow additional ``prefetch_related`` targets later, and any
extra LEFT JOIN would otherwise multiply the count of related rows.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from django.db.models import Count, Manager

if TYPE_CHECKING:
    from django.db.models import QuerySet

    from web_api.apps.trips.models import Trip


class TripManager(Manager["Trip"]):
    def with_days_count(self) -> QuerySet[Trip]:
        return self.annotate(days_count=Count("log_days", distinct=True))
