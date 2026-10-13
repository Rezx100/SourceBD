"""ops/report_premises_siblings.py — sheds, extensions and units beside their main company.

The founder's case (13 Oct 2026): `zaheen-knitwear` and
`zaheen-knitwear-limited-shed-3-4-5-...` are two published profiles of one
company. The report must pair them, and must not turn a registered company
name that merely contains "Unit-2" into somebody's building.
"""
from __future__ import annotations

import inspect

import pytest

import ops.report_premises_siblings as report
from ops.report_premises_siblings import build, classify, evidence, proposed_action

ZAHEEN_SHEDS = (
    "Zaheen Knitwears Limited (Shed - 3, 4, 5, 10, 11, 12, 13) & "
    "(Building - Security, ETP and Fire Pump)"
)


@pytest.mark.parametrize(
    "name, kind, base",
    [
        (ZAHEEN_SHEDS, "building", "Zaheen Knitwears Limited"),
        ("Designer Fashion Ltd. (Warehouse)", "building", "Designer Fashion Ltd."),
        ("Renaissance Barind Ltd (Extention)", "building", "Renaissance Barind Ltd"),
        ("SF Sweaters Ltd. Building - 2", "building", "SF Sweaters Ltd"),
        ("Hannan Fashions Ltd. Ext.-1", "building", "Hannan Fashions Ltd"),
        ("Radial International Ltd. (Unit-2) (Extension)", "building", "Radial International Ltd."),
        ("Sterling Denims Ltd. Unit-2", "unit", "Sterling Denims Ltd."),
        ("Islam Garments Ltd. (Weaving Unit)", "unit", "Islam Garments Ltd."),
        ("A.K. Khan & Co. Ltd.(Garments Div)", "unit", "A.K. Khan & Co. Ltd."),
        ("BEACON TEXTILE UNIT (2)", "unit", "BEACON TEXTILE"),
        ("Advance World Limited (New)", "other", "Advance World Limited"),
        # A company that moved is one factory, and a former name is a note: neither is a site.
        ("Fashion Asia Ltd. (Relocation)", "other", "Fashion Asia Ltd."),
        ("Nafa Apparels Ltd. (Former Palmal Knitwear Factory Ltd)", "other", "Nafa Apparels Ltd."),
    ],
)
def test_classify_reads_the_trailing_qualifier(name: str, kind: str, base: str) -> None:
    q = classify(name)
    assert q is not None
    assert (q.kind, q.base) == (kind, base)


@pytest.mark.parametrize(
    "name",
    [
        "ZAHEEN KNITWEARS LTD",
        # Unit-2 sits inside the registered name: a company, never a building.
        "N. T. APPARELS UNIT-2 LIMITED",
        "Bonny Apparels (Pvt) Ltd.",
        "Suhcheon Company (BD)",
        "Abc Ltd (Previously Xyz Ltd)",
        "(Shed)",
        "",
    ],
)
def test_classify_leaves_plain_names_alone(name: str) -> None:
    assert classify(name) is None


def test_the_extension_of_a_unit_looks_for_the_unit_first() -> None:
    q = classify("Radial International Ltd. (Unit-2) (Extension)")
    assert q is not None
    assert q.chain == ("Radial International Ltd. (Unit-2)", "Radial International Ltd.")


def _sup(slug: str, name: str, **extra: object) -> dict:
    return {"id": slug, "slug": slug, "company_name": name, "is_published": True,
            "facility_of": None, "district": "Narayanganj", **extra}


def _buckets(suppliers: list[dict]) -> dict[str, str]:
    return {r["supplier"]["slug"]: r["bucket"] for r in build(suppliers)["rows"]}


def test_build_pairs_zaheen_sheds_with_the_main_profile() -> None:
    data = build([_sup("zaheen-knitwear", "ZAHEEN KNITWEARS LTD"), _sup("zaheen-sheds", ZAHEEN_SHEDS)])
    (row,) = data["rows"]
    assert row["bucket"] == "a"
    assert [m["slug"] for m in row["mothers"]] == ["zaheen-knitwear"]


def test_build_sorts_every_group() -> None:
    got = _buckets(
        [
            _sup("main", "Sterling Denims Ltd."),
            _sup("unit", "Sterling Denims Ltd. Unit-2"),
            _sup("note", "Sterling Denims Ltd. (New)"),
            _sup("k3", "Kenpark Apparel Ltd (U-3)"),
            _sup("k5", "Kenpark Apparel Ltd (U-5)"),
            _sup("alone", "Youngones (BD) Ltd. Unit-2"),
        ]
    )
    assert got == {"unit": "b1", "note": "d", "k3": "b2", "k5": "b2", "alone": "c"}


def test_an_unpublished_or_already_linked_row_is_not_a_main_profile() -> None:
    hidden = _sup("hidden", "Sterling Denims Ltd.", is_published=False)
    linked = _sup("linked", "Sterling Denims Ltd.", is_published=False, facility_of="someone")
    data = build([hidden, linked, _sup("unit", "Sterling Denims Ltd. Unit-2")])
    (row,) = data["rows"]
    assert row["bucket"] == "c"
    assert {s["slug"] for s in row["unpublished_same_base"]} == {"hidden", "linked"}
    assert data["linked"] == 1


def test_a_main_profile_is_found_by_exact_identity_never_a_near_name() -> None:
    # The dry run that proposed Anika -> ANITA is why `_find_facility_parent` is exact.
    got = _buckets([_sup("anita", "Anita Apparels Ltd."), _sup("anika", "Anika Apparels Ltd. (Extension)")])
    assert got == {"anika": "c"}


def _rec(code: str, ref: str, **fields: str) -> dict:
    return {"code": code, "source_ref": ref, "fields": fields}


def test_two_rsc_entries_and_a_district_are_not_called_strong() -> None:
    ev = evidence(
        _sup("sheds", ZAHEEN_SHEDS), _sup("main", "ZAHEEN KNITWEARS LTD"),
        [_rec("RSC", "24449")], [_rec("RSC", "11497"), _rec("BKMEA", "1588")],
    )
    assert ev.verdict == "name and district"
    assert ev.listed_twice == ["RSC"]
    assert proposed_action("a", ev).startswith("link as a building")


def test_one_register_entry_on_both_rows_is_a_duplicate_not_a_building() -> None:
    ev = evidence(
        _sup("div", "Rupashi Fabrics Complex (Garments Division)"), _sup("main", "Rupashi Fabrics Complex"),
        [_rec("BKMEA", "496:detail")], [_rec("BKMEA", "496")],
    )
    assert ev.verdict == "same register entry"
    assert "merge_duplicate_suppliers" in proposed_action("b1", ev)


def test_a_shared_address_is_strong_and_a_different_district_is_flagged() -> None:
    address = "Keodala, Madanpur, Bandar, Narayanganj"
    q = _sup("unit", "X Ltd. (Unit-2)", address_raw=address, district="Dhaka")
    p = _sup("main", "X Ltd.", address_raw=address.upper())
    ev = evidence(q, p, [], [])
    assert ev.verdict == "strong, but check"
    assert any("districts differ" in a for a in ev.against)


def test_a_phone_number_is_never_printed() -> None:
    q = _sup("unit", "X Ltd. (Unit-2)", phones=["+8801711548158"])
    p = _sup("main", "X Ltd.", phones=["01711548158"])
    ev = evidence(q, p, [], [])
    assert ev.strong == ["1 shared phone number"]


def test_the_script_cannot_write() -> None:
    source = inspect.getsource(report)
    for verb in (".patch(", ".insert(", ".post(", ".delete(", "add_argument(\"--apply\""):
        assert verb not in source
