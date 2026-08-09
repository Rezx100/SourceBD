"""Pins for REZ-98 option (a) — backed-only BGMEA display, and the two guards.

The display rule and the guards answer two different halves of the same defect.
The migration stops publishing a registration whose live source record belongs
to another supplier. The guards stop the array acquiring more of them: the
upsert refuses to append a number another supplier's live record already backs,
and the conflation repair drops the element when it moves the record away —
the omission that stranded 805 numbers in the first place.

The migration is asserted statically. CI has no database and applying to
production is forbidden in this session, so `ops/validate_sql_syntax.py`
(libpg_query) covers syntax and these assertions cover shape. The predicate
itself was dry-run as a SELECT against production and reproduced the expected
6,775 -> 5,970 rows, 5,801 -> 5,740 suppliers, 664 -> 199 multi-number.
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any

from etl.core.scraper import ScrapedRecord
from etl.core.upsert import _apply_source_specific
from ops.repair_bgmea_conflations import backed_reg_numbers

REPO = Path(__file__).resolve().parents[2]
MIGRATIONS_DIR = REPO / "supabase" / "migrations"

# Every migration that has ever (re)defined v_supplier_registry_ids_direct,
# in application order — which for this set coincides with filename order
# under BOTH conventions (the REZ-73 recreation is deliberately
# timestamp-named 20260808 so version-ordered replay cannot resurrect a
# superseded body). The backed-only rule must hold in the LIVE shaper —
# the last one — not merely in the historical REZ-98 file: 20260808_rez73
# recreated the view (REZ-73 relaxation), and the rule had to be carried
# forward there explicitly. A future recreation that forgets the rule is
# exactly the regression this file exists to catch, so the definer set is
# pinned: adding another definer fails here loudly instead of letting the
# assertions keep running against a file nobody edits any more.
_REGISTRY_VIEW_DEFINERS = [
    "0021_v_supplier_registry_ids_inherited.sql",
    "20260724202039_rez_medium_security_batch.sql",
    "20260805_rez98_registry_ids_bgmea_backed_only.sql",
    "20260808_rez73_buyer_supplier_profile_facilities.sql",
]


def _live_registry_view_migration() -> Path:
    def _normalize(sql: str) -> str:
        # Quoted-identifier recreates must still count as definers.
        return (
            sql.replace('"public"', "public")
            .replace('"v_supplier_registry_ids_direct"', "v_supplier_registry_ids_direct")
        )

    definers = sorted(
        path.name
        for path in MIGRATIONS_DIR.glob("*.sql")
        if "create or replace view public.v_supplier_registry_ids_direct"
        in _normalize(path.read_text(encoding="utf-8"))
    )
    assert definers == sorted(_REGISTRY_VIEW_DEFINERS), (
        "the set of migrations defining v_supplier_registry_ids_direct "
        f"changed: {definers}. If a new migration recreates the view, carry "
        "the REZ-98 backed-only BGMEA rule forward and update this pin."
    )
    # Dynamic DO / EXECUTE format recreates never match the create needle —
    # fail closed if any migration uses them against this view.
    dynamic = re.compile(
        r"execute\s+(?:format\s*\(|'|[\s\S]{0,80}\|\|)[\s\S]{0,200}v_supplier_registry_ids",
        re.IGNORECASE,
    )
    for path in MIGRATIONS_DIR.glob("*.sql"):
        assert not dynamic.search(path.read_text(encoding="utf-8")), (
            f"{path.name} dynamically recreates a registry view via EXECUTE "
            "format — add an explicit CREATE and update the definer-set pin"
        )
    return MIGRATIONS_DIR / _REGISTRY_VIEW_DEFINERS[-1]


MIGRATION = _live_registry_view_migration()


# --------------------------------------------------------------- migration ----
class TestMigrationShape:
    def test_bgmea_branch_requires_a_live_record_on_the_same_supplier(self):
        sql = MIGRATION.read_text(encoding="utf-8")
        assert "cross join lateral unnest(s.bgmea_reg_numbers) as n(value)" in sql
        assert "sr.supplier_id = s.id" in sql
        assert "sr.status = 'active'" in sql
        assert "sr.source_ref = 'general:' || n.value" in sql
        assert "sr.fields->>'bgmea_reg_number' = n.value" in sql

    def test_the_bare_unnest_is_gone(self):
        # The whole defect was publishing the array without asking anything.
        sql = MIGRATION.read_text(encoding="utf-8")
        assert "unnest(s.bgmea_reg_numbers) as value" not in sql

    def test_every_other_register_branch_survives_unchanged(self):
        sql = MIGRATION.read_text(encoding="utf-8")
        for needle in (
            "s.bkmea_reg_number",
            "rr.rsc_factory_id",
            "sr.fields->>'epb_reg_no'",
            "sr.fields->>'bgapmea_membership_no'",
            "sr.fields->>'btma_sl_no'",
            "c.certificate_no",
        ):
            assert needle in sql, needle

    def test_branch_predicate_and_column_contract_are_preserved(self):
        # `create or replace view` requires the same column list; the parent
        # view and the profile RPC both select from it by name. The branch
        # predicate itself is REZ-73's relaxation — published suppliers OR
        # attached facilities — and every one of the seven branches must
        # carry it; the historical published-only form must not survive
        # anywhere in the live shaper.
        sql = MIGRATION.read_text(encoding="utf-8")
        assert "create or replace view public.v_supplier_registry_ids_direct" in sql
        view_body = sql.split(
            "create or replace view public.v_supplier_registry_ids_direct", 1
        )[1]
        assert view_body.count(
            "(s.is_published = true or s.facility_of is not null)"
        ) == 7
        for col in ("supplier_id", "source_code", "label", "value", "verified", "source_url"):
            assert col in sql, col

    def test_it_does_not_mutate_the_array(self):
        # Display rule only. The repair is a separate production write.
        sql = MIGRATION.read_text(encoding="utf-8").lower()
        for verb in ("update public.suppliers", "delete from", "insert into"):
            assert verb not in sql, verb


# ------------------------------------------------------------- append guard ----
class _GuardCursor:
    """Routes the three statements `_apply_source_specific` issues."""

    def __init__(self, *, held_elsewhere: bool) -> None:
        self._held_elsewhere = held_elsewhere
        self.updates: list[tuple[str, Any]] = []
        self._last = ""

    def execute(self, sql: str, params: Any = None) -> None:
        self._last = sql
        if sql.strip().startswith("update public.suppliers"):
            self.updates.append((sql, params))

    def fetchall(self) -> list[dict[str, Any]]:
        return []  # no field locks

    def fetchone(self) -> dict[str, Any] | None:
        if "from public.source_records sr" in self._last:
            return {"?column?": 1} if self._held_elsewhere else None
        return None

    @property
    def update_sql(self) -> str:
        return "".join(sql for sql, _ in self.updates)


def _bgmea_record(reg: str = "5729") -> ScrapedRecord:
    return ScrapedRecord(
        source_code="BGMEA",
        source_ref=f"general:{reg}",
        company_name="Arbella Fashion Ltd.",
        payload={"bgmea_reg_number": reg},
    )


def _run_guard(monkeypatch, *, held_elsewhere: bool) -> _GuardCursor:
    monkeypatch.setattr("etl.core.upsert.get_source_id", lambda code: "src-bgmea")
    cur = _GuardCursor(held_elsewhere=held_elsewhere)
    _apply_source_specific(cur, supplier_id="sup-arbella", rec=_bgmea_record())
    return cur


class TestAppendGuard:
    def test_a_free_number_is_still_appended(self, monkeypatch):
        cur = _run_guard(monkeypatch, held_elsewhere=False)
        assert "bgmea_reg_numbers" in cur.update_sql
        assert "bgmea_verified = true" in cur.update_sql

    def test_a_number_another_supplier_holds_is_refused(self, monkeypatch):
        # The Arbella shape: general:5729's live record sits on avant-garments.
        cur = _run_guard(monkeypatch, held_elsewhere=True)
        assert "bgmea_reg_numbers" not in cur.update_sql

    def test_refusing_the_append_still_writes_the_other_columns(self, monkeypatch):
        # The supplier does hold a BGMEA record; only the disputed NUMBER is
        # withheld. Dropping the whole UPDATE would lose entity_type too.
        cur = _run_guard(monkeypatch, held_elsewhere=True)
        assert cur.updates, "the update must still run"
        assert "bgmea_verified = true" in cur.update_sql
        assert "entity_type" in cur.update_sql

    def test_the_guard_excludes_this_supplier_and_matches_both_keys(self, monkeypatch):
        monkeypatch.setattr("etl.core.upsert.get_source_id", lambda code: "src-bgmea")
        seen: list[tuple[str, Any]] = []

        class _Spy(_GuardCursor):
            def execute(self, sql: str, params: Any = None) -> None:
                seen.append((sql, params))
                super().execute(sql, params)

        cur = _Spy(held_elsewhere=False)
        _apply_source_specific(cur, supplier_id="sup-arbella", rec=_bgmea_record())
        probe = next(s for s, _ in seen if "from public.source_records sr" in s)
        params = next(p for s, p in seen if "from public.source_records sr" in s)
        assert "sr.supplier_id <> %s" in probe
        assert "sr.status = 'active'" in probe
        # source_id, this supplier, the general: ref, and the bare number.
        assert params == ("src-bgmea", "sup-arbella", "general:5729", "5729")

    def test_a_record_with_no_reg_number_touches_nothing(self, monkeypatch):
        monkeypatch.setattr("etl.core.upsert.get_source_id", lambda code: "src-bgmea")
        cur = _GuardCursor(held_elsewhere=True)
        rec = ScrapedRecord(
            source_code="BGMEA", source_ref="member:4388",
            company_name="X Ltd.", payload={},
        )
        _apply_source_specific(cur, supplier_id="sup-x", rec=rec)
        assert not cur.updates


# ----------------------------------------------------- repair-side removal ----
class TestBackedRegNumbers:
    CODES = {"src-bgmea": "BGMEA", "src-bkmea": "BKMEA"}

    def test_general_ref_vouches_for_its_number(self):
        recs = [{"source_id": "src-bgmea", "source_ref": "general:6631", "fields": {}}]
        assert backed_reg_numbers(recs, self.CODES) == {"6631"}

    def test_member_keyed_row_falls_back_to_the_payload(self):
        recs = [
            {
                "source_id": "src-bgmea",
                "source_ref": "member:4388",
                "fields": {"bgmea_reg_number": "6631"},
            }
        ]
        assert backed_reg_numbers(recs, self.CODES) == {"6631"}

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
            # REZ-89 added the A6 lock lookup to _recompute_parent. No locks
            # here, so every assertion below is the REZ-98 behaviour unchanged.
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
    REMAINING = [{"source_id": "src-bgmea", "source_ref": "general:6631", "fields": {}}]

    def test_the_moved_number_is_dropped(self):
        # Arbella keeps 6631 (its own record) and loses 5729 (moved away).
        body = _recompute(["5729", "6631"], self.REMAINING)
        assert body["bgmea_reg_numbers"] == ["6631"]

    def test_a_still_backed_array_is_left_alone(self):
        body = _recompute(["6631"], self.REMAINING)
        assert "bgmea_reg_numbers" not in body

    def test_losing_every_record_empties_the_array(self):
        body = _recompute(["5729", "6631"], [])
        assert body["bgmea_reg_numbers"] == []

    def test_order_is_preserved_for_the_survivors(self):
        remaining = [
            {"source_id": "src-bgmea", "source_ref": "general:6257", "fields": {}},
            {"source_id": "src-bgmea", "source_ref": "general:1181", "fields": {}},
        ]
        body = _recompute(["6257", "4564", "1181", "2993"], remaining)
        assert body["bgmea_reg_numbers"] == ["6257", "1181"]

    def test_the_numeric_recompute_still_happens(self):
        body = _recompute(["6631"], self.REMAINING)
        assert "employees_total" in body

    def test_bgmea_verified_is_not_touched(self):
        # Supplier-level flag; it cannot describe individual elements either
        # way, so this fix deliberately leaves it to the repair issue.
        body = _recompute(["5729", "6631"], [])
        assert "bgmea_verified" not in body
