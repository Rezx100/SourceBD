"""EPB category-scoped enumeration + attach-only enrich mode (decision D).

EPB's register separates RMG from jute/fish/rice by CATEGORY, not by
association: of 5,939 approved exporters only 541 carry a BGMEA/BKMEA flag,
so the association-scoped `epb_web` pass never saw the unflagged RMG
majority (SARADA FASHIONS, exporter 4083, category Knit — invisible until
the 3 Aug 2026 live probe). The category pass widens coverage to them, and
the founder's policy is ATTACH-ONLY: records from that pass carry
`enrich_only=True` and can never mint a single-source EPB profile.

Mocked cursors never parse SQL (the REZ-34 lesson), so the upsert tests pin
the DECISIONS (which statements run), not the SQL text.
"""
from __future__ import annotations

import asyncio
import json
from types import SimpleNamespace
from typing import Any

from etl.acquire import AcquireRequest
from etl.core.scraper import ScrapedRecord
from etl.core.upsert import upsert_supplier_with_source
from etl.scrapers.epb_web import RMG_CATEGORIES, EpbScraper
from etl.tests.conftest import FakeCursor


def _epb_rec(ref: str = "4083", enrich_only: bool = True) -> ScrapedRecord:
    return ScrapedRecord(
        source_code="EPB",
        source_ref=ref,
        company_name="SARADA FASHIONS LIMITED.",
        payload={"epb_reg_no": "BD05918"},
        enrich_only=enrich_only,
    )


def _sqls(cur: FakeCursor) -> list[str]:
    return [sql for sql, _ in cur.executed]


# ---------------------------------------------------------------------------
# The attach-only gate in upsert_supplier_with_source
# ---------------------------------------------------------------------------


def test_unmatched_enrich_only_record_never_creates(patched_db) -> None:
    """The whole point of decision D: an EPB category-pass record that matches
    nothing is skipped — no supplier insert, no source record, no evidence,
    no screening."""
    cur = FakeCursor(skip_rows=[])
    spies = patched_db(cur)

    assert upsert_supplier_with_source(_epb_rec()) is None

    sqls = _sqls(cur)
    assert not any("insert into public.suppliers" in s for s in sqls)
    assert not any("insert into public.source_records" in s for s in sqls)
    assert spies["screened"] == []
    assert spies["post_enrich"] == []


def test_matched_enrich_only_record_enriches(patched_db) -> None:
    """Attach-only still ATTACHES: SARADA FASHIONS (unflagged, category Knit)
    enriches the existing profile when the matcher finds it."""
    cur = FakeCursor(skip_rows=[], slug_row={"id": "sup-existing"})
    patched_db(cur)

    assert upsert_supplier_with_source(_epb_rec()) == "sup-existing"

    sqls = _sqls(cur)
    assert not any("insert into public.suppliers" in s for s in sqls)
    assert any("update public.suppliers set" in s for s in sqls)  # enrich ran
    assert any("insert into public.source_records" in s for s in sqls)


def test_normal_record_still_creates(patched_db) -> None:
    """Default behaviour is unchanged: without enrich_only an unmatched record
    mints a supplier (the association pass keeps full-create)."""
    cur = FakeCursor(skip_rows=[])
    patched_db(cur)

    assert upsert_supplier_with_source(_epb_rec(enrich_only=False)) == "sup-new"
    assert any("insert into public.suppliers" in s for s in _sqls(cur))


# ---------------------------------------------------------------------------
# The scraper's two passes
# ---------------------------------------------------------------------------


def test_rmg_category_ids_are_the_verified_set() -> None:
    """Live-verified against the EPB taxonomy 3 Aug 2026. Jute/fish/rice ids
    must never enter this dict — they are out of SourceBD scope."""
    assert set(RMG_CATEGORIES) == {2, 3, 8, 16, 23, 24, 30}


class _FakeDoc:
    def __init__(self, body: str) -> None:
        self._body = body
        self.ok = True
        self.error_message = None
        self.fetch_status = SimpleNamespace(value="ok")
        self.credits_used = 0

    def text(self) -> str:
        return self._body


def _stub_acquire(monkeypatch, scraper: EpbScraper, pages: list[str]) -> list[AcquireRequest]:
    requests: list[AcquireRequest] = []

    async def _acquire(request: AcquireRequest) -> Any:
        requests.append(request)
        body = pages.pop(0) if pages else json.dumps({"exporters": [], "total": 0})
        return _FakeDoc(body)

    monkeypatch.setattr(scraper, "acquire", _acquire)
    scraper._xsrf = "token"
    return requests


def test_category_pass_posts_category_filter_and_marks_enrich_only(monkeypatch) -> None:
    scraper = EpbScraper()
    requests = _stub_acquire(monkeypatch, scraper, [
        json.dumps({"exporters": [
            {"id": 4083, "name": "SARADA FASHIONS LIMITED.", "slug": "sarada-fashions",
             "epb_reg_no": "BD05918"},
            {"id": 5172, "name": "RED DOT APPARELS", "slug": "red-dot",
             "epb_reg_no": "BD06653"},
        ], "total": 2}),
    ])

    async def _collect() -> list[ScrapedRecord]:
        return [r async for r in scraper._fetch_category(2, "Knit", {}, {}, set())]

    recs = asyncio.run(_collect())

    assert [r.source_ref for r in recs] == ["4083", "5172"]
    assert all(r.enrich_only for r in recs)
    assert all("epb_associations" not in r.payload for r in recs)
    assert len(requests) == 1  # total reached after one page
    assert requests[0].json_body["category_id"] == 2
    assert requests[0].json_body["associations"] == []


def test_category_pass_skips_exporters_already_yielded(monkeypatch) -> None:
    """An exporter the association pass already yielded is not re-emitted."""
    scraper = EpbScraper()
    _stub_acquire(monkeypatch, scraper, [
        json.dumps({"exporters": [
            {"id": 4083, "name": "SARADA FASHIONS LIMITED.", "slug": "x"},
        ], "total": 1}),
    ])

    async def _collect() -> list[ScrapedRecord]:
        return [r async for r in scraper._fetch_category(2, "Knit", {}, {}, {4083})]

    assert asyncio.run(_collect()) == []


def test_association_pass_payload_unchanged(monkeypatch) -> None:
    """Regression: the original pass keeps its filter and full-create records."""
    scraper = EpbScraper()
    requests = _stub_acquire(monkeypatch, scraper, [
        json.dumps({"exporters": [
            {"id": 7, "name": "Flagged Knitwear Ltd", "slug": "x"},
        ], "total": 1}),
    ])

    async def _collect() -> list[ScrapedRecord]:
        return [r async for r in scraper._fetch_association(1, "BGMEA", {}, {}, set())]

    recs = asyncio.run(_collect())

    assert [r.source_ref for r in recs] == ["7"]
    assert recs[0].enrich_only is False
    assert recs[0].payload["epb_associations"] == ["BGMEA"]
    assert requests[0].json_body["associations"] == [1]
    assert requests[0].json_body["category_id"] == 0
