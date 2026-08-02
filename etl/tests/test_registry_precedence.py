"""Registry-column precedence + one canonical citation per provider.

Founder rule, 3 Aug 2026: the provider's current page is the truth and must
show without a review round-trip. What this pins:

- `suppliers.bkmea_reg_number` was `coalesce(existing, new)` — first-writer-
  wins — so suppliers displayed frozen membership numbers that matched neither
  the current list nor the current detail page (KHADIZA showed 642 - B/2008
  while BKMEA said 503 - C/2000 on both). The member's detail page is now
  canonical: its latest scrape OVERWRITES the column; the directory list only
  fills a NULL.
- A blank/malformed membership ("- C/2009" from a half-rendered page) is not
  a fact: the detail parser drops it, and the upsert never lets it touch the
  column.
- The list stops CLAIMING the fields the detail page owns when a detail page
  exists, so a list-vs-page disagreement can never become a review item.
"""
from __future__ import annotations

from etl.acquire import AcquiredDoc, Adapter, FetchStatus
from etl.core.scraper import ScrapedRecord
from etl.core.upsert import upsert_supplier_with_source
from etl.scrapers.bkmea_detail import BkmeaDetailScraper
from etl.scrapers.bkmea_web import BkmeaScraper, _UNCITABLE_FIELDS
from etl.tests.conftest import FakeCursor

# ---------------------------------------------------------------------------
# Column precedence through the upsert path
# ---------------------------------------------------------------------------


def _bkmea_record(**over) -> ScrapedRecord:
    base = dict(
        source_code="BKMEA",
        source_ref="2842:detail",
        company_name="Acme Knit Composite Ltd.",
        payload={"bkmea_reg_number": "2638 - C/2026"},
        canonical_registry=True,
    )
    base.update(over)
    return ScrapedRecord(**base)


def _reg_updates(cur: FakeCursor):
    return [(sql, params) for sql, params in cur.executed
            if "bkmea_reg_number" in sql]


def test_canonical_detail_record_overwrites_the_column(patched_db) -> None:
    cur = FakeCursor()
    patched_db(cur)
    upsert_supplier_with_source(_bkmea_record())
    updates = _reg_updates(cur)
    assert len(updates) == 1
    sql, params = updates[0]
    assert "bkmea_reg_number = %s" in sql
    assert "coalesce(bkmea_reg_number" not in sql
    assert params[0] == "2638 - C/2026"


def test_list_record_only_fills_a_null_column(patched_db) -> None:
    cur = FakeCursor()
    patched_db(cur)
    upsert_supplier_with_source(_bkmea_record(
        source_ref="2638", canonical_registry=False,
    ))
    updates = _reg_updates(cur)
    assert len(updates) == 1
    sql, params = updates[0]
    assert "coalesce(bkmea_reg_number, %s)" in sql
    assert params[0] == "2638 - C/2026"


def test_a_blank_membership_never_overwrites_even_when_canonical(patched_db) -> None:
    cur = FakeCursor()
    patched_db(cur)
    upsert_supplier_with_source(_bkmea_record(
        payload={"bkmea_reg_number": "- C/2009"},
    ))
    updates = _reg_updates(cur)
    assert len(updates) == 1
    sql, params = updates[0]
    # Falls back to the fill-only branch with None: a no-op that can neither
    # overwrite a real value nor fill a NULL with junk.
    assert "coalesce(bkmea_reg_number, %s)" in sql
    assert params[0] is None


# ---------------------------------------------------------------------------
# The list stops claiming what the detail page owns
# ---------------------------------------------------------------------------

_HEAD = "<table class='table'><tbody>"
_TAIL = "</tbody></table>"


def _list_row(detail_href: str) -> dict:
    html = (
        _HEAD
        + "<tr>"
          "<td>1</td><td>2632 - C/2026</td><td>Acme Knit Composite Ltd.</td>"
          "<td>General</td><td>Sweater</td><td>Mr. Rahim Uddin</td>"
          f"<td><a href=\"{detail_href}\">View Details</a></td>"
          "</tr>"
        + _TAIL
    )
    rows = BkmeaScraper()._parse_table(html)
    assert len(rows) == 1
    return rows[0]


def _doc() -> AcquiredDoc:
    return AcquiredDoc(
        url="https://member.bkmea.com/member-home?page=1",
        adapter=Adapter.FIRECRAWL,
        fetch_status=FetchStatus.OK,
        raw_html="<html></html>",
    )


def test_list_record_stops_claiming_detail_owned_fields_when_a_detail_page_exists() -> None:
    rec = BkmeaScraper()._to_record(
        _list_row("https://member.bkmea.com/member/details/2842"), _doc()
    )
    assert rec.evidence is not None
    skip = set(rec.evidence.skip_keys)
    assert {"bkmea_membership_no", "bkmea_reg_number", "bkmea_category"} <= skip
    # List-only facts keep their citations.
    assert "bkmea_member_type" not in skip
    assert "bkmea_detail_url" not in skip
    # The values still land in the payload — the gate and the rekey read fields.
    assert rec.payload["bkmea_membership_no"] == "2632 - C/2026"


def test_list_record_keeps_membership_claims_when_no_detail_page() -> None:
    rec = BkmeaScraper()._to_record(_list_row(""), _doc())
    assert rec.evidence is not None
    assert set(rec.evidence.skip_keys) == set(_UNCITABLE_FIELDS)


# ---------------------------------------------------------------------------
# The detail parser drops a blank membership
# ---------------------------------------------------------------------------

_DETAIL_HTML = """
<div class="tbrow"><table class="table"><tbody>
  <tr><td>BKMEA Membership No.</td><td></td><td>{membership}</td></tr>
  <tr><td>Factory Name</td><td></td><td>KNIT FASHION</td></tr>
  <tr><td>Factory Address</td><td></td><td>Plot 1, Dhaka</td></tr>
</tbody></table></div>
"""


def _parse(membership: str) -> ScrapedRecord:
    rec = BkmeaDetailScraper()._parse_detail(
        _DETAIL_HTML.format(membership=membership),
        list_ref="511", fallback_name="KNIT FASHION", detail_id="511",
        url="https://member.bkmea.com/member/details/511",
    )
    assert rec is not None
    return rec


def test_detail_parser_drops_a_blank_membership() -> None:
    rec = _parse("- C/2009")
    assert "bkmea_reg_number" not in rec.payload
    assert "bkmea_membership_no" not in rec.payload


def test_detail_parser_keeps_a_real_membership_and_marks_it_canonical() -> None:
    rec = _parse("511 - B/2000")
    assert rec.payload["bkmea_reg_number"] == "511 - B/2000"
    assert rec.payload["bkmea_membership_no"] == "511 - B/2000"
    assert rec.canonical_registry is True
