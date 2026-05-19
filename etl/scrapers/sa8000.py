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
"""
from __future__ import annotations

import asyncio
import re
from datetime import date
from typing import Any, AsyncIterator

from bs4 import BeautifulSoup

from etl.core.db import db, get_source_id
from etl.core.scraper import BaseScraper, ScrapedRecord

AJAX_URL = "https://sa-intl.org/wp-admin/admin-ajax.php"
SEARCH_PAGE_URL = "https://sa-intl.org/sa8000-search/"
COUNTRY = "Bangladesh"
POPUP_THROTTLE_SEC = 0.3

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


class Sa8000Scraper(BaseScraper):
    code = "sa8000"
    source_code = "SA8000"

    async def fetch(self) -> AsyncIterator[ScrapedRecord]:
        # Cloudflare on sa-intl.org blocks Python TLS fingerprints regardless
        # of headers. Use Playwright's request context (real Chromium TLS) —
        # same pattern as etl/scrapers/brand_disclosures.py.
        from playwright.async_api import async_playwright

        ua = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
              "AppleWebKit/537.36 (KHTML, like Gecko) "
              "Chrome/124.0.0.0 Safari/537.36")
        extra_headers = {
            "Accept": "*/*",
            "Accept-Language": "en-US,en;q=0.9",
            "X-Requested-With": "XMLHttpRequest",
            "Referer": SEARCH_PAGE_URL,
            "Origin": "https://sa-intl.org",
        }

        async with async_playwright() as p:
            browser = await p.chromium.launch(args=["--no-sandbox"])
            ctx = await browser.new_context(
                user_agent=ua,
                locale="en-GB",
                extra_http_headers=extra_headers,
            )
            try:
                # Warm the cookie jar by visiting the search page once.
                page = await ctx.new_page()
                try:
                    await page.goto(SEARCH_PAGE_URL, wait_until="domcontentloaded", timeout=45000)
                except Exception:  # noqa: BLE001
                    pass
                await page.close()

                resp = await ctx.request.get(AJAX_URL, params=_LIST_PARAMS, timeout=60000)
                if not resp.ok:
                    raise RuntimeError(f"sa8000 list status={resp.status}")
                rows = _parse_list_rows(await resp.text())
                self.log.info("sa8000.list.fetched", count=len(rows))

                for row in rows:
                    cert_id = row.get("certificate_id")
                    name = row.get("organisation")
                    if not cert_id or not name:
                        continue
                    detail: dict[str, Any] = {}
                    try:
                        presp = await ctx.request.post(
                            AJAX_URL,
                            form={"action": "get_popup_content", "id": row["data_pop"]},
                            timeout=60000,
                        )
                        if presp.ok:
                            envelope = await presp.json()
                            if envelope.get("success") and isinstance(envelope.get("data"), str):
                                detail = _parse_popup_html(envelope["data"])
                        else:
                            self.log.warn("sa8000.popup.bad_status",
                                          data_pop=row.get("data_pop"),
                                          certificate_id=cert_id,
                                          status=presp.status)
                    except Exception as exc:  # noqa: BLE001
                        self.log.warn("sa8000.popup.failed",
                                      data_pop=row.get("data_pop"),
                                      certificate_id=cert_id,
                                      error=str(exc))
                    await asyncio.sleep(POPUP_THROTTLE_SEC)

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
                    )
            finally:
                await ctx.close()
                await browser.close()

    async def run(self) -> dict[str, int]:  # type: ignore[override]
        """Override: also insert into public.certifications keyed on SA8000 cert ID."""
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
