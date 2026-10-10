"""Certificate bodies re-read after a feed change (10 Oct 2026).

WRAP moved to a new feed and OEKO-TEX re-keyed its rows, so every stored raw
copy differs from a fresh read while nothing a buyer sees has moved. Both 8 Oct
runs stopped themselves at the 5% change limit after 21 and 265 records. A
record whose shown values match the stored copy is a 'refresh'; a real change
still counts.
"""
from __future__ import annotations

from etl.core import breaker as br
from etl.core.scraper import ScrapedRecord
from etl.core.upsert import classify_record
from etl.scrapers.wrap import WRAP_LIST_URL, _bangladesh_facilities, _carry_grade
from etl.tests.conftest import FakeCursor

SHOWN = ("wrap_id", "expires_on", "wrap_products")


def _rec(**payload) -> ScrapedRecord:
    return ScrapedRecord(source_code="WRAP", source_ref="wrap-7865", company_name="Aboni",
                         payload=payload, shown_keys=SHOWN)


def _stored(fields: dict) -> FakeCursor:
    return FakeCursor(skip_rows=[{"supplier_id": "s1", "raw_hash": "old", "fields": fields}])


STORED = {"wrap_id": "7865", "expires_on": "2027-08-25", "wrap_products": "Knitted Garments",
          "wrap_cert_type": "Gold", "wrap_country": "Bangladesh",
          "wrap_profile_url": "https://wrapcompliance.org/certified-facility/7865/"}


def test_format_only_difference_is_a_refresh(monkeypatch):
    monkeypatch.setattr("etl.core.upsert.get_source_id", lambda code: "src")
    rec = _rec(wrap_id="7865", expires_on="2027-08-25", wrap_products=" Knitted Garments ",
               wrap_country="BD", wrap_profile_url=WRAP_LIST_URL)
    assert classify_record(_stored(STORED), rec) == "refresh"


def test_a_shown_change_still_counts(monkeypatch):
    monkeypatch.setattr("etl.core.upsert.get_source_id", lambda code: "src")
    rec = _rec(wrap_id="7865", expires_on="2028-08-25", wrap_products="Knitted Garments")
    assert classify_record(_stored(STORED), rec) == "changed"
    # A record without shown keys keeps the old whole-payload rule.
    bare = ScrapedRecord(source_code="WRAP", source_ref="wrap-7865", company_name="Aboni",
                         payload={"wrap_id": "7865", "expires_on": "2027-08-25",
                                  "wrap_products": "Knitted Garments"})
    assert classify_record(_stored(STORED), bare) == "changed"


def test_refresh_never_trips_the_breaker():
    b = br.Breaker(stored=434)
    assert all(b.admit("refresh") for _ in range(434))
    assert b.tripped is None and b.changed == 0


def test_wrap_grade_kept_for_the_same_certificate_period():
    scope = "Industries: Apparel | Products: Knitted Garments"
    old = "Gold | Industries: Apparel | Products: Knitted Garments"
    assert _carry_grade(scope, old, "2027-08-25", "2027-08-25") == f"Gold | {scope}"
    # Renewed: the old grade is not known to hold, so it is dropped.
    assert _carry_grade(scope, old, "2027-08-25", "2028-08-25") == scope
    # "Apparel" is not a grade; a scope that has one keeps its own.
    assert _carry_grade(scope, "Apparel", "2027-08-25", "2027-08-25") == scope
    assert _carry_grade("Platinum | x", old, "2027-08-25", "2027-08-25") == "Platinum | x"


def test_wrap_link_is_not_the_dead_facility_page():
    assert "certified-facility" not in WRAP_LIST_URL


def test_wrap_reads_only_certified_rows():
    rows = _bangladesh_facilities({"facilities": [
        {"country": "BD", "wrap_id": "1", "certification_status": "certified"},
        {"country": "BD", "wrap_id": "2", "certification_status": "expired"},
        {"country": "BD", "wrap_id": "3"},
    ]})
    assert [r["wrap_id"] for r in rows] == ["1", "3"]
