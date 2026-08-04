"""Audit published suppliers for split-evidence duplicate clusters.

WHY THIS EXISTS
---------------
On 3 Aug 2026 the founder reported two suppliers apparently missing registry
evidence. Both turned out to be correct data, but the scan behind them
surfaced the real moat defect class: the same legal entity existing as 2+
published suppliers holding DISJOINT Tier 1-3 source sets, so each public
profile shows a fragment of the truth — `FOUR H APPARELS LTD.`
[BGMEA,BKMEA,EPB,OEKO_TEX,RSC] vs `Four H Apparels Ltd.` [GOTS].

`suppliers.slug` is UNIQUE, so this class is invisible in stored columns:
the 12-May supplier generation was normalized by code that stripped industry
words (`FOUR H APPARELS LTD.` -> stored `four h`), and the twins created
days later with correct modern norms matched nothing — Pass 1 (stored slug)
and Pass 4 (trigram over stored norm) both read the drifted columns. This
audit recomputes identity with the SAME functions the ingest matcher uses
and reports every cluster it finds. It never writes anything.

WHAT COUNTS AS A CLUSTER
------------------------
Three independent signals over published suppliers; clusters are connected
components of the pairs they produce:

- **A: recomputed-slug equality** — `make_slug(company_name)` equal for 2+
  suppliers. Certain duplicates (class `slug-equal`, merge-eligible).
- **B: the fuzzy bar** — SQL trigram prefilter on stored norms (the
  matcher's candidate generation, threshold relaxed to 0.2 because this is a
  prefilter only), rescored in Python against RECOMPUTED norms with
  `token_sort_ratio >= 92` AND `_names_compatible` — the same bar Pass 4
  uses, on the names as current code sees them. Class `fuzzy`: review,
  never auto-merged.
- **C: shared source ref** — one active `(source_id, source_ref)` attached
  to >1 published supplier. Deterministic split signal (a BKMEA register
  typo filed member 481 under both EURO KNIT CARMENTS and EURO KNIT
  GARMENTS). Merge-eligible only when the names are also compatible.

NAME-VARIANT REPORT CLASS (added 4 Aug 2026, founder decision B)
----------------------------------------------------------------
A fourth scan runs alongside the cluster signals but is REPORT-ONLY — it
never feeds `certain_merge_groups`. It catches compounding and single-letter
register spellings ("Master Cham" vs "Mastercham", "Sarada Knit Wear" vs
"Sarda Knitwear") that BOTH slug equality and the 92-point fuzzy bar miss:
compared on space-stripped recomputed norms, those names are identical or
~96+ similar. Method proven ad-hoc on 3 Aug 2026 (917 candidate pairs, top
band ~50 near-certain): 4-gram index over the space-stripped
`normalize_company_name` output (grams shared by >40 suppliers dropped as
undiscriminating), candidates share >=1 rare gram, char `fuzz.ratio` >= 86
with min squashed length 10, fragmented Tier 1-3 sets required (each side
holds >=1 code the other lacks), and address corroboration (street-number
agreement required for a strong score; city tokens excluded). The
`certain-review` band is the founder's seeded-merge review list
(`merge_duplicate_suppliers.py --pair WINNER,LOSER`) — below ~94 the noise
floor is real (DK KNIT WEAR vs YK KNITWEAR, MALEK SPINNING vs EK SPINNING
are different companies; unit-suffix pairs are the extension class and are
excluded up front). Pairs already reported by signals A/B/C are subtracted
so the classes stay disjoint.

Normalization is IMPORTED from the ETL (`make_slug`,
`normalize_company_name`, `_names_compatible`), never reimplemented — the
audit must see names exactly the way the matcher does.

EXCLUSIONS
----------
- RSC extension/building/unit rows: the name carries an extension suffix
  (`public.rsc_extension_base_name` from migration 0014, plus supplementary
  patterns for named units and parenthesized unit numbers the SQL function
  does not reach) — these are distinct physical sites with separate
  remediation status and are never merge-eligible. Whether the supplier's
  RSC record's `rsc_factory_name` matches its name is reported as the
  legit-site vs suspect signal.
- Genuinely different companies sharing tokens never enter the fuzzy class:
  `_names_compatible` already rejects initials swaps and word-order flips
  (the `A & S` / `A & B` class).

USAGE
-----
    python ops/audit_cross_register_coverage.py            # full slug-equal/shared-ref detail, fuzzy compact
    python ops/audit_cross_register_coverage.py --full     # fuzzy clusters in full too

Exit codes: 0 ran clean, 2 could not run. This script is read-only; there is
no --apply.
"""

