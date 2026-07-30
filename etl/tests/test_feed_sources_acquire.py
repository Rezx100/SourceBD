"""Structured-feed and local-file sources on the acquisition layer.

These sources keep their original transport — a CSV export must be read as CSV,
a Power BI DSR must be decoded, a PDF on disk has no URL — so the thing worth
testing is not "does Firecrawl work here" but the two properties the wrapper is
supposed to give them:

* every source, whatever its transport, produces evidence rows; and
* the excerpts on those rows are verbatim slices of the right record, so the
  verifier can later tell a genuinely changed fact from a reformatted page.

The second property is where feeds differ from HTML pages and where the bugs
live: one response carries hundreds of records, XML puts its payload in
attributes rather than text nodes, and a CSV field may contain newlines.
"""
from __future__ import annotations

import asyncio
import csv
import io
import json

import pytest

from etl.acquire.models import AcquiredDoc, Adapter, FetchStatus
from etl.core.acquiring import AcquisitionMixin
from etl.evidence.locate import (
    NO_EXCERPT,
    excerpt_contains,
    make_excerpt,
    raw_window,
    strips_tags_for,
)
from etl.scrapers.registry import SCRAPERS


# ---------------------------------------------------------------- registry ---
def test_every_scraper_goes_through_the_acquisition_layer():
    """No source may keep a private fetch path.

    A source that fetches on its own produces no evidence document, which means
    its fields are silently uncitable while the admin console still shows the
    run as green. That is the exact failure the layer exists to remove, so it is
    asserted over the whole registry rather than per source.
    """
    stragglers = [
        code
        for code, cls in SCRAPERS.items()
        if not issubclass(cls, AcquisitionMixin)
    ]
    assert stragglers == []


def test_declared_transports_are_valid_and_feeds_do_not_fall_back_to_firecrawl():
    for code, cls in SCRAPERS.items():
        assert cls.transport in ("firecrawl", "direct", "local"), code
        if cls.transport in ("direct", "local"):
            # Falling back to Firecrawl would mean parsing a rendering of a
            # typed payload — the fidelity loss Hard Rule 5 forbids.
            assert cls.fallback_transport is None, code


# -------------------------------------------------------------- tag policy ---
def test_xml_keeps_its_markup_and_html_does_not():
    """XML attributes carry the facts, so stripping tags would erase them."""
    xml = '<sanctionEntity><nameAlias wholeName="ABC Trading Ltd"/></sanctionEntity>'
    assert strips_tags_for("application/xml", xml) is False
    assert strips_tags_for("text/xml;charset=UTF-8", xml) is False

    html = "<table><tr><td>ABC Trading Ltd</td></tr></table>"
    assert strips_tags_for("text/html; charset=utf-8", html) is True
    # XHTML is HTML for this purpose: its facts sit between tags.
    assert strips_tags_for("application/xhtml+xml", html) is True


def test_json_and_csv_are_left_intact():
    assert strips_tags_for("application/json", '{"name":"ABC Ltd"}') is False
    assert strips_tags_for("text/csv", '"1","ABC LTD","entity"') is False


def test_xml_attribute_value_is_excerptable_and_drift_is_caught():
    """The whole point of the XML carve-out, end to end."""
    entity = (
        '<sanctionEntity logicalId="1234" designationDate="2022-03-15">'
        '<subjectType code="enterprise"/>'
        '<nameAlias wholeName="ABC Trading Ltd"/>'
        "<remark>Asset freeze applies.</remark>"
        "</sanctionEntity>"
    )
    excerpt = make_excerpt(entity, "ABC Trading Ltd", is_html=False)
    assert excerpt is not None
    assert "ABC Trading Ltd" in excerpt

    full = f"<export>{entity}</export>"
    assert excerpt_contains(excerpt, full, "ABC Trading Ltd", is_html=False) is True

    renamed = full.replace("ABC Trading Ltd", "XYZ Trading Ltd")
    assert excerpt_contains(excerpt, renamed, "ABC Trading Ltd", is_html=False) is False


