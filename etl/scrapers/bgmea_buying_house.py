"""BGMEA Associate Member (Buying House) PDF parser. Spec §2.

Place the PDF at: etl/raw/BGMEA_Associate_Members.pdf

The PDF is a 2-column layout. We split each page vertically using word
x-coordinates, then parse each column block-by-block using the (Reg-N) marker.

Transport: local file, wrapped in the acquisition interface. There is no network
transport to replace here — what the wrapper adds is provenance the source never
had. Previously a scheduled run of this source reported success whether the PDF
on disk was fetched yesterday or eighteen months ago. Now each run records the
file's path, mtime and content hash, and mirrors the PDF to Bunny, so a citation
resolves to a dated archived copy and staleness is visible in the admin console
instead of showing as a green tick.
"""
from __future__ import annotations

import io
import re
from pathlib import Path
from typing import AsyncIterator, Iterable

import pdfplumber

from etl.acquire import AcquireRequest
from etl.acquire.local import path_to_url
from etl.core.acquiring import AcquiringScraper
from etl.core.config import settings
from etl.core.scraper import EvidenceAttachment, ScrapedRecord
from etl.evidence.locate import pdf_locator

PDF_PATH = settings.etl_raw_dir / "BGMEA_Associate_Members.pdf"

# Reg separator is ':' in current PDFs, '-' in older ones — accept both.
_REG_RE   = re.compile(r"^(?P<name>.+?)\s*\(Reg[:\-]\s*(?P<reg>\d+)\)\s*$")
_TEL_RE   = re.compile(r"^Tel(?:/Mob)?[:\-]\s*(?P<tel>.+)$", re.IGNORECASE)
_EMAIL_RE = re.compile(r"^Email[:\-]\s*(?P<email>.*)$", re.IGNORECASE)
_HEADER_RE = re.compile(r"^List of Associate Member", re.IGNORECASE)

