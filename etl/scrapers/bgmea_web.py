"""BGMEA General Members (manufacturer factories) — web scraper.

List page: https://www.bgmea.com.bd/page/member-list?page=N  (~214 pages, 4274 members)
Detail   : https://www.bgmea.com.bd/member/{member_id}        (3 inline tabs)

We use the BGMEA registration number as the canonical ref (prefixed with
``general:`` to avoid collision with the BGMEA Associate buying-house list,
which uses its own reg-number space).

entity_type is forced to ``factory`` for these records (general members are
manufacturers, not buying houses).
"""
from __future__ import annotations

import re
from typing import Any, AsyncIterator

from bs4 import BeautifulSoup

from etl.core.http import HttpClient
from etl.core.scraper import BaseScraper, ScrapedRecord

BASE = "https://www.bgmea.com.bd"
LIST_URL = f"{BASE}/page/member-list"
DETAIL_URL = f"{BASE}/member/{{mid}}"

_BROWSER_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) "
                  "Chrome/124.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": LIST_URL,
}

_DETAIL_ID_RE = re.compile(r"/member/(\d+)")
_INT_RE = re.compile(r"\d+")

_CITY_KEYWORDS = {
    "Dhaka": ["Dhaka", "DOHS", "Uttara", "Gulshan", "Banani", "Dhanmondi", "Mirpur",
              "Mohakhali", "Tejgaon", "Malibagh", "Rampura", "Savar", "Ashulia",
              "Narayanganj", "Keraniganj", "Khilkhet", "Motijheel", "Wari",
              "Kawran Bazar", "Eskaton", "Moghbazar", "Baridhara", "Niketon",
              "Bashundhara", "Badda", "Mohammadpur", "Lalbagh", "Shyamoli",
              "Farmgate", "Paltan", "Shahbag", "Hatirjheel", "Cantonment",
              "Jatrabari", "Demra", "Turag", "Sutrapur"],
    "Gazipur": ["Gazipur", "Tongi", "Joydevpur", "Konabari", "Board Bazar",
                "Sreepur", "Kaliakair", "Kashimpur"],
    "Narayanganj": ["Narayanganj", "Fatullah", "Siddhirganj", "Rupganj", "Bandar"],
    "Chittagong": ["Chittagong", "Chattogram", "Agrabad", "Nasirabad", "Panchlaish",
                   "Halishahar", "Pahartali", "Kalurghat", "Muradpur", "Khulshi",
                   "Kadamtali", "Bayazid", "Patenga", "Hathazari", "EPZ", "CEPZ"],
    "Khulna": ["Khulna"],
    "Rajshahi": ["Rajshahi"],
    "Sylhet": ["Sylhet"],
    "Comilla": ["Comilla", "Cumilla"],
    "Barisal": ["Barisal", "Barishal"],
    "Rangpur": ["Rangpur"],
    "Mymensingh": ["Mymensingh"],
}


def _detect_city(text: str | None) -> str | None:
    if not text:
        return None
    low = text.lower()
    for city, keywords in _CITY_KEYWORDS.items():
        if any(k.lower() in low for k in keywords):
            return city
    return None


def _td_text(node) -> str:
    if node is None:
        return ""
    return node.get_text(" ", strip=True)


def _block_text(node) -> str:
    if node is None:
        return ""
    # Preserve line breaks for multi-line addresses
    for br in node.find_all("br"):
        br.replace_with("\n")
    return node.get_text("\n", strip=True)


def _clean_int(text: str) -> int | None:
    if not text:
        return None
    m = _INT_RE.search(text.replace(",", ""))
    return int(m.group(0)) if m else None


def _row_lookup(table) -> dict[str, Any]:
    """For an outer table whose <tr>s have <th> label and <td> value,
    return {label: <td-element>}. Skips empty header rows."""
    out: dict[str, Any] = {}
    if table is None:
        return out
    body = table.find("tbody") or table
    for tr in body.find_all("tr", recursive=False):
        th = tr.find("th", recursive=False)
        td = tr.find("td", recursive=False)
        if th is None or td is None:
            continue
        label = th.get_text(" ", strip=True).rstrip(":")
        if not label:
            continue
        out[label] = td
    return out


