"""Transport-neutral acquisition contracts.

Every source in the pipeline — Firecrawl-backed HTML, a JSON API, a CSV
download, or a file on disk — is fetched through one of the adapters in this
package and comes back as an `AcquiredDoc`. Parsers only ever see an
`AcquiredDoc`, so a source can change transport without its parser changing.
"""
from __future__ import annotations

import hashlib
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any
from urllib.parse import urlsplit


class Adapter(str, Enum):
    """Which transport produced a document. Persisted on evidence rows."""

    FIRECRAWL = "firecrawl"
    DIRECT = "direct"
    LOCAL = "local"


class FetchStatus(str, Enum):
    """Normalised outcome, uniform across adapters.

    `BLOCKED` and `TIMEOUT` are deliberately distinct from `ERROR`: they are
    transient and must never be allowed to mark a citation dead. See
    `etl/evidence/verifier.py`.
    """

    OK = "ok"
    NOT_FOUND = "not_found"
    BLOCKED = "blocked"
    TIMEOUT = "timeout"
    ERROR = "error"


# Firecrawl error codes that mean "the page is gone", vs. codes that mean
# "we failed to read it this time". Only the former may retire a citation.
_PERMANENT_FIRECRAWL_CODES = frozenset({"SCRAPE_DNS_RESOLUTION_ERROR"})
_TRANSIENT_FIRECRAWL_CODES = frozenset(
    {
        "SCRAPE_TIMEOUT",
        "SCRAPE_ALL_ENGINES_FAILED",
        "SCRAPE_SITE_ERROR",
        "SCRAPE_ACTION_ERROR",
        "SCRAPE_PDF_PREFETCH_FAILED",
        "SCRAPE_PDF_INSUFFICIENT_TIME_ERROR",
        "SCRAPE_PDF_ANTIBOT_ERROR",
        "UNKNOWN_ERROR",
    }
)


def classify_firecrawl_error(code: str | None, http_status: int | None) -> FetchStatus:
    """Map a Firecrawl error code / HTTP status onto a `FetchStatus`."""
    if code in _PERMANENT_FIRECRAWL_CODES:
        return FetchStatus.ERROR
    if code == "SCRAPE_TIMEOUT":
        return FetchStatus.TIMEOUT
    if code == "SCRAPE_PDF_ANTIBOT_ERROR":
        return FetchStatus.BLOCKED
    if code in _TRANSIENT_FIRECRAWL_CODES:
        return FetchStatus.ERROR
    if http_status == 404:
        return FetchStatus.NOT_FOUND
    if http_status in (401, 403, 429):
        return FetchStatus.BLOCKED
    if http_status == 408:
        return FetchStatus.TIMEOUT
    if http_status is not None and http_status >= 500:
        return FetchStatus.ERROR
    return FetchStatus.ERROR


