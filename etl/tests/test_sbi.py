"""Unit tests for `etl.scoring.sbi` — pure functions, no DB."""
from __future__ import annotations

from datetime import date

import pytest

from etl.scoring.sbi import (
    Cert,
    SbiInputs,
    compute_inputs_hash,
    compute_pillar1_legal,
    compute_pillar2_safety,
    compute_pillar3_certs,
    compute_pillar4_market,
    compute_sbi,
)

TODAY = date(2026, 5, 19)


def _base(**kw) -> SbiInputs:
    defaults = dict(supplier_id="00000000-0000-0000-0000-000000000001")
    defaults.update(kw)
    return SbiInputs(**defaults)


# ------------------------------------------------------------------ pillar 1
def test_pillar1_empty_is_zero():
    assert compute_pillar1_legal(_base()) == 0


def test_pillar1_epb_only():
    assert compute_pillar1_legal(_base(source_tags=("EPB",))) == 8


def test_pillar1_full_stack_caps_at_25():
    inp = _base(
        source_tags=("EPB", "BGMEA", "BKMEA", "BTMA", "BGAPMEA"),
        rjsc_reg_number="C-12345",
    )
    # 8 + 4 + 5 + 4 + 2 + 2 + 4 (multi-reg bonus) = 29 → capped 25
    assert compute_pillar1_legal(inp) == 25


def test_pillar1_multi_register_bonus_triggers_at_two():
    one = _base(source_tags=("BGMEA",))
    two = _base(source_tags=("BGMEA", "BKMEA"))
    assert compute_pillar1_legal(one) == 5
    assert compute_pillar1_legal(two) == 5 + 4 + 4  # +multi-reg bonus


# ------------------------------------------------------------------ pillar 2
def test_pillar2_no_rsc_is_zero():
    assert compute_pillar2_safety(_base(rsc_has_row=False)) == 0


def test_pillar2_full_remediation():
    inp = _base(rsc_has_row=True, rsc_fire_pct=100, rsc_structural_pct=100)
    assert compute_pillar2_safety(inp) == 15 + 10 + 5


def test_pillar2_fire_ladder_boundaries():
    cases = [(100, 15), (80, 12), (60, 8), (1, 3), (0, 0)]
    for pct, expected_fire in cases:
        s = compute_pillar2_safety(_base(rsc_has_row=True, rsc_fire_pct=pct))
        # add DIFE default (5) since rsc_has_row=True; structural=0
        assert s == expected_fire + 5, f"fire={pct}"


def test_pillar2_caps_at_30():
    inp = _base(rsc_has_row=True, rsc_fire_pct=100, rsc_structural_pct=100)
    assert compute_pillar2_safety(inp) <= 30


# ------------------------------------------------------------------ pillar 3
def test_pillar3_wrap_plus_oekotex():
    inp = _base(
        certs=(
            Cert(kind="wrap", expires_on=date(2027, 1, 1)),
            Cert(kind="oeko_tex", expires_on=None),
        )
    )
    assert compute_pillar3_certs(inp, TODAY) == 10 + 7


def test_pillar3_expired_cert_ignored():
    inp = _base(certs=(Cert(kind="wrap", expires_on=date(2024, 1, 1)),))
    assert compute_pillar3_certs(inp, TODAY) == 0


def test_pillar3_duplicate_kind_counts_once():
    inp = _base(
        certs=(
            Cert(kind="wrap", expires_on=None),
            Cert(kind="wrap", expires_on=date(2030, 1, 1)),
        )
    )
    assert compute_pillar3_certs(inp, TODAY) == 10


def test_pillar3_caps_at_30():
    kinds = ["wrap", "oeko_tex", "sedex_smeta", "gots", "sa8000", "iso9001"]
    inp = _base(certs=tuple(Cert(kind=k, expires_on=None) for k in kinds))
    assert compute_pillar3_certs(inp, TODAY) == 30


# ------------------------------------------------------------------ pillar 4
def test_pillar4_empty_is_zero():
    assert compute_pillar4_market(_base(), TODAY) == 0


