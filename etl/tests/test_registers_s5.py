"""ETL freshness S5 + C3: monthly register reads, the list-row gate on BGMEA,
monitor → re-read, and the weekly place-spelling list."""
from __future__ import annotations

import asyncio
from typing import Any

from etl.jobs import place_variants as pv
from etl.scrapers import bgmea_web


def test_registers_read_directly():
    from etl.scrapers.bgapmea_web import BgapmeaScraper

    for cls in (bgmea_web.BgmeaWebScraper, BgapmeaScraper):
        assert cls.transport == "direct" and cls.fallback_transport is None


def test_bgmea_reads_a_detail_page_only_for_a_changed_row(monkeypatch):
    rows = [
        {"member_id": "17", "company_name": "A One Dress Makers Ltd.", "bgmea_reg_number": "4179",
         "contact_person": "X", "email": "a@b.c"},
        {"member_id": "18", "company_name": "New Co", "bgmea_reg_number": "9999",
         "contact_person": "Y", "email": None},
    ]
    stored = {"general:4179"}
    fetched: list[str] = []

    def fake_unchanged(*, source_code, source_ref, company_name, key, list_hash, still_good=None):
        from etl.core.scraper import ScrapedRecord

        if source_ref in stored:
            return ScrapedRecord(source_code="BGMEA", source_ref=source_ref,
                                 company_name=company_name, payload={}, known_hash="H")
        return None

    monkeypatch.setattr(bgmea_web, "unchanged_record", fake_unchanged)
    s = bgmea_web.BgmeaWebScraper(max_pages=1)
    monkeypatch.setattr(s, "_parse_list", lambda html: rows)
    monkeypatch.setattr(s, "_parse_detail", lambda html: {})

    class Doc:
        ok = True
        url = final_url = "https://www.bgmea.com.bd/member/18"
        fetch_status = None
        transient_failure = False

        def text(self):
            return ""

    async def fake_acquire(req):
        fetched.append(req.url)
        return Doc()

    monkeypatch.setattr(s, "acquire", fake_acquire)
    monkeypatch.setattr(s, "_evidence_for", lambda *a: None)

    async def drain():
        return [r async for r in s.fetch()]

    recs = asyncio.run(drain())
    assert [r.source_ref for r in recs] == ["general:4179", "general:9999"]
    assert recs[0].hash() == "H", "the unchanged row is the stored record"
    details = [u for u in fetched if "/member/" in u and "member-list" not in u]
    assert details == [bgmea_web.DETAIL_URL.format(mid="18")]
    assert recs[1].payload["bgmea_list_hash"]


def test_a_changed_list_page_queues_one_reread_a_day():
    from etl.evidence.webhook_inbox import _enqueue_reread

    class Cur:
        def __init__(self, row):
            self.row, self.sql = row, ""

        def execute(self, sql, params=None):
            self.sql, self.params = sql, params

        def fetchone(self):
            return self.row

    cur = Cur({"id": "j"})
    assert _enqueue_reread(cur, "bgmea_web") is True
    assert "interval '24 hours'" in cur.sql and cur.params == ("bgmea_web", "bgmea_web")
    assert _enqueue_reread(Cur(None), "bgmea_web") is False


def test_place_variants_pairs_spellings_on_one_plot():
    pairs = pv.variant_pairs([
        ("kainzanul", ["Plot # 12, Konabari, Gazipur", "PLOT NO-12, Konabari, Gajipur"]),
        ("other", ["Plot 7, Kashimpur, Gazipur", "Plot 7, Kashimpur, Gajipur"]),
        ("far-apart", ["Plot 1, Mirpur, Dhaka", "Plot 2, Mirpur, Dhakka"]),  # no shared plot
        ("sreepur", ["Plot 3, Sreepur, Gazipur", "Plot 3, Sripur, Gazipur"]),  # founder: different
    ])
    assert [(p.a, p.b, p.companies) for p in pairs] == [("gajipur", "gazipur", 2)]
    lines = pv.digest_lines(pairs)
    assert "gajipur ↔ gazipur — 2 companies" in lines[1]
    assert pv.digest_lines([]) == ["Place spellings: no new likely variants this week."]