from __future__ import annotations

import argparse
import os
import re
import sys
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Any

import psycopg
from psycopg.rows import dict_row
from rapidfuzz import fuzz

from etl.core.normalize import make_slug, normalize_company_name
from etl.core.resolution_edges import load_different_pair_rationales, pair_key
from etl.core.upsert import _FUZZY_THRESHOLD, _names_compatible
from etl.lib.bd_place_lexicon import apply_place_lexicon

TIER_13 = ("tier1_gov", "tier2_industry", "tier3_cert")

# 31 Jul 2026: the BKMEA conflation unmerge inserted fresh suppliers without
# consulting the matcher. Members created in this window are flagged for the
# root-cause attribution.
_UNMERGE_WINDOW_START = "2026-07-30"

# Supplementary extension patterns `public.rsc_extension_base_name` does not
# reach: named units ("(Shafipur Unit)"), parenthesized unit numbers
# ("(Unit-2)"), and building lists ("- Building 3 & 4"). Used for
# merge-exclusion only; the SQL function's result is reported alongside.
_EXT_NAME_RE = re.compile(
    r"(\(|\s|-)(extension|expansion(\s+buildings?)?|new building|new location)\s*\)?\s*$"
    r"|unit[\s-]*\d+\s*\)?\s*$"
    r"|\(\s*[a-z][a-z .-]*\s+unit\s*\)\s*$"
    r"|\s+-\s+building\s+[\d&\s,.-]+$"
    r"|\s+-\s*\d+(\s*[,-]\s*\d+)*\s*$",
    re.IGNORECASE,
)

_MEMBERSHIP_INT_RE = re.compile(r"^\s*(\d+)")

_SUPPLIERS_SELECT = """
select s.id::text, s.company_name, s.company_name_norm, s.slug,
       s.created_at, s.source_tags, s.address_raw, s.is_published,
       public.rsc_extension_base_name(s.company_name) as ext_base
  from public.suppliers s
"""

SUPPLIERS_SQL = _SUPPLIERS_SELECT + """
 where s.is_published
 order by s.created_at
"""

# The merge script's seeded `--pair` mode loads the named slugs even when
# UNPUBLISHED (founder decision E, 4 Aug 2026): the 6 slug-blocked
# identity-backfill pairs each have an unpublished holder row the published
# winner must absorb. The audit itself never uses this — its universe stays
# published-only.
SUPPLIERS_SQL_WITH_SLUGS = _SUPPLIERS_SELECT + """
 where s.is_published or s.slug = any(%s::text[])
 order by s.created_at
"""

RECORDS_SQL = """
select sr.supplier_id::text, src.code, src.tier::text, sr.source_ref,
       sr.fetched_at,
       sr.fields->>'bkmea_membership_no' as bkmea_no,
       sr.fields->>'rsc_factory_name'    as rsc_name
  from public.source_records sr
  join public.sources src on src.id = sr.source_id
 where sr.status = 'active'
   and sr.supplier_id = any(%s::uuid[])
 order by sr.fetched_at
"""

# Trigram prefilter mirrors `_find_existing` Pass 4's candidate generation.
# Threshold relaxed from the pg_trgm default (0.3): this is only a
# prefilter — every candidate is rescored in Python against recomputed
# norms, and a short drifted norm ('euro') sits at the 0.3 boundary against
# its own modern form.
FUZZY_PREFILTER_SQL = """
set local pg_trgm.similarity_threshold = 0.2
"""

FUZZY_PAIRS_SQL = """
select a.id::text as a_id, b.id::text as b_id
  from public.suppliers a
  join public.suppliers b
    on a.id < b.id
   and a.company_name_norm % b.company_name_norm
 where a.is_published and b.is_published
"""

SHARED_REFS_SQL = """
select sr.source_id::text as source_id, sr.source_ref,
       array_agg(distinct sr.supplier_id::text) as supplier_ids
  from public.source_records sr
  join public.suppliers s on s.id = sr.supplier_id and s.is_published
 where sr.status = 'active' and sr.source_ref is not null
 group by sr.source_id, sr.source_ref
 having count(distinct sr.supplier_id) > 1
"""

SOURCE_CODE_SQL = "select id::text, code from public.sources"


