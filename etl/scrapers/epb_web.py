"""EPB Exporter Database scraper — RMG sector only.

Source: Bangladesh Export Promotion Bureau Exporter Database
(https://edb.epb.gov.bd/). Tier 1 government register. EPB is an independent
government entity: a company we already list must receive EPB evidence and
HS codes when EPB publishes them, whether or not it carries a BGMEA/BKMEA
association flag.

Strategy
--------
The site is a Vue.js SPA backed by `POST /api/exporters-search`. Two
enumeration passes over the same endpoint:

1. **Association pass** (attach-only by default): filtering by association
   id (BGMEA=1, BKMEA=2) returns the full BGMEA/BKMEA exporter set inline
   as JSON. Records attach onto companies we already list. Pass
   `existing_only=False` (CLI `--mint`) only when the founder has
   authorised minting from this pass.
2. **Category pass** (always attach-only, founder decision D, 4 Aug 2026):
   EPB's register separates RMG from jute/fish/rice by CATEGORY, not by
   association — of 5,939 approved exporters only 541 carry a BGMEA/BKMEA
   flag, so the association pass alone misses the unflagged RMG majority
   (SARADA FASHIONS, exporter 4083, category Knit, no flags; Interstoff
   Apparels, exporter 2043, Knit & Woven, no flags). Enumerating the RMG
   category ids covers them, and every record from this pass carries
   `enrich_only=True`: it enriches a supplier we already know and is
   skipped otherwise, so widening coverage never mints a single-source
   EPB profile.

HS codes are not in the search JSON. They are server-rendered on each
public exporter page (`/exporter/{id}/{slug}`). After the search row is
built, one GET of that page fills `epb_hscodes`. A failed detail fetch
still yields the search record.

Jute, fish, plastic, leather, agriculture and other non-RMG exporters stay
out of scope in both passes.

District / thana names are not in the API response (only foreign-key ids).
We extract the embedded `districts` / `thanas` lookup tables from the home
page on startup and resolve names locally.

Transport: direct, wrapped in the acquisition interface. The search endpoint is a
POST that requires a Laravel XSRF token read from a cookie set on the home page,
which no scraping API can express, and its response is typed JSON. The wrapper
adds per-field evidence and the same admin controls as every other source.
"""
from __future__ import annotations

import html as htmlmod
import json
import re
import urllib.parse
from typing import Any, AsyncIterator

from etl.acquire import AcquiredDoc, AcquireRequest
from etl.core.acquiring import AcquiringScraper
from etl.core.scraper import EvidenceAttachment, ScrapedRecord
from etl.evidence.locate import (
    NO_EXCERPT,
    json_locator,
    json_record_window,
    raw_window,
)

BASE = "https://edb.epb.gov.bd"
HOME_URL = f"{BASE}/exporters"
SEARCH_URL = f"{BASE}/api/exporters-search"
DETAIL_TEMPLATE = f"{BASE}/exporter/{{id}}/{{slug}}"

# Association ids confirmed via /association-exporters/{id}/{slug} URL pattern.
RMG_ASSOCIATIONS: dict[int, str] = {1: "BGMEA", 2: "BKMEA"}

# RMG category ids in EPB's 818-category taxonomy, live-verified against
# /api/exporters-search 3 Aug 2026: 2=Knit, 3=Woven, 8=Knit & Woven,
# 24=Sweater, 16/23/30=Garments stock lot. Everything else (jute, fish,
# rice, leather, ...) is out of SourceBD scope and must never enter this dict.
RMG_CATEGORIES: dict[int, str] = {
    2: "Knit",
    3: "Woven",
    8: "Knit & Woven",
    24: "Sweater",
    16: "Garments stock lot",
    23: "Garments stock lot",
    30: "Garments stock lot",
}

_BROWSER_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) "
                  "Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

# Common district name spellings normalised to the form used by RSC / BGMEA.
_DISTRICT_FIX = {
    "Chittagong": "Chattogram",
    "Cumilla": "Comilla",
    "Jessore": "Jashore",
    "Bogra": "Bogura",
    "Barisal": "Barishal",
    "Coxs Bazar": "Cox's Bazar",
    "Nilfamari": "Nilphamari",
}


