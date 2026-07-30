"""Monitor registration and webhook-inbox behaviour.

Two properties matter here, and neither is visible from a green run:

* every source that has an index page is actually covered by a monitor. A source
  whose entry point stopped being watched still scrapes fine — it just loses its
  early warning, silently, until a restructure has already rotted its citations.
* a change notification requeues work rather than concluding anything. A webhook
  says "the page moved", not "the fact is wrong", and a cosmetic redeploy of a
  registry must not orphan thousands of claims.
"""
from __future__ import annotations

import asyncio
import json
from typing import Any

import pytest

from etl.evidence import monitors as mmod
from etl.evidence import webhook_inbox as wmod


# ------------------------------------------------------------------ targets ---
def test_every_html_source_declares_a_monitor_target():
    """A page-backed source without an index page to watch is a coverage hole.

    Detail-page sources are the deliberate exception: they are per-supplier and
    far too numerous to monitor, and the list page they hang off is watched by
    its own source.
    """
    from etl.scrapers.registry import SCRAPERS

    exempt = {
        # Enumerates supplier detail pages; bkmea_web watches the list page.
        "bkmea_detail",
        # Mirrors binaries from URLs already stored in the database, so there is
        # no index page of its own to watch.
        "rsc_documents",
    }
    uncovered = [
        code
        for code, cls in SCRAPERS.items()
        if cls.transport == "firecrawl"
        and code not in exempt
        and not cls.monitor_targets()
    ]
    assert uncovered == []


def test_brand_ms_is_monitored_even_though_it_is_not_a_firecrawl_source():
    """The one source that must keep a browser still benefits from the warning.

    `brand_ms` reads a per-contributor embed token out of live iframe traffic, so
    Firecrawl cannot acquire it — but the page that hosts the iframe has a stable
    public URL, and that page changing is the earliest signal the embed moved.
    Skipping it because of its transport would leave the most fragile source the
    least watched.
    """
    from etl.scrapers.registry import SCRAPERS

    assert SCRAPERS["brand_ms"].transport == "direct"
    assert SCRAPERS["brand_ms"].monitor_targets()


def test_the_planned_set_covers_every_source_family():
    """A missing family means a whole class of citations loses early warning."""
    codes = {t["scraper_code"] for t in mmod.planned_targets()}
    for expected in (
        "bgmea_web",       # registry list pages
        "rsc_reports",     # RSC index
        "oeko_tex",        # certification directory
        "uflpa",           # sanctions list page
        "brand_hm",        # brand landing page
    ):
        assert expected in codes, expected


def test_planned_targets_are_absolute_urls_and_unique():
    targets = mmod.planned_targets()
    assert targets, "no monitor targets planned at all"
    for target in targets:
        assert target["target_url"].startswith("https://"), target
        assert target["name"] == f"sourcebd:{target['scraper_code']}"
    keys = [(t["scraper_code"], t["target_url"]) for t in targets]
    assert len(keys) == len(set(keys))


def test_brand_targets_are_derived_from_the_landing_page():
    """Derived, not repeated: the two cannot drift apart."""
    from etl.scrapers.brand_disclosures import BrandHmScraper

    assert BrandHmScraper.monitor_targets() == (BrandHmScraper.landing_url,)


def test_the_watched_pages_are_the_ones_the_sources_actually_read():
    """A monitor on a URL no source reads would watch nothing that we cite."""
    from etl.scrapers.bgmea_web import LIST_URL as BGMEA_LIST
    from etl.scrapers.registry import SCRAPERS
    from etl.scrapers.uflpa import URL as UFLPA_URL

    assert BGMEA_LIST in SCRAPERS["bgmea_web"].monitor_targets()
    assert UFLPA_URL in SCRAPERS["uflpa"].monitor_targets()