def test_stripping_tags_would_have_lost_the_xml_value():
    """Guards the reason the carve-out exists, not just its current behaviour."""
    entity = '<nameAlias wholeName="ABC Trading Ltd"/>'
    assert make_excerpt(entity, "ABC Trading Ltd", is_html=True) is None


# ------------------------------------------------------------- raw windows ---
def test_raw_window_is_a_verbatim_substring():
    raw = json.dumps({"results": [{"id": 1, "name": "Alpha Mills"}]})
    window = raw_window(raw, '"Alpha Mills"')
    assert window is not None
    assert window in raw


def test_raw_window_scopes_the_search_to_one_record():
    """A feed response carries many records; excerpts must not cross between them."""
    raw = json.dumps(
        {
            "results": [
                {"factory_id": "1", "name": "Alpha Mills", "workers": 1200},
                {"factory_id": "2", "name": "Beta Knitwear", "workers": 860},
            ]
        }
    )
    window = raw_window(raw, '"Beta Knitwear"', radius=40)
    assert window is not None
    assert "Beta Knitwear" in window
    # Alpha's worker count must not be reachable from Beta's window, or it could
    # be excerpted as Beta's evidence.
    assert "1200" not in window


def test_json_record_window_returns_exactly_the_enclosing_record():
    raw = json.dumps(
        {
            "results": [
                {"factory_id": "1", "name": "Alpha Mills", "workers": 1200},
                {"factory_id": "2", "name": "Beta Knitwear", "workers": 860},
            ]
        }
    )
    from etl.evidence.locate import json_record_window

    window = json_record_window(raw, '"Beta Knitwear"')
    assert window is not None
    assert window in raw
    assert json.loads(window) == {
        "factory_id": "2",
        "name": "Beta Knitwear",
        "workers": 860,
    }
    # Unlike a fixed radius, this cannot clip a long record or spill into its
    # neighbour regardless of how big either one is.
    assert "Alpha Mills" not in window


def test_json_record_window_falls_back_when_braces_do_not_resolve():
    """A brace inside a string value must not produce a bogus slice.

    The fallback still returns a literal substring, so an excerpt cut from it is
    never fabricated — only less tightly scoped.
    """
    from etl.evidence.locate import json_record_window

    raw = '{"name": "Odd { Name", "id": 7}'
    window = json_record_window(raw, '"Odd { Name"')
    assert window is not None
    assert window in raw


def test_raw_window_is_none_when_the_anchor_is_absent():
    assert raw_window('{"a":1}', '"missing"') is None
    assert raw_window(None, "x") is None
    assert raw_window("x", None) is None


# --------------------------------------------------------------- OFAC CSV ----
def test_ofac_row_slices_are_verbatim_and_survive_embedded_newlines():
    """Remarks legitimately contain line breaks inside their quotes.

    Splitting the export on newlines would mis-align every subsequent row, so
    record boundaries are tracked through the CSV reader instead.
    """
    from etl.scrapers.ofac_sdn import _rows_with_raw

    text = (
        '"1","ALPHA TRADING CO","entity","SDN","-0-","-0-","-0-","-0-","-0-",'
        '"-0-","-0-","First remark"\n'
        '"2","BETA HOLDINGS","entity","SDN","-0-","-0-","-0-","-0-","-0-",'
        '"-0-","-0-","Second remark\nspanning two lines"\n'
        '"3","GAMMA LTD","vessel","SDN","-0-","-0-","-0-","-0-","-0-",'
        '"-0-","-0-","-0-"\n'
    )
    records = list(_rows_with_raw(text))
    assert [r[1][1] for r in records] == [
        "ALPHA TRADING CO",
        "BETA HOLDINGS",
        "GAMMA LTD",
    ]
    # Every slice is a literal substring of the export, which is what lets the
    # verifier find an excerpt cut from it in the full file later.
    for row_text, _row, _line_no in records:
        assert row_text in text

    beta_text, beta_row, beta_line = records[1]
    assert beta_line == 2
    assert "spanning two lines" in beta_text
    # The multi-line record must not bleed into the next one.
    assert "GAMMA LTD" not in beta_text
    # And the third record's reported line number accounts for the extra line.
    assert records[2][2] == 4


