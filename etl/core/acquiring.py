"""Transport plumbing for scrapers that fetch through the acquisition layer.

The point of this mixin is that a source's *parser* never knows which transport
delivered its bytes. That is what makes the Firecrawl migration verifiable: the
same scraper can be instantiated with `transport="direct"` or
`transport="firecrawl"` and the outputs compared field by field
(`python -m etl.cli compare-parity <code>`).

It also gives us a real answer to vendor dependency. If Firecrawl is
unreachable or unconfigured, a source that does not need JS rendering falls back
to the direct adapter and keeps ingesting, with the degradation recorded on the
run rather than silently swallowed.

Two concrete bases are exported, because the pipeline has two record shapes:
`AcquiringScraper` (yields `ScrapedRecord`) and `AcquiringSanctionScraper`
(yields `SanctionEntry`).
"""
from __future__ import annotations

from typing import Any, AsyncIterator, Sequence

from etl.acquire import (
    AcquiredDoc,
    AcquireRequest,
    AcquisitionAdapter,
    DirectAdapter,
    FirecrawlAdapter,
    LocalFileAdapter,
    Transport,
    estimate_credits,
)
from etl.core.config import settings
from etl.core.sanctions import BaseSanctionScraper
from etl.core.scraper import BaseScraper


class CreditBudgetExceeded(RuntimeError):
    """A run tried to spend past its credit ceiling and was stopped.

    Deliberately an error rather than a graceful stop. Stopping quietly would
    hand the pipeline a partial registry that looks complete — the same failure
    `bgmea_web` already refuses on a transient list-page error — and a truncated
    member list is worse than no run, because it silently ages out every record
    it never reached. Failing loudly leaves the previous data intact.
    """


