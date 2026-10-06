"""WRAP (Worldwide Responsible Accredited Production) certified-facility scraper.

WRAP publishes its certified-facility list through the map on
wrapcompliance.org/facilities, which loads one public JSON feed:
`https://wrap-maps.azurewebsites.net/api/facilities` (no key, no cookies). It
replaced the Power BI report in October 2026; the report's resource key now
answers 401. The feed lists certified facilities only, every country, with the
same WRAP IDs as the report.

Strategy: GET the feed, keep `country == "BD"`, and emit one `ScrapedRecord`
per facility. Override `run()` to also write a `public.certifications` row
keyed on `(supplier_id, kind='wrap', certificate_no=wrap_id)`.

Transport: direct, wrapped in the acquisition interface (plain JSON).
"""
from __future__ import annotations

import json
import re
from datetime import date
from typing import Any, AsyncIterator

from etl.acquire import AcquireRequest
from etl.core.acquiring import AcquiringScraper
from etl.core.config import settings
from etl.core.db import db, get_source_id
from etl.core.scraper import EvidenceAttachment, ScrapedRecord
from etl.evidence.locate import NO_EXCERPT, json_record_window

WRAP_FEED_URL = "https://wrap-maps.azurewebsites.net/api/facilities"

# Public facility profile (informational — the page itself is JS-rendered)
WRAP_FACILITY_URL_TEMPLATE = "https://wrapcompliance.org/certified-facility/{wrap_id}/"

# Scope filter: SourceBD covers the RMG supply chain (apparel + textile +
# trims). Drop a WRAP row only when EVERY product category it lists is in this
# non-RMG set (e.g. pure footwear). Multi-category rows that include any
# apparel/knit/woven/sweater/etc. token are kept.
_NON_RMG_CATEGORIES = {"footwear"}


def _is_non_rmg_only(products: Any) -> bool:
    if not products:
        return False
    tokens = {t.strip().lower() for t in str(products).split(",") if t.strip()}
    if not tokens:
        return False
    return tokens.issubset(_NON_RMG_CATEGORIES)


_DATE_RE = re.compile(r"^(\d{4})-(\d{2})-(\d{2})$")


def _bangladesh_facilities(payload: dict[str, Any]) -> list[dict[str, Any]]:
    """The feed's Bangladesh rows. Raises when the feed's shape is not the one
    we read, so a changed feed fails the run instead of reporting no facilities."""
    rows = payload.get("facilities")
    if not isinstance(rows, list) or not rows:
        raise RuntimeError("wrap: the feed has no `facilities` list; its shape changed.")
    return [r for r in rows if isinstance(r, dict) and r.get("country") == "BD"]


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


# Every feed value sits inline in its own facility object, so each claim can be
# excerpted from the window around its WRAP ID. These three are ours, not the
# feed's (a two-letter code, a URL we build, a date we parse), so they carry no
# excerpt.
_UNCITABLE_FIELDS = (
    "wrap_country",
    "wrap_profile_url",
    "expires_on",
)