def test_ofac_excerpt_confirms_the_row_and_catches_a_rename():
    from etl.scrapers.ofac_sdn import _rows_with_raw

    text = (
        '"1","ALPHA TRADING CO","entity","BALKANS-EO14033","-0-","-0-","-0-",'
        '"-0-","-0-","-0-","-0-","Linked to sanctioned parent."\n'
    )
    row_text, _row, _line = next(iter(_rows_with_raw(text)))
    excerpt = make_excerpt(row_text, "ALPHA TRADING CO", is_html=False)
    assert excerpt is not None
    assert excerpt_contains(excerpt, text, "ALPHA TRADING CO", is_html=False)
    renamed = text.replace("ALPHA TRADING CO", "OMEGA TRADING CO")
    assert not excerpt_contains(excerpt, renamed, "ALPHA TRADING CO", is_html=False)


# ------------------------------------------------------------------- GOTS ----
def _doc(url: str, body: str, content_type: str) -> AcquiredDoc:
    return AcquiredDoc(
        url=url,
        adapter=Adapter.DIRECT,
        fetch_status=FetchStatus.OK,
        final_url=url,
        http_status=200,
        content_type=content_type,
        body_bytes=body.encode("utf-8"),
    )


def _drain(scraper) -> list:
    async def go():
        return [rec async for rec in scraper.fetch()]

    return asyncio.run(go())


def test_gots_cites_the_detail_document_it_read():
    from etl.scrapers import gots as gots_mod

    detail = {
        "system_id": "GTB-1",
        "company_name": "Alpha Organic Ltd",
        "city": "Gazipur",
        "gtb_license_number": "GOTS-99",
        "certification_body": "Control Union",
        "certificate_valid_until": "2027-01-31",
        "address1": "Plot 5",
        "field_of_operation": "Knitting",
    }
    list_body = json.dumps({"items": [{"system_id": "GTB-1"}], "total": 1})
    detail_body = json.dumps(detail)

    scraper = gots_mod.GotsScraper()
    docs = {
        gots_mod.LIST_URL: _doc(gots_mod.LIST_URL, list_body, "application/json"),
        gots_mod.DETAIL_URL_TEMPLATE.format(system_id="GTB-1"): _doc(
            gots_mod.DETAIL_URL_TEMPLATE.format(system_id="GTB-1"),
            detail_body,
            "application/json",
        ),
    }

    async def fake_acquire(request):
        return docs[request.url]

    scraper.acquire = fake_acquire  # type: ignore[method-assign]
    gots_mod.DETAIL_THROTTLE_SEC = 0

    records = _drain(scraper)
    assert len(records) == 1
    rec = records[0]
    att = rec.evidence
    assert att is not None
    assert att.doc.citable_url.endswith("/certified-suppliers/GTB-1")
    assert att.locators["gots_license_number"] == "json:/gtb_license_number"
    # Our own reformatting of a cited field, and the API's row handle, are not
    # facts GOTS states.
    assert "expires_on" in att.skip_keys
    assert "gots_system_id" in att.skip_keys

    excerpt = make_excerpt(att.doc.text(), "GOTS-99", is_html=False)
    assert excerpt is not None
    assert excerpt_contains(excerpt, detail_body, "GOTS-99", is_html=False)


def test_gots_falls_back_to_the_list_row_and_cites_the_list_page():
    """A failed detail fetch must not cite a document we never read."""
    from etl.scrapers import gots as gots_mod

    list_body = json.dumps(
        {
            "items": [{"system_id": "GTB-2", "company_name": "Beta Organic Ltd"}],
            "total": 1,
        }
    )
    list_doc = _doc(gots_mod.LIST_URL, list_body, "application/json")
    detail_url = gots_mod.DETAIL_URL_TEMPLATE.format(system_id="GTB-2")
    dead_detail = AcquiredDoc(
        url=detail_url,
        adapter=Adapter.DIRECT,
        fetch_status=FetchStatus.TIMEOUT,
        error_message="ReadTimeout",
    )

    scraper = gots_mod.GotsScraper()

    async def fake_acquire(request):
        return list_doc if request.url == gots_mod.LIST_URL else dead_detail

    scraper.acquire = fake_acquire  # type: ignore[method-assign]
    gots_mod.DETAIL_THROTTLE_SEC = 0

    records = _drain(scraper)
    assert len(records) == 1
    att = records[0].evidence
    assert att is not None
    assert att.doc is list_doc
    assert att.locators["gots_certification_body"].startswith(
        "json:/items[?system_id==GTB-2]"
    )


