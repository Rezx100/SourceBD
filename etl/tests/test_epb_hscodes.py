"""HS-code parser pins for the EPB exporter detail page."""

from __future__ import annotations

from pathlib import Path

from etl.scrapers.epb_web import parse_epb_hscodes, epb_registry_open_url

FIXTURE = Path(__file__).resolve().parent / "fixtures" / "epb_exporter_detail.html"


def test_parse_epb_hscodes_uses_badge_text_and_keeps_live_list_href() -> None:
    """Live EPB (Interstoff 2043): href /hscode-exporters/813, badge 6103."""
    html = FIXTURE.read_text(encoding="utf-8")
    rows = parse_epb_hscodes(html)
    assert [r["code"] for r in rows] == ["6103", "6104", "6112", "6114"]
    assert [r["source_url"] for r in rows] == [
        "https://edb.epb.gov.bd/hscode-exporters/813",
        "https://edb.epb.gov.bd/hscode-exporters/814",
        "https://edb.epb.gov.bd/hscode-exporters/776",
        "https://edb.epb.gov.bd/hscode-exporters/778",
    ]
    assert "Men's or boys' suits" in rows[0]["description"]
    assert "6203" not in {r["code"] for r in rows}
    assert "https://edb.epb.gov.bd/hscode-exporters/6103" not in {
        r["source_url"] for r in rows
    }


def test_parse_live_interstoff_snippet_does_not_require_href_equals_code() -> None:
    html = (
        '<a href="https://edb.epb.gov.bd/hscode-exporters/813">6103 </a>'
        '<div class="col-10">Men&#039;s or boys\' suits, ensembles, etc, '
        "knitted or crocheted</div>"
    )
    rows = parse_epb_hscodes(html)
    assert rows == [
        {
            "code": "6103",
            "source_url": "https://edb.epb.gov.bd/hscode-exporters/813",
            "description": "Men's or boys' suits, ensembles, etc, knitted or crocheted",
        }
    ]


def test_parse_epb_hscodes_empty_and_search_json() -> None:
    assert parse_epb_hscodes(None) == []
    assert parse_epb_hscodes("") == []
    assert parse_epb_hscodes('{"exporters":[{"id":2043,"name":"Interstoff"}]}') == []


def test_epb_registry_open_url_rejects_homepage_and_wrong_exporter() -> None:
    assert (
        epb_registry_open_url(
            "2043",
            "https://edb.epb.gov.bd/exporter/2043/interstoff-apparels-ltd",
        )
        == "https://edb.epb.gov.bd/exporter/2043/interstoff-apparels-ltd"
    )
    assert epb_registry_open_url("2043", "https://epb.gov.bd/") is None
    assert (
        epb_registry_open_url(
            "2043",
            "https://edb.epb.gov.bd/exporter/4821/za-apparels-ltd",
        )
        is None
    )
    assert epb_registry_open_url("2043", None) is None
