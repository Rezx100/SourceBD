"""Unit tests for `etl.scrapers.btma_spinning` — pure helpers, no network, no DB."""
from __future__ import annotations

from pathlib import Path

from etl.scrapers.btma_spinning import (
    _btma_status,
    _detect_district,
    _iter_rows,
    _parse_contact,
    _row_to_record,
    _slugify_section,
    _split_email_and_website,
)

_FIXTURES = Path(__file__).parent / "fixtures" / "btma"


def test_slugify_section_general_member():
    assert _slugify_section("General Member") == "general-member"


def test_slugify_section_suspension_implementation():
    assert _slugify_section("Suspension / Implementation") == "suspension-implementation"


def test_slugify_section_empty_falls_back():
    assert _slugify_section("") == "unknown"


def test_parse_contact_plain_name():
    assert _parse_contact("Md. Mukhlesur Rahman") == ("Md. Mukhlesur Rahman", None)


def test_parse_contact_paren_role():
    assert _parse_contact("Solaiman Ahmed (MD)") == ("Solaiman Ahmed", "MD")


def test_parse_contact_suffix_role():
    assert _parse_contact("Md. Abul Kalam, MD") == ("Md. Abul Kalam", "MD")


def test_parse_contact_first_of_semicolon_list():
    name, role = _parse_contact("Shadratul Muntaha (MD); Tariqul Islam")
    assert name == "Shadratul Muntaha"
    assert role == "MD"


def test_parse_contact_empty():
    assert _parse_contact("") == (None, None)


def test_split_email_and_website_both_present():
    email, website = _split_email_and_website("masud@nrggroup-bd.com; www.nrggroup.com")
    assert email == "masud@nrggroup-bd.com"
    assert website == "https://www.nrggroup.com"


def test_split_email_only_email():
    email, website = _split_email_and_website("kalam@chaity.com")
    assert email == "kalam@chaity.com"
    assert website is None


def test_split_email_multiple_takes_first():
    email, website = _split_email_and_website("a@x.com; b@y.com")
    assert email == "a@x.com"
    assert website is None


def test_split_email_blank():
    assert _split_email_and_website("") == (None, None)


def test_btma_status_suspended_under_suspension():
    assert _btma_status("Mills Under Suspension") == "suspended"


def test_btma_status_suspended_implementation():
    assert _btma_status("Mills Under Suspension / Mills Under Implementation") == "suspended"


def test_btma_status_none_for_active_sections():
    assert _btma_status("General Member") is None
    assert _btma_status("Associate Member - A Spinning (Yarn Manufacturer)") is None


def test_detect_district_simple():
    city, district = _detect_district("Nagar Howla, Sreepur, Gazipur.")
    assert city == "Gazipur"
    assert district == "Gazipur"


def test_detect_district_canonicalises_narayangonj():
    city, district = _detect_district("Chotto, Shilmondi, Sonargaon, Narayangonj, Sonargaon-1440.")
    assert city == "Narayanganj"
    assert district == "Narayanganj"


def test_detect_district_unknown_returns_none():
    assert _detect_district("Some Place, Nowhere.") == (None, None)


def test_detect_district_blank():
    assert _detect_district("") == (None, None)


def test_iter_rows_and_records_from_fixture():
    rows = list(_iter_rows(_FIXTURES))
    assert len(rows) == 3
    recs = [_row_to_record(r) for r in rows]
    assert [r.source_ref for r in recs] == [
        "spinning-general-member-1",
        "spinning-general-member-4",
        "spinning-general-member-12",
    ]
    # First row: structured addresses + email/website split
    r0 = recs[0]
    assert r0.source_code == "BTMA"
    assert r0.company_name == "A.T & T Spinning Mills Ltd."
    assert r0.email == "masud@nrggroup-bd.com"
    assert r0.website == "https://www.nrggroup.com"
    assert r0.city == "Mymensingh"
    assert r0.payload["factory_address"] == "Jamairdia Masterbari, Valuka, Mymensingh."
    assert r0.payload["mailing_address"].startswith("60 (Old)")
    assert r0.payload["btma_section"] == "General Member"
    assert r0.payload["btma_sl_no"] == "1"
    assert "btma_status" not in r0.payload
    # Second row: parenthetical role + audit note + suspension absent
    r1 = recs[1]
    assert r1.contact_name == "Solaiman Ahmed"
    assert r1.contact_role == "MD"
    assert r1.payload["btma_notes"].startswith("Source printed")
    # Third row: comma-suffix role + multi-contact preserved + Narayanganj canon
    r2 = recs[2]
    assert r2.contact_name == "Md. Abul Kalam"
    assert r2.contact_role == "MD"
    assert r2.city == "Narayanganj"
    assert "raw_contact_person" in r2.payload


def test_source_ref_stable():
    rows = list(_iter_rows(_FIXTURES))
    refs_a = [_row_to_record(r).source_ref for r in rows]
    refs_b = [_row_to_record(r).source_ref for r in rows]
    assert refs_a == refs_b


def test_record_hash_deterministic():
    rows = list(_iter_rows(_FIXTURES))
    h1 = [_row_to_record(r).hash() for r in rows]
    h2 = [_row_to_record(r).hash() for r in rows]
    assert h1 == h2
