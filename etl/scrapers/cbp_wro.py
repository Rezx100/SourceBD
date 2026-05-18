"""US CBP Withhold Release Orders & Findings scraper (Tier 5).

Source: https://www.cbp.gov/trade/forced-labor/withhold-release-orders-and-findings

The live cbp.gov page currently 302-redirects to dhs.gov/ntas (a generic
advisories page) — content has been pulled while the Forced Labor Division is
being restructured. We fall back to the most recent Wayback snapshot of the
canonical CBP URL so we always have the authoritative table data.

Page layout: two H2 sections — "Withhold Release Orders" and "Findings".
Inside each, country sub-sections (China, DRC, Dominican Republic, India,
Japan, Malawi, Malaysia, Mexico, Nepal, Turkmenistan, Somalia, Zimbabwe,
Fishing Vessels). Each country has a table with columns:
  # | Date | Merchandise | Entities | Status | Status Notes
"""
from __future__ import annotations

import re
from datetime import datetime
from typing import AsyncIterator

from bs4 import BeautifulSoup

from etl.core.http import HttpClient
from etl.core.normalize import normalize_company_name
from etl.core.sanctions import BaseSanctionScraper, SanctionEntry

# Live URL (kept for provenance even though it redirects)
LIVE_URL = "https://www.cbp.gov/trade/forced-labor/withhold-release-orders-and-findings"
# Wayback prefix — Wayback resolves "/web/<date>/<url>" to the closest snapshot.
WAYBACK_URL = (
    "https://web.archive.org/web/2024/"
    "https://www.cbp.gov/trade/forced-labor/withhold-release-orders-and-findings"
)

_DATE_FORMATS = ("%m/%d/%Y", "%-m/%-d/%Y", "%m/%d/%y")


def _parse_date(text: str):
    text = (text or "").strip()
    if not text:
        return None
    for fmt in _DATE_FORMATS:
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    # tolerate single-digit m/d on Windows (no %-m)
    m = re.match(r"^(\d{1,2})/(\d{1,2})/(\d{2,4})$", text)
    if m:
        mo, d, y = (int(x) for x in m.groups())
        if y < 100:
            y += 2000 if y < 50 else 1900
        try:
            return datetime(y, mo, d).date()
        except ValueError:
            return None
    return None


_SPLIT_ENTITIES_RE = re.compile(
    r"\s*;\s*|"
    r"\s+and\s+(?=[A-Z])|"  # ", and X" / " and X" between entity names
    r"\s*,\s+and\s+",
    re.IGNORECASE,
)
_AKA_RE = re.compile(
    r"\s*(?:\(|,?\s+)?\b(?:a/k/a|aka|also\s+known\s+as|formerly\s+known\s+as|including|and\s+formerly)\b\s*[:\-]?\s*",
    re.IGNORECASE,
)

_COMPANY_SUFFIXES = (
    "ltd", "limited", "llc", "inc", "incorporated", "corp", "corporation",
    "co", "company", "group", "holdings",
    "enterprise", "enterprises", "sdn", "bhd", "gmbh", "pte", "ag", "sa",
    "srl", "s.r.l", "plc", "kg", "oy", "ab", "as",
)


def _looks_like_company(seg: str) -> bool:
    """Return True if `seg` ends with a recognizable corporate suffix token.

    Used to gate the ', and X' split — only safe when each piece independently
    looks like a complete company name.
    """
    tokens = re.findall(r"[A-Za-z]+", seg.lower())
    if len(tokens) < 2:
        return False
    # Look at the last 1-3 tokens for a suffix.
    return any(t in _COMPANY_SUFFIXES for t in tokens[-3:])


def _split_entities(cell: str) -> list[tuple[str, list[str]]]:
    """Cell example: 'Brightway Holdings Sdn Bhd, Laglove (M) Sdn Bhd, and Biopro (M) Sdn Bhd (collectively, Brightway Group)'.

    Strategy (deliberately conservative — under-split rather than mis-split):
      - Strip a trailing '(collectively, X)' style suffix.
      - Split on ';' as the strongest separator.
      - If only one segment, also try ', and ' as a fallback.
      - Do NOT split on bare ' and ' between capital words: it false-splits
        legitimate names like 'Xinjiang Production and Construction Corporation'.
      - Within each segment, split off aliases on a/k/a / aka / 'also known as'.

    Returns: list of (canonical_name, aliases).
    """
    s = cell.strip()
    s = re.sub(r"\(\s*collectively[^)]*\)", "", s, flags=re.IGNORECASE).strip().rstrip(".")

    if ";" in s:
        segments = [seg.strip(" .,") for seg in s.split(";") if seg.strip()]
    else:
        # ", and X" is ambiguous: it could separate entities (e.g.
        # "Brightway Holdings Sdn Bhd, Laglove (M) Sdn Bhd, and Biopro (M) Sdn Bhd")
        # or appear inside one name (e.g.
        # "...Agriculture, Industry, and Trade Co., Ltd."). Only split when the
        # LEFT side already looks like a complete company (ends in a corporate
        # suffix token), so we never chop a real name in half.
        candidate = re.split(r"(\s*,\s+and\s+)(?=[A-Z])", s)
        if len(candidate) > 1:
            # candidate = [seg, sep, seg, sep, ..., seg]
            pieces = candidate[::2]
            if all(_looks_like_company(p) for p in pieces):
                segments = pieces
            else:
                segments = [s]
        else:
            segments = [s]

    out: list[tuple[str, list[str]]] = []
    for seg in segments:
        seg = seg.strip(" ,.")
        if not seg:
            continue
        # Split the segment at the FIRST aka marker; everything after is aliases.
        m = _AKA_RE.search(seg)
        if m:
            name = seg[: m.start()].strip(" ,.")
            tail = seg[m.end():].strip()
            # Strip a trailing ')' if the segment was wrapped: "Foo (a/k/a Bar)"
            tail = tail.rstrip(")")
            aliases = [
                a.strip(" .,")
                for a in re.split(r"\s*;\s*|\s*,\s+and\s+(?=[A-Z])", tail)
                if a.strip(" .,")
            ]
        else:
            name = seg
            aliases = []
        if name:
            out.append((name, aliases))
    return out