_CITY_KEYWORDS = {
    "Dhaka": ["Dhaka", "DOHS", "Uttara", "Gulshan", "Banani", "Dhanmondi", "Mirpur",
              "Mohakhali", "Tejgaon", "Malibagh", "Rampura", "Savar", "Gazipur",
              "Ashulia", "Narayanganj", "Keraniganj", "Khilkhet", "Motijheel",
              "Wari", "Kawran Bazar", "Eskaton", "Moghbazar", "Baridhara",
              "Niketon", "Bashundhara", "Badda", "Kakrail", "Mohammadpur",
              "Lalbagh", "Shyamoli", "Farmgate", "Paltan", "Shahbag",
              "Hatirjheel", "Cantonment", "Jatrabari", "Demra", "Kamrangirchar",
              "Turag", "Dakshin Khan", "Kamalapur", "Sutrapur", "Nawabpur",
              "Tongi", "Joydevpur", "Gazipura", "Konabari", "Board Bazar"],
    "Chittagong": ["Chittagong", "Chattogram", "Agrabad", "Nasirabad", "Panchlaish",
                   "Halishahar", "Pahartali", "Kalurghat", "Muradpur", "Khulshi",
                   "Kadamtali", "Bayazid", "Patenga", "Anderkilla", "Kotwali",
                   "Double Mooring", "Hathazari", "EPZ"],
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


def _column_lines(page, x_lo: float, x_hi: float) -> list[str]:
    """Group words inside [x_lo, x_hi] into rows by y-coordinate, return lines."""
    words = [w for w in page.extract_words(use_text_flow=True, keep_blank_chars=False)
             if x_lo <= w["x0"] < x_hi]
    if not words:
        return []
    words.sort(key=lambda w: (round(w["top"], 1), w["x0"]))
    rows: list[list[dict]] = []
    cur: list[dict] = []
    cur_top: float | None = None
    for w in words:
        top = w["top"]
        if cur_top is None or abs(top - cur_top) <= 3.0:
            cur.append(w)
            if cur_top is None:
                cur_top = top
        else:
            rows.append(cur)
            cur = [w]
            cur_top = top
    if cur:
        rows.append(cur)
    lines: list[str] = []
    for row in rows:
        row.sort(key=lambda w: w["x0"])
        text = " ".join(w["text"] for w in row).strip()
        if text and not _HEADER_RE.match(text):
            lines.append(text)
    return lines


def _parse_column(lines: list[str]) -> Iterable[dict]:
    """Walk the column line-by-line, anchoring on the (Reg-N) marker."""
    n = len(lines)
    i = 0
    while i < n:
        m = _REG_RE.match(lines[i])
        if not m:
            i += 1
            continue
        name = m.group("name").strip()
        reg = m.group("reg").strip()
        # Current PDF layout: role on line i-1, contact name on line i-2.
        # Guard against false positives: skip if the candidate line looks like
        # a tel/email/reg line (e.g. first entry on a page with no preceding text).
        contact = role = None
        if i >= 1:
            prev1 = lines[i - 1]
            if not _REG_RE.match(prev1) and not _TEL_RE.match(prev1) and not _EMAIL_RE.match(prev1):
                role = prev1.strip() or None
        if i >= 2 and role is not None:
            prev2 = lines[i - 2]
            if not _REG_RE.match(prev2) and not _TEL_RE.match(prev2) and not _EMAIL_RE.match(prev2):
                contact = prev2.strip() or None
        addr_lines: list[str] = []
        tel: str | None = None
        email: str | None = None
        j = i + 1
        while j < n:
            line = lines[j]
            if _REG_RE.match(line):
                break
            tm = _TEL_RE.match(line)
            if tm:
                tel = tm.group("tel").strip()
                if j + 1 < n:
                    em = _EMAIL_RE.match(lines[j + 1])
                    if em:
                        e = em.group("email").strip()
                        email = e or None
                        j += 1
                j += 1
                break
            em = _EMAIL_RE.match(line)
            if em:
                e = em.group("email").strip()
                email = e or None
                j += 1
                break
            addr_lines.append(line.strip())
            j += 1
        city_line = addr_lines[-1] if addr_lines else ""
        street = ", ".join(addr_lines[:-1]) if len(addr_lines) > 1 else (
            addr_lines[0] if addr_lines else ""
        )
        if street and city_line:
            address = f"{street}, {city_line}"
        else:
            address = street or city_line
        yield {
            "name": name,
            "reg": reg,
            "contact": contact,
            "role": role,
            "address": address,
            "city_hint": city_line,
            "tel": tel,
            "email": email,
        }
        i = j


# `bgmea_member_type` is a label we assign to every row in this document, not
# something the PDF prints, so citing it would attach an excerpt-less claim to
# every buying house.
_UNCITABLE_FIELDS = ("bgmea_member_type",)


class BgmeaBuyingHouseScraper(AcquiringScraper):
    code = "bgmea_buying_house"
    source_code = "BGMEA"
    transport = "local"
    fallback_transport = None

    def __init__(self, pdf_path: Path | None = None, **kwargs) -> None:
        super().__init__(**kwargs)
        self.pdf_path = pdf_path or PDF_PATH

    async def fetch(self) -> AsyncIterator[ScrapedRecord]:
        doc = await self.acquire(
            AcquireRequest(
                url=path_to_url(self.pdf_path), label="BGMEA associate members"
            )
        )
        if not doc.ok or doc.body_bytes is None:
            raise FileNotFoundError(
                f"BGMEA PDF not readable at {self.pdf_path} "
                f"({doc.fetch_status.value}: {doc.error_message}). "
                "Drop the BGMEA Associate Members PDF there and re-run."
            )

        seen_regs: set[str] = set()
        with pdfplumber.open(io.BytesIO(doc.body_bytes)) as pdf:
            for page_no, page in enumerate(pdf.pages, start=1):
                width = page.width
                left = _column_lines(page, 0, width * 0.5)
                right = _column_lines(page, width * 0.5, width)
                # Excerpt against this page only. The register runs to dozens of
                # pages and the same street or phone prefix recurs throughout, so
                # a whole-document search would happily cite another buying
                # house's line as this one's evidence.
                page_text = page.extract_text() or ""
                for col in (left, right):
                    for rec in _parse_column(col):
                        if rec["reg"] in seen_regs:
                            continue
                        seen_regs.add(rec["reg"])
                        address = rec["address"]
                        yield ScrapedRecord(
                            source_code=self.source_code,
                            source_ref=rec["reg"],
                            company_name=rec["name"],
                            contact_name=rec["contact"] or None,
                            contact_role=rec["role"] or None,
                            email=(rec["email"] or None),
                            phone_raw=rec["tel"] or None,
                            address_raw=address or None,
                            city=_detect_city(rec["city_hint"]) or _detect_city(address),
                            payload={
                                "bgmea_reg_number": rec["reg"],
                                "bgmea_member_type": "associate_buying_house",
                                "raw_address": address,
                                "raw_tel": rec["tel"],
                            },
                            evidence=EvidenceAttachment(
                                doc=doc,
                                default_locator=pdf_locator(page_no, rec["name"]),
                                locators={
                                    "bgmea_reg_number": pdf_locator(
                                        page_no, f"{rec['name']} (Reg-{rec['reg']})"
                                    ),
                                },
                                document_text=page_text,
                                document_is_html=False,
                                skip_keys=_UNCITABLE_FIELDS,
                            ),
                        )
