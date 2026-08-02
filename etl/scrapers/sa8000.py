"""SA8000 certified-organisation scraper (Social Accountability International).

SAAS publishes the SA8000 directory at https://sa-intl.org/sa8000-search/ via
a WordPress plugin (`cwp-sa8000-search`) that exposes two unauthenticated
AJAX endpoints on `wp-admin/admin-ajax.php`:

  * `action=cwp_get_results` (GET): returns an HTML <table> filtered by country.
  * `action=get_popup_content` (POST): returns a JSON envelope wrapping an
    HTML <ul> with full per-cert detail (address, issue/expiry dates,
    withdrawal date when applicable, description of operations).

Strategy: one GET for `Country=Bangladesh`, parse rows, hit each `data-pop`
popup for detail, emit one `ScrapedRecord` per cert row. Override `run()` to
also write a `public.certifications` row keyed on
`(supplier_id, kind='sa8000', certificate_no=<SAAS cert ID>)`.

As of 2026-05-19 the BD result set is 7 rows (4 Certified, 3 Withdrawn/cancelled).

Transport: Firecrawl, and it must be — Cloudflare on sa-intl.org rejects Python
TLS fingerprints whatever headers we send, which is why this source used to drive
Playwright directly.

One wrinkle drove the shape below. Firecrawl's scrape API only issues GETs, and
the popup detail endpoint is a POST. Rather than lose the address and date fields
(the whole reason the popup is fetched), we load the search page and run both
AJAX calls from an `executeJavascript` action. The requests then originate inside
the page, carrying its Cloudflare cookies and real browser TLS, and come back
through `javascriptReturns`. The JavaScript only moves bytes; every field is still
parsed by the same Python functions as before, so extraction fidelity is
unchanged and testable offline.
"""
from __future__ import annotations

import json
import re
from datetime import date
from typing import Any, AsyncIterator

from bs4 import BeautifulSoup

from etl.acquire import AcquiredDoc, AcquireRequest
from etl.core.acquiring import AcquiringScraper
from etl.core.db import db, get_source_id
from etl.core.scraper import EvidenceAttachment, ScrapedRecord

AJAX_URL = "https://sa-intl.org/wp-admin/admin-ajax.php"
SEARCH_PAGE_URL = "https://sa-intl.org/sa8000-search/"
COUNTRY = "Bangladesh"
POPUP_THROTTLE_MS = 300

_LIST_PARAMS = {
    "action": "cwp_get_results",
    "Country": COUNTRY,
    "Industry": "",
    "Certification_status": "",
    "Certified_Organization": "",
    "Certification_ID": "",
    "Description of Operations": "",
    "City": "",
    "CB": "",
    "direct": "0",
}

_DATE_RE = re.compile(r"^(\d{4})-(\d{2})-(\d{2})$")

# Canonical popup field labels (trailing colon stripped, whitespace normalised).
# Maps to the dict key used in payload + downstream cert writer.
_POPUP_FIELDS = {
    "Certified Organization": "organisation",
    "Certification Body": "certification_body",
    "Certificate ID number": "certificate_id",
    "Certification Status": "status",
    "Industry": "industry",
    "Address": "address",
    "Initial Certification Date": "initial_certification_date",
    "Latest Certification Date": "latest_certification_date",
    "Expiration Date": "expiration_date",
    "Withdrawal Date": "withdrawal_date",
}


_EVIDENCE_LOCATORS = {
    "sa8000_certificate_id": "results table, Certification ID column",
    "sa8000_certification_body": "results table, Certification Body column",
    "sa8000_status": "results table, Certification Status column",
    "sa8000_industry": "results table, Industry column",
    "sa8000_workers": "results table, Workers column",
    "sa8000_initial_certification_date": "detail popup, 'Initial Certification Date'",
    "sa8000_latest_certification_date": "detail popup, 'Latest Certification Date'",
    "sa8000_expiration_date": "detail popup, 'Expiration Date'",
    "sa8000_withdrawal_date": "detail popup, 'Withdrawal Date'",
    "sa8000_description_of_operations": "detail popup, 'Description of Operations'",
}
# `data_pop` is the plugin's internal popup id; `issued_on`/`expires_on` are our
# own reformatting of the popup dates already cited above.
_UNCITABLE_FIELDS = ("sa8000_data_pop", "issued_on", "expires_on")


