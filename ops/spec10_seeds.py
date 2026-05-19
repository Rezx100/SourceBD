"""Spec 10 parent-group seeds and shared helpers.

Curated, conservative. Each seed names a Bangladesh RMG corporate parent whose
member factories are *name-identifiable* from public registers. Patterns are
PostgreSQL regular expressions matched against `suppliers.company_name_norm`
(already lowercased, punctuation-stripped, possessive-stripped).

Parents whose member factories do NOT carry the parent name in their public
register entry (e.g. DBL Group's Matin Spinning Mills / Mawna Fashions; most
of Palmal Group post-rebrand) are intentionally NOT in this list. Adding them
would require a Tier-1/2 curated corporate roster (out of scope for Spec 10).
"""
from __future__ import annotations

# Stop-list for algorithmic first-significant-token clustering. These words are
# common across thousands of BD garments names and would create giant junk
# clusters that are not real corporate parents.
STOP_TOKENS: set[str] = {
    "limited", "group", "garments", "garment", "knitwear", "knitwears", "sweater",
    "sweaters", "textile", "textiles", "apparel", "apparels", "industries",
    "industry", "fashion", "fashions", "wear", "wears", "manufacturing",
    "company", "composite", "spinning", "knitting", "dyeing", "fabric",
    "fabrics", "design", "designs", "collection", "collections", "enterprise",
    "enterprises", "international", "intl", "export", "exports", "imports",
    "sons", "brothers", "trading", "trader", "ltd", "private", "corporation",
    "accessories", "accessory", "factory", "mills", "products", "holdings",
    "clothing", "styles", "style", "shirts", "trousers", "denim", "denims",
    "wash", "washing", "label", "labels", "thread", "threads", "yarn",
    "weaving", "weave", "print", "prints", "printing", "packaging", "pack",
}

SIG_TOKEN_MIN_LEN = 4


def first_sig_token(norm: str) -> str | None:
    """Return the first token >=SIG_TOKEN_MIN_LEN chars that is not in STOP_TOKENS."""
    if not norm:
        return None
    for t in norm.split():
        if len(t) >= SIG_TOKEN_MIN_LEN and t not in STOP_TOKENS:
            return t
    return None


# Each seed: regex patterns matched against company_name_norm.
# Use PostgreSQL POSIX regex (~) and Python re (re.search).
PARENT_GROUP_SEEDS: list[dict] = [
    {
        "name": "Ha-Meem Group",
        "patterns": [r"(^|\s)ha[\s-]?meem(\s|$)"],
    },
    {
        "name": "NASSA Group",
        "patterns": [r"(^|\s)nassa(\s|$)"],
    },
    {
        "name": "Mondol Group",
        "patterns": [r"^mondol(\s|$)"],
    },
    {
        "name": "Biswas Group",
        "patterns": [r"^biswas(\s|$)"],
    },
    {
        "name": "Standard Group",
        "patterns": [
            r"^standard\s+(stitches|group|knit|knitwear|knitwears)(\s|$)",
        ],
    },
    {
        "name": "Palmal Group",
        "patterns": [r"(^|\s)palmal(\s|$)"],
    },
    # DBL Group intentionally omitted: member factories (Matin Spinning Mills,
    # Mawna Fashions, Jinnat Apparels, Color City, Hamza Textiles, etc.) do
    # not carry "DBL" in their register-published names. A curated roster
    # scraper is out of scope per Spec 10 ("no scrapers").
]