def test_gots_aborts_rather_than_reporting_a_partial_directory():
    from etl.scrapers import gots as gots_mod

    scraper = gots_mod.GotsScraper()

    async def fake_acquire(request):
        return AcquiredDoc(
            url=request.url,
            adapter=Adapter.DIRECT,
            fetch_status=FetchStatus.BLOCKED,
            http_status=403,
            error_message="HTTP 403",
        )

    scraper.acquire = fake_acquire  # type: ignore[method-assign]

    with pytest.raises(RuntimeError, match="unreadable"):
        _drain(scraper)


# -------------------------------------------------------------------- RSC ----
def test_rsc_factory_evidence_is_scoped_to_that_factory():
    from etl.scrapers.rsc import _factory_to_record

    page = {
        "results": [
            {
                "factory_id": "F1",
                "factory_name": "Alpha Apparels",
                "location": "Gazipur",
                "workers": 1200,
                "progress": 0.87,
                "status": {"name": "active"},
            },
            {
                "factory_id": "F2",
                "factory_name": "Beta Knitwear",
                "location": "Narayanganj",
                "workers": 860,
                "progress": 0.42,
                "status": {"name": "active"},
            },
        ]
    }
    raw = json.dumps(page)
    doc = _doc("https://accord2.fairfactories.org/api/v1/factories", raw, "application/json")

    rec = _factory_to_record(page["results"][1], doc, raw)
    assert rec is not None
    att = rec.evidence
    assert att is not None
    assert att.locators["rsc_workers_count"] == "json:/results[factory_id=F2]/workers"
    assert att.document_text is not None
    # Alpha's numbers must be unreachable, or 1200 could be excerpted as Beta's.
    assert "Alpha Apparels" not in att.document_text
    assert "1200" not in att.document_text
    # `active` is our reading of status.name, which is cited in its own right.
    assert "active" in att.skip_keys

    excerpt = make_excerpt(att.document_text, 860, is_html=False)
    assert excerpt is not None
    assert excerpt_contains(excerpt, raw, 860, is_html=False)


def test_rsc_record_without_a_document_still_parses():
    """Parsing must not depend on provenance being available."""
    from etl.scrapers.rsc import _factory_to_record

    rec = _factory_to_record({"factory_id": "F9", "factory_name": "Gamma Ltd"})
    assert rec is not None
    assert rec.evidence is None
    assert rec.payload["rsc_factory_id"] == "F9"


# ------------------------------------------------------------------- WRAP ----
def test_wrap_leaves_dictionary_encoded_fields_without_an_excerpt():
    """Power BI stores repeated values once and refers to them by index.

    A city shared by 200 facilities appears in the response as a number, so
    there is no honest per-facility excerpt for it. Recording no excerpt marks
    the claim unverifiable, which is the truthful outcome; inventing one would
    let an unrelated dictionary entry stand as this facility's citation.
    """
    from etl.scrapers.wrap import _UNCITABLE_FIELDS

    # ValueDicts sit in their own block, well away from the row arrays — the
    # padding stands in for the ~100 entries a real report carries.
    raw = json.dumps(
        {
            "ValueDicts": {"D2": ["Dhaka", "Gazipur"] + [f"City{i}" for i in range(120)]},
            "DM0": [
                {"C": ["12345", "Alpha Apparels", 0]},
                {"C": ["67890", "Beta Apparels", 1]},
            ],
        }
    )
    window = raw_window(raw, '"12345"', radius=200)
    assert window is not None
    assert make_excerpt(window, "12345", is_html=False) is not None
    # The city arrived as a dictionary index, so it is not excerptable from the
    # row and its claim is recorded without an excerpt.
    assert make_excerpt(window, "Dhaka", is_html=False) is None
    assert "wrap_profile_url" in _UNCITABLE_FIELDS


