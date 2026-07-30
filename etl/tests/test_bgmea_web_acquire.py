"""BGMEA pilot: parsing must be unchanged by the transport migration, and the
emitted record must carry a checkable citation.

The parsers are fed HTML directly (as both adapters deliver it), so these tests
pin the behaviour that `compare-parity` will later confirm against the live site.
"""
from __future__ import annotations

import pytest

from etl.acquire.models import AcquiredDoc, Adapter, FetchStatus
from etl.evidence.locate import excerpt_contains, make_excerpt
from etl.evidence.writer import _locator_for
from etl.scrapers.bgmea_web import BgmeaWebScraper

LIST_HTML = """
<table><tbody>
  <tr>
    <td>Acme Apparels Ltd.</td><td>3421</td><td>Mr. Rahim Uddin</td>
    <td>info@acme-bd.test</td><td><a href="/member/8817">View</a></td>
  </tr>
  <tr>
    <td>Beta Knitwear Ltd.</td><td>5590</td><td>Ms. Fatima Noor</td>
    <td>contact@beta-bd.test</td><td><a href="/member/9902">View</a></td>
  </tr>
</tbody></table>
"""

DETAIL_HTML = """
<div id="company_info">
  <table><tbody>
    <tr><th>BGMEA Reg. No.</th><td>3421</td></tr>
    <tr><th>EPB Reg No.</th><td>EPB-77120</td></tr>
    <tr><th>Director Informaiton</th><td>
      <table><tr><th>Name</th><th>Designation</th></tr>
      <tbody><tr><td>Rahim Uddin</td><td>Managing Director</td></tr></tbody></table>
    </td></tr>
  </tbody></table>
</div>
<div id="address_info">
  <table><tbody>
    <tr><th>Contact Person</th><td><strong>Name:</strong> Rahim Uddin</td></tr>
    <tr><th></th><td><strong>Designation:</strong> Managing Director<br>
       <strong>Phone:</strong> +8801711000111<br>
       <strong>Email:</strong> rahim@acme-bd.test</td></tr>
    <tr><th>Mailling Address</th><td>House 12, Road 5, Banani, Dhaka-1213</td></tr>
    <tr><th>Phone</th><td>+8802988000</td></tr>
    <tr><th>Email</th><td>office@acme-bd.test</td></tr>
    <tr><th>Factory Address</th><td>Plot 44, Konabari, Gazipur-1704</td></tr>
    <tr><th>Phone</th><td>+8802977111</td></tr>
    <tr><th>Email</th><td>factory@acme-bd.test</td></tr>
  </tbody></table>
</div>
<div id="final_info">
  <table><tbody>
    <tr><th>Website</th><td><a href="https://acme-bd.test">acme-bd.test</a></td></tr>
    <tr><th>Date of Establishment</th><td>1998-04-12</td></tr>
    <tr><th>No of Machines</th><td>1,240</td></tr>
    <tr><th>No. of Employees</th><td>
      <table><tr><th>Male</th><th>Female</th></tr>
      <tbody><tr><td>820</td><td>1640</td></tr></tbody></table>
    </td></tr>
    <tr><th>Principal Exportable Product</th><td>T-Shirt, Polo Shirt</td></tr>
  </tbody></table>
</div>
"""


def doc(html: str, url: str) -> AcquiredDoc:
    return AcquiredDoc(
        url=url,
        adapter=Adapter.FIRECRAWL,
        fetch_status=FetchStatus.OK,
        final_url=url,
        http_status=200,
        raw_html=html,
        credits_used=1,
    )


@pytest.fixture
def scraper() -> BgmeaWebScraper:
    return BgmeaWebScraper(max_pages=1)


# ---- parsing ------------------------------------------------------------

def test_list_parse_extracts_all_rows(scraper):
    rows = scraper._parse_list(LIST_HTML)
    assert len(rows) == 2
    assert rows[0] == {
        "member_id": "8817",
        "company_name": "Acme Apparels Ltd.",
        "bgmea_reg_number": "3421",
        "contact_person": "Mr. Rahim Uddin",
        "email": "info@acme-bd.test",
    }


