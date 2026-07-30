"""BGAPMEA member directory scraper.

Source: Bangladesh Garment Accessories & Packaging Manufacturers & Exporters
Association (https://www.bgapmea.org/index.php/member). Tier 2 industry register.

Strategy
--------
1. Walk listing pages /member/index/{offset} (15 rows/page) to collect every
   detail-page id from links of the form /member/member_details/{id}.
2. For each id, fetch the detail page and parse the labelled lines:
     - Membership: <number>, status (Active/Inactive)
     - Owner Name + role
     - Company Address (head office)
     - Factory Address
     - Phone / Fax / Email / Website / Products

The detail page is server-rendered HTML, no JavaScript required.

Transport: Firecrawl. Detail pages are batched; the listing walk stays
sequential because each page's content decides whether to request the next.
"""
from __future__ import annotations

import re
from typing import Any, AsyncIterator

from bs4 import BeautifulSoup

from etl.acquire import AcquiredDoc, AcquireRequest
from etl.core.acquiring import AcquiringScraper
from etl.core.scraper import EvidenceAttachment, ScrapedRecord

BASE = "https://www.bgapmea.org/index.php"
LIST_URL = f"{BASE}/member"
LIST_PAGE_URL = f"{BASE}/member/index/{{offset}}"
DETAIL_URL = f"{BASE}/member/member_details/{{id}}"

_BROWSER_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) "
                  "Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": LIST_URL,
}

_DETAIL_ID_RE = re.compile(r"/member/member_details/(\d+)")
_TOTAL_RE = re.compile(r"Showing\s+\d+\s+of\s+(\d+)\s+Total", re.I)
_MEMBERSHIP_RE = re.compile(r"Membership:\s*([A-Za-z0-9\-\/]+)", re.I)
_STATUS_RE = re.compile(r"Member\s+Status\s*:\s*([A-Za-z]+)", re.I)

_DISTRICT_HINTS = (
    "DHAKA", "CHATTOGRAM", "CHITTAGONG", "NARAYANGANJ", "NARAYANGONJ", "GAZIPUR",
    "ASHULIA", "SAVAR", "TONGI", "MANIKGANJ", "MYMENSINGH", "SYLHET",
    "RANGPUR", "RAJSHAHI", "KHULNA", "BARISAL", "COMILLA", "CUMILLA",
    "JASHORE", "JESSORE", "KISHOREGANJ", "TANGAIL", "NARSHINGDI", "NARSINGDI",
)


_FIELD_LOCATORS = {
    "bgapmea_membership_no": "detail heading '… [ Membership: <no> ]'",
    "bgapmea_member_status": "detail heading '… Member Status : <status>'",
    "bgapmea_company_address": "detail heading 'Company Address : …'",
    "bgapmea_factory_address": "detail heading 'Factory Address : …'",
    "bgapmea_owner_name": "detail owner heading '<name>, <role>'",
    "bgapmea_owner_role": "detail owner heading '<name>, <role>'",
    "bgapmea_phone": "detail heading 'Phone : …'",
    "bgapmea_fax": "detail heading 'Fax : …'",
    "bgapmea_email_raw": "detail heading 'Email : …'",
    "bgapmea_website_raw": "detail heading 'Website : …'",
    "bgapmea_products": "detail heading 'Products : …'",
}
_UNCITABLE_FIELDS = ("bgapmea_member_id", "bgapmea_detail_url")

_BATCH_SIZE = 50


