"""US Treasury OFAC Specially Designated Nationals (SDN) list scraper (Tier 5).

Source (legacy CSV, no header):
  https://sanctionslistservice.ofac.treas.gov/api/publicationpreview/exports/sdn.csv

Columns (12, comma-separated, double-quoted strings, '-0-' as null):
  ent_num, SDN_Name, SDN_Type, Program, Title, Call_Sign, Vess_Type,
  Tonnage, GRT, Vess_Flag, Vess_Owner, Remarks

We ingest one entry per row. The matcher's normalized-name length guard
(min 12 chars or 3 tokens) prevents false positives against generic
individual names (e.g. "John Smith") matching short BD supplier names.

We also pull the consolidated alt.csv when available so canonical names
get their AKA aliases attached (joined by ent_num).

Transport: direct, wrapped in the acquisition interface. A CSV export must be
read as CSV — a markdown rendering of it would not survive the quoting rules
this file depends on. The wrapper is what gives it per-field evidence and the
same admin surface as the rest of the pipeline.
"""
from __future__ import annotations

import csv
import io
from datetime import date
from typing import AsyncIterator

from etl.acquire import AcquireRequest
from etl.core.acquiring import AcquiringSanctionScraper
from etl.core.normalize import normalize_company_name
from etl.core.sanctions import SanctionEntry
from etl.core.scraper import EvidenceAttachment
from etl.evidence.locate import row_locator

SDN_URL = "https://sanctionslistservice.ofac.treas.gov/api/publicationpreview/exports/sdn.csv"
ALT_URL = "https://sanctionslistservice.ofac.treas.gov/api/publicationpreview/exports/alt.csv"

_NULL = "-0-"


def _clean(v: str | None) -> str | None:
    if v is None:
        return None
    s = v.strip()
    if not s or s == _NULL:
        return None
    return s


def _rows_with_raw(text: str):
    """Yield `(raw_source_text, parsed_row, first_line_no)` per CSV record.

    Excerpts must be verbatim slices of the document, and the SDN export is
    ~10 MB — scanning the whole file per claim would be quadratic. Handing each
    claim only its own record's source text is both fast and still honest: the
    snippet is a literal substring of the document, so the verifier finds it
    when it re-reads the full file. Records are tracked via `reader.line_num`
    rather than by splitting on newlines, because Remarks fields legitimately
    contain embedded line breaks inside their quotes.
    """
    lines = text.splitlines(keepends=True)
    reader = csv.reader(iter(lines))
    prev = 0
    for row in reader:
        consumed = reader.line_num
        yield "".join(lines[prev:consumed]), row, prev + 1
        prev = consumed


def _slugify(s: str) -> str:
    import re
    s = normalize_company_name(s)
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s[:200] or "unnamed"


class OfacSdnScraper(AcquiringSanctionScraper):
    code = "ofac_sdn"
    source_code = "OFAC"
    transport = "direct"
    fallback_transport = None
    rps = 0.5

    async def fetch(self) -> AsyncIterator[SanctionEntry]:
        sdn_doc = await self.acquire(AcquireRequest(url=SDN_URL, label="SDN export"))
        if not sdn_doc.ok:
            raise RuntimeError(
                f"ofac_sdn: {SDN_URL} unreadable ({sdn_doc.fetch_status.value}: "
                f"{sdn_doc.error_message}). Refusing to report an empty SDN list."
            )
        sdn_text = sdn_doc.text()

        # Aliases from alt.csv: ent_num, alt_num, alt_type, alt_name, alt_remarks
        aliases_by_ent: dict[str, list[str]] = {}
        alt_doc = await self.acquire(AcquireRequest(url=ALT_URL, label="SDN aliases"))
        if alt_doc.ok:
            for row in csv.reader(io.StringIO(alt_doc.text())):
                if len(row) < 4:
                    continue
                ent = (row[0] or "").strip()
                alt_name = _clean(row[3])
                if ent and alt_name:
                    aliases_by_ent.setdefault(ent, []).append(alt_name)
        else:
            # alt.csv currently 400s for some clients; canonical SDN entries
            # remain authoritative without aliases.
            self.log.warning(
                "ofac.alt_unavailable",
                status=alt_doc.fetch_status.value,
                error=alt_doc.error_message,
            )

        seen_refs: set[str] = set()
        today = date.today()

        for row_text, row, row_no in _rows_with_raw(sdn_text):
            if len(row) < 12:
                continue
            ent_num = (row[0] or "").strip()
            name = _clean(row[1])
            sdn_type = _clean(row[2]) or "entity"
            program = _clean(row[3])
            remarks = _clean(row[11])

            if not ent_num or not name:
                continue

            # Only screen against organizations. Vessels (ships), aircraft,
            # and individuals are listed in SDN but cannot be a Bangladesh
            # garment factory or buying house — matching them produces only
            # false positives (e.g. supplier "Lucky Star Apparels" vs the
            # OFAC-listed DPRK vessel "LUCKY STAR"). Drop at ingest time.
            if sdn_type.lower() != "entity":
                continue

            entry_ref = f"sdn-{ent_num}"
            if entry_ref in seen_refs:
                continue
            seen_refs.add(entry_ref)

            # Aliases: from alt.csv plus inline 'a.k.a.' tokens in Remarks
            aliases: list[str] = list(aliases_by_ent.get(ent_num, []))

            yield SanctionEntry(
                list_code="ofac_sdn",
                source_code="OFAC",
                entry_ref=entry_ref,
                entity_name=name,
                aliases=aliases,
                country=None,
                merchandise=None,
                listed_date=None,
                status=program,
                status_notes=remarks,
                source_url=sdn_doc.citable_url,
                raw={
                    "ent_num": ent_num,
                    "sdn_type": sdn_type,
                    "program": program,
                    "fetched_at": today.isoformat(),
                },
                evidence=EvidenceAttachment(
                    doc=sdn_doc,
                    locators={
                        "entity_name": row_locator("sdn.csv", row_no, "SDN_Name"),
                        "status": row_locator("sdn.csv", row_no, "Program"),
                        "status_notes": row_locator("sdn.csv", row_no, "Remarks"),
                    },
                    default_locator=row_locator("sdn.csv", row_no),
                    document_text=row_text,
                    subject_table="sanctions_list_entries",
                    # `aliases` come from a different document (alt.csv), so
                    # they cannot be excerpted from this one; the remaining
                    # fields are ones this list does not state per row.
                    skip_keys=("aliases", "country", "merchandise", "listed_date"),
                ),
            )
