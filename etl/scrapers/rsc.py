"""RSC factory database scraper (spec §6).

RSC's public factory list is rendered client-side by hitting the underlying
Accord/RSC JSON API at https://accord2.fairfactories.org/api/v1/factories.
We call that endpoint directly (paginated) — much faster + more reliable than
driving the SPA with Playwright. Writes a `rsc_remediation` row per matched
supplier; supplier match is fuzzy by name + location. Unmatched RSC factories
are queued in verification_queue.
"""
from __future__ import annotations

import asyncio
import re
from typing import Any, AsyncIterator

import httpx

from etl.core.config import settings
from etl.core.db import db, get_source_id
from etl.core.normalize import normalize_company_name
from etl.core.scraper import BaseScraper, ScrapedRecord

BASE = "https://rsc-bd.org"
FACTORIES_URL = f"{BASE}/factories/"

# Direct JSON API discovered from rsc-bd.org/factories/ page source
# (script `factory_script-js`, var apiGetUrl).
RSC_API_BASE = "https://accord2.fairfactories.org/api/v1"
RSC_API_FACTORIES = f"{RSC_API_BASE}/factories"
# Status filter mirrors the page's default + explicit `ineligible` so we capture
# suspended factories too. progress=0..9 covers the full 0–100% range bucket.
RSC_DEFAULT_PARAMS = {
    "status": "active,inactive,no brand,pending closure,ineligible",
    "progress": "0,1,2,3,4,5,6,7,8,9",
    "language": "en",
    "format": "json",
    "limit": "200",
}

_PCT_RE = re.compile(r"(\d+(?:\.\d+)?)\s*%?")


def _parse_pct(s: str | None) -> float | None:
    if not s:
        return None
    m = _PCT_RE.search(s)
    return float(m.group(1)) if m else None


def _to_int(v: Any) -> int | None:
    if v is None or v == "":
        return None
    try:
        return int(str(v).replace(",", "").strip())
    except (ValueError, TypeError):
        return None


def _progress_to_pct(v: Any) -> float | None:
    """RSC API returns progress as 0..1 float; convert to 0..100."""
    if v is None:
        return None
    try:
        f = float(v)
        return round(f * 100.0, 2) if f <= 1.0 else round(f, 2)
    except (ValueError, TypeError):
        return None


class RscScraper(BaseScraper):
    code = "rsc"
    source_code = "RSC"

    async def fetch(self) -> AsyncIterator[ScrapedRecord]:
        headers = {
            "User-Agent": settings.etl_user_agent,
            "Accept": "application/json",
            "Referer": FACTORIES_URL,
            "Origin": BASE,
        }
        page_num = 1
        async with httpx.AsyncClient(timeout=60.0, headers=headers) as client:
            url = RSC_API_FACTORIES
            params: dict[str, Any] | None = {**RSC_DEFAULT_PARAMS, "page": "1"}
            while True:
                # Retry transient failures
                last_exc: Exception | None = None
                for attempt in range(3):
                    try:
                        resp = await client.get(url, params=params)
                        resp.raise_for_status()
                        break
                    except (httpx.HTTPError,) as exc:  # noqa: PERF203
                        last_exc = exc
                        await asyncio.sleep(2 ** attempt)
                else:
                    raise RuntimeError(f"RSC API failed after retries: {last_exc}")

                data = resp.json()
                results = data.get("results") or []
                for fac in results:
                    rec = _factory_to_record(fac)
                    if rec:
                        yield rec

                pagination = data.get("pagination") or {}
                next_path = pagination.get("next")
                if not next_path:
                    break
                # `next` is a relative path like "/factories?...&page=2"
                url = RSC_API_BASE + next_path
                params = None  # next URL already carries query string
                page_num += 1
                # Friendly throttle — full crawl is ~10 pages at limit=200
                await asyncio.sleep(0.3)

    async def run(self) -> dict[str, int]:
        """Override: RSC also writes rsc_remediation + queues unmatched."""
        from etl.core.upsert import upsert_supplier_with_source

        run_id = self._open_run()
        seen = upserted = skipped = 0
        try:
            async for rec in self.fetch():
                seen += 1
                # RSC factories may not yet exist in suppliers table.
                # Try fuzzy match first; if no match, create supplier shell + queue review.
                supplier_id = upsert_supplier_with_source(rec)
                _write_remediation(supplier_id, rec)
                upserted += 1
            self._close_run(run_id, "success", seen, upserted, skipped, None)
        except Exception as e:  # noqa: BLE001
            self._close_run(run_id, "failed", seen, upserted, skipped, str(e))
            raise
        return {"seen": seen, "upserted": upserted, "skipped": skipped}


