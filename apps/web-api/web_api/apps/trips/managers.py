"""Custom managers for ``Trip``.

``TripManager.with_days_count`` annotates the queryset with ``days_count`` so
``TripListView`` answers the list endpoint in one SQL query plus pagination's
COUNT — no N+1 across ``LogDay`` rows. The unique constraint on
``LogDay.(trip, date)`` (``models.py``) guarantees one row per ``(trip, date)``
so a plain ``Count("log_days")`` does not inflate; ``distinct=True`` would only
matter if a sibling LEFT JOIN landed in the same ``.annotate(...)`` block.
If a second aggregate is added here, re-evaluate.

Future: ``with_log_event_count()``, ``for_user(uid)``, ``with_full_plan()``
will likely lift to this manager once spec 11+ needs them.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from django.db.models import Count, Manager

if TYPE_CHECKING:
    from django.db.models import QuerySet

    from web_api.apps.trips.models import Trip


class TripManager(Manager["Trip"]):
    def with_days_count(self) -> QuerySet[Trip]:
        return self.annotate(days_count=Count("log_days"))
