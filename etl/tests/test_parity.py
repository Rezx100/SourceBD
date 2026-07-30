"""Unit tests for the transport parity harness.

The diff logic decides whether a source is allowed to cut over to Firecrawl, so
it has to be strict in the right places (any real value change fails) and
tolerant in exactly one place (whitespace and key order are not facts).
"""
from __future__ import annotations

from datetime import date

import pytest

from etl.core.sanctions import SanctionEntry
from etl.core.scraper import ScrapedRecord
from etl.parity import (
    ParityReport,
    comparable_fields,
    diff_records,
    format_report,
    record_ref,
)


def rec(ref: str, **kw) -> ScrapedRecord:
    base = dict(
        source_code="BGMEA",
        source_ref=ref,
        company_name="Acme Apparels Ltd.",
        payload={"bgmea_reg_number": "1234", "num_machines": 400},
    )
    base.update(kw)
    return ScrapedRecord(**base)  # type: ignore[arg-type]


def report_for(legacy, candidate) -> ParityReport:
    r = ParityReport("bgmea_web", "direct", "firecrawl")
    r.legacy_count = len(legacy)
    r.candidate_count = len(candidate)
    (r.diffs, r.compared, r.identical, r.only_in_legacy, r.only_in_candidate) = diff_records(
        legacy, candidate
    )
    return r


def entry(ref: str, **kw) -> SanctionEntry:
    base = dict(
        list_code="uflpa",
        source_code="UFLPA",
        entry_ref=ref,
        entity_name="Some Textile Co Ltd",
        country="China",
        status="active",
        listed_date=date(2023, 6, 1),
    )
    base.update(kw)
    return SanctionEntry(**base)  # type: ignore[arg-type]


# ---- both record shapes -------------------------------------------------

def test_a_watchlist_entry_can_be_keyed_and_compared():
    """The regression: the harness assumed every source yields a ScrapedRecord.

    Watchlist sources yield `SanctionEntry`, keyed on `entry_ref` with no
    `payload`, so keying on `source_ref` raised AttributeError and left every
    sanctions source silently unvalidated — the sources where a false positive
    brands a real factory as sanctioned.
    """
    r = report_for({"u-1": entry("u-1")}, {"u-1": entry("u-1")})
    assert r.passed is True
    assert r.identical == 1


def test_a_changed_watchlist_field_still_fails():
    r = report_for(
        {"u-1": entry("u-1")},
        {"u-1": entry("u-1", entity_name="Some Textile Company Limited")},
    )
    assert r.passed is False
    assert [d.field for d in r.diffs] == ["entity_name"]


def test_record_ref_reads_whichever_key_the_shape_uses():
    assert record_ref(rec("general:3421")) == "general:3421"
    assert record_ref(entry("uflpa-i-0001")) == "uflpa-i-0001"


def test_a_shape_with_neither_key_is_refused_rather_than_skipped():
    """Silently returning None would collapse every record onto one key."""

    class Nameless:
        pass

    with pytest.raises(TypeError, match="neither source_ref nor entry_ref"):
        record_ref(Nameless())


def test_our_own_scrape_capture_is_not_compared():
    """`raw` is our capture, not a publisher assertion, so it differs by design.

    Comparing it would fail every watchlist source on noise and train us to
    ignore the harness.
    """
    fields = comparable_fields(entry("u-1", raw={"fetched_via": "firecrawl"}))
    assert "raw" not in fields
    assert fields["entity_name"] == "Some Textile Co Ltd"


def test_identical_records_pass():
    r = report_for({"a": rec("a")}, {"a": rec("a")})
    assert r.passed is True
    assert r.identical == 1
    assert r.diffs == []


def test_changed_payload_value_fails():
    r = report_for({"a": rec("a")}, {"a": rec("a", payload={"bgmea_reg_number": "1234", "num_machines": 12})})
    assert r.passed is False
    assert [d.field for d in r.diffs] == ["payload.num_machines"]


def test_changed_top_level_field_fails():
    r = report_for({"a": rec("a")}, {"a": rec("a", company_name="Acme Apparels PLC")})
    assert r.passed is False
    assert [d.field for d in r.diffs] == ["company_name"]


