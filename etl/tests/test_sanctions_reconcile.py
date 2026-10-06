"""Daily sanctions reads (spec-etl-freshness S1): unchanged entries cost nothing,
and entries a publisher removes are delisted only from a complete read.

The dangerous failure is a partial read (a layout change, a truncated file, the
CBP Wayback snapshot) being taken as hundreds of delistings, which would open
review rows to un-flag suppliers. `plan_reconcile` is the one decision point.
"""
from __future__ import annotations

import asyncio
from datetime import date
from typing import Any

from etl.core import sanctions
from etl.core.sanctions import BaseSanctionScraper, SanctionEntry, plan_reconcile


def _entry(ref: str, name: str = "Hotan Haolin Hair Accessories Co Ltd", **kw: Any) -> SanctionEntry:
    return SanctionEntry(list_code="uflpa", source_code="UFLPA", entry_ref=ref, entity_name=name, **kw)


# --- plan_reconcile ---------------------------------------------------------

def test_complete_read_with_few_missing_reconciles() -> None:
    assert plan_reconcile(read_complete=True, listed_before=1000, seen=998, missing=2) == "reconcile"


def test_not_complete_never_reconciles_even_when_accepted() -> None:
    assert plan_reconcile(read_complete=False, listed_before=100, seen=100, missing=1) == "partial"
    assert plan_reconcile(read_complete=False, listed_before=100, seen=100, missing=1, accept=True) == "partial"


def test_short_read_is_partial_not_a_mass_delisting() -> None:
    assert plan_reconcile(read_complete=True, listed_before=1000, seen=800, missing=200) == "partial"


def test_many_removals_hold_for_a_human() -> None:
    # 30 of 1,000 is over 2%: the read counts, the delistings wait.
    assert plan_reconcile(read_complete=True, listed_before=1000, seen=970, missing=30) == "held"


def test_small_list_floor_allows_a_genuine_removal() -> None:
    # 2% of 75 is 1.5; a single real removal must not hold the US WRO list.
    assert plan_reconcile(read_complete=True, listed_before=75, seen=74, missing=1) == "reconcile"
    assert plan_reconcile(read_complete=True, listed_before=75, seen=71, missing=4) == "held"


def test_founder_accept_releases_held_and_short_reads() -> None:
    assert plan_reconcile(read_complete=True, listed_before=1000, seen=970, missing=30, accept=True) == "reconcile"
    assert plan_reconcile(read_complete=True, listed_before=365, seen=205, missing=160, accept=True) == "reconcile"


# --- content_hash -----------------------------------------------------------

def test_content_hash_is_stable_and_ignores_the_citation_url() -> None:
    a = _entry("r1", listed_date=date(2025, 1, 15), source_url="https://www.dhs.gov/uflpa-entity-list")
    b = _entry("r1", listed_date=date(2025, 1, 15), source_url="https://firecrawl.example/cached")
    assert a.content_hash() == b.content_hash()


def test_content_hash_moves_with_anything_the_publisher_says() -> None:
    base = _entry("r1", listed_date=date(2025, 1, 15)).content_hash()
    assert _entry("r1", listed_date=date(2025, 1, 16)).content_hash() != base
    assert _entry("r1", listed_date=date(2025, 1, 15), aliases=["Hollin"]).content_hash() != base
    assert _entry("r1", listed_date=date(2025, 1, 15), status="Removed").content_hash() != base


# --- run() ------------------------------------------------------------------

class _Fake(BaseSanctionScraper):
    code = "uflpa"
    source_code = "UFLPA"

    def __init__(self, entries: list[SanctionEntry], known: dict[str, str], wayback: bool = False) -> None:
        super().__init__()
        self._entries, self._known, self._wayback = entries, known, wayback
        self.touched: list[str] = []
        self.reconciled: dict[str, Any] = {}
        self.closed: dict[str, Any] = {}

    async def fetch(self):  # type: ignore[override]
        if self._wayback:
            self.read_complete = False
        for e in self._entries:
            yield e

    def _open_run(self) -> str:
        return "run-1"

    def _close_run(self, run_id, status, seen, upserted, skipped, matched, error, extra=None):  # type: ignore[override]
        self.closed = {"status": status, "seen": seen, "upserted": upserted, **(extra or {})}

    def _known_hashes(self, list_code: str) -> dict[str, str | None]:
        return dict(self._known)

    def _touch_unchanged(self, list_code: str, refs: list[str], run_id: str) -> None:
        self.touched.extend(refs)

    def _reconcile(self, list_code, run_id, seen, complete):  # type: ignore[override]
        self.reconciled = {"seen": seen, "complete": complete}
        return {"action": "reconcile" if complete else "partial"}


def _run(scraper: _Fake, monkeypatch) -> list[str]:
    ingested: list[str] = []

    def fake_ingest(entry: SanctionEntry, run_id: str | None = None) -> dict[str, Any]:
        ingested.append(entry.entry_ref)
        return {"entry_id": entry.entry_ref, "matched_supplier_ids": [], "screened": 0}

    monkeypatch.setattr(sanctions, "ingest_sanction_entry", fake_ingest)
    asyncio.run(scraper.run())
    return ingested


def test_unchanged_entries_are_touched_not_reingested(monkeypatch) -> None:
    same, changed, new = _entry("same"), _entry("changed", status="Active"), _entry("new")
    s = _Fake([same, changed, new], known={"same": same.content_hash(), "changed": "old-hash"})
    ingested = _run(s, monkeypatch)
    assert ingested == ["changed", "new"]
    assert s.touched == ["same"]
    assert s.reconciled == {"seen": 3, "complete": True}
    assert s.closed["unchanged"] == 1 and s.closed["complete"] is True


def test_wayback_read_reconciles_nothing(monkeypatch) -> None:
    s = _Fake([_entry("a")], known={}, wayback=True)
    _run(s, monkeypatch)
    assert s.reconciled["complete"] is False
    assert s.closed["complete"] is False


def test_read_complete_resets_between_runs(monkeypatch) -> None:
    s = _Fake([_entry("a")], known={}, wayback=True)
    _run(s, monkeypatch)
    s._wayback = False
    _run(s, monkeypatch)
    assert s.reconciled["complete"] is True


def test_a_delisted_entry_that_returns_is_reingested_and_rescreened(monkeypatch) -> None:
    """Review finding, 6 Oct: an entry delisted then re-added unchanged must not
    hash-skip, or its deactivated matches never come back."""
    asked: list[str] = []

    class Cur:
        def __enter__(self): return self
        def __exit__(self, *a): return False
        def execute(self, sql, params=None): asked.append(" ".join(sql.split()))
        def fetchall(self): return []

    class Conn:
        def __enter__(self): return self
        def __exit__(self, *a): return False
        def cursor(self): return Cur()

    monkeypatch.setattr(sanctions.db, "conn", lambda: Conn())
    BaseSanctionScraper._known_hashes(_Fake([], known={}), "uflpa")  # the real query, not the fake's
    assert asked and "listing_status = 'listed'" in asked[0]