class WrapScraper(AcquiringScraper):
    code = "wrap"
    # Founder knob (`run <code> --accept-delistings`): release a held
    # certificate reconcile (etl.core.cert_reconcile).
    accept_delistings = False
    source_code = "WRAP"
    transport = "direct"
    fallback_transport = None

    @property
    def request_headers(self) -> dict[str, str]:
        return {
            "Accept": "application/json, text/plain, */*",
            "Referer": "https://wrap-maps.azurewebsites.net/facility-map",
            "User-Agent": settings.etl_user_agent,
        }

    async def fetch(self) -> AsyncIterator[ScrapedRecord]:
        doc = await self.acquire(
            AcquireRequest(url=WRAP_FEED_URL, label="certified facilities (all countries)")
        )
        if not doc.ok:
            raise RuntimeError(
                f"wrap: facility feed failed ({doc.fetch_status.value}: "
                f"{doc.error_message}). Refusing to report an empty facility list."
            )
        raw = doc.text()
        facilities = _bangladesh_facilities(json.loads(raw))
        if not facilities:
            raise RuntimeError("wrap: the feed lists no Bangladesh facility. Refusing to report none.")
        self.log.info("wrap.fetched", count=len(facilities))
        for fac in facilities:
            wrap_id = fac.get("wrap_id")
            name = fac.get("facility_name")
            if not wrap_id or not name:
                continue
            # Scope filter: SourceBD covers RMG (apparel + textile + trims).
            # WRAP certifies cross-industry; skip rows whose products field is
            # exclusively a non-RMG category (e.g. "Footwear"). Multi-category
            # rows that include any apparel/knit/woven token still pass.
            if _is_non_rmg_only(fac.get("products")):
                self.log.info(
                    "wrap.skip_non_rmg",
                    wrap_id=str(wrap_id).strip(),
                    name=str(name).strip(),
                    products=fac.get("products"),
                )
                continue
            wrap_id_s = str(wrap_id).strip()
            expires = _parse_expires(fac.get("certification_expiration"))
            city = (fac.get("city") or "").strip()
            loc = f"json:facilities[wrap_id={wrap_id_s}]"
            yield ScrapedRecord(
                source_code="WRAP",
                source_ref=f"wrap-{wrap_id_s}",
                company_name=str(name).strip(),
                city=city if city and city.upper() != "NA" else None,
                payload={
                    "wrap_id": wrap_id_s,
                    "wrap_industries": fac.get("industry") or None,
                    "wrap_products": fac.get("products") or None,
                    "wrap_cert_expires": fac.get("certification_expiration"),
                    "wrap_country": fac.get("country"),
                    "wrap_profile_url": WRAP_FACILITY_URL_TEMPLATE.format(wrap_id=wrap_id_s),
                    "expires_on": expires.isoformat() if expires else None,
                },
                evidence=EvidenceAttachment(
                    doc=doc,
                    locators={
                        "wrap_id": f"{loc}/wrap_id",
                        "wrap_industries": f"{loc}/industry",
                        "wrap_products": f"{loc}/products",
                        "wrap_cert_expires": f"{loc}/certification_expiration",
                    },
                    default_locator=loc,
                    document_text=json_record_window(raw, f'"wrap_id":"{wrap_id_s}"')
                    or NO_EXCERPT,
                    document_is_html=False,
                    skip_keys=_UNCITABLE_FIELDS,
                    # No `citable_url_override`: one feed backs every facility,
                    # so a per-facility override would stamp the first one's
                    # profile URL onto the document all the others cite too.
                    # `wrap_profile_url` already carries the public page.
                ),
            )

    async def run(self) -> dict[str, int]:
        """Override: also insert into public.certifications keyed on WRAP ID."""
        from etl.core.upsert import upsert_supplier_with_source
        from etl.evidence.writer import reset_document_cache

        run_id = self._open_run()
        reset_document_cache()
        seen = upserted = skipped = 0
        seen_certs: set[str] = set()
        self._emit_progress(run_id, "started", "WRAP scraper started.", seen, upserted, skipped)
        try:
            async for rec in self.gated():
                seen += 1
                seen_certs.add(str(rec.payload["wrap_id"]))
                try:
                    supplier_id = upsert_supplier_with_source(rec)
                    if supplier_id is not None:
                        _write_certification(supplier_id, rec)
                        upserted += 1
                except Exception as exc:  # noqa: BLE001
                    skipped += 1
                    self.log.error("upsert.failed", source_ref=rec.source_ref, error=str(exc))
                else:
                    if supplier_id is None:
                        # Unchanged payload: fetched_at was touched, nothing else to do.
                        skipped += 1
                    else:
                        await self._record_evidence(rec, supplier_id, run_id)
                if seen % 50 == 0:
                    self.log.info("progress", seen=seen, upserted=upserted, skipped=skipped)
                    self._update_run_progress(run_id, seen, upserted, skipped)
                    self._emit_progress(
                        run_id,
                        "progress",
                        f"Checked {seen} WRAP facilities.",
                        seen,
                        upserted,
                        skipped,
                    )
            from etl.core.cert_reconcile import reconcile_certificates

            reconcile_certificates(
                kind="wrap", scraper_code=self.code, run_id=run_id,
                seen_cert_nos=seen_certs,
                read_complete=not (self.breaker and self.breaker.tripped),
                accept=self.accept_delistings,
            )
            self._close_run(run_id, "success", seen, upserted, skipped, None)
        except Exception as exc:  # noqa: BLE001
            self._close_run(run_id, "failed", seen, upserted, skipped, str(exc))
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


def _write_certification(supplier_id: str, rec: ScrapedRecord) -> None:
    p = rec.payload
    src_id = get_source_id("WRAP")
    scope_parts = []
    if p.get("wrap_cert_type"):
        scope_parts.append(str(p["wrap_cert_type"]))
    if p.get("wrap_industries"):
        scope_parts.append(f"Industries: {p['wrap_industries']}")
    if p.get("wrap_products"):
        scope_parts.append(f"Products: {p['wrap_products']}")
    scope = " | ".join(scope_parts) or None
    expires_iso = p.get("expires_on")

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
               values (%s, 'wrap', %s, %s, %s, %s, %s, %s, %s)
               on conflict (supplier_id, kind, certificate_no) do update set
                 issuer = excluded.issuer,
                 expires_on = excluded.expires_on,
                 scope = excluded.scope,
                 source_record_id = excluded.source_record_id,
                 document_url = excluded.document_url""",
            (
                supplier_id,
                p["wrap_id"],
                "WRAP",
                None,
                expires_iso,
                scope,
                sr_id,
                p.get("wrap_profile_url"),
            ),
        )
        c.commit()
