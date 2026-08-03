"""Name-variant report class in `ops/audit_cross_register_coverage.py`.

The scan (founder decision B, 4 Aug 2026) catches compounding and
single-letter register spellings that recomputed-slug equality and the
92-point fuzzy bar both miss. Every pair pinned here was observed in the
3 Aug 2026 production scan: the certain-review band is the founder's
seeded-merge review list, and the noise floor below ~94 is real — the
different-company pairs must NEVER reach the certain band.
"""
from __future__ import annotations

from datetime import date

import pytest

from etl.core.normalize import make_slug, normalize_company_name
from ops.audit_cross_register_coverage import Member, variant_pairs

_TIER = {
    "EPB": "tier1_gov",
    "RSC": "tier1_gov",
    "BGMEA": "tier2_industry",
    "BKMEA": "tier2_industry",
    "GOTS": "tier3_cert",
    "OEKO_TEX": "tier3_cert",
}


def _member(mid: str, name: str, codes: list[str], address: str = "") -> Member:
    m = Member(
        id=mid,
        name=name,
        stored_norm="",
        stored_slug="",
        created_at=date(2026, 1, 1),
        source_tags=list(codes),
        ext_base=None,
        address_raw=address,
    )
    m.rec_norm = normalize_company_name(name)
    m.rec_slug = make_slug(name)
    m.records = [{"code": c, "tier": _TIER[c]} for c in codes]
    return m


def _pair(pairs, ida: str, idb: str):
    for p in pairs:
        if {p.a.id, p.b.id} == {ida, idb}:
            return p
    return None


# Squashed-name-identical pairs from the 3 Aug 2026 scan (name similarity
# 100 on the space-stripped forms) — the WEST KNITWEAR class.
SQUASHED_VARIANTS = [
    ("Master Cham Ltd.", "Mastercham ltd."),
    ("Honeywell Garments Limited", "Honey Well Garments Ltd."),
    ("KNIT MEN COMPOSITE LTD.", "Knitmen Composite Ltd."),
    ("CADTEX GARMENTS LIMITED", "Cad Tex Garments Limited"),
    ("3-A FASHIONS LTD.", "3A Fashions Ltd."),
    ("MIDLINE SWEATER LTD.", "Mid Line Sweater Ltd."),
    ("EURO KNIT SPIN GARMENTS LTD.", "Euro Knitspin Garments Ltd"),
    ("Mac-Tex Industries Ltd.", "MACTEX INDUSTRIES LTD"),
    ("Reytex Fashion Wears Ltd.", "Rey-Tex Fashion Wears Ltd."),
    ("Zeysha Fashion Wear Ltd", "Zeysha Fashionwear Ltd."),
    ("GREEN LIFE KNITTEX LTD.", "Greenlife Knittex Ltd"),
    ("POLESTAR KNIT COMPOSITE LTD.", "Pole Star Knit Composite Ltd"),
]


@pytest.mark.parametrize(("a", "b"), SQUASHED_VARIANTS)
def test_squashed_variants_are_certain_review(a: str, b: str) -> None:
    members = {"m1": _member("m1", a, ["BGMEA"]), "m2": _member("m2", b, ["OEKO_TEX"])}
    p = _pair(variant_pairs(members), "m1", "m2")
    assert p is not None
    assert p.band == "certain-review"


def test_sarada_pair_certain_via_street_number_agreement() -> None:
    """The 3 Aug founder-confirmed pair: 96.3 similarity + shared premises."""
    members = {
        "m1": _member(
            "m1", "Sarada Knit Wear Ltd.", ["BGMEA"],
            "56, S.M. Maleh Road, Narayanganj, Tanbazar",
        ),
        "m2": _member(
            "m2", "SARDA KNITWEAR LTD", ["BKMEA"],
            "56, S.M. MALEHA ROAD, NARAYANGANJ",
        ),
    }
    p = _pair(variant_pairs(members), "m1", "m2")
    assert p is not None
    assert p.squashed_identical is False
    assert p.ratio >= 96.0
    assert p.number_agree is True
    assert p.band == "certain-review"
    # City tokens are excluded from locality corroboration.
    assert "narayanganj" not in p.shared_locality
    assert "road" in p.shared_locality


# >= 96 but NOT squashed-identical: register typos / spelling drift. These
# need the address corroboration to reach the certain band.
HIGH_RATIO_VARIANTS = [
    ("POLO COMPOSITIE KNIT INDUSTRY LTD.", "Polo Composite Knit Ind. LTD."),
    ("COTTTON TEXTILE & APPARELS LTD", "Cotton Textile and Apparels Ltd."),
    ("LIDA TEXTILE AND DYING LTD.", "Lida Textile & Dyeing Limited"),
    ("Radisson Garments Limited", "Radission Garments Ltd."),
]


