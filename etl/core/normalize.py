"""Company name + phone normalization (spec §4.2)."""
from __future__ import annotations

import re
from urllib.parse import quote, urlparse, urlsplit, urlunsplit

from slugify import slugify
from unidecode import unidecode

# Legal-form tokens only. NEVER strip industry words ("fashion", "apparels",
# "garments", "knitwear", "textile", "bangladesh"…) — those are part of the
# real distinguishing name and stripping them collapsed names like
# "Afrah Fashion Limited" → "afrah" and triggered cross-company false matches.
# `lts` covers the recurring typo for `ltd` seen in BGMEA / WRAP data.
# `plc` is the public-limited-company form — the GOTS register files some
# entities that way (`... Industries PLC.` vs BKMEA's `... Industries Ltd`),
# and an unstripped plc survived slug matching as a trailing token (REZ-56).
_LEGAL_SUFFIX_RE = re.compile(
    r"\s+(ltd\.?|lts\.?|limited|plc\.?|pvt\.?|private|co\.?|company|"
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


# ---------------------------------------------------------------------------
# Extension / facility base-name (REZ-67 / A7, extended REZ-87 / A7b)
# ---------------------------------------------------------------------------
# Python match/detector-side classification. Source of truth for that job;
# ops/repair_bgmea_conflations._compatible delegates here for the extension
# class. public.rsc_extension_base_name is a DIFFERENT job (view-side address
# / registry inheritance, pinned by IMMUTABLE indexes 0055/0056) and must not
# be altered here — B4 owns it. The two are allowed to differ.

_PREVIOUSLY_END_RE = re.compile(r"\s*\(\s*previously\s+[^)]*\)\s*$", re.IGNORECASE)

# One regex per token — mirrors the SQL (nested alternations break PG ARE).
# Every pattern is end-anchored so "N. T. APPARELS UNIT-2 LIMITED" stays None.
_EXT_SQL_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(r"\s*[-(]\s*extension\s*\)?\.?\s*$", re.IGNORECASE),
    re.compile(r"\s*[-(]\s*expansion(\s+buildings?)?\s*\)?\.?\s*$", re.IGNORECASE),
    # Singular + plural "new building(s)" (REZ-87 Direction B).
    re.compile(r"\s*[-(]\s*new\s+buildings?\s*\)?\.?\s*$", re.IGNORECASE),
    re.compile(r"\s*[-(]\s*new\s+location\s*\)?\.?\s*$", re.IGNORECASE),
    # " Unit-N" / " Unit N" / " - Unit N" with optional comma-separated list.
    # Anchored at end so "N. T. APPARELS UNIT-2 LIMITED" is NOT a facility.
    re.compile(r"\s*-?\s*unit[\s-]+[0-9]+(\s*[,-]\s*[0-9]+)*\s*$", re.IGNORECASE),
    re.compile(r"\s*-\s*[0-9]+\s*-\s*$"),
    re.compile(r"\s+-\s*[0-9]+(\s*[,-]\s*[0-9]+)*\s*$"),
)

# Production extras — REZ-67 plus REZ-87 Direction B. Still end-anchored.
_EXT_EXTRA_PATTERNS: tuple[re.Pattern[str], ...] = (
    # (Extension 2) / (Extension area) / (Extension buildings) + trailing junk
    re.compile(r"\s*\(\s*extension(?:\s+[^)]+)?\s*\)+\.?\s*$", re.IGNORECASE),
    # Dash form: "Consist Apparels Ltd. - Extension 2"
    re.compile(r"\s*-\s*extension(?:\s+\d+)?\.?\s*$", re.IGNORECASE),
    # Undelimited: "MNR Sweaters Ltd Extension Building"
    re.compile(r"\s+extension\s+buildings?\.?\s*$", re.IGNORECASE),
    # (Annex building) / - Annex building
    re.compile(r"\s*[-(]\s*annex(?:\s+building)?\s*\)?\.?\s*$", re.IGNORECASE),
    re.compile(r"\s*\(\s*annex(?:\s+building)?\s*\)+\.?\s*$", re.IGNORECASE),
    # (Ext)
    re.compile(r"\s*\(\s*ext\s*\)+\.?\s*$", re.IGNORECASE),
    # (Unit-03) / (Unit-2) — parenthesized unit the SQL end-anchor misses
    # when glued as Ltd.(Unit-03)
    re.compile(r"\s*\(\s*unit[\s-]*[0-9]+\s*\)+\.?\s*$", re.IGNORECASE),
    # Unit-II / Unit II (roman) — REZ-90 needs Univogue … Unit-II
    re.compile(r"\s*-?\s*unit[\s-]+[ivxlcdm]+\.?\s*$", re.IGNORECASE),
    # (U-2) / (U-02)
    re.compile(r"\s*\(\s*u[\s-]*[0-9]+\s*\)+\.?\s*$", re.IGNORECASE),
    # Trailing U-2 / U-02 (space-delimited, end-anchored)
    re.compile(r"\s+u[\s-]+[0-9]+\.?\s*$", re.IGNORECASE),
    # Glued trailing -N after a legal-form period: "Shangu Tex Ltd.-2"
    re.compile(r"(?<=\w)\.\s*-\s*[0-9]+\s*$"),
    # (Woven Unit) / (Sw Unit) / (Knit Unit) style building labels
    re.compile(r"\s*\(\s*(?:woven|sw|knit|sewing)\s+unit\s*\)+\.?\s*$", re.IGNORECASE),
    # (Factory-02) / (Factory 2)
    re.compile(r"\s*\(\s*factory[\s-]*[0-9]+\s*\)+\.?\s*$", re.IGNORECASE),
    # [NEW BUILDING] / [Extension]
    re.compile(
        r"\s*\[\s*(?:new\s+)?(?:building|buildings|extension)s?\s*\]+\.?\s*$",
        re.IGNORECASE,
    ),
    # Extended Building(s) — with or without a dash/paren delimiter
    re.compile(r"\s*[-(]?\s*extended\s+buildings?\s*\)?\.?\s*$", re.IGNORECASE),
    # New Shed
    re.compile(r"\s*[-(]?\s*new\s+shed\s*\)?\.?\s*$", re.IGNORECASE),
    # (relocated) / - relocated / trailing relocated
    re.compile(r"\s*[-(]?\s*relocated\s*\)?\.?\s*$", re.IGNORECASE),
    # Glued "LimitedNew Buildings" / "LtdNew Building"
    re.compile(r"(?<=[A-Za-z])New\s+Buildings?\.?\s*$"),
)


