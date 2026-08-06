"""REZ-100 — numeric projection rules live in one pure module.

Existing behaviour tests stay in test_profile_projection.py and
test_bgmea_conflation_repair.py (unmodified). This file only guards the
extraction constraint: the shared module must never grow a database or
network client import, or the repair script's reason for existing returns.
"""
from __future__ import annotations

import ast
import importlib
from pathlib import Path

FORBIDDEN_ROOTS = frozenset(
    {
        "psycopg",
        "psycopg_pool",
        "httpx",
        "requests",
        "urllib3",
        "aiohttp",
        "socket",
        "supabase",
    }
)


def test_projection_module_imports_no_db_or_network_clients() -> None:
    """AST check — prose mentioning psycopg in a docstring must not count."""
    mod = importlib.import_module("etl.core.projection")
    assert mod.__file__ is not None
    tree = ast.parse(Path(mod.__file__).read_text(encoding="utf-8"))
    found: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                root = alias.name.split(".")[0]
                if root in FORBIDDEN_ROOTS:
                    found.add(root)
        elif isinstance(node, ast.ImportFrom):
            root = (node.module or "").split(".")[0]
            if root in FORBIDDEN_ROOTS:
                found.add(root)
    assert found == set(), f"etl.core.projection must stay pure; found {sorted(found)}"


def test_both_write_paths_import_pick_numeric_winner_from_projection() -> None:
    """Definition of done: one place decides which value wins."""
    import ops.backfill_profile_columns as backfill
    import ops.repair_bgmea_conflations as repair
    from etl.core import projection

    assert backfill.pick_numeric_winner is projection.pick_numeric_winner
    assert repair.pick_numeric_winner is projection.pick_numeric_winner