@dataclass(slots=True)
class AcquireRequest:
    """One acquisition instruction.

    Firecrawl-specific knobs are explicit rather than defaulted so that cost
    and anti-bot behaviour are visible at each call site:

    * `only_main_content` MUST be False for registry tables — Firecrawl
      defaults it to True, which strips the surrounding table markup that
      registry list pages put their data in.
    * `proxy="auto"` silently escalates to enhanced proxies at 5 credits per
      page on retry. It is opt-in per source, never a default.
    * Passing `headers` forces `storeInCache=false` upstream, so header-bearing
      sources get no cache reuse. That is accepted for registries, where we
      need the Referer to be served the page at all.
    """

    url: str
    # --- transport-neutral -------------------------------------------------
    method: str = "GET"
    headers: dict[str, str] = field(default_factory=dict)
    params: dict[str, Any] | None = None
    json_body: Any | None = None
    content: bytes | str | None = None
    rps: float | None = None
    want_bytes: bool = False

    # --- Firecrawl-specific ------------------------------------------------
    formats: tuple[str, ...] = ("markdown", "rawHtml")
    only_main_content: bool = False
    include_screenshot: bool = False
    proxy: str = "basic"
    timeout_ms: int | None = None
    actions: tuple[dict[str, Any], ...] = ()
    parse_pdf: bool = True
    pdf_max_pages: int | None = None
    max_age_ms: int | None = None
    wait_for_ms: int | None = None
    include_tags: tuple[str, ...] = ()
    exclude_tags: tuple[str, ...] = ()

    # --- bookkeeping -------------------------------------------------------
    label: str | None = None
    meta: dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class AcquiredDoc:
    """The result of one acquisition, whatever the transport."""

    url: str
    adapter: Adapter
    fetch_status: FetchStatus
    final_url: str | None = None
    http_status: int | None = None
    error_code: str | None = None
    error_message: str | None = None

    markdown: str | None = None
    raw_html: str | None = None
    body_bytes: bytes | None = None
    content_type: str | None = None
    title: str | None = None
    links: tuple[str, ...] = ()
    screenshot_url: str | None = None
    # Values returned by `executeJavascript` actions, in the order requested.
    js_returns: tuple[Any, ...] = ()

    credits_used: int = 0
    fetched_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    meta: dict[str, Any] = field(default_factory=dict)

    @property
    def ok(self) -> bool:
        return self.fetch_status is FetchStatus.OK

    @property
    def transient_failure(self) -> bool:
        """True when the failure says nothing about whether the page exists."""
        return self.fetch_status in (FetchStatus.TIMEOUT, FetchStatus.BLOCKED, FetchStatus.ERROR)

    @property
    def citable_url(self) -> str:
        """The URL a human should be sent to in order to see this data."""
        return self.final_url or self.url

    @property
    def landed_on_site_root(self) -> bool:
        """Whether a request for a specific page was answered with the homepage.

        This is the soft 404: rather than returning 404 for a page they have
        retired, sites redirect to their homepage and answer 200. Nothing in the
        response says anything is wrong, so a scraper parses the homepage, finds
        none of what it wanted, and reports an empty result as though the
        publisher had simply stopped listing anything.

        It matters most for provenance. Every claim is stored with a URL that is
        supposed to show a human the cited fact, and a citation pointing at a
        homepage cannot do that. Detecting it needs the request and the response
        compared, which only this object can do.
        """
        if not self.final_url:
            return False
        requested = urlsplit(self.url)
        landed = urlsplit(self.final_url)
        # A request that was already for the root cannot have been diverted to it.
        requested_path = requested.path.strip("/")
        if not requested_path:
            return False
        landed_path = landed.path.strip("/")
        # Locale-prefixed homepages ("us/en/home", "en-gb/") are still homepages,
        # so the tail of the path decides rather than it being strictly empty.
        return landed_path in ("", "home", "index", "index.html") or (
            landed_path.rsplit("/", 1)[-1] in ("home", "index", "index.html")
        )

    def text(self) -> str:
        """Best available textual representation for parsing."""
        if self.raw_html:
            return self.raw_html
        if self.markdown:
            return self.markdown
        if self.body_bytes is not None:
            return self.body_bytes.decode("utf-8", errors="replace")
        return ""

    @property
    def content_sha256(self) -> str:
        """Stable hash of the acquired payload.

        Prefers raw bytes, then raw HTML, then markdown, so the same document
        hashes identically across re-fetches with the same format request.
        """
        if self.body_bytes is not None:
            payload = self.body_bytes
        elif self.raw_html is not None:
            payload = self.raw_html.encode("utf-8", errors="replace")
        elif self.markdown is not None:
            payload = self.markdown.encode("utf-8", errors="replace")
        else:
            payload = b""
        return hashlib.sha256(payload).hexdigest()

    @property
    def content_bytes_len(self) -> int:
        if self.body_bytes is not None:
            return len(self.body_bytes)
        if self.raw_html is not None:
            return len(self.raw_html.encode("utf-8", errors="replace"))
        if self.markdown is not None:
            return len(self.markdown.encode("utf-8", errors="replace"))
        return 0
