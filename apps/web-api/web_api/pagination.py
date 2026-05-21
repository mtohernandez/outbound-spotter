"""Project-wide DRF pagination defaults.

``CappedLimitOffsetPagination`` enforces ``max_limit = 200`` so an
authenticated caller can't request ``?limit=1000000`` and force the worker to
materialize + serialize an unbounded result set. The cap is 4x the default
page size (50) — generous for review tooling, lethal-bounded for resource
exhaustion. See security-auditor M-1 and performance-engineer M1 from the
spec 09 review.
"""

from __future__ import annotations

from rest_framework.pagination import LimitOffsetPagination


class CappedLimitOffsetPagination(LimitOffsetPagination):
    max_limit = 200
