"""The two sources that reach their data through an in-page JavaScript action.

Both replaced a local Playwright driver. The JavaScript is only a transport, so
what matters here is that the Python side still parses correctly and — more
importantly — that a failed harvest raises instead of quietly reporting an empty
result set. A silent empty read on a sanctions-adjacent or certification source
is the failure mode that lets the UI assert something we never established.
"""
from __future__ import annotations

import asyncio
import json
from datetime import date

import pytest

from etl.acquire.models import AcquiredDoc, Adapter, FetchStatus
from etl.scrapers.rsc_updates import (
    RscUpdatesScraper,
    _build_modal_script,
    _extract_image_url,
    _section_for,
)
from etl.scrapers.sa8000 import (
    AJAX_URL,
    SEARCH_PAGE_URL,
    Sa8000Scraper,
    _build_harvest_script,
    _detail_from_envelope,
)


def doc(js_returns=(), status=FetchStatus.OK) -> AcquiredDoc:
    return AcquiredDoc(
        url=SEARCH_PAGE_URL,
        adapter=Adapter.FIRECRAWL,
        fetch_status=status,
        final_url=SEARCH_PAGE_URL,
        http_status=200 if status is FetchStatus.OK else 503,
        raw_html="<html></html>",
        js_returns=tuple(js_returns),
        credits_used=1,
    )


async def drain(scraper):
    return [r async for r in scraper.fetch()]


# ---- SA8000 ------------------------------------------------------------

LIST_HTML = """
<table>
  <tr class="pages">
    <td>Zenith Knit Ltd.</td><td>SGS</td><td>BGD.24.10021/SA/S</td>
    <td>Certified</td><td>Apparel</td><td>2400</td>
    <td><a data-pop="7781">View</a></td>
  </tr>
</table>
"""

POPUP_HTML = """
<ul>
  <li><b>Certified Organization:</b> Zenith Knit Ltd.</li>
  <li><b>Address:</b> Plot 9, Mirpur, Dhaka, N/A, 1216, Bangladesh</li>
  <li><b>Expiration Date:</b> 2027-03-31</li>
  <li><b>Latest Certification Date:</b> 2024-04-01</li>
</ul>
<p><b>Description of Operations:</b> Knit garment manufacturing.</p>
"""


def test_harvest_script_targets_the_ajax_endpoint_and_popup_action():
    script = _build_harvest_script()
    assert json.dumps(AJAX_URL) in script
    assert "cwp_get_results" in script
    assert "get_popup_content" in script
    # Popup ids must be read from the returned markup, not hard-coded.
    assert "a[data-pop]" in script
    assert "credentials: 'include'" in script


def test_detail_from_envelope_unwraps_wp_ajax_json():
    envelope = json.dumps({"success": True, "data": POPUP_HTML})
    detail = _detail_from_envelope(envelope)
    assert detail["address"] == "Plot 9, Mirpur, Dhaka, N/A, 1216, Bangladesh"
    assert detail["expiration_date"] == "2027-03-31"
    assert detail["description_of_operations"] == "Knit garment manufacturing."


@pytest.mark.parametrize(
    "raw",
    [
        None,
        "",
        "not json",
        json.dumps({"success": False, "data": POPUP_HTML}),
        json.dumps({"success": True, "data": {"not": "a string"}}),
    ],
)
def test_detail_from_envelope_is_safe_on_bad_payloads(raw):
    assert _detail_from_envelope(raw) == {}


def test_sa8000_emits_records_from_the_harvested_payload():
    harvest = {
        "ok": True,
        "status": 200,
        "list_html": LIST_HTML,
        "popups": {"7781": json.dumps({"success": True, "data": POPUP_HTML})},
    }
    s = Sa8000Scraper()
    s._adapter = object()  # never used: fetch() is fed a doc directly below
    s.acquire = lambda request: _immediate(doc([harvest]))  # type: ignore[assignment]

    records = asyncio.run(drain(s))
    assert len(records) == 1
    rec = records[0]
    assert rec.company_name == "Zenith Knit Ltd."
    assert rec.source_ref == "sa8000-bgd-24-10021-sa-s"
    assert rec.city == "Dhaka"
    assert rec.payload["sa8000_expiration_date"] == "2027-03-31"
    assert rec.payload["expires_on"] == "2027-03-31"
    assert rec.payload["sa8000_workers"] == "2400"


