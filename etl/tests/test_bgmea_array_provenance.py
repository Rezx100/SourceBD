"""Pins for the BGMEA array provenance report (REZ-98).

`suppliers.bgmea_reg_numbers` is denormalised and every writer unions, so a
number survives the record that put it there. These tests fix the definition
of "backed" and the step-2 / step-4 counts against the three production
fixtures named on the issue, read from production on 5 Aug 2026:

    arbella-fashion   shows 5729, 6631   holds only general:6631
    alim-knit-bd      shows 4969, 3030, 5286   holds only general:4969
    ananta-apparels   shows 6257, 4564, 1181, 2993   holds three records

In every case the unbacked number is a LIVE record on a different supplier
(5729 sits on avant-garments, 3030 on appolo-fashions, 5286 on
appollo-knitwear-bd, 2993 on ananta-fashion) — a residue left behind when
`ops/repair_bgmea_conflations.py` moved the record and recomputed only the
numeric columns. That `moved` vs `phantom` distinction is what decides
whether the founder is choosing a display rule or a data repair, so it is
pinned here.
"""

from __future__ import annotations

from ops.report_bgmea_array_provenance import (
    MOVED,
    PHANTOM,
    classify,
    record_numbers,
    summarise,
)

ARBELLA = "11111111-1111-1111-1111-111111111111"
ALIM = "22222222-2222-2222-2222-222222222222"
ANANTA_APPARELS = "33333333-3333-3333-3333-333333333333"
AVANT = "44444444-4444-4444-4444-444444444444"
APPOLO = "55555555-5555-5555-5555-555555555555"
APPOLLO_KNIT = "66666666-6666-6666-6666-666666666666"
ANANTA_FASHION = "77777777-7777-7777-7777-777777777777"


def _sup(sid: str, slug: str, numbers: list[str]) -> dict:
    return {
        "id": sid,
        "slug": slug,
        "company_name": slug.replace("-", " ").title(),
        "bgmea_reg_numbers": numbers,
        "bgmea_verified": True,
    }


def _rec(sid: str, ref: str, *, status: str = "active", reg: str | None = None) -> dict:
    return {"supplier_id": sid, "source_ref": ref, "status": status, "reg_number": reg}


# The production fixtures, exactly as read on 5 Aug 2026.
FIXTURE_SUPPLIERS = [
    _sup(ARBELLA, "arbella-fashion", ["5729", "6631"]),
    _sup(ALIM, "alim-knit-bd", ["4969", "3030", "5286"]),
    _sup(ANANTA_APPARELS, "ananta-apparels", ["6257", "4564", "1181", "2993"]),
    _sup(AVANT, "avant-garments", ["5729"]),
    _sup(APPOLO, "appolo-fashions", ["3030"]),
    _sup(APPOLLO_KNIT, "appollo-knitwear-bd", ["5286"]),
    _sup(ANANTA_FASHION, "ananta-fashion", ["2993"]),
]

FIXTURE_RECORDS = [
    _rec(ARBELLA, "general:6631", reg="6631"),
    _rec(ALIM, "general:4969", reg="4969"),
    _rec(ANANTA_APPARELS, "general:6257", reg="6257"),
    _rec(ANANTA_APPARELS, "general:4564", reg="4564"),
    _rec(ANANTA_APPARELS, "general:1181", reg="1181"),
    _rec(AVANT, "general:5729", reg="5729"),
    _rec(APPOLO, "general:3030", reg="3030"),
    _rec(APPOLLO_KNIT, "general:5286", reg="5286"),
    _rec(ANANTA_FASHION, "general:2993", reg="2993"),
]


def _by_slug(rows) -> dict:
    return {r.slug: r for r in rows}


class TestRecordNumbers:
    def test_general_ref_alone_vouches_for_the_number(self):
        assert record_numbers(_rec(ARBELLA, "general:6631")) == {"6631"}

    def test_member_keyed_row_falls_back_to_the_payload_field(self):
        # BGMEA published no number, so bgmea_web keyed on the member id.
        assert record_numbers(_rec(ARBELLA, "member:4388", reg="6631")) == {"6631"}

    def test_inactive_record_vouches_for_nothing(self):
        assert record_numbers(_rec(ARBELLA, "general:6631", status="inactive")) == set()

    def test_ref_and_payload_disagreeing_yields_both(self):
        # Never silently prefer one: a record that disagrees with its own ref
        # should not make a number look unbacked.
        assert record_numbers(_rec(ARBELLA, "general:6631", reg="5729")) == {"6631", "5729"}


