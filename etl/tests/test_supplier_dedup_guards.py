"""Guards on supplier identity matching in `_find_existing`.

Every pair below was observed in production on 31 Jul 2026, when 82 suppliers
were found holding BKMEA member records for more than one company. Two factories
merged into one profile is the worst failure this pipeline has: the resulting
row publishes one company's worker count, certifications and buyer list under
another company's name, and nothing downstream can tell it happened.

The "must still merge" set is the counterweight. A guard that stops conflation
by refusing every match just trades a silent wrong answer for a pile of
duplicates, so both directions are pinned.
"""
from __future__ import annotations

import pytest

from etl.core.normalize import normalize_company_name
from etl.core.upsert import _contact_match_allowed, _names_compatible


def _norm(a: str, b: str) -> tuple[str, str]:
    return normalize_company_name(a), normalize_company_name(b)


# Merged on a shared switchboard number or a shared group mailbox. Bangladesh
# RMG groups run many legally distinct factories off one of each, so contact
# overlap on its own is not identity.
CONTACT_CONFLATIONS = [
    ("ABANTI COLOUR TEX LTD.", "CRONY APPARELS LTD"),        # sunny@abanti.net
    ("SWEATER HEAVEN LTD", "FATULLAH FASHION LTD."),         # ffashion@bol-online.com
    ("ABONI KNITWEAR LTD.", "ABONI TEXTILE LTD."),           # 01636312632
    ("FAKIR APPARELS LTD", "FAKIR FASHION LTD."),            # 01711547676
    ("MOONTAHA APPARELS LTD.", "MOONTAHA FASHION LTD."),     # 01714306729
    ("INGENITEX (BD) LIMITED", "EUPHORIA APPARELS LTD."),    # 01819412700
    ("SHATABDI FASHION", "SHATABDI APPARELS LTD"),           # 01819242562
    ("WEST FASHION", "WEST KNITWEAR LTD."),                  # 01711544163
    ("KAKADO TRADING BANGLADESH LTD.", "KAKADO BANGLADESH LTD."),
]

# Merged by Pass 4. `token_sort_ratio` sorts tokens before comparing, so it
# cannot see word order or a one-letter change to an initials block.
FUZZY_CONFLATIONS = [
    ("COTTON FAIR (PVT) LTD", "FAIR COTTON (PVT) LTD"),      # scores 100
    ("H. R TEXTILE MILLS LTD.", "G.R TEXTILE MILLS LTD"),    # scores 94
    ("S. B. KNITWEAR", "B. S KNITWEAR"),
    ("R. K FASHION LTD.", "K. R TEXTILE LTD"),
    ("A. M. S KNITWEAR LTD.", "M. A. S FASHION (BD) LTD"),
]

# One company, written down two ways.
TRUE_VARIANTS = [
    ("KNIT RADIX LTD", "Knit Radix Limited"),
    ("AIM KNITWEAR LTD", "AIM KNITWEAR LTD."),
    ("E. E. C BANGLA KNIT WEARS LTD.", "E. E.C BANGLA KNIT WEARS LTD"),
    ("IMPERIAL KNITTING INDUSTRIES LTD.", "IMPERIAL KNITTING INDUSTRIES LTD"),
    ("Fakir Apparels Ltd", "FAKIR APPARELS LIMITED"),
    ("Ha-Meem Sportswear Ltd.", "HA MEEM SPORTSWEAR LTD"),
    ("J. M. KNITWEAR LTD.", "J.M KNITWEAR LIMITED"),
    ("Sincere Knit Wears Ltd", "SINCERE KNITWEAR LTD"),
]


@pytest.mark.parametrize(("a", "b"), CONTACT_CONFLATIONS)
def test_shared_contact_does_not_merge_different_companies(a: str, b: str) -> None:
    assert _contact_match_allowed(*_norm(a, b)) is False


@pytest.mark.parametrize(("a", "b"), FUZZY_CONFLATIONS)
def test_fuzzy_name_does_not_merge_different_companies(a: str, b: str) -> None:
    assert _names_compatible(*_norm(a, b)) is False


@pytest.mark.parametrize(("a", "b"), TRUE_VARIANTS)
def test_true_variants_still_merge(a: str, b: str) -> None:
    na, nb = _norm(a, b)
    assert _names_compatible(na, nb) is True
    assert _contact_match_allowed(na, nb) is True


def test_contact_match_needs_a_name_to_corroborate() -> None:
    """A candidate with no recorded name cannot be confirmed, so it is refused."""
    assert _contact_match_allowed("knit radix", None) is False
    assert _contact_match_allowed("knit radix", "") is False