def test_sa8000_cites_the_public_search_page_not_the_ajax_endpoint():
    harvest = {
        "ok": True, "status": 200, "list_html": LIST_HTML,
        "popups": {"7781": json.dumps({"success": True, "data": POPUP_HTML})},
    }
    s = Sa8000Scraper()
    s.acquire = lambda request: _immediate(doc([harvest]))  # type: ignore[assignment]
    rec = asyncio.run(drain(s))[0]
    assert rec.evidence is not None
    assert rec.evidence.doc.citable_url == SEARCH_PAGE_URL
    assert "admin-ajax" not in rec.evidence.doc.citable_url
    # Popup-derived values must be findable in the excerpt source.
    assert "2027-03-31" in rec.evidence.document_text


def test_sa8000_row_without_certificate_id_is_skipped():
    no_id = LIST_HTML.replace("<td>BGD.24.10021/SA/S</td>", "<td></td>")
    harvest = {"ok": True, "status": 200, "list_html": no_id, "popups": {}}
    s = Sa8000Scraper()
    s.acquire = lambda request: _immediate(doc([harvest]))  # type: ignore[assignment]
    assert asyncio.run(drain(s)) == []


def test_sa8000_raises_when_the_page_is_unreadable():
    s = Sa8000Scraper()
    s.acquire = lambda request: _immediate(  # type: ignore[assignment]
        doc([], status=FetchStatus.BLOCKED)
    )
    with pytest.raises(RuntimeError, match="unreadable"):
        asyncio.run(drain(s))


def test_sa8000_raises_when_the_harvest_failed():
    s = Sa8000Scraper()
    s.acquire = lambda request: _immediate(  # type: ignore[assignment]
        doc([{"ok": False, "status": 403, "list_html": "", "popups": {}}])
    )
    with pytest.raises(RuntimeError, match="Refusing to report an empty"):
        asyncio.run(drain(s))


def test_sa8000_raises_when_no_javascript_ran():
    s = Sa8000Scraper()
    s.acquire = lambda request: _immediate(doc([]))  # type: ignore[assignment]
    with pytest.raises(RuntimeError, match="harvest failed"):
        asyncio.run(drain(s))


def test_sa8000_has_no_direct_fallback():
    # Cloudflare would serve an interstitial that parses to zero rows.
    assert Sa8000Scraper.fallback_transport is None
    assert Sa8000Scraper.transport == "firecrawl"


def test_sa8000_no_longer_imports_playwright():
    assert not _imports_playwright("etl.scrapers.sa8000")


# ---- RSC updates -------------------------------------------------------

def test_modal_script_walks_widgets_and_reads_bodies():
    script = _build_modal_script()
    assert "elementor-widget-premium-addon-modal-box" in script
    assert "premium-modal-box-modal-body" in script
    assert "premium-modal-box-modal-close" in script
    assert "innerHTML" in script


def test_image_url_prefers_real_src():
    html = '<img src="https://rsc-bd.org/x/dash-may.jpg">'
    assert _extract_image_url(html) == "https://rsc-bd.org/x/dash-may.jpg"


def test_image_url_falls_back_to_lazy_attribute():
    # A programmatically opened modal may never fire Elementor's lazy loader.
    html = (
        '<img src="data:image/gif;base64,R0lGOD" '
        'data-src="https://rsc-bd.org/x/dash-may.jpg">'
    )
    assert _extract_image_url(html) == "https://rsc-bd.org/x/dash-may.jpg"


def test_image_url_ignores_placeholder_only_images():
    html = '<img src="data:image/gif;base64,R0lGOD">'
    assert _extract_image_url(html) is None


def test_image_url_none_when_no_images():
    assert _extract_image_url("<div>No dashboard published.</div>") is None


def test_section_slugs_map_known_titles():
    assert _section_for("Inspection and Remediation") == "inspection_remediation"
    assert _section_for("Boiler Safety") == "boiler_safety"
    assert _section_for("OSH Training Programme") == "osh_training"
    assert _section_for("Safety and Health Complaints") == "osh_complaints"
    assert _section_for("Something New") == "something_new"


