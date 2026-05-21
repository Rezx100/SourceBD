"""SBI score formulas — pure functions, no DB.

Weights per `supabase/migrations/0001_phase0_core.sql` and `context/architecture.md`:
    Pillar 1 — Legal               25
    Pillar 2 — Safety & Remediation 30
    Pillar 3 — Certifications      30
    Pillar 4 — Market Credibility  15
    --------------------------------
    Total (cap)                    100

Sanctioned suppliers are forced to total=0 by the `enforce_sanctions_zero`
trigger on `public.sbi_scores` — the calculator does NOT inspect `is_sanctioned`.

UFLPA traceability bonus (0–10, US buyers only — addendum GAP 8) is a
display-time additive computed in the app layer; it is NOT stored here
(the trigger caps `total` at 100 and the table has no bonus column).
"""
from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field
from datetime import date


@dataclass(frozen=True)
class Cert:
    kind: str
    expires_on: date | None


@dataclass(frozen=True)
class SbiInputs:
    supplier_id: str
    source_tags: tuple[str, ...] = ()
    bgmea_reg_numbers: tuple[str, ...] = ()
    bkmea_reg_number: str | None = None
    rjsc_reg_number: str | None = None
    epb_erc_number: str | None = None
    bgmea_verified: bool = False
    bkmea_verified: bool = False
    bgapmea_verified: bool = False
    btma_verified: bool = False
    rsc_fire_pct: float | None = None
    rsc_structural_pct: float | None = None
    rsc_has_row: bool = False
    certs: tuple[Cert, ...] = field(default_factory=tuple)
    established_date: date | None = None
    employees_total: int | None = None
    capacity_pcs_day: int | None = None
    capacity_dozen_yearly: int | None = None


_REGISTER_TAGS = ("EPB", "BGMEA", "BKMEA", "BTMA", "BGAPMEA")


def _has_tag(inputs: SbiInputs, code: str) -> bool:
    return code in inputs.source_tags


# ---------------------------------------------------------------- Pillar 1
def compute_pillar1_legal(inputs: SbiInputs) -> int:
    """Legal evidence — max 25."""
    s = 0
    if _has_tag(inputs, "EPB") or inputs.epb_erc_number:
        s += 8
    if inputs.rjsc_reg_number:
        s += 4
    if _has_tag(inputs, "BGMEA") or inputs.bgmea_reg_numbers:
        s += 5
    if _has_tag(inputs, "BKMEA") or inputs.bkmea_reg_number:
        s += 4
    reg_bonus = 0
    if _has_tag(inputs, "BTMA") or inputs.btma_verified:
        reg_bonus += 2
    if _has_tag(inputs, "BGAPMEA") or inputs.bgapmea_verified:
        reg_bonus += 2
    s += min(4, reg_bonus)
    register_count = sum(
        1
        for code in _REGISTER_TAGS
        if _has_tag(inputs, code)
        or (code == "BGMEA" and inputs.bgmea_reg_numbers)
        or (code == "BKMEA" and inputs.bkmea_reg_number)
        or (code == "EPB" and inputs.epb_erc_number)
    )
    if register_count >= 2:
        s += 4
    return min(25, s)


# ---------------------------------------------------------------- Pillar 2
def _fire_ladder(pct: float | None) -> int:
    p = pct or 0
    if p >= 100:
        return 15
    if p >= 80:
        return 12
    if p >= 60:
        return 8
    if p > 0:
        return 3
    return 0


def _structural_ladder(pct: float | None) -> int:
    p = pct or 0
    if p >= 100:
        return 10
    if p >= 80:
        return 8
    if p >= 60:
        return 5
    if p > 0:
        return 2
    return 0


def compute_pillar2_safety(inputs: SbiInputs) -> int:
    """RSC safety + DIFE — max 30. Verbatim from data-pipeline-spec §6.2.

    Suppliers with no RSC row score 0 (no safety evidence → no reward).
    """
    if not inputs.rsc_has_row:
        return 0
    fire = _fire_ladder(inputs.rsc_fire_pct)
    structural = _structural_ladder(inputs.rsc_structural_pct)
    dife = 5  # default; no DIFE violation source wired yet
    return min(30, fire + structural + dife)


# ---------------------------------------------------------------- Pillar 3
_CERT_POINTS: dict[str, int] = {
    "wrap": 10,
    "oeko_tex": 7,
    "sedex_smeta": 6,
    "gots": 5,
    "grs": 5,
    "rcs": 5,
    "fairtrade": 5,
    "sa8000": 5,
    "iso9001": 3,
    "iso14001": 3,
    "iso45001": 3,
    "bci": 3,
}


