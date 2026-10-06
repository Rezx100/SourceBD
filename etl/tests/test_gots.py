"""Unit tests for `etl.scrapers.gots` — pure helpers, no network, no DB."""
from __future__ import annotations

from datetime import date

from etl.scrapers.gots import (
    _absolute_scope_ref,
    _certificate_no,
    _compose_address,
    _compose_scope,
    _parse_expires,
    _public_page,
    _write_certification,
)
from etl.core.scraper import ScrapedRecord


def test_parse_expires_iso_date():
    assert _parse_expires("2027-03-27") == date(2027, 3, 27)


def test_parse_expires_none_or_malformed_returns_none():
    assert _parse_expires(None) is None
    assert _parse_expires("") is None
    assert _parse_expires("27/03/2027") is None
    assert _parse_expires("2027-13-99") is None


def test_compose_address_drops_blank_parts():
    detail = {"address1": "Sukran, Mirzanagar, Ashulia, Savar", "address2": " ", "address3": ""}
    assert _compose_address(detail) == "Sukran, Mirzanagar, Ashulia, Savar"


def test_compose_address_joins_multiple():
    detail = {"address1": "Plot 12", "address2": "Block A", "address3": "Sector 7"}
    assert _compose_address(detail) == "Plot 12 | Block A | Sector 7"


def test_compose_address_all_blank_returns_none():
    assert _compose_address({"address1": " ", "address2": "", "address3": None}) is None


def test_compose_scope_operations_and_products():
    detail = {
        "field_of_operation": "Dyeing, Finishing",
        "product_category": "Dyed fabrics, Greige fabrics",
    }
    assert (
        _compose_scope(detail)
        == "Operations: Dyeing, Finishing | Products: Dyed fabrics, Greige fabrics"
    )


def test_compose_scope_partial():
    assert _compose_scope({"field_of_operation": "Weaving", "product_category": None}) == "Operations: Weaving"
    assert _compose_scope({"field_of_operation": None, "product_category": "Yarns"}) == "Products: Yarns"
    assert _compose_scope({"field_of_operation": None, "product_category": None}) is None


def test_certificate_no_uses_license_when_present():
    detail = {"gtb_license_number": "GOTS-23594", "system_id": "SCO021512"}
    assert _certificate_no(detail) == "GOTS-23594"


def test_certificate_no_falls_back_to_system_id():
    detail = {"gtb_license_number": None, "system_id": "SCO021512"}
    assert _certificate_no(detail) == "gots-SCO021512"
    detail2 = {"gtb_license_number": "  ", "system_id": "SCO021512"}
    assert _certificate_no(detail2) == "gots-SCO021512"


def test_absolute_scope_ref_passthrough_https():
    assert _absolute_scope_ref("https://example.org/cert.pdf") == "https://example.org/cert.pdf"


def test_absolute_scope_ref_prepends_host_for_relative_path():
    assert (
        _absolute_scope_ref("/SCO021512/certificate-document")
        == "https://www.global-trace-base.org/SCO021512/certificate-document"
    )


def test_absolute_scope_ref_none_or_blank():
    assert _absolute_scope_ref(None) is None
    assert _absolute_scope_ref("") is None
    assert _absolute_scope_ref("   ") is None


def test_public_page_is_the_gots_directory_entry():
    assert _public_page("SCO001636") == (
        "https://global-standards.org/suppliers/certified-suppliers/details?gtbid=SCO001636"
    )


def test_write_certification_stores_the_public_page_not_the_login_walled_document(monkeypatch):
    """The GTB certificate-document link ends at a login page (6 Oct 2026)."""
    import etl.scrapers.gots as gots

    sent: list[tuple] = []

    class _Cur:
        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

        def execute(self, sql, params):
            sent.append(params)

        def fetchone(self):
            return None

    class _Conn(_Cur):
        def cursor(self):
            return _Cur()

        def commit(self):
            pass

    class _Db:
        def conn(self):
            return _Conn()

    monkeypatch.setattr(gots, "db", _Db())
    monkeypatch.setattr(gots, "get_source_id", lambda code: "src")
    rec = ScrapedRecord(
        source_code="GOTS", source_ref="gots-SCO001636", company_name="4A Yarn Dyeing Ltd",
        payload={
            "gots_system_id": "SCO001636", "gots_license_number": "GOTS-11426",
            "certificate_valid_until": "2027-02-05",
            "gots_scope_certificate_url": "https://www.global-trace-base.org/SCO001636/certificate-document",
        },
    )
    _write_certification("sup", rec)
    assert sent[-1][-1] == _public_page("SCO001636")