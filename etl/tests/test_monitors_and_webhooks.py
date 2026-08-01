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
def test_monitor_spec_matches_the_real_v2_monitor_contract():
    """Pins the shape Firecrawl actually accepts, so it cannot drift again.

    The pre-REZ-34 spec sent `{urls, schedule: "daily"}` and no event
    subscription; Firecrawl rejected it with a 400, which the adapter then
    recorded as a success — six phantom monitors with NULL ids in production.
    The contract is `targets` (typed entries), `schedule.text`, and an explicit
    `webhook.events` subscription.
    """
    spec = mmod._monitor_spec(
        {
            "name": "sourcebd:bgmea_web",
            "scraper_code": "bgmea_web",
            "target_url": "https://www.bgmea.com.bd/page/member-list",
        },
        "https://sourcebd.com/api/v1/webhooks/firecrawl",
    )
    assert spec["name"] == "sourcebd:bgmea_web"
    assert "urls" not in spec
    assert len(spec["targets"]) == 1
    target = spec["targets"][0]
    assert target["type"] == "scrape"
    assert target["urls"] == ["https://www.bgmea.com.bd/page/member-list"]
    assert target["scrapeOptions"]["formats"] == ["markdown"]
    # Firecrawl defaults `onlyMainContent` to true. Left at the default, a
    # registry monitor would compare a stripped page against a stripped page —
    # the member table sits outside the main content block, so the one change
    # we care about would never be detected.
    assert target["scrapeOptions"]["onlyMainContent"] is False
    assert spec["schedule"] == {"text": mmod.DEFAULT_SCHEDULE}
    # Without an explicit event subscription the monitor checks and tells nobody.
    assert spec["webhook"]["events"] == ["monitor.page"]
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


# ------------------------------------------------------- create_monitor ----
def _adapter_with_response(payload: dict[str, Any], status: int | None, err: str | None):
    from etl.acquire.firecrawl import FirecrawlAdapter

    adapter = FirecrawlAdapter(api_key="fc-test", api_base="https://example.invalid")

    async def fake_post(path: str, body: dict[str, Any]):
        return payload, status, err

    adapter._post_with_retry = fake_post  # type: ignore[method-assign]
    return adapter


def test_create_monitor_raises_on_a_json_error_body():
    """R2 regression: a 4xx with a JSON body is a failure, not a registration.

    `_request_with_retry` surfaces it as (payload, status, None) — no error —
    so without this guard the error body flowed to `_extract_monitor_id`,
    produced None, and was written as a local row with a NULL monitor id.
    """
    adapter = _adapter_with_response(
        {"success": False, "error": "Invalid monitor spec"}, 400, None
    )
    with pytest.raises(RuntimeError, match="HTTP 400"):
        asyncio.run(adapter.create_monitor({"name": "n"}))
    asyncio.run(adapter.aclose())


def test_create_monitor_raises_on_success_false_even_with_a_200():
    adapter = _adapter_with_response({"success": False, "error": "bad spec"}, 200, None)
    with pytest.raises(RuntimeError, match="bad spec"):
        asyncio.run(adapter.create_monitor({"name": "n"}))
    asyncio.run(adapter.aclose())


def test_create_monitor_returns_the_payload_only_on_a_real_acceptance():
    adapter = _adapter_with_response({"success": True, "id": "mon_1"}, 200, None)
    assert asyncio.run(adapter.create_monitor({"name": "n"})) == {
        "success": True,
        "id": "mon_1",
    }
    asyncio.run(adapter.aclose())