class TestFixtureClassification:
    def test_arbella_publishes_one_backed_and_one_orphan(self):
        row = _by_slug(classify(FIXTURE_SUPPLIERS, FIXTURE_RECORDS))["arbella-fashion"]
        assert row.numbers == ("5729", "6631")
        assert row.backed == ("6631",)
        assert row.unbacked == ("5729",)
        assert not row.fully_backed
        assert not row.entirely_unbacked

    def test_alim_publishes_one_backed_and_two_orphans(self):
        row = _by_slug(classify(FIXTURE_SUPPLIERS, FIXTURE_RECORDS))["alim-knit-bd"]
        assert row.backed == ("4969",)
        assert row.unbacked == ("3030", "5286")

    def test_ananta_apparels_publishes_three_backed_and_one_orphan(self):
        row = _by_slug(classify(FIXTURE_SUPPLIERS, FIXTURE_RECORDS))["ananta-apparels"]
        assert row.backed == ("6257", "4564", "1181")
        assert row.unbacked == ("2993",)

    def test_the_counterpart_suppliers_are_clean(self):
        rows = _by_slug(classify(FIXTURE_SUPPLIERS, FIXTURE_RECORDS))
        for slug in ("avant-garments", "appolo-fashions", "appollo-knitwear-bd", "ananta-fashion"):
            assert rows[slug].fully_backed, slug

    def test_every_fixture_orphan_is_moved_not_phantom(self):
        # This is the finding that makes REZ-98 a repair rather than a purge:
        # nothing was fabricated, the record simply lives elsewhere now.
        rows = _by_slug(classify(FIXTURE_SUPPLIERS, FIXTURE_RECORDS))
        assert rows["arbella-fashion"].unbacked_kind("5729") == MOVED
        assert rows["arbella-fashion"].unbacked_holders["5729"] == AVANT
        assert rows["alim-knit-bd"].unbacked_kind("3030") == MOVED
        assert rows["alim-knit-bd"].unbacked_holders["5286"] == APPOLLO_KNIT
        assert rows["ananta-apparels"].unbacked_kind("2993") == MOVED

    def test_a_number_no_record_vouches_for_is_a_phantom(self):
        suppliers = [_sup(ARBELLA, "arbella-fashion", ["5729", "6631"])]
        records = [_rec(ARBELLA, "general:6631", reg="6631")]
        row = classify(suppliers, records)[0]
        assert row.unbacked_kind("5729") == PHANTOM
        assert row.unbacked_holders == {}

    def test_a_supplier_does_not_back_its_own_number_from_an_inactive_record(self):
        suppliers = [_sup(ARBELLA, "arbella-fashion", ["6631"])]
        records = [_rec(ARBELLA, "general:6631", status="inactive", reg="6631")]
        row = classify(suppliers, records)[0]
        assert row.entirely_unbacked


class TestSummary:
    def test_step_two_split_over_the_fixtures(self):
        counts = summarise(classify(FIXTURE_SUPPLIERS, FIXTURE_RECORDS))
        assert counts["multi_number_suppliers"] == 3
        assert counts["multi_all_backed"] == 0
        assert counts["multi_some_unbacked"] == 3
        assert counts["multi_entirely_unbacked"] == 0
        assert counts["unbacked_numbers"] == 4
        assert counts["unbacked_moved"] == 4
        assert counts["unbacked_phantom"] == 0

    def test_option_a_removes_only_unbacked_numbers(self):
        counts = summarise(classify(FIXTURE_SUPPLIERS, FIXTURE_RECORDS))
        assert counts["a_numbers_removed"] == 4
        assert counts["a_suppliers_losing_a_number"] == 3
        assert counts["a_suppliers_losing_bgmea_entirely"] == 0
        assert counts["a_suppliers_multi_to_single"] == 2  # arbella, alim
        assert counts["a_suppliers_still_multi"] == 1  # ananta-apparels keeps three

    def test_option_b_removes_nothing_and_relabels_everything_unbacked(self):
        counts = summarise(classify(FIXTURE_SUPPLIERS, FIXTURE_RECORDS))
        assert counts["b_numbers_removed"] == 0
        assert counts["b_suppliers_affected"] == 0
        assert counts["b_numbers_relabelled"] == counts["unbacked_numbers"]

    def test_a_single_number_supplier_losing_it_drops_the_pill_entirely(self):
        suppliers = [_sup(ARBELLA, "arbella-fashion", ["5729"])]
        counts = summarise(classify(suppliers, []))
        assert counts["multi_number_suppliers"] == 0
        assert counts["single_number_unbacked"] == 1
        assert counts["a_suppliers_losing_bgmea_entirely"] == 1


class TestReadOnly:
    def test_the_reporter_has_no_write_path(self):
        # REZ-98 is detection and reporting only. No --apply, no mutation.
        from pathlib import Path

        src = Path("ops/report_bgmea_array_provenance.py").read_text(encoding="utf-8")
        body = src.split('"""', 2)[-1].lower()
        for verb in ("rest.patch(", "rest.insert(", "update public.", "insert into", "delete from"):
            assert verb not in body, verb
        assert "--apply" not in body
