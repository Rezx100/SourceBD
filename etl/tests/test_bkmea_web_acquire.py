"""BKMEA listing: the detail link must survive the transport migration.

Same bug family as the BGMEA website cell (see `test_bgmea_web_acquire.py`). The
directory renders a "View Details" anchor per member, and the two adapters hand
back that anchor's href differently: read directly it arrives exactly as authored,
while Firecrawl resolves every href against the page it came from first. So a row
whose anchor is empty or relative reads one way through one transport and another
way through the other, from identical bytes on the wire.
"""
from __future__ import annotations

from etl.scrapers.bkmea_web import BkmeaScraper

HEAD = "<table class='table'><tbody>"
TAIL = "</tbody></table>"


def row(detail_href: str) -> str:
    return (
        "<tr>"
        "<td>1</td><td>2632 - C/2026</td><td>Acme Knit Composite Ltd.</td>"
        "<td>General</td><td>Sweater</td><td>Mr. Rahim Uddin</td>"
        f"<td><a href=\"{detail_href}\">View Details</a></td>"
        "</tr>"
    )


def parse(detail_href: str) -> dict:
    rows = BkmeaScraper()._parse_table(HEAD + row(detail_href) + TAIL)
    assert len(rows) == 1
    return rows[0]


# ---- the ordinary case --------------------------------------------------

def test_an_absolute_detail_link_is_read_as_it_stands():
    parsed = parse("https://member.bkmea.com/member/details/8817")
    assert parsed["detail_id"] == "8817"
    assert parsed["detail_url"] == "https://member.bkmea.com/member/details/8817"


def test_the_membership_number_is_still_split_into_its_parts():
    parsed = parse("https://member.bkmea.com/member/details/8817")
    assert parsed["membership_int"] == "2632"
    assert parsed["membership_category"] == "C"
    assert parsed["membership_year"] == "2026"
    assert parsed["company"] == "Acme Knit Composite Ltd."
    assert parsed["owner"] == "Mr. Rahim Uddin"


# ---- the blank anchor each transport renders differently ----------------

def test_a_blank_detail_anchor_read_directly_is_no_detail_link():
    parsed = parse("")
    assert parsed["detail_id"] is None
    assert parsed["detail_url"] is None


def test_a_blank_detail_anchor_absolutised_by_firecrawl_is_still_no_link():
    """The regression: the listing's own URL must not become a member's detail URL.

    Firecrawl returns the empty href already resolved, so the cell arrives holding
    the listing page address. Stored as found, every member without a detail page
    would carry a "detail link" that leads back to the directory it was read from —
    a citation that shows an operator a table of two thousand rows instead of the
    member whose data it is meant to substantiate.
    """
    parsed = parse("https://member.bkmea.com/member-home?page=1")
    assert parsed["detail_id"] is None
    assert parsed["detail_url"] is None


def test_the_row_is_still_emitted_without_a_detail_link():
    """Losing the link must not lose the member.

    The key falls back to the membership number precisely so that a row with no
    detail page is still ingested rather than dropped.
    """
    parsed = parse("")
    assert parsed["key"] == "2632 - C/2026"
    assert parsed["company"] == "Acme Knit Composite Ltd."


# ---- relative against absolute -----------------------------------------

def test_a_relative_href_yields_the_same_url_as_an_absolute_one():
    """One spelling per member, whichever transport read the page.

    Nothing downstream would error on the two spellings — `bkmea_detail` keys off
    the id — but the URL is stored in the payload and cited, so two spellings mean
    one member accruing two provenance identities and a transport switch silently
    rewriting the stored link on rows that never changed.
    """
    relative = parse("/member/details/8817")
    absolute = parse("https://member.bkmea.com/member/details/8817")
    assert relative["detail_url"] == absolute["detail_url"]


def test_an_unrelated_link_in_the_last_cell_is_not_taken_for_a_detail_link():
    parsed = parse("https://member.bkmea.com/contact-us")
    assert parsed["detail_id"] is None
    assert parsed["detail_url"] is None


# ---- the emitted record ------------------------------------------------

def test_the_record_carries_the_derived_url_not_the_href():
    scraper = BkmeaScraper()
    parsed = parse("https://member.bkmea.com/member-home?page=1")
    rec = scraper._to_record(parsed)
    assert rec.payload["bkmea_detail_url"] is None
    assert rec.payload["bkmea_detail_id"] is None
    # source_ref falls back to the membership integer, so the row is still keyed.
    assert rec.source_ref == "2632"