def test_detail_parse_reads_all_three_tabs(scraper):
    d = scraper._parse_detail(DETAIL_HTML)
    assert d["bgmea_reg_number"] == "3421"
    assert d["epb_reg_no"] == "EPB-77120"
    assert d["factory_address"] == "Plot 44, Konabari, Gazipur-1704"
    assert d["mailing_address"] == "House 12, Road 5, Banani, Dhaka-1213"
    assert d["factory_email"] == "factory@acme-bd.test"
    assert d["website"] == "https://acme-bd.test"
    assert d["num_machines"] == 1240
    assert d["employees"] == {"Male": "820", "Female": "1640"}
    assert d["principal_products"] == ["T-Shirt", "Polo Shirt"]
    assert d["directors"] == [{"Name": "Rahim Uddin", "Designation": "Managing Director"}]


def test_record_prefers_factory_over_mailing(scraper):
    rows = scraper._parse_list(LIST_HTML)
    detail = scraper._parse_detail(DETAIL_HTML)
    rec = scraper._to_record(rows[0], detail)
    assert rec.address_raw == "Plot 44, Konabari, Gazipur-1704"
    assert rec.phone_raw == "+8802977111"
    assert rec.email == "factory@acme-bd.test"
    assert rec.city == "Gazipur"
    assert rec.entity_type == "factory"
    assert rec.source_ref == "general:3421"


def test_record_without_detail_still_emits_from_list(scraper):
    rows = scraper._parse_list(LIST_HTML)
    rec = scraper._to_record(rows[0], {})
    assert rec.company_name == "Acme Apparels Ltd."
    assert rec.email == "info@acme-bd.test"
    assert rec.source_ref == "general:3421"


# ---- website: the blank cell each transport renders differently ---------

# BGMEA renders "no website" as an empty anchor. Read directly the href is the
# empty string; Firecrawl resolves hrefs against the page before returning the
# HTML, so the identical cell arrives as the member's own profile URL. Both must
# produce no website. Caught by `compare-parity bgmea_web` against the live site.
BLANK_WEBSITE_DIRECT = """
<div id="final_info"><table><tbody>
  <tr><th>Website</th><td><a href=""></a></td></tr>
</tbody></table></div>
"""

BLANK_WEBSITE_FIRECRAWL = """
<div id="final_info"><table><tbody>
  <tr><th>Website</th><td><a href="https://www.bgmea.com.bd/member/8817"></a></td></tr>
</tbody></table></div>
"""


def test_blank_website_read_directly_is_no_website(scraper):
    rows = scraper._parse_list(LIST_HTML)
    detail = scraper._parse_detail(BLANK_WEBSITE_DIRECT)
    detail_doc = doc(BLANK_WEBSITE_DIRECT, "https://www.bgmea.com.bd/member/8817")
    rec = scraper._to_record(rows[0], detail, detail_doc, None)
    assert rec.website is None


def test_blank_website_absolutised_by_firecrawl_is_still_no_website(scraper):
    """The regression: a self-referential URL must not become the factory's site.

    It passes a bare `startswith("https://")` check, so without a host screen it
    would put a bgmea.com.bd link on the supplier profile as the company's own.
    """
    rows = scraper._parse_list(LIST_HTML)
    detail = scraper._parse_detail(BLANK_WEBSITE_FIRECRAWL)
    detail_doc = doc(BLANK_WEBSITE_FIRECRAWL, "https://www.bgmea.com.bd/member/8817")
    rec = scraper._to_record(rows[0], detail, detail_doc, None)
    assert rec.website is None


def test_a_real_external_website_is_still_kept(scraper):
    """The screen must not be so broad that it discards genuine websites."""
    rows = scraper._parse_list(LIST_HTML)
    detail = scraper._parse_detail(DETAIL_HTML)
    detail_doc = doc(DETAIL_HTML, "https://www.bgmea.com.bd/member/8817")
    rec = scraper._to_record(rows[0], detail, detail_doc, None)
    assert rec.website == "https://acme-bd.test"


