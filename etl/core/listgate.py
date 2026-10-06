"""Skip a detail fetch when the list row it came from is unchanged.

The bkmea_detail pattern (`_needs_enrichment`), shared: a scraper that reads a
list and then one detail page per row stores the list row's hash in the
record's payload. On the next read, an equal list hash means the detail cannot
have been re-published, so the scraper re-emits the stored record instead of
fetching. Used by GOTS and OEKO-TEX (S2); the registers follow in S5.
"""
from __future__ import annotations

import hashlib
import json
from typing import Any, Callable

from etl.core.db import db, get_source_id
from etl.core.scraper import ScrapedRecord


def list_row_hash(row: dict[str, Any]) -> str:
    blob = json.dumps(row, sort_keys=True, ensure_ascii=False, default=str)
    return hashlib.sha256(blob.encode("utf-8")).hexdigest()


def unchanged_record(
    *, source_code: str, source_ref: str, company_name: str, key: str, list_hash: str,
    still_good: Callable[[dict[str, Any]], bool] | None = None,
) -> ScrapedRecord | None:
    """The stored record for this ref when its list hash still matches.

    The returned record carries the stored hash (`known_hash`), so the upsert
    treats it as unchanged: it touches `fetched_at` and writes nothing else.
    None means fetch the detail: new ref, changed row, ambiguous ref, a
    record stored before list hashes existed, or `still_good(fields)` is false
    (a fact the list row does not carry may be due to change, e.g. an expiry).
    """
    with db.conn() as c, c.cursor() as cur:
        cur.execute(
            "select supplier_id, fields, raw_hash from public.source_records "
            "where source_id = %s and source_ref = %s",
            (get_source_id(source_code), source_ref),
        )
        rows = cur.fetchall()
    if len(rows) != 1 or not rows[0]["raw_hash"]:
        return None
    fields = rows[0]["fields"] or {}
    if fields.get(key) != list_hash:
        return None
    if still_good is not None and not still_good(fields):
        return None
    return ScrapedRecord(
        source_code=source_code,
        source_ref=source_ref,
        company_name=company_name,
        payload=dict(fields),
        known_hash=rows[0]["raw_hash"],
    )