def _strip_extension_suffixes(value: str) -> str:
    """Apply one full pass of SQL + extra strip patterns."""
    out = value
    for pat in _EXT_SQL_PATTERNS:
        out = pat.sub("", out)
    for pat in _EXT_EXTRA_PATTERNS:
        out = pat.sub("", out)
    return out.strip()


def extension_base_name(name: str) -> str | None:
    """Return the mother-company name for an extension-pattern name, else None.

    Python-side source of truth for match/detector classification (REZ-87).
    Ports the SQL patterns and adds production spellings the SQL never saw.
    Loops until stable so stacked suffixes like ``(Unit-2) (Extension)``
    resolve in two passes. Returns None when nothing was stripped or when
    the result would be empty.

    Critical negative: ``N. T. APPARELS UNIT-2 LIMITED`` → None — Unit-2 sits
    inside the registered name followed by LIMITED; every new pattern must
    stay end-anchored so that case cannot become a facility.
    """
    if not name or not str(name).strip():
        return None

    v_clean = _PREVIOUSLY_END_RE.sub("", name).strip()
    if not v_clean:
        return None

    current = v_clean
    # Bound the loop: stacked real-world suffixes are 2–3 deep; 8 is ample.
    for _ in range(8):
        stripped = _strip_extension_suffixes(current)
        if stripped == current:
            break
        current = stripped

    if not current:
        return None
    if current.lower() == v_clean.lower():
        return None
    return current


def _host_of(url: str) -> str:
    host = (urlparse(url).hostname or "").lower()
    return host[4:] if host.startswith("www.") else host


def external_website(href: str | None, *, page_url: str | None) -> str | None:
    """A company's own website, or None when the link points back at the source.

    Registry pages routinely render a blank website cell as `<a href="">`. Read
    directly that yields an empty string and correctly becomes None, but
    Firecrawl resolves hrefs against the page URL before returning the HTML, so
    the same empty anchor arrives as the *member's own profile URL* — which then
    passes a naive `startswith("https://")` check and gets stored as the
    company's website.

    A registry's domain is never a member's website, so same-host is the rule
    that catches this without depending on how the source spelled the blank.
    """
    if not href:
        return None
    candidate = href.strip()
    if not candidate or not candidate.lower().startswith(("http://", "https://")):
        return None
    if page_url:
        host = _host_of(candidate)
        if not host or host == _host_of(page_url):
            return None
    return candidate


# `%` is listed safe so an already-encoded URL is not encoded a second time,
# turning a working `%20` into a broken `%2520`.
_URL_SAFE = "/%:@&=+$,;~*!()'?#[]"


def canonical_url(url: str) -> str:
    """One spelling per resource, whichever transport reported the link.

    Publishers do put spaces in filenames, and the transports disagree on how to
    render them: read directly an href arrives with the literal space intact,
    while Firecrawl returns it percent-encoded. Both fetch the same bytes, so the
    difference is invisible in the data and shows up only in the URL we store as
    the citation — meaning one document accumulates two provenance identities and
    a transport switch silently rewrites the source URL on existing rows.

    Percent-encoding is the canonical direction because a literal space is not
    valid in a URI, so encoding converges the two spellings on the legal one.
    """
    parts = urlsplit(url.strip())
    return urlunsplit(
        (
            parts.scheme,
            parts.netloc,
            quote(parts.path, safe=_URL_SAFE),
            quote(parts.query, safe=_URL_SAFE),
            parts.fragment,
        )
    )


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
