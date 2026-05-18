"""EPB Exporter Database scraper — RMG sector only.

Source: Bangladesh Export Promotion Bureau Exporter Database
(https://edb.epb.gov.bd/). Tier 1 government register.

Strategy
--------
The site is a Vue.js SPA backed by `POST /api/exporters-search`. Filtering by
association id (BGMEA=1, BKMEA=2) returns the full BGMEA/BKMEA exporter set
inline as JSON — no per-detail-page fetches required.

We deliberately scope to BGMEA + BKMEA associations only because EPB also
publishes jute, fish, plastic, leather, agriculture and other exporters that
are out of scope for SourceBD's RMG focus.

District / thana names are not in the API response (only foreign-key ids).
We extract the embedded `districts` / `thanas` lookup tables from the home
page on startup and resolve names locally.
"""
from __future__ import annotations

import json
import re
import urllib.parse
from typing import Any, AsyncIterator

import httpx

from etl.core.http import HttpClient
from etl.core.scraper import BaseScraper, ScrapedRecord

BASE = "https://edb.epb.gov.bd"
HOME_URL = f"{BASE}/exporters"
SEARCH_URL = f"{BASE}/api/exporters-search"
DETAIL_TEMPLATE = f"{BASE}/exporter/{{id}}/{{slug}}"

# Association ids confirmed via /association-exporters/{id}/{slug} URL pattern.
RMG_ASSOCIATIONS: dict[int, str] = {1: "BGMEA", 2: "BKMEA"}

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


class EpbScraper(BaseScraper):
    code = "epb_web"
    source_code = "EPB"

    async def fetch(self) -> AsyncIterator[ScrapedRecord]:
        async with HttpClient(rps=1.0, headers=_BROWSER_HEADERS) as http:
            districts, thanas, categories = await self._bootstrap(http)
            self.log.info(
                "epb.bootstrap",
                districts=len(districts),
                thanas=len(thanas),
                categories=len(categories),
            )

            for assoc_id, assoc_name in RMG_ASSOCIATIONS.items():
                yielded = 0
                async for rec in self._fetch_association(
                    http, assoc_id, assoc_name, districts, thanas
                ):
                    yielded += 1
                    yield rec
                self.log.info(
                    "epb.association_done",
                    association=assoc_name,
                    count=yielded,
                )

    # ------------------------------------------------------------------
    async def _bootstrap(
        self, http: HttpClient
    ) -> tuple[dict[int, str], dict[int, str], dict[int, str]]:
        """Hit the home page once to collect the XSRF cookie + lookup tables."""
        resp = await http.get(HOME_URL)
        html = resp.text

        # HttpClient doesn't expose cookies publicly; reach in once for the
        # XSRF-TOKEN that Laravel demands on the API call.
        xsrf_raw = http._client.cookies.get("XSRF-TOKEN", "")  # noqa: SLF001
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
        http: HttpClient,
        assoc_id: int,
        assoc_name: str,
        districts: dict[int, str],
        thanas: dict[int, str],
    ) -> AsyncIterator[ScrapedRecord]:
        headers = {
            "Accept": "application/json, text/plain, */*",
            "Content-Type": "application/json",
            "Referer": f"{BASE}/association-exporters/{assoc_id}/{assoc_name.lower()}",
            "X-Requested-With": "XMLHttpRequest",
            "X-XSRF-TOKEN": self._xsrf,
            "Origin": BASE,
        }

        # Page through results. The Vue UI uses limit=8; we ask for 200 per
        # request to minimise round-trips while staying friendly.
        limit = 200
        offset = 0
        seen_ids: set[int] = set()
        while True:
            payload = {
                "private": False,
                "approval_status": 1,
                "category_id": 0,
                "district_id": 0,
                "reg_type": None,
                "exporter_type": 0,
                "hscodes": [],
                "associations": [assoc_id],
                "keyword": "",
                "offset": offset,
                "limit": limit,
                "order_by": "exporters.name",
                "order": "asc",
            }

            try:
                resp = await http.post(SEARCH_URL, json=payload, headers=headers)
            except httpx.HTTPError as e:
                self.log.warning(
                    "epb.search_failed",
                    association=assoc_name,
                    offset=offset,
                    error=str(e),
                )
                break

            try:
                data = resp.json()
            except json.JSONDecodeError:
                self.log.warning(
                    "epb.search_non_json",
                    association=assoc_name,
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
                association=assoc_name,
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
                rec = self._build_record(ex, assoc_name, districts, thanas)
                if rec is not None:
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
        assoc_name: str,
        districts: dict[int, str],
        thanas: dict[int, str],
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
            "epb_associations": [assoc_name],
            "epb_logo": ex.get("logo"),
            "epb_detail_url": detail_url,
            "epb_registered": True,
        }
        payload = {k: v for k, v in payload.items() if v not in (None, "", [])}

        return ScrapedRecord(
            source_code=self.source_code,
            source_ref=str(eid),
            company_name=name,
            address_raw=primary_addr,
            district=factory_district or office_district,
            payload=payload,
        )


# ----------------------------------------------------------------------
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