@dataclass
class Member:
    id: str
    name: str
    stored_norm: str
    stored_slug: str
    created_at: Any
    source_tags: list[str]
    ext_base: str | None
    # The audit's universe is published-only, so this is True everywhere
    # except members the merge script's seeded mode pulled in by slug.
    is_published: bool = True
    rec_slug: str = ""
    rec_norm: str = ""
    address_raw: str = ""
    records: list[dict] = field(default_factory=list)
    bkmea_ints: set[str] = field(default_factory=set)
    rsc_name_match: bool = False

    @property
    def tier13_codes(self) -> set[str]:
        return {r["code"] for r in self.records if r["tier"] in TIER_13}

    @property
    def drifted(self) -> bool:
        return self.stored_slug != self.rec_slug or self.stored_norm != self.rec_norm

    @property
    def ext_pattern(self) -> bool:
        return self.ext_base is not None or bool(_EXT_NAME_RE.search(self.name or ""))

    @property
    def creating_source(self) -> str:
        return self.source_tags[0] if self.source_tags else "?"


@dataclass
class Cluster:
    members: list[Member]
    signals: set[str]
    klass: str
    merge_groups: list[list[Member]]
    excluded_reason: str | None
    root_cause: str

    @property
    def merge_eligible(self) -> bool:
        return bool(self.merge_groups)


# ---------------------------------------------------------------------------
# Name-variant scan (REPORT class — see the module docstring)
# ---------------------------------------------------------------------------
_VARIANT_GRAM = 4
_VARIANT_GRAM_MAX_SHARE = 40
_VARIANT_MIN_SQUASHED = 10
_VARIANT_MIN_RATIO = 86.0
_VARIANT_CERTAIN_RATIO = 96.0

# City/district tokens carry no corroborating signal — every register address
# shares one. Canonical forms only: the place lexicon runs before tokenizing.
_CITY_TOKENS = frozenset({
    "dhaka", "narayanganj", "chattogram", "gazipur", "savar", "cumilla",
    "khulna", "rajshahi", "sylhet", "barishal", "mymensingh", "tangail",
    "narsingdi", "munshiganj", "manikganj", "kishoreganj", "bogura",
    "jashore", "bangladesh",
})

_ADDR_TOKEN_RE = re.compile(r"[a-z0-9]+")


def _addr_tokens(address_raw: str) -> set[str]:
    return set(_ADDR_TOKEN_RE.findall(apply_place_lexicon((address_raw or "").lower())))


def _street_numbers(address_raw: str) -> set[str]:
    """Digit-bearing address tokens ("56", "12/a") — the premises signal."""
    return {t for t in _addr_tokens(address_raw) if any(c.isdigit() for c in t)}


def _locality_tokens(address_raw: str) -> set[str]:
    """Non-city, non-number tokens — road/area/mohalla names."""
    return {
        t
        for t in _addr_tokens(address_raw)
        if t not in _CITY_TOKENS and not any(c.isdigit() for c in t)
    }


@dataclass
class VariantPair:
    a: Member
    b: Member
    ratio: float
    squashed_identical: bool
    number_agree: bool
    number_conflict: bool
    shared_locality: frozenset[str]

    @property
    def band(self) -> str:
        """certain-review = the founder's seeded-merge review list.

        A street-number CONFLICT demotes even identical names: same name at
        different premises is the sister-company class (Sarada Fashions vs
        Sarada Knit Wear), correctly separate.
        """
        if self.number_conflict:
            return "review"
        if self.squashed_identical or (
            self.ratio >= _VARIANT_CERTAIN_RATIO and self.number_agree
        ):
            return "certain-review"
        return "review"