@pytest.mark.parametrize(("a", "b"), HIGH_RATIO_VARIANTS)
def test_high_ratio_needs_address_corroboration(a: str, b: str) -> None:
    uncorroborated = {
        "m1": _member("m1", a, ["BKMEA"], "Narayanganj"),
        "m2": _member("m2", b, ["BGMEA"], "Dhaka"),
    }
    p = _pair(variant_pairs(uncorroborated), "m1", "m2")
    assert p is not None
    assert p.ratio >= 96.0
    assert p.number_agree is False
    assert p.band == "review"

    corroborated = {
        "m1": _member("m1", a, ["BKMEA"], "Plot 45, BSCIC Estate"),
        "m2": _member("m2", b, ["BGMEA"], "45, BSCIC Industrial Estate"),
    }
    p = _pair(variant_pairs(corroborated), "m1", "m2")
    assert p is not None
    assert p.number_agree is True
    assert p.band == "certain-review"


def test_street_number_conflict_demotes_identical_names() -> None:
    """Same name at different premises is the sister-company class."""
    members = {
        "m1": _member("m1", "Master Cham Ltd.", ["BGMEA"], "House 10, Road 5, Savar"),
        "m2": _member("m2", "Mastercham ltd.", ["EPB"], "House 99, Road 7, Gazipur"),
    }
    p = _pair(variant_pairs(members), "m1", "m2")
    assert p is not None
    assert p.squashed_identical is True
    assert p.number_conflict is True
    assert p.band == "review"


# The noise floor is real: these are genuinely different companies observed
# in the 3 Aug scan. They may surface as review-band candidates but must
# NEVER reach the certain band.
NOISE_FLOOR = [
    ("DK KNIT WEAR LTD", "YK KNITWEAR LIMITED"),
    ("MALEK SPINNING MILLS PLC.", "EK Spinning Mills Ltd."),
    ("PANDAMIC FASHION LTD", "Pandemic Fashions Ltd."),
]


@pytest.mark.parametrize(("a", "b"), NOISE_FLOOR)
def test_noise_floor_never_reaches_certain_band(a: str, b: str) -> None:
    members = {"m1": _member("m1", a, ["BGMEA"]), "m2": _member("m2", b, ["BKMEA"])}
    p = _pair(variant_pairs(members), "m1", "m2")
    assert p is None or p.band == "review"


def test_extension_pairs_are_excluded() -> None:
    """Unit-suffix siblings are the extension class — never merge candidates."""
    members = {
        "m1": _member("m1", "Univogue Garments Co. Ltd. Unit-3", ["BKMEA"]),
        "m2": _member("m2", "Univogue Garments Co. Ltd (Unit-2)", ["RSC"]),
    }
    assert _pair(variant_pairs(members), "m1", "m2") is None


def test_subset_evidence_sets_are_not_variant_candidates() -> None:
    """Fragmented Tier 1-3 sets are required: each side must hold a code the
    other lacks. A subset pair is the slug-equal/shared-ref classes' work."""
    members = {
        "m1": _member("m1", "Master Cham Ltd.", ["BGMEA"]),
        "m2": _member("m2", "Mastercham ltd.", ["BGMEA", "EPB"]),
    }
    assert _pair(variant_pairs(members), "m1", "m2") is None


def test_short_names_are_excluded() -> None:
    """Below the min squashed length char ratios are meaningless."""
    members = {
        "m1": _member("m1", "A B Style Ltd", ["BGMEA"]),
        "m2": _member("m2", "AB Style Ltd.", ["EPB"]),
    }
    assert _pair(variant_pairs(members), "m1", "m2") is None


def test_ratio_floor_excludes_different_companies_sharing_a_gram() -> None:
    members = {
        "m1": _member("m1", "ABC Knitwear Ltd", ["BGMEA"]),
        "m2": _member("m2", "XYZ Knitwear Ltd", ["BKMEA"]),
    }
    assert _pair(variant_pairs(members), "m1", "m2") is None


def test_grams_shared_by_too_many_suppliers_are_dropped() -> None:
    """A 4-gram shared by >40 suppliers carries no discriminating signal: 41
    identically-named suppliers produce ZERO candidates because every gram of
    the shared name is undiscriminating at that frequency."""
    members = {}
    for i in range(41):
        members[f"x{i:02d}"] = _member(
            f"x{i:02d}", "Alpha Variant Textiles Ltd", ["BGMEA"] if i % 2 == 0 else ["EPB"]
        )
    assert variant_pairs(members) == []


def test_gram_shared_by_exactly_40_suppliers_survives() -> None:
    """The drop boundary is >40: at exactly 40 the grams still discriminate."""
    members = {}
    for i in range(40):
        members[f"x{i:02d}"] = _member(
            f"x{i:02d}", "Alpha Variant Textiles Ltd", ["BGMEA"] if i % 2 == 0 else ["EPB"]
        )
    pairs = variant_pairs(members)
    assert pairs
    assert all(p.squashed_identical for p in pairs)


def test_known_pairs_are_subtracted() -> None:
    """Pairs the slug/fuzzy/shared-ref signals already report stay disjoint."""
    members = {
        "m1": _member("m1", "Master Cham Ltd.", ["BGMEA"]),
        "m2": _member("m2", "Mastercham ltd.", ["EPB"]),
    }
    assert _pair(variant_pairs(members), "m1", "m2") is not None
    assert _pair(variant_pairs(members, {("m1", "m2")}), "m1", "m2") is None
