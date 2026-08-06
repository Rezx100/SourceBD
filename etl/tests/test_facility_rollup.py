"""REZ-92 — facility group roll-up (derived totals across buildings).

Pure projection: no database, no mutation of stored supplier columns.
Covers the six acceptance cases on the Linear issue.
"""
from __future__ import annotations

import ast
import copy
import importlib
from pathlib import Path

from etl.core.facility_rollup import (
    FacilityBuilding,
    own_values_unchanged,
    project_facility_group,
)

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


def _parent(
    supplier_id: str = "parent",
    *,
    employees_total: int | None = 2000,
    machines_sewing: int | None = 100,
    production_capacity_pcs_day: int | None = 10_000,
    production_capacity_dozen_yearly: int | None = 50_000,
) -> FacilityBuilding:
    return FacilityBuilding(
        supplier_id=supplier_id,
        facility_of=None,
        employees_total=employees_total,
        machines_sewing=machines_sewing,
        production_capacity_pcs_day=production_capacity_pcs_day,
        production_capacity_dozen_yearly=production_capacity_dozen_yearly,
    )


def _child(
    supplier_id: str,
    parent_id: str = "parent",
    *,
    employees_total: int | None = 1000,
    machines_sewing: int | None = 50,
    production_capacity_pcs_day: int | None = 5_000,
    production_capacity_dozen_yearly: int | None = 20_000,
    tombstoned: bool = False,
) -> FacilityBuilding:
    return FacilityBuilding(
        supplier_id=supplier_id,
        facility_of=parent_id,
        tombstoned=tombstoned,
        employees_total=employees_total,
        machines_sewing=machines_sewing,
        production_capacity_pcs_day=production_capacity_pcs_day,
        production_capacity_dozen_yearly=production_capacity_dozen_yearly,
    )


def test_facility_rollup_module_imports_no_db_or_network_clients() -> None:
    mod = importlib.import_module("etl.core.facility_rollup")
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
    assert found == set(), f"facility_rollup must stay pure; found {sorted(found)}"


def test_parent_with_no_facilities_group_equals_own() -> None:
    """Issue test #1 — facility count 0; group total equals the parent's own."""
    parent = _parent(employees_total=2000)
    proj = project_facility_group(parent, [])
    assert proj is not None
    assert proj.facility_count == 0
    assert proj.employees_total.own == 2000
    assert proj.employees_total.known_sum == 2000
    assert proj.employees_total.unknown_count == 0
    assert proj.employees_total.describe() == "2000"
    assert not proj.employees_total.is_lower_bound


def test_parent_with_two_known_facilities_sums_three_rows() -> None:
    """Issue test #2 — arithmetic sum of parent + two facilities."""
    parent = _parent(employees_total=2000, machines_sewing=100)
    children = [
        _child("fac-a", employees_total=1500, machines_sewing=40),
        _child("fac-b", employees_total=1700, machines_sewing=60),
    ]
    proj = project_facility_group(parent, children)
    assert proj is not None
    assert proj.facility_count == 2
    assert proj.employees_total.known_sum == 2000 + 1500 + 1700
    assert proj.machines_sewing.known_sum == 100 + 40 + 60
    assert proj.employees_total.own == 2000  # headline stays parent's own
    assert not proj.employees_total.is_lower_bound
    assert proj.employees_total.describe() == "5200 across 3 buildings"


def test_null_workforce_is_unknown_not_zero() -> None:
    """Issue test #3 — NULL child does not contribute 0; reported as unknown."""
    parent = _parent(employees_total=2000)
    children = [
        _child("fac-known", employees_total=1500),
        _child("fac-unknown", employees_total=None),
    ]
    proj = project_facility_group(parent, children)
    assert proj is not None
    assert proj.employees_total.known_sum == 3500
    assert proj.employees_total.unknown_count == 1
    assert proj.employees_total.known_count == 2
    assert proj.employees_total.is_lower_bound
    assert proj.employees_total.describe() == (
        "at least 3500 across 3 buildings, 1 unknown"
    )
    assert proj.employees_total.known_sum == 3500


def test_tombstoned_child_is_excluded() -> None:
    """Issue test #4 — deleted/soft-removed facility does not enter the sum."""
    parent = _parent(employees_total=2000)
    children = [
        _child("fac-live", employees_total=1000),
        _child("fac-dead", employees_total=9999, tombstoned=True),
    ]
    proj = project_facility_group(parent, children)
    assert proj is not None
    assert proj.facility_count == 1
    assert proj.employees_total.known_sum == 3000
    assert proj.employees_total.building_count == 2


def test_parent_own_columns_byte_identical_after_projection() -> None:
    """Issue test #5 — stored columns are not mutated by the projection."""
    parent = _parent(
        employees_total=2000,
        machines_sewing=100,
        production_capacity_pcs_day=10_000,
        production_capacity_dozen_yearly=50_000,
    )
    before = {
        "employees_total": parent.employees_total,
        "machines_sewing": parent.machines_sewing,
        "production_capacity_pcs_day": parent.production_capacity_pcs_day,
        "production_capacity_dozen_yearly": parent.production_capacity_dozen_yearly,
    }
    parent_copy = copy.deepcopy(parent)
    children = [_child("fac-a", employees_total=500)]
    proj = project_facility_group(parent, children)
    assert proj is not None
    assert parent == parent_copy
    assert own_values_unchanged(before, proj)
    assert proj.own_snapshot() == before


def test_facility_row_gets_no_group_total() -> None:
    """Issue test #6 — a supplier that is itself a facility has no group view."""
    facility = FacilityBuilding(
        supplier_id="fac-a",
        facility_of="parent",
        employees_total=1000,
    )
    assert project_facility_group(facility, []) is None
    # Even if someone wrongly passes siblings as children:
    assert project_facility_group(facility, [_child("fac-b")]) is None


def test_duplicate_child_id_counted_once() -> None:
    """A child that is a duplicate of another child must not be counted twice."""
    parent = _parent(employees_total=1000)
    children = [
        _child("fac-a", employees_total=500),
        _child("fac-a", employees_total=500),  # same id, accidental double
    ]
    proj = project_facility_group(parent, children)
    assert proj is not None
    assert proj.facility_count == 1
    assert proj.employees_total.known_sum == 1500


def test_child_attached_to_other_parent_ignored() -> None:
    parent = _parent(employees_total=1000)
    children = [
        _child("fac-ours", parent_id="parent", employees_total=200),
        _child("fac-theirs", parent_id="other-mother", employees_total=9000),
    ]
    proj = project_facility_group(parent, children)
    assert proj is not None
    assert proj.facility_count == 1
    assert proj.employees_total.known_sum == 1200


def test_all_unknown_across_buildings() -> None:
    parent = _parent(employees_total=None)
    children = [
        _child("fac-a", employees_total=None),
        _child("fac-b", employees_total=None),
    ]
    proj = project_facility_group(parent, children)
    assert proj is not None
    assert proj.employees_total.known_sum is None
    assert proj.employees_total.unknown_count == 3
    assert not proj.employees_total.is_lower_bound
    assert proj.employees_total.describe() == (
        "unknown across 3 buildings, 3 unknown"
    )


def test_cross_source_projection_module_still_never_sums() -> None:
    """Guardrail: REZ-92 must not weaken the cross-source never-sum rule."""
    from etl.core import projection

    # facility_rollup is a sibling module; projection still has no sum-across-
    # records helper. Presence of pick_numeric_winner is the never-sum SoT.
    assert hasattr(projection, "pick_numeric_winner")
    assert not hasattr(projection, "project_facility_group")