# ------------------------------------------------------------ local files ----
def test_btma_row_cites_its_page_file_and_stays_within_its_own_entry():
    from etl.scrapers.btma_spinning import _Row, _row_to_record

    raw_page = json.dumps(
        {
            "section": "General Member",
            "rows": [
                {
                    "sl_no": "1",
                    "mill_name": "Alpha Spinning Mills Ltd.",
                    "installed_capacity": "25,000 Spindles",
                    "telephone": "02-111111",
                },
                {
                    "sl_no": "2",
                    "mill_name": "Beta Textile Mills Ltd.",
                    "installed_capacity": "48,000 Spindles",
                    "telephone": "02-222222",
                },
            ],
        }
    )
    page = json.loads(raw_page)
    doc = _doc("file:///raw/btma_spinning/pages/page_01.json", raw_page, "application/json")

    row = _Row.from_json(page["section"], page["rows"][1])
    rec = _row_to_record(row, doc, raw_page)
    att = rec.evidence
    assert att is not None
    assert att.locators["installed_capacity"] == "json:/rows[sl_no=2]/installed_capacity"
    assert att.document_text is not None
    assert "25,000 Spindles" not in att.document_text
    # The section heading and serial number are the register's bookkeeping.
    assert "btma_section" in att.skip_keys
    assert "btma_sl_no" in att.skip_keys

    excerpt = make_excerpt(att.document_text, "48,000 Spindles", is_html=False)
    assert excerpt is not None
    assert excerpt_contains(excerpt, raw_page, "48,000 Spindles", is_html=False)


def test_btma_row_that_cannot_be_anchored_gets_no_excerpt_not_the_whole_page():
    """An unanchored record must not fall back to a page-wide excerpt search.

    One BTMA page holds many mills and repeats capacities and district names, so
    searching the page for this mill's value can match a neighbour's and attach
    it as this mill's evidence. A claim we cannot quote is recoverable — the
    admin console shows it as unverifiable — but a claim quoting the wrong mill
    is a false fact with a citation behind it, which is worse than none.
    """
    from etl.scrapers.btma_spinning import _Row, _row_to_record

    # The page in hand does not contain this row, so its entry cannot be isolated.
    raw_page = json.dumps(
        {
            "section": "General Member",
            "rows": [
                {
                    "sl_no": "1",
                    "mill_name": "Alpha Spinning Mills Ltd.",
                    "installed_capacity": "25,000 Spindles",
                }
            ],
        }
    )
    doc = _doc("file:///raw/btma_spinning/pages/page_01.json", raw_page, "application/json")
    row = _Row.from_json(
        "General Member",
        {
            "sl_no": "2",
            "mill_name": "Beta Textile Mills Ltd.",
            "installed_capacity": "48,000 Spindles",
        },
    )

    att = _row_to_record(row, doc, raw_page).evidence
    assert att is not None
    # The citation itself survives: we still record which page and row to read.
    assert att.locators["installed_capacity"] == "json:/rows[sl_no=2]/installed_capacity"
    assert att.document_text == NO_EXCERPT
    # Alpha's capacity sits in the page but must be unreachable as Beta's evidence.
    assert make_excerpt(att.document_text, "25,000 Spindles", is_html=False) is None
    assert make_excerpt(att.document_text, "48,000 Spindles", is_html=False) is None


def test_no_excerpt_is_not_collapsed_into_the_document_body_fallback():
    """`NO_EXCERPT` and None must stay distinct in the writer.

    Both are falsy, so a truthiness check anywhere on this path would turn "we
    could not isolate this record" back into "search the whole document" — the
    exact page-wide matching the scoped windows exist to prevent. Pinned here
    because the two would then differ only in behaviour no unit test observed.
    """
    from etl.evidence.writer import excerpt_source

    raw = json.dumps({"rows": [{"name": "Alpha"}, {"name": "Beta"}]})
    doc = _doc("https://example.test/rows.json", raw, "application/json")

    assert excerpt_source(None, doc) == raw
    assert excerpt_source(NO_EXCERPT, doc) == ""
    assert excerpt_source('{"name": "Beta"}', doc) == '{"name": "Beta"}'