class BgapmeaScraper(AcquiringScraper):
    code = "bgapmea_web"
    source_code = "BGAPMEA"
    transport = "firecrawl"
    fallback_transport = "direct"
    monitor_urls = (LIST_URL,)
    request_headers = _BROWSER_HEADERS
    rps = 1.0

    async def fetch(self) -> AsyncIterator[ScrapedRecord]:
        ids = await self._collect_detail_ids()
        self.log.info(
            "bgapmea.detail_ids_collected",
            count=len(ids),
            transport=self.active_transport,
        )

        done = 0
        for start in range(0, len(ids), _BATCH_SIZE):
            chunk = ids[start : start + _BATCH_SIZE]
            requests = [
                AcquireRequest(
                    url=DETAIL_URL.format(id=did),
                    only_main_content=False,
                    label=f"member {did}",
                )
                for did in chunk
            ]
            id_by_url = {DETAIL_URL.format(id=did): did for did in chunk}

            async for doc in self.acquire_many(requests):
                done += 1
                did = id_by_url.get(doc.url)
                if did is None:
                    continue
                if not doc.ok:
                    self.log.warning(
                        "bgapmea.detail_skip",
                        id=did,
                        status=doc.fetch_status.value,
                        http_status=doc.http_status,
                    )
                    continue

                rec = self._parse_detail(
                    doc.text(), detail_id=did, url=doc.citable_url, doc=doc
                )
                if rec is None:
                    self.log.warning("bgapmea.parse_empty", id=did)
                    continue
                if done % 50 == 0:
                    self.log.info("bgapmea.progress", done=done, total=len(ids))
                yield rec

    # ------------------------------------------------------------------
    async def _collect_detail_ids(self) -> list[str]:
        """Walk paginated listing and collect unique detail ids in order seen."""
        seen: dict[str, None] = {}
        offset = 0
        page_size = 15
        total: int | None = None
        empty_streak = 0

        while True:
            url = LIST_URL if offset == 0 else LIST_PAGE_URL.format(offset=offset)
            doc = await self.acquire(
                AcquireRequest(
                    url=url, only_main_content=False, label=f"member list @{offset}"
                )
            )
            if not doc.ok:
                self.log.warning(
                    "bgapmea.list_failed",
                    offset=offset,
                    status=doc.fetch_status.value,
                    error=doc.error_message,
                )
                if doc.transient_failure and not seen:
                    raise RuntimeError(
                        "bgapmea_web: first listing page unreadable "
                        f"({doc.fetch_status.value}). Aborting rather than "
                        "reporting an empty register as a successful run."
                    )
                break

            html = doc.text()
            ids = _DETAIL_ID_RE.findall(html)
            fresh = [i for i in ids if i not in seen]

            if total is None:
                m = _TOTAL_RE.search(html)
                if m:
                    total = int(m.group(1))
                    self.log.info("bgapmea.list_total", total=total)

            if not fresh:
                empty_streak += 1
                self.log.info("bgapmea.list_empty_page", offset=offset)
                if empty_streak >= 2:
                    break
            else:
                empty_streak = 0
                for i in fresh:
                    seen[i] = None
                self.log.info("bgapmea.list_page", offset=offset,
                              fresh=len(fresh), total_seen=len(seen))

            # Stop early once we've collected the announced total.
            if total is not None and len(seen) >= total:
                break
            # Hard safety cap to avoid runaway loops.
            if offset > 5000:
                self.log.warning("bgapmea.list_cap_hit", offset=offset)
                break
            offset += page_size

        return list(seen.keys())

    # ------------------------------------------------------------------
    def _parse_detail(
        self,
        html: str,
        *,
        detail_id: str,
        url: str,
        doc: AcquiredDoc | None = None,
    ) -> ScrapedRecord | None:
        soup = BeautifulSoup(html, "lxml")
        # Detail block is rendered as a series of <h2> headings inside the page body.
        # Convert the whole content area to plain lines and parse label : value pairs.
        # Structure discovered via recon:
        #   "<Company Name> [ Membership: <no> ] Member Status : <Active|...>"
        #   "<Owner Name>, <Role>"
        #   "Company Address : ..."
        #   "Factory Address : ..."
        #   "Phone : ..."  "Fax : ..."  "Email : ..."  "Website : ..."  "Products : ..."
        # Each field is in its own heading (h2/h3); a wrapping <td> on the
        # page concatenates the breadcrumb plus every heading into one giant
        # blob, so we deliberately ignore td/p/li to avoid that noise.
        text_lines = [
            re.sub(r"\s+", " ", el.get_text(" ", strip=True))
            for el in soup.find_all(["h1", "h2", "h3", "h4"])
        ]
        text_lines = [ln for ln in text_lines if ln]

        company: str | None = None
        membership: str | None = None
        status: str | None = None
        owner_line: str | None = None
        company_addr: str | None = None
        factory_addr: str | None = None
        phone: str | None = None
        fax: str | None = None
        email: str | None = None
        website: str | None = None
        products: str | None = None

        for ln in text_lines:
            low = ln.lower()
            if company is None and "membership:" in low and "member status" in low:
                # First line: "<Company> [ Membership: 1098 ] Member Status : Active"
                m_mem = _MEMBERSHIP_RE.search(ln)
                m_st = _STATUS_RE.search(ln)
                if m_mem:
                    membership = m_mem.group(1).strip()
                if m_st:
                    status = m_st.group(1).strip()
                company = re.split(r"\[\s*Membership", ln, maxsplit=1)[0].strip(" .-:")
                if not company:
                    company = None
                continue
            if owner_line is None and company and "," in ln \
                    and "address" not in low and "phone" not in low \
                    and "email" not in low and ":" not in ln \
                    and len(ln) < 160:
                # Owner line follows the heading. Heuristic: short line, contains a
                # role separated by comma, no labels.
                owner_line = ln
                continue
            if low.startswith("company address"):
                company_addr = _strip_label(ln)
            elif low.startswith("factory address"):
                factory_addr = _strip_label(ln)
            elif low.startswith("phone"):
                phone = _strip_label(ln)
            elif low.startswith("fax"):
                fax = _strip_label(ln)
            elif low.startswith("email"):
                email = _strip_label(ln)
            elif low.startswith("website"):
                website = _strip_label(ln)
            elif low.startswith("products"):
                products = _strip_label(ln)

        if not company:
            return None

        owner_name: str | None = None
        owner_role: str | None = None
        if owner_line:
            parts = [p.strip() for p in owner_line.split(",", 1)]
            owner_name = parts[0] or None
            owner_role = parts[1].strip() if len(parts) > 1 else None

        primary_addr = factory_addr or company_addr
        district = _guess_district(primary_addr)
        clean_email = _first_email(email)
        clean_website = _normalize_website(website)

        payload: dict[str, Any] = {
            "bgapmea_member_id": detail_id,
            "bgapmea_membership_no": membership,
            "bgapmea_member_status": status,
            "bgapmea_company_address": company_addr,
            "bgapmea_factory_address": factory_addr,
            "bgapmea_owner_name": owner_name,
            "bgapmea_owner_role": owner_role,
            "bgapmea_phone": phone,
            "bgapmea_fax": fax,
            "bgapmea_email_raw": email,
            "bgapmea_website_raw": website,
            "bgapmea_products": products,
            "bgapmea_detail_url": url,
        }
        payload = {k: v for k, v in payload.items() if v not in (None, "")}

        return ScrapedRecord(
            source_code=self.source_code,
            source_ref=str(detail_id),
            company_name=company,
            contact_name=owner_name,
            contact_role=owner_role,
            email=clean_email,
            phone_raw=phone,
            address_raw=primary_addr,
            district=district,
            website=clean_website,
            payload=payload,
            evidence=(
                EvidenceAttachment(
                    doc=doc,
                    locators=_FIELD_LOCATORS,
                    default_locator="member detail page",
                    skip_keys=_UNCITABLE_FIELDS,
                )
                if doc is not None and doc.ok
                else None
            ),
        )


# ----------------------------------------------------------------------
def _strip_label(line: str) -> str | None:
    if ":" not in line:
        return None
    val = line.split(":", 1)[1].strip()
    return val or None


def _guess_district(addr: str | None) -> str | None:
    if not addr:
        return None
    up = addr.upper()
    for hint in _DISTRICT_HINTS:
        if hint in up:
            return hint.title().replace("Cumilla", "Comilla").replace("Jessore", "Jashore")
    return None


def _first_email(raw: str | None) -> str | None:
    if not raw:
        return None
    m = re.search(r"[\w.+-]+@[\w-]+\.[\w.-]+", raw)
    return m.group(0).lower() if m else None


def _normalize_website(raw: str | None) -> str | None:
    if not raw:
        return None
    s = raw.strip()
    # Drop trailing labels that sometimes leak in ("www.x.com Email :" etc.)
    s = re.split(r"\s+(?=email|phone|fax|address)", s, maxsplit=1, flags=re.I)[0].strip()
    if not s:
        return None
    if not s.lower().startswith(("http://", "https://")):
        s = "http://" + s
    return s
