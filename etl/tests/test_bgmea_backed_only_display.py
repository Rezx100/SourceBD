"""Pins for REZ-98 backed-only BGMEA display + REZ-115 register identity.

REZ-98: show only numbers backed by a live source record on the same supplier.
REZ-115: the live record also carries the register (General vs Associate);
display derives from source_records with register labels, and stored identities
are ``general:N`` / ``associate:N`` — never bare digits.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

from etl.core.scraper import ScrapedRecord
from etl.core.upsert import _apply_source_specific
from ops.repair_bgmea_conflations import backed_reg_numbers

REPO = Path(__file__).resolve().parents[2]
MIGRATION_REZ98 = REPO / "supabase" / "migrations" / "20260805_rez98_registry_ids_bgmea_backed_only.sql"
MIGRATION_REZ115 = REPO / "supabase" / "migrations" / "0101_rez115_bgmea_register_identity.sql"


# --------------------------------------------------------------- migration ----
class TestMigrationShapeRez98:
    def test_bgmea_branch_requires_a_live_record_on_the_same_supplier(self):
        sql = MIGRATION_REZ98.read_text(encoding="utf-8")
        assert "cross join lateral unnest(s.bgmea_reg_numbers) as n(value)" in sql
        assert "sr.supplier_id = s.id" in sql
        assert "sr.status = 'active'" in sql
        assert "sr.source_ref = 'general:' || n.value" in sql
        assert "sr.fields->>'bgmea_reg_number' = n.value" in sql

    def test_the_bare_unnest_is_gone(self):
        sql = MIGRATION_REZ98.read_text(encoding="utf-8")
        assert "unnest(s.bgmea_reg_numbers) as value" not in sql


class TestMigrationShapeRez115:
    def test_bgmea_branch_derives_from_source_records_with_register(self):
        sql = MIGRATION_REZ115.read_text(encoding="utf-8")
        assert "create or replace view public.v_supplier_registry_ids_direct" in sql
        assert "BGMEA General member #" in sql
        assert "BGMEA Associate member #" in sql
        assert "bgmea_member_type" in sql
        assert "https://www.bgmea.com.bd/member/" in sql
        # Never publish from the bare array again.
        assert "unnest(s.bgmea_reg_numbers)" not in sql
        # Never deep-link associates into the general member path by digit alone.
        assert "associate_buying_house" in sql

    def test_every_other_register_branch_survives(self):
        sql = MIGRATION_REZ115.read_text(encoding="utf-8")
        for needle in (
            "s.bkmea_reg_number",
            "rr.rsc_factory_id",
            "sr.fields->>'epb_reg_no'",
            "sr.fields->>'bgapmea_membership_no'",
            "sr.fields->>'btma_sl_no'",
            "c.certificate_no",
        ):
            assert needle in sql, needle

    def test_it_does_not_mutate_the_array(self):
        sql = MIGRATION_REZ115.read_text(encoding="utf-8").lower()
        for verb in ("update public.suppliers", "delete from", "insert into"):
            assert verb not in sql, verb

    def test_migration_associate_never_builds_member_url_from_digit(self):
        sql = MIGRATION_REZ115.read_text(encoding="utf-8")
        # Associate branch must leave source_url null — the only /member/ builder
        # is gated on general_manufacturer + bgmea_member_id.
        assert "when sr.fields->>'bgmea_member_type' = 'general_manufacturer'" in sql
        assert "bgmea_member_id" in sql
        general_only = sql.split("union all")[0]
        assert "bgmea_member_id" in general_only


# ------------------------------------------------------------- append guard ----
class _GuardCursor:
    """Routes the statements `_apply_source_specific` issues."""

    def __init__(self, *, held_elsewhere: bool) -> None:
        self._held_elsewhere = held_elsewhere
        self.updates: list[tuple[str, Any]] = []
        self._last = ""
        self.update_sql = ""

    def execute(self, sql: str, params: Any = None) -> None:
        self._last = sql
        # Probe SELECT for held-elsewhere — not the UPDATE that embeds a subquery.
        if (
            "from public.source_records sr" in sql
            and "update public.suppliers" not in sql.lower()
        ):
            return
        if "update public.suppliers" in sql:
            self.updates.append((sql, params))
            self.update_sql = sql

    def fetchone(self) -> tuple[int] | None:
        if (
            "from public.source_records sr" in self._last
            and "update public.suppliers" not in self._last.lower()
        ):
            return (1,) if self._held_elsewhere else None
        return None

    def fetchall(self) -> list:
        return []


def _bgmea_record(
    reg: str = "5729",
    *,
    member_type: str = "general_manufacturer",
) -> ScrapedRecord:
    prefix = "general" if member_type == "general_manufacturer" else ""
    ref = f"general:{reg}" if prefix else reg
    return ScrapedRecord(
        source_code="BGMEA",
        source_ref=ref,
        company_name="Arbella Fashion Ltd.",
        payload={
            "bgmea_reg_number": reg,
            "bgmea_member_type": member_type,
        },
    )


def _run_guard(monkeypatch, *, held_elsewhere: bool) -> _GuardCursor:
    monkeypatch.setattr("etl.core.upsert.get_source_id", lambda code: "src-bgmea")
    cur = _GuardCursor(held_elsewhere=held_elsewhere)
    _apply_source_specific(cur, supplier_id="sup-arbella", rec=_bgmea_record())
    return cur


class TestAppendGuard:
    def test_a_free_identity_rewrites_from_vouchers(self, monkeypatch):
        cur = _run_guard(monkeypatch, held_elsewhere=False)
        assert "bgmea_reg_numbers" in cur.update_sql
        assert "bgmea_verified = true" in cur.update_sql
        assert "bgmea_member_type" in cur.update_sql
        assert cur.updates
        params = cur.updates[0][1]
        assert "src-bgmea" in params

    def test_duplicate_holder_still_rewrites_array_loudly(self, monkeypatch):
        # Array is rewritten from THIS supplier's live SRs; duplicate holders
        # are logged for the conflation detector, not silently stripped.
        cur = _run_guard(monkeypatch, held_elsewhere=True)
        assert "bgmea_reg_numbers" in cur.update_sql
        assert "bgmea_verified = true" in cur.update_sql

    def test_the_guard_is_register_scoped(self, monkeypatch):
        monkeypatch.setattr("etl.core.upsert.get_source_id", lambda code: "src-bgmea")
        seen: list[tuple[str, Any]] = []

        class _Spy(_GuardCursor):
            def execute(self, sql: str, params: Any = None) -> None:
                seen.append((sql, params))
                super().execute(sql, params)

        cur = _Spy(held_elsewhere=False)
        _apply_source_specific(cur, supplier_id="sup-arbella", rec=_bgmea_record())
        probe = next(s for s, _ in seen if "from public.source_records sr" in s and "bgmea_member_type" in s)
        params = next(p for s, p in seen if "from public.source_records sr" in s and "bgmea_member_type" in s)
        assert "sr.supplier_id <> %s" in probe
        assert params == (
            "src-bgmea",
            "sup-arbella",
            "general_manufacturer",
            "general:5729",
            "5729",
        )

    def test_associate_identity_triggers_voucher_rewrite(self, monkeypatch):
        monkeypatch.setattr("etl.core.upsert.get_source_id", lambda code: "src-bgmea")
        cur = _GuardCursor(held_elsewhere=False)
        _apply_source_specific(
            cur,
            supplier_id="sup-ocean",
            rec=_bgmea_record("1", member_type="associate_buying_house"),
        )
        assert "associate:" in cur.update_sql or "associate_buying_house" in cur.update_sql

    def test_bare_reg_without_member_type_is_not_stored(self, monkeypatch):
        monkeypatch.setattr("etl.core.upsert.get_source_id", lambda code: "src-bgmea")
        cur = _GuardCursor(held_elsewhere=False)
        rec = ScrapedRecord(
            source_code="BGMEA",
            source_ref="1",
            company_name="X Ltd.",
            payload={"bgmea_reg_number": "1"},
        )
        _apply_source_specific(cur, supplier_id="sup-x", rec=rec)
        assert not cur.updates

    def test_rewrite_sql_builds_identities_from_member_type(self, monkeypatch):
        cur = _run_guard(monkeypatch, held_elsewhere=False)
        assert "general|associate" in cur.update_sql
        assert "general_manufacturer" in cur.update_sql

    def test_a_record_with_no_reg_number_touches_nothing(self, monkeypatch):
        monkeypatch.setattr("etl.core.upsert.get_source_id", lambda code: "src-bgmea")
        cur = _GuardCursor(held_elsewhere=True)
        rec = ScrapedRecord(
            source_code="BGMEA",
            source_ref="member:4388",
            company_name="X Ltd.",
            payload={},
        )
        _apply_source_specific(cur, supplier_id="sup-x", rec=rec)
        assert not cur.updates


# ----------------------------------------------------- repair-side removal ----
class TestBackedRegNumbers:
    CODES = {"src-bgmea": "BGMEA", "src-bkmea": "BKMEA"}

    def test_general_ref_vouches_for_general_identity(self):
        recs = [
            {
                "source_id": "src-bgmea",
                "source_ref": "general:6631",
                "fields": {
                    "bgmea_member_type": "general_manufacturer",
                    "bgmea_reg_number": "6631",
                },
            }
        ]
        assert backed_reg_numbers(recs, self.CODES) == {"general:6631"}

    def test_associate_ref_vouches_for_associate_identity(self):
        recs = [
            {
                "source_id": "src-bgmea",
                "source_ref": "1",
                "fields": {
                    "bgmea_member_type": "associate_buying_house",
                    "bgmea_reg_number": "1",
                },
            }
        ]
        assert backed_reg_numbers(recs, self.CODES) == {"associate:1"}

    def test_member_keyed_row_falls_back_to_the_payload(self):
        recs = [
            {
                "source_id": "src-bgmea",
                "source_ref": "member:4388",
                "fields": {
                    "bgmea_member_type": "general_manufacturer",
                    "bgmea_reg_number": "6631",
                },
            }
        ]
        assert backed_reg_numbers(recs, self.CODES) == {"general:6631"}

    def test_non_bgmea_records_vouch_for_nothing(self):
        recs = [
            {
                "source_id": "src-bkmea",
                "source_ref": "1449",
                "fields": {"bgmea_reg_number": "6631"},
            }
        ]
        assert backed_reg_numbers(recs, self.CODES) == set()

    def test_no_records_leaves_nothing_backed(self):
        assert backed_reg_numbers([], self.CODES) == set()


class _FakeRest:
    def __init__(self, *, held: list[str], remaining: list[dict[str, Any]]) -> None:
        self._held = held
        self._remaining = remaining
        self.patched: list[dict[str, Any]] = []

    def all_rows(self, path: str, params: dict[str, str]) -> list[dict[str, Any]]:
        if path == "supplier_field_locks":
            return []
        assert path == "source_records"
        assert params["status"] == "eq.active"
        assert "source_ref" in params["select"], "the ref is the primary backing test"
        return list(self._remaining)

    def one(self, path: str, params: dict[str, str]) -> dict[str, Any] | None:
        return {"bgmea_reg_numbers": list(self._held)}

    def patch(self, path: str, params: dict[str, str], body: dict[str, Any]) -> list[dict]:
        self.patched.append(body)
        return []


def _recompute(held: list[str], remaining: list[dict[str, Any]]) -> dict[str, Any]:
    from ops.repair_bgmea_conflations import _recompute_parent

    rest = _FakeRest(held=held, remaining=remaining)
    _recompute_parent(rest, "sup-arbella", {"src-bgmea": "BGMEA"})
    return rest.patched[0]


class TestRecomputeParentDropsMovedNumbers:
    REMAINING = [
        {
            "source_id": "src-bgmea",
            "source_ref": "general:6631",
            "fields": {
                "bgmea_member_type": "general_manufacturer",
                "bgmea_reg_number": "6631",
            },
        }
    ]

    def test_the_moved_identity_is_dropped(self):
        body = _recompute(["general:5729", "general:6631"], self.REMAINING)
        assert body["bgmea_reg_numbers"] == ["general:6631"]

    def test_a_still_backed_array_is_left_alone(self):
        body = _recompute(["general:6631"], self.REMAINING)
        assert "bgmea_reg_numbers" not in body

    def test_losing_every_record_empties_the_array(self):
        body = _recompute(["general:5729", "general:6631"], [])
        assert body["bgmea_reg_numbers"] == []

    def test_bare_held_rewrites_to_prefixed_identity(self):
        # Pre-backfill state: bare digits must not be intersected away.
        body = _recompute(["6631"], self.REMAINING)
        assert body["bgmea_reg_numbers"] == ["general:6631"]

    def test_order_is_preserved_for_the_survivors(self):
        remaining = [
            {
                "source_id": "src-bgmea",
                "source_ref": "general:6257",
                "fields": {
                    "bgmea_member_type": "general_manufacturer",
                    "bgmea_reg_number": "6257",
                },
            },
            {
                "source_id": "src-bgmea",
                "source_ref": "general:1181",
                "fields": {
                    "bgmea_member_type": "general_manufacturer",
                    "bgmea_reg_number": "1181",
                },
            },
        ]
        body = _recompute(
            ["general:6257", "general:4564", "general:1181", "general:2993"],
            remaining,
        )
        assert body["bgmea_reg_numbers"] == ["general:1181", "general:6257"]