def _parse_expires(s: str | None) -> date | None:
    if not s:
        return None
    m = _DATE_RE.match(str(s).strip())
    if not m:
        return None
    try:
        return date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
    except ValueError:
        return None


def _certificate_no_slug(cert_id: str) -> str:
    """Stable URL/idempotency slug from a raw cert ID like 'IND.23.15506/SA/S'."""
    s = re.sub(r"[^a-z0-9]+", "-", cert_id.lower()).strip("-")
    return s or "unknown"


def _extract_city(address: str | None) -> str | None:
    """SAAS address shape: '<street>, …, <City>, <State or N/A>, <Postcode>, Bangladesh'.

    The country is reliably the last comma-token. The postcode is typically the
    second-to-last. The city sits 2-3 tokens before the end. Strategy: drop
    trailing 'Bangladesh' and any pure-postcode / N/A tokens, then take the
    last remaining text token.
    """
    if not address:
        return None
    parts = [p.strip() for p in address.split(",") if p.strip()]
    # strip trailing Bangladesh
    if parts and parts[-1].lower() == "bangladesh":
        parts.pop()
    # strip trailing postcode (digits, optional dash)
    while parts and re.fullmatch(r"[\d\-]+", parts[-1]):
        parts.pop()
    # strip trailing 'N/A' state markers
    while parts and parts[-1].upper() in {"N/A", "NA", "-"}:
        parts.pop()
    return parts[-1] if parts else None


def _nz(v: Any) -> str | None:
    if v is None:
        return None
    s = str(v).strip()
    return s or None


def _parse_list_rows(html: str) -> list[dict[str, Any]]:
    """Parse the cwp_get_results HTML <table> into row dicts."""
    soup = BeautifulSoup(html, "html.parser")
    rows: list[dict[str, Any]] = []
    for tr in soup.select("table tr.pages"):
        tds = tr.find_all("td")
        if len(tds) < 7:
            continue
        anchor = tds[6].find("a", attrs={"data-pop": True})
        data_pop = anchor.get("data-pop") if anchor else None
        if not data_pop:
            continue
        rows.append({
            "organisation": _nz(tds[0].get_text(strip=True)),
            "certification_body": _nz(tds[1].get_text(strip=True)),
            "certificate_id": _nz(tds[2].get_text(strip=True)),
            "status": _nz(tds[3].get_text(strip=True)),
            "industry": _nz(tds[4].get_text(strip=True)),
            "workers": _nz(tds[5].get_text(strip=True)),
            "data_pop": _nz(data_pop),
        })
    return rows


def _parse_popup_html(fragment: str) -> dict[str, Any]:
    """Parse the popup HTML fragment into a flat dict keyed on canonical names."""
    soup = BeautifulSoup(fragment, "html.parser")
    out: dict[str, Any] = {}
    for li in soup.select("ul > li"):
        b = li.find("b")
        if not b:
            continue
        label = b.get_text(strip=True).rstrip(":").strip()
        key = _POPUP_FIELDS.get(label)
        if not key:
            continue
        # Everything after <b>label:</b> is the value text.
        b.extract()
        out[key] = _nz(li.get_text(strip=True).lstrip(":").strip())
    # Description of Operations lives in a trailing <p>.
    p = soup.find("p")
    if p:
        b = p.find("b")
        if b and "Description of Operations" in b.get_text():
            b.extract()
            out["description_of_operations"] = _nz(p.get_text(strip=True).lstrip(":").strip())
    return out


