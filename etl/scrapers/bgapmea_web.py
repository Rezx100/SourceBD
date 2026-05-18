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
"""
from __future__ import annotations

import re
from typing import Any, AsyncIterator

import httpx
from bs4 import BeautifulSoup

from etl.core.http import HttpClient
from etl.core.scraper import BaseScraper, ScrapedRecord

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


class BgapmeaScraper(BaseScraper):
    code = "bgapmea_web"
    source_code = "BGAPMEA"

    async def fetch(self) -> AsyncIterator[ScrapedRecord]:
        async with HttpClient(rps=1.0, headers=_BROWSER_HEADERS) as http:
            ids = await self._collect_detail_ids(http)
            self.log.info("bgapmea.detail_ids_collected", count=len(ids))

            for idx, did in enumerate(ids, 1):
                url = DETAIL_URL.format(id=did)
                try:
                    resp = await http.get(url)
                except httpx.HTTPStatusError as e:
                    self.log.warning("bgapmea.detail_skip", id=did,
                                     status=e.response.status_code)
                    continue
                except Exception as e:  # noqa: BLE001
                    self.log.warning("bgapmea.detail_error", id=did, error=str(e))
                    continue

                rec = self._parse_detail(resp.text, detail_id=did, url=url)
                if rec is None:
                    self.log.warning("bgapmea.parse_empty", id=did)
                    continue
                if idx % 50 == 0:
                    self.log.info("bgapmea.progress", done=idx, total=len(ids))
                yield rec

    # ------------------------------------------------------------------
    async def _collect_detail_ids(self, http: HttpClient) -> list[str]:
        """Walk paginated listing and collect unique detail ids in order seen."""
        seen: dict[str, None] = {}
        offset = 0
        page_size = 15
        total: int | None = None
        empty_streak = 0

        while True:
            url = LIST_URL if offset == 0 else LIST_PAGE_URL.format(offset=offset)
            try:
                resp = await http.get(url)
            except Exception as e:  # noqa: BLE001
                self.log.warning("bgapmea.list_failed", offset=offset, error=str(e))
                break

            html = resp.text
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
    def _parse_detail(self, html: str, *, detail_id: str, url: str) -> ScrapedRecord | None:
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