def test_rsc_factory_that_cannot_be_anchored_gets_no_excerpt_not_the_whole_page():
    """Same invariant on the RSC feed, which carries ~200 factories per response.

    Worker counts and statuses like "active" are shared across factories, so a
    page-wide fallback here would be especially likely to quote the wrong one.
    """
    from etl.scrapers.rsc import _factory_to_record

    raw_page = json.dumps(
        {
            "results": [
                {"factory_id": "1", "factory_name": "Alpha Mills", "workers": 1200},
                {"factory_id": "2", "factory_name": "Beta Knitwear", "workers": 860},
            ]
        }
    )
    doc = _doc("https://rsc-bd.org/api/factories", raw_page, "application/json")

    # A factory absent from the page we hold: neither the name nor the id anchor
    # can resolve, which is the condition that used to fall through to the page.
    att = _factory_to_record(
        {"factory_id": "9", "factory_name": "Gamma Composite", "workers": 1200},
        doc,
        raw_page,
    ).evidence
    assert att is not None
    assert att.default_locator == "json:/results[factory_id=9]"
    assert att.document_text == NO_EXCERPT
    # Alpha also reports 1200 workers; that must not become Gamma's citation.
    assert make_excerpt(att.document_text, 1200, is_html=False) is None


def test_btma_row_without_a_document_still_parses():
    from etl.scrapers.btma_spinning import _Row, _row_to_record

    row = _Row.from_json("General Member", {"sl_no": "7", "mill_name": "Gamma Mills"})
    rec = _row_to_record(row)
    assert rec.evidence is None
    assert rec.source_ref == "spinning-general-member-7"


def test_local_sources_record_file_staleness():
    """A file-backed source must expose when its bytes were last staged.

    Without this the admin console cannot tell a fresh extract from an
    eighteen-month-old one, because both runs finish successfully.
    """
    import asyncio
    from pathlib import Path

    from etl.acquire.local import LocalFileAdapter, path_to_url
    from etl.acquire.models import AcquireRequest

    tmp = Path(__file__).with_name("_tmp_local_probe.json")
    tmp.write_text('{"section":"x","rows":[]}', encoding="utf-8")
    try:
        doc = asyncio.run(
            LocalFileAdapter().fetch(AcquireRequest(url=path_to_url(tmp)))
        )
        assert doc.ok
        assert doc.meta["file_mtime"]
        assert doc.meta["file_bytes"] == tmp.stat().st_size
        assert doc.content_sha256
    finally:
        tmp.unlink()


def test_missing_local_file_is_not_found_rather_than_an_error():
    """`not_found` and `error` drive different verifier behaviour."""
    import asyncio
    from pathlib import Path

    from etl.acquire.local import LocalFileAdapter, path_to_url
    from etl.acquire.models import AcquireRequest

    missing = Path(__file__).with_name("_definitely_absent.json")
    doc = asyncio.run(
        LocalFileAdapter().fetch(AcquireRequest(url=path_to_url(missing)))
    )
    assert doc.fetch_status is FetchStatus.NOT_FOUND
    assert not doc.transient_failure


# --------------------------------------------------------------- EPB shape ---
def test_epb_skips_fields_it_resolved_from_a_different_document():
    """District names come from a lookup table on the home page, not the API.

    The search response carries only foreign keys, so a district claim cited
    against it could never be excerpted — it would be permanently unverifiable
    noise in the evidence health panel.
    """
    from etl.scrapers.epb_web import _JSON_FIELDS, _UNCITABLE_FIELDS

    for key in ("epb_factory_district", "epb_office_district", "epb_office_thana"):
        assert key in _UNCITABLE_FIELDS
        assert key not in _JSON_FIELDS
    assert _JSON_FIELDS["epb_reg_no"] == "epb_reg_no"


def test_csv_reader_agreement_on_the_ofac_column_layout():
    """Pins the 12-column contract the parser indexes into positionally."""
    row = next(
        iter(
            csv.reader(
                io.StringIO(
                    '"1","ALPHA","entity","SDN","-0-","-0-","-0-","-0-","-0-",'
                    '"-0-","-0-","remark"'
                )
            )
        )
    )
    assert len(row) == 12
    assert row[1] == "ALPHA"
    assert row[11] == "remark"
