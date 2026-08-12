"""Unit tests for REZ-117 decision table (no network)."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from ops.apply_rez117_ambiguous_decisions import (
    ACCEPTED_FINGERPRINT,
    DECISIONS,
    PlannedItem,
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


def test_post_apply_forbids_953_solely_on_as_knitwear() -> None:
    holders = {d.ref: {_decision_dest(d)} for d in DECISIONS}
    assert rez117_decision_violations(holders) == []
    holders["953"] = {"as-knitwear"}
    bad = rez117_decision_violations(holders)
    assert any("953" in line and "as-knitwear" in line for line in bad)


def _decision_dest(d) -> str:
    from ops.apply_rez117_ambiguous_decisions import _decision_dest_slug

    return _decision_dest_slug(d)


def test_rez117_guard_flags_331_on_plural_union() -> None:
    holders = {d.ref: {_decision_dest(d)} for d in DECISIONS}
    holders["331"] = {"union-fashions"}
    bad = rez117_decision_violations(holders)
    assert any("331" in line for line in bad)


def test_rez117_tag_guard_flags_factory_on_231_and_move_retag_dests() -> None:
    holders = {
        "231": {"am-fashion"},
        "1283": {"mim-fashion-wear"},
        "331": {"union-fashion"},
    }
    bad = rez117_buying_house_tag_violations(
        holders,
        {
            "am-fashion": "factory",
            "mim-fashion-wear": "factory",
            "union-fashion": "factory",
        },
    )
    assert any("231" in line for line in bad)
    assert any("1283" in line for line in bad)
    assert any("331" in line for line in bad)
    assert (
        rez117_buying_house_tag_violations(
            holders,
            {
                "am-fashion": "buying_house",
                "mim-fashion-wear": "buying_house",
                "union-fashion": "buying_house",
            },
        )
        == []
    )


def test_associate_on_factory_allowlist() -> None:
    holders = {"679": {"atima-fashions"}, "953": {"as-knitwear"}, "231": {"am-fashion"}}
    entity = {
        "atima-fashions": "factory",
        "as-knitwear": "factory",
        "am-fashion": "factory",
    }
    mt = {"679": "associate", "953": "associate", "231": "associate"}
    lines = rez117_associate_on_factory_violations(holders, entity, mt)
    assert any("953" in line for line in lines)
    assert any("231" in line for line in lines)
    assert not any("679" in line for line in lines)


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


def test_accepted_fingerprint_constant_matches_dry_plan_shape() -> None:
    """Lock ACCEPTED_FINGERPRINT to live dry-plan once recomputed after field add."""
    plan_path = Path("ops/plans/_rez117_dry_plan.json")
    assert plan_path.is_file()
    blob = json.loads(plan_path.read_text(encoding="utf-8"))
    assert blob.get("fingerprint") == ACCEPTED_FINGERPRINT
    assert len(blob.get("plan") or []) == 18
