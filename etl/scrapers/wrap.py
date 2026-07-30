"""WRAP (Worldwide Responsible Accredited Production) certified-facility scraper.

WRAP publishes its certified-facility list as a public Power BI report
(`https://app.powerbi.com/view?r=…`). The dashboard data is served by a public
querydata endpoint that accepts a per-report resource key in
`x-powerbi-resourcekey` — no auth token, no cookies.

Strategy: POST a Semantic Query DataShape command for the `CertifiedFacilities`
entity, filtered to `Country = 'Bangladesh'`, decode the returned DSR (Data
Stream Representation), and emit one `ScrapedRecord` per facility. Override
`run()` to also write a `public.certifications` row keyed on
`(supplier_id, kind='wrap', certificate_no=WRAPID)`.

Transport: direct, wrapped in the acquisition interface. The payload is a Power BI
semantic query — a POST with a resource-key header returning a dictionary-encoded
DSR blob — which no scraping API can express and which has to be decoded, not
rendered. The wrapper adds per-field evidence and the shared admin controls.
"""
from __future__ import annotations

import json
import re
import uuid
from datetime import date
from typing import Any, AsyncIterator

from etl.acquire import AcquireRequest
from etl.core.acquiring import AcquiringScraper
from etl.core.config import settings
from etl.core.db import db, get_source_id
from etl.core.scraper import EvidenceAttachment, ScrapedRecord
from etl.evidence.locate import NO_EXCERPT, raw_window

PBI_CLUSTER = "https://wabi-us-east2-api.analysis.windows.net"
PBI_QUERY_URL = f"{PBI_CLUSTER}/public/reports/querydata?synchronous=true"

# Public WRAP "Certified Facilities" Power BI report
WRAP_RESOURCE_KEY = "f5af2bce-8672-47fe-858f-0a71c1498d01"
WRAP_MODEL_ID = 8219769
WRAP_DATASET_ID = "3f33f3bb-30ce-4532-a795-dc18afd66a26"
WRAP_REPORT_ID = "0dbdf194-8a5c-422c-9102-8761299e3c60"
WRAP_VISUAL_ID = "84b9582660511296522e"

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

# Power BI returns columns positionally as G0..G7; map to friendly names in the
# same order as the `Select` clause in _build_query().
_COL_MAP = {
    "G0": "WRAPID",
    "G1": "Name",
    "G2": "CertType",
    "G3": "Industries",
    "G4": "City",
    "G5": "CertExpires",
    "G6": "Products",
    "G7": "Country",
}


def _build_query(country: str) -> dict[str, Any]:
    return {
        "version": "1.0.0",
        "queries": [{
            "Query": {"Commands": [{
                "SemanticQueryDataShapeCommand": {
                    "Query": {
                        "Version": 2,
                        "From": [{"Name": "c", "Entity": "CertifiedFacilities", "Type": 0}],
                        "Select": [
                            {"Column": {"Expression": {"SourceRef": {"Source": "c"}},
                                        "Property": "WRAPID"}, "Name": "WRAPID"},
                            {"Column": {"Expression": {"SourceRef": {"Source": "c"}},
                                        "Property": "Facility Name"}, "Name": "Name"},
                            {"Column": {"Expression": {"SourceRef": {"Source": "c"}},
                                        "Property": "Cert Type"}, "Name": "CertType"},
                            {"Column": {"Expression": {"SourceRef": {"Source": "c"}},
                                        "Property": "Industries"}, "Name": "Industries"},
                            {"Column": {"Expression": {"SourceRef": {"Source": "c"}},
                                        "Property": "City"}, "Name": "City"},
                            {"Column": {"Expression": {"SourceRef": {"Source": "c"}},
                                        "Property": "Cert Expires"}, "Name": "CertExpires"},
                            {"Column": {"Expression": {"SourceRef": {"Source": "c"}},
                                        "Property": "Products"}, "Name": "Products"},
                            {"Column": {"Expression": {"SourceRef": {"Source": "c"}},
                                        "Property": "Country"}, "Name": "Country"},
                        ],
                        "Where": [{
                            "Condition": {"In": {
                                "Expressions": [{"Column": {
                                    "Expression": {"SourceRef": {"Source": "c"}},
                                    "Property": "Country"}}],
                                "Values": [[{"Literal": {"Value": f"'{country}'"}}]],
                            }},
                        }],
                        "OrderBy": [{"Direction": 1, "Expression": {
                            "Column": {"Expression": {"SourceRef": {"Source": "c"}},
                                       "Property": "WRAPID"}}}],
                    },
                    "Binding": {
                        "Primary": {"Groupings": [{"Projections": [0, 1, 2, 3, 4, 5, 6, 7]}]},
                        "DataReduction": {"DataVolume": 3,
                                          "Primary": {"Window": {"Count": 5000}}},
                        "Version": 1,
                    },
                    "ExecutionMetricsKind": 1,
                },
            }]},
            "QueryId": "",
            "ApplicationContext": {
                "DatasetId": WRAP_DATASET_ID,
                "Sources": [{"ReportId": WRAP_REPORT_ID, "VisualId": WRAP_VISUAL_ID}],
            },
        }],
        "cancelQueries": [],
        "modelId": WRAP_MODEL_ID,
    }


