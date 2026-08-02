"""Post-fetch change-skip in the upsert path (REZ-36 Spec A).

`source_records.raw_hash` was written on every upsert and read by nothing, so
every yielded record was enriched and had its evidence rewritten on every run —
before migration 0087 that minted ~5,800 stale claims per bkmea_detail run, and
it still re-billed the whole write path for unchanged data. The skip lives in
`upsert_supplier_with_source` so every scraper gets it through one code path.

Mocked cursors never parse SQL (the REZ-34 lesson), so these tests pin the
DECISIONS (which statements run, with what parameters), not the SQL text.
"""
from __future__ import annotations

import asyncio
from typing import Any

import pytest

from etl.core.scraper import BaseScraper, ScrapedRecord
from etl.core.upsert import upsert_supplier_with_source
from etl.tests.conftest import FakeCursor


def _rec(ref: str = "2632") -> ScrapedRecord:
    return ScrapedRecord(
        source_code="BKMEA",
        source_ref=ref,
        company_name="Acme Knit Composite Ltd.",
        payload={"bkmea_reg_number": "2632 - C/2026"},
    )


def _sqls(cur: FakeCursor) -> list[str]:
    return [sql for sql, _ in cur.executed]


def test_first_ingest_runs_the_full_upsert(patched_db) -> None:
    rec = _rec()
    cur = FakeCursor(skip_rows=[])
    patched_db(cur)

    result = upsert_supplier_with_source(rec)

    assert result == "sup-new"
    sqls = _sqls(cur)
    assert any("insert into public.suppliers" in s for s in sqls)
    assert any("insert into public.source_records" in s for s in sqls)


def test_unchanged_hash_skips_everything_but_fetched_at(patched_db) -> None:
    """Idempotency: a second run of the same payload upserts nothing, records
    no evidence, runs no screening or post-commit enrichment — but still
    touches fetched_at so freshness monitoring does not false-age the row."""
    rec = _rec()
    cur = FakeCursor(skip_rows=[{"supplier_id": "sup-1", "raw_hash": rec.hash()}])
    spies = patched_db(cur)

    result = upsert_supplier_with_source(rec)

    assert result is None
    sqls = _sqls(cur)
    assert not any("insert into public.suppliers" in s for s in sqls)
    assert not any("update public.suppliers set" in s for s in sqls)
    assert not any("insert into public.source_records" in s for s in sqls)
    freshen = [p for s, p in cur.executed if "set fetched_at = now()" in s]
    assert freshen == [("src-1", rec.source_ref)]
    assert spies["conn"].commits == 1
    assert spies["screened"] == []
    assert spies["post_enrich"] == []


def test_changed_hash_falls_through_to_the_full_upsert(patched_db) -> None:
    rec = _rec()
    cur = FakeCursor(
        skip_rows=[{"supplier_id": "sup-1", "raw_hash": "stale-hash"}],
        pass0_row={"supplier_id": "sup-1"},
    )
    patched_db(cur)

    result = upsert_supplier_with_source(rec)

    assert result == "sup-1"
    sqls = _sqls(cur)
    assert any("update public.suppliers set" in s for s in sqls)  # enrich ran
    assert any("insert into public.source_records" in s for s in sqls)
    assert not any("set fetched_at = now()" in s for s in sqls)


def test_null_stored_hash_never_skips(patched_db) -> None:
    rec = _rec()
    cur = FakeCursor(
        skip_rows=[{"supplier_id": "sup-1", "raw_hash": None}],
        pass0_row={"supplier_id": "sup-1"},
    )
    patched_db(cur)

    assert upsert_supplier_with_source(rec) == "sup-1"


def test_ref_on_more_than_one_supplier_falls_through(patched_db) -> None:
    """A stranded duplicate (CRONY FASHION holds member 376's page alongside
    ABANTI COLOUR TEX) makes the ref ambiguous: skipping could freeze the wrong
    supplier's row, so the full upsert runs and Pass 0 resolves it."""
    rec = _rec()
    cur = FakeCursor(
        skip_rows=[
            {"supplier_id": "sup-a", "raw_hash": rec.hash()},
            {"supplier_id": "sup-b", "raw_hash": rec.hash()},
        ],
        pass0_row={"supplier_id": "sup-a"},
    )
    patched_db(cur)

    result = upsert_supplier_with_source(rec)

    assert result == "sup-a"
    sqls = _sqls(cur)
    assert any("update public.suppliers set" in s for s in sqls)
    assert not any("set fetched_at = now()" in s for s in sqls)


# ---------------------------------------------------------------------------
# BaseScraper.run: skip counting + no evidence rewrite
# ---------------------------------------------------------------------------


class _StubScraper(BaseScraper):
    code = "stub"
    source_code = "BKMEA"

    def __init__(self, records: list[ScrapedRecord]) -> None:
        super().__init__()
        self._records = records

    async def fetch(self):
        for rec in self._records:
            yield rec


def _stub_run(monkeypatch: pytest.MonkeyPatch, records: list[ScrapedRecord], upsert_side_effect):
    scraper = _StubScraper(records)
    closed: dict[str, Any] = {}
    evidence_calls: list[Any] = []

    monkeypatch.setattr(scraper, "_open_run", lambda: "run-1")
    monkeypatch.setattr(
        scraper,
        "_close_run",
        lambda run_id, status, seen, upserted, skipped, error: closed.update(
            status=status, seen=seen, upserted=upserted, skipped=skipped, error=error
        ),
    )
    monkeypatch.setattr("etl.core.upsert.upsert_supplier_with_source", upsert_side_effect)
    monkeypatch.setattr("etl.evidence.writer.reset_document_cache", lambda: None)

    async def _evidence_spy(*a: Any, **k: Any) -> None:
        evidence_calls.append((a, k))

    monkeypatch.setattr(scraper, "_record_evidence", _evidence_spy)

    result = asyncio.run(scraper.run())
    return scraper, result, closed, evidence_calls


def test_run_counts_hash_skips_and_records_no_evidence(monkeypatch: pytest.MonkeyPatch) -> None:
    _, result, closed, evidence_calls = _stub_run(
        monkeypatch, [_rec("1"), _rec("2")], lambda rec: None
    )

    assert result["seen"] == 2
    assert result["upserted"] == 0
    assert result["skipped"] == 2
    assert closed == {"status": "success", "seen": 2, "upserted": 0, "skipped": 2, "error": None}
    assert evidence_calls == []


def test_run_distinguishes_upserts_skips_and_failures(monkeypatch: pytest.MonkeyPatch) -> None:
    outcomes = iter(["sup-1", None, RuntimeError("db gone")])

    def _upsert(rec: ScrapedRecord):
        outcome = next(outcomes)
        if isinstance(outcome, Exception):
            raise outcome
        return outcome

    _, result, _, evidence_calls = _stub_run(
        monkeypatch, [_rec("1"), _rec("2"), _rec("3")], _upsert
    )

    assert result["seen"] == 3
    assert result["upserted"] == 1
    assert result["skipped"] == 2  # one hash-skip + one failure
    assert len(evidence_calls) == 1
