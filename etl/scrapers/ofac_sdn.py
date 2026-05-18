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
"""
from __future__ import annotations

import csv
import io
from datetime import date
from typing import AsyncIterator

from etl.core.http import HttpClient
from etl.core.normalize import normalize_company_name
from etl.core.sanctions import BaseSanctionScraper, SanctionEntry

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


def _slugify(s: str) -> str:
    import re
    s = normalize_company_name(s)
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s[:200] or "unnamed"


class OfacSdnScraper(BaseSanctionScraper):
    code = "ofac_sdn"
    source_code = "OFAC"

    async def fetch(self) -> AsyncIterator[SanctionEntry]:
        async with HttpClient(rps=0.5) as http:
            sdn_resp = await http.get(SDN_URL)
            sdn_text = sdn_resp.text

            # Aliases from alt.csv: ent_num, alt_num, alt_type, alt_name, alt_remarks
            aliases_by_ent: dict[str, list[str]] = {}
            try:
                alt_resp = await http.get(ALT_URL)
                for row in csv.reader(io.StringIO(alt_resp.text)):
                    if len(row) < 4:
                        continue
                    ent = (row[0] or "").strip()
                    alt_name = _clean(row[3])
                    if ent and alt_name:
                        aliases_by_ent.setdefault(ent, []).append(alt_name)
            except Exception:
                # alt.csv currently 400s for some clients; canonical SDN entries
                # remain authoritative without aliases.
                pass

        seen_refs: set[str] = set()
        today = date.today()

        for row in csv.reader(io.StringIO(sdn_text)):
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
                source_url=SDN_URL,
                raw={
                    "ent_num": ent_num,
                    "sdn_type": sdn_type,
                    "program": program,
                    "fetched_at": today.isoformat(),
                },
            )
