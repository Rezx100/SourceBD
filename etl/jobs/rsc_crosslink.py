"""F6 — RSC name-stripped cross-link backfill.

For every RSC-source supplier with `suppliers.district IS NULL`, derive
district (and city) by matching a normalised name key against suppliers
that already have district populated from a Tier 1-3 source.

Normalisation rules (tight — keep business-domain words):
  * strip every `(...)` / `[...]` block (any position)
  * strip trailing " - <tail>" / " \u2013 <tail>" suffix
  * lowercase, remove punctuation, collapse whitespace
  * drop extension/annex/relocated/unit-N markers
  * drop legal-entity suffixes (ltd, limited, pvt, plc, co, inc)
  * drop bare digits
  * require resulting key length >= 6 characters

Safe-match rule:
  * exactly one distinct (district, city) hit, OR
  * multiple hits all sharing the same district (fill district only,
    let F5a / future passes fill city later)

Idempotent. Fill-only (COALESCE). No new crawls.
"""
from __future__ import annotations

import re

from etl.core.db import db, get_source_id
from etl.core.logging import get_logger

log = get_logger("etl.jobs.rsc_crosslink")


_PAREN_RE   = re.compile(r"[\(\[][^)\]]*[\)\]]")
_DASH_TAIL  = re.compile(r"\s+[-\u2013]\s+.+$")
_SUFFIX_RE  = re.compile(
    r"\b(extension(\s+(building|unit)?)?|new\s+(building|unit|shed|extension(\s+unit)?)|"
    r"annex(ed)?|relocated|woven\s+unit|unit[-\s]?\d+|unit\s+\w+|building\s+\d+|"
    r"factory\s+\d+|new|old)\b",
    re.I,
)
_LEGAL_RE   = re.compile(r"\b(ltd\.?|limited|pvt\.?|private|p\.?l\.?c\.?|plc|co\.?|company|inc\.?)\b", re.I)
_PUNCT_RE   = re.compile(r"[^\w\s]")
_WS_RE      = re.compile(r"\s+")
_DIGIT_RE   = re.compile(r"\b\d+\b")

_MIN_KEY_LEN = 6


def _norm(name: str | None) -> str:
    if not name:
        return ""
    s = _PAREN_RE.sub(" ", name)
    s = _DASH_TAIL.sub(" ", s)
    s = s.lower()
    s = _PUNCT_RE.sub(" ", s)
    s = _SUFFIX_RE.sub(" ", s)
    s = _LEGAL_RE.sub(" ", s)
    s = _DIGIT_RE.sub(" ", s)
    s = _WS_RE.sub(" ", s).strip()
    return s


def run() -> dict[str, int]:
    rsc_id = get_source_id("RSC")
    stats = {
        "pool": 0,
        "scanned": 0,
        "safe_matched": 0,
        "ambiguous": 0,
        "no_match": 0,
        "too_short": 0,
        "district_filled": 0,
        "city_filled": 0,
    }

    with db.conn() as c, c.cursor() as cur:
        # Build index of (norm_key -> list of (district, city)) from every
        # supplier that already has a district populated.
        cur.execute(
            "select company_name, district, city "
            "from public.suppliers where district is not null"
        )
        idx: dict[str, list[tuple[str, str | None]]] = {}
        for row in cur.fetchall():
            d = row if isinstance(row, dict) else {"company_name": row[0], "district": row[1], "city": row[2]}
            k = _norm(d["company_name"])
            if len(k) < _MIN_KEY_LEN:
                continue
            idx.setdefault(k, []).append((d["district"], d["city"]))

        # Target pool: RSC suppliers with no district.
        cur.execute(
            """select distinct s.id, s.company_name
                 from public.suppliers s
                 join public.source_records sr on sr.supplier_id = s.id
                where s.district is null
                  and sr.source_id = %s""",
            (rsc_id,),
        )
        rows = cur.fetchall()
        stats["pool"] = len(rows)
        log.info("rsc_crosslink.start", pool=stats["pool"], index_keys=len(idx))

        for row in rows:
            d = row if isinstance(row, dict) else {"id": row[0], "company_name": row[1]}
            stats["scanned"] += 1
            sid = str(d["id"])
            k = _norm(d["company_name"])
            if len(k) < _MIN_KEY_LEN:
                stats["too_short"] += 1
                continue
            hits = idx.get(k)
            if not hits:
                stats["no_match"] += 1
                continue

            distinct_full = {(h[0], h[1]) for h in hits}
            if len(distinct_full) == 1:
                new_district, new_city = next(iter(distinct_full))
            else:
                distinct_d = {h[0] for h in hits}
                if len(distinct_d) == 1:
                    # district agrees, city varies — fill district only
                    new_district = next(iter(distinct_d))
                    new_city = None
                else:
                    stats["ambiguous"] += 1
                    continue

            stats["safe_matched"] += 1
            cur.execute(
                "select district, city from public.suppliers where id = %s",
                (sid,),
            )
            cur_row = cur.fetchone()
            cd = cur_row if isinstance(cur_row, dict) else {"district": cur_row[0], "city": cur_row[1]}
            cur.execute(
                "update public.suppliers set "
                "district = coalesce(district, %s), "
                "city = coalesce(city, %s) "
                "where id = %s",
                (new_district, new_city, sid),
            )
            if new_district and cd["district"] is None:
                stats["district_filled"] += 1
            if new_city and cd["city"] is None:
                stats["city_filled"] += 1
            c.commit()

            if stats["scanned"] % 200 == 0:
                log.info("rsc_crosslink.progress", **stats)

    log.info("rsc_crosslink.done", **stats)
    return stats
