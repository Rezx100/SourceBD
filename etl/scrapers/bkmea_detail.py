"""BKMEA per-member detail enrichment.

Reads existing suppliers (created by `bkmea_web`) that have a
`bkmea_detail_id` in their source_records, fetches the detail page
(https://member.bkmea.com/member/details/{id}) and emits enriched
ScrapedRecords with factory address, owner name/email/phone, employee
counts, machine counts, production capacity.

The upsert pipeline COALESCES non-null values, so re-running is safe.

Transport: Firecrawl, batched — these are thousands of independent detail pages
with one option set, which is exactly what ``/v2/batch/scrape`` is for.
"""
from __future__ import annotations

import re
from typing import Any, AsyncIterator, Iterable

from bs4 import BeautifulSoup, Tag

from etl.acquire import AcquiredDoc, AcquireRequest
from etl.core.acquiring import AcquiringScraper
from etl.core.db import db
from etl.core.scraper import EvidenceAttachment, ScrapedRecord

BASE = "https://member.bkmea.com"
DETAIL_URL = f"{BASE}/member/details/{{id}}"

_BROWSER_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) "
                  "Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": f"{BASE}/member-home",
    "Cache-Control": "no-cache",
}

_DISTRICT_HINTS = (
    "DHAKA", "CHATTOGRAM", "CHITTAGONG", "NARAYANGANJ", "GAZIPUR",
    "ASHULIA", "SAVAR", "TONGI", "MANIKGANJ", "MYMENSINGH", "SYLHET",
    "RANGPUR", "RAJSHAHI", "KHULNA", "BARISAL", "COMILLA", "CUMILLA",
)


_SECTION_LOCATORS = {
    "bkmea_reg_number": "div.tbrow table.table (BKMEA Membership No.)",
    "bkmea_membership_no": "div.tbrow table.table (BKMEA Membership No.)",
    "bkmea_membership_category": "div.tbrow table.table (Membership Category)",
    "bkmea_factory_address": "div.tbrow table.table (Factory Adress)",
    "bkmea_mailing_address": "div.tbrow table.table (Mailing Address)",
    "bkmea_owner_name": "div.tbrow table.table (Owner Details / Owner Name)",
    "bkmea_owner_email": "div.tbrow table.table (Owner Details / Email Address)",
    "bkmea_owner_mobile": "div.tbrow table.table (Owner Details / Mobile No.)",
    "bkmea_rep_name": "div.tbrow table.table (Representative Details / Name)",
    "bkmea_rep_email": "div.tbrow table.table (Representative Details / Email Address)",
    "bkmea_rep_mobile": "div.tbrow table.table (Representative Details / Mobile No.)",
    "bkmea_employees_male": "div.tbrow table.table (Number of Employees / Male)",
    "bkmea_employees_female": "div.tbrow table.table (Number of Employees / Female)",
    "bkmea_employees_others": "div.tbrow table.table (Number of Employees / Others)",
    "bkmea_employees_total": "div.tbrow table.table (Number of Employees / Total)",
    "bkmea_machines_sewing": "div.tbrow table.table (Number of Machine / SEWING)",
    "bkmea_machines_knitting": "div.tbrow table.table (Number of Machine / Knitting)",
    "bkmea_machines_dyeing": "div.tbrow table.table (Number of Machine / Dyeing)",
    "bkmea_production_capacity": "div.tbrow table.table (Production Capacity)",
    "bkmea_products": "div.tbrow table.table (Products)",
}
# `bkmea_raw_kv` is the whole scrape dumped for debugging; `detail_id`/`detail_url`
# are our own plumbing. None of them are claims about the supplier.
_UNCITABLE_FIELDS = ("bkmea_raw_kv", "bkmea_detail_id", "bkmea_detail_url")

# How many detail pages to submit per Firecrawl batch job.
_BATCH_SIZE = 50


