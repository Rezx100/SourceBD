"""Verification loop behaviour, with the database stubbed out.

The rules under test are the ones that decide whether SourceBD keeps asserting a
fact to a buyer, so they are pinned individually rather than through one
end-to-end path:

* a transient failure changes nothing except the retry schedule (REZ-30);
* a 404 retires the citation, and only a 404 does;
* content moving without any cited fact moving is a redeploy, not drift;
* an excerpt that cannot be reproduced by replay is "unchecked", not "stale".
"""
from __future__ import annotations

import asyncio
from typing import Any

import pytest

from etl.acquire.models import AcquiredDoc, AcquireRequest, Adapter, FetchStatus
from etl.evidence import verifier as vmod


class _Recorder:
    """Captures the writes the verifier would make, in order."""

    def __init__(self) -> None:
        self.calls: list[tuple[str, tuple[Any, ...]]] = []

    def __call__(self, name: str, *args: Any) -> None:
        self.calls.append((name, args))

    def names(self) -> list[str]:
        return [name for name, _ in self.calls]


def _row(**over: Any) -> dict[str, Any]:
    row = {
        "id": "11111111-1111-1111-1111-111111111111",
        "url": "https://example.org/factory/1",
        "final_url": "https://example.org/factory/1",
        "adapter": Adapter.DIRECT.value,
        "content_sha256": "old-hash",
        "content_type": "text/html",
        "scraper_code": "bgmea_web",
        "source_id": None,
        "transient_failures": 0,
        "verify_status": "live",
        "meta": {"verify_mode": "full"},
    }
    row.update(over)
    return row


def _ok_doc(body: str, content_type: str = "text/html") -> AcquiredDoc:
    return AcquiredDoc(
        url="https://example.org/factory/1",
        adapter=Adapter.DIRECT,
        fetch_status=FetchStatus.OK,
        final_url="https://example.org/factory/1",
        http_status=200,
        content_type=content_type,
        raw_html=body if "html" in content_type else None,
        body_bytes=None if "html" in content_type else body.encode(),
    )


def _failed_doc(status: FetchStatus, http_status: int | None = None) -> AcquiredDoc:
    return AcquiredDoc(
        url="https://example.org/factory/1",
        adapter=Adapter.DIRECT,
        fetch_status=status,
        http_status=http_status,
        error_message=status.value,
    )


def _verify(
    monkeypatch: pytest.MonkeyPatch,
    row: dict[str, Any],
    doc: AcquiredDoc,
    claims: list[dict[str, Any]],
) -> tuple[vmod.VerifyOutcome, _Recorder]:
    rec = _Recorder()
    v = vmod.EvidenceVerifier()

    async def fake_refetch(_row):
        return doc

    monkeypatch.setattr(v, "_refetch", fake_refetch)
    monkeypatch.setattr(vmod, "_load_claims", lambda _eid: claims)
    monkeypatch.setattr(
        v, "_record_transient", lambda eid, r, res: rec("transient", eid, r, res)
    )
    monkeypatch.setattr(v, "_mark_dead", lambda eid, d, res: rec("dead", eid, d, res))
    monkeypatch.setattr(
        v, "_mark_live", lambda eid, d, cl, res: rec("live", eid, d, cl, res)
    )
    monkeypatch.setattr(
        v,
        "_apply_changed",
        lambda eid, d, conf, miss, res: rec("changed", eid, d, conf, miss, res),
    )
    outcome = asyncio.run(v.verify_document(row))
    return outcome, rec


# ------------------------------------------------------------- transients ----
@pytest.mark.parametrize(
    "status,http_status",
    [
        (FetchStatus.TIMEOUT, None),
        (FetchStatus.BLOCKED, 403),
        (FetchStatus.ERROR, 503),
    ],
)
def test_transient_failures_never_retire_a_citation(
    monkeypatch: pytest.MonkeyPatch, status: FetchStatus, http_status: int | None
) -> None:
    """The REZ-30 rule.

    A dropped request must not be allowed to look like an absent fact. Each of
    these outcomes leaves the document's previous state intact and only backs
    the retry off.
    """
    outcome, rec = _verify(
        monkeypatch, _row(), _failed_doc(status, http_status), claims=[]
    )
    assert outcome.outcome == "inconclusive"
    assert rec.names() == ["transient"]
    # Nothing was concluded about the claims either way.
    assert outcome.claims_missing == 0
    assert outcome.claims_confirmed == 0


