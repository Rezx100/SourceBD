"""Unit tests for REZ-116 orphan BGMEA move planner (no network)."""

from __future__ import annotations

import pytest

from ops.move_bgmea_orphan_registrations import (
    FOUNDER_DECISION_ALLOWLIST,
    HOLDS,
    MOVES,
    PlannedMove,
    assert_woven_bgmea_visible_on_mother,
    fingerprint,
    rez116_decision_violations,
    verify_standard_stitches_facility_attribution,
)


def test_ten_moves_and_one_hold() -> None:
    assert len(MOVES) == 10
    assert len(HOLDS) == 1
    assert HOLDS[0].ref == "1168"
    assert "1168" not in {m.ref for m in MOVES}


def test_founder_knowledge_refs_are_allowlisted() -> None:
    founder = {m.ref for m in MOVES if m.provenance.startswith("founder_trade_knowledge")}
    assert founder == {"1604", "1556"}
    assert founder <= FOUNDER_DECISION_ALLOWLIST
    assert "1168" in FOUNDER_DECISION_ALLOWLIST


def test_fingerprint_stable_and_order_independent() -> None:
    a = PlannedMove(
        ref="797",
        source_record_id="sr-a",
        source_id="src",
        from_supplier_id="from-a",
        from_slug="asdwa-fashion",
        to_supplier_id="to-a",
        to_slug="fashion-comfort-bd",
        to_is_published=True,
        to_facility_of=None,
        mother_slug=None,
        identity="associate:797",
        registered_name="Fashion Comfort (BD) Ltd.",
        provenance="register_exact",
        notes="",
    )
    b = PlannedMove(
        ref="general:4562",
        source_record_id="sr-b",
        source_id="src",
        from_supplier_id="from-b",
        from_slug="vintage-denim-apparels",
        to_supplier_id="to-b",
        to_slug="vintage-denim",
        to_is_published=True,
        to_facility_of=None,
        mother_slug=None,
        identity="general:4562",
        registered_name="Vintage Denim Ltd.",
        provenance="register_exact",
        notes="",
    )
    assert fingerprint([a, b]) == fingerprint([b, a])
    assert fingerprint([a, b]) != fingerprint([a])


def test_woven_unit_move_is_present() -> None:
    woven = next(m for m in MOVES if m.ref == "general:5663")
    assert woven.to_slug == "standard-stitches-ltd-woven-unit"
    assert woven.from_slug == "standard-stitches"


def test_mother_gate_raises_without_building_name_pills() -> None:
    class _Rest:
        def rpc_json(self, name: str, body: dict):
            assert body["p_slug"] == "standard-stitches"
            return {
                "pills": [
                    {
                        "label": "BGMEA General member #",
                        "value": "5663",
                        "source_code": "BGMEA",
                    }
                ]
            }

    with pytest.raises(RuntimeError, match="building_name"):
        verify_standard_stitches_facility_attribution(_Rest())  # type: ignore[arg-type]


def test_mother_gate_passes_when_facility_pill_labelled() -> None:
    class _Rest:
        def rpc_json(self, name: str, body: dict):
            return {
                "pills": [
                    {
                        "label": "RSC ID",
                        "value": "24417",
                        "source_code": "RSC",
                        "building_name": "STANDARD STITCHES LIMITED (EXTENSION)",
                    }
                ]
            }

    verify_standard_stitches_facility_attribution(_Rest())  # type: ignore[arg-type]


def test_post_apply_woven_gate_requires_5663_building_name() -> None:
    class _Rest:
        def rpc_json(self, name: str, body: dict):
            return {
                "pills": [
                    {
                        "label": "BGMEA General member #",
                        "value": "5663",
                        "source_code": "BGMEA",
                        # missing building_name — mother still showing direct pill
                    }
                ]
            }

    with pytest.raises(RuntimeError, match="5663"):
        assert_woven_bgmea_visible_on_mother(_Rest())  # type: ignore[arg-type]


def test_post_apply_woven_gate_passes_with_building_name() -> None:
    class _Rest:
        def rpc_json(self, name: str, body: dict):
            return {
                "pills": [
                    {
                        "label": "BGMEA General member #",
                        "value": "5663",
                        "source_code": "BGMEA",
                        "building_name": "Standard Stitches Ltd. (Woven Unit)",
                    }
                ]
            }

    assert_woven_bgmea_visible_on_mother(_Rest())  # type: ignore[arg-type]


def test_rez116_detector_forbids_hold_on_p_fashion() -> None:
    lines = rez116_decision_violations({"1168": {"p-fashion"}})
    assert any("guessed onto 'p-fashion'" in line for line in lines)


def test_rez116_detector_flags_missing_hold() -> None:
    lines = rez116_decision_violations({})
    assert any("HOLD 1168 missing" in line for line in lines)


def test_rez116_detector_flags_move_on_third_slug() -> None:
    lines = rez116_decision_violations(
        {"general:4562": {"some-other-company"}, "1168": {"pa-textile"}}
    )
    assert any("MOVE general:4562" in line and "some-other-company" in line for line in lines)


def test_rez116_detector_clean_when_on_from_or_to() -> None:
    holders = {m.ref: {m.from_slug} for m in MOVES}
    holders["1168"] = {"pa-textile"}
    assert rez116_decision_violations(holders) == []
    holders2 = {m.ref: {m.to_slug} for m in MOVES}
    holders2["1168"] = {"pa-textile"}
    assert rez116_decision_violations(holders2) == []
