"""REZ-66 / A6 — field-level manual-override locks.

CI has no database. These tests cover:

1. No locks → enrich SQL still writes every column (byte-identical behaviour;
   the existing upsert suite is the full regression).
2. A live lock on `city` omits city from the SET while still writing district.
3. A released lock does not block (FakeCursor only returns live locks).
4. Profile backfill SQL carries lock predicates on all 13 UPDATEs, with
   machines_sewing gated and employees_total independently gated.
5. Invalid `column_name` is rejected by the migration trigger (static +
   Python mirror of the raise message).

Residual risk: first real proof is founder apply-time against Postgres.
"""
from __future__ import annotations

import re
from pathlib import Path

import pytest

from etl.core.scraper import ScrapedRecord
from etl.core.field_locks import locked_columns
from etl.core.upsert import _apply_source_specific, _enrich_supplier, _locked_columns
from etl.tests.conftest import FakeCursor

REPO = Path(__file__).resolve().parents[2]
MIGRATION = REPO / "supabase" / "migrations" / "0094_supplier_field_locks.sql"
BACKFILL = REPO / "ops" / "backfill_profile_columns.py"

SUPPLIER_COLS = {
    "id", "city", "district", "entity_type", "bkmea_reg_number",
    "employees_total", "machines_sewing", "name_display",
}


class CheckViolation(Exception):
    """Stand-in for PostgreSQL check_violation (23514)."""


def validate_lock_column(column_name: str, known: set[str] = SUPPLIER_COLS) -> None:
    """Faithful mirror of validate_supplier_field_lock_column() after 0094."""
    if column_name not in known:
        raise CheckViolation(
            f"supplier_field_locks.column_name {column_name} "
            "is not a column on public.suppliers"
        )


def _sql() -> str:
    return MIGRATION.read_text(encoding="utf-8")


def _backfill_sql() -> str:
    return BACKFILL.read_text(encoding="utf-8")


def _enrich_rec(**over) -> ScrapedRecord:
    base = dict(
        source_code="BKMEA",
        source_ref="lock-test",
        company_name="Lock Test Knit Ltd.",
        city="Dhaka",
        district="Gazipur",
        contact_name="Rahim",
        payload={},
    )
    base.update(over)
    return ScrapedRecord(**base)


# ---------------------------------------------------------------------------
# Case 1 — no locks: enrich writes every column (existing suite is the rest)
# ---------------------------------------------------------------------------


def test_no_locks_enrich_writes_all_columns(patched_db) -> None:
    cur = FakeCursor(slug_row={"id": "sup-1"})
    patched_db(cur)
    rec = _enrich_rec()
    _enrich_supplier(cur, supplier_id="sup-1", email="a@b.com", phones=["8801711000000"], rec=rec)
    updates = [
        (sql, params) for sql, params in cur.executed
        if "update public.suppliers set" in sql and "contact_name" in sql
    ]
    assert len(updates) == 1
    sql, params = updates[0]
    for col in (
        "contact_name", "contact_role", "email_primary", "phones",
        "website", "address_raw", "city", "district", "source_tags",
    ):
        assert col in sql
    assert params[-1] == "sup-1"
    # Lock lookup ran once (not per SET fragment).
    lock_lookups = [
        sql for sql, _ in cur.executed if "from public.supplier_field_locks" in sql
    ]
    assert len(lock_lookups) == 1


# ---------------------------------------------------------------------------
# Case 2 — live city lock skips city, still writes district
# ---------------------------------------------------------------------------


def test_city_lock_skips_city_keeps_district() -> None:
    cur = FakeCursor(lock_rows=[{"column_name": "city"}])
    rec = _enrich_rec()
    _enrich_supplier(cur, supplier_id="sup-1", email=None, phones=[], rec=rec)
    updates = [
        (sql, params) for sql, params in cur.executed
        if "update public.suppliers set" in sql
    ]
    assert len(updates) == 1
    sql, params = updates[0]
    assert "city          = coalesce(city, %s)" not in sql
    assert "district      = coalesce(district, %s)" in sql
    assert "Gazipur" in params
    assert "Dhaka" not in params