def variant_pairs(
    members: dict[str, Member],
    known_pairs: set[tuple[str, str]] | None = None,
) -> list[VariantPair]:
    """Name-variant candidate pairs the cluster signals do not already report.

    `known_pairs` (the audit's A/B/C signal pair keys) is subtracted so the
    report classes stay disjoint — a pair the slug/fuzzy/shared-ref signals
    already flag is those classes' story, not a new finding.
    """
    squashed: dict[str, str] = {}
    for mid, m in members.items():
        sq = m.rec_norm.replace(" ", "")
        if len(sq) >= _VARIANT_MIN_SQUASHED:
            squashed[mid] = sq

    gram_index: dict[str, set[str]] = defaultdict(set)
    for mid, sq in squashed.items():
        for i in range(len(sq) - _VARIANT_GRAM + 1):
            gram_index[sq[i : i + _VARIANT_GRAM]].add(mid)

    candidates: set[tuple[str, str]] = set()
    for ids in gram_index.values():
        if len(ids) > _VARIANT_GRAM_MAX_SHARE:
            continue
        ordered = sorted(ids)
        for i, a in enumerate(ordered):
            for b in ordered[i + 1 :]:
                candidates.add((a, b))

    out: list[VariantPair] = []
    for a, b in candidates:
        if known_pairs and (a, b) in known_pairs:
            continue
        ma, mb = members[a], members[b]
        # Extension/building/unit rows are never merge candidates.
        if ma.ext_pattern or mb.ext_pattern:
            continue
        # Fragmented Tier 1-3 sets: each side must hold >=1 code the other
        # lacks (the split-evidence shape). Subset pairs are the other
        # classes' work.
        if not (ma.tier13_codes - mb.tier13_codes and mb.tier13_codes - ma.tier13_codes):
            continue
        sa, sb = squashed[a], squashed[b]
        ratio = fuzz.ratio(sa, sb)
        if ratio < _VARIANT_MIN_RATIO:
            continue
        nums_a = _street_numbers(ma.address_raw)
        nums_b = _street_numbers(mb.address_raw)
        number_agree = bool(nums_a & nums_b)
        out.append(
            VariantPair(
                a=ma,
                b=mb,
                ratio=ratio,
                squashed_identical=sa == sb,
                number_agree=number_agree,
                number_conflict=bool(nums_a and nums_b and not number_agree),
                shared_locality=frozenset(
                    _locality_tokens(ma.address_raw) & _locality_tokens(mb.address_raw)
                ),
            )
        )
    out.sort(key=lambda p: (p.band != "certain-review", -p.ratio, p.a.name))
    return out


def _fmt_variant_pair(p: VariantPair) -> str:
    tag = "squashed-identical" if p.squashed_identical else f"sim={p.ratio:.1f}"
    sets = (
        "{" + ",".join(sorted(p.a.tier13_codes)) + "} vs {"
        + ",".join(sorted(p.b.tier13_codes)) + "}"
    )
    addr = []
    if p.number_agree:
        addr.append("street-number agreement")
    if p.number_conflict:
        addr.append("STREET-NUMBER CONFLICT")
    if p.shared_locality:
        addr.append("locality: " + ", ".join(sorted(p.shared_locality)))
    out = f"  {p.a.name!r}[{p.a.id[:6]}] ~ {p.b.name!r}[{p.b.id[:6]}]  {tag}\n      {sets}"
    if addr:
        out += f"\n      addr: {'; '.join(addr)}"
    return out


def _fetch(
    cur, extra_slugs: tuple[str, ...] = ()
) -> tuple[dict[str, Member], dict[str, str]]:
    """Load the audit universe. `extra_slugs` additionally loads those slugs
    when unpublished — only the merge script's seeded `--pair` mode passes
    them (founder decision E); the audit and detector stay published-only.
    """
    cur.execute(SOURCE_CODE_SQL)
    code_by_id = {r["id"]: r["code"] for r in cur.fetchall()}

    if extra_slugs:
        cur.execute(SUPPLIERS_SQL_WITH_SLUGS, (list(extra_slugs),))
    else:
        cur.execute(SUPPLIERS_SQL)
    members: dict[str, Member] = {}
    for r in cur.fetchall():
        m = Member(
            id=r["id"],
            name=r["company_name"] or "",
            stored_norm=r["company_name_norm"] or "",
            stored_slug=r["slug"] or "",
            created_at=r["created_at"],
            source_tags=list(r["source_tags"] or []),
            ext_base=r["ext_base"],
            is_published=bool(r["is_published"]),
            address_raw=r["address_raw"] or "",
        )
        m.rec_norm = normalize_company_name(m.name)
        m.rec_slug = make_slug(m.name)
        members[m.id] = m

    cur.execute(RECORDS_SQL, (list(members),))
    for r in cur.fetchall():
        m = members.get(r["supplier_id"])
        if m is None:
            continue
        m.records.append(r)
        if r["bkmea_no"]:
            match = _MEMBERSHIP_INT_RE.match(r["bkmea_no"])
            if match:
                m.bkmea_ints.add(match.group(1))
    for m in members.values():
        m.rsc_name_match = any(
            r["code"] == "RSC"
            and r["rsc_name"]
            and (
                normalize_company_name(r["rsc_name"]) == m.rec_norm
                or _names_compatible(normalize_company_name(r["rsc_name"]), m.rec_norm)
            )
            for r in m.records
        )
    return members, code_by_id


