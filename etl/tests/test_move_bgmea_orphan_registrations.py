"""Unit tests for REZ-116 orphan BGMEA move planner (no network)."""

from __future__ import annotations

from ops.move_bgmea_orphan_registrations import (
    FOUNDER_DECISION_ALLOWLIST,
    HOLDS,
    MOVES,
    PlannedMove,
    fingerprint,
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