def test_entity_type_lock_beats_brand_overwrite() -> None:
    """BRAND_* would overwrite entity_type; a lock must stop that."""
    cur = FakeCursor(lock_rows=[{"column_name": "entity_type"}])
    rec = ScrapedRecord(
        source_code="BRAND_HM",
        source_ref="hm-1",
        company_name="Brand Partner Knit",
        payload={},
    )
    _apply_source_specific(cur, supplier_id="sup-1", rec=rec)
    updates = [
        sql for sql, _ in cur.executed if "update public.suppliers set" in sql
    ]
    assert updates == []


def test_bkmea_reg_lock_beats_canonical_overwrite() -> None:
    cur = FakeCursor(lock_rows=[{"column_name": "bkmea_reg_number"}])
    rec = ScrapedRecord(
        source_code="BKMEA",
        source_ref="2842:detail",
        company_name="Acme Knit",
        payload={"bkmea_reg_number": "2638 - C/2026"},
        canonical_registry=True,
    )
    _apply_source_specific(cur, supplier_id="sup-1", rec=rec)
    updates = [
        (sql, params) for sql, params in cur.executed
        if "update public.suppliers set" in sql
    ]
    assert len(updates) == 1
    sql, params = updates[0]
    assert "bkmea_reg_number" not in sql
    assert "bkmea_verified = true" in sql
    assert "entity_type" in sql
    assert "2638 - C/2026" not in params


# ---------------------------------------------------------------------------
# Case 3 — released lock no longer blocks
# ---------------------------------------------------------------------------


def test_released_lock_does_not_block() -> None:
    # FakeCursor only surfaces live locks; a released row is absent from the
    # SELECT ... WHERE released_at IS NULL result set.
    cur = FakeCursor(lock_rows=[])
    assert locked_columns(cur, "sup-1") == set()
    # upsert still re-exports the moved helper under the private name.
    assert _locked_columns(cur, "sup-1") == set()
    rec = _enrich_rec()
    _enrich_supplier(cur, supplier_id="sup-1", email=None, phones=[], rec=rec)
    updates = [
        sql for sql, _ in cur.executed if "update public.suppliers set" in sql
    ]
    assert len(updates) == 1
    assert "city          = coalesce(city, %s)" in updates[0]


# ---------------------------------------------------------------------------
# Case 4 — backfill lock predicates (13 UPDATEs)
# ---------------------------------------------------------------------------


def test_backfill_has_lock_predicates_on_every_update() -> None:
    """REZ-68 merged same-column BKMEA/BGMEA numeric UPDATEs (13 → 9).

    Each remaining UPDATE still carries its A6 lock predicate unchanged.
    """
    sql = _backfill_sql()
    preds = re.findall(
        r"and not exists \(\s*select 1 from public\.supplier_field_locks l\s+"
        r"where l\.supplier_id = s\.id\s+"
        r"and l\.column_name = '(\w+)'\s+"
        r"and l\.released_at is null\s*\)",
        sql,
        flags=re.IGNORECASE,
    )
    assert len(preds) == 9, preds
    # Case 4 contract: machines_sewing gated independently of employees_total.
    assert preds.count("machines_sewing") == 1
    assert preds.count("employees_total") == 1
    assert "machines_sewing" in preds
    assert "employees_total" in preds


# ---------------------------------------------------------------------------
# Case 5 — invalid column_name rejected with a clear message
# ---------------------------------------------------------------------------


def test_migration_trigger_validates_column_name() -> None:
    sql = _sql()
    assert "create table if not exists public.supplier_field_locks" in sql
    assert "validate_supplier_field_lock_column" in sql
    assert "information_schema.columns" in sql
    assert "is not a column on public.suppliers" in sql
    assert "idx_supplier_field_locks_live" in sql
    assert "where released_at is null" in sql
    assert "enable row level security" in sql
    # No permissive policies for anon/authenticated.
    assert "create policy" not in sql.lower()
    # Enforcement is ETL-side — no generic BEFORE UPDATE on suppliers.
    assert "before update on public.suppliers" not in sql.lower()
    assert "before insert or update of is_published" not in sql.lower()


def test_invalid_column_name_rejected_with_clear_message() -> None:
    with pytest.raises(CheckViolation, match="not_a_real_column"):
        validate_lock_column("not_a_real_column")
    validate_lock_column("city")  # must not raise


def test_migration_has_reverse_block() -> None:
    sql = _sql()
    assert "REVERSE" in sql
    assert "drop table if exists public.supplier_field_locks" in sql
