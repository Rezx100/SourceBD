"""REZ-73 — durable guard for _facility_group_metric (null ≠ 0).

CI has no Postgres. Mirror the SQL CASE semantics in Python and pin the
migration body so the two cannot drift without a failing test.
"""
from __future__ import annotations

from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
MIGRATION = REPO / "supabase" / "migrations" / "0097_buyer_supplier_facility_panel.sql"


def facility_group_metric(own: int | None, vals: list[int | None]) -> dict:
    """Mirror of public._facility_group_metric in 0097."""
    facility_count = len(vals)
    building_count = 1 + facility_count
    stacked = [own, *vals]
    known = [x for x in stacked if x is not None]
    unknown_count = sum(1 for x in stacked if x is None)
    if facility_count == 0:
        known_sum = own
    elif not known:
        known_sum = None
    else:
        known_sum = sum(known)
    return {
        "own": own,
        "facility_count": facility_count,
        "building_count": building_count,
        "known_sum": known_sum,
        "unknown_count": unknown_count,
    }


def test_migration_exists_and_is_lean() -> None:
    text = MIGRATION.read_text(encoding="utf-8")
    assert MIGRATION.is_file()
    assert len(text.splitlines()) <= 80
    # No dynamic SQL; GRANT EXECUTE on the panel is allowed.
    assert "execute format" not in text.lower()
    assert " set search_path = public" in text
    assert "jsonb_build_object('name', b.company_name)" in text
    facilities_blob = text.split("'facilities'", 1)[1].split("'group'", 1)[0]
    assert "employees_total" not in facilities_blob
    assert "machines_sewing" not in facilities_blob
    assert "v_supplier_addresses" not in text
    assert "v_supplier_registry_ids" not in text

def test_null_child_workforce_is_unknown_not_zero() -> None:
    m = facility_group_metric(1200, [None])
    assert m["known_sum"] == 1200
    assert m["unknown_count"] == 1
    assert m["building_count"] == 2


def test_all_unknown_across_buildings() -> None:
    m = facility_group_metric(None, [None, None])
    assert m["known_sum"] is None
    assert m["unknown_count"] == 3


def test_known_children_sum() -> None:
    m = facility_group_metric(1000, [400, 200])
    assert m["known_sum"] == 1600
    assert m["unknown_count"] == 0


def test_sql_body_matches_null_semantics() -> None:
    sql = MIGRATION.read_text(encoding="utf-8")
    marker = "create or replace function public._facility_group_metric"
    body = sql.split(marker, 1)[1].split("$$;", 1)[0]
    assert "where x is not null" in body
    assert "where x is null" in body
    assert "then null" in body
    assert "coalesce(cardinality(p_vals), 0) = 0 then p_own" in body
