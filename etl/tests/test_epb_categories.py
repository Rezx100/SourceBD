"""EPB category-scoped enumeration + attach-only enrich mode (decision D).

EPB's register separates RMG from jute/fish/rice by CATEGORY, not by
association: of 5,939 approved exporters only 541 carry a BGMEA/BKMEA flag,
so the association-scoped `epb_web` pass never saw the unflagged RMG
majority (SARADA FASHIONS, exporter 4083, category Knit — invisible until
the 3 Aug 2026 live probe). The category pass widens coverage to them, and
the founder's policy is ATTACH-ONLY: records from that pass carry
`enrich_only=True` and can never mint a single-source EPB profile.
Default `EpbScraper()` is attach-only on both passes; `--mint` is opt-in.

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
    """Opt-in mint (`--mint` / existing_only=False) still inserts when unmatched."""
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


def _stub_acquire(
    monkeypatch,
    scraper: EpbScraper,
    pages: list[str],
    *,
    detail_html: str = "<html></html>",
) -> list[AcquireRequest]:
    requests: list[AcquireRequest] = []

    async def _acquire(request: AcquireRequest) -> Any:
        requests.append(request)
        if request.url and "/exporter/" in request.url:
            return _FakeDoc(detail_html)
        body = pages.pop(0) if pages else json.dumps({"exporters": [], "total": 0})
        return _FakeDoc(body)

    monkeypatch.setattr(scraper, "acquire", _acquire)
    scraper._xsrf = "token"
    return requests


def _search_requests(requests: list[AcquireRequest]) -> list[AcquireRequest]:
    return [r for r in requests if r.url.endswith("exporters-search")]


def _detail_requests(requests: list[AcquireRequest]) -> list[AcquireRequest]:
    return [r for r in requests if r.url and "/exporter/" in r.url]


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
    search = _search_requests(requests)
    assert len(search) == 1  # total reached after one page
    assert search[0].json_body["category_id"] == 2
    assert search[0].json_body["associations"] == []
    assert len(_detail_requests(requests)) == 0


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
    """Association pass keeps its filter and, by default, attach-only records."""
    scraper = EpbScraper()
    requests = _stub_acquire(monkeypatch, scraper, [
        json.dumps({"exporters": [
            {"id": 7, "name": "Flagged Knitwear Ltd", "slug": "x"},
        ], "total": 1}),
    ])

    async def _collect() -> list[ScrapedRecord]:
        return [r async for r in scraper._fetch_association(1, "BGMEA", {}, {}, set())]

    recs = asyncio.run(_collect())

    assert scraper.existing_only is True
    assert [r.source_ref for r in recs] == ["7"]
    assert recs[0].enrich_only is True
    assert recs[0].payload["epb_associations"] == ["BGMEA"]
    search = _search_requests(requests)
    assert search[0].json_body["associations"] == [1]
    assert search[0].json_body["category_id"] == 0
    assert len(_detail_requests(requests)) == 0


def test_association_pass_attaches_hscodes_from_detail_html(monkeypatch) -> None:
    from pathlib import Path

    html = (
        Path(__file__).resolve().parent / "fixtures" / "epb_exporter_detail.html"
    ).read_text(encoding="utf-8")
    scraper = EpbScraper(existing_only=False)
    _stub_acquire(
        monkeypatch,
        scraper,
        [
            json.dumps({"exporters": [
                {"id": 7, "name": "Flagged Knitwear Ltd", "slug": "x",
                 "epb_reg_no": "BD00007"},
            ], "total": 1}),
        ],
        detail_html=html,
    )

    async def _collect() -> list[ScrapedRecord]:
        return [r async for r in scraper._fetch_association(1, "BGMEA", {}, {}, set())]

    recs = asyncio.run(_collect())
    assert recs[0].enrich_only is False
    assert recs[0].payload["epb_hscodes"][0]["code"] == "6103"
    assert recs[0].payload["epb_hscodes"][0]["source_url"].endswith("/813")


def test_detail_html_attaches_hscodes_on_unflagged_category_record(monkeypatch) -> None:
    """Unflagged attach-only rows wait for backfill; fetch does not GET /exporter/."""
    scraper = EpbScraper()
    requests = _stub_acquire(
        monkeypatch,
        scraper,
        [
            json.dumps({"exporters": [
                {"id": 2043, "name": "Interstoff Apparels Ltd.",
                 "slug": "interstoff-apparels-ltd", "epb_reg_no": "BD04636"},
            ], "total": 1}),
        ],
    )

    async def _collect() -> list[ScrapedRecord]:
        return [r async for r in scraper._fetch_category(8, "Knit & Woven", {}, {}, set())]

    recs = asyncio.run(_collect())
    assert len(recs) == 1
    assert recs[0].enrich_only is True
    assert "epb_hscodes" not in recs[0].payload
    assert recs[0].payload["epb_reg_no"] == "BD04636"
    assert len(_detail_requests(requests)) == 0


def test_failed_detail_fetch_still_yields_search_record(monkeypatch) -> None:
    scraper = EpbScraper()
    requests: list[AcquireRequest] = []

    async def _acquire(request: AcquireRequest) -> Any:
        requests.append(request)
        if request.url and "/exporter/" in request.url:
            doc = _FakeDoc("")
            doc.ok = False
            doc.error_message = "timeout"
            doc.fetch_status = SimpleNamespace(value="error")
            return doc
        return _FakeDoc(json.dumps({"exporters": [
            {"id": 4083, "name": "SARADA FASHIONS LIMITED.", "slug": "sarada-fashions",
             "epb_reg_no": "BD05918"},
        ], "total": 1}))

    monkeypatch.setattr(scraper, "acquire", _acquire)
    scraper._xsrf = "token"

    async def _collect() -> list[ScrapedRecord]:
        return [r async for r in scraper._fetch_category(2, "Knit", {}, {}, set())]

    recs = asyncio.run(_collect())
    assert [r.source_ref for r in recs] == ["4083"]
    assert recs[0].enrich_only is True
    assert "epb_hscodes" not in recs[0].payload
    assert recs[0].payload["epb_reg_no"] == "BD05918"
    assert not any(r.url and "/exporter/" in r.url for r in requests)


def test_default_epb_scraper_is_attach_only() -> None:
    assert EpbScraper().existing_only is True
    assert EpbScraper(existing_only=False).existing_only is False


def test_existing_only_marks_association_pass_enrich_only(monkeypatch) -> None:
    scraper = EpbScraper(existing_only=True)
    _stub_acquire(monkeypatch, scraper, [
        json.dumps({"exporters": [
            {"id": 7, "name": "Flagged Knitwear Ltd", "slug": "x"},
        ], "total": 1}),
    ])

    async def _collect() -> list[ScrapedRecord]:
        return [r async for r in scraper._fetch_association(1, "BGMEA", {}, {}, set())]

    recs = asyncio.run(_collect())
    assert recs[0].enrich_only is True
    assert recs[0].payload["epb_associations"] == ["BGMEA"]


def test_mint_association_pass_may_create(monkeypatch) -> None:
    scraper = EpbScraper(existing_only=False)
    _stub_acquire(monkeypatch, scraper, [
        json.dumps({"exporters": [
            {"id": 7, "name": "Flagged Knitwear Ltd", "slug": "x"},
        ], "total": 1}),
    ])

    async def _collect() -> list[ScrapedRecord]:
        return [r async for r in scraper._fetch_association(1, "BGMEA", {}, {}, set())]

    recs = asyncio.run(_collect())
    assert recs[0].enrich_only is False


def test_fetch_runs_category_pass_as_well_as_association(monkeypatch) -> None:
    scraper = EpbScraper()
    requests = _stub_acquire(monkeypatch, scraper, [])

    async def _boot() -> tuple[dict, dict, dict]:
        return {}, {}, {}

    monkeypatch.setattr(scraper, "_bootstrap", _boot)

    async def _collect() -> list[ScrapedRecord]:
        return [r async for r in scraper.fetch()]

    assert asyncio.run(_collect()) == []
    search = _search_requests(requests)
    assoc_filters = [r.json_body["associations"] for r in search]
    cat_filters = [r.json_body["category_id"] for r in search]
    assert [1] in assoc_filters
    assert [2] in assoc_filters
    assert set(RMG_CATEGORIES).issubset(set(cat_filters))