def _build_harvest_script() -> str:
    """JavaScript run inside the loaded search page to pull both AJAX responses.

    Deliberately dumb: it fetches and returns raw response text, doing no parsing
    and no field selection. All extraction stays in Python so the parsers remain
    unit-testable and Hard Rule 5 fidelity is unaffected by a vendor's browser.
    """
    list_params = json.dumps(_LIST_PARAMS)
    return f"""
(async () => {{
  const ajax = {json.dumps(AJAX_URL)};
  const listParams = new URLSearchParams({list_params});
  const headers = {{ 'X-Requested-With': 'XMLHttpRequest' }};

  const listResp = await fetch(ajax + '?' + listParams.toString(), {{
    credentials: 'include', headers,
  }});
  const listHtml = await listResp.text();
  if (!listResp.ok) {{
    return {{ ok: false, status: listResp.status, list_html: listHtml, popups: {{}} }};
  }}

  // Read the popup ids straight out of the returned markup so this stays in
  // step with whatever the plugin emits, rather than hard-coding row shape.
  const doc = new DOMParser().parseFromString(listHtml, 'text/html');
  const ids = Array.from(doc.querySelectorAll('a[data-pop]'))
    .map((a) => a.getAttribute('data-pop'))
    .filter(Boolean);

  const popups = {{}};
  for (const id of ids) {{
    try {{
      const body = new URLSearchParams({{ action: 'get_popup_content', id }});
      const r = await fetch(ajax, {{
        method: 'POST', credentials: 'include',
        headers: {{ ...headers, 'Content-Type': 'application/x-www-form-urlencoded' }},
        body: body.toString(),
      }});
      popups[id] = r.ok ? await r.text() : null;
    }} catch (e) {{
      popups[id] = null;
    }}
    await new Promise((res) => setTimeout(res, {POPUP_THROTTLE_MS}));
  }}
  return {{ ok: true, status: listResp.status, list_html: listHtml, popups }};
}})()
"""


def _detail_from_envelope(raw: str | None) -> dict[str, Any]:
    """Unwrap the WP AJAX JSON envelope and parse the HTML fragment inside."""
    if not raw:
        return {}
    try:
        envelope = json.loads(raw)
    except (TypeError, ValueError):
        return {}
    if not envelope.get("success") or not isinstance(envelope.get("data"), str):
        return {}
    return _parse_popup_html(envelope["data"])


