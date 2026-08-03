"""Detect published suppliers that are the same legal entity split across rows.

WHY THIS EXISTS
---------------
On 3 Aug 2026 a founder-reported "missing evidence" scan surfaced the real
defect: the same company existing as 2+ published suppliers with fragmented
Tier 1-3 evidence — `FOUR H APPARELS LTD.` [BGMEA,BKMEA,EPB,OEKO_TEX,RSC] vs
`Four H Apparels Ltd.` [GOTS] — so each public profile showed a fragment of
the truth. The ingest matcher deliberately errs toward duplicates ("a
duplicate is visible and mergeable; a conflation silently publishes lies"),
so splits are the accepted cost of the conflation guards. Accepted does not
mean invisible: this check is the split twin of
`ops/check_supplier_conflations.py` and makes every NEW certain split loud
within a day, instead of by founder inspection months later.

WHAT COUNTS AS A SPLIT
----------------------
The identity-proof classes defined by `ops/audit_cross_register_coverage.py`,
imported from it so the detector cannot drift from the rule it polices:

- recomputed-slug equality (the current normalizer collapses both names to
  one identity — the rows can only coexist via drift or a matcher bypass), or
- a shared source ref whose mechanics prove one entity (a cert-body customer
  profile, or a BKMEA shadow whose entire evidence set duplicates the other
  side's) with names clearing the matcher bar.

Fuzzy-only pairs are review material for the full audit, not alarms — the
`A & S`/`A & B` class of genuinely different companies shares tokens, and a
check that cries wolf gets switched off. Shared BKMEA memberships on two
substantive suppliers (ownership disputes like CORNY/CRONY) are reported as
informational and do not fail the run: which company owns the number is a
human decision, not a defect this check can verdict. Extension/building rows
are excluded by the same rule the audit uses.

The audit's name-variant report class (4 Aug 2026, founder decision B) rides
along as an informational count — the certain-review band is the founder's
seeded-merge review list, never an alarm, so it cannot fail the run either.
Note the detector's signal set lacks fuzzy-only pairs (it never runs the
trigram prefilter), so a pair that is fuzzy-class in the full audit can
count toward the variant number here; the audit's own report is the
disjoint one.

USAGE
-----
    python ops/check_supplier_splits.py           # human-readable
    python ops/check_supplier_splits.py --quiet   # only print on failure

Exit codes: 0 clean, 1 certain splits found, 2 could not run the check.
"""

from __future__ import annotations

import argparse
import os
import sys
from collections import defaultdict

import psycopg
from psycopg.rows import dict_row
from rapidfuzz import fuzz

from etl.core.upsert import _FUZZY_THRESHOLD, _names_compatible
from ops.audit_cross_register_coverage import (
    SHARED_REFS_SQL,
    Member,
    _fetch,
    _is_certain_edge,
    certain_merge_groups,
    variant_pairs,
)


def _certain_groups(
    members: dict[str, Member], code_by_id: dict[str, str], cur
) -> tuple[list[list[Member]], dict[tuple[str, str], set[str]], list[tuple[Member, Member, set[str]]]]:
    """Certain merge groups across all published suppliers, plus the signals.

    Returns (merge_groups, pair_signals, review_pairs) where review_pairs are
    shared-ref pairs that are NOT identity-proof (ownership questions for a
    human). Unlike the audit, the daily check does not run the fuzzy prefilter
    scan: signal B is evaluated directly, and only where a shared ref needs it
    for the certainty rule — the failure classes are slug equality and shared
    refs, neither of which needs the trigram self-join to discover.
    """
    pair_signals: dict[tuple[str, str], set[str]] = defaultdict(set)

    by_slug: dict[str, list[str]] = defaultdict(list)
    for m in members.values():
        if m.rec_slug:
            by_slug[m.rec_slug].append(m.id)
    for ids in by_slug.values():
        for i, a in enumerate(ids):
            for b in ids[i + 1:]:
                pair_signals[(min(a, b), max(a, b))].add("A")

    cur.execute(SHARED_REFS_SQL)
    for row in cur.fetchall():
        ids = sorted(row["supplier_ids"])
        code = code_by_id.get(row["source_id"], "?")
        for i, a in enumerate(ids):
            for b in ids[i + 1:]:
                pair_signals[(min(a, b), max(a, b))].add(f"C:{code}:{row['source_ref']}")

    # Signal B, only where a C edge needs it for the certainty rule.
    for (a, b), sigs in pair_signals.items():
        if "A" in sigs or not any(s.startswith("C:") for s in sigs):
            continue
        ma, mb = members[a], members[b]
        if (
            ma.rec_norm
            and mb.rec_norm
            and fuzz.token_sort_ratio(ma.rec_norm, mb.rec_norm) >= _FUZZY_THRESHOLD
            and _names_compatible(ma.rec_norm, mb.rec_norm)
        ):
            sigs.add("B")

    all_members = list(members.values())
    groups = certain_merge_groups(all_members, pair_signals)

    review: list[tuple[Member, Member, set[str]]] = []
    for (a, b), sigs in pair_signals.items():
        if any(s.startswith("C:") for s in sigs) and not _is_certain_edge(members[a], members[b], sigs):
            review.append((members[a], members[b], sigs))

    return groups, pair_signals, review