class BkmeaDetailScraper(AcquiringScraper):
    code = "bkmea_detail"
    source_code = "BKMEA"
    transport = "firecrawl"
    fallback_transport = "direct"
    # Detail pages are per-supplier and far too numerous to monitor; the list
    # page is monitored by `bkmea_web`, and a restructure there is what would
    # break these too.
    monitor_urls = ()
    request_headers = _BROWSER_HEADERS
    rps = 0.5

    async def fetch(self) -> AsyncIterator[ScrapedRecord]:
        targets = list(self._load_targets())
        self.log.info(
            "bkmea_detail.targets", count=len(targets), transport=self.active_transport
        )
        by_url = {
            DETAIL_URL.format(id=detail_id): (detail_id, ref, name)
            for detail_id, ref, name in targets
        }
        done = 0

        for start in range(0, len(targets), _BATCH_SIZE):
            chunk = targets[start : start + _BATCH_SIZE]
            requests = [
                AcquireRequest(
                    url=DETAIL_URL.format(id=detail_id),
                    only_main_content=False,
                    label=f"member {detail_id}",
                )
                for detail_id, _ref, _name in chunk
            ]
            async for doc in self.acquire_many(requests):
                done += 1
                target = by_url.get(doc.url)
                if target is None:
                    continue
                detail_id, ref, name = target
                if not doc.ok:
                    self.log.warning(
                        "bkmea_detail.fetch_failed",
                        detail_id=detail_id,
                        ref=ref,
                        status=doc.fetch_status.value,
                        error=doc.error_message,
                    )
                    continue
                rec = self._parse_detail(
                    doc.text(), ref=ref, fallback_name=name,
                    detail_id=detail_id, url=doc.citable_url, doc=doc,
                )
                if rec is None:
                    self.log.warning(
                        "bkmea_detail.parse_empty", detail_id=detail_id, ref=ref
                    )
                    continue
                if done % 25 == 0:
                    self.log.info(
                        "bkmea_detail.progress", done=done, total=len(targets)
                    )
                yield rec

    # ------------------------------------------------------------------
    def _load_targets(self) -> Iterable[tuple[str, str, str]]:
        """Return list of (detail_id, source_ref, company_name) to enrich.

        Only picks suppliers that still need enrichment (missing email AND
        missing address_raw) to keep re-runs cheap.
        """
        sql = """
            select sr.source_ref,
                   s.company_name,
                   sr.fields ->> 'bkmea_detail_id' as detail_id
              from public.source_records sr
              join public.suppliers s on s.id = sr.supplier_id
              join public.sources src on src.id = sr.source_id
             where src.code = 'BKMEA'
               and sr.fields ? 'bkmea_detail_id'
               and (s.email_primary is null or s.address_raw is null)
             order by sr.source_ref desc
        """
        with db.conn() as c, c.cursor() as cur:
            cur.execute(sql)
            for row in cur.fetchall():
                did = row.get("detail_id")
                if not did:
                    continue
                yield (str(did), str(row["source_ref"]), str(row["company_name"]))

    # ------------------------------------------------------------------
    def _parse_detail(self, html: str, *, ref: str, fallback_name: str,
                      detail_id: str, url: str,
                      doc: AcquiredDoc | None = None) -> ScrapedRecord | None:
        soup = BeautifulSoup(html, "lxml")
        kv = self._extract_kv(soup)
        if not kv:
            return None

        name = kv.get("Factory Name") or fallback_name
        address = kv.get("Factory Adress") or kv.get("Factory Address") \
                  or kv.get("Mailing Address")
        owner_name = kv.get("Owner Details / Owner Name") or kv.get("Representative Details / Name")
        owner_email = kv.get("Owner Details / Email Address") \
                      or kv.get("Representative Details / Email Address")
        owner_phone = kv.get("Owner Details / Mobile No.") \
                      or kv.get("Representative Details / Mobile No.")

        district = self._guess_district(address)

        payload: dict[str, Any] = {
            "bkmea_reg_number": kv.get("BKMEA Membership No."),
            "bkmea_membership_no": kv.get("BKMEA Membership No."),
            "bkmea_membership_category": kv.get("Membership Category"),
            "bkmea_factory_address": kv.get("Factory Adress") or kv.get("Factory Address"),
            "bkmea_mailing_address": kv.get("Mailing Address"),
            "bkmea_owner_name": kv.get("Owner Details / Owner Name"),
            "bkmea_owner_email": kv.get("Owner Details / Email Address"),
            "bkmea_owner_mobile": kv.get("Owner Details / Mobile No."),
            "bkmea_rep_name": kv.get("Representative Details / Name"),
            "bkmea_rep_email": kv.get("Representative Details / Email Address"),
            "bkmea_rep_mobile": kv.get("Representative Details / Mobile No."),
            "bkmea_employees_male": _to_int(kv.get("Number of Employees / Male")),
            "bkmea_employees_female": _to_int(kv.get("Number of Employees / Female")),
            "bkmea_employees_others": _to_int(kv.get("Number of Employees / Others")),
            "bkmea_employees_total": _to_int(kv.get("Number of Employees / Total")),
            "bkmea_machines_sewing": _to_int(kv.get("Number of Machine / SEWING")),
            "bkmea_machines_knitting": _to_int(kv.get("Number of Machine / Knitting")),
            "bkmea_machines_dyeing": _to_int(kv.get("Number of Machine / Dyeing")),
            "bkmea_production_capacity": _to_int(kv.get("Production Capacity")),
            "bkmea_products": kv.get("Products"),
            "bkmea_detail_id": detail_id,
            "bkmea_detail_url": url,
            "bkmea_raw_kv": kv,
        }
        # strip None
        payload = {k: v for k, v in payload.items() if v not in (None, "")}

        return ScrapedRecord(
            source_code=self.source_code,
            source_ref=ref,
            company_name=name,
            contact_name=owner_name,
            contact_role="Owner" if owner_name else None,
            email=_clean_email(owner_email),
            phone_raw=owner_phone,
            address_raw=address,
            district=district,
            payload=payload,
            evidence=(
                EvidenceAttachment(
                    doc=doc,
                    locators=_SECTION_LOCATORS,
                    default_locator="member detail table",
                    skip_keys=_UNCITABLE_FIELDS,
                )
                if doc is not None and doc.ok
                else None
            ),
        )

    # ------------------------------------------------------------------
    def _extract_kv(self, soup: BeautifulSoup) -> dict[str, str]:
        """Walk the detail table. Handles two row shapes:

          (a) <tr><td>Label</td><td></td><td>Value</td></tr>     # 3-col
          (b) <tr><td rowspan=N>Section</td>...</tr>             # section header
              <tr><td>Sub-label</td><td>Value</td></tr>          # 2-col under section

        We flatten (b) into "Section / Sub-label" keys.
        """
        out: dict[str, str] = {}
        table = soup.select_one("div.tbrow table.table tbody")
        if table is None:
            return out

        current_section: str | None = None
        for tr in table.find_all("tr", recursive=False):
            tds = [td for td in tr.find_all("td", recursive=False) if isinstance(td, Tag)]
            if not tds:
                continue

            # Section header row: single td with rowspan, no value.
            if len(tds) == 1 and tds[0].has_attr("rowspan"):
                current_section = _txt(tds[0])
                continue

            # 3-col row: label, blank, value (may also have rowspan label as first td).
            if len(tds) == 3:
                label = _txt(tds[0])
                value = _txt(tds[2])
                if label:
                    out[label] = value
                # Reset section context — these 3-col rows are top-level fields.
                if not tds[0].has_attr("rowspan"):
                    current_section = None
                continue

            # 2-col row inside a sectioned block.
            if len(tds) == 2 and current_section:
                sub = _txt(tds[0])
                val = _txt(tds[1])
                if sub:
                    out[f"{current_section} / {sub}"] = val
                continue

            # Mixed: first td has rowspan (starts new section AND has sub-row data)
            if len(tds) >= 2 and tds[0].has_attr("rowspan"):
                current_section = _txt(tds[0])
                # subsequent cells in same row sometimes carry first sub-pair
                if len(tds) >= 3:
                    sub = _txt(tds[1])
                    val = _txt(tds[2])
                    if sub:
                        out[f"{current_section} / {sub}"] = val
        return out

    # ------------------------------------------------------------------
    def _guess_district(self, address: str | None) -> str | None:
        if not address:
            return None
        up = address.upper()
        for hint in _DISTRICT_HINTS:
            if hint in up:
                # Normalise "CHITTAGONG" → "CHATTOGRAM" (modern spelling).
                return "CHATTOGRAM" if hint == "CHITTAGONG" else hint.title()
        return None


# ---------------------------------------------------------------------------
def _txt(td: Tag) -> str:
    return re.sub(r"\s+", " ", td.get_text(" ", strip=True)).strip()


def _to_int(v: str | None) -> int | None:
    if v is None:
        return None
    digits = re.sub(r"[^\d]", "", v)
    return int(digits) if digits else None


def _clean_email(v: str | None) -> str | None:
    if not v:
        return None
    v = v.strip().lower()
    return v if "@" in v and "." in v else None
