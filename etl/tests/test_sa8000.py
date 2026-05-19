"""Unit tests for `etl.scrapers.sa8000` — pure helpers, no network, no DB."""
from __future__ import annotations

from datetime import date

from etl.scrapers.sa8000 import (
    _certificate_no_slug,
    _extract_city,
    _parse_expires,
    _parse_list_rows,
    _parse_popup_html,
)


def test_parse_expires_iso_date():
    assert _parse_expires("2026-07-08") == date(2026, 7, 8)


def test_parse_expires_none_or_malformed_returns_none():
    assert _parse_expires(None) is None
    assert _parse_expires("") is None
    assert _parse_expires("08/07/2026") is None
    assert _parse_expires("2026-13-99") is None


def test_certificate_no_slug_basic():
    assert _certificate_no_slug("IND.23.15506/SA/S") == "ind-23-15506-sa-s"
    assert _certificate_no_slug("IND.20.11414/SA/S") == "ind-20-11414-sa-s"
    assert _certificate_no_slug("IND.18.10562") == "ind-18-10562"


def test_certificate_no_slug_unknown_when_empty():
    assert _certificate_no_slug("") == "unknown"
    assert _certificate_no_slug("///") == "unknown"


def test_extract_city_standard():
    addr = "Jamirdia,Bhaluka,Mymensingh, Mymensingh, N/A, 2240, Bangladesh"
    assert _extract_city(addr) == "Mymensingh"


def test_extract_city_dhaka_with_postcode():
    addr = "10th floor, Navana DH Tower 6 Panthapath, 6 Panthapath, Dhaka, 1215, Bangladesh"
    assert _extract_city(addr) == "Dhaka"


def test_extract_city_split_factory_address():
    addr = "Head Office: H # 340, Lane # 05, DOHS Baridhara, Dhaka-1206,Bangladesh, Factory: Bashil, Hazirbazar,, Mymensingh, 2240, Bangladesh"
    assert _extract_city(addr) == "Mymensingh"


def test_extract_city_none_when_blank():
    assert _extract_city(None) is None
    assert _extract_city("") is None
    assert _extract_city(",,,") is None


_LIST_FIXTURE = """
<table class="ui-sortable-table">
  <thead><tr><th>Org</th><th>CB</th><th>Cert</th><th>Status</th><th>Industry</th><th>Workers</th><th></th></tr></thead>
  <tbody>
    <tr class="pages page-1 display">
      <td>Dutch-Bangla Pack Ltd.</td>
      <td>Bureau Veritas Certification</td>
      <td>IND.23.15506/SA/S</td>
      <td>Certified</td>
      <td>Consumer Goods: (A5) Household &amp; Personal Products</td>
      <td>1095</td>
      <td><a href="" class="ab-button ab-button-shape-rounded" data-pop="4321">More Info</a></td>
    </tr>
    <tr class="pages page-1 display">
      <td>No Pop Row</td><td>CB</td><td>X.Y/SA/S</td><td>Certified</td><td>Industry</td><td>1</td>
      <td><span>No anchor</span></td>
    </tr>
  </tbody>
</table>
"""


def test_parse_list_rows_keeps_anchor_rows_and_skips_pop_less():
    rows = _parse_list_rows(_LIST_FIXTURE)
    assert len(rows) == 1
    r = rows[0]
    assert r["organisation"] == "Dutch-Bangla Pack Ltd."
    assert r["certification_body"] == "Bureau Veritas Certification"
    assert r["certificate_id"] == "IND.23.15506/SA/S"
    assert r["status"] == "Certified"
    assert r["industry"].startswith("Consumer Goods")
    assert r["workers"] == "1095"
    assert r["data_pop"] == "4321"


_POPUP_FIXTURE = (
    "<ul>"
    "<li><b>Certified Organization:</b> Dutch-Bangla Pack Ltd.</li>"
    "<li><b>Certification Body:</b> Bureau Veritas Certification</li>"
    "<li><b>Certificate ID number:</b> IND.23.15506/SA/S</li>"
    "<li><b>Certification Status:</b> Certified</li>"
    "<li><b>Industry:</b> Consumer Goods: (A5) Household &amp; Personal Products</li>"
    "<li><b>Address:</b> 10th floor, Navana DH Tower 6 Panthapath, 6 Panthapath, Dhaka, 1215, Bangladesh</li>"
    "<li><b>Initial Certification Date:</b> 2020-07-10</li>"
    "<li><b>Latest Certification Date:</b> 2023-07-09</li>"
    "<li><b>Expiration Date:</b> 2026-07-08</li>"
    "</ul>"
    "<p><b>Description of Operations:</b> Manufacturing and marketing of pharma clean flexible intermediate bulk containers.</p>"
)


def test_parse_popup_html_full():
    d = _parse_popup_html(_POPUP_FIXTURE)
    assert d["organisation"] == "Dutch-Bangla Pack Ltd."
    assert d["certification_body"] == "Bureau Veritas Certification"
    assert d["certificate_id"] == "IND.23.15506/SA/S"
    assert d["status"] == "Certified"
    assert d["industry"].startswith("Consumer Goods")
    assert d["address"].startswith("10th floor")
    assert d["initial_certification_date"] == "2020-07-10"
    assert d["latest_certification_date"] == "2023-07-09"
    assert d["expiration_date"] == "2026-07-08"
    assert "withdrawal_date" not in d
    assert d["description_of_operations"].startswith("Manufacturing")


_POPUP_WITHDRAWN = (
    "<ul>"
    "<li><b>Certified Organization:</b> Lenny Apparels Limited</li>"
    "<li><b>Certification Body:</b> Bureau Veritas Certification</li>"
    "<li><b>Certificate ID number:</b> IND.20.11414/SA/S</li>"
    "<li><b>Certification Status:</b> Withdrawn/cancelled</li>"
    "<li><b>Industry:</b> Consumer Goods: (A1) Apparel, Accessories &amp; Footwear</li>"
    "<li><b>Address:</b> 54-56, Dhaka Export Processing Zone, Dhaka, 1349, Bangladesh</li>"
    "<li><b>Initial Certification Date:</b> 2020-02-20</li>"
    "<li><b>Latest Certification Date:</b> 2020-02-20</li>"
    "<li><b>Expiration Date:</b> 2023-02-19</li>"
    "<li><b>Withdrawal Date:</b> 2021-06-11</li>"
    "</ul>"
    "<p><b>Description of Operations:</b> Manufacturing and export of garments Items</p>"
)


def test_parse_popup_html_withdrawn_includes_withdrawal_date():
    d = _parse_popup_html(_POPUP_WITHDRAWN)
    assert d["status"] == "Withdrawn/cancelled"
    assert d["withdrawal_date"] == "2021-06-11"