def _why(group: list[Member], pair_signals: dict[tuple[str, str], set[str]]) -> str:
    reasons: list[str] = []
    for i, a in enumerate(group):
        for b in group[i + 1:]:
            sigs = pair_signals.get((min(a.id, b.id), max(a.id, b.id)), set())
            if "A" in sigs:
                reasons.append(f"recomputed slug {a.rec_slug!r} shared")
            reasons.extend(
                f"shared {s.split(':', 1)[1]}" for s in sigs if s.startswith("C:")
            )
    seen: list[str] = []
    for r in reasons:
        if r not in seen:
            seen.append(r)
    return "; ".join(seen)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--quiet", action="store_true", help="print only when the check fails")
    args = parser.parse_args()

    dsn = os.environ.get("SUPABASE_DB_URL")
    if not dsn:
        print("ERROR: SUPABASE_DB_URL not set", file=sys.stderr)
        return 2

    try:
        with psycopg.connect(dsn, prepare_threshold=None, row_factory=dict_row) as conn:
            with conn.cursor() as cur:
                members, code_by_id = _fetch(cur)
                groups, pair_signals, review = _certain_groups(members, code_by_id, cur)
                variants = variant_pairs(members, known_pairs=set(pair_signals))
    except Exception as exc:  # noqa: BLE001
        # A check that cannot run is not a passing check.
        print(f"ERROR: could not run the split check: {exc}", file=sys.stderr)
        return 2

    drifted = sum(1 for m in members.values() if m.drifted)
    certain_variants = sum(1 for p in variants if p.band == "certain-review")

    if groups:
        print(
            f"FAIL: {len(groups)} certain split-evidence duplicate group(s) among "
            f"published suppliers (one legal entity, fragmented profiles).\n"
            f"Repair with: python ops/merge_duplicate_suppliers.py  (dry run first)\n"
        )
        for g in groups:
            names = " + ".join(f"{m.name!r}[{m.id[:6]}]" for m in g)
            print(f"  {names}\n      {_why(g, pair_signals)}")
        if review:
            print(
                f"\n  plus {len(review)} shared-ref pair(s) that are NOT identity-proof "
                f"(ownership questions — human decides, see the audit):"
            )
            for a, b, sigs in review:
                refs = ", ".join(s.split(":", 1)[1] for s in sigs if s.startswith("C:"))
                print(f"  {a.name!r}[{a.id[:6]}] ~ {b.name!r}[{b.id[:6]}]  ({refs})")
        if variants:
            print(
                f"\n  also {certain_variants} name-variant pair(s) in the certain-review "
                f"band + {len(variants) - certain_variants} review-band (report only — "
                f"the audit lists them)"
            )
        return 1

    if not args.quiet:
        print(
            f"OK: no certain split-evidence duplicates among {len(members)} published suppliers; "
            f"{len(review)} shared-ref ownership question(s) standing; "
            f"{certain_variants} name-variant pair(s) in the certain-review band "
            f"(+{len(variants) - certain_variants} review-band; report only — the audit lists them); "
            f"{drifted} supplier(s) carry drifted stored identity "
            f"(run ops/backfill_supplier_identity.py when non-zero)."
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