def discover_clusters(
    members: dict[str, Member],
    code_by_id: dict[str, str],
    cur,
    explain: str | None = None,
    different_pairs: dict[tuple[str, str], str] | None = None,
) -> tuple[list[Cluster], dict[tuple[str, str], set[str]], dict[tuple[str, str], str]]:
    """Connected components over the three discovery signals, plus the raw
    pair signals (the variant report subtracts them to stay disjoint).

    Returns (clusters, pair_signals, ruled_different) where ruled_different
    maps pairs excluded by a live resolution_edges `different` ruling to the
    edge rationale (REZ-64). Those pairs are omitted from every signal class.
    """
    parent = {mid: mid for mid in members}

    def find(x: str) -> str:
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(a: str, b: str) -> None:
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[rb] = ra

    if different_pairs is None:
        different_pairs = load_different_pair_rationales(cur)
    ruled_different: dict[tuple[str, str], str] = {}

    def admit(a: str, b: str) -> bool:
        """False when a live `different` edge rules the pair out."""
        key = pair_key(a, b)
        rationale = different_pairs.get(key)
        if rationale is not None:
            ruled_different[key] = rationale
            return False
        return True

    pair_signals: dict[tuple[str, str], set[str]] = defaultdict(set)

    # Signal A: recomputed-slug equality.
    by_slug: dict[str, list[str]] = defaultdict(list)
    for m in members.values():
        if m.rec_slug:
            by_slug[m.rec_slug].append(m.id)
    for ids in by_slug.values():
        if len(ids) < 2:
            continue
        for i, a in enumerate(ids):
            for b in ids[i + 1 :]:
                if not admit(a, b):
                    continue
                pair_signals[(min(a, b), max(a, b))].add("A")
                union(a, b)

    # Signal B: fuzzy bar on recomputed norms.
    cur.execute(FUZZY_PREFILTER_SQL)
    cur.execute(FUZZY_PAIRS_SQL)
    for row in cur.fetchall():
        a, b = row["a_id"], row["b_id"]
        if not admit(a, b):
            continue
        ma, mb = members[a], members[b]
        if not ma.rec_norm or not mb.rec_norm:
            continue
        if fuzz.token_sort_ratio(ma.rec_norm, mb.rec_norm) >= _FUZZY_THRESHOLD and _names_compatible(
            ma.rec_norm, mb.rec_norm
        ):
            pair_signals[(min(a, b), max(a, b))].add("B")
            union(a, b)

    # Signal C: one active (source, ref) on >1 published supplier.
    cur.execute(SHARED_REFS_SQL)
    for row in cur.fetchall():
        ids = sorted(row["supplier_ids"])
        code = code_by_id.get(row["source_id"], "?")
        for i, a in enumerate(ids):
            for b in ids[i + 1 :]:
                if not admit(a, b):
                    continue
                pair_signals[(min(a, b), max(a, b))].add(f"C:{code}:{row['source_ref']}")
                union(a, b)

    groups: dict[str, list[str]] = defaultdict(list)
    for mid in members:
        groups[find(mid)].append(mid)

    if explain:
        explained: set[str] = set()
        for root, ids in groups.items():
            if len(ids) < 2 or root in explained:
                continue
            if not any(explain.lower() in members[i].name.lower() for i in ids):
                continue
            explained.add(root)
            print(f"\nEXPLAIN cluster: {[members[i].name for i in ids]}")
            for i, a in enumerate(ids):
                for b in ids[i + 1:]:
                    sigs = pair_signals.get((min(a, b), max(a, b)), set())
                    if not sigs:
                        continue
                    ma, mb = members[a], members[b]
                    verdict = _is_certain_edge(ma, mb, sigs)
                    refs_a = sorted({r['source_ref'] for r in ma.records})
                    refs_b = sorted({r['source_ref'] for r in mb.records})
                    print(f"  {ma.name!r}[{a[:6]}] + {mb.name!r}[{b[:6]}]")
                    print(f"    sigs={sorted(sigs)}")
                    print(f"    certain={verdict} refs_a={refs_a} refs_b={refs_b}")

    clusters: list[Cluster] = []
    for root, ids in groups.items():
        if len(ids) < 2:
            continue
        ms = sorted((members[i] for i in ids), key=lambda m: m.created_at)
        signals: set[str] = set()
        for i, a in enumerate(ids):
            for b in ids[i + 1 :]:
                signals |= pair_signals.get((min(a, b), max(a, b)), set())

        has_a = "A" in signals
        c_codes = {s.split(":", 2)[1] for s in signals if s.startswith("C:")}
        excluded = next((m for m in ms if m.ext_pattern), None)

        if has_a:
            klass = "slug-equal"
        elif c_codes:
            klass = "shared-ref"
        else:
            klass = "fuzzy"

        if excluded is not None:
            root_cause = "rsc-extension (distinct physical site)"
        elif any(m.drifted for m in ms):
            root_cause = "normalization-drift"
        elif any(str(m.created_at) >= _UNMERGE_WINDOW_START for m in ms):
            root_cause = f"recent creation (>={_UNMERGE_WINDOW_START} unmerge/rekey window)"
        elif c_codes:
            root_cause = "register-typo / multi-supplier ref"
        else:
            root_cause = "matcher-miss (review)"

        clusters.append(
            Cluster(
                members=ms,
                signals=signals,
                klass=klass,
                merge_groups=certain_merge_groups(ms, pair_signals),
                excluded_reason=(
                    f"{excluded.name!r} carries an extension/building/unit suffix"
                    if excluded
                    else None
                ),
                root_cause=root_cause,
            )
        )
    clusters.sort(key=lambda c: (c.klass != "slug-equal", c.klass != "shared-ref", c.members[0].name))
    return clusters, pair_signals, ruled_different