# Payload key → the API field it was read from, for JSON-pointer locators.
_JSON_FIELDS = {
    "epb_reg_no": "epb_reg_no",
    "epb_eu_reg_no": "eu_reg_no",
    "epb_factory_address": "factory_address",
    "epb_office_address": "office_address",
    "epb_logo": "logo",
}
# District and thana names are resolved from a lookup table embedded in the home
# page, so they cannot be excerpted from the search response that carries only
# their foreign keys. The rest are our own derivations or the API's row handle,
# not facts EPB states about the exporter.
_UNCITABLE_FIELDS = (
    "epb_factory_district",
    "epb_office_district",
    "epb_office_thana",
    "epb_exporter_id",
    "epb_slug",
    "epb_detail_url",
    "epb_registered",
    "epb_associations",
    "epb_categories",
    "epb_hscodes",
)

_HS_LINK = re.compile(
    r'href=["\'](?:https://edb\.epb\.gov\.bd)?/hscode-exporters/(\d+)["\']'
    r"[^>]*>\s*(\d+)\s*</a>",
    re.IGNORECASE,
)
_HS_DESC = re.compile(
    r'<div class="col-10">\s*(.*?)\s*</div>',
    re.IGNORECASE | re.DOTALL,
)


class EpbScraper(AcquiringScraper):
    code = "epb_web"
    source_code = "EPB"
    transport = "direct"
    fallback_transport = None
    rps = 1.0
    request_headers = _BROWSER_HEADERS

    def __init__(self, existing_only: bool = True, **kwargs: Any) -> None:
        super().__init__(**kwargs)
        # Existing companies only by default: both passes attach, neither mints.
        self.existing_only = existing_only

    async def fetch(self) -> AsyncIterator[ScrapedRecord]:
        districts, thanas, categories = await self._bootstrap()
        self.log.info(
            "epb.bootstrap",
            districts=len(districts),
            thanas=len(thanas),
            categories=len(categories),
        )

        # One exporter qualifies for several passes; yield it once, from the
        # association pass when flagged (its payload carries the association
        # context), so the per-run upsert and hash-skip stay stable.
        seen_ids: set[int] = set()

        for assoc_id, assoc_name in RMG_ASSOCIATIONS.items():
            yielded = 0
            async for rec in self._fetch_association(
                assoc_id, assoc_name, districts, thanas, seen_ids
            ):
                yielded += 1
                yield rec
            self.log.info(
                "epb.association_done",
                association=assoc_name,
                count=yielded,
            )

        for cat_id, cat_name in RMG_CATEGORIES.items():
            yielded = 0
            async for rec in self._fetch_category(
                cat_id, cat_name, districts, thanas, seen_ids
            ):
                yielded += 1
                yield rec
            self.log.info(
                "epb.category_done",
                category=cat_name,
                category_id=cat_id,
                count=yielded,
            )

    # ------------------------------------------------------------------
    async def _bootstrap(
        self,
    ) -> tuple[dict[int, str], dict[int, str], dict[int, str]]:
        """Hit the home page once to collect the XSRF cookie + lookup tables."""
        doc = await self.acquire(AcquireRequest(url=HOME_URL, label="exporters home"))
        if not doc.ok:
            raise RuntimeError(
                f"epb_web: {HOME_URL} unreadable ({doc.fetch_status.value}: "
                f"{doc.error_message}); cannot obtain the XSRF token or lookups."
            )
        html = doc.text()

        # The adapter holds one session for the whole run, so the cookie the home
        # page set is still in the jar when the search API is called below.
        xsrf_raw = self.direct_adapter().cookie("XSRF-TOKEN") or ""
        if not xsrf_raw:
            raise RuntimeError("EPB: failed to obtain XSRF-TOKEN cookie")
        # Cookie value is URL-encoded; the API expects the decoded form in
        # the X-XSRF-TOKEN header (Laravel convention).
        self._xsrf = urllib.parse.unquote(xsrf_raw)

        districts = _extract_lookup(html, "districts")
        thanas = _extract_lookup(html, "thanas")
        categories = _extract_lookup(html, "categories")
        if not districts:
            self.log.warning("epb.no_district_lookup")
        return districts, thanas, categories

    # ------------------------------------------------------------------
    async def _fetch_association(
        self,
        assoc_id: int,
        assoc_name: str,
        districts: dict[int, str],
        thanas: dict[int, str],
        seen_ids: set[int],
    ) -> AsyncIterator[ScrapedRecord]:
        async for rec in self._fetch_search(
            payload_filter={"associations": [assoc_id]},
            label=assoc_name,
            referer=f"{BASE}/association-exporters/{assoc_id}/{assoc_name.lower()}",
            assoc_name=assoc_name,
            enrich_only=self.existing_only,
            districts=districts,
            thanas=thanas,
            seen_ids=seen_ids,
        ):
            yield rec

    async def _fetch_category(
        self,
        cat_id: int,
        cat_name: str,
        districts: dict[int, str],
        thanas: dict[int, str],
        seen_ids: set[int],
    ) -> AsyncIterator[ScrapedRecord]:
        """Attach-only enumeration of one RMG category (decision D)."""
        async for rec in self._fetch_search(
            payload_filter={"category_id": cat_id},
            label=f"category:{cat_name}",
            referer=HOME_URL,
            assoc_name=None,
            enrich_only=True,
            districts=districts,
            thanas=thanas,
            seen_ids=seen_ids,
        ):
            yield rec

    async def _fetch_search(
        self,
        *,
        payload_filter: dict[str, Any],
        label: str,
        referer: str,
        assoc_name: str | None,
        enrich_only: bool,
        districts: dict[int, str],
        thanas: dict[int, str],
        seen_ids: set[int],
    ) -> AsyncIterator[ScrapedRecord]:
        headers = {
            "Accept": "application/json, text/plain, */*",
            "Content-Type": "application/json",
            "Referer": referer,
            "X-Requested-With": "XMLHttpRequest",
            "X-XSRF-TOKEN": self._xsrf,
            "Origin": BASE,
        }

        # Page through results. The Vue UI uses limit=8; we ask for 200 per
        # request to minimise round-trips while staying friendly.
        limit = 200
        offset = 0
        while True:
            payload = {
                "private": False,
                "approval_status": 1,
                "category_id": 0,
                "district_id": 0,
                "reg_type": None,
                "exporter_type": 0,
                "hscodes": [],
                "associations": [],
                "keyword": "",
                "offset": offset,
                "limit": limit,
                "order_by": "exporters.name",
                "order": "asc",
                **payload_filter,
            }

            doc = await self.acquire(
                AcquireRequest(
                    url=SEARCH_URL,
                    method="POST",
                    json_body=payload,
                    headers=headers,
                    label=f"{label} exporters offset={offset}",
                )
            )
            if not doc.ok:
                self.log.warning(
                    "epb.search_failed",
                    search=label,
                    offset=offset,
                    status=doc.fetch_status.value,
                    error=doc.error_message,
                )
                break

            raw_body = doc.text()
            try:
                data = json.loads(raw_body)
            except json.JSONDecodeError:
                self.log.warning(
                    "epb.search_non_json",
                    search=label,
                    offset=offset,
                )
                break

            raw = data.get("exporters")
            # PHP json_encode quirk: when offset > 0 the API returns a dict
            # keyed by string offsets (`{"200": {...}, "201": {...}}`) rather
            # than a list. Normalise both shapes.
            if isinstance(raw, dict):
                exporters = list(raw.values())
            elif isinstance(raw, list):
                exporters = raw
            else:
                exporters = []
            total = data.get("total")
            self.log.info(
                "epb.search_page",
                search=label,
                offset=offset,
                returned=len(exporters),
                total=total,
            )

            if not exporters:
                break

            for ex in exporters:
                if not isinstance(ex, dict):
                    # The API occasionally returns nested string entries on
                    # later pages; skip anything that isn't a record dict.
                    continue
                eid = ex.get("id")
                if not eid or eid in seen_ids:
                    continue
                seen_ids.add(eid)
                rec = self._build_record(
                    ex, assoc_name, districts, thanas, doc, raw_body,
                    enrich_only=enrich_only,
                )
                if rec is not None:
                    # Attach-only rows are skipped at upsert when unmatched.
                    # Do not GET the exporter page until a later backfill on
                    # a stored source_record (or a --mint full-create).
                    if not rec.enrich_only:
                        rec = await self._attach_hscodes(rec)
                    yield rec

            offset += len(exporters)
            if total is not None and offset >= int(total):
                break
            # Safety stop in case the API ignores pagination.
            if len(exporters) < limit:
                break

    # ------------------------------------------------------------------
    def _build_record(
        self,
        ex: dict[str, Any],
        assoc_name: str | None,
        districts: dict[int, str],
        thanas: dict[int, str],
        doc: AcquiredDoc | None = None,
        raw_body: str | None = None,
        enrich_only: bool = False,
    ) -> ScrapedRecord | None:
        eid = ex.get("id")
        name = (ex.get("name") or "").strip()
        if not eid or not name:
            return None

        slug = ex.get("slug") or "x"
        detail_url = DETAIL_TEMPLATE.format(id=eid, slug=slug)

        factory_addr = _clean(ex.get("factory_address"))
        office_addr = _clean(ex.get("office_address"))
        primary_addr = factory_addr or office_addr

        factory_district = _district_name(districts, ex.get("factory_district_id"))
        office_district = _district_name(districts, ex.get("office_district_id"))
        office_thana = (
            thanas.get(int(ex["office_thana_id"]))
            if ex.get("office_thana_id")
            else None
        )

        # Categories — flatten {id, name} pairs from the joined table.
        cats: list[dict[str, Any]] = []
        for ec in ex.get("exporter_categories") or []:
            cat = (ec or {}).get("category") or {}
            cname = cat.get("name")
            if cname:
                cats.append(
                    {"id": cat.get("id"), "name": cname, "slug": cat.get("slug")}
                )

        payload: dict[str, Any] = {
            "epb_exporter_id": eid,
            "epb_slug": slug,
            "epb_reg_no": ex.get("epb_reg_no"),
            "epb_eu_reg_no": ex.get("eu_reg_no"),
            "epb_factory_address": factory_addr,
            "epb_factory_district": factory_district,
            "epb_office_address": office_addr,
            "epb_office_district": office_district,
            "epb_office_thana": office_thana,
            "epb_categories": cats or None,
            # The association pass knows the flag it filtered on; the category
            # pass does not (the search row carries no association join), so
            # it leaves the field out rather than guessing.
            "epb_associations": [assoc_name] if assoc_name else None,
            "epb_logo": ex.get("logo"),
            "epb_detail_url": detail_url,
            "epb_registered": True,
        }
        payload = {k: v for k, v in payload.items() if v not in (None, "", [])}

        evidence: EvidenceAttachment | None = None
        if doc is not None:
            # One response carries up to 200 exporters. Excerpt against this
            # exporter's own slice so a neighbouring row's registration number
            # can never be cited as this one's.
            evidence = EvidenceAttachment(
                doc=doc,
                locators={
                    key: json_locator(f"exporters[id={eid}]/{field}")
                    for key, field in _JSON_FIELDS.items()
                },
                default_locator=json_locator(f"exporters[id={eid}]"),
                document_text=json_record_window(raw_body, f'"{name}"')
                or raw_window(raw_body, f'"id":{eid},')
                or NO_EXCERPT,
                document_is_html=False,
                # The API returns district/thana as foreign keys, so the names
                # we store are resolved from a lookup table on a different
                # document and cannot be excerpted from this response. The rest
                # are our own derivations, not facts EPB states.
                skip_keys=_UNCITABLE_FIELDS,
            )
            # Deliberately no `citable_url_override`: one search response backs
            # up to 200 exporters, so a per-record override would stamp the
            # first exporter's detail page onto the document every other record
            # also cites. The public detail page still reaches the UI as
            # `epb_detail_url` in the payload; the citation stays on the
            # endpoint the values actually came from, which is also the only
            # thing the verifier can re-check.

        return ScrapedRecord(
            source_code=self.source_code,
            source_ref=str(eid),
            company_name=name,
            address_raw=primary_addr,
            district=factory_district or office_district,
            payload=payload,
            evidence=evidence,
            enrich_only=enrich_only,
        )

    async def _attach_hscodes(self, rec: ScrapedRecord) -> ScrapedRecord:
        """Fill HS codes from the public exporter HTML. Search JSON has none."""
        detail_url = rec.payload.get("epb_detail_url")
        if not isinstance(detail_url, str):
            return rec
        open_url = epb_registry_open_url(rec.source_ref, detail_url)
        if open_url is None:
            return rec
        doc = await self.acquire(
            AcquireRequest(
                url=open_url,
                headers=_BROWSER_HEADERS,
                label=f"exporter {rec.source_ref} detail",
            )
        )
        if not doc.ok:
            self.log.warning(
                "epb.detail_failed",
                exporter=rec.source_ref,
                status=doc.fetch_status.value,
                error=doc.error_message,
            )
            return rec
        codes = parse_epb_hscodes(doc.text())
        if codes:
            rec.payload["epb_hscodes"] = codes
        return rec


