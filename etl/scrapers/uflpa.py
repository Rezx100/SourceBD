"""DHS UFLPA Entity List scraper (Tier 5 regulatory).

Source: https://www.dhs.gov/uflpa-entity-list

Page layout: 4 grouped tables, one per UFLPA section 2(d)(2)(B):
  (i)  Mine/produce/manufacture in Xinjiang with forced labor
  (ii) Recruit/transport/transfer/harbor forced labor
  (iv) Exporters
  (v)  Source from XPCC / pairing-assistance program

Each row is `<entity name> | <date added>`. We extract aliases from common
name patterns: "(also known as A; B; and C)", "(including N aliases: A; B; C)",
"(formerly known as X)".

Although these are Chinese entities (zero direct match against BD suppliers
expected today), we still ingest the full list so that future supplier scrapes
or parent/affiliate enrichment can cross-check against it.
"""
from __future__ import annotations

import re
from datetime import datetime
from typing import AsyncIterator

from bs4 import BeautifulSoup

from etl.acquire import AcquireRequest
from etl.core.acquiring import AcquiringSanctionScraper
from etl.core.normalize import normalize_company_name
from etl.core.sanctions import SanctionEntry
from etl.core.scraper import EvidenceAttachment

URL = "https://www.dhs.gov/uflpa-entity-list"

# Section labels we expect to see as <p>/<h*> immediately above each table.
_SECTION_KEYWORDS = {
    "i": "mine, produce, or manufacture",
    "ii": "recruit, transport, transfer",
    "iv": "exported products",
    "v": "source material from xinjiang",
}

# alias annotations inside the entity_name cell. Supports one level of nested
# parens in the alias body (e.g. "(Shanshan)") via the (?:\([^)]*\)|[^)])*
# subpattern.
_ALIAS_RE = re.compile(
    r"\(\s*(?:also\s+known\s+as|"
    r"including\s+(?:one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+alias(?:es)?|"
    r"and\s+(?:one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+alias(?:es)?|"
    r"formerly\s+known\s+as|aka|a/k/a)"
    r"\s*[:\-]?\s*(?P<body>(?:\([^)]*\)|[^)])*)\)",
    re.IGNORECASE,
)
# strip nested "and subsidiaries" etc. that sometimes appear after parens
_TAIL_NOISE_RE = re.compile(r"\s+and\s+subsidiaries\.?$", re.IGNORECASE)
_DATE_FORMATS = ("%B %d, %Y", "%b %d, %Y")


def _parse_date(text: str):
    text = (text or "").strip()
    for fmt in _DATE_FORMATS:
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    return None


def _split_aliases(body: str) -> list[str]:
    # body like "Hotan Haolin Hair Accessories; and Hollin Hair Accessories"
    parts = re.split(r"\s*;\s*|\s*,\s*and\s+", body)
    out: list[str] = []
    for p in parts:
        p = p.strip().lstrip("and ").strip()
        if p:
            out.append(p)
    return out


def _split_name_and_aliases(cell: str) -> tuple[str, list[str]]:
    aliases: list[str] = []
    name_clean = cell

    # Repeatedly strip alias-bearing parens.
    while True:
        m = _ALIAS_RE.search(name_clean)
        if not m:
            break
        aliases.extend(_split_aliases(m.group("body")))
        name_clean = (name_clean[: m.start()] + name_clean[m.end():]).strip()

    name_clean = _TAIL_NOISE_RE.sub("", name_clean).strip()
    name_clean = re.sub(r"\s{2,}", " ", name_clean)
    # de-dupe aliases case-insensitively, keep first occurrence
    seen: set[str] = set()
    deduped: list[str] = []
    for a in aliases:
        k = a.lower()
        if k not in seen and a.lower() != name_clean.lower():
            seen.add(k)
            deduped.append(a)
    return name_clean, deduped


def _section_for(table) -> str:
    """Walk previous siblings/ancestors looking for one of the section keywords."""
    node = table
    hops = 0
    while node and hops < 12:
        node = node.find_previous(["p", "h2", "h3", "h4"])
        hops += 1
        if not node:
            break
        text = " ".join(node.get_text(" ", strip=True).lower().split())
        for code, kw in _SECTION_KEYWORDS.items():
            if kw in text:
                return code
    return "x"


class UflpaScraper(AcquiringSanctionScraper):
    code = "uflpa"
    source_code = "UFLPA"
    transport = "firecrawl"
    fallback_transport = "direct"
    rps = 1.0
    monitor_urls = (URL,)

    async def fetch(self) -> AsyncIterator[SanctionEntry]:
        doc = await self.acquire(
            AcquireRequest(url=URL, only_main_content=False, label="UFLPA entity list")
        )
        if not doc.ok:
            # This list drives supplier sanctions screening. Silently yielding
            # nothing would let a later pass conclude "no entities listed".
            raise RuntimeError(
                f"uflpa: {URL} unreadable ({doc.fetch_status.value}: "
                f"{doc.error_message}). Refusing to report an empty entity list."
            )

        soup = BeautifulSoup(doc.text(), "lxml")
        doc_text = doc.text()

        seen_refs: set[str] = set()
        for table in soup.find_all("table"):
            rows = table.find_all("tr")
            section = _section_for(table)
            counter = 0
            for tr in rows:
                cells = [td.get_text(" ", strip=True) for td in tr.find_all(["td"])]
                if len(cells) < 2:
                    continue
                raw_name, date_str = cells[0], cells[1]
                if not raw_name or raw_name.lower() in {"entity", "name"}:
                    continue

                name_clean, aliases = _split_name_and_aliases(raw_name)
                if not name_clean:
                    continue

                listed = _parse_date(date_str)
                counter += 1

                # Stable per-list ref: section + slug of cleaned name.
                slug = re.sub(r"[^a-z0-9]+", "-", normalize_company_name(name_clean)).strip("-")
                entry_ref = f"uflpa-{section}-{slug}"[:240]

                # An entity may legitimately appear in more than one section
                # (e.g., XPCC, Hetian Taida). Collapse duplicates: use first
                # section we see; later sections are skipped.
                if entry_ref in seen_refs:
                    continue
                seen_refs.add(entry_ref)

                yield SanctionEntry(
                    list_code="uflpa",
                    source_code="UFLPA",
                    entry_ref=entry_ref,
                    entity_name=name_clean,
                    aliases=aliases,
                    country="China",
                    listed_date=listed,
                    status="Active",
                    source_url=doc.citable_url,
                    raw={
                        "section": section,
                        "section_index": counter,
                        "raw_name": raw_name,
                        "raw_date": date_str,
                    },
                    evidence=EvidenceAttachment(
                        doc=doc,
                        locators={
                            "entity_name": f"section ({section}) table, row {counter}, col 1",
                            "listed_date": f"section ({section}) table, row {counter}, col 2",
                        },
                        default_locator=f"UFLPA Entity List, section ({section})",
                        document_text=doc_text,
                        subject_table="sanctions_list_entries",
                        # Both are constants we assign for every row on this
                        # list, not per-row text DHS prints. Citing them would
                        # attach an unverifiable excerpt to every entry.
                        skip_keys=("country", "status"),
                    ),
                )
