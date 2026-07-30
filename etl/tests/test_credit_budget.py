"""The credit ceiling that stops a runaway run from emptying the Firecrawl plan.

Credits are spent the instant a request leaves, so the only useful place to stop
is *before* the call. These tests therefore assert on how many fetches the
adapter actually saw, not just on the exception — a guard that raises after
spending has not guarded anything.

A fake adapter stands in for Firecrawl throughout, so running this suite costs
nothing.
"""
from __future__ import annotations

import asyncio
from typing import AsyncIterator, Sequence

import pytest

from etl.acquire.models import AcquiredDoc, Adapter, AcquireRequest, FetchStatus
from etl.core.acquiring import AcquiringScraper, CreditBudgetExceeded
from etl.core.config import settings


class FakeAdapter:
    """Counts calls and bills a fixed number of credits per page."""

    name = "firecrawl"

    def __init__(self, credits_per_page: int = 1) -> None:
        self.calls: list[str] = []
        self.credits_per_page = credits_per_page

    def _doc(self, request: AcquireRequest) -> AcquiredDoc:
        self.calls.append(request.url)
        return AcquiredDoc(
            url=request.url,
            adapter=Adapter.FIRECRAWL,
            fetch_status=FetchStatus.OK,
            final_url=request.url,
            http_status=200,
            raw_html="<html><body>ok</body></html>",
            credits_used=self.credits_per_page,
        )

    async def fetch(self, request: AcquireRequest) -> AcquiredDoc:
        return self._doc(request)

    async def fetch_many(
        self, requests: Sequence[AcquireRequest]
    ) -> AsyncIterator[AcquiredDoc]:
        for r in requests:
            yield self._doc(r)

    async def aclose(self) -> None:
        return None


class BudgetScraper(AcquiringScraper):
    code = "budget_probe"
    source_code = "BGMEA"
    transport = "firecrawl"
    fallback_transport = None

    def __init__(self, adapter: FakeAdapter, **kwargs) -> None:
        super().__init__(**kwargs)
        self._fake = adapter

    def _build(self, transport: str):
        return self._fake

    async def fetch(self) -> AsyncIterator:  # pragma: no cover - unused
        if False:
            yield


@pytest.fixture(autouse=True)
def _clear_ceiling(monkeypatch):
    """Default every test to "no guard" so each opts in explicitly."""
    monkeypatch.setattr(settings, "firecrawl_max_credits_per_run", 0)


def _fetch(scraper: BudgetScraper, url: str):
    return asyncio.run(scraper.acquire(AcquireRequest(url=url)))


# ---- accounting ---------------------------------------------------------

def test_credits_are_counted_on_every_fetch_not_only_cited_ones():
    """`credits_used` only counts documents that got cited; this counts spend.

    `compare-parity` consumes `fetch()` without writing evidence, so a counter
    living in the evidence writer reports zero for exactly the runs we most want
    to know the cost of.
    """
    adapter = FakeAdapter()
    s = BudgetScraper(adapter)
    _fetch(s, "https://example.test/a")
    _fetch(s, "https://example.test/b")
    assert s.credits_spent == 2
    assert s.credits_used == 0  # nothing was cited


def test_a_pricier_page_is_counted_at_what_it_actually_cost():
    adapter = FakeAdapter(credits_per_page=5)  # enhanced proxy pricing
    s = BudgetScraper(adapter)
    _fetch(s, "https://example.test/a")
    assert s.credits_spent == 5


# ---- the ceiling --------------------------------------------------------

def test_no_ceiling_configured_means_no_limit():
    adapter = FakeAdapter()
    s = BudgetScraper(adapter)
    for i in range(20):
        _fetch(s, f"https://example.test/{i}")
    assert len(adapter.calls) == 20


def test_the_run_aborts_before_the_fetch_that_would_pass_the_ceiling(monkeypatch):
    monkeypatch.setattr(settings, "firecrawl_max_credits_per_run", 3)
    adapter = FakeAdapter()
    s = BudgetScraper(adapter)

    for i in range(3):
        _fetch(s, f"https://example.test/{i}")
    assert s.credits_spent == 3

    with pytest.raises(CreditBudgetExceeded) as excinfo:
        _fetch(s, "https://example.test/over")

    # The decisive assertion: the over-budget page was never requested, so no
    # credit was spent on it. Raising after the call would be no guard at all.
    assert len(adapter.calls) == 3
    assert "https://example.test/over" not in adapter.calls
    assert s.credits_spent == 3
    message = str(excinfo.value)
    assert "budget_probe" in message
    assert "3" in message
    assert "Nothing was fetched" in message


def test_a_batch_is_checked_as_a_whole_before_any_of_it_is_dispatched(monkeypatch):
    """A per-item check cannot help once a batch is in flight concurrently."""
    monkeypatch.setattr(settings, "firecrawl_max_credits_per_run", 2)
    adapter = FakeAdapter()
    s = BudgetScraper(adapter)

    async def drain():
        reqs = [AcquireRequest(url=f"https://example.test/{i}") for i in range(5)]
        return [doc async for doc in s.acquire_many(reqs)]

    with pytest.raises(CreditBudgetExceeded):
        asyncio.run(drain())
    assert adapter.calls == []


def test_an_expensive_request_is_projected_before_it_is_sent(monkeypatch):
    """Enhanced proxy bills up to 5, so it must be priced at 5 before dispatch."""
    monkeypatch.setattr(settings, "firecrawl_max_credits_per_run", 4)
    adapter = FakeAdapter(credits_per_page=5)
    s = BudgetScraper(adapter)

    with pytest.raises(CreditBudgetExceeded):
        asyncio.run(s.acquire(AcquireRequest(url="https://example.test/a", proxy="enhanced")))
    assert adapter.calls == []


# ---- transports that do not bill ---------------------------------------

def test_the_direct_transport_is_not_charged_against_the_ceiling(monkeypatch):
    """Only Firecrawl bills. Charging httpx a notional cost would stop free runs."""
    monkeypatch.setattr(settings, "firecrawl_max_credits_per_run", 1)

    class DirectProbe(BudgetScraper):
        transport = "direct"
        fallback_transport = None

    adapter = FakeAdapter(credits_per_page=0)
    s = DirectProbe(adapter)
    for i in range(10):
        _fetch(s, f"https://example.test/{i}")
    assert len(adapter.calls) == 10


# ---- per-source override ------------------------------------------------

def test_a_source_may_tighten_the_global_ceiling(monkeypatch):
    monkeypatch.setattr(settings, "firecrawl_max_credits_per_run", 100)

    class Frugal(BudgetScraper):
        max_credits_per_run = 2

    s = Frugal(FakeAdapter())
    assert s.credit_ceiling == 2


def test_a_source_cannot_loosen_the_global_ceiling(monkeypatch):
    """Otherwise a stray class attribute becomes licence to outspend the budget."""
    monkeypatch.setattr(settings, "firecrawl_max_credits_per_run", 10)

    class Greedy(BudgetScraper):
        max_credits_per_run = 10_000

    s = Greedy(FakeAdapter())
    assert s.credit_ceiling == 10


def test_a_source_ceiling_still_applies_when_no_global_one_is_set(monkeypatch):
    monkeypatch.setattr(settings, "firecrawl_max_credits_per_run", 0)

    class Frugal(BudgetScraper):
        max_credits_per_run = 7

    s = Frugal(FakeAdapter())
    assert s.credit_ceiling == 7
