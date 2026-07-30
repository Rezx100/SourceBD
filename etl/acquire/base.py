"""Adapter protocol for the acquisition layer."""
from __future__ import annotations

import abc
from typing import AsyncIterator, Iterable, Sequence

from etl.acquire.models import AcquiredDoc, AcquireRequest


class AcquisitionAdapter(abc.ABC):
    """A transport that can turn an `AcquireRequest` into an `AcquiredDoc`.

    Adapters never raise on an HTTP-level failure — they return a doc with a
    non-OK `fetch_status`. Only programming errors and misconfiguration raise.
    That contract is what lets the evidence verifier distinguish "this page is
    gone" from "we could not read it right now" without try/except sprawl at
    every call site.
    """

    name: str = ""

    @abc.abstractmethod
    async def fetch(self, request: AcquireRequest) -> AcquiredDoc:
        """Acquire one document."""

    async def fetch_many(
        self, requests: Sequence[AcquireRequest]
    ) -> AsyncIterator[AcquiredDoc]:
        """Acquire several documents. Default is sequential; adapters that
        support real batching override this."""
        for req in requests:
            yield await self.fetch(req)

    async def aclose(self) -> None:
        """Release transport resources."""

    async def __aenter__(self) -> "AcquisitionAdapter":
        return self

    async def __aexit__(self, *exc: object) -> None:
        await self.aclose()


def chunked(items: Sequence[object], size: int) -> Iterable[Sequence[object]]:
    """Split a sequence into fixed-size chunks (batch submission helper)."""
    if size < 1:
        raise ValueError("chunk size must be >= 1")
    for start in range(0, len(items), size):
        yield items[start : start + size]
