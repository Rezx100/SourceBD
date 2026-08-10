"""Shared BD place canonicalization lexicon (REZ-28).

Approved by founder 28 Jul 2026. Do NOT add pairs that are not in the
confirmed checklist. Negatives are enforced by omission:
  - Sreepur ≠ Sripur → neither appears here.
  - Bare "Nawabganj" ≠ Chapainawabganj → only "Chapai Nawabganj" maps here.

USAGE: call `apply_place_lexicon(lowercased_input)`.
  - Input MUST be pre-lowercased (the function does not lowercase).
  - All replacements produce lowercase canonical output.
  - Raw source strings are NEVER overwritten — use only for geocode
    address_norm keys and address comparison keys.

LOCKSTEP: keep in sync with `lib/bd-place-lexicon.ts`.
"""
from __future__ import annotations

import re

# Each entry: (compiled_pattern, canonical_replacement)
# Patterns run on pre-lowercased text. Order matters — longest / most specific
# patterns must precede shorter ones.
_LEXICON: list[tuple[re.Pattern[str], str]] = [
    # ---- Multi-word long forms first ----
    (re.compile(r"\bkorean\s+export\s+processing\s+zone\b"), "karnaphuli epz"),
    (re.compile(r"\bkorean\s+epz\b"), "karnaphuli epz"),
    (re.compile(r"\bchapai\s+nawabganj\b"), "chapainawabganj"),
    (re.compile(r"\bnational\s+university\b"), "board bazar"),
    (re.compile(r"\bb\.?\s*baria\b"), "brahmanbaria"),
    (re.compile(r"\bcox'?s?\s+bazar\b"), "cox's bazar"),

    # ---- EPZ acronyms (ccepz before cepz to avoid partial match) ----
    (re.compile(r"\bccepz\b"), "cumilla epz"),
    (re.compile(r"\bdepz\b"), "savar"),
    (re.compile(r"\baepz\b"), "adamjee epz"),
    (re.compile(r"\bcepz\b"), "chattogram epz"),
    (re.compile(r"\bkepz\b"), "karnaphuli epz"),
    (re.compile(r"\bmepz\b"), "mongla epz"),
    (re.compile(r"\biepz\b"), "ishwardi epz"),
    (re.compile(r"\buepz\b"), "uttara epz"),

    # ---- Single-word aliases that expand (negative lookahead for already-expanded) ----
    (re.compile(r"\badamjee(?!\s+epz)\b"), "adamjee epz"),
    (re.compile(r"\bkarnaphuli(?!\s+epz)\b"), "karnaphuli epz"),
    (re.compile(r"\bmongla(?!\s+epz)\b"), "mongla epz"),
    (re.compile(r"\bdhour\b"), "turag"),
    (re.compile(r"\bbanasree\b"), "rampura"),
    (re.compile(r"\bbsmrau\b"), "salna"),

    # ---- Romanization / transliteration corrections ----
    (re.compile(r"\bchittagong\b"), "chattogram"),
    (re.compile(r"\bctg\b"), "chattogram"),
    (re.compile(r"\bdacca\b"), "dhaka"),
    (re.compile(r"\bbayzid\b"), "baizid"),
    (re.compile(r"\bdhanmandi\b"), "dhanmondi"),
    # Narayanganj: abbreviation "n.ganj" / "n ganj" and gonj spelling
    (re.compile(r"\bn[\s.]?ganj\b"), "narayanganj"),
    (re.compile(r"\bnarayangonj\b"), "narayanganj"),
    # Siddhirganj
    (re.compile(r"\bsiddirgonj\b"), "siddhirganj"),
    (re.compile(r"\bsiddhirgonj\b"), "siddhirganj"),
    # Mymensingh variants
    (re.compile(r"\bmaymashingo\b"), "mymensingh"),
    (re.compile(r"\bmaymanshingh\b"), "mymensingh"),
    (re.compile(r"\bmymensing\b"), "mymensingh"),
    # New pairs (A1–A2 from checklist)
    (re.compile(r"\bvaluka\b"), "bhaluka"),
    (re.compile(r"\bjamairdia\b"), "jamirdia"),
    # District corrections (C1 from checklist)
    (re.compile(r"\bkishorganj\b"), "kishoreganj"),
    (re.compile(r"\bmanikgonj\b"), "manikganj"),
    (re.compile(r"\bmunshigonj\b"), "munshiganj"),
    (re.compile(r"\bnarshingdi\b"), "narsingdi"),
    (re.compile(r"\bcomilla\b"), "cumilla"),
    (re.compile(r"\bkhagrachari\b"), "khagrachhari"),
    (re.compile(r"\blaxmipur\b"), "lakshmipur"),
    (re.compile(r"\bbogra\b"), "bogura"),
    (re.compile(r"\bjaipurhat\b"), "joypurhat"),
    (re.compile(r"\bsirajgonj\b"), "sirajganj"),
    (re.compile(r"\bjessore\b"), "jashore"),
    (re.compile(r"\bjhenidah\b"), "jhenaidah"),
    (re.compile(r"\bbarisal\b"), "barishal"),
    (re.compile(r"\bjhalokathi\b"), "jhalokati"),
    (re.compile(r"\bhabigonj\b"), "habiganj"),
    (re.compile(r"\bmoulavibazar\b"), "moulvibazar"),
    (re.compile(r"\bsunamgonj\b"), "sunamganj"),
    (re.compile(r"\bpanchagar\b"), "panchagarh"),
    (re.compile(r"\bnetrakona\b"), "netrokona"),
    # Locality corrections (C2 from checklist)
    (re.compile(r"\bkaliakoir\b"), "kaliakair"),
    (re.compile(r"\brupgonj\b"), "rupganj"),
    (re.compile(r"\bsitakundu\b"), "sitakunda"),
    (re.compile(r"\bmirsharai\b"), "mirsarai"),
    (re.compile(r"\basadgonj\b"), "asadganj"),
    (re.compile(r"\bkeraneganj\b"), "keraniganj"),
    # REZ-112: Gazipur locality Bhawal / Vawal (Epyllion Bahadurpur twin)
    (re.compile(r"\bvawal\b"), "bhawal"),
]


def apply_place_lexicon(lowercased_input: str) -> str:
    """Apply the approved BD place lexicon to a pre-lowercased address string.

    Returns the string with all matched variants replaced by canonical forms.
    Input MUST already be lowercased.
    """
    s = lowercased_input
    for pattern, replacement in _LEXICON:
        s = pattern.sub(replacement, s)
    return s
