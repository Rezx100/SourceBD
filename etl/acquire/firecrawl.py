"""Firecrawl Cloud adapter.

Covers the four endpoints the pipeline needs:

* ``POST /v2/scrape``        — one page or document
* ``POST /v2/batch/scrape``  — many URLs as one job (used for registry details)
* ``POST /v2/map``           — URL discovery on a domain
* ``POST /v2/monitor``       — scheduled re-checks that webhook us on change

Design notes
------------
* **Deterministic only.** We request ``markdown`` + ``rawHtml`` and parse with
  our own code. Firecrawl's LLM ``json`` format is never requested here: it
  costs 4 extra credits per page and is non-deterministic, which is
  unacceptable between a government register and a stored fact (Hard Rule 5).
* **Failures are values, not exceptions.** Any HTTP or Firecrawl-level error
  becomes an `AcquiredDoc` with a non-OK `fetch_status`, so callers and the
  evidence verifier can tell "gone" from "unreadable right now".
* **Credits are recorded, not assumed.** We read the API's own figure when it
  reports one and fall back to a documented estimate otherwise.
"""
from __future__ import annotations

import asyncio
from typing import Any, AsyncIterator, Sequence

import httpx

from etl.acquire.base import AcquisitionAdapter
from etl.acquire.models import (
    AcquiredDoc,
    AcquireRequest,
    Adapter,
    FetchStatus,
    classify_firecrawl_error,
)
from etl.core.config import settings
from etl.core.logging import get_logger

log = get_logger("etl.acquire.firecrawl")

# Firecrawl's own ceiling for a single scrape.
_MAX_TIMEOUT_MS = 300_000
_BATCH_CHUNK = 50
_BATCH_POLL_SEC = 3.0
_BATCH_MAX_WAIT_SEC = 1800.0
_RETRY_STATUS = frozenset({429, 500, 502, 503, 504})
_MAX_ATTEMPTS = 4


class FirecrawlNotConfigured(RuntimeError):
    pass


def _require_key() -> str:
    key = settings.firecrawl_api_key
    if not key:
        raise FirecrawlNotConfigured(
            "FIRECRAWL_API_KEY is not set. Add it to .env "
            "(see .env.example) before running Firecrawl-backed scrapers."
        )
    return key


def estimate_credits(request: AcquireRequest, pdf_pages: int | None = None) -> int:
    """Documented credit estimate, used when the API reports no figure.

    Base 1/page. Enhanced proxy costs up to 5. PDF parsing bills 1 credit per
    parsed PDF page. We never request the LLM json format, so its +4 never
    applies here.
    """
    if pdf_pages and pdf_pages > 0:
        base = pdf_pages
    else:
        base = 1
    if request.proxy == "enhanced":
        base = max(base, 5)
    return base