def _parse_directors(td) -> list[dict[str, str]]:
    out: list[dict[str, str]] = []
    inner = td.find("table") if td is not None else None
    if inner is None:
        return out
    headers = [th.get_text(strip=True) for th in inner.find_all("th")]
    body = inner.find("tbody") or inner
    for tr in body.find_all("tr"):
        tds = tr.find_all("td")
        if not tds:
            continue
        row = {}
        for i, cell in enumerate(tds):
            key = headers[i] if i < len(headers) else f"col{i}"
            row[key] = cell.get_text(" ", strip=True)
        if any(v for v in row.values()):
            out.append(row)
    return out


def _parse_inner_kv_table(td) -> list[dict[str, str]]:
    """Generic 'header + body row' inner-table → list of dicts."""
    return _parse_directors(td)


_ADDR_FIELD_RE = re.compile(r"<strong>([^<]+)</strong>\s*([^<]*)", re.IGNORECASE)


def _parse_address_block(td) -> dict[str, str]:
    """Address tab uses '<strong>Label:</strong> value' pairs in <td>s."""
    out: dict[str, str] = {}
    if td is None:
        return out
    text = _block_text(td)
    # Split on labels we know
    for label in ("Name", "Designation", "Phone", "Email"):
        m = re.search(rf"{label}\s*:\s*([^\n]+)", text, re.IGNORECASE)
        if m:
            out[label.lower()] = m.group(1).strip()
    return out