def _is_certain_edge(ma: Member, mb: Member, sigs: set[str]) -> bool:
    """Identity-proof edges only — everything else is reported, never merged.

    - Signal A (recomputed-slug equality): the current normalizer collapses both
      names to one identity, so the two rows can only exist via drift or a
      matcher bypass.
    - Signal C (shared source ref) + signal B (names clear the matcher bar) is
      identity-proof ONLY when the sharing mechanics can't be two register rows
      about two different members:
        * a non-BKMEA ref (cert-body customer profile — one profile per legal
          entity), or
        * a BKMEA shadow: one member's entire active ref set is a subset of
          the other's (typo row with zero independent evidence).
      A BKMEA membership number on two substantive suppliers (CORNY/CRONY) is
      an ownership question for a human — reported, never merged.
    """
    if "A" in sigs:
        return True
    if "B" not in sigs:
        return False
    c_sigs = [s for s in sigs if s.startswith("C:")]
    if not c_sigs:
        return False
    if any(not s.startswith("C:BKMEA:") for s in c_sigs):
        return True
    refs_a = {r["source_ref"] for r in ma.records}
    refs_b = {r["source_ref"] for r in mb.records}
    return refs_a <= refs_b or refs_b <= refs_a


def certain_merge_groups(
    ms: list[Member], pair_signals: dict[tuple[str, str], set[str]]
) -> list[list[Member]]:
    """Connected components over certain edges, within one cluster.

    Multi-member clusters can mix identity-proof links with fuzzy-only links
    (EMON FASHION/EMON FASHION LTD/Eon Fashion); only the certain-linked
    members merge. Groups containing an extension-pattern member are dropped
    (founder guardrail: never merge extension rows without explicit decision).
    """
    parent = {m.id: m.id for m in ms}
    by_id = {m.id: m for m in ms}

    def find(x: str) -> str:
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(a: str, b: str) -> None:
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[rb] = ra

    ids = [m.id for m in ms]
    for i, a in enumerate(ids):
        for b in ids[i + 1:]:
            sigs = pair_signals.get((min(a, b), max(a, b)), set())
            if sigs and _is_certain_edge(by_id[a], by_id[b], sigs):
                union(a, b)

    comps: dict[str, list[Member]] = defaultdict(list)
    for m in ms:
        comps[find(m.id)].append(m)
    return [
        sorted(g, key=lambda m: m.created_at)
        for g in comps.values()
        if len(g) >= 2 and not any(m.ext_pattern for m in g)
    ]


