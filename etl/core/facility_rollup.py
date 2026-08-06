"""Facility group roll-up — derived totals across a mother and her buildings.

REZ-92 / Extensions B0. Read-path only.

WHY A SEPARATE MODULE
---------------------
``etl.core.projection`` encodes the cross-source rule: numerics take the
highest-trust then most-recent value, **never summed**. That rule is correct
when BGMEA and BKMEA describe the *same* factory.

A mother company plus a genuinely distinct extension building is the opposite
case: different buildings, different people, and the arithmetic sum is real.
Folding facility numbers into ``suppliers.employees_total`` would destroy the
distinction between "verified at this address" and "inferred across buildings",
and the next profile backfill would fight the written value.

This module therefore:
- leaves the parent's stored columns untouched (returns them as ``own``);
- derives a separate group total labelled across N buildings;
- must never be imported by a write path that UPDATEs ``suppliers.*``.

TOMBSTONES
----------
Merge losers are deleted (spec08 / ``ops/merge_duplicate_suppliers.py``). A
tombstoned child has no row, so a database-backed caller never sees it. The
pure function still accepts ``tombstoned=True`` so tests (and any future soft
marker) can prove exclusion.

WHAT ``supplier_id`` DEDUPE DOES — AND DOES NOT
-----------------------------------------------
Children are keyed by ``supplier_id``; the same id appearing twice in one
call collapses to the first sighting. That is an input-list hygiene guard
only. It does **not** detect two distinct supplier rows that describe the
same physical building. That population is real and large (REZ-105 measured
117 such clusters; knit-plus alone has three sibling rows). If those
siblings are both attached as facilities of the same mother, this roll-up
will sum them both. Preventing that is an upstream identity/merge problem,
not something this module can invent from arithmetic.

NESTED FACILITIES
-----------------
Only direct ``facility_of == parent.id`` children are accepted — facilities
of facilities are not walked. That is safe **only** because REZ-71
(``ops/backfill_facility_of.py``) must refuse to set ``facility_of`` when
the candidate parent is itself a facility. That refusal is a hard constraint
on REZ-71, not an assumption this docstring invents after the fact. If a
future writer ever creates a facility→facility chain, this roll-up will
silently drop the grandchild and understate the group total.

NULL HANDLING
-------------
``None`` is unknown, never coerced to 0. When any building in the group has
an unknown value for a column, the group total is a **lower bound**:
``known_sum`` is the arithmetic sum of the known figures, ``unknown_count``
is how many buildings contributed nothing, and ``describe()`` renders
``"at least {known_sum} across {buildings} buildings, {unknown} unknown"``.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Mapping

# Columns REZ-92 rolls up. Gender cohorts stay on the parent only — a group
# male/female split across buildings is not defined here.
ROLLUP_COLUMNS: tuple[str, ...] = (
    "employees_total",
    "machines_sewing",
    "production_capacity_pcs_day",
    "production_capacity_dozen_yearly",
)


@dataclass(frozen=True)
class FacilityBuilding:
    """One supplier row participating in (or excluded from) a group roll-up.

    ``facility_of`` is None for the mother company; set to the parent's id for
    an attached facility. ``tombstoned`` marks a deleted/soft-removed row that
    must not contribute.
    """

    supplier_id: str
    facility_of: str | None = None
    tombstoned: bool = False
    employees_total: int | None = None
    machines_sewing: int | None = None
    production_capacity_pcs_day: int | None = None
    production_capacity_dozen_yearly: int | None = None

    def value_for(self, column: str) -> int | None:
        if column not in ROLLUP_COLUMNS:
            raise ValueError(f"not a roll-up column: {column}")
        return getattr(self, column)


@dataclass(frozen=True)
class GroupMetric:
    """Parent's own figure plus a derived group total for one numeric column.

    ``own`` mirrors the parent's stored value byte-for-byte and is never a
    sum. ``known_sum`` is the arithmetic sum of non-None values across the
    parent and every live facility child. When ``unknown_count > 0`` and
    ``known_sum`` is not None, the total is a lower bound (``is_lower_bound``).
    """

    own: int | None
    known_sum: int | None
    facility_count: int
    building_count: int
    known_count: int
    unknown_count: int

    @property
    def is_lower_bound(self) -> bool:
        return self.unknown_count > 0 and self.known_sum is not None

    def describe(self) -> str:
        """Stable human-readable form for docs and a future UI label.

        Examples:
        - no facilities, known own → ``"2000"``
        - all known across buildings → ``"5200 across 4 buildings"``
        - partial → ``"at least 4000 across 4 buildings, 1 unknown"``
        """
        if self.facility_count == 0:
            return "unknown" if self.own is None else str(self.own)
        if self.known_sum is None:
            return (
                f"unknown across {self.building_count} buildings, "
                f"{self.unknown_count} unknown"
            )
        if self.is_lower_bound:
            return (
                f"at least {self.known_sum} across {self.building_count} buildings, "
                f"{self.unknown_count} unknown"
            )
        return f"{self.known_sum} across {self.building_count} buildings"


@dataclass(frozen=True)
class FacilityGroupProjection:
    """Derived group view for one mother company. Never written back."""

    supplier_id: str
    facility_count: int
    employees_total: GroupMetric
    machines_sewing: GroupMetric
    production_capacity_pcs_day: GroupMetric
    production_capacity_dozen_yearly: GroupMetric

    def own_snapshot(self) -> dict[str, int | None]:
        """Parent stored columns as returned — for byte-identity asserts."""
        return {
            "employees_total": self.employees_total.own,
            "machines_sewing": self.machines_sewing.own,
            "production_capacity_pcs_day": self.production_capacity_pcs_day.own,
            "production_capacity_dozen_yearly": self.production_capacity_dozen_yearly.own,
        }


def _dedupe_live_children(
    parent_id: str,
    children: list[FacilityBuilding],
) -> list[FacilityBuilding]:
    """Live, directly-attached facilities; same supplier_id twice → first wins.

    Does not collapse distinct rows that happen to describe one building
    (REZ-105). Nested facility→facility children are skipped — REZ-71 must
    refuse to create those chains.
    """
    seen: set[str] = set()
    out: list[FacilityBuilding] = []
    for child in children:
        if child.tombstoned:
            continue
        if child.supplier_id == parent_id:
            continue
        # Only directly attached facilities. facility_of must equal the parent
        # — None or a different mother means "not attached here". Nested
        # chains are out of scope; REZ-71 must not create them.
        if child.facility_of != parent_id:
            continue
        if child.supplier_id in seen:
            continue
        seen.add(child.supplier_id)
        out.append(child)
    return out


def _metric_for_column(
    parent: FacilityBuilding,
    live_children: list[FacilityBuilding],
    column: str,
) -> GroupMetric:
    buildings: list[FacilityBuilding] = [parent, *live_children]
    values = [b.value_for(column) for b in buildings]
    known = [v for v in values if v is not None]
    unknown_count = sum(1 for v in values if v is None)
    known_sum = sum(known) if known else None
    facility_count = len(live_children)
    return GroupMetric(
        own=parent.value_for(column),
        known_sum=known_sum if facility_count > 0 else parent.value_for(column),
        facility_count=facility_count,
        building_count=1 + facility_count,
        known_count=len(known),
        unknown_count=unknown_count,
    )


def project_facility_group(
    parent: FacilityBuilding,
    children: list[FacilityBuilding] | None = None,
) -> FacilityGroupProjection | None:
    """Derive group totals for a mother company.

    Returns ``None`` when ``parent`` is itself a facility (``facility_of`` set)
    — a building does not get a group total of its own. Tombstoned parents are
    likewise excluded.

    Does not mutate ``parent`` or ``children``. Does not write to any store.
    """
    if parent.tombstoned:
        return None
    if parent.facility_of is not None:
        return None

    live = _dedupe_live_children(parent.supplier_id, list(children or []))
    metrics = {
        column: _metric_for_column(parent, live, column) for column in ROLLUP_COLUMNS
    }
    return FacilityGroupProjection(
        supplier_id=parent.supplier_id,
        facility_count=len(live),
        employees_total=metrics["employees_total"],
        machines_sewing=metrics["machines_sewing"],
        production_capacity_pcs_day=metrics["production_capacity_pcs_day"],
        production_capacity_dozen_yearly=metrics["production_capacity_dozen_yearly"],
    )


def own_values_unchanged(
    before: Mapping[str, int | None],
    projection: FacilityGroupProjection,
) -> bool:
    """True when every roll-up column's ``own`` matches the pre-projection map."""
    return dict(before) == projection.own_snapshot()