# ----------------------------------------------------------------------
def parse_epb_hscodes(html: str | None) -> list[dict[str, str]]:
    """Parse HS code badges from an EPB exporter detail page.

    Live pages put an internal list id in the href
    (``/hscode-exporters/813``) and the Harmonised System code in the
    badge text (``6103``). Reconstructing ``/hscode-exporters/{code}``
    points at a different product. Keep the live edb href; drop other hosts.
    """
    if not html:
        return []
    out: list[dict[str, str]] = []
    seen: set[str] = set()
    for match in _HS_LINK.finditer(html):
        list_id, shown = match.group(1), match.group(2)
        if not re.fullmatch(r"\d{4,6}", shown):
            continue
        if shown in seen:
            continue
        rest = html[match.end() : match.end() + 800]
        desc_match = _HS_DESC.search(rest)
        item: dict[str, str] = {
            "code": shown,
            "source_url": f"{BASE}/hscode-exporters/{list_id}",
        }
        if desc_match:
            desc = htmlmod.unescape(
                re.sub(r"<[^>]+>", " ", desc_match.group(1))
            )
            desc = re.sub(r"\s+", " ", desc).strip()
            if desc:
                item["description"] = desc
        seen.add(shown)
        out.append(item)
    return out


def epb_registry_open_url(source_ref: str | None, detail_url: str | None) -> str | None:
    """Buyer-visible EPB Open href. Matches migration 0103 LIKE guard."""
    ref = (source_ref or "").strip()
    url = (detail_url or "").strip()
    if not ref or not url:
        return None
    prefix = f"{BASE}/exporter/{ref}/"
    if url.startswith(prefix):
        return url
    return None