def _slugify(s: str) -> str:
    s = normalize_company_name(s)
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


class CbpWroScraper(BaseSanctionScraper):
    code = "cbp_wro"
    source_code = "US_WRO"

    async def _fetch_with_fallback(self, http: HttpClient):
        """Try live URL first; fall back to Wayback if (a) request fails,
        (b) we get redirected off cbp.gov, or (c) the page contains no <table>.

        CBP migrated the WRO listing from a static HTML table page to a
        Tableau iframe in 2025. The static tables remain authoritative for
        historical data (1991-2024) — newer entries appear infrequently.
        Wayback is treated as the canonical fallback source.
        """
        try:
            resp = await http.get(LIVE_URL)
            host_ok = "cbp.gov" in str(resp.url.host)
            has_tables = "<table" in resp.text.lower()
            if host_ok and has_tables:
                return resp
            self.log.warning(
                "cbp.live_unusable",
                final_url=str(resp.url),
                host_ok=host_ok,
                has_tables=has_tables,
                falling_back_to="wayback",
            )
        except Exception as e:  # noqa: BLE001
            self.log.warning("cbp.live_failed", error=str(e), trying="wayback")
        return await http.get(WAYBACK_URL)

    async def fetch(self) -> AsyncIterator[SanctionEntry]:
        async with HttpClient(rps=0.5) as http:
            resp = await self._fetch_with_fallback(http)

        soup = BeautifulSoup(resp.text, "lxml")
        fetched_via = "wayback" if "web.archive.org" in str(resp.url) else "live"

        # Walk h2 + table nodes in document order. Mode (WRO vs Finding) is
        # determined by the most recently seen H2 of those exact names.
        # Country comes from the table's own first row (each country gets its
        # own table where row 0 is the country header, row 1 is the column
        # header, rows 2..N are data).
        current_mode = "WRO"
        seen_refs: set[str] = set()

        for node in soup.find_all(["h2", "table"]):
            if node.name == "h2":
                txt = node.get_text(" ", strip=True).lower()
                if txt == "withhold release orders":
                    current_mode = "WRO"
                elif txt == "findings":
                    current_mode = "Finding"
                continue

            rows = node.find_all("tr")
            if len(rows) < 3:
                continue

            # Row 0: country header. Row 1: column header. Rows 2+: data.
            country_cell = rows[0].get_text(" ", strip=True)
            header_text = " ".join(
                td.get_text(" ", strip=True).lower() for td in rows[1].find_all(["td", "th"])
            )
            if "entities" not in header_text or "merchandise" not in header_text:
                continue
            country = country_cell.strip() or "Unknown"

            for tr in rows[2:]:
                tds = [td.get_text(" ", strip=True) for td in tr.find_all(["td", "th"])]
                # Expect: # | Date | Merchandise | Entities | Status | Status Notes
                if len(tds) < 5:
                    continue
                num, date_str, merch, entities_cell, status = tds[:5]
                notes = tds[5] if len(tds) >= 6 else None
                if not entities_cell or not num.strip().rstrip(".").isdigit():
                    continue

                listed = _parse_date(date_str)
                kind = current_mode

                for name, aliases in _split_entities(entities_cell):
                    name = name.strip(" .,")
                    if not name:
                        continue
                    ref = (
                        f"{kind.lower()}-{_slugify(country)}-"
                        f"{num.strip().rstrip('.')}-{_slugify(name)}"
                    )[:240]
                    if ref in seen_refs:
                        continue
                    seen_refs.add(ref)
                    yield SanctionEntry(
                        list_code="us_wro",
                        source_code="US_WRO",
                        entry_ref=ref,
                        entity_name=name,
                        aliases=aliases,
                        country=country,
                        merchandise=merch or None,
                        listed_date=listed,
                        status=status or None,
                        status_notes=notes,
                        source_url=LIVE_URL,
                        raw={
                            "kind": kind,
                            "row_number": num,
                            "raw_entities": entities_cell,
                            "fetched_via": fetched_via,
                        },
                    )
