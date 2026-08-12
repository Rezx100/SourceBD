"""Unit tests for REZ-117 decision table (no network)."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from ops.apply_rez117_ambiguous_decisions import (
    ACCEPTED_FINGERPRINT,
    DECISIONS,
    PlannedItem,
    _decision_dest_slug,
    _gate_univogue_unit2,
    assert_named_counterexample_profiles,
    assert_univogue_2436_visible_on_mother,
    fingerprint,
    rez117_associate_on_factory_violations,
    rez117_buying_house_tag_violations,
    rez117_decision_violations,
)


def test_eighteen_decisions() -> None:
    assert len(DECISIONS) == 18
    refs = [d.ref for d in DECISIONS]
    assert len(refs) == len(set(refs))


def test_associate_imports_are_buying_houses() -> None:
    imports = [d for d in DECISIONS if d.action == "import_move"]
    assert len(imports) == 8
    assert all(d.set_buying_house for d in imports)


def test_union_fashion_not_plural() -> None:
    d = next(x for x in DECISIONS if x.ref == "331")
    assert d.to_slug == "union-fashion"


def test_snowtex_clean_slug() -> None:
    d = next(x for x in DECISIONS if x.ref == "general:5756")
    assert d.to_slug == "snowtex-outerwear"


def _sample_items() -> list[PlannedItem]:
    return [
        PlannedItem(
            ref="231",
            action="stay_retag",
            source_record_id="a",
            source_id="s",
            from_supplier_id="f",
            from_slug="am-fashion",
            to_supplier_id="f",
            to_slug="am-fashion",
            to_exists=True,
            create_name=None,
            identity="associate:231",
            set_buying_house=True,
            notes="",
            to_is_published=True,
        ),
        PlannedItem(
            ref="953",
            action="import_move",
            source_record_id="b",
            source_id="s",
            from_supplier_id="f2",
            from_slug="as-knitwear",
            to_supplier_id=None,
            to_slug="as-fashion",
            to_exists=False,
            create_name="A. S. Fashion",
            identity="associate:953",
            set_buying_house=True,
            notes="",
            to_is_published=True,
        ),
        PlannedItem(
            ref="general:2436",
            action="move",
            source_record_id="c",
            source_id="s",
            from_supplier_id="f3",
            from_slug="univogue-garments",
            to_supplier_id="u2",
            to_slug="univogue-garments-co-ltd-unit-2",
            to_exists=True,
            create_name=None,
            identity="general:2436",
            set_buying_house=False,
            notes="",
            to_is_published=False,
            to_facility_of="mother-id",
            mother_slug="univogue-garments",
        ),
    ]


def test_fingerprint_order_independent_and_field_sensitive() -> None:
    items = _sample_items()
    assert fingerprint(items) == fingerprint(list(reversed(items)))
    flipped = [
        PlannedItem(**{**i.__dict__, "set_buying_house": not i.set_buying_house})
        if i.ref == "953"
        else i
        for i in items
    ]
    assert fingerprint(items) != fingerprint(flipped)
    no_mother = [
        PlannedItem(**{**i.__dict__, "mother_slug": None})
        if i.ref == "general:2436"
        else i
        for i in items
    ]
    assert fingerprint(items) != fingerprint(no_mother)
    create_flip = [
        PlannedItem(**{**i.__dict__, "create_name": "Other"})
        if i.ref == "953"
        else i
        for i in items
    ]
    assert fingerprint(items) != fingerprint(create_flip)
    facility_flip = [
        PlannedItem(**{**i.__dict__, "to_facility_of": "other-id"})
        if i.ref == "general:2436"
        else i
        for i in items
    ]
    assert fingerprint(items) != fingerprint(facility_flip)
    identity_flip = [
        PlannedItem(**{**i.__dict__, "identity": "associate:999"})
        if i.ref == "953"
        else i
        for i in items
    ]
    assert fingerprint(items) != fingerprint(identity_flip)


def test_post_apply_forbids_953_solely_on_as_knitwear() -> None:
    holders = {d.ref: {_decision_dest_slug(d)} for d in DECISIONS}
    assert rez117_decision_violations(holders) == []
    holders["953"] = {"as-knitwear"}
    bad = rez117_decision_violations(holders)
    assert any("953" in line and "as-knitwear" in line for line in bad)


def test_rez117_guard_flags_331_on_plural_union() -> None:
    holders = {d.ref: {_decision_dest_slug(d)} for d in DECISIONS}
    holders["331"] = {"union-fashions"}
    bad = rez117_decision_violations(holders)
    assert any("331" in line for line in bad)


def test_rez117_detector_flags_1283_still_on_ms_fashion_wear() -> None:
    holders = {d.ref: {_decision_dest_slug(d)} for d in DECISIONS}
    holders["1283"] = {"ms-fashion-wear"}
    bad = rez117_decision_violations(holders)
    assert any("1283" in line and "ms-fashion-wear" in line for line in bad)


def test_rez117_detector_flags_missing_refs() -> None:
    holders = {d.ref: {_decision_dest_slug(d)} for d in DECISIONS}
    del holders["231"]
    bad = rez117_decision_violations(holders)
    assert any("231 missing" in line for line in bad)


def test_rez117_tag_guard_flags_factory_on_destinations() -> None:
    holders = {
        "231": {"am-fashion"},
        "1283": {"mim-fashion-wear"},
        "331": {"union-fashion"},
        "953": {"as-fashion"},
    }
    bad = rez117_buying_house_tag_violations(
        holders,
        {
            "am-fashion": "factory",
            "mim-fashion-wear": "factory",
            "union-fashion": "factory",
            "as-fashion": "factory",
        },
    )
    assert any("231" in line for line in bad)
    assert any("1283" in line for line in bad)
    assert any("331" in line for line in bad)
    assert any("953" in line for line in bad)
    assert (
        rez117_buying_house_tag_violations(
            holders,
            {
                "am-fashion": "buying_house",
                "mim-fashion-wear": "buying_house",
                "union-fashion": "buying_house",
                "as-fashion": "buying_house",
            },
        )
        == []
    )


def test_associate_on_factory_allowlist() -> None:
    holders = {
        "679": {"atima-fashions"},
        "1398": {"jms-clothing"},
        "953": {"as-knitwear"},
        "231": {"am-fashion"},
    }
    entity = {
        "atima-fashions": "factory",
        "jms-clothing": "factory",
        "as-knitwear": "factory",
        "am-fashion": "factory",
    }
    mt = {
        "679": "associate",
        "1398": "associate",
        "953": "associate",
        "231": "associate",
    }
    lines = rez117_associate_on_factory_violations(holders, entity, mt)
    assert any("953" in line for line in lines)
    assert any("231" in line for line in lines)
    assert not any("679" in line for line in lines)
    assert not any("1398" in line for line in lines)


def test_univogue_unit2_gate_rejects_bad_attachment() -> None:
    class _Rest:
        def one(self, path: str, params: dict):
            return {"id": "m", "slug": "wrong-mother", "is_published": True}

    with pytest.raises(RuntimeError, match="facility_of"):
        _gate_univogue_unit2(_Rest(), {"facility_of": None, "is_published": False})  # type: ignore[arg-type]
    with pytest.raises(RuntimeError, match="univogue-garments"):
        _gate_univogue_unit2(
            _Rest(),
            {"facility_of": "x", "is_published": False},
        )  # type: ignore[arg-type]

    class _Ok:
        def one(self, path: str, params: dict):
            return {"id": "m", "slug": "univogue-garments", "is_published": True}

    with pytest.raises(RuntimeError, match="unpublished"):
        _gate_univogue_unit2(
            _Ok(),
            {"facility_of": "x", "is_published": True},
        )  # type: ignore[arg-type]


def test_post_apply_univogue_gate_requires_2436_building_name() -> None:
    class _Rest:
        def rpc_json(self, name: str, body: dict):
            assert body["p_slug"] == "univogue-garments"
            return {
                "pills": [
                    {
                        "label": "BGMEA General member #",
                        "value": "2436",
                        "source_code": "BGMEA",
                    }
                ]
            }

    with pytest.raises(RuntimeError, match="2436"):
        assert_univogue_2436_visible_on_mother(_Rest())  # type: ignore[arg-type]


def test_post_apply_univogue_gate_passes_with_building_name() -> None:
    class _Rest:
        def rpc_json(self, name: str, body: dict):
            return {
                "pills": [
                    {
                        "label": "BGMEA General member #",
                        "value": "2436",
                        "source_code": "BGMEA",
                        "building_name": "Univogue Garments Co. Ltd. Unit-II",
                    }
                ]
            }

    assert_univogue_2436_visible_on_mother(_Rest())  # type: ignore[arg-type]


def test_named_counterexample_rpc_boundary() -> None:
    calls: list[str] = []

    class _Rest:
        def rpc_json(self, name: str, body: dict):
            slug = body["p_slug"]
            calls.append(slug)
            if slug == "as-knitwear":
                return {"pills": [], "supplier": {"entity_type": "factory"}}
            if slug == "as-fashion":
                return {
                    "pills": [
                        {"source_code": "BGMEA", "value": "953"},
                    ],
                    "supplier": {"entity_type": "buying_house"},
                }
            if slug == "am-fashion":
                return {
                    "pills": [{"source_code": "BGMEA", "value": "231"}],
                    "supplier": {"entity_type": "buying_house"},
                }
            if slug == "mirza-fashion-and-design":
                return {"pills": [], "supplier": {"entity_type": "buying_house"}}
            if slug == "union-fashion":
                return {
                    "pills": [{"source_code": "BGMEA", "value": "331"}],
                    "supplier": {"entity_type": "buying_house"},
                }
            if slug in {
                "snowtex-outerwear",
                "south-end-sweater",
                "southeast-sweater",
            }:
                val = {
                    "snowtex-outerwear": "5756",
                    "south-end-sweater": "3778",
                    "southeast-sweater": "3624",
                }[slug]
                return {
                    "pills": [{"source_code": "BGMEA", "value": val}],
                    "supplier": {"entity_type": "factory"},
                }
            if slug == "univogue-garments":
                return {
                    "pills": [
                        {
                            "source_code": "BGMEA",
                            "value": "2436",
                            "building_name": "Unit-II",
                        }
                    ],
                    "supplier": {"entity_type": "factory"},
                }
            raise AssertionError(slug)

    assert_named_counterexample_profiles(_Rest())  # type: ignore[arg-type]
    assert "as-knitwear" in calls
    assert "as-fashion" in calls
    assert "am-fashion" in calls
    assert "union-fashion" in calls
    assert "univogue-garments" in calls


def test_named_counterexample_fails_when_953_still_on_factory() -> None:
    class _Rest:
        def rpc_json(self, name: str, body: dict):
            if body["p_slug"] == "as-knitwear":
                return {
                    "pills": [{"source_code": "BGMEA", "value": "953"}],
                    "supplier": {"entity_type": "factory"},
                }
            return {"pills": [], "supplier": {"entity_type": "factory"}}

    with pytest.raises(RuntimeError, match="as-knitwear"):
        assert_named_counterexample_profiles(_Rest())  # type: ignore[arg-type]


def test_accepted_fingerprint_recomputes_from_dry_plan_rows() -> None:
    plan_path = Path("ops/plans/_rez117_dry_plan.json")
    assert plan_path.is_file()
    blob = json.loads(plan_path.read_text(encoding="utf-8"))
    assert blob.get("fingerprint") == ACCEPTED_FINGERPRINT
    rows = blob.get("plan") or []
    assert len(rows) == 18
    items = [PlannedItem(**row) for row in rows]
    assert fingerprint(items) == ACCEPTED_FINGERPRINT
