"""GOTS (Global Organic Textile Standard) certified-supplier scraper.

GOTS publishes its certified-supplier directory as a public JSON API served by
the Global Trace Base (GTB) backend:

    https://www.global-trace-base.org/website-api/v2/certified-suppliers

The list endpoint is paginated by `limit` + `offset` (envelope
`{items, limit, offset, total}`) and supports ISO-2 country filtering
(`country=BD`). The detail endpoint at
`/certified-suppliers/{system_id}` enriches each list row with the GTB license
number, address, certification body, scope categories, and expiry date.

Strategy: paginate the list (884 BD rows as of 2026-05-19), GET the detail
endpoint per row, and emit one `ScrapedRecord` per supplier. Override `run()`
to also write a `public.certifications` row keyed on
`(supplier_id, kind='gots', certificate_no=<gtb_license_number>)`.
"""
from __future__ import annotations

import asyncio
import re
from datetime import date
from typing import Any, AsyncIterator

import httpx

from etl.core.config import settings
from etl.core.db import db, get_source_id
from etl.core.scraper import BaseScraper, ScrapedRecord

API_BASE = "https://www.global-trace-base.org/website-api/v2"
LIST_URL = f"{API_BASE}/certified-suppliers"
DETAIL_URL_TEMPLATE = f"{API_BASE}/certified-suppliers/{{system_id}}"

COUNTRY_CODE = "BD"
PAGE_SIZE = 100
DETAIL_THROTTLE_SEC = 0.2

_DATE_RE = re.compile(r"^(\d{4})-(\d{2})-(\d{2})$")


def _parse_expires(s: str | None) -> date | None:
    if not s:
        return None
    m = _DATE_RE.match(s.strip())
    if not m:
        return None
    try:
        return date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
    except ValueError:
        return None


def _compose_address(detail: dict[str, Any]) -> str | None:
    parts = []
    for k in ("address1", "address2", "address3"):
        v = detail.get(k)
        if v is None:
            continue
        s = str(v).strip()
        if s:
            parts.append(s)
    return " | ".join(parts) or None


def _compose_scope(detail: dict[str, Any]) -> str | None:
    bits = []
    foo = (detail.get("field_of_operation") or "").strip()
    if foo:
        bits.append(f"Operations: {foo}")
    pc = (detail.get("product_category") or "").strip()
    if pc:
        bits.append(f"Products: {pc}")
    return " | ".join(bits) or None


def _absolute_scope_ref(ref: str | None) -> str | None:
    if not ref:
        return None
    s = str(ref).strip()
    if not s:
        return None
    if s.startswith("http://") or s.startswith("https://"):
        return s
    if s.startswith("/"):
        return f"https://www.global-trace-base.org{s}"
    return f"https://www.global-trace-base.org/{s}"


def _certificate_no(detail: dict[str, Any]) -> str:
    lic = (detail.get("gtb_license_number") or "").strip()
    if lic:
        return lic
    return f"gots-{detail['system_id']}"


def _nz(v: Any) -> str | None:
    if v is None:
        return None
    s = str(v).strip()
    return s or None