def test_rsc_updates_has_no_direct_fallback():
    assert RscUpdatesScraper.fallback_transport is None
    assert RscUpdatesScraper.transport == "firecrawl"


def test_rsc_updates_no_longer_imports_playwright():
    assert not _imports_playwright("etl.scrapers.rsc_updates")


def test_rsc_updates_citation_path_resolves_its_writer(monkeypatch: pytest.MonkeyPatch):
    """Exercises `_cite_snapshot` end to end with the writer stubbed.

    This source records evidence from a helper rather than inline in `run()`, and
    the writer is imported lazily to keep module import cheap. That combination
    is easy to get wrong in a way nothing else catches: an import placed in
    `run()` leaves the helper referencing a name that does not exist in its
    scope, and because every failure in here is swallowed and logged — so that a
    provenance problem can never fail a data run — the result would be a source
    that scrapes cleanly and silently stores nothing citable.
    """
    from etl.evidence import writer as writer_mod

    seen: dict[str, object] = {}

    async def fake_record(document, **kwargs):
        seen.update(kwargs)
        return "doc-1", 3

    monkeypatch.setattr(writer_mod, "record", fake_record)

    scraper = RscUpdatesScraper()
    snapshot = doc()
    asyncio.run(
        scraper._cite_snapshot(
            snapshot,
            date(2026, 7, 1),
            "boiler_safety",
            "https://rsc-bd.org/x/dash-july.jpg",
            "run-1",
        )
    )

    assert scraper.evidence_claims == 3
    assert seen["subject_table"] == "rsc_industry_metrics"
    # Metrics are keyed on (report_month, scope), not a uuid, so the citation has
    # to address them by key or it would attach to nothing.
    assert seen["subject_key"] == "report_month=2026-07-01&scope=boiler_safety"
    assert seen["locators"] == {
        "dashboard_snapshot_image_url": "'boiler_safety' modal body, dashboard image"
    }


def test_rsc_reports_citation_path_resolves_its_writer(monkeypatch: pytest.MonkeyPatch):
    """The same lazy-import trap, in the other source that has this shape."""
    from etl.evidence import writer as writer_mod
    from etl.scrapers.rsc_reports import ReportRef, RscReportsScraper

    seen: dict[str, object] = {}

    async def fake_record(document, **kwargs):
        seen.update(kwargs)
        return "doc-2", 2

    monkeypatch.setattr(writer_mod, "record", fake_record)

    scraper = RscReportsScraper()
    ref = ReportRef(
        url="https://rsc-bd.org/reports/july-2026.pdf",
        title="RSC Monthly Report July 2026",
        report_month=date(2026, 7, 1),
        source_kind="rsc_monthly_report",
    )
    metrics = [
        {
            "metric_key": "initial_findings_remediated_pct",
            "scope": "all",
            "value_num": 93.4,
            "raw_label": "93.4% of initial findings remediated",
        }
    ]
    asyncio.run(scraper._cite_metrics(doc(), ref, metrics, "run-1"))

    assert scraper.evidence_claims == 2
    assert seen["subject_key"] == "report_month=2026-07-01"
    # `raw_label` doubles as the excerpt, which is what makes a figure restated
    # next month detectable rather than assumed still true.
    assert "93.4% of initial findings remediated" in str(seen["document_text"])


# ---- helpers ----------------------------------------------------------

def _immediate(value):
    async def _coro():
        return value
    return _coro()


def _imports_playwright(module_name: str) -> bool:
    """True if the module imports playwright anywhere, including lazily.

    Checked against the AST rather than the file text so that prose explaining
    why Playwright was removed does not count as a dependency.
    """
    import ast
    import importlib

    mod = importlib.import_module(module_name)
    tree = ast.parse(open(mod.__file__, encoding="utf-8").read())
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            if any(a.name.split(".")[0] == "playwright" for a in node.names):
                return True
        elif isinstance(node, ast.ImportFrom):
            if (node.module or "").split(".")[0] == "playwright":
                return True
    return False