def test_pillar4_caps_at_15():
    inp = _base(
        source_tags=("A", "B", "C", "D", "E"),
        established_date=date(1995, 1, 1),
        employees_total=5000,
        capacity_pcs_day=10000,
        bgmea_verified=True,
    )
    # breadth 7 + tenure 4 + size 2 + cap 1 + verified 1 = 15
    assert compute_pillar4_market(inp, TODAY) == 15


def test_pillar4_breadth_ladder():
    for n, expected in [(0, 0), (1, 0), (2, 2), (3, 4), (4, 6), (5, 7), (8, 7)]:
        tags = tuple(f"S{i}" for i in range(n))
        s = compute_pillar4_market(_base(source_tags=tags), TODAY)
        assert s == expected, f"n={n}"


def test_pillar4_tenure_ladder():
    cases = [
        (date(2000, 1, 1), 4),  # ≥20
        (date(2015, 1, 1), 3),  # ≥10
        (date(2020, 1, 1), 2),  # ≥5
        (date(2025, 1, 1), 1),  # ≥1
        (date(2026, 1, 1), 0),  # <1
    ]
    for est, expected in cases:
        s = compute_pillar4_market(_base(established_date=est), TODAY)
        assert s == expected, est


# ------------------------------------------------------------------ total + trigger interaction
def test_total_caps_at_100():
    inp = _base(
        source_tags=("EPB", "BGMEA", "BKMEA", "BTMA", "BGAPMEA"),
        rjsc_reg_number="x",
        rsc_has_row=True,
        rsc_fire_pct=100,
        rsc_structural_pct=100,
        certs=tuple(
            Cert(kind=k, expires_on=None)
            for k in ("wrap", "oeko_tex", "sedex_smeta", "gots", "sa8000")
        ),
        established_date=date(1990, 1, 1),
        employees_total=3000,
        capacity_pcs_day=20000,
        bgmea_verified=True,
    )
    score = compute_sbi(inp, TODAY)
    assert score.pillar1_legal == 25
    assert score.pillar2_safety == 30
    assert score.pillar3_certs == 30
    assert score.pillar4_market == 15
    assert score.total == 100


def test_total_arithmetic_no_cap():
    inp = _base(source_tags=("BGMEA",), rsc_has_row=False)
    score = compute_sbi(inp, TODAY)
    assert score.total == score.pillar1_legal + score.pillar2_safety + score.pillar3_certs + score.pillar4_market


# ------------------------------------------------------------------ idempotency hash
def test_hash_is_stable():
    inp = _base(source_tags=("BGMEA", "EPB"), certs=(Cert("wrap", None),))
    h1 = compute_inputs_hash(inp, TODAY)
    h2 = compute_inputs_hash(inp, TODAY)
    assert h1 == h2


def test_hash_order_insensitive_for_source_tags():
    a = _base(source_tags=("EPB", "BGMEA"))
    b = _base(source_tags=("BGMEA", "EPB"))
    assert compute_inputs_hash(a, TODAY) == compute_inputs_hash(b, TODAY)


def test_hash_order_insensitive_for_certs():
    a = _base(certs=(Cert("wrap", None), Cert("oeko_tex", None)))
    b = _base(certs=(Cert("oeko_tex", None), Cert("wrap", None)))
    assert compute_inputs_hash(a, TODAY) == compute_inputs_hash(b, TODAY)


def test_hash_changes_on_meaningful_input_change():
    base = _base(source_tags=("BGMEA",))
    changed = _base(source_tags=("BGMEA", "BKMEA"))
    assert compute_inputs_hash(base, TODAY) != compute_inputs_hash(changed, TODAY)


def test_hash_rounds_pct_to_two_dp():
    a = _base(rsc_has_row=True, rsc_fire_pct=87.501)
    b = _base(rsc_has_row=True, rsc_fire_pct=87.502)
    # Both round to 87.50, so the hash should match.
    assert compute_inputs_hash(a, TODAY) == compute_inputs_hash(b, TODAY)


if __name__ == "__main__":
    raise SystemExit(pytest.main([__file__, "-v"]))