class GotsScraper(BaseScraper):
    code = "gots"
    source_code = "GOTS"

    async def fetch(self) -> AsyncIterator[ScrapedRecord]:
        headers = {
            "User-Agent": settings.etl_user_agent,
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "en-US,en;q=0.9",
            "Referer": "https://global-standard.org/",
        }
        async with httpx.AsyncClient(timeout=60.0, headers=headers, follow_redirects=True) as client:
            offset = 0
            total: int | None = None
            while True:
                params = {"limit": PAGE_SIZE, "offset": offset, "country": COUNTRY_CODE}
                resp = await client.get(LIST_URL, params=params)
                resp.raise_for_status()
                data = resp.json()
                items = data.get("items") or []
                if total is None:
                    total = int(data.get("total") or 0)
                    self.log.info("gots.list.start", total=total, page_size=PAGE_SIZE)
                if not items:
                    break
                for row in items:
                    sysid = (row.get("system_id") or "").strip()
                    if not sysid:
                        continue
                    detail_url = DETAIL_URL_TEMPLATE.format(system_id=sysid)
                    try:
                        dresp = await client.get(detail_url)
                        dresp.raise_for_status()
                        detail = dresp.json()
                    except Exception as exc:  # noqa: BLE001
                        self.log.warn("gots.detail.failed", system_id=sysid, error=str(exc))
                        detail = dict(row)
                        detail.setdefault("system_id", sysid)
                    await asyncio.sleep(DETAIL_THROTTLE_SEC)

                    name = _nz(detail.get("company_name") or row.get("company_name"))
                    if not name:
                        continue
                    expires = _parse_expires(detail.get("certificate_valid_until"))
                    scope_url = _absolute_scope_ref(detail.get("scope_certificate_ref"))
                    yield ScrapedRecord(
                        source_code="GOTS",
                        source_ref=f"gots-{sysid}",
                        company_name=name,
                        city=_nz(detail.get("city")),
                        address_raw=_compose_address(detail),
                        email=_nz(detail.get("contact_email")),
                        website=_nz(detail.get("website")),
                        contact_name=_nz(detail.get("contact_name")),
                        payload={
                            "gots_system_id": sysid,
                            "gots_license_number": _nz(detail.get("gtb_license_number")),
                            "gots_cb_license_number": _nz(detail.get("cb_license_number")),
                            "gots_certification_body": _nz(detail.get("certification_body")),
                            "gots_field_of_operation": _nz(detail.get("field_of_operation")),
                            "gots_product_category": _nz(detail.get("product_category") or row.get("product_category")),
                            "gots_product_details": _nz(detail.get("product_details")),
                            "gots_brand_names": _nz(detail.get("brand_names") or row.get("brand_names")),
                            "gots_scope_certificate_url": scope_url,
                            "gots_postcode": _nz(detail.get("postcode")),
                            "gots_state": _nz(detail.get("state")),
                            "country": "Bangladesh",
                            "certificate_valid_until": detail.get("certificate_valid_until"),
                            "expires_on": expires.isoformat() if expires else None,
                        },
                    )
                offset += len(items)
                if total is not None and offset >= total:
                    break

    async def run(self) -> dict[str, int]:  # type: ignore[override]
        """Override: also insert into public.certifications keyed on GOTS license."""
        from etl.core.upsert import upsert_supplier_with_source

        run_id = self._open_run()
        seen = upserted = skipped = 0
        try:
            async for rec in self.fetch():
                seen += 1
                try:
                    supplier_id = upsert_supplier_with_source(rec)
                    _write_certification(supplier_id, rec)
                    upserted += 1
                except Exception as exc:  # noqa: BLE001
                    skipped += 1
                    self.log.error("upsert.failed", source_ref=rec.source_ref, error=str(exc))
                if seen % 50 == 0:
                    self.log.info("progress", seen=seen, upserted=upserted, skipped=skipped)
            self._close_run(run_id, "success", seen, upserted, skipped, None)
        except Exception as exc:  # noqa: BLE001
            self._close_run(run_id, "failed", seen, upserted, skipped, str(exc))
            raise
        return {"seen": seen, "upserted": upserted, "skipped": skipped}


def _write_certification(supplier_id: str, rec: ScrapedRecord) -> None:
    p = rec.payload
    src_id = get_source_id("GOTS")
    cert_no = _certificate_no({"gtb_license_number": p.get("gots_license_number"),
                               "system_id": p["gots_system_id"]})
    issuer = p.get("gots_certification_body")
    expires = _parse_expires(p.get("certificate_valid_until"))
    scope_parts = []
    foo = p.get("gots_field_of_operation")
    if foo:
        scope_parts.append(f"Operations: {foo}")
    pc = p.get("gots_product_category")
    if pc:
        scope_parts.append(f"Products: {pc}")
    scope = " | ".join(scope_parts) or None
    doc_url = p.get("gots_scope_certificate_url")

    with db.conn() as c, c.cursor() as cur:
        cur.execute(
            """select id from public.source_records
                where supplier_id = %s and source_id = %s and source_ref = %s""",
            (supplier_id, src_id, rec.source_ref),
        )
        sr = cur.fetchone()
        sr_id = str(sr["id"]) if sr else None
        cur.execute(
            """insert into public.certifications
                 (supplier_id, kind, certificate_no, issuer,
                  issued_on, expires_on, scope, source_record_id, document_url)
               values (%s, 'gots', %s, %s, %s, %s, %s, %s, %s)
               on conflict (supplier_id, kind, certificate_no) do update set
                 issuer = excluded.issuer,
                 expires_on = excluded.expires_on,
                 scope = excluded.scope,
                 source_record_id = excluded.source_record_id,
                 document_url = excluded.document_url""",
            (
                supplier_id,
                cert_no,
                issuer,
                None,
                expires,
                scope,
                sr_id,
                doc_url,
            ),
        )
        c.commit()