class FirecrawlAdapter(AcquisitionAdapter):
    """Acquire pages and documents through Firecrawl Cloud."""

    name = "firecrawl"

    def __init__(
        self,
        api_key: str | None = None,
        api_base: str | None = None,
        max_concurrency: int | None = None,
    ) -> None:
        self._api_key = api_key or _require_key()
        self._base = (api_base or settings.firecrawl_api_base).rstrip("/")
        limit = max_concurrency or settings.firecrawl_max_concurrency
        self._sem = asyncio.Semaphore(max(1, limit))
        self._client = httpx.AsyncClient(
            base_url=self._base,
            headers={
                "Authorization": f"Bearer {self._api_key}",
                "Content-Type": "application/json",
            },
            timeout=httpx.Timeout(360.0, connect=20.0),
            follow_redirects=True,
        )

    async def aclose(self) -> None:
        await self._client.aclose()

    # ------------------------------------------------------------------ body
    def _scrape_body(self, request: AcquireRequest) -> dict[str, Any]:
        formats: list[Any] = [f for f in request.formats]
        if request.include_screenshot and "screenshot" not in formats:
            formats.append("screenshot")

        timeout_ms = min(
            request.timeout_ms or settings.firecrawl_timeout_ms, _MAX_TIMEOUT_MS
        )
        body: dict[str, Any] = {
            "url": request.url,
            "formats": formats,
            # Registry tables live outside <main>; the default True would drop them.
            "onlyMainContent": request.only_main_content,
            "proxy": request.proxy,
            "timeout": timeout_ms,
        }
        if request.headers:
            # Note: sending headers forces storeInCache=false upstream.
            body["headers"] = dict(request.headers)
        if request.actions:
            body["actions"] = [dict(a) for a in request.actions]
        if request.wait_for_ms:
            body["waitFor"] = request.wait_for_ms
        if request.max_age_ms is not None:
            body["maxAge"] = request.max_age_ms
        if request.include_tags:
            body["includeTags"] = list(request.include_tags)
        if request.exclude_tags:
            body["excludeTags"] = list(request.exclude_tags)
        if request.parse_pdf:
            parser: dict[str, Any] = {"type": "pdf"}
            if request.pdf_max_pages:
                parser["maxPages"] = request.pdf_max_pages
            body["parsers"] = [parser]
        else:
            body["parsers"] = []
        return body

    # ----------------------------------------------------------------- fetch
    async def fetch(self, request: AcquireRequest) -> AcquiredDoc:
        body = self._scrape_body(request)
        async with self._sem:
            payload, http_status, err = await self._post_with_retry("/v2/scrape", body)

        if err is not None:
            return AcquiredDoc(
                url=request.url,
                adapter=Adapter.FIRECRAWL,
                fetch_status=classify_firecrawl_error(None, http_status),
                http_status=http_status,
                error_message=err,
                meta={"label": request.label} if request.label else {},
            )

        if not payload.get("success", False):
            code = payload.get("code") or payload.get("errorCode")
            return AcquiredDoc(
                url=request.url,
                adapter=Adapter.FIRECRAWL,
                fetch_status=classify_firecrawl_error(code, http_status),
                http_status=http_status,
                error_code=code,
                error_message=str(payload.get("error") or "")[:500] or None,
                meta={"label": request.label} if request.label else {},
            )

        return self._doc_from_data(request, payload.get("data") or {}, http_status)

    def _doc_from_data(
        self,
        request: AcquireRequest,
        data: dict[str, Any],
        http_status: int | None,
    ) -> AcquiredDoc:
        metadata = data.get("metadata") or {}
        page_status = metadata.get("statusCode")
        pdf_pages = metadata.get("numPages")
        credits = data.get("creditsUsed") or metadata.get("creditsUsed")

        actions = data.get("actions") or {}
        shots = actions.get("screenshots") or []
        screenshot = data.get("screenshot") or (shots[0] if shots else None)

        # Values returned by `executeJavascript` actions, in request order. This
        # is how a source whose data comes from a same-origin POST endpoint is
        # reached: the script runs inside the loaded page, so the request carries
        # the site's own cookies and real browser TLS.
        js_returns = [
            item.get("value")
            for item in (actions.get("javascriptReturns") or [])
            if isinstance(item, dict)
        ]

        # A page that resolved but returned 404 is a dead citation, not a
        # successful acquisition — surface it as NOT_FOUND.
        status = FetchStatus.OK
        if isinstance(page_status, int):
            if page_status == 404 or page_status == 410:
                status = FetchStatus.NOT_FOUND
            elif page_status in (401, 403, 429):
                status = FetchStatus.BLOCKED
            elif page_status >= 500:
                status = FetchStatus.ERROR

        return AcquiredDoc(
            url=request.url,
            adapter=Adapter.FIRECRAWL,
            fetch_status=status,
            final_url=metadata.get("url") or metadata.get("sourceURL") or request.url,
            http_status=page_status if isinstance(page_status, int) else http_status,
            markdown=data.get("markdown"),
            raw_html=data.get("rawHtml") or data.get("html"),
            content_type=metadata.get("contentType"),
            title=metadata.get("title"),
            links=tuple(data.get("links") or ()),
            screenshot_url=screenshot,
            credits_used=int(credits) if isinstance(credits, (int, float)) else estimate_credits(request, pdf_pages),
            js_returns=tuple(js_returns),
            meta={
                k: v
                for k, v in {
                    "label": request.label,
                    "pdf_pages": pdf_pages,
                    "firecrawl_cached": metadata.get("cacheState"),
                    "only_main_content": request.only_main_content,
                    # How much of this document a later verify pass can
                    # reproduce. A plain scrape replays exactly, so excerpt drift
                    # is meaningful. When the content only exists because an
                    # action sequence produced it — SA8000's in-page harvest,
                    # RSC's modal walk — a replay reaches the page but not the
                    # same payload, so a missing excerpt there means "could not
                    # check", not "the fact changed". Conflating the two would
                    # mark every such claim stale on the first pass.
                    "verify_mode": "liveness" if request.actions else "full",
                }.items()
                if v is not None
            },
        )

    # ----------------------------------------------------------------- batch
    async def fetch_many(
        self, requests: Sequence[AcquireRequest]
    ) -> AsyncIterator[AcquiredDoc]:
        """Batch-scrape URLs that share one option set.

        Firecrawl's batch endpoint applies one option set to every URL, so we
        group by option signature. Any group whose job fails falls back to
        per-URL scrapes rather than losing the whole batch.
        """
        if not requests:
            return

        groups: dict[str, list[AcquireRequest]] = {}
        for req in requests:
            body = self._scrape_body(req)
            body.pop("url", None)
            key = repr(sorted(body.items(), key=lambda kv: kv[0]))
            groups.setdefault(key, []).append(req)

        for group in groups.values():
            template = self._scrape_body(group[0])
            template.pop("url", None)
            for start in range(0, len(group), _BATCH_CHUNK):
                chunk = group[start : start + _BATCH_CHUNK]
                async for doc in self._run_batch(chunk, template):
                    yield doc

    async def _run_batch(
        self, chunk: Sequence[AcquireRequest], options: dict[str, Any]
    ) -> AsyncIterator[AcquiredDoc]:
        by_url = {r.url: r for r in chunk}
        body = {"urls": [r.url for r in chunk], **options}

        payload, http_status, err = await self._post_with_retry("/v2/batch/scrape", body)
        job_id = (payload or {}).get("id")
        if err is not None or not job_id:
            log.warning(
                "firecrawl.batch_submit_failed",
                error=err,
                status=http_status,
                urls=len(chunk),
            )
            for req in chunk:
                yield await self.fetch(req)
            return

        seen: set[str] = set()
        waited = 0.0
        while waited <= _BATCH_MAX_WAIT_SEC:
            await asyncio.sleep(_BATCH_POLL_SEC)
            waited += _BATCH_POLL_SEC
            status_payload, s_status, s_err = await self._get_with_retry(
                f"/v2/batch/scrape/{job_id}"
            )
            if s_err is not None:
                log.warning("firecrawl.batch_poll_failed", error=s_err, status=s_status)
                continue

            for item in status_payload.get("data") or []:
                meta = item.get("metadata") or {}
                src = meta.get("sourceURL") or meta.get("url")
                req = by_url.get(src or "")
                if req is None or (src in seen):
                    continue
                seen.add(src)
                yield self._doc_from_data(req, item, s_status)

            state = status_payload.get("status")
            if state in ("completed", "failed", "cancelled"):
                break

        # Anything the job never returned gets a single direct retry so a
        # partial batch never silently drops suppliers.
        for url, req in by_url.items():
            if url not in seen:
                yield await self.fetch(req)

    # ------------------------------------------------------------------- map
    async def map_urls(
        self, url: str, search: str | None = None, limit: int | None = None
    ) -> list[str]:
        """Discover URLs on a site. Used for registry list-page enumeration."""
        body: dict[str, Any] = {"url": url}
        if search:
            body["search"] = search
        if limit:
            body["limit"] = limit
        payload, _status, err = await self._post_with_retry("/v2/map", body)
        if err is not None:
            log.warning("firecrawl.map_failed", url=url, error=err)
            return []
        links = payload.get("links") or []
        out: list[str] = []
        for link in links:
            if isinstance(link, str):
                out.append(link)
            elif isinstance(link, dict) and link.get("url"):
                out.append(str(link["url"]))
        return out

    # --------------------------------------------------------------- monitor
    async def create_monitor(self, spec: dict[str, Any]) -> dict[str, Any]:
        """Register a monitor. Raises unless Firecrawl actually accepted it.

        `_request_with_retry` surfaces a 4xx with a JSON body as (payload,
        status, None) — no error — so the caller must check both the HTTP
        status and the `success` flag, exactly as `fetch()` does. Recording an
        error body as a registration writes a local row with a NULL monitor id:
        a phantom that looks registered, reports nothing, and is invisible to
        reconciliation (6 of them in production on 2 Aug 2026).
        """
        payload, http_status, err = await self._post_with_retry("/v2/monitor", spec)
        if err is not None:
            raise RuntimeError(f"firecrawl monitor create failed: {err}")
        if http_status is not None and not 200 <= http_status < 300:
            detail = payload.get("error") or payload.get("message") or ""
            raise RuntimeError(
                f"firecrawl monitor create failed: HTTP {http_status}"
                + (f": {detail}" if detail else "")
            )
        if not payload.get("success", False):
            detail = payload.get("error") or payload.get("message") or "success flag absent"
            raise RuntimeError(f"firecrawl monitor create failed: {detail}")
        return payload

    async def list_monitors(self) -> list[dict[str, Any]]:
        payload, _status, err = await self._get_with_retry("/v2/monitor")
        if err is not None:
            log.warning("firecrawl.monitor_list_failed", error=err)
            return []
        data = payload.get("monitors") or payload.get("data") or []
        return [m for m in data if isinstance(m, dict)]

    async def delete_monitor(self, monitor_id: str) -> bool:
        try:
            resp = await self._client.delete(f"/v2/monitor/{monitor_id}")
        except httpx.HTTPError as exc:  # noqa: BLE001
            log.warning("firecrawl.monitor_delete_failed", id=monitor_id, error=str(exc))
            return False
        return resp.status_code in (200, 202, 204)

    # ----------------------------------------------------------------- plumb
    async def _post_with_retry(
        self, path: str, body: dict[str, Any]
    ) -> tuple[dict[str, Any], int | None, str | None]:
        return await self._request_with_retry("POST", path, json=body)

    async def _get_with_retry(
        self, path: str
    ) -> tuple[dict[str, Any], int | None, str | None]:
        return await self._request_with_retry("GET", path)

    async def _request_with_retry(
        self, method: str, path: str, **kwargs: Any
    ) -> tuple[dict[str, Any], int | None, str | None]:
        """Return (payload, http_status, error). Never raises on transport."""
        last_status: int | None = None
        last_error: str | None = None
        for attempt in range(1, _MAX_ATTEMPTS + 1):
            try:
                resp = await self._client.request(method, path, **kwargs)
            except httpx.HTTPError as exc:  # noqa: BLE001
                last_error = f"{type(exc).__name__}: {exc}"
                last_status = None
            else:
                last_status = resp.status_code
                if resp.status_code in _RETRY_STATUS:
                    last_error = f"HTTP {resp.status_code}"
                    retry_after = resp.headers.get("retry-after")
                    if retry_after and retry_after.isdigit():
                        await asyncio.sleep(min(float(retry_after), 60.0))
                        continue
                elif 200 <= resp.status_code < 300:
                    try:
                        return resp.json(), resp.status_code, None
                    except ValueError:
                        return {}, resp.status_code, "response was not JSON"
                else:
                    # 4xx other than 429: deterministic, do not retry. Firecrawl
                    # puts the reason in the body, so surface it.
                    try:
                        payload = resp.json()
                    except ValueError:
                        payload = {}
                    if payload:
                        return payload, resp.status_code, None
                    return {}, resp.status_code, f"HTTP {resp.status_code}"

            if attempt < _MAX_ATTEMPTS:
                await asyncio.sleep(min(2.0 * (2 ** (attempt - 1)), 30.0))

        return {}, last_status, last_error or "request failed"