# ---- evidence attachment ------------------------------------------------

def test_evidence_cites_the_detail_page(scraper):
    rows = scraper._parse_list(LIST_HTML)
    detail = scraper._parse_detail(DETAIL_HTML)
    detail_doc = doc(DETAIL_HTML, "https://www.bgmea.com.bd/member/8817")
    list_doc = doc(LIST_HTML, "https://www.bgmea.com.bd/page/member-list?page=1")

    rec = scraper._to_record(rows[0], detail, detail_doc, list_doc)
    assert rec.evidence is not None
    assert rec.evidence.doc.citable_url == "https://www.bgmea.com.bd/member/8817"


def test_evidence_falls_back_to_list_page_when_detail_failed(scraper):
    rows = scraper._parse_list(LIST_HTML)
    dead_detail = AcquiredDoc(
        url="https://www.bgmea.com.bd/member/8817",
        adapter=Adapter.FIRECRAWL,
        fetch_status=FetchStatus.NOT_FOUND,
        http_status=404,
    )
    list_doc = doc(LIST_HTML, "https://www.bgmea.com.bd/page/member-list?page=1")
    rec = scraper._to_record(rows[0], {}, dead_detail, list_doc)
    assert rec.evidence is not None
    assert rec.evidence.doc.citable_url.endswith("member-list?page=1")
    assert rec.evidence.default_locator == "member-list table row"


def test_no_evidence_when_both_documents_failed(scraper):
    rows = scraper._parse_list(LIST_HTML)
    bad = AcquiredDoc(url="u", adapter=Adapter.FIRECRAWL, fetch_status=FetchStatus.TIMEOUT)
    rec = scraper._to_record(rows[0], {}, bad, bad)
    assert rec.evidence is None


def test_derived_field_is_not_cited(scraper):
    # bgmea_member_type is our classification, not something BGMEA states.
    rows = scraper._parse_list(LIST_HTML)
    detail = scraper._parse_detail(DETAIL_HTML)
    detail_doc = doc(DETAIL_HTML, "https://www.bgmea.com.bd/member/8817")
    rec = scraper._to_record(rows[0], detail, detail_doc, None)
    assert "bgmea_member_type" in rec.payload
    assert "bgmea_member_type" in rec.evidence.skip_keys


def test_cited_values_are_findable_and_verifiable(scraper):
    """Every scalar claim must produce an excerpt that re-verifies.

    This is the end-to-end provenance guarantee for the pilot: if a value cannot
    be located in the source document, the citation would be unverifiable.
    """
    rows = scraper._parse_list(LIST_HTML)
    detail = scraper._parse_detail(DETAIL_HTML)
    detail_doc = doc(DETAIL_HTML, "https://www.bgmea.com.bd/member/8817")
    rec = scraper._to_record(rows[0], detail, detail_doc, None)

    checked = 0
    for key in ("bgmea_reg_number", "epb_reg_no", "factory_address",
                "mailing_address", "factory_email", "num_machines"):
        value = rec.payload[key]
        excerpt = make_excerpt(detail_doc.text(), value)
        assert excerpt is not None, f"{key}={value!r} not locatable in source"
        assert excerpt_contains(excerpt, detail_doc.text(), value=value) is True
        checked += 1
    assert checked == 6


def test_employee_subfields_resolve_via_wildcard_locator(scraper):
    locators = scraper._evidence_for(
        doc(DETAIL_HTML, "https://www.bgmea.com.bd/member/8817"), None
    ).locators
    resolved = _locator_for("employees.Male", locators, "fallback")
    assert "No. of Employees" in resolved
    assert _locator_for("bgmea_reg_number", locators, "fallback").startswith("#company_info")
    assert _locator_for("unknown_field", locators, "fallback") == "fallback"


def test_list_url_is_identical_across_transports():
    a = BgmeaWebScraper(transport="direct")._list_url(3)
    b = BgmeaWebScraper(transport="firecrawl")._list_url(3)
    assert a == b == "https://www.bgmea.com.bd/page/member-list?page=3"
