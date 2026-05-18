"""Company name + phone normalization (spec §4.2)."""
from __future__ import annotations

import re

from slugify import slugify
from unidecode import unidecode

# Legal-form tokens only. NEVER strip industry words ("fashion", "apparels",
# "garments", "knitwear", "textile", "bangladesh"…) — those are part of the
# real distinguishing name and stripping them collapsed names like
# "Afrah Fashion Limited" → "afrah" and triggered cross-company false matches.
# `lts` covers the recurring typo for `ltd` seen in BGMEA / WRAP data.
_LEGAL_SUFFIX_RE = re.compile(
    r"\s+(ltd\.?|lts\.?|limited|pvt\.?|private|co\.?|company|"
    r"corp\.?|corporation|inc\.?|incorporated|llc|llp)\.?\s*$",
    re.IGNORECASE,
)

# Curly/smart quotes + en/em dash + nbsp -> ASCII equivalents.
# Run BEFORE unidecode so we keep semantic distinctions (apostrophes drop, dashes -> hyphen).
_PUNCT_FOLD = str.maketrans({
    "\u2018": "'", "\u2019": "'", "\u201A": "'", "\u201B": "'",
    "\u201C": '"', "\u201D": '"', "\u201E": '"', "\u201F": '"',
    "\u2013": "-", "\u2014": "-", "\u2212": "-",
    "\u00A0": " ",  # nbsp
})

# Strip "(Previously X)" / "(previously X)" annotations from canonical names.
_PREVIOUSLY_RE = re.compile(r"\s*\(\s*previously[^)]*\)", re.IGNORECASE)

# Possessive 's — keep the stem, drop the dangling s.  "Sadia Wear's" → "Sadia Wear".
_POSSESSIVE_RE = re.compile(r"'s\b", re.IGNORECASE)

# Token-level abbreviation expansions (whole-word boundaries) — applied AFTER
# lowercase + ASCII fold but BEFORE punctuation strip, so that "Inds." and
# "Ind." both expand to "industries" and collide on the same normalized form.
# Order matters: collapse the multi-word "knit wear" BEFORE plural fixes.
_ABBREV_RULES: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"\bknit[\s\-]*wear(s)?\b", re.IGNORECASE), "knitwear"),
    (re.compile(r"\bknitwears\b", re.IGNORECASE), "knitwear"),
    (re.compile(r"\bsweaters\b", re.IGNORECASE), "sweater"),
    (re.compile(r"\bwears\b", re.IGNORECASE), "wear"),
    (re.compile(r"\binds\.?\b", re.IGNORECASE), "industries"),
    (re.compile(r"\bind\.?\b", re.IGNORECASE), "industries"),
    (re.compile(r"\bindus\.?\b", re.IGNORECASE), "industries"),
    (re.compile(r"\bindustry\b", re.IGNORECASE), "industries"),
    (re.compile(r"\bmfg\.?\b", re.IGNORECASE), "manufacturing"),
    (re.compile(r"\bmanf\.?\b", re.IGNORECASE), "manufacturing"),
    (re.compile(r"\bbros\.?\b", re.IGNORECASE), "brothers"),
    (re.compile(r"\bint\.?\b", re.IGNORECASE), "international"),
    (re.compile(r"\bintl\.?\b", re.IGNORECASE), "international"),
    (re.compile(r"\bfabs\.?\b", re.IGNORECASE), "fabrics"),
    (re.compile(r"\bgmts\.?\b", re.IGNORECASE), "garments"),
    (re.compile(r"\bgar\.?\b", re.IGNORECASE), "garments"),
]


def _collapse_initials(n: str) -> str:
    """Join a run of >=2 single-letter alphabetic tokens into one token.
    "j m fabrics" -> "jm fabrics"; "k m nobely" -> "km nobely".
    A solo single-letter token is left alone (rare and safer not to merge with neighbours)."""
    tokens = n.split()
    out: list[str] = []
    i = 0
    while i < len(tokens):
        if len(tokens[i]) == 1 and tokens[i].isalpha():
            j = i
            while j < len(tokens) and len(tokens[j]) == 1 and tokens[j].isalpha():
                j += 1
            if j - i >= 2:
                out.append("".join(tokens[i:j]))
                i = j
                continue
        out.append(tokens[i])
        i += 1
    return " ".join(out)


def clean_display_name(name: str) -> str:
    """Cleanup for the human-facing `company_name`: trim, fold smart punctuation,
    drop trailing '(Previously X)' annotation, collapse whitespace.
    Does NOT lowercase, does NOT strip suffixes (those happen in normalize)."""
    if not name:
        return ""
    n = name.translate(_PUNCT_FOLD)
    n = _PREVIOUSLY_RE.sub("", n)
    n = re.sub(r"\s+", " ", n).strip()
    return n


def normalize_company_name(name: str) -> str:
    n = (name or "").translate(_PUNCT_FOLD)
    n = unidecode(n).lower().strip()
    # Drop possessive 's BEFORE punctuation strip so "wear's" -> "wear"
    # (otherwise '\'' is stripped and leaves an orphan "s" token).
    n = _POSSESSIVE_RE.sub("", n)
    # ' & ' and ' and ' should hash the same
    n = re.sub(r"\s*&\s*", " and ", n)
    # Apply token-level abbreviation expansions (Inds. -> industries, etc.)
    for pat, repl in _ABBREV_RULES:
        n = pat.sub(repl, n)
    n = re.sub(r"[^\w\s]", " ", n)
    n = re.sub(r"\s+", " ", n).strip()
    # Strip recurring legal suffixes (loop in case "ltd. co. ltd.")
    for _ in range(4):
        new = _LEGAL_SUFFIX_RE.sub("", n).strip()
        if new == n:
            break
        n = new
    # Collapse initials AFTER suffix strip so "j m fabrics ltd" -> "j m fabrics" -> "jm fabrics"
    n = _collapse_initials(n)
    return n


def make_slug(name: str) -> str:
    """Slug derived from the normalized form so 'KNIT RADIX LTD' and
    'Knit Radix Limited' produce the same slug."""
    return slugify(normalize_company_name(name))


_PHONE_SPLIT_RE = re.compile(r"[,/;|]+|\s{2,}")
_PHONE_CLEAN_RE = re.compile(r"[^\d+]")


def normalize_phones(raw: str | None) -> list[str]:
    if not raw:
        return []
    out: list[str] = []
    for chunk in _PHONE_SPLIT_RE.split(raw):
        c = _PHONE_CLEAN_RE.sub("", chunk)
        if not c:
            continue
        if not c.startswith("+"):
            # Bangladesh default country code
            digits = c.lstrip("0")
            if len(digits) >= 10 and digits.startswith("880"):
                c = "+" + digits
            elif 7 <= len(digits) <= 11:
                c = "+880" + digits
        if len(c) >= 8 and c not in out:
            out.append(c)
    return out
