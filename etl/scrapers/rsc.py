"""RSC factory database scraper (spec §6).

RSC's public factory list is rendered client-side by hitting the underlying
Accord/RSC JSON API at https://accord2.fairfactories.org/api/v1/factories.
We call that endpoint directly (paginated) — much faster + more reliable than
driving the SPA with Playwright. Writes a `rsc_remediation` row per matched
supplier; supplier match is fuzzy by name + location. Unmatched RSC factories
are queued in verification_queue.

Transport: direct, wrapped in the acquisition interface. The endpoint returns
typed JSON — floats for remediation progress, integers for worker counts — and
reading a rendering of it instead would mean re-parsing numbers we already have
exactly. The wrapper adds per-field evidence and the shared admin controls.
"""
from __future__ import annotations

import asyncio
import json
import re
from typing import TYPE_CHECKING, Any, AsyncIterator

from etl.acquire import AcquireRequest
from etl.core.acquiring import AcquiringScraper
from etl.core.config import settings
from etl.core.db import db, get_source_id
from etl.core.scraper import EvidenceAttachment, ScrapedRecord
from etl.evidence.locate import NO_EXCERPT, json_locator, json_record_window

if TYPE_CHECKING:
    from etl.acquire import AcquiredDoc

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


class RscScraper(AcquiringScraper):
    code = "rsc"
    source_code = "RSC"
    transport = "direct"
    fallback_transport = None

    @property
    def request_headers(self) -> dict[str, str]:
        return {
            "User-Agent": settings.etl_user_agent,
            "Accept": "application/json",
            "Referer": FACTORIES_URL,
            "Origin": BASE,
        }

    async def fetch(self) -> AsyncIterator[ScrapedRecord]:
        url = RSC_API_FACTORIES
        params: dict[str, Any] | None = {**RSC_DEFAULT_PARAMS, "page": "1"}
        page_num = 1
        while True:
            doc = await self.acquire(
                AcquireRequest(url=url, params=params, label=f"factories page {page_num}")
            )
            if not doc.ok:
                raise RuntimeError(
                    f"rsc: factories page {page_num} unreadable "
                    f"({doc.fetch_status.value}: {doc.error_message})"
                )
            raw = doc.text()
            data = json.loads(raw)
            results = data.get("results") or []
            for fac in results:
                rec = _factory_to_record(fac, doc, raw)
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
        from etl.evidence.writer import reset_document_cache

        run_id = self._open_run()
        reset_document_cache()
        seen = upserted = skipped = 0
        try:
            async for rec in self.fetch():
                seen += 1
                # RSC factories may not yet exist in suppliers table.
                # Try fuzzy match first; if no match, create supplier shell + queue review.
                supplier_id = upsert_supplier_with_source(rec)
                _write_remediation(supplier_id, rec)
                upserted += 1
                await self._record_evidence(rec, supplier_id, run_id)
            self._close_run(run_id, "success", seen, upserted, skipped, None)
        except Exception as e:  # noqa: BLE001
            self._close_run(run_id, "failed", seen, upserted, skipped, str(e))
            raise
        finally:
            await self.aclose()
        return {
            "seen": seen,
            "upserted": upserted,
            "skipped": skipped,
            "transport": self.active_transport,
            "evidence_documents": self.evidence_documents,
            "evidence_claims": self.evidence_claims,
            "credits_used": self.credits_used,
        }


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


# Payload key → the API field it was read from, for JSON-pointer locators.
_JSON_FIELDS = {
    "rsc_factory_name": "factory_name",
    "rsc_location": "location",
    "rsc_progress_pct": "progress",
    "rsc_workers_count": "workers",
    "rsc_parent_group": "supplier/name",
    "rsc_parent_group_factory_count": "supplier/factory_count",
    "rsc_remediation_status": "designation/status",
    "rsc_training_status": "training",
    "rsc_status_name": "status/name",
    "rsc_fire_inspection_url": "inspections/fire",
    "rsc_structural_inspection_url": "inspections/structural",
    "rsc_electrical_inspection_url": "inspections/electrical",
    "rsc_boiler_inspection_url": "inspections/boiler",
    "rsc_cap_url": "cap",
}
# `rsc_factory_id` is the API's own row handle rather than a fact about the
# factory, and `active` is our reading of `status.name` (cited above).
_UNCITABLE_FIELDS = ("rsc_factory_id", "active")


def _factory_to_record(
    fac: dict[str, Any],
    doc: "AcquiredDoc | None" = None,
    raw_page: str | None = None,
) -> ScrapedRecord | None:
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

    evidence: EvidenceAttachment | None = None
    if doc is not None:
        # One response carries up to 200 factories, so excerpt against this
        # factory's own slice of it. Searching the whole page would let another
        # factory's "active" or worker count be cited as this one's.
        # Neither anchor resolving means we cannot tell this factory's bytes from
        # its neighbours', so the claims stay locator-only rather than quoting a
        # window that might belong to a different factory.
        window = (
            json_record_window(raw_page, f'"{name}"')
            or json_record_window(raw_page, f'"{fid}"')
            or NO_EXCERPT
        )
        evidence = EvidenceAttachment(
            doc=doc,
            locators={
                key: json_locator(f"results[factory_id={fid}]/{field}")
                for key, field in _JSON_FIELDS.items()
            },
            default_locator=json_locator(f"results[factory_id={fid}]"),
            document_text=window,
            document_is_html=False,
            skip_keys=_UNCITABLE_FIELDS,
        )

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
        evidence=evidence,
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