def _extract_factories(data: Any) -> list[dict[str, Any]]:
    """Heuristic: hunt for arrays of dicts with factory-shaped keys."""
    found: list[dict[str, Any]] = []

    def walk(node: Any) -> None:
        if isinstance(node, list):
            if node and isinstance(node[0], dict) and any(
                k in node[0] for k in ("factory_name", "name", "factoryId", "factory_id")
            ):
                found.extend(node)
            else:
                for x in node:
                    walk(x)
        elif isinstance(node, dict):
            for v in node.values():
                walk(v)

    walk(data)
    return found


def _factory_to_record(fac: dict[str, Any]) -> ScrapedRecord | None:
    name = fac.get("factory_name") or fac.get("name") or fac.get("factoryName")
    if not name:
        return None
    fid = str(fac.get("factory_id") or fac.get("factoryId") or fac.get("id") or name)

    inspections = fac.get("inspections") or {}
    supplier_group = fac.get("supplier") or {}
    designation = fac.get("designation") or {}
    status_block = fac.get("status") or {}

    progress_pct = _progress_to_pct(fac.get("progress"))
    workers = _to_int(fac.get("workers"))

    return ScrapedRecord(
        source_code="RSC",
        source_ref=fid,
        company_name=name,
        address_raw=fac.get("address") or fac.get("location"),
        city=fac.get("district") or fac.get("city"),
        payload={
            "rsc_factory_id": fid,
            "rsc_factory_name": name,
            "rsc_location": fac.get("location") or fac.get("district"),
            "rsc_progress_pct": progress_pct,
            "rsc_workers_count": workers,
            "rsc_parent_group": supplier_group.get("name") if isinstance(supplier_group, dict) else None,
            "rsc_parent_group_factory_count": (
                supplier_group.get("factory_count") if isinstance(supplier_group, dict) else None
            ),
            "rsc_remediation_status": designation.get("status") if isinstance(designation, dict) else None,
            "rsc_training_status": fac.get("training"),
            "rsc_status_name": status_block.get("name") if isinstance(status_block, dict) else None,
            "rsc_fire_inspection_url": inspections.get("fire") if isinstance(inspections, dict) else None,
            "rsc_structural_inspection_url": (
                inspections.get("structural") if isinstance(inspections, dict) else None
            ),
            "rsc_electrical_inspection_url": (
                inspections.get("electrical") if isinstance(inspections, dict) else None
            ),
            "rsc_boiler_inspection_url": (
                inspections.get("boiler") if isinstance(inspections, dict) else None
            ),
            "rsc_cap_url": fac.get("cap"),
            "active": (status_block.get("name") == "active") if isinstance(status_block, dict) else True,
            "raw": fac,
        },
    )


def _write_remediation(supplier_id: str, rec: ScrapedRecord) -> None:
    p = rec.payload
    src_id = get_source_id("RSC")
    with db.conn() as c, c.cursor() as cur:
        cur.execute(
            """select id from public.source_records
                where supplier_id = %s and source_id = %s and source_ref = %s""",
            (supplier_id, src_id, rec.source_ref),
        )
        sr = cur.fetchone()
        sr_id = str(sr["id"]) if sr else None
        cur.execute(
            """insert into public.rsc_remediation
                 (supplier_id, rsc_factory_id, rsc_factory_name,
                  progress_pct, workers_count,
                  parent_group_name, parent_group_factory_count,
                  remediation_status, training_status,
                  fire_inspection_url, structural_inspection_url,
                  electrical_inspection_url, boiler_inspection_url, cap_url,
                  active, source_record_id)
               values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
               on conflict (supplier_id) do update set
                 rsc_factory_id = excluded.rsc_factory_id,
                 rsc_factory_name = excluded.rsc_factory_name,
                 progress_pct = excluded.progress_pct,
                 workers_count = excluded.workers_count,
                 parent_group_name = excluded.parent_group_name,
                 parent_group_factory_count = excluded.parent_group_factory_count,
                 remediation_status = excluded.remediation_status,
                 training_status = excluded.training_status,
                 fire_inspection_url = excluded.fire_inspection_url,
                 structural_inspection_url = excluded.structural_inspection_url,
                 electrical_inspection_url = excluded.electrical_inspection_url,
                 boiler_inspection_url = excluded.boiler_inspection_url,
                 cap_url = excluded.cap_url,
                 active = excluded.active,
                 source_record_id = excluded.source_record_id,
                 fetched_at = now()""",
            (
                supplier_id,
                p.get("rsc_factory_id"), p.get("rsc_factory_name"),
                p.get("rsc_progress_pct"), p.get("rsc_workers_count"),
                p.get("rsc_parent_group"), p.get("rsc_parent_group_factory_count"),
                p.get("rsc_remediation_status"), p.get("rsc_training_status"),
                p.get("rsc_fire_inspection_url"), p.get("rsc_structural_inspection_url"),
                p.get("rsc_electrical_inspection_url"), p.get("rsc_boiler_inspection_url"),
                p.get("rsc_cap_url"),
                bool(p.get("active", True)), sr_id,
            ),
        )
        c.commit()
