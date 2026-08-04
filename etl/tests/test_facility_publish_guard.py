"""REZ-62 / A2 — facility rows must never become published.

These tests do NOT exercise live Postgres. CI has no database, and applying
migrations to production is forbidden in this session. Instead:

1. A Python mirror of `enforce_publish_tier()` after migration 0092 encodes the
   five behavioural contracts from REZ-62.
2. Static assertions on `0092_enforce_publish_tier_facility_guard.sql` pin the
   SQL shape to that mirror (coerce-first, unchanged Tier 1–3 message /
   errcode, trigger widened to `facility_of`).

Residual risk: the first real proof is founder apply-time against Postgres.
libpg_query (`ops/validate_sql_syntax.py`) covers syntax only.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any
from uuid import UUID

import pytest

REPO = Path(__file__).resolve().parents[2]
MIGRATION = (
    REPO
    / "supabase"
    / "migrations"
    / "0092_enforce_publish_tier_facility_guard.sql"
)

TIER_REFUSAL = "cannot publish supplier {id}: needs >=1 active Tier1-3 source_record"
PARENT = UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
CHILD = UUID("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")


class CheckViolation(Exception):
    """Stand-in for PostgreSQL errcode check_violation (23514)."""


def enforce_publish_tier(
    new: dict[str, Any],
    *,
    active_tier_count: int,
) -> dict[str, Any]:
    """Faithful mirror of public.enforce_publish_tier() after 0092.

    `active_tier_count` is what the SQL `select count(*) ... Tier1-3` would
    return for `new["id"]`. The facility branch short-circuits before that
    query runs.
    """
    row = dict(new)
    if row.get("facility_of") is not None:
        row["is_published"] = False
        return row

    if row.get("is_published") is True:
        if active_tier_count < 1:
            raise CheckViolation(TIER_REFUSAL.format(id=row["id"]))
    return row


def _sql() -> str:
    return MIGRATION.read_text(encoding="utf-8")


def test_migration_file_exists():
    assert MIGRATION.is_file()


def test_sql_coerces_facility_before_tier_check():
    """Coerce-first is the chosen behaviour (not raise-on-facility)."""
    sql = _sql()
    # The header REVERSE block also mentions the function name — take the
    # last create-or-replace, which is the live definition.
    marker = "create or replace function public.enforce_publish_tier()"
    func = sql.rsplit(marker, 1)[1]
    body = func.split("$$ language plpgsql", 1)[0]
    facility_at = body.index("if new.facility_of is not null then")
    publish_at = body.index("if new.is_published is true then")
    assert facility_at < publish_at
    assert "new.is_published := false;" in body[facility_at:publish_at]
    assert "return new;" in body[facility_at:publish_at]
    # Must not raise a facility-specific exception (silent coerce).
    assert "it is a facility of" not in body


def test_sql_preserves_tier_check_message_and_errcode():
    sql = _sql()
    assert (
        "cannot publish supplier %: needs >=1 active Tier1-3 source_record" in sql
    )
    assert "errcode = 'check_violation'" in sql
    assert "tier1_gov','tier2_industry','tier3_cert'" in sql.replace(" ", "")


def test_sql_trigger_fires_on_facility_of():
    sql = _sql()
    assert "drop trigger if exists trg_suppliers_publish on public.suppliers;" in sql
    assert (
        "before insert or update of is_published, facility_of on public.suppliers"
        in sql
    )


def test_null_facility_with_tier2_can_publish():
    """Case 1 — regression: normal Tier 2 publish still works."""
    out = enforce_publish_tier(
        {"id": CHILD, "is_published": True, "facility_of": None},
        active_tier_count=1,
    )
    assert out["is_published"] is True
    assert out["facility_of"] is None


def test_facility_with_tier2_cannot_end_up_published():
    """Case 2 — facility + Tier 2 evidence still stays unpublished."""
    out = enforce_publish_tier(
        {"id": CHILD, "is_published": True, "facility_of": PARENT},
        active_tier_count=1,
    )
    assert out["is_published"] is False
    assert out["facility_of"] == PARENT


def test_setting_facility_of_unpublishes_already_published_row():
    """Case 3 — B1 path: mark a published row as a facility → unpublished."""
    out = enforce_publish_tier(
        {"id": CHILD, "is_published": True, "facility_of": PARENT},
        active_tier_count=5,
    )
    assert out["is_published"] is False


def test_clearing_facility_of_does_not_auto_republish():
    """Case 4 — clearing the flag leaves is_published false."""
    # After case 3 the row is unpublished with facility_of set. Clearing the
    # FK alone must not flip is_published back to true.
    out = enforce_publish_tier(
        {"id": CHILD, "is_published": False, "facility_of": None},
        active_tier_count=5,
    )
    assert out["is_published"] is False


def test_null_facility_zero_tier_still_raises_original_message():
    """Case 5 — original Tier 1–3 refusal unchanged for non-facilities."""
    with pytest.raises(CheckViolation) as exc:
        enforce_publish_tier(
            {"id": CHILD, "is_published": True, "facility_of": None},
            active_tier_count=0,
        )
    assert str(exc.value) == TIER_REFUSAL.format(id=CHILD)
