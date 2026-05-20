"""Pure-Python HOS planner. **No Django / DRF / HTTP imports here.**

See ``web_api/hos/README.md`` for the 49 CFR §395 surface and
``docs/interstate-truck-driver-guide.md`` for regulation citations.
``apps/web-api/tests/hos/test_boundary.py`` enforces the import boundary.

Public API (the only symbols spec 06's adapter or external callers need):
"""

from web_api.hos.planner import plan_logs
from web_api.hos.state import PlannerState
from web_api.hos.types import DutyStatus, FuelStop, LogEvent, PlannerInputs

__all__ = [
    "DutyStatus",
    "FuelStop",
    "LogEvent",
    "PlannerInputs",
    "PlannerState",
    "plan_logs",
]