def _fmt_member(m: Member) -> str:
    lines = [
        f"  [{m.id[:8]}] {m.name!r}  created {m.created_at:%Y-%m-%d}  via {m.creating_source}",
    ]
    drift = ""
    if m.drifted:
        drift = f"  DRIFTED (recomputed slug={m.rec_slug!r} norm={m.rec_norm!r})"
    lines.append(
        f"      slug={m.stored_slug!r} norm={m.stored_norm!r}{drift}"
    )
    by_code: dict[str, list[str]] = defaultdict(list)
    for r in m.records:
        by_code[r["code"]].append(r["source_ref"] or "?")
    ev = "; ".join(f"{code} {', '.join(refs)}" for code, refs in sorted(by_code.items()))
    lines.append(f"      evidence: {ev or '(none)'}")
    flags = []
    if m.ext_pattern:
        flags.append(f"extension-pattern (sql_base={m.ext_base!r}, rsc_name_match={m.rsc_name_match})")
    if m.bkmea_ints:
        flags.append(f"bkmea membership(s): {', '.join(sorted(m.bkmea_ints))}")
    if flags:
        lines.append(f"      {'; '.join(flags)}")
    return "\n".join(lines)


def _fmt_cluster_compact(c: Cluster) -> str:
    names = "  ~  ".join(f"{m.name!r}[{m.id[:6]}]" for m in c.members)
    sets = " vs ".join("{" + ",".join(sorted(m.tier13_codes)) + "}" for m in c.members)
    return f"  {names}\n      {sets}  root={c.root_cause}"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--full", action="store_true", help="print fuzzy clusters in full too")
    parser.add_argument(
        "--explain",
        metavar="NAME",
        help="dump pairwise signals + certainty verdicts for clusters containing NAME",
    )
    args = parser.parse_args()

    dsn = os.environ.get("SUPABASE_DB_URL")
    if not dsn:
        print("ERROR: SUPABASE_DB_URL not set", file=sys.stderr)
        return 2

    try:
        with psycopg.connect(dsn, prepare_threshold=None, row_factory=dict_row) as conn, conn.cursor() as cur:
            members, code_by_id = _fetch(cur)
            clusters, pair_signals, ruled_different = discover_clusters(
                members, code_by_id, cur, explain=args.explain
            )
            # Ruled-different pairs stay out of every signal class, including
            # the name-variant report (REZ-64).
            variants = variant_pairs(
                members, known_pairs=set(pair_signals) | set(ruled_different)
            )
    except Exception as exc:  # noqa: BLE001
        # An audit that cannot run is not a clean audit.
        print(f"ERROR: audit failed: {exc}", file=sys.stderr)
        return 2

    if args.explain:
        return 0

    slug_equal = [c for c in clusters if c.klass == "slug-equal"]
    shared_ref = [c for c in clusters if c.klass == "shared-ref"]
    fuzzy = [c for c in clusters if c.klass == "fuzzy"]
    excluded = [c for c in clusters if c.excluded_reason]
    drifted = [m for m in members.values() if m.drifted]
    certain_variants = [p for p in variants if p.band == "certain-review"]
    review_variants = [p for p in variants if p.band != "certain-review"]

    print(f"Audited {len(members)} published suppliers.")
    print(
        f"Clusters: {len(slug_equal)} slug-equal, {len(shared_ref)} shared-ref, "
        f"{len(fuzzy)} fuzzy; {len(excluded)} extension-excluded; "
        f"{len(drifted)} suppliers carry drifted slug/norm; "
        f"name-variant: {len(certain_variants)} certain-review + "
        f"{len(review_variants)} review-band pair(s).\n"
    )

    for title, group in (("SLUG-EQUAL (certain duplicates)", slug_equal), ("SHARED-REF", shared_ref)):
        if not group:
            continue
        print("=" * 78)
        print(f"{title}: {len(group)} cluster(s)")
        print("=" * 78)
        for i, c in enumerate(group, 1):
            print(
                f"\n--- {title} {i}: root={c.root_cause}; "
                f"merge-eligible={'YES' if c.merge_eligible else 'NO'}"
                + (f" [{c.excluded_reason}]" if c.excluded_reason else "")
            )
            for m in c.members:
                print(_fmt_member(m))
            for g in c.merge_groups:
                print(f"  MERGE GROUP (certain): {' + '.join(f'{m.name!r}[{m.id[:6]}]' for m in g)}")
            if not c.merge_groups and not c.excluded_reason:
                print("  (no identity-proof links within this cluster — human review only)")
            sets = [m.tier13_codes for m in c.members]
            for i2 in range(len(sets)):
                for j2 in range(i2 + 1, len(sets)):
                    only_i = sets[i2] - sets[j2]
                    only_j = sets[j2] - sets[i2]
                    shared = sets[i2] & sets[j2]
                    rel = "disjoint" if not shared else f"overlap {sorted(shared)}"
                    print(
                        f"  sets[{c.members[i2].id[:6]} vs {c.members[j2].id[:6]}]: {rel}; "
                        f"only-left={sorted(only_i)} only-right={sorted(only_j)}"
                    )
            shared_memberships = set.intersection(*(m.bkmea_ints for m in c.members)) if all(
                m.bkmea_ints for m in c.members
            ) else set()
            if shared_memberships:
                print(f"  SHARED BKMEA membership(s): {sorted(shared_memberships)}")

    if fuzzy:
        print("\n" + "=" * 78)
        print(f"FUZZY (review only, never auto-merged): {len(fuzzy)} cluster(s)")
        print("=" * 78)
        for c in fuzzy:
            if args.full:
                print(
                    f"\n--- fuzzy: root={c.root_cause}"
                    + (f" [EXCLUDED: {c.excluded_reason}]" if c.excluded_reason else "")
                )
                for m in c.members:
                    print(_fmt_member(m))
            else:
                print(_fmt_cluster_compact(c))

    if variants:
        print("\n" + "=" * 78)
        print(
            f"NAME-VARIANT (report only, never auto-merged): "
            f"{len(certain_variants)} certain-review, {len(review_variants)} review-band"
        )
        print("=" * 78)
        print(
            "  Certain-review pairs are the founder's seeded-merge review list: eyeball,\n"
            "  then `merge_duplicate_suppliers.py --pair WINNER_SLUG,LOSER_SLUG`."
        )
        for p in certain_variants:
            print(_fmt_variant_pair(p))
        if review_variants:
            if args.full:
                print("\n  --- review band (below the certain band; the noise floor")
                print("      below ~94 is real — different companies live there) ---")
                for p in review_variants:
                    print(_fmt_variant_pair(p))
            else:
                print(
                    f"\n  … plus {len(review_variants)} review-band pair(s) (--full lists them; "
                    f"below ~94 the noise floor is real)"
                )

    if ruled_different:
        print("\n" + "=" * 78)
        print(
            f"RULED DIFFERENT BY HUMAN: {len(ruled_different)} pair(s) "
            f"(excluded from every signal class)"
        )
        print("=" * 78)
        for (a, b), rationale in sorted(ruled_different.items(), key=lambda kv: kv[0]):
            ma, mb = members[a], members[b]
            print(
                f"  {ma.name!r}[{a[:6]}] ≠ {mb.name!r}[{b[:6]}]\n"
                f"      rationale: {rationale}"
            )

    # ---- summary -----------------------------------------------------------
    print("\n" + "=" * 78)
    print("SUMMARY")
    print("=" * 78)
    by_root: dict[str, int] = defaultdict(int)
    by_source_pair: dict[str, int] = defaultdict(int)
    for c in clusters:
        by_root[c.root_cause] += 1
        if len(c.members) == 2:
            pair = " x ".join(sorted({m.creating_source for m in c.members}))
            by_source_pair[pair] += 1
    print(f"{'root cause':<58} clusters")
    for k, v in sorted(by_root.items(), key=lambda kv: -kv[1]):
        print(f"  {k:<56} {v}")
    print(f"\n{'creating-source pair (2-member clusters)':<58} clusters")
    for k, v in sorted(by_source_pair.items(), key=lambda kv: -kv[1]):
        print(f"  {k:<56} {v}")
    merge_groups = [g for c in clusters for g in c.merge_groups]
    n_merge_members = sum(len(g) for g in merge_groups)
    print(
        f"\n{len(merge_groups)} merge group(s) across {sum(1 for c in clusters if c.merge_eligible)} "
        f"cluster(s) merge-eligible (identity-proof links: recomputed-slug equality, or shared ref "
        f"+ compatible names + shadow/non-BKMEA; no extension members) covering {n_merge_members} "
        f"suppliers; {len(fuzzy)} fuzzy reported for review; "
        f"{len(excluded)} cluster(s) excluded as extension-class; "
        f"{len(certain_variants)} name-variant pair(s) in the certain-review band "
        f"(report only — seeded-merge review list), {len(review_variants)} review-band."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