def _decode_dsr(payload: dict[str, Any]) -> list[dict[str, Any]]:
    """Decode Power BI Data Stream Representation into list of column-name dicts.

    Encoding (observed):
      * Each PH[0]['DM0'] entry represents one row.
      * The first entry also carries the schema in 'S'.
      * 'R' (repeat) bitmask: bit i set -> column i reuses previous row's value.
      * 'Ø' (null) bitmask: bit i set -> column i is null.
      * 'C' carries values for the remaining columns in column-index order.
      * A value in 'C' is either (a) an int dictionary index into ValueDicts[Dn]
        or (b) a literal string when the value falls outside the dictionary
        (Power BI caps each dict at 100 entries and inlines values beyond that).
    """
    ds = payload["results"][0]["result"]["data"]["dsr"]["DS"][0]
    ph = ds["PH"][0]["DM0"]
    vd = ds.get("ValueDicts", {})

    if not ph:
        return []
    schema = ph[0]["S"]
    n_cols = len(schema)
    col_names = [c["N"] for c in schema]
    dict_names = [c.get("DN") for c in schema]

    rows: list[list[Any]] = []
    prev: list[Any] = [None] * n_cols
    for entry in ph:
        r_mask = entry.get("R", 0)
        null_mask = entry.get("Ø", 0)
        c_arr = entry.get("C", [])
        row: list[Any] = [None] * n_cols
        c_idx = 0
        for col in range(n_cols):
            if (r_mask >> col) & 1:
                row[col] = prev[col]
            elif (null_mask >> col) & 1:
                row[col] = None
            elif c_idx < len(c_arr):
                v = c_arr[c_idx]
                c_idx += 1
                dn = dict_names[col]
                if isinstance(v, int) and dn and dn in vd and 0 <= v < len(vd[dn]):
                    row[col] = vd[dn][v]
                else:
                    row[col] = v  # literal (string already, or out-of-dict value)
            else:
                row[col] = None
        prev = row
        rows.append(row)

    return [{_COL_MAP.get(n, n): v for n, v in zip(col_names, r)} for r in rows]


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


# A Power BI DSR response encodes repeated values once in `ValueDicts` and refers
# to them by integer index, so city / cert type / products / industries appear in
# the document as numbers, not text. Those claims get a locator but no excerpt —
# recorded as unverifiable rather than pretending a dictionary entry shared by
# 200 facilities is this facility's citation. `WRAPID` and the facility name are
# unique per row and inlined, so they anchor the row and can be re-checked.
_UNCITABLE_FIELDS = (
    "wrap_country",
    "wrap_profile_url",
    "expires_on",
)


