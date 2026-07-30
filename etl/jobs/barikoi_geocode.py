"""Barikoi Rupantor geocode backfill (Spec: Barikoi integration).

Walks distinct addresses from `public.v_supplier_addresses` (plus
`suppliers.address_raw`) that have no row in `public.address_geocodes`
yet, geocodes each through Barikoi's Rupantor API, and caches the result —
including negative results, so an unresolvable address is billed once,
not on every run.

The web profile map only ever READS `address_geocodes`; this job is the
only writer. Rupantor costs 2 API calls per request, so runs are rate
limited and support `--limit` for incremental backfill within plan quota.

Hard-rule note: this writes only to the dedicated cache table. It never
touches `suppliers` or `source_records`, so the source trust hierarchy is
unaffected — coordinates are display metadata, not registry facts.
"""
from __future__ import annotations

import asyncio
import re

from etl.core.config import settings
from etl.core.db import db
from etl.core.http import HttpClient
from etl.core.logging import get_logger
from etl.lib.bd_place_lexicon import apply_place_lexicon

log = get_logger("etl.jobs.barikoi_geocode")

RUPANTOR_URL = "https://barikoi.xyz/v2/api/search/rupantor/geocode"

# Keep in sync with `normalizeAddressKey` in lib/barikoi.ts (REZ-28:
# place lexicon applied so variant spellings share the same cache key).
_WS = re.compile(r"\s+")


def normalize_key(address: str) -> str:
    lower = _WS.sub(" ", address.strip().lower())
    return _WS.sub(" ", apply_place_lexicon(lower)).strip()


_CANDIDATES_SQL = """
    with candidates as (
        select distinct address from public.v_supplier_addresses
         where address is not null and length(trim(address)) >= 8
        union
        select distinct address_raw from public.suppliers
         where address_raw is not null and length(trim(address_raw)) >= 8
    )
    select c.address
      from candidates c
     order by length(c.address) desc
"""


def _rows_to_list(rows: list, column: str) -> list[str]:
    return [r[column] if isinstance(r, dict) else r[0] for r in rows]


def select_pending(
    candidates: list[str], cached_keys: set[str], limit: int | None
) -> list[str]:
    """Which candidate addresses still need geocoding, longest first.

    Deliberately not a SQL `not exists` against `address_geocodes`, even though
    that is the obvious shape and is what this did until 31 Jul 2026. The cache
    key is `normalize_key`, which runs the place lexicon, so `Jessore` is stored
    under `jashore`. SQL cannot reproduce that without a second copy of the
    lexicon, and the copy it had instead — plain lower/whitespace — computed a
    different key. Every address the lexicon rewrites therefore failed to match
    its own cache row, was re-reported as pending, and cost 2 more Rupantor calls
    on every run, forever. `on conflict do nothing` absorbed the duplicate write
    and the run counted it as resolved, so nothing surfaced but the invoice.

    Doing the comparison here means `normalize_key` is the only thing that ever
    computes a key, which is the property that was missing. Both sides are short
    strings in the tens of thousands, so holding them in memory is cheap next to
    the API calls this saves.
    """
    pending: list[str] = []
    seen: set[str] = set()
    for address in candidates:
        key = normalize_key(address)
        # `seen` also collapses spelling variants that share one key. Two raw
        # forms of one address are two Rupantor calls that write a single cache
        # row, so the second was always paying to be discarded.
        if not key or key in cached_keys or key in seen:
            continue
        seen.add(key)
        pending.append(address)
        if limit is not None and len(pending) >= limit:
            break
    return pending


def _list_pending(limit: int | None) -> list[str]:
    """Distinct not-yet-geocoded addresses, longest first (more specific
    addresses geocode better and serve the profile map sooner)."""
    with db.conn() as c, c.cursor() as cur:
        cur.execute(_CANDIDATES_SQL)
        candidates = _rows_to_list(cur.fetchall(), "address")
        cur.execute("select address_norm from public.address_geocodes")
        cached = set(_rows_to_list(cur.fetchall(), "address_norm"))
    # The limit is applied after filtering, as it was when SQL did the filtering:
    # it is a quota control on calls actually made, not on rows examined.
    return select_pending(candidates, cached, limit)


def _store(address: str, payload: dict | None) -> None:
    geo = (payload or {}).get("geocoded_address") or {}

    def _num(v: object) -> float | None:
        try:
            f = float(v)  # type: ignore[arg-type]
            return f if f != 0 else None
        except (TypeError, ValueError):
            return None

    lat = _num(geo.get("latitude"))
    lng = _num(geo.get("longitude"))
    with db.conn() as c, c.cursor() as cur:
        cur.execute(
            """
            insert into public.address_geocodes
              (address_norm, address_raw, latitude, longitude, fixed_address,
               district, thana, address_status, confidence_pct)
            values (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            on conflict (address_norm) do nothing
            """,
            (
                normalize_key(address),
                address.strip(),
                lat,
                lng,
                (payload or {}).get("fixed_address"),
                geo.get("district"),
                geo.get("thana"),
                (payload or {}).get("address_status"),
                (payload or {}).get("confidence_score_percentage"),
            ),
        )
        c.commit()


async def _geocode_all(addresses: list[str], api_key: str) -> dict[str, int]:
    stats = {"scanned": 0, "resolved": 0, "unresolved": 0, "failed": 0}
    # Base-only Rupantor request = 2 credits/call (district + thana params
    # each add +1 credit and are not used by the map — omitted to halve cost).
    # Sequential loop intentional: concurrent gather caused a 429 thundering-
    # herd where all 8 in-flight tasks retry simultaneously, compounding the
    # rate-limit problem. 2 RPS sequential is predictable and stays well under
    # Barikoi's observed sustained limit.
    async with HttpClient(rps=2.0) as http:
        for address in addresses:
            stats["scanned"] += 1
            try:
                resp = await http.post(
                    f"{RUPANTOR_URL}?api_key={api_key}",
                    data={"q": address},
                )
                payload = resp.json()
                _store(address, payload)
                geo = (payload or {}).get("geocoded_address") or {}
                if geo.get("latitude") and geo.get("longitude"):
                    stats["resolved"] += 1
                else:
                    stats["unresolved"] += 1
            except Exception as exc:  # noqa: BLE001
                # Do NOT cache transport failures — retry next run.
                stats["failed"] += 1
                log.error("barikoi_geocode.row_failed", address=address[:80], error=str(exc))
            if stats["scanned"] % 100 == 0:
                log.info("barikoi_geocode.progress", **stats)
    return stats


def run(limit: int | None = None, dry_run: bool = False) -> dict[str, int]:
    api_key = settings.resolved_barikoi_api_key
    if not api_key:
        raise RuntimeError("BARIKOI_API_KEY is not set in .env")
    pending = _list_pending(limit)
    log.info("barikoi_geocode.start", pending=len(pending), dry_run=dry_run)
    if dry_run:
        return {"pending": len(pending)}
    stats = asyncio.run(_geocode_all(pending, api_key))
    log.info("barikoi_geocode.done", **stats)
    return stats