class BgmeaWebScraper(BaseScraper):
    """Scrape general (manufacturer) members from bgmea.com.bd."""

    code = "bgmea_web"
    source_code = "BGMEA"

    def __init__(self, max_pages: int | None = None) -> None:
        super().__init__()
        # Lower rps for politeness — site is on shared hosting
        self._rps = 2.0
        self._max_pages = max_pages  # None = scrape until empty

    async def fetch(self) -> AsyncIterator[ScrapedRecord]:
        async with HttpClient(rps=self._rps, headers=_BROWSER_HEADERS) as http:
            seen_ids: set[str] = set()
            page = 1
            empty_streak = 0
            while empty_streak < 2:
                if self._max_pages is not None and page > self._max_pages:
                    break
                try:
                    resp = await http.get(LIST_URL, params={"page": page})
                except Exception as e:  # noqa: BLE001
                    self.log.warning("bgmea_web.list_failed", page=page, error=str(e))
                    break
                rows = self._parse_list(resp.text)
                fresh = [r for r in rows if r["member_id"] not in seen_ids]
                if not fresh:
                    empty_streak += 1
                    self.log.info("bgmea_web.empty_page", page=page, raw=len(rows))
                    page += 1
                    continue
                empty_streak = 0
                self.log.info("bgmea_web.page", page=page, rows=len(rows), fresh=len(fresh))
                for row in fresh:
                    seen_ids.add(row["member_id"])
                    try:
                        detail = await self._fetch_detail(http, row["member_id"])
                    except Exception as e:  # noqa: BLE001
                        self.log.warning("bgmea_web.detail_failed",
                                         member_id=row["member_id"], error=str(e))
                        detail = {}
                    rec = self._to_record(row, detail)
                    if rec is not None:
                        yield rec
                page += 1

    # ------------------------------------------------------------------
    def _parse_list(self, html: str) -> list[dict[str, str]]:
        soup = BeautifulSoup(html, "lxml")
        out: list[dict[str, str]] = []
        for tr in soup.select("table tbody tr"):
            tds = tr.find_all("td")
            if len(tds) < 5:
                continue
            link = tds[4].find("a") or tr.find("a", href=re.compile(r"/member/\d+"))
            if link is None:
                continue
            m = _DETAIL_ID_RE.search(link.get("href", ""))
            if not m:
                continue
            member_id = m.group(1)
            company = _td_text(tds[0])
            reg_no = _td_text(tds[1])
            contact = _td_text(tds[2])
            email = _td_text(tds[3])
            if not company:
                continue
            out.append({
                "member_id": member_id,
                "company_name": company,
                "bgmea_reg_number": reg_no,
                "contact_person": contact,
                "email": email,
            })
        return out

    async def _fetch_detail(self, http: HttpClient, mid: str) -> dict[str, Any]:
        resp = await http.get(DETAIL_URL.format(mid=mid))
        return self._parse_detail(resp.text)

    def _parse_detail(self, html: str) -> dict[str, Any]:
        soup = BeautifulSoup(html, "lxml")
        out: dict[str, Any] = {}
        # The 3 tab-panes
        company_pane = soup.select_one("#company_info")
        address_pane = soup.select_one("#address_info")
        final_pane = soup.select_one("#final_info")

        # --- Company tab ---
        if company_pane is not None:
            kv = _row_lookup(company_pane.find("table"))
            out["bgmea_reg_number"] = _td_text(kv.get("BGMEA Reg. No.")) or None
            out["epb_reg_no"] = _td_text(kv.get("EPB Reg No.")) or None
            out["directors"] = _parse_directors(kv.get("Director Informaiton"))

        # --- Address tab ---
        if address_pane is not None:
            tbl = address_pane.find("table")
            addr = self._parse_address_tab(tbl)
            out.update(addr)

        # --- Final info tab ---
        if final_pane is not None:
            kv = _row_lookup(final_pane.find("table"))
            website_td = kv.get("Website")
            if website_td is not None:
                a = website_td.find("a")
                href = (a.get("href") if a else "") or website_td.get_text(strip=True)
                out["website"] = href.strip() or None
            out["established_date"] = _td_text(kv.get("Date of Establishment")) or None
            out["factory_types"] = _parse_inner_kv_table(kv.get("Factory Type"))
            employees = _parse_inner_kv_table(kv.get("No. of Employees"))
            out["employees"] = employees[0] if employees else {}
            out["num_machines"] = _clean_int(_td_text(kv.get("No of Machines")))
            # Production capacity label may include nested <br>
            prod_label = next((k for k in kv if k.startswith("Production Capacity")), None)
            if prod_label:
                out["production_capacity_dozen_yearly"] = _clean_int(
                    _td_text(kv[prod_label])
                )
            certs = _parse_inner_kv_table(kv.get("Certifications"))
            out["certifications"] = certs[0] if certs else {}
            principal = kv.get("Principal Exportable Product")
            if principal is not None:
                txt = principal.get_text(" ", strip=True)
                out["principal_products"] = [
                    p.strip() for p in txt.split(",") if p.strip()
                ]
            out["annual_turnover"] = _parse_inner_kv_table(kv.get("Annual Turnover"))
        return out

    def _parse_address_tab(self, table) -> dict[str, Any]:
        """Address tab is a flat table of <th>label</th><td>value</td> rows.
        Multiple rows share blank <th> for sub-fields (Name/Designation/Phone/Email
        belong to 'Contact Person'). Walk in order, tracking the current section.
        """
        out: dict[str, Any] = {
            "contact": {},
            "mailing_address": None,
            "mailing_phone": None,
            "mailing_fax": None,
            "mailing_email": None,
            "factory_address": None,
            "factory_phone": None,
            "factory_fax": None,
            "factory_email": None,
        }
        if table is None:
            return out
        body = table.find("tbody") or table
        section = None  # 'contact' | 'mailing' | 'factory'
        for tr in body.find_all("tr"):
            th = tr.find("th")
            td = tr.find("td")
            if td is None:
                continue
            label = (th.get_text(" ", strip=True) if th else "").rstrip(":").strip()
            value = _block_text(td)
            if label == "Contact Person":
                section = "contact"
                # Parse '<strong>Name:</strong> value' from this row's td
                m = re.search(r"Name\s*:\s*([^\n]+)", value, re.IGNORECASE)
                if m:
                    out["contact"]["name"] = m.group(1).strip()
                continue
            if label == "Mailling Address":
                section = "mailing"
                out["mailing_address"] = value or None
                continue
            if label == "Factory Address":
                section = "factory"
                out["factory_address"] = value or None
                continue
            if label == "" and section == "contact":
                # Sub-row with Designation/Phone/Email inside td
                for k in ("Designation", "Phone", "Email"):
                    m = re.search(rf"{k}\s*:\s*([^\n]+)", value, re.IGNORECASE)
                    if m:
                        out["contact"][k.lower()] = m.group(1).strip()
                continue
            if section == "mailing":
                if label == "Phone":
                    out["mailing_phone"] = value or None
                elif label == "Fax":
                    out["mailing_fax"] = value or None
                elif label == "Email":
                    out["mailing_email"] = value or None
            elif section == "factory":
                if label == "Phone":
                    out["factory_phone"] = value or None
                elif label == "Fax":
                    out["factory_fax"] = value or None
                elif label == "Email":
                    out["factory_email"] = value or None
        return out

    # ------------------------------------------------------------------
    def _to_record(self, row: dict[str, str], detail: dict[str, Any]) -> ScrapedRecord | None:
        # Prefer detail-tab reg over list-row reg (same value usually)
        reg = (detail.get("bgmea_reg_number") or row.get("bgmea_reg_number") or "").strip()
        member_id = row["member_id"]
        company = row["company_name"]
        # Stable cross-source key — prefix to avoid colliding with PDF/associate ref space
        source_ref = f"general:{reg}" if reg else f"member:{member_id}"

        # Address: prefer factory > mailing
        address = detail.get("factory_address") or detail.get("mailing_address")

        # Phone: prefer factory > mailing > contact > list email-row contact
        phone = (detail.get("factory_phone")
                 or detail.get("mailing_phone")
                 or detail.get("contact", {}).get("phone")) if isinstance(detail, dict) else None
        if phone in (None, "", "0"):
            phone = None

        # Email: prefer factory > mailing > contact > list-row email
        email = (detail.get("factory_email")
                 or detail.get("mailing_email")
                 or detail.get("contact", {}).get("email")
                 or row.get("email")) if isinstance(detail, dict) else row.get("email")
        if email in (None, "", "0"):
            email = None

        contact = detail.get("contact", {}) if isinstance(detail, dict) else {}
        contact_name = contact.get("name") or row.get("contact_person") or None
        contact_role = contact.get("designation") or None

        website = detail.get("website") if isinstance(detail, dict) else None
        if website and not website.startswith(("http://", "https://")):
            website = None

        payload: dict[str, Any] = {
            "bgmea_reg_number": reg or None,
            "bgmea_member_id": member_id,
            "bgmea_member_type": "general_manufacturer",
            "epb_reg_no": detail.get("epb_reg_no"),
            "directors": detail.get("directors", []),
            "mailing_address": detail.get("mailing_address"),
            "mailing_phone": detail.get("mailing_phone"),
            "mailing_fax": detail.get("mailing_fax"),
            "mailing_email": detail.get("mailing_email"),
            "factory_address": detail.get("factory_address"),
            "factory_phone": detail.get("factory_phone"),
            "factory_fax": detail.get("factory_fax"),
            "factory_email": detail.get("factory_email"),
            "established_date": detail.get("established_date"),
            "factory_types": detail.get("factory_types", []),
            "employees": detail.get("employees", {}),
            "num_machines": detail.get("num_machines"),
            "production_capacity_dozen_yearly": detail.get("production_capacity_dozen_yearly"),
            "certifications": detail.get("certifications", {}),
            "principal_products": detail.get("principal_products", []),
            "annual_turnover": detail.get("annual_turnover", []),
            "raw_address": address,
            "raw_tel": phone,
        }

        return ScrapedRecord(
            source_code=self.source_code,
            source_ref=source_ref,
            company_name=company,
            contact_name=contact_name,
            contact_role=contact_role,
            email=email,
            phone_raw=phone,
            address_raw=address,
            city=_detect_city(address),
            website=website,
            entity_type="factory",
            payload=payload,
        )
