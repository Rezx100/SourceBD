"""C3: new spellings of places are collected, never guessed (spec-etl-freshness §8.3).

The registers spell one place several ways ("Gazipur", "Gajipur", "Kajipur").
A spelling the place lexicon does not know shows as a second location row,
which is deliberate: a wrong fold is worse than a visible duplicate. What was
missing is noticing. This finds, on each company, two addresses from its
records that name the same plot or holding number yet use different words that
look alike, and lists the word pairs for the founder: weekly in the Monday
digest, in full with `place-variants`.

Nothing is folded here. An approved pair goes into `lib/bd-place-lexicon.ts`
and `etl/lib/bd_place_lexicon.py` together, with a test.

ponytail: plot number on the same company is the only anchor; the geocode
cache point (also named in §8.3) is not used yet. Add it when the plot anchor
misses real variants.
"""
from __future__ import annotations

import re
from collections import Counter
from dataclasses import dataclass, field
from itertools import combinations
from typing import Iterable

from rapidfuzz import fuzz

from etl.core.hold import plot_ids
from etl.lib.bd_place_lexicon import apply_place_lexicon

# Pairs the founder ruled are different places (lexicon header, 28 Jul 2026).
KNOWN_DIFFERENT = frozenset({
    frozenset({"sreepur", "sripur"}),
    frozenset({"nawabganj", "chapainawabganj"}),
})
# Words that differ between two spellings of one address without naming a place.
_NOISE = frozenset({
    "road", "roads", "lane", "house", "holding", "plot", "village", "vill", "post",
    "office", "union", "upazila", "thana", "district", "dist", "sadar", "bazar",
    "bangladesh", "limited", "floor", "building", "block", "sector", "ward",
})
_WORD_RE = re.compile(r"[a-z]{4,}")
SIMILARITY_FLOOR = 70


@dataclass
class VariantPair:
    a: str
    b: str
    companies: int = 0
    examples: list[tuple[str, str, str]] = field(default_factory=list)  # slug, address a, address b


def _words(address: str) -> set[str]:
    return set(_WORD_RE.findall(apply_place_lexicon(address.lower()))) - _NOISE


def variant_pairs(addresses_by_company: Iterable[tuple[str, list[str]]]) -> list[VariantPair]:
    """Likely spelling pairs, most companies first. Pure."""
    found: dict[tuple[str, str], VariantPair] = {}
    for slug, addresses in addresses_by_company:
        seen_here: set[tuple[str, str]] = set()
        for x, y in combinations(sorted(set(a for a in addresses if a)), 2):
            if not (plot_ids(x) & plot_ids(y)):
                continue  # not anchored to one premises
            wx, wy = _words(x), _words(y)
            for a in wx - wy:
                for b in wy - wx:
                    if frozenset({a, b}) in KNOWN_DIFFERENT or fuzz.ratio(a, b) < SIMILARITY_FLOOR:
                        continue
                    key = (a, b) if a < b else (b, a)
                    pair = found.setdefault(key, VariantPair(*key))
                    if key not in seen_here:
                        seen_here.add(key)
                        pair.companies += 1
                        if len(pair.examples) < 3:
                            pair.examples.append((slug, x, y))
    return sorted(found.values(), key=lambda p: (-p.companies, p.a, p.b))


def load_addresses(cur) -> list[tuple[str, list[str]]]:
    """Every published company's address strings: its own and its records'."""
    cur.execute(
        """select s.slug, s.address_raw,
                  array(select e.value
                          from public.source_records sr, jsonb_each_text(sr.fields) e
                         where sr.supplier_id = s.id
                           and e.key ilike '%%address%%'
                           and length(e.value) > 8) as others
             from public.suppliers s
            where s.is_published"""
    )
    return [(r["slug"], [r["address_raw"] or "", *(r["others"] or [])]) for r in cur.fetchall()]


def digest_lines(pairs: list[VariantPair], limit: int = 10) -> list[str]:
    if not pairs:
        return ["Place spellings: no new likely variants this week."]
    out = [f"Place spellings to look at ({len(pairs)}; full list: `docker compose run --rm etl place-variants`):"]
    for p in pairs[:limit]:
        out.append(f"  {p.a} ↔ {p.b} — {p.companies} {'company' if p.companies == 1 else 'companies'}, e.g. {p.examples[0][0]}")
    return out


def main() -> None:
    from etl.core.db import db

    with db.conn() as c, c.cursor() as cur:
        pairs = variant_pairs(load_addresses(cur))
    for p in pairs:
        print(f"{p.a} <-> {p.b}  ({p.companies})")
        for slug, x, y in p.examples:
            print(f"    {slug}: {x!r} | {y!r}")
