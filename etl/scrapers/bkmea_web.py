"""BKMEA member directory scraper. Spec §3.

The site (https://member.bkmea.com/member-home) renders an HTML table:
  Sl | Membership No | Company | Member Type | Category | Owner | [View Details link → /member/details/{id}]

The detail page (later enrichment pass) gives factory address, contact, etc.
For Phase 0 we capture the listing (~2k+ rows) and use the membership number
as the natural source_ref.
"""
from __future__ import annotations

import re
from typing import Any, AsyncIterator

from bs4 import BeautifulSoup

from etl.core.config import settings
from etl.core.http import HttpClient
from etl.core.scraper import BaseScraper, ScrapedRecord

BASE = "https://member.bkmea.com"
LIST_URL = f"{BASE}/member-home"
DETAIL_URL = f"{BASE}/member/details/{{id}}"

# BKMEA aggressively drops requests with non-browser User-Agents. Use a real one.
_BROWSER_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) "
                  "Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": f"{BASE}/member-home",
    "Cache-Control": "no-cache",
}

# Membership format: "2632 - C/2026" — the leading integer is the unique factory id.
_MEMNO_RE = re.compile(r"^\s*(\d+)\s*-\s*([A-Z]+)\s*/\s*(\d{4})\s*$")
_DETAIL_ID_RE = re.compile(r"/member/details/(\d+)")


class BkmeaScraper(BaseScraper):
    code = "bkmea_web"
    source_code = "BKMEA"

    async def fetch(self) -> AsyncIterator[ScrapedRecord]:
        async with HttpClient(rps=0.5, headers=_BROWSER_HEADERS) as http:
            seen_keys: set[str] = set()
            page = 1
            empty_streak = 0
            while empty_streak < 2 and page <= 10:
                try:
                    resp = await http.get(LIST_URL, params={"page": page})
                except Exception as e:  # noqa: BLE001
                    self.log.warning("bkmea.fetch_failed", page=page, error=str(e))
                    break
                rows = self._parse_table(resp.text)
                fresh = [r for r in rows if r["key"] not in seen_keys]
                if not fresh:
                    empty_streak += 1
                    self.log.info("bkmea.empty_page", page=page, raw_rows=len(rows))
                else:
                    empty_streak = 0
                    self.log.info("bkmea.page", page=page, rows=len(rows), fresh=len(fresh))
                    for row in fresh:
                        seen_keys.add(row["key"])
                        yield self._to_record(row)
                page += 1

    # ------------------------------------------------------------------
    def _parse_table(self, html: str) -> list[dict[str, Any]]:
        soup = BeautifulSoup(html, "lxml")
        out: list[dict[str, Any]] = []
        for tr in soup.select("table.table tbody tr"):
            tds = tr.find_all("td")
            if len(tds) < 6:
                continue
            mem_no = tds[1].get_text(strip=True)
            company = tds[2].get_text(" ", strip=True)
            mem_type = tds[3].get_text(strip=True) if len(tds) > 3 else None
            category = tds[4].get_text(strip=True) if len(tds) > 4 else None
            owner = tds[5].get_text(" ", strip=True) if len(tds) > 5 else None
            link_el = tds[-1].find("a", href=True) if len(tds) > 6 else None
            detail_url = link_el["href"].strip() if link_el else None
            detail_id = None
            if detail_url:
                m = _DETAIL_ID_RE.search(detail_url)
                if m:
                    detail_id = m.group(1)

            mn = _MEMNO_RE.match(mem_no)
            mem_int = mn.group(1) if mn else None
            mem_cat = mn.group(2) if mn else None
            mem_year = mn.group(3) if mn else None

            # Stable key: prefer the detail page id (truly unique), fall back to membership no.
            key = detail_id or mem_no or company
            if not company or not key:
                continue

            out.append({
                "key": key,
                "company": company,
                "membership_no": mem_no,
                "membership_int": mem_int,
                "membership_category": mem_cat,
                "membership_year": mem_year,
                "member_type": mem_type or None,
                "category": category or None,
                "owner": owner or None,
                "detail_url": detail_url,
                "detail_id": detail_id,
            })
        return out

    def _to_record(self, c: dict[str, Any]) -> ScrapedRecord:
        # Use membership integer as source_ref — stable across years.
        ref = c["detail_id"] or c["membership_int"] or c["membership_no"]
        return ScrapedRecord(
            source_code=self.source_code,
            source_ref=str(ref),
            company_name=c["company"],
            contact_name=c.get("owner"),
            payload={
                "bkmea_reg_number": c["membership_no"],
                "bkmea_membership_no": c["membership_no"],
                "bkmea_member_type": c["member_type"],
                "bkmea_category": c["category"],
                "bkmea_detail_url": c["detail_url"],
                "bkmea_detail_id": c["detail_id"],
                "bkmea_membership_year": c["membership_year"],
            },
        )

    # ------------------------------------------------------------------
    # Optional Playwright fallback retained for future detail-page enrichment.
    async def fetch_playwright(self) -> list[dict[str, Any]]:
        from playwright.async_api import async_playwright  # lazy

        captured: list[dict[str, Any]] = []
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=settings.etl_playwright_headless)
            ctx = await browser.new_context(user_agent=settings.etl_user_agent)
            page = await ctx.new_page()
            await page.goto(LIST_URL, wait_until="networkidle", timeout=90_000)
            html = await page.content()
            await browser.close()
        return self._parse_table(html)