def test_a_missing_local_file_is_inconclusive_not_dead(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """An unmounted raw directory is our problem, not a retraction.

    Treating it as a 404 would orphan every claim from both file-backed sources
    the first time a container ran without the volume attached.
    """
    row = _row(adapter=Adapter.LOCAL.value, url="file:///raw/BGMEA_Associate_Members.pdf")
    outcome, rec = _verify(
        monkeypatch, row, _failed_doc(FetchStatus.NOT_FOUND, None), claims=[]
    )
    assert outcome.outcome == "inconclusive"
    assert outcome.notes["reason"] == "local_file_missing"
    assert rec.names() == ["transient"]


def test_a_web_404_does_retire_the_citation(monkeypatch: pytest.MonkeyPatch) -> None:
    outcome, rec = _verify(
        monkeypatch, _row(), _failed_doc(FetchStatus.NOT_FOUND, 404), claims=[]
    )
    assert outcome.outcome == "dead"
    assert rec.names() == ["dead"]


# ------------------------------------------------------------------- live ----
def test_unchanged_content_confirms_without_re_reading_the_text(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The cheap path, and the reason a weekly full sweep is affordable."""
    body = "<td>Employees</td><td>1,240</td>"
    doc = _ok_doc(body)
    row = _row(content_sha256=doc.content_sha256)
    claims = [
        {
            "id": "c1",
            "field_key": "employees.total",
            "field_value": "1240",
            "excerpt": "totally unrelated text that would never match",
            "status": "active",
        }
    ]
    outcome, rec = _verify(monkeypatch, row, doc, claims)
    assert outcome.outcome == "live"
    assert outcome.content_changed is False
    # Confirmed on the hash, so a stale excerpt string is not consulted at all.
    assert outcome.claims_confirmed == 1
    assert rec.names() == ["live"]


def test_reflowed_markup_with_intact_facts_is_not_drift(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A cosmetic redeploy must not raise an alert.

    If it did, every class rename on a registry would bury the real drift in
    noise and the console would stop being read.
    """
    claims = [
        {
            "id": "c1",
            "field_key": "employees.total",
            "field_value": "1240",
            "excerpt": "Total Employees 1,240 Machines",
            "status": "active",
        }
    ]
    new_body = (
        '<div class="v2"><span>Total Employees</span> '
        '<span class="num">1,240</span> <span>Machines</span></div>'
    )
    outcome, rec = _verify(monkeypatch, _row(), _ok_doc(new_body), claims)
    assert outcome.content_changed is True
    assert outcome.outcome == "live"
    assert outcome.claims_confirmed == 1
    assert outcome.claims_missing == 0
    assert rec.names() == ["changed"]


def test_a_changed_value_is_drift(monkeypatch: pytest.MonkeyPatch) -> None:
    claims = [
        {
            "id": "c1",
            "field_key": "employees.total",
            "field_value": "1240",
            "excerpt": "Total Employees 1,240 Machines",
            "status": "active",
        }
    ]
    new_body = "<div>Total Employees 980 Machines</div>"
    outcome, rec = _verify(monkeypatch, _row(), _ok_doc(new_body), claims)
    assert outcome.outcome == "changed"
    assert outcome.claims_missing == 1
    assert outcome.claims_confirmed == 0
    assert rec.names() == ["changed"]
    # The confirmed/missing split is what the persist step acts on.
    _name, args = rec.calls[0]
    assert args[2] == []          # confirmed
    assert args[3] == ["c1"]      # missing


def test_mixed_page_marks_only_the_fields_that_moved(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    claims = [
        {
            "id": "keep",
            "field_key": "email",
            "field_value": "info@alpha.com",
            "excerpt": "Email info@alpha.com Phone",
            "status": "active",
        },
        {
            "id": "gone",
            "field_key": "employees.total",
            "field_value": "1240",
            "excerpt": "Total Employees 1,240 Machines",
            "status": "active",
        },
    ]
    new_body = "<div>Email info@alpha.com Phone</div><div>Total Employees 980</div>"
    outcome, rec = _verify(monkeypatch, _row(), _ok_doc(new_body), claims)
    assert outcome.outcome == "changed"
    assert outcome.claims_confirmed == 1
    assert outcome.claims_missing == 1
    _name, args = rec.calls[0]
    assert args[2] == ["keep"]
    assert args[3] == ["gone"]


# ------------------------------------------------------- verification depth ---
def test_liveness_mode_reports_unchecked_rather_than_stale(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """SA8000 and RSC updates harvest their payload with in-page JavaScript.

    A plain re-scrape reaches the page but not that payload, so a missing
    excerpt means "could not check". Calling it drift would mark every one of
    those claims stale on the first pass and destroy the signal.
    """
    row = _row(meta={"verify_mode": "liveness"})
    claims = [
        {
            "id": "c1",
            "field_key": "certificate_no",
            "field_value": "SA-12345",
            "excerpt": "Certificate SA-12345 valid until",
            "status": "active",
        }
    ]
    outcome, _rec = _verify(
        monkeypatch, row, _ok_doc("<div>Search for certified organisations</div>"), claims
    )
    assert outcome.outcome == "live"
    assert outcome.claims_missing == 0
    assert outcome.claims_unverifiable == 1


def test_claims_without_an_excerpt_are_unverifiable_not_missing(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Binary documents have no text to quote.

    Their claims are confirmed by digest instead, so a changed hash means
    "changed", never "the fact was removed from the page".
    """
    claims = [
        {
            "id": "c1",
            "field_key": "document_sha256",
            "field_value": "abc123",
            "excerpt": None,
            "status": "active",
        }
    ]
    outcome, _rec = _verify(
        monkeypatch,
        _row(content_type="application/pdf"),
        _ok_doc("new pdf bytes", content_type="application/pdf"),
        claims,
    )
    assert outcome.claims_unverifiable == 1
    assert outcome.claims_missing == 0
    assert outcome.outcome == "live"


def test_xml_claims_are_checked_without_stripping_tags(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The sanctions feeds put their facts in attributes.

    Stripping tags at verify time would erase every value and report the whole
    list as drifted.
    """
    excerpt = 'nameAlias wholeName="ABC Trading Ltd"'
    claims = [
        {
            "id": "c1",
            "field_key": "entity_name",
            "field_value": "ABC Trading Ltd",
            "excerpt": excerpt,
            "status": "active",
        }
    ]
    body = (
        "<export><sanctionEntity logicalId='9'>"
        '<nameAlias wholeName="ABC Trading Ltd"/>'
        "</sanctionEntity><sanctionEntity logicalId='10'/></export>"
    )
    outcome, _rec = _verify(
        monkeypatch,
        _row(content_type="application/xml"),
        _ok_doc(body, content_type="application/xml"),
        claims,
    )
    assert outcome.claims_confirmed == 1
    assert outcome.outcome == "live"


# ----------------------------------------------------------------- queueing ---
def test_due_query_excludes_unreplayable_documents_and_backs_off():
    """Pins the two clauses that keep the queue from thrashing.

    POST-backed documents cannot be reissued from a URL, so including them would
    mean every pass fails on them forever. The backoff term is what stops a
    week-long source outage from being retried on every single pass.
    """
    captured: dict[str, Any] = {}

    class FakeCursor:
        def execute(self, sql, params=None):
            captured["sql"] = sql
            captured["params"] = params

        def fetchall(self):
            return []

        def __enter__(self):
            return self

        def __exit__(self, *exc):
            return False

    class FakeConn:
        def cursor(self):
            return FakeCursor()

        def commit(self):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *exc):
            return False

    class FakeDb:
        def conn(self):
            return FakeConn()

    original = vmod.db
    vmod.db = FakeDb()  # type: ignore[assignment]
    try:
        vmod._select_due(10, scraper_code="bgmea_web", interval_hours=48)
    finally:
        vmod.db = original  # type: ignore[assignment]

    sql = captured["sql"]
    assert "verify_mode" in sql and "<> 'none'" in sql
    assert "power(2, least(transient_failures" in sql
    assert "fetch_status = 'ok'" in sql
    assert "last_verified_at asc nulls first" in sql
    assert captured["params"]["interval"] == 48
    assert captured["params"]["scraper_code"] == "bgmea_web"


def test_verify_replays_a_firecrawl_document_with_its_original_options(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """`only_main_content` and the source's headers must be replayed as recorded.

    Firecrawl defaults `only_main_content` to True, which strips the table a
    registry list page keeps its data in — re-checking with the default would
    report every claim on that page as drifted. And a registry that only serves
    its table to a browser UA + Referer answers a headerless replay differently,
    which reads as drift that never happened.
    """
    from etl.scrapers.registry import SCRAPERS

    seen: dict[str, Any] = {}

    class FakeFirecrawl:
        async def fetch(self, request: AcquireRequest):
            seen["only_main_content"] = request.only_main_content
            seen["max_age_ms"] = request.max_age_ms
            seen["headers"] = request.headers
            return _ok_doc("<div/>")

        async def aclose(self):
            pass

    v = vmod.EvidenceVerifier()
    v._firecrawl = FakeFirecrawl()  # type: ignore[assignment]
    row = _row(
        adapter=Adapter.FIRECRAWL.value,
        meta={"verify_mode": "full", "only_main_content": False},
    )
    asyncio.run(v._refetch(row))
    assert seen["only_main_content"] is False
    assert seen["max_age_ms"] == vmod.VERIFY_MAX_AGE_MS
    assert seen["headers"] == dict(SCRAPERS["bgmea_web"].request_headers)


# ----------------------------------------------------------- replay transport ---
def test_bkmea_detail_verifies_on_the_direct_transport():
    """The founder-approved override (2 Aug 2026): parity-proven 8/8, ~0 credits
    vs ~1,770/week — the browser headers force storeInCache=false upstream, so
    a Firecrawl replay could never hit the cache."""
    from etl.scrapers.registry import SCRAPERS

    assert SCRAPERS["bkmea_detail"].verify_transport == "direct"
    # Nothing else declares an override: every other source replays on the
    # transport that ingested it.
    for code, cls in SCRAPERS.items():
        if code != "bkmea_detail":
            assert cls.verify_transport is None, code


class _StubSource:
    """Stands in for a scraper class: the replay must use its construction."""

    verify_transport: str | None = None
    request_headers = {"User-Agent": "SourceBD-Test/1.0", "Referer": "https://x/"}

    def __init__(self) -> None:
        self.direct: _CapturingDirect | None = None

    def direct_adapter(self) -> "_CapturingDirect":
        if self.direct is None:
            self.direct = _CapturingDirect()
        return self.direct

    async def aclose(self) -> None:
        pass


class _CapturingDirect:
    def __init__(self) -> None:
        self.requests: list[AcquireRequest] = []

    async def fetch(self, request: AcquireRequest) -> AcquiredDoc:
        self.requests.append(request)
        return _ok_doc("<div/>")


def _verifier_with_source(monkeypatch: pytest.MonkeyPatch, cls: type) -> vmod.EvidenceVerifier:
    monkeypatch.setattr(vmod.EvidenceVerifier, "_source_for", staticmethod(lambda code: cls))
    return vmod.EvidenceVerifier()


def test_a_declared_verify_transport_replays_through_the_sources_adapter(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """`verify_transport = "direct"` sends a Firecrawl-ingested document to the
    source's own direct adapter — its headers, its rps, its TLS."""

    class DirectOverride(_StubSource):
        verify_transport = "direct"

    v = _verifier_with_source(monkeypatch, DirectOverride)
    row = _row(adapter=Adapter.FIRECRAWL.value, scraper_code="stub")
    asyncio.run(v._refetch(row))

    assert v._firecrawl is None, "Firecrawl was used despite the direct override"
    source = v._sources["stub"]
    assert source.direct is not None
    request = source.direct.requests[0]
    assert request.headers == dict(DirectOverride.request_headers)
    assert request.want_bytes is True


def test_an_undeclared_source_replays_on_the_ingest_adapter(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """No `verify_transport` means the ingest adapter replays — Firecrawl stays
    Firecrawl, direct stays direct."""

    class FirecrawlCapture:
        def __init__(self) -> None:
            self.requests: list[AcquireRequest] = []

        async def fetch(self, request: AcquireRequest) -> AcquiredDoc:
            self.requests.append(request)
            return _ok_doc("<div/>")

        async def aclose(self) -> None:
            pass

    v = _verifier_with_source(monkeypatch, _StubSource)
    v._firecrawl = FirecrawlCapture()  # type: ignore[assignment]
    asyncio.run(v._refetch(_row(adapter=Adapter.FIRECRAWL.value, scraper_code="stub")))
    assert len(v._firecrawl.requests) == 1  # type: ignore[union-attr]
    assert v._sources["stub"].direct is None

    # A direct-ingested document goes through the source's direct construction,
    # picking up its headers — not a bare shared client.
    asyncio.run(v._refetch(_row(adapter=Adapter.DIRECT.value, scraper_code="stub")))
    source = v._sources["stub"]
    assert source.direct is not None
    assert source.direct.requests[0].headers == dict(_StubSource.request_headers)


def test_an_unknown_source_replays_headerless_on_the_shared_adapter(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A document whose scraper is no longer registered still verifies; it just
    gets no per-source request shaping."""
    monkeypatch.setattr(vmod.EvidenceVerifier, "_source_for", staticmethod(lambda code: None))
    v = vmod.EvidenceVerifier()
    fake = _CapturingDirect()
    v._direct = fake  # type: ignore[assignment]
    asyncio.run(v._refetch(_row(adapter=Adapter.DIRECT.value, scraper_code="gone")))
    assert fake.requests[0].headers == {}


def test_planned_credits_charges_only_firecrawl_replays(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The budget prices the transport the replay will actually use."""
    v = vmod.EvidenceVerifier()
    firecrawl_row = _row(adapter=Adapter.FIRECRAWL.value, scraper_code="bgmea_web")
    # bgmea_web declares no override: the replay is Firecrawl, 1 credit/page.
    assert v.planned_credits(firecrawl_row) == 1
    # bkmea_detail verifies direct despite being Firecrawl-ingested: free.
    bkmea_row = _row(adapter=Adapter.FIRECRAWL.value, scraper_code="bkmea_detail")
    assert v.planned_credits(bkmea_row) == 0
    # Direct and local never bill.
    assert v.planned_credits(_row(adapter=Adapter.DIRECT.value, scraper_code=None)) == 0
    assert v.planned_credits(_row(adapter=Adapter.LOCAL.value, scraper_code=None)) == 0
    asyncio.run(v.aclose())


# ---------------------------------------------------------------- budget ----
def test_the_budget_stops_the_run_before_overspend(monkeypatch: pytest.MonkeyPatch) -> None:
    """The ceiling is checked before each Firecrawl fetch, not after.

    A guard that notices after spending has guarded nothing, and this job is
    the one the weekly schedule runs unattended.
    """

    class FakeVerifier:
        def __init__(self) -> None:
            self.checked: list[str] = []

        def planned_credits(self, row: dict[str, Any]) -> int:
            return 1

        async def verify_document(self, row: dict[str, Any]) -> vmod.VerifyOutcome:
            self.checked.append(str(row["id"]))
            return vmod.VerifyOutcome(
                evidence_id=str(row["id"]), url=row["url"], outcome="live", credits_used=1
            )

        async def aclose(self) -> None:
            pass

    fake = FakeVerifier()
    monkeypatch.setattr(vmod, "EvidenceVerifier", lambda: fake)
    rows = [_row(id=f"doc-{i}") for i in range(3)]
    monkeypatch.setattr(vmod, "_select_due", lambda *a, **k: rows)

    job = vmod.VerifyEvidenceJob(limit=10, max_credits=1)
    monkeypatch.setattr(job, "_open_run", lambda: "r1")
    closed: list[tuple[Any, ...]] = []
    monkeypatch.setattr(
        job, "_close_run", lambda *a: closed.append(a)
    )

    result = asyncio.run(job.run())
    # Two credits were affordable... no: the ceiling is 1, so exactly one
    # document is checked and the run stops before the second fetch.
    assert fake.checked == ["doc-0"]
    assert result["seen"] == 1
    assert result["credits_used"] == 1
    assert result["budget_stopped"] is True
    assert result["credit_ceiling"] == 1
    assert closed[0][1] == "success"


def test_the_ceiling_defaults_to_the_setting_and_a_run_can_override_it(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(vmod.settings, "firecrawl_max_credits_per_run", 25)
    assert vmod.VerifyEvidenceJob().credit_ceiling == 25
    assert vmod.VerifyEvidenceJob(max_credits=5).credit_ceiling == 5
    # 0 means off, consistent with the sources' budget semantics.
    assert vmod.VerifyEvidenceJob(max_credits=0).credit_ceiling == 0
    monkeypatch.setattr(vmod.settings, "firecrawl_max_credits_per_run", 0)
    assert vmod.VerifyEvidenceJob().credit_ceiling == 0


def test_an_unlimited_run_never_stops_for_budget(monkeypatch: pytest.MonkeyPatch) -> None:
    class FakeVerifier:
        def planned_credits(self, row: dict[str, Any]) -> int:
            return 1

        async def verify_document(self, row: dict[str, Any]) -> vmod.VerifyOutcome:
            return vmod.VerifyOutcome(
                evidence_id=str(row["id"]), url=row["url"], outcome="live", credits_used=1
            )

        async def aclose(self) -> None:
            pass

    monkeypatch.setattr(vmod, "EvidenceVerifier", lambda: FakeVerifier())
    monkeypatch.setattr(vmod, "_select_due", lambda *a, **k: [_row(id="a"), _row(id="b")])
    monkeypatch.setattr(vmod.settings, "firecrawl_max_credits_per_run", 0)
    job = vmod.VerifyEvidenceJob(limit=10)
    monkeypatch.setattr(job, "_open_run", lambda: "r1")
    monkeypatch.setattr(job, "_close_run", lambda *a: None)
    result = asyncio.run(job.run())
    assert result["seen"] == 2
    assert result["budget_stopped"] is False
    assert "credit_ceiling" not in result


# -------------------------------------------------------------------- CLI ----
def test_cli_interval_hours_zero_means_zero_and_max_credits_is_passed(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """`--interval-hours 0` is "everything is due", not "use the default".

    `interval_hours or DEFAULT` swallowed the 0, which made a first-run smoke
    check 2 documents and a vacuous green exit — the proof this spec exists to
    prevent.
    """
    from typer.testing import CliRunner

    from etl.cli import app

    captured: dict[str, Any] = {}

    class FakeJob:
        def __init__(self, **kwargs: Any) -> None:
            captured.update(kwargs)

        async def run(self) -> dict[str, Any]:
            return {"seen": 0}

    monkeypatch.setattr("etl.evidence.verifier.VerifyEvidenceJob", FakeJob)
    result = CliRunner().invoke(
        app, ["verify-evidence", "--interval-hours", "0", "--max-credits", "7"]
    )
    assert result.exit_code == 0, result.output
    assert captured["interval_hours"] == 0
    assert captured["max_credits"] == 7


def test_cli_defaults_when_no_flags_are_given(monkeypatch: pytest.MonkeyPatch) -> None:
    from typer.testing import CliRunner

    from etl.cli import app

    captured: dict[str, Any] = {}

    class FakeJob:
        def __init__(self, **kwargs: Any) -> None:
            captured.update(kwargs)

        async def run(self) -> dict[str, Any]:
            return {"seen": 0}

    monkeypatch.setattr("etl.evidence.verifier.VerifyEvidenceJob", FakeJob)
    result = CliRunner().invoke(app, ["verify-evidence"])
    assert result.exit_code == 0, result.output
    assert captured["interval_hours"] == vmod.DEFAULT_INTERVAL_HOURS
    assert captured["max_credits"] is None
    assert captured["limit"] == 500


def test_post_backed_documents_are_marked_unreplayable_at_acquisition():
    """The flag the due query filters on is set by the adapter, not guessed."""
    from etl.acquire.direct import DirectAdapter

    class FakeResponse:
        status_code = 200
        headers = {"content-type": "application/json"}
        content = b"{}"
        text = "{}"
        url = "https://example.org/api/search"

    class FakeHttp:
        _headers: dict[str, str] = {}

        async def post(self, url, **kwargs):
            return FakeResponse()

        async def get(self, url, **kwargs):
            return FakeResponse()

        async def aclose(self):
            pass

    adapter = DirectAdapter(client=FakeHttp())  # type: ignore[arg-type]
    posted = asyncio.run(
        adapter.fetch(
            AcquireRequest(
                url="https://example.org/api/search", method="POST", json_body={"q": 1}
            )
        )
    )
    assert posted.meta["verify_mode"] == "none"

    fetched = asyncio.run(adapter.fetch(AcquireRequest(url="https://example.org/api/search")))
    assert fetched.meta["verify_mode"] == "full"


def test_verify_evidence_is_runnable_from_the_queue_but_not_a_source():
    """It shares the admin queue and timer UI without pretending to be a source.

    Keeping it out of `SCRAPERS` is what lets the registry-wide invariant — every
    source declares a transport and produces evidence — stay an assertion rather
    than a convention.
    """
    from etl.scrapers.registry import JOBS, RUNNABLE, SCRAPERS

    assert "verify_evidence" in JOBS
    assert "verify_evidence" in RUNNABLE
    assert "verify_evidence" not in SCRAPERS
    job = RUNNABLE["verify_evidence"]
    # The queue runner assigns a progress callback and reads `last_run_id`.
    instance = job()
    instance.progress_callback = lambda _event: None
    assert instance.last_run_id is None
    assert hasattr(instance, "run")
