"""BKMEA member directory scraper. Spec §3.

The site (https://member.bkmea.com/member-home) renders an HTML table:
  Sl | Membership No | Company | Member Type | Category | Owner | [View Details link → /member/details/{id}]

The detail page (later enrichment pass) gives factory address, contact, etc.
For Phase 0 we capture the listing (~2k+ rows) and use the membership number
as the natural source_ref.

Transport: Firecrawl. ``only_main_content`` stays False (the directory table is
outside ``<main>``). The browser headers below are still sent because BKMEA drops
non-browser User-Agents outright; the Playwright fallback that used to exist for
that reason is now redundant and has been removed.
"""
from __future__ import annotations

import re
from typing import Any, AsyncIterator
from urllib.parse import urlencode

from bs4 import BeautifulSoup

from etl.acquire import AcquiredDoc, AcquireRequest
from etl.core.acquiring import AcquiringScraper
from etl.core.scraper import EvidenceAttachment, ScrapedRecord

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


_FIELD_LOCATORS = {
    "bkmea_reg_number": "table.table tbody tr td:nth-child(2)",
    "bkmea_membership_no": "table.table tbody tr td:nth-child(2)",
    "bkmea_member_type": "table.table tbody tr td:nth-child(4)",
    "bkmea_category": "table.table tbody tr td:nth-child(5)",
    "bkmea_detail_url": "table.table tbody tr td:last-child a[href]",
}
# Parsed out of the membership number by us, not printed as separate fields.
_UNCITABLE_FIELDS = ("bkmea_detail_id", "bkmea_membership_year")

# Fields the member's detail page also asserts. When the member HAS a detail
# page, that page is the canonical citation for them (founder rule, 3 Aug
# 2026: one canonical citation per provider — a list-vs-page disagreement must
# never become a review item). The list still stores the values in fields for
# the pre-fetch gate and the rekey; it just stops claiming them. Members
# without a detail page keep their list citations — the list is all they have.
_DETAIL_OWNED_FIELDS = ("bkmea_membership_no", "bkmea_reg_number", "bkmea_category")


class BkmeaScraper(AcquiringScraper):
    code = "bkmea_web"
    source_code = "BKMEA"
    transport = "firecrawl"
    fallback_transport = "direct"
    monitor_urls = (LIST_URL,)
    request_headers = _BROWSER_HEADERS
    rps = 0.5

    def _list_url(self, page: int) -> str:
        return f"{LIST_URL}?{urlencode({'page': page})}"

    async def fetch(self) -> AsyncIterator[ScrapedRecord]:
        seen_keys: set[str] = set()
        page = 1
        empty_streak = 0
        while empty_streak < 2 and page <= 10:
            doc = await self.acquire(
                AcquireRequest(
                    url=self._list_url(page),
                    only_main_content=False,
                    label=f"member-home p{page}",
                )
            )
            if not doc.ok:
                self.log.warning(
                    "bkmea.fetch_failed",
                    page=page,
                    status=doc.fetch_status.value,
                    error=doc.error_message,
                )
                if doc.transient_failure:
                    raise RuntimeError(
                        f"bkmea_web: list page {page} unreadable "
                        f"({doc.fetch_status.value}). Aborting rather than "
                        "reporting a partial directory as complete."
                    )
                break
            rows = self._parse_table(doc.text())
            fresh = [r for r in rows if r["key"] not in seen_keys]
            if not fresh:
                empty_streak += 1
                self.log.info("bkmea.empty_page", page=page, raw_rows=len(rows))
            else:
                empty_streak = 0
                self.log.info(
                    "bkmea.page", page=page, rows=len(rows), fresh=len(fresh),
                    transport=self.active_transport,
                )
                for row in fresh:
                    seen_keys.add(row["key"])
                    yield self._to_record(row, doc)
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
            href = link_el["href"].strip() if link_el else None
            m = _DETAIL_ID_RE.search(href) if href else None
            detail_id = m.group(1) if m else None
            # Rebuilt from the id rather than stored as found. A member with no
            # detail page carries `<a href="">`, which Firecrawl returns already
            # resolved to the listing page, so keeping the href would hand every
            # such member a "detail link" pointing back at the directory. Deriving
            # it also settles relative-against-absolute hrefs, which the two
            # transports render differently, on a single spelling. epb_web and
            # bgapmea_web build their detail URLs from the id for the same reason.
            detail_url = DETAIL_URL.format(id=detail_id) if detail_id else None

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

    def _to_record(self, c: dict[str, Any], doc: AcquiredDoc | None = None) -> ScrapedRecord:
        # Membership integer as source_ref — stable across years AND across
        # BKMEA's re-listings. BKMEA re-lists members on new detail-page ids
        # carrying the same membership number, so preferring detail_id (the old
        # code, despite this comment) minted a new source_records row per
        # re-listing — the REZ-34 Phase D re-listing treadmill. detail_id is
        # only the fallback for a row whose membership number did not parse.
        ref = c["membership_int"] or c["detail_id"] or c["membership_no"]
        skip = _UNCITABLE_FIELDS
        if c["detail_id"]:
            skip = skip + _DETAIL_OWNED_FIELDS
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
            evidence=(
                EvidenceAttachment(
                    doc=doc,
                    locators=_FIELD_LOCATORS,
                    default_locator="member directory table row",
                    skip_keys=skip,
                )
                if doc is not None and doc.ok
                else None
            ),
        )