def compute_pillar3_certs(inputs: SbiInputs, today: date) -> int:
    """Active certifications — max 30. Count each cert kind at most once
    (highest-value live cert per kind).

    A cert with `expires_on IS NULL` is treated as **unknown**, not active —
    no validity date in our raw payload means we cannot claim the cert is
    currently valid. This avoids counting evidence we don't have.
    """
    best: dict[str, int] = {}
    for cert in inputs.certs:
        if cert.expires_on is None or cert.expires_on < today:
            continue
        pts = _CERT_POINTS.get(cert.kind, 0)
        if pts > best.get(cert.kind, 0):
            best[cert.kind] = pts
    return min(30, sum(best.values()))


# ---------------------------------------------------------------- Pillar 4
def _years_in_op(established: date | None, today: date) -> int:
    if established is None:
        return 0
    years = today.year - established.year
    if (today.month, today.day) < (established.month, established.day):
        years -= 1
    return max(0, years)


def compute_pillar4_market(inputs: SbiInputs, today: date) -> int:
    """Market credibility — max 15."""
    breadth = min(7, max(0, len(inputs.source_tags) - 1) * 2)

    years = _years_in_op(inputs.established_date, today)
    if years >= 20:
        tenure = 4
    elif years >= 10:
        tenure = 3
    elif years >= 5:
        tenure = 2
    elif years >= 1:
        tenure = 1
    else:
        tenure = 0

    e = inputs.employees_total or 0
    if e >= 2000:
        size = 2
    elif e >= 500:
        size = 1
    else:
        size = 0

    cap = 1 if (inputs.capacity_pcs_day or inputs.capacity_dozen_yearly) else 0
    verified = 1 if (
        inputs.bgmea_verified
        or inputs.bkmea_verified
        or inputs.bgapmea_verified
        or inputs.btma_verified
    ) else 0

    return min(15, breadth + tenure + size + cap + verified)


# ---------------------------------------------------------------- public API
@dataclass(frozen=True)
class SbiScore:
    pillar1_legal: int
    pillar2_safety: int
    pillar3_certs: int
    pillar4_market: int
    total: int
    inputs_hash: str


def compute_inputs_hash(inputs: SbiInputs, today: date) -> str:
    """Stable sha256 over the canonical pillar inputs. Order-insensitive
    where order is meaningless (source_tags, certs, reg numbers)."""
    payload = {
        "source_tags": sorted(inputs.source_tags),
        "bgmea_reg_numbers": sorted(inputs.bgmea_reg_numbers),
        "bkmea_reg_number": inputs.bkmea_reg_number,
        "rjsc_reg_number": inputs.rjsc_reg_number,
        "epb_erc_number": inputs.epb_erc_number,
        "bgmea_verified": inputs.bgmea_verified,
        "bkmea_verified": inputs.bkmea_verified,
        "bgapmea_verified": inputs.bgapmea_verified,
        "btma_verified": inputs.btma_verified,
        "rsc_has_row": inputs.rsc_has_row,
        "rsc_fire_pct": round(inputs.rsc_fire_pct, 2) if inputs.rsc_fire_pct is not None else None,
        "rsc_structural_pct": round(inputs.rsc_structural_pct, 2)
        if inputs.rsc_structural_pct is not None
        else None,
        "certs": sorted(
            [[c.kind, c.expires_on.isoformat() if c.expires_on else None] for c in inputs.certs]
        ),
        "established_date": inputs.established_date.isoformat() if inputs.established_date else None,
        "employees_total": inputs.employees_total,
        "capacity_pcs_day": inputs.capacity_pcs_day,
        "capacity_dozen_yearly": inputs.capacity_dozen_yearly,
        "today_year": today.year,  # cert-expiry boundary moves once per year
        "_formula_version": 1,
    }
    blob = json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(blob.encode("utf-8")).hexdigest()


def compute_sbi(inputs: SbiInputs, today: date) -> SbiScore:
    p1 = compute_pillar1_legal(inputs)
    p2 = compute_pillar2_safety(inputs)
    p3 = compute_pillar3_certs(inputs, today)
    p4 = compute_pillar4_market(inputs, today)
    return SbiScore(
        pillar1_legal=p1,
        pillar2_safety=p2,
        pillar3_certs=p3,
        pillar4_market=p4,
        total=min(100, p1 + p2 + p3 + p4),
        inputs_hash=compute_inputs_hash(inputs, today),
    )