def test_whitespace_only_difference_passes():
    # Firecrawl's markdown pipeline re-wraps text. That is not a data change.
    r = report_for(
        {"a": rec("a", address_raw="12  Road 5,\n  Dhaka")},
        {"a": rec("a", address_raw="12 Road 5, Dhaka")},
    )
    assert r.passed is True


def test_dict_key_order_difference_passes():
    r = report_for(
        {"a": rec("a", payload={"x": 1, "y": 2})},
        {"a": rec("a", payload={"y": 2, "x": 1})},
    )
    assert r.passed is True


def test_number_formatting_change_is_caught():
    # "1,240" -> "1240" would silently alter a parsed figure. Must fail.
    r = report_for(
        {"a": rec("a", payload={"employees": "1,240"})},
        {"a": rec("a", payload={"employees": "1240"})},
    )
    assert r.passed is False


def test_missing_field_in_candidate_is_caught():
    r = report_for(
        {"a": rec("a", payload={"bgmea_reg_number": "1234", "epb_reg_no": "EPB-9"})},
        {"a": rec("a", payload={"bgmea_reg_number": "1234"})},
    )
    assert r.passed is False
    assert [d.field for d in r.diffs] == ["payload.epb_reg_no"]


def test_record_missing_from_candidate_is_reported():
    r = report_for({"a": rec("a"), "b": rec("b")}, {"a": rec("a")})
    assert r.passed is False
    assert r.only_in_legacy == ["b"]
    assert r.only_in_candidate == []


def test_extra_record_in_candidate_is_reported():
    r = report_for({"a": rec("a")}, {"a": rec("a"), "b": rec("b")})
    assert r.passed is False
    assert r.only_in_candidate == ["b"]


def test_zero_overlap_never_passes():
    # The dangerous case: both transports "succeed" but share nothing, e.g. the
    # candidate returned a login wall that parsed to different refs. An empty
    # diff list must not read as success.
    r = report_for({"a": rec("a")}, {"z": rec("z")})
    assert r.compared == 0
    assert r.passed is False


def test_empty_candidate_never_passes():
    r = report_for({"a": rec("a")}, {})
    assert r.passed is False


def test_both_empty_never_passes():
    r = report_for({}, {})
    assert r.compared == 0
    assert r.passed is False


def test_a_skip_is_not_a_pass():
    """SKIP means unvalidated, so it must never read as validated."""
    r = report_for({"a": rec("a")}, {"a": rec("a")})
    assert r.passed is True and r.verdict == "PASS"
    r.not_comparable = "no baseline"
    assert r.verdict == "SKIP"
    assert r.passed is False


def test_error_on_either_side_fails_even_with_no_diffs():
    r = report_for({"a": rec("a")}, {"a": rec("a")})
    assert r.passed is True
    r.candidate_error = "FirecrawlNotConfigured"
    assert r.passed is False


def test_nested_list_of_dicts_compared_deeply():
    r = report_for(
        {"a": rec("a", payload={"directors": [{"Name": "A", "Designation": "MD"}]})},
        {"a": rec("a", payload={"directors": [{"Name": "A", "Designation": "Chairman"}]})},
    )
    assert r.passed is False


def test_diffs_by_field_aggregates_counts():
    legacy = {"a": rec("a"), "b": rec("b")}
    candidate = {
        "a": rec("a", payload={"bgmea_reg_number": "9", "num_machines": 400}),
        "b": rec("b", payload={"bgmea_reg_number": "8", "num_machines": 400}),
    }
    r = report_for(legacy, candidate)
    assert r.field_failure_counts == {"payload.bgmea_reg_number": 2}


def test_format_report_marks_pass_and_fail():
    ok = format_report(report_for({"a": rec("a")}, {"a": rec("a")}))
    assert ok.startswith("parity PASS")
    bad = format_report(report_for({"a": rec("a")}, {}))
    assert bad.startswith("parity FAIL")


def test_format_report_explains_zero_overlap():
    text = format_report(report_for({"a": rec("a")}, {"z": rec("z")}))
    assert "nothing to compare" in text
