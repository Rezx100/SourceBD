"""Async HTTP client with retry, backoff, and rate-limit hooks."""
from __future__ import annotations

from typing import Any

import httpx
from tenacity import (
    AsyncRetrying,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential_jitter,
)

from etl.core.config import settings
from etl.core.logging import get_logger
from etl.core.ratelimit import RateLimiter

log = get_logger("etl.http")


_RETRY_EXC = (httpx.TransportError, httpx.HTTPStatusError, httpx.ReadTimeout)


class HttpClient:
    def __init__(self, rps: float | None = None, headers: dict[str, str] | None = None) -> None:
        self._limiter = RateLimiter(rps if rps is not None else settings.etl_rate_limit_rps)
        self._headers = {
            "User-Agent": settings.etl_user_agent,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            **(headers or {}),
        }
        self._client = httpx.AsyncClient(
            headers=self._headers,
            timeout=httpx.Timeout(180.0, connect=20.0, read=180.0),
            http2=False,
            follow_redirects=True,
        )

    async def aclose(self) -> None:
        await self._client.aclose()

    async def __aenter__(self) -> "HttpClient":
        return self

    async def __aexit__(self, *exc: Any) -> None:
        await self.aclose()

    async def get(self, url: str, **kwargs: Any) -> httpx.Response:
        return await self._request("GET", url, **kwargs)

    async def post(self, url: str, **kwargs: Any) -> httpx.Response:
        return await self._request("POST", url, **kwargs)

    async def _request(self, method: str, url: str, **kwargs: Any) -> httpx.Response:
        async for attempt in AsyncRetrying(
            stop=stop_after_attempt(settings.etl_max_retries),
            wait=wait_exponential_jitter(initial=settings.etl_retry_backoff_base, max=60),
            retry=retry_if_exception_type(_RETRY_EXC),
            reraise=True,
        ):
            with attempt:
                await self._limiter.acquire()
                resp = await self._client.request(method, url, **kwargs)
                if resp.status_code in (429, 502, 503, 504):
                    log.warning("http.retry_status", url=url, status=resp.status_code)
                    resp.raise_for_status()
                resp.raise_for_status()
                return resp
        raise RuntimeError("unreachable")  # pragma: no cover