def test_a_failed_registration_writes_no_local_row(monkeypatch: pytest.MonkeyPatch):
    """The whole point of raising: a phantom must never reach `evidence_monitors`."""
    monkeypatch.setattr(mmod.settings, "firecrawl_api_key", "fc-test", raising=False)
    monkeypatch.setattr(
        mmod.settings, "firecrawl_webhook_base_url", "https://sourcebd.com", raising=False
    )
    monkeypatch.setattr(mmod.settings, "firecrawl_webhook_secret", "s3cret", raising=False)
    monkeypatch.setattr(
        mmod,
        "planned_targets",
        lambda: [{"scraper_code": "a", "target_url": "https://a/1", "name": "n:a"}],
    )
    monkeypatch.setattr(mmod, "_existing_ids", lambda: {})
    upserts: list[Any] = []
    monkeypatch.setattr(mmod, "_upsert_local", lambda *a, **k: upserts.append(a))

    class RejectingAdapter:
        async def create_monitor(self, spec):
            raise RuntimeError("firecrawl monitor create failed: HTTP 400: bad spec")

        async def aclose(self):
            pass

    monkeypatch.setattr(mmod, "FirecrawlAdapter", lambda: RejectingAdapter())
    result = asyncio.run(mmod.refresh_monitors())
    assert result["failed"] == 1
    assert result["created"] == 0
    assert upserts == []


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
    assert [s["targets"][0]["urls"] for s in created] == [["https://b/2"]]
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

    async def fake_refresh(dry_run: bool = False, progress_callback: Any | None = None):
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
        normalised = " ".join(sql.split())
        self.store.setdefault("sql", []).append((normalised, params))
        self.store.setdefault("events", []).append(("sql", normalised))
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
        self.store["commits"] = self.store.get("commits", 0) + 1
        self.store.setdefault("events", []).append(("commit",))

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


class _FakeDb:
    def __init__(self, store: dict[str, Any]) -> None:
        self.store = store

    def conn(self):
        self.store["connections"] = self.store.get("connections", 0) + 1
        return _FakeConn(self.store)


def _with_fake_db(monkeypatch: pytest.MonkeyPatch, store: dict[str, Any]) -> None:
    monkeypatch.setattr(wmod, "db", _FakeDb(store))


def _event(
    status: str,
    *,
    page_url: str | None = "https://www.bgmea.com.bd/page/member-list",
    monitor_id: str = "mon_1",
    event_type: str = "monitor.page",
    entries: list[dict[str, Any]] | None = None,
    event_id: str = "e1",
) -> dict[str, Any]:
    """A `firecrawl_webhook_events` row as the route writes it.

    The columns come from one page entry of the real envelope
    `{success, type: "monitor.page", id, data: [{monitorId, url, status}]}`,
    and the full envelope is stored in `payload`.
    """
    if entries is None:
        entry: dict[str, Any] = {"monitorId": monitor_id, "status": status}
        if page_url is not None:
            entry["url"] = page_url
        entries = [entry]
    return {
        "id": event_id,
        "event_type": event_type,
        "monitor_id": monitor_id,
        "page_url": page_url,
        "payload": {"success": True, "type": event_type, "id": "evt_1", "data": entries},
        "attempts": 0,
    }