def _clean(s: Any) -> str | None:
    if not s or not isinstance(s, str):
        return None
    s = re.sub(r"\s+", " ", s).strip(" .,;:")
    return s or None


def _district_name(table: dict[int, str], did: Any) -> str | None:
    if not did:
        return None
    try:
        raw = table.get(int(did))
    except (TypeError, ValueError):
        return None
    if not raw:
        return None
    return _DISTRICT_FIX.get(raw, raw)


def _extract_lookup(html: str, key: str) -> dict[int, str]:
    """Pull a `<key>: [...]` JS array out of the home page and parse it.

    Uses brace-depth scanning rather than regex to handle large arrays
    without catastrophic backtracking.
    """
    needle = f"{key}:"
    idx = 0
    while True:
        idx = html.find(needle, idx)
        if idx == -1:
            return {}
        bracket = html.find("[", idx, idx + 200)
        if bracket == -1:
            idx += len(needle)
            continue
        depth = 0
        end = -1
        for i in range(bracket, min(len(html), bracket + 400_000)):
            ch = html[i]
            if ch == "[":
                depth += 1
            elif ch == "]":
                depth -= 1
                if depth == 0:
                    end = i
                    break
        if end == -1:
            return {}
        raw = html[bracket : end + 1]
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            idx = end + 1
            continue
        out: dict[int, str] = {}
        for row in parsed:
            if isinstance(row, dict) and "id" in row and "name" in row:
                try:
                    out[int(row["id"])] = str(row["name"]).strip()
                except (TypeError, ValueError):
                    continue
        if out:
            return out
        idx = end + 1