class WrapScraper(AcquiringScraper):
    code = "wrap"
    source_code = "WRAP"
    transport = "direct"
    fallback_transport = None

    @property
    def request_headers(self) -> dict[str, str]:
        return {
            "Content-Type": "application/json;charset=UTF-8",
            "Accept": "application/json, text/plain, */*",
            "X-PowerBI-ResourceKey": WRAP_RESOURCE_KEY,
            "ActivityId": str(uuid.uuid4()),
            "RequestId": str(uuid.uuid4()),
            "Referer": "https://app.powerbi.com/",
            "Origin": "https://app.powerbi.com",
            "User-Agent": settings.etl_user_agent,
        }

    async def fetch(self) -> AsyncIterator[ScrapedRecord]:
        body = json.dumps(_build_query("Bangladesh"))
        doc = await self.acquire(
            AcquireRequest(
                url=PBI_QUERY_URL,
                method="POST",
                content=body,
                label="certified facilities (Bangladesh)",
            )
        )
        if not doc.ok:
            raise RuntimeError(
                f"wrap: Power BI query failed ({doc.fetch_status.value}: "
                f"{doc.error_message}). Refusing to report an empty facility list."
            )
        raw = doc.text()
        payload = json.loads(raw)

        facilities = _decode_dsr(payload)
        self.log.info("wrap.fetched", count=len(facilities))
        for fac in facilities:
            wrap_id = fac.get("WRAPID")
            name = fac.get("Name")
            if not wrap_id or not name:
                continue
            # Scope filter: SourceBD covers RMG (apparel + textile + trims).
            # WRAP certifies cross-industry; skip rows whose Products field is
            # exclusively a non-RMG category (e.g. "Footwear"). Multi-category
            # rows that include any apparel/knit/woven token still pass.
            if _is_non_rmg_only(fac.get("Products")):
                self.log.info(
                    "wrap.skip_non_rmg",
                    wrap_id=str(wrap_id).strip(),
                    name=str(name).strip(),
                    products=fac.get("Products"),
                )
                continue
            wrap_id_s = str(wrap_id).strip()
            expires = _parse_expires(fac.get("CertExpires"))
            yield ScrapedRecord(
                source_code="WRAP",
                source_ref=f"wrap-{wrap_id_s}",
                company_name=str(name).strip(),
                city=(fac.get("City") or None),
                payload={
                    "wrap_id": wrap_id_s,
                    "wrap_cert_type": fac.get("CertType"),
                    "wrap_industries": fac.get("Industries"),
                    "wrap_products": fac.get("Products"),
                    "wrap_cert_expires": fac.get("CertExpires"),
                    "wrap_country": fac.get("Country"),
                    "wrap_profile_url": WRAP_FACILITY_URL_TEMPLATE.format(wrap_id=wrap_id_s),
                    "expires_on": expires.isoformat() if expires else None,
                },
                evidence=EvidenceAttachment(
                    doc=doc,
                    locators={
                        "wrap_id": f"powerbi:CertifiedFacilities[WRAPID={wrap_id_s}]/WRAPID",
                        "wrap_cert_type": f"powerbi:CertifiedFacilities[WRAPID={wrap_id_s}]/Cert Type",
                        "wrap_industries": f"powerbi:CertifiedFacilities[WRAPID={wrap_id_s}]/Industries",
                        "wrap_products": f"powerbi:CertifiedFacilities[WRAPID={wrap_id_s}]/Products",
                        "wrap_cert_expires": f"powerbi:CertifiedFacilities[WRAPID={wrap_id_s}]/Cert Expires",
                    },
                    default_locator=f"powerbi:CertifiedFacilities[WRAPID={wrap_id_s}]",
                    document_text=raw_window(raw, f'"{wrap_id_s}"', radius=600)
                    or NO_EXCERPT,
                    document_is_html=False,
                    skip_keys=_UNCITABLE_FIELDS,
                    # No `citable_url_override`: one query response backs every
                    # Bangladesh facility, so a per-facility override would
                    # stamp the first one's profile URL onto the document all
                    # the others cite too. `wrap_profile_url` already carries
                    # the public page into the payload.
                ),
            )

    async def run(self) -> dict[str, int]:
        """Override: also insert into public.certifications keyed on WRAP ID."""
        from etl.core.upsert import upsert_supplier_with_source
        from etl.evidence.writer import reset_document_cache

        run_id = self._open_run()
        reset_document_cache()
        seen = upserted = skipped = 0
        self._emit_progress(run_id, "started", "WRAP scraper started.", seen, upserted, skipped)
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
