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

log = get_logger("etl.jobs.barikoi_geocode")

RUPANTOR_URL = "https://barikoi.xyz/v2/api/search/rupantor/geocode"

# Keep in sync with `normalizeAddressKey` in lib/barikoi.ts.
_WS = re.compile(r"\s+")


def normalize_key(address: str) -> str:
    return _WS.sub(" ", address.strip().lower())


def _list_pending(limit: int | None) -> list[str]:
    """Distinct not-yet-geocoded addresses, longest first (more specific
    addresses geocode better and serve the profile map sooner)."""
    sql = """
        with candidates as (
            select distinct address from public.v_supplier_addresses
             where address is not null and length(trim(address)) >= 8
            union
            select distinct address_raw from public.suppliers
             where address_raw is not null and length(trim(address_raw)) >= 8
        )
        select c.address
          from candidates c
         where not exists (
                 select 1 from public.address_geocodes g
                  where g.address_norm = lower(regexp_replace(trim(c.address), '\\s+', ' ', 'g'))
               )
         order by length(c.address) desc
    """
    if limit is not None:
        sql += " limit %s"
    with db.conn() as c, c.cursor() as cur:
        cur.execute(sql, (limit,) if limit is not None else None)
        rows = cur.fetchall()
    return [r["address"] if isinstance(r, dict) else r[0] for r in rows]


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
    # Rupantor is 2 credits/call; keep a polite fixed rate regardless of
    # the scraper-wide default.
    async with HttpClient(rps=2.0) as http:
        for address in addresses:
            stats["scanned"] += 1
            try:
                resp = await http.post(
                    f"{RUPANTOR_URL}?api_key={api_key}",
                    data={"q": address, "district": "yes", "thana": "yes"},
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
