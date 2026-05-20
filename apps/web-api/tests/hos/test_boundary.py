"""Boundary enforcement for ``web_api/hos/``.

Architecture invariant #1 (``context/architecture.md``): the HOS planner is
pure Python. No Django / DRF / HTTP imports under ``web_api/hos/**``. This
test is more robust than a CI-config grep — it runs locally too, walks the
AST, and rejects forbidden imports even when the offending file would compile.

Forbidden patterns (``datetime.now``, ``time.time``, ``random``, …) are
matched as substrings — false positives are easier to debug than false
negatives. Comments referencing the patterns count as violations on purpose;
keep the planner free of those references.
"""

from __future__ import annotations

import ast
import pathlib

import pytest

HOS_ROOT = pathlib.Path(__file__).resolve().parent.parent.parent / "web_api" / "hos"

# senior-review-hook: any addition to this set requires architect-review re-approval
# and a synchronized update to context/architecture.md#Invariants — do NOT edit unilaterally.
ALLOWED_TOP_LEVEL: frozenset[str] = frozenset(
    {
        "datetime",
        "dataclasses",
        "enum",
        "decimal",
        "zoneinfo",
        "math",
        "typing",
        "collections.abc",
        "web_api.hos",
        "web_api.integrations.openrouteservice",
        "__future__",
    }
)

FORBIDDEN_PATTERNS: tuple[str, ...] = (
    "datetime.now",
    "datetime.utcnow",
    "time.time",
    "time.monotonic",
    "import random",
    "from random",
    "import requests",
    "from requests",
    "import urllib",
    "from urllib",
    "import django",
    "from django",
    "import rest_framework",
    "from rest_framework",
)

# Symbols that MUST be imported only inside an ``if TYPE_CHECKING:`` block,
# because the originating module pulls Django + requests at import time.
TYPE_CHECKING_ONLY_MODULES: frozenset[str] = frozenset({"web_api.integrations.openrouteservice"})


# ``_smoke.py`` is a dev-only sanity script invoked directly by a developer via
# ``python -m web_api.hos._smoke``. It needs to construct a runtime
# ``DirectionsResult`` to call ``plan_logs``; that's incompatible with the
# TYPE_CHECKING-only rule but does NOT poison the planner's library-import path
# because nothing in ``web_api.hos`` imports ``_smoke`` (it's not in
# ``__init__.py``). Excluding it here keeps the rest of the boundary intact
# while admitting the one well-scoped escape hatch.
BOUNDARY_EXEMPT: frozenset[str] = frozenset({"_smoke.py"})


def _hos_files() -> list[pathlib.Path]:
    return sorted(p for p in HOS_ROOT.rglob("*.py") if p.name not in BOUNDARY_EXEMPT)


def _module_matches(name: str | None) -> bool:
    """``name`` matches the allowlist if it is an exact entry or a sub-package thereof."""
    if not name:
        return False
    return any(name == allowed or name.startswith(f"{allowed}.") for allowed in ALLOWED_TOP_LEVEL)


def _module_is_type_checking_only(name: str | None) -> bool:
    if not name:
        return False
    return any(
        name == guarded or name.startswith(f"{guarded}.") for guarded in TYPE_CHECKING_ONLY_MODULES
    )


def _is_inside_type_checking_block(node: ast.AST, tree: ast.AST) -> bool:
    """Return True if ``node`` is contained in an ``if TYPE_CHECKING:`` block."""
    target_line = getattr(node, "lineno", None)
    if target_line is None:
        return False
    for candidate in ast.walk(tree):
        if not isinstance(candidate, ast.If):
            continue
        test = candidate.test
        is_tc = (isinstance(test, ast.Name) and test.id == "TYPE_CHECKING") or (
            isinstance(test, ast.Attribute) and test.attr == "TYPE_CHECKING"
        )
        if not is_tc:
            continue
        start = candidate.lineno
        end = getattr(candidate, "end_lineno", start)
        if start <= target_line <= end:
            return True
    return False


@pytest.mark.parametrize("path", _hos_files(), ids=lambda p: p.relative_to(HOS_ROOT).as_posix())
def test_no_forbidden_imports(path: pathlib.Path) -> None:
    tree = ast.parse(path.read_text(encoding="utf-8"))
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                assert _module_matches(alias.name), (
                    f"{path}: forbidden import {alias.name!r} at line {node.lineno}"
                )
        elif isinstance(node, ast.ImportFrom):
            # Relative imports inside web_api.hos are always OK; ``module`` is None for them.
            if node.level > 0 or node.module is None:
                continue
            assert _module_matches(node.module), (
                f"{path}: forbidden import from {node.module!r} at line {node.lineno}"
            )
            if _module_is_type_checking_only(node.module) and not _is_inside_type_checking_block(
                node, tree
            ):
                msg = (
                    f"{path}: {node.module!r} must be imported under `if TYPE_CHECKING:` only "
                    f"(line {node.lineno}). See architect-review m1."
                )
                pytest.fail(msg)


@pytest.mark.parametrize("path", _hos_files(), ids=lambda p: p.relative_to(HOS_ROOT).as_posix())
def test_no_forbidden_patterns(path: pathlib.Path) -> None:
    text = path.read_text(encoding="utf-8")
    for pattern in FORBIDDEN_PATTERNS:
        assert pattern not in text, f"{path}: forbidden pattern {pattern!r}"


def test_allowed_top_level_is_finite_set() -> None:
    """Sanity: the allowlist is a contract, not a moving target."""
    assert isinstance(ALLOWED_TOP_LEVEL, frozenset)
    assert len(ALLOWED_TOP_LEVEL) == 11
