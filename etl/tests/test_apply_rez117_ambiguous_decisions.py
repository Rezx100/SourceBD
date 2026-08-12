"""Unit tests for REZ-117 decision table (no network)."""

from __future__ import annotations

from ops.apply_rez117_ambiguous_decisions import (
    DECISIONS,
    PlannedItem,
    fingerprint,
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


def test_fingerprint_order_independent() -> None:
    a = PlannedItem(
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
    )
    b = PlannedItem(
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
    )
    assert fingerprint([a, b]) == fingerprint([b, a])


def test_rez117_guard_flags_953_still_on_wrong_host_after_move_window() -> None:
    # Pre-apply on from_slug is allowed; wrong third host is not.
    holders = {d.ref: {d.from_slug} for d in DECISIONS}
    assert rez117_decision_violations(holders) == []
    holders["953"] = {"as-knitwear", "random-factory"}
    bad = rez117_decision_violations(holders)
    assert any("953" in line and "random-factory" in line for line in bad)


def test_rez117_guard_flags_331_on_plural_union() -> None:
    holders = {d.ref: {d.from_slug} for d in DECISIONS}
    holders["331"] = {"union-fashions"}
    bad = rez117_decision_violations(holders)
    assert any("331" in line for line in bad)


def test_rez117_tag_guard_flags_factory_on_231() -> None:
    holders = {"231": {"am-fashion"}}
    bad = rez117_buying_house_tag_violations(holders, {"am-fashion": "factory"})
    assert any("231" in line for line in bad)
    assert (
        rez117_buying_house_tag_violations(holders, {"am-fashion": "buying_house"})
        == []
    )
    # Pre-move: ref not yet on destination — tag check silent.
    assert (
        rez117_buying_house_tag_violations(
            {"1283": {"ms-fashion-wear"}}, {"mim-fashion-wear": "factory"}
        )
        == []
    )
