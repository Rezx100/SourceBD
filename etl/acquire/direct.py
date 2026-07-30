"""Direct httpx adapter.

Used for the transports Firecrawl cannot express, where re-parsing a rendered
page would destroy typed fidelity:

* JSON APIs (RSC/Accord, GOTS/GTB, Open Supply Hub)
* POST APIs with bodies or CSRF tokens (EPB) and Power BI semantic queries (WRAP)
* CSV (OFAC), XML (UK OFSI, EU FSD), XLSX (ILAB)
* binary document downloads (RSC compliance docs)

Transport behaviour is unchanged from the pre-Firecrawl pipeline: this wraps
the existing `etl.core.http.HttpClient`, so rate limits, retry policy and the
documented `SourceBD-Research` User-Agent are exactly as before. What is new is
that results arrive as `AcquiredDoc`, so these sources produce the same
evidence rows as Firecrawl-backed ones.
"""
from __future__ import annotations

from typing import Any

import httpx

from etl.acquire.base import AcquisitionAdapter
from etl.acquire.models import AcquiredDoc, AcquireRequest, Adapter, FetchStatus
from etl.core.http import HttpClient
from etl.core.logging import get_logger

log = get_logger("etl.acquire.direct")

_TEXTUAL = ("text/", "application/json", "application/xml", "+xml", "javascript", "csv")


def _status_for(exc: Exception) -> tuple[FetchStatus, int | None, str]:
    if isinstance(exc, httpx.HTTPStatusError):
        code = exc.response.status_code
        if code in (404, 410):
            return FetchStatus.NOT_FOUND, code, f"HTTP {code}"
        if code in (401, 403, 429):
            return FetchStatus.BLOCKED, code, f"HTTP {code}"
        if code == 408:
            return FetchStatus.TIMEOUT, code, f"HTTP {code}"
        return FetchStatus.ERROR, code, f"HTTP {code}"
    if isinstance(exc, (httpx.ReadTimeout, httpx.ConnectTimeout, httpx.PoolTimeout)):
        return FetchStatus.TIMEOUT, None, f"{type(exc).__name__}: {exc}"
    return FetchStatus.ERROR, None, f"{type(exc).__name__}: {exc}"


class DirectAdapter(AcquisitionAdapter):
    """Fetch through our own httpx client, preserving legacy semantics."""

    name = "direct"

    def __init__(
        self,
        rps: float | None = None,
        headers: dict[str, str] | None = None,
        client: HttpClient | None = None,
        verify: Any | None = None,
    ) -> None:
        self._owns_client = client is None
        self._client = client or HttpClient(rps=rps, headers=headers)
        if verify is not None:
            # Some origins (rsc-bd.org) need a custom trust store. Firecrawl
            # handles this with skipTlsVerification; here we swap the context.
            self._client._client = httpx.AsyncClient(  # noqa: SLF001
                headers=self._client._headers,  # noqa: SLF001
                timeout=httpx.Timeout(180.0, connect=20.0, read=180.0),
                http2=False,
                follow_redirects=True,
                verify=verify,
            )

    def cookie(self, name: str) -> str | None:
        """Read a cookie from the shared session (see `HttpClient.cookie`)."""
        return self._client.cookie(name)

    async def aclose(self) -> None:
        if self._owns_client:
            await self._client.aclose()

    async def fetch(self, request: AcquireRequest) -> AcquiredDoc:
        kwargs: dict[str, Any] = {}
        if request.params is not None:
            kwargs["params"] = request.params
        if request.json_body is not None:
            kwargs["json"] = request.json_body
        if request.content is not None:
            kwargs["content"] = request.content
        if request.headers:
            kwargs["headers"] = dict(request.headers)

        method = request.method.upper()
        try:
            if method == "POST":
                resp = await self._client.post(request.url, **kwargs)
            elif method == "GET":
                resp = await self._client.get(request.url, **kwargs)
            else:
                # HEAD, used to resolve a file's type from Content-Type when the
                # URL carries no extension (brand disclosure CDN routes).
                resp = await self._client._request(method, request.url, **kwargs)  # noqa: SLF001
        except Exception as exc:  # noqa: BLE001 — failures are values here
            status, http_status, message = _status_for(exc)
            log.info(
                "direct.fetch_failed", url=request.url, status=status.value, error=message
            )
            return AcquiredDoc(
                url=request.url,
                adapter=Adapter.DIRECT,
                fetch_status=status,
                http_status=http_status,
                error_message=message[:500],
                meta={"label": request.label} if request.label else {},
            )

        content_type = resp.headers.get("content-type", "")
        textual = any(token in content_type.lower() for token in _TEXTUAL)

        # How much of this document the verifier can reproduce later. A citation
        # is only drift-checkable if the exact request can be reissued from the
        # stored row, and a POST body cannot — an EPB search page, a Power BI
        # semantic query, an OEKO-TEX session-keyed form. Marking those `none`
        # keeps them out of the verify queue rather than letting every pass fail
        # forever and inflate their transient-failure count.
        meta: dict[str, Any] = {
            "method": method,
            "verify_mode": "full" if method == "GET" else "none",
        }
        if request.label:
            meta["label"] = request.label
        # Needed to name a downloaded file when the URL carries no extension.
        disposition = resp.headers.get("content-disposition")
        if disposition:
            meta["content_disposition"] = disposition

        doc = AcquiredDoc(
            url=request.url,
            adapter=Adapter.DIRECT,
            fetch_status=FetchStatus.OK,
            final_url=str(resp.url),
            http_status=resp.status_code,
            content_type=content_type or None,
            body_bytes=resp.content if method != "HEAD" else None,
            meta=meta,
        )
        # Keep a decoded view for HTML/JSON/XML/CSV so parsers can use
        # `doc.text()` without caring about the transport.
        if textual and not request.want_bytes:
            if "html" in content_type.lower():
                doc.raw_html = resp.text
            else:
                doc.markdown = None
        return doc