@pytest.mark.parametrize("status", ["changed", "new", "removed"])
def test_a_page_that_moved_requeues_instead_of_concluding(
    monkeypatch: pytest.MonkeyPatch, status: str
):
    """The webhook says "look again", never "this fact is wrong".

    Marking claims stale straight from a notification would let a cosmetic
    redeploy of a registry orphan thousands of facts that are still perfectly
    well supported. All three per-page statuses that mean "the content moved"
    take this path.
    """
    store: dict[str, Any] = {
        "returns": {
            "from public.firecrawl_webhook_events": [_event(status)],
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
            "from public.firecrawl_webhook_events": [_event("changed", page_url="https://x/list")],
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


def test_an_unchanged_page_is_recorded_and_ignored(monkeypatch: pytest.MonkeyPatch):
    """Most monitor deliveries say "checked, nothing moved" (status `same`)."""
    store: dict[str, Any] = {
        "returns": {
            "from public.firecrawl_webhook_events": [_event("same", page_url="https://x/list")]
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
    touch = [
        (sql, params)
        for sql, params in store["sql"]
        if "update public.evidence_monitors" in sql
    ]
    # The monitor's heartbeat is still recorded, so "this monitor has not checked
    # in for a week" stays answerable.
    assert touch, "monitor heartbeat was not recorded"
    assert touch[0][1][0] == "same"
    statements = " || ".join(sql for sql, _ in store["sql"])
    assert "update public.evidence_documents" not in statements


def test_an_error_check_increments_consecutive_errors(monkeypatch: pytest.MonkeyPatch):
    """A monitor that fails every check must surface as erroring, not quiet.

    `consecutive_errors` was only ever reset before REZ-34, so the health
    strip's erroring count could never move off zero.
    """
    store: dict[str, Any] = {
        "returns": {
            "from public.firecrawl_webhook_events": [_event("error", page_url="https://x/list")]
        }
    }
    _with_fake_db(monkeypatch, store)
    result = wmod.process_pending()
    assert result["ignored"] == 1
    assert result["processed"] == 0

    touch = [
        (sql, params)
        for sql, params in store["sql"]
        if "update public.evidence_monitors" in sql
    ]
    assert touch, "monitor heartbeat was not recorded"
    sql, params = touch[0]
    assert "consecutive_errors + 1" in sql
    assert params == ("error", False, True, "mon_1")


def test_a_completed_check_with_no_page_status_is_a_heartbeat(
    monkeypatch: pytest.MonkeyPatch,
):
    """`monitor.check.completed` carries no per-page status: touch and ignore."""
    event = _event("", event_type="monitor.check.completed", page_url="https://x/list")
    event["payload"] = {"success": True, "type": "monitor.check.completed", "id": "evt_9"}
    store: dict[str, Any] = {
        "returns": {"from public.firecrawl_webhook_events": [event]}
    }
    _with_fake_db(monkeypatch, store)
    result = wmod.process_pending()
    assert result["ignored"] == 1
    statements = " || ".join(sql for sql, _ in store["sql"])
    assert "update public.evidence_monitors" in statements
    assert "update public.evidence_documents" not in statements


def test_the_entry_is_matched_by_page_url_not_by_position(
    monkeypatch: pytest.MonkeyPatch,
):
    """One delivery can carry many page entries; each row classifies on its own.

    Classifying every row on `data[0]` would requeue a page that reported
    `same` because a *neighbouring* page changed, and miss one that changed
    because the first entry did not.
    """
    entries = [
        {"monitorId": "mon_1", "url": "https://x/a", "status": "same"},
        {"monitorId": "mon_1", "url": "https://x/b", "status": "changed"},
    ]
    store: dict[str, Any] = {
        "returns": {
            "from public.firecrawl_webhook_events": [
                _event("same", page_url="https://x/a", entries=entries, event_id="row-a"),
                _event("changed", page_url="https://x/b", entries=entries, event_id="row-b"),
            ],
            "select scraper_code from public.evidence_monitors": [
                {"scraper_code": "bgmea_web"}
            ],
        }
    }
    _with_fake_db(monkeypatch, store)
    result = wmod.process_pending()
    assert result["ignored"] == 1
    assert result["processed"] == 1

    requeue = [
        (sql, params)
        for sql, params in store["sql"]
        if "update public.evidence_documents" in sql
    ]
    assert len(requeue) == 1
    assert requeue[0][1]["url"] == "https://x/b"


def test_a_change_event_without_a_url_cannot_requeue_anything(
    monkeypatch: pytest.MonkeyPatch,
):
    """Guessing which documents were meant would requeue the wrong ones."""
    store: dict[str, Any] = {
        "returns": {"from public.firecrawl_webhook_events": [_event("changed", page_url=None)]}
    }
    _with_fake_db(monkeypatch, store)
    result = wmod.process_pending()
    assert result["ignored"] == 1
    assert result["processed"] == 0


def test_one_bad_delivery_does_not_stop_the_queue(monkeypatch: pytest.MonkeyPatch):
    store: dict[str, Any] = {
        "returns": {
            "from public.firecrawl_webhook_events": [
                _event("changed", page_url="https://x/1", monitor_id="m1", event_id="bad"),
                _event("same", page_url="https://x/2", monitor_id="m2", event_id="good"),
            ],
            "select scraper_code from public.evidence_monitors": [
                {"scraper_code": "bgmea_web"}
            ],
        }
    }
    _with_fake_db(monkeypatch, store)

    def boom(cur, url, code):
        raise RuntimeError("deadlock detected")

    monkeypatch.setattr(wmod, "_requeue_documents", boom)

    result = wmod.process_pending()
    assert result["failed"] == 1
    assert result["ignored"] == 1
    # The failure is recorded against that delivery so it can be retried, rather
    # than left pending forever and re-read on every pass.
    finishes = [
        params
        for sql, params in store["sql"]
        if "update public.firecrawl_webhook_events" in sql
    ]
    assert ("failed", "deadlock detected", "bad") in finishes
    assert ("ignored", None, "good") in finishes


def test_deliveries_are_claimed_with_skip_locked(monkeypatch: pytest.MonkeyPatch):
    """Two workers draining the inbox must not both act on one delivery."""
    store: dict[str, Any] = {}
    _with_fake_db(monkeypatch, store)
    wmod.process_pending(limit=10)
    sql, _params = store["sql"][0]
    assert "for update skip locked" in sql
    assert "process_status = 'pending'" in sql
    assert "order by received_at asc" in sql


def test_the_claiming_transaction_is_held_for_the_whole_drain(
    monkeypatch: pytest.MonkeyPatch,
):
    """REZ-42: a second worker must see these rows as locked until we commit.

    The old shape claimed in one connection, released the locks, then processed
    in follow-up connections — so a minutely cron overlapping a manual drain
    could both act on the same delivery. The pin: one connection, the claim
    first, every write inside, exactly one commit, and the commit last.
    """
    store: dict[str, Any] = {
        "returns": {
            "from public.firecrawl_webhook_events": [_event("changed")],
            "select scraper_code from public.evidence_monitors": [
                {"scraper_code": "bgmea_web"}
            ],
        },
        "rowcount": 5,
    }
    _with_fake_db(monkeypatch, store)
    result = wmod.process_pending()
    assert result["processed"] == 1

    assert store["connections"] == 1
    assert store["commits"] == 1
    events = store["events"]
    assert events[-1] == ("commit",), "writes happened after the commit"
    kind, first_sql = events[0]
    assert kind == "sql"
    assert "for update skip locked" in first_sql
    assert any(
        kind == "sql" and "update public.firecrawl_webhook_events" in sql
        for kind, sql in events
    )


def test_record_delivery_is_idempotent_on_the_dedupe_key(
    monkeypatch: pytest.MonkeyPatch,
):
    """Firecrawl retries, so a re-delivery must be a no-op rather than a re-apply."""
    store: dict[str, Any] = {"returns": {}}
    _with_fake_db(monkeypatch, store)
    assert wmod.record_delivery("fc:1:0", "monitor.page", "m1", "https://x", {}) is False
    sql, params = store["sql"][0]
    assert "on conflict (dedupe_key) do nothing" in sql
    assert params[0] == "fc:1:0"
    assert json.loads(params[4]) == {}


def test_change_statuses_cover_the_contract_firecrawl_sends():
    """Pins the vocabulary the requeue decision turns on.

    A status missing from this set would be silently classed as "nothing moved",
    which is the failure mode that leaves stale citations looking verified.
    """
    for name in ("changed", "new", "removed"):
        assert name in wmod.CHANGE_STATUSES
    assert "same" not in wmod.CHANGE_STATUSES
    assert "error" not in wmod.CHANGE_STATUSES