class AcquisitionMixin:
    """Adds adapter selection, fallback and fetch helpers to a scraper base."""

    # Transport this source should use in production.
    transport: str = Transport.FIRECRAWL.value
    # Transport to use if the preferred one is unavailable. None = no fallback,
    # which is correct for sources that genuinely need Firecrawl's proxying or
    # browser actions (sa8000, rsc_updates) — silently fetching those without a
    # browser would produce an empty page that parses to zero records.
    fallback_transport: str | None = Transport.DIRECT.value

    # Per-source direct-adapter settings, also used by the fallback path.
    request_headers: dict[str, str] = {}
    rps: float | None = None

    # Index pages worth watching continuously with a Firecrawl monitor: the
    # registry list page, the sanctions list page, the brand landing page. These
    # are the handful of URLs whose restructuring silently invalidates hundreds
    # of per-record citations at once, so catching a change here is what buys
    # time before the citations rot.
    #
    # Declared on the source rather than in a separate list in the monitor
    # module, so a source cannot change its entry point and quietly stop being
    # monitored — the URL and the thing that watches it move together.
    monitor_urls: tuple[str, ...] = ()

    # Per-source credit ceiling. None defers to FIRECRAWL_MAX_CREDITS_PER_RUN.
    # A source may only tighten the global cap, never loosen it, so a stray
    # class attribute cannot become a licence to outspend the configured budget.
    max_credits_per_run: int | None = None

    # Whether `fetch()` is this source's data path. A few sources override
    # `run()` and write their own tables, leaving `fetch()` a stub; for those,
    # a transport comparison built on `fetch()` reads zero records from both
    # sides and reports a failure that means nothing.
    yields_records: bool = True

    @classmethod
    def monitor_targets(cls) -> tuple[str, ...]:
        """The URLs to register monitors for. Override when they are derived.

        The brand disclosure sources compute theirs from `landing_url`, which
        only exists on the concrete subclass.
        """
        return cls.monitor_urls

    def direct_verify(self) -> Any | None:
        """Override to supply a custom TLS context for the direct adapter.

        Only rsc-bd.org needs this (incomplete certificate chain). Firecrawl
        handles the same problem with skipTlsVerification, so this is required
        solely on the direct legs of that source.
        """
        return None

    def __init__(self, *args: Any, transport: str | None = None, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        self._requested_transport = transport or self.transport
        self._adapter: AcquisitionAdapter | None = None
        self._secondary: DirectAdapter | None = None
        self._active_transport: str | None = None
        self.acquisition_degraded = False
        # Counted here rather than in the evidence writer so the figure is right
        # even on paths that never write evidence — `compare-parity` consumes
        # `fetch()` directly and would otherwise report a spend of zero.
        self.credits_spent = 0

    # ------------------------------------------------------------------
    @property
    def credit_ceiling(self) -> int:
        """Effective cap for this run. 0 means unlimited."""
        configured = settings.firecrawl_max_credits_per_run
        own = self.max_credits_per_run
        if own is None:
            return configured
        if configured <= 0:
            return own
        return min(own, configured)

    def _check_budget(self, requests: Sequence[AcquireRequest]) -> None:
        """Refuse a fetch that would take the run past its ceiling.

        Checked before spending rather than after, using Firecrawl's documented
        pricing, because a credit is gone the moment the call is made. Only the
        Firecrawl transport bills, so the direct and local adapters are exempt
        rather than being charged a notional cost they never incur.
        """
        ceiling = self.credit_ceiling
        if ceiling <= 0 or self.active_transport != Transport.FIRECRAWL.value:
            return
        projected = sum(estimate_credits(r) for r in requests)
        if self.credits_spent + projected > ceiling:
            raise CreditBudgetExceeded(
                f"{self.code}: this run has spent {self.credits_spent} Firecrawl "
                f"credits and the next fetch needs about {projected} more, which "
                f"would pass the ceiling of {ceiling}. Raise "
                f"FIRECRAWL_MAX_CREDITS_PER_RUN (or the source's "
                f"max_credits_per_run) if this run is genuinely meant to cost "
                f"that much. Nothing was fetched."
            )

    # ------------------------------------------------------------------
    @property
    def active_transport(self) -> str:
        return self._active_transport or self._requested_transport

    def _build(self, transport: str) -> AcquisitionAdapter:
        if transport == Transport.FIRECRAWL.value:
            return FirecrawlAdapter()
        if transport == Transport.DIRECT.value:
            return self.direct_adapter()
        return LocalFileAdapter()

    def adapter(self) -> AcquisitionAdapter:
        """Return the adapter, resolving fallback on first use."""
        if self._adapter is not None:
            return self._adapter

        wanted = self._requested_transport
        if wanted == Transport.FIRECRAWL.value and not settings.firecrawl_api_key:
            if self.fallback_transport is None:
                raise RuntimeError(
                    f"{self.code}: FIRECRAWL_API_KEY is required for this source "
                    "(it needs Firecrawl proxying or browser actions; the direct "
                    "adapter would fetch an unusable page). Set the key in .env."
                )
            self.log.warning(
                "acquire.firecrawl_unconfigured",
                scraper=self.code,
                falling_back_to=self.fallback_transport,
            )
            self.acquisition_degraded = True
            wanted = self.fallback_transport

        self._active_transport = wanted
        self._adapter = self._build(wanted)
        self.log.info("acquire.transport", scraper=self.code, transport=wanted)
        return self._adapter

    def direct_adapter(self) -> DirectAdapter:
        """A second, always-direct adapter for non-HTML legs of a hybrid source.

        Several sources discover a link on an HTML page and then download an
        XLSX/PDF/CSV from it. Firecrawl is right for the discovery page and wrong
        for the payload — we want the exact bytes to feed openpyxl or pdfplumber,
        not a markdown rendering. Both legs still produce evidence rows.
        """
        if self._secondary is None:
            self._secondary = DirectAdapter(
                rps=self.rps,
                headers=dict(self.request_headers),
                verify=self.direct_verify(),
            )
        return self._secondary

    async def acquire_direct(self, request: AcquireRequest) -> AcquiredDoc:
        if self.request_headers and not request.headers:
            request.headers = dict(self.request_headers)
        return await self.direct_adapter().fetch(request)

    async def aclose(self) -> None:
        # When the transport is direct, `_adapter` IS `_secondary`; close once.
        if self._adapter is not None and self._adapter is not self._secondary:
            await self._adapter.aclose()
        self._adapter = None
        if self._secondary is not None:
            await self._secondary.aclose()
            self._secondary = None

    # ------------------------------------------------------------------
    async def acquire(self, request: AcquireRequest) -> AcquiredDoc:
        """Fetch one document. Fills in per-source headers for either transport."""
        if self.request_headers and not request.headers:
            request.headers = dict(self.request_headers)
        adapter = self.adapter()
        self._check_budget((request,))
        doc = await adapter.fetch(request)
        self.credits_spent += doc.credits_used
        return doc

    async def acquire_many(
        self, requests: Sequence[AcquireRequest]
    ) -> AsyncIterator[AcquiredDoc]:
        """Fetch many documents, batching where the adapter supports it."""
        for req in requests:
            if self.request_headers and not req.headers:
                req.headers = dict(self.request_headers)
        adapter = self.adapter()
        # Charged as one batch: the adapter may dispatch these concurrently, so
        # there is no point at which a per-item check could stop the overspend.
        self._check_budget(requests)
        async for doc in adapter.fetch_many(requests):
            self.credits_spent += doc.credits_used
            yield doc

    async def run(self) -> dict[str, Any]:
        try:
            result = await super().run()  # type: ignore[misc]
        finally:
            await self.aclose()
        result["transport"] = self.active_transport
        # `credits_used` counts only the documents we managed to cite; this is
        # everything the run actually paid for. A gap between the two is spend
        # that bought nothing citable, which is worth being able to see.
        result["credits_spent"] = self.credits_spent
        if self.credit_ceiling > 0:
            result["credit_ceiling"] = self.credit_ceiling
        if self.acquisition_degraded:
            result["degraded"] = 1
        return result


class AcquiringScraper(AcquisitionMixin, BaseScraper):
    """Supplier-producing scraper backed by the acquisition layer."""


class AcquiringSanctionScraper(AcquisitionMixin, BaseSanctionScraper):
    """Sanctions-list scraper backed by the acquisition layer."""