class Sa8000Scraper(AcquiringScraper):
    code = "sa8000"
    source_code = "SA8000"
    transport = "firecrawl"
    # No fallback. Cloudflare rejects our TLS fingerprint, so the direct adapter
    # would return an interstitial that parses to zero rows — which would look
    # like "SAAS has no Bangladesh certificates" rather than a failed fetch.
    fallback_transport = None
    monitor_urls = (SEARCH_PAGE_URL,)

    async def fetch(self) -> AsyncIterator[ScrapedRecord]:
        doc = await self.acquire(
            AcquireRequest(
                url=SEARCH_PAGE_URL,
                only_main_content=False,
                # 'auto' escalates to enhanced proxies (5 credits) only if basic
                # is blocked. Worth it here: this is one page a month, and the
                # alternative is no SA8000 data at all.
                proxy="auto",
                actions=(
                    {"type": "wait", "milliseconds": 2000},
                    {"type": "executeJavascript", "script": _build_harvest_script()},
                ),
                label="SA8000 search",
            )
        )
        if not doc.ok:
            raise RuntimeError(
                f"sa8000: {SEARCH_PAGE_URL} unreadable "
                f"({doc.fetch_status.value}: {doc.error_message})"
            )

        harvest = doc.js_returns[0] if doc.js_returns else None
        if not isinstance(harvest, dict) or not harvest.get("ok"):
            raise RuntimeError(
                "sa8000: in-page AJAX harvest failed "
                f"(status={(harvest or {}).get('status')}). Refusing to report "
                "an empty certificate list."
            )

        rows = _parse_list_rows(str(harvest.get("list_html") or ""))
        popups = harvest.get("popups") or {}
        self.log.info("sa8000.list.fetched", count=len(rows), popups=len(popups))

        for row in rows:
            cert_id = row.get("certificate_id")
            name = row.get("organisation")
            if not cert_id or not name:
                continue
            detail = _detail_from_envelope(popups.get(row.get("data_pop")))
            if not detail:
                self.log.warning(
                    "sa8000.popup.missing",
                    data_pop=row.get("data_pop"),
                    certificate_id=cert_id,
                )

            org = detail.get("organisation") or name
            cb = detail.get("certification_body") or row.get("certification_body")
            cert_id_full = detail.get("certificate_id") or cert_id
            status = detail.get("status") or row.get("status")
            industry = detail.get("industry") or row.get("industry")
            address = detail.get("address")
            city = _extract_city(address)
            expires = _parse_expires(detail.get("expiration_date"))
            issued = _parse_expires(detail.get("latest_certification_date")) \
                     or _parse_expires(detail.get("initial_certification_date"))

            yield ScrapedRecord(
                source_code="SA8000",
                source_ref=f"sa8000-{_certificate_no_slug(cert_id_full)}",
                company_name=str(org).strip(),
                city=city,
                address_raw=address,
                payload={
                    "sa8000_certificate_id": cert_id_full,
                    "sa8000_certification_body": cb,
                    "sa8000_status": status,
                    "sa8000_industry": industry,
                    "sa8000_workers": row.get("workers"),
                    "sa8000_initial_certification_date": detail.get("initial_certification_date"),
                    "sa8000_latest_certification_date": detail.get("latest_certification_date"),
                    "sa8000_expiration_date": detail.get("expiration_date"),
                    "sa8000_withdrawal_date": detail.get("withdrawal_date"),
                    "sa8000_description_of_operations": detail.get("description_of_operations"),
                    "sa8000_data_pop": row.get("data_pop"),
                    "country": "Bangladesh",
                    "issued_on": issued.isoformat() if issued else None,
                    "expires_on": expires.isoformat() if expires else None,
                },
                evidence=self._evidence_for(doc, row, detail),
            )

    def _evidence_for(
        self, doc: AcquiredDoc, row: dict[str, Any], detail: dict[str, Any]
    ) -> EvidenceAttachment:
        """Cite the public search page, excerpting the row and popup content.

        The AJAX endpoints are not followable links — a buyer sent to
        admin-ajax.php sees a bare fragment. The search page is where the same
        facts are actually visible, so that is the citation, while the excerpt is
        taken from the fragment the values were parsed out of.
        """
        parts = [str(v) for v in row.values() if v]
        parts += [f"{k}: {v}" for k, v in detail.items() if v]
        return EvidenceAttachment(
            doc=doc,
            locators=_EVIDENCE_LOCATORS,
            default_locator=f"SA8000 directory, Country={COUNTRY} results",
            document_text="\n".join(parts),
            skip_keys=_UNCITABLE_FIELDS,
        )

    async def run(self) -> dict[str, int]:  # type: ignore[override]
        """Override: also insert into public.certifications keyed on SA8000 cert ID."""
        from etl.core.upsert import upsert_supplier_with_source
        from etl.evidence.writer import reset_document_cache

        run_id = self._open_run()
        reset_document_cache()
        seen = upserted = skipped = 0
        try:
            async for rec in self.fetch():
                seen += 1
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
    src_id = get_source_id("SA8000")
    cert_no = p["sa8000_certificate_id"]
    issuer = p.get("sa8000_certification_body")
    issued = _parse_expires(p.get("sa8000_latest_certification_date")) \
             or _parse_expires(p.get("sa8000_initial_certification_date"))
    expires = _parse_expires(p.get("sa8000_expiration_date"))
    scope_parts = []
    if p.get("sa8000_industry"):
        scope_parts.append(str(p["sa8000_industry"]))
    if p.get("sa8000_status"):
        scope_parts.append(f"Status: {p['sa8000_status']}")
    if p.get("sa8000_withdrawal_date"):
        scope_parts.append(f"Withdrawn: {p['sa8000_withdrawal_date']}")
    scope = " | ".join(scope_parts) or None

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
               values (%s, 'sa8000', %s, %s, %s, %s, %s, %s, %s)
               on conflict (supplier_id, kind, certificate_no) do update set
                 issuer = excluded.issuer,
                 issued_on = excluded.issued_on,
                 expires_on = excluded.expires_on,
                 scope = excluded.scope,
                 source_record_id = excluded.source_record_id,
                 document_url = excluded.document_url""",
            (
                supplier_id,
                cert_no,
                issuer,
                issued,
                expires,
                scope,
                sr_id,
                SEARCH_PAGE_URL,
            ),
        )
        c.commit()
