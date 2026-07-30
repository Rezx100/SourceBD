"""SourceBD acquisition layer.

One interface over three transports. Scrapers declare *what* to acquire; the
adapter decides *how*. See `context/architecture.md` → Data layer for the
Firecrawl Hard-Rule-4 exception and its scope.

    from etl.acquire import AcquireRequest, get_adapter, Transport

    async with get_adapter(Transport.FIRECRAWL) as adapter:
        doc = await adapter.fetch(AcquireRequest(url=..., only_main_content=False))
"""
from __future__ import annotations

from enum import Enum
from typing import Any

from etl.acquire.base import AcquisitionAdapter, chunked
from etl.acquire.direct import DirectAdapter
from etl.acquire.firecrawl import FirecrawlAdapter, FirecrawlNotConfigured, estimate_credits
from etl.acquire.local import LocalFileAdapter, path_to_url, url_to_path
from etl.acquire.models import (
    AcquiredDoc,
    AcquireRequest,
    Adapter,
    FetchStatus,
    classify_firecrawl_error,
)


class Transport(str, Enum):
    """Declared transport for a source. Mirrors `Adapter` but is the knob a
    scraper sets, whereas `Adapter` is what actually produced a document."""

    FIRECRAWL = "firecrawl"
    DIRECT = "direct"
    LOCAL = "local"


def get_adapter(transport: Transport | str, **kwargs: Any) -> AcquisitionAdapter:
    """Construct the adapter for a transport."""
    value = transport.value if isinstance(transport, Transport) else str(transport)
    if value == Transport.FIRECRAWL.value:
        return FirecrawlAdapter(**kwargs)
    if value == Transport.DIRECT.value:
        return DirectAdapter(**kwargs)
    if value == Transport.LOCAL.value:
        return LocalFileAdapter()
    raise ValueError(f"unknown transport: {value!r}")


__all__ = [
    "AcquiredDoc",
    "AcquireRequest",
    "AcquisitionAdapter",
    "Adapter",
    "DirectAdapter",
    "FetchStatus",
    "FirecrawlAdapter",
    "FirecrawlNotConfigured",
    "LocalFileAdapter",
    "Transport",
    "chunked",
    "classify_firecrawl_error",
    "estimate_credits",
    "get_adapter",
    "path_to_url",
    "url_to_path",
]