# ------------------------------------------------------------------- specs ----
def test_monitor_spec_disables_main_content_stripping():
    """Firecrawl defaults `onlyMainContent` to true.

    Left at the default, a registry monitor would compare a stripped page against
    a stripped page — the member table sits outside the main content block, so the
    one change we care about would never be detected.
    """
    spec = mmod._monitor_spec(
        {
            "name": "sourcebd:bgmea_web",
            "scraper_code": "bgmea_web",
            "target_url": "https://www.bgmea.com.bd/page/member-list",
        },
        "https://sourcebd.com/api/v1/webhooks/firecrawl",
    )
    assert spec["scrapeOptions"]["onlyMainContent"] is False
    assert spec["urls"] == ["https://www.bgmea.com.bd/page/member-list"]
    assert spec["schedule"] == mmod.DEFAULT_SCHEDULE
    # The secret travels in a header, not the URL, so it stays out of request logs.
    assert "X-SourceBD-Webhook-Secret" in spec["webhook"]["headers"]
    assert "secret" not in spec["webhook"]["url"]


def test_webhook_url_is_built_from_the_configured_base(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(
        mmod.settings, "firecrawl_webhook_base_url", "https://sourcebd.com/", raising=False
    )
    assert mmod.webhook_url() == "https://sourcebd.com/api/v1/webhooks/firecrawl"
    monkeypatch.setattr(
        mmod.settings, "firecrawl_webhook_base_url", "", raising=False
    )
    assert mmod.webhook_url() is None


@pytest.mark.parametrize(
    "missing", ["firecrawl_api_key", "firecrawl_webhook_base_url", "firecrawl_webhook_secret"]
)
def test_refresh_refuses_to_register_a_monitor_that_reports_to_nobody(
    monkeypatch: pytest.MonkeyPatch, missing: str
):
    """A monitor with no reachable authenticated webhook is worse than none.

    It looks healthy in the Firecrawl console while detecting changes that reach
    us never, so this is an error rather than a partial success.
    """
    monkeypatch.setattr(mmod.settings, "firecrawl_api_key", "fc-test", raising=False)
    monkeypatch.setattr(
        mmod.settings, "firecrawl_webhook_base_url", "https://sourcebd.com", raising=False
    )
    monkeypatch.setattr(
        mmod.settings, "firecrawl_webhook_secret", "s3cret", raising=False
    )
    monkeypatch.setattr(mmod.settings, missing, "", raising=False)

    result = asyncio.run(mmod.refresh_monitors())
    assert result["error"]
    assert result["created"] == 0


def test_monitor_id_is_read_from_either_envelope_shape():
    assert mmod._extract_monitor_id({"id": "mon_1"}) == "mon_1"
    assert mmod._extract_monitor_id({"data": {"monitorId": "mon_2"}}) == "mon_2"
    assert mmod._extract_monitor_id({"success": True}) is None


def test_refresh_is_idempotent_and_does_not_re_register(monkeypatch: pytest.MonkeyPatch):
    """Running this on every deploy must not accumulate duplicate monitors.

    Duplicates would each webhook the same change, multiplying the requeue work
    and the credit spend for no extra signal.
    """
    monkeypatch.setattr(mmod.settings, "firecrawl_api_key", "fc-test", raising=False)
    monkeypatch.setattr(
        mmod.settings, "firecrawl_webhook_base_url", "https://sourcebd.com", raising=False
    )
    monkeypatch.setattr(mmod.settings, "firecrawl_webhook_secret", "s3cret", raising=False)

    planned = [
        {"scraper_code": "bgmea_web", "target_url": "https://a/1", "name": "sourcebd:bgmea_web"},
        {"scraper_code": "uflpa", "target_url": "https://b/2", "name": "sourcebd:uflpa"},
    ]
    monkeypatch.setattr(mmod, "planned_targets", lambda: planned)
    # bgmea already registered; only uflpa should be created.
    monkeypatch.setattr(
        mmod, "_existing_ids", lambda: {("bgmea_web", "https://a/1"): "mon_existing"}
    )
    written: list[tuple[str, str | None]] = []
    monkeypatch.setattr(
        mmod,
        "_upsert_local",
        lambda target, monitor_id, meta: written.append((target["scraper_code"], monitor_id)),
    )

    created: list[dict[str, Any]] = []

    class FakeAdapter:
        async def create_monitor(self, spec):
            created.append(spec)
            return {"id": "mon_new"}

        async def aclose(self):
            pass

    monkeypatch.setattr(mmod, "FirecrawlAdapter", lambda: FakeAdapter())

    result = asyncio.run(mmod.refresh_monitors())
    assert result == {
        "planned": 2,
        "created": 1,
        "existing": 1,
        "skipped": 0,
        "failed": 0,
    }
    assert [s["urls"] for s in created] == [["https://b/2"]]
    assert written == [("uflpa", "mon_new")]


def test_a_failed_registration_does_not_abort_the_rest(monkeypatch: pytest.MonkeyPatch):
    """One unregisterable target must not leave the other 19 unmonitored."""
    monkeypatch.setattr(mmod.settings, "firecrawl_api_key", "fc-test", raising=False)
    monkeypatch.setattr(
        mmod.settings, "firecrawl_webhook_base_url", "https://sourcebd.com", raising=False
    )
    monkeypatch.setattr(mmod.settings, "firecrawl_webhook_secret", "s3cret", raising=False)
    monkeypatch.setattr(
        mmod,
        "planned_targets",
        lambda: [
            {"scraper_code": "a", "target_url": "https://a/1", "name": "n:a"},
            {"scraper_code": "b", "target_url": "https://b/2", "name": "n:b"},
        ],
    )
    monkeypatch.setattr(mmod, "_existing_ids", lambda: {})
    monkeypatch.setattr(mmod, "_upsert_local", lambda *a, **k: None)

    class FlakyAdapter:
        def __init__(self) -> None:
            self.calls = 0

        async def create_monitor(self, spec):
            self.calls += 1
            if self.calls == 1:
                raise RuntimeError("firecrawl monitor create failed: HTTP 500")
            return {"id": "mon_ok"}

        async def aclose(self):
            pass

    monkeypatch.setattr(mmod, "FirecrawlAdapter", lambda: FlakyAdapter())
    result = asyncio.run(mmod.refresh_monitors())
    assert result["failed"] == 1
    assert result["created"] == 1


def test_refresh_monitors_job_reports_an_unconfigured_run_as_failed(
    monkeypatch: pytest.MonkeyPatch,
):
    """A green tick would read as "monitoring is on" when nothing is watching."""
    opened: list[str] = []
    closed: list[tuple[str, str, int, int, str | None]] = []

    async def fake_refresh(dry_run: bool = False):
        return {"planned": 5, "created": 0, "error": "FIRECRAWL_API_KEY not set"}

    monkeypatch.setattr(mmod, "refresh_monitors", fake_refresh)
    job = mmod.RefreshMonitorsJob()
    monkeypatch.setattr(job, "_open_run", lambda: (opened.append("r1") or "r1"))
    monkeypatch.setattr(
        job,
        "_close_run",
        lambda run_id, status, seen, created, error: closed.append(
            (run_id, status, seen, created, error)
        ),
    )
    out = asyncio.run(job.run())
    assert closed[0][1] == "failed"
    assert out["seen"] == 5


# ----------------------------------------------------------- webhook inbox ----
class _FakeCursor:
    def __init__(self, store: dict[str, Any]) -> None:
        self.store = store
        self.rowcount = 0
        self._rows: list[dict[str, Any]] = []

    def execute(self, sql: str, params: Any = None) -> None:
        self.store.setdefault("sql", []).append((" ".join(sql.split()), params))
        planned = self.store.get("returns", {})
        for needle, rows in planned.items():
            if needle in sql:
                self._rows = list(rows)
                self.rowcount = len(rows)
                return
        self._rows = []
        self.rowcount = self.store.get("rowcount", 0)

    def fetchall(self):
        return self._rows

    def fetchone(self):
        return self._rows[0] if self._rows else None

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


class _FakeConn:
    def __init__(self, store: dict[str, Any]) -> None:
        self.store = store

    def cursor(self):
        return _FakeCursor(self.store)

    def commit(self):
        pass

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


class _FakeDb:
    def __init__(self, store: dict[str, Any]) -> None:
        self.store = store

    def conn(self):
        return _FakeConn(self.store)


def _with_fake_db(monkeypatch: pytest.MonkeyPatch, store: dict[str, Any]) -> None:
    monkeypatch.setattr(wmod, "db", _FakeDb(store))


def test_a_change_event_requeues_instead_of_concluding(monkeypatch: pytest.MonkeyPatch):
    """The webhook says "look again", never "this fact is wrong".

    Marking claims stale straight from a notification would let a cosmetic
    redeploy of a registry orphan thousands of facts that are still perfectly
    well supported.
    """
    store: dict[str, Any] = {
        "returns": {
            "from public.firecrawl_webhook_events": [
                {
                    "id": "e1",
                    "event_type": "monitor.page.changed",
                    "monitor_id": "mon_1",
                    "page_url": "https://www.bgmea.com.bd/page/member-list",
                    "payload": {},
                    "attempts": 0,
                }
            ],
            "select scraper_code from public.evidence_monitors": [
                {"scraper_code": "bgmea_web"}
            ],
        },
        "rowcount": 4288,
    }
    _with_fake_db(monkeypatch, store)

    result = wmod.process_pending()
    assert result["processed"] == 1
    assert result["requeued_documents"] == 4288

    statements = " || ".join(sql for sql, _ in store["sql"])
    # Only the schedule is touched; no claim status is written from here.
    assert "last_verified_at = null" in statements
    assert "transient_failures = 0" in statements
    assert "evidence_claims" not in statements
    assert "verify_status" not in statements


def test_a_change_sweeps_the_whole_source_not_just_the_index_page(
    monkeypatch: pytest.MonkeyPatch,
):
    """When a list page restructures, its detail pages usually moved too.

    Those detail pages are where the per-supplier citations live, so re-checking
    only the index page would confirm the one document nobody cites.
    """
    store: dict[str, Any] = {
        "returns": {
            "from public.firecrawl_webhook_events": [
                {
                    "id": "e1",
                    "event_type": "monitor.page.changed",
                    "monitor_id": "mon_1",
                    "page_url": "https://x/list",
                    "payload": {},
                    "attempts": 0,
                }
            ],
            "select scraper_code from public.evidence_monitors": [
                {"scraper_code": "bgmea_web"}
            ],
        }
    }
    _with_fake_db(monkeypatch, store)
    wmod.process_pending()

    requeue = [
        (sql, params)
        for sql, params in store["sql"]
        if "update public.evidence_documents" in sql
    ]
    assert requeue, "documents were never requeued"
    sql, params = requeue[0]
    assert "scraper_code = %(scraper_code)s" in sql
    assert params["scraper_code"] == "bgmea_web"
    assert params["url"] == "https://x/list"


def test_an_unchanged_check_is_recorded_and_ignored(monkeypatch: pytest.MonkeyPatch):
    """Most monitor deliveries say "checked, nothing moved"."""
    store: dict[str, Any] = {
        "returns": {
            "from public.firecrawl_webhook_events": [
                {
                    "id": "e1",
                    "event_type": "monitor.check.completed",
                    "monitor_id": "mon_1",
                    "page_url": "https://x/list",
                    "payload": {},
                    "attempts": 0,
                }
            ]
        }
    }
    _with_fake_db(monkeypatch, store)
    result = wmod.process_pending()
    assert result == {
        "seen": 1,
        "requeued_documents": 0,
        "processed": 0,
        "ignored": 1,
        "failed": 0,
    }
    statements = " || ".join(sql for sql, _ in store["sql"])
    # The monitor's heartbeat is still recorded, so "this monitor has not checked
    # in for a week" stays answerable.
    assert "update public.evidence_monitors" in statements
    assert "update public.evidence_documents" not in statements


def test_a_change_event_without_a_url_cannot_requeue_anything(
    monkeypatch: pytest.MonkeyPatch,
):
    """Guessing which documents were meant would requeue the wrong ones."""
    store: dict[str, Any] = {
        "returns": {
            "from public.firecrawl_webhook_events": [
                {
                    "id": "e1",
                    "event_type": "monitor.page.changed",
                    "monitor_id": "mon_1",
                    "page_url": None,
                    "payload": {},
                    "attempts": 0,
                }
            ]
        }
    }
    _with_fake_db(monkeypatch, store)
    result = wmod.process_pending()
    assert result["ignored"] == 1
    assert result["processed"] == 0


def test_one_bad_delivery_does_not_stop_the_queue(monkeypatch: pytest.MonkeyPatch):
    events = [
        {
            "id": "bad",
            "event_type": "monitor.page.changed",
            "monitor_id": "m1",
            "page_url": "https://x/1",
            "payload": {},
            "attempts": 0,
        },
        {
            "id": "good",
            "event_type": "monitor.check.completed",
            "monitor_id": "m2",
            "page_url": "https://x/2",
            "payload": {},
            "attempts": 0,
        },
    ]
    monkeypatch.setattr(wmod, "_pending", lambda limit: events)
    monkeypatch.setattr(wmod, "_touch_monitor", lambda *a: None)
    monkeypatch.setattr(wmod, "_monitor_scraper_code", lambda *a: "bgmea_web")
    finished: list[tuple[str, str]] = []
    monkeypatch.setattr(
        wmod, "_finish", lambda eid, status, error=None: finished.append((eid, status))
    )

    def boom(url, code):
        raise RuntimeError("deadlock detected")

    monkeypatch.setattr(wmod, "_requeue_documents", boom)

    result = wmod.process_pending()
    assert result["failed"] == 1
    assert result["ignored"] == 1
    # The failure is recorded against that delivery so it can be retried, rather
    # than left pending forever and re-read on every pass.
    assert ("bad", "failed") in finished


def test_deliveries_are_claimed_with_skip_locked(monkeypatch: pytest.MonkeyPatch):
    """Two workers draining the inbox must not both act on one delivery."""
    store: dict[str, Any] = {}
    _with_fake_db(monkeypatch, store)
    wmod._pending(10)
    sql, _params = store["sql"][0]
    assert "for update skip locked" in sql
    assert "process_status = 'pending'" in sql
    assert "order by received_at asc" in sql


def test_record_delivery_is_idempotent_on_the_dedupe_key(
    monkeypatch: pytest.MonkeyPatch,
):
    """Firecrawl retries, so a re-delivery must be a no-op rather than a re-apply."""
    store: dict[str, Any] = {"returns": {}}
    _with_fake_db(monkeypatch, store)
    assert wmod.record_delivery("fc:1", "monitor.page.changed", "m1", "https://x", {}) is False
    sql, params = store["sql"][0]
    assert "on conflict (dedupe_key) do nothing" in sql
    assert params[0] == "fc:1"
    assert json.loads(params[4]) == {}


def test_change_event_names_cover_the_shapes_firecrawl_sends():
    """Pins the vocabulary the requeue decision turns on.

    A name missing from this set would be silently classed as "nothing moved",
    which is the failure mode that leaves stale citations looking verified.
    """
    for name in ("monitor.page.changed", "monitor.page.added", "monitor.page.removed"):
        assert name in wmod.CHANGE_EVENTS
    assert "monitor.check.completed" not in wmod.CHANGE_EVENTS
