"""Write every past human identity decision into the tables the ETL obeys
(ETL freshness C1, spec-etl-freshness.md §8.3).

WHY
---
`resolution_edges` (0093) and `supplier_field_locks` (0094) are read by the
matcher and the writer, but both were empty on 6 Oct 2026. Every fix a human
made lived in an ops script or a report, so a matcher change or a re-keyed
source could redo it. This script copies those decisions into the tables.

WHAT IT READS (no new rulings are invented here)
------------------------------------------------
- Founder rulings already encoded in `ops/seed_resolution_edges.py` (sarada,
  corny/crony).
- REZ-116 orphan moves (`MOVES` in `ops/move_bgmea_orphan_registrations.py`;
  `ops/plans/bgmea-attribution-decisions.md` §1): the old holder and the
  rightful owner are different companies.
- REZ-117 ambiguous decisions (`DECISIONS` in the REZ-117 script, §2 of the
  same report): every move is a different-company ruling; every import also
  rules the new buying house apart from each candidate row the founder
  rejected (the §2 candidate table, copied below). Retags to buying_house are
  hand-set values and get an `entity_type` lock.
- The BKMEA unmerge of 31 Jul 2026 (`ops/unmerge_bkmea_suppliers.py`): it
  kept no pair log, so the pairs below were rebuilt from production on
  6 Oct 2026 — a supplier the unmerge created that shares a phone or mailbox
  with an older supplier holding a different BKMEA membership number.
  NOOR-A-ALIA / NOOR-A-ALIA FASHION is left out: it is an open duplicate
  question, not a ruling.
- `admin_audit_log` `admin_supplier_update` rows: each patched column becomes
  a lock, but only while the row still holds the value the human set.

Not read, on purpose: REZ-102 (detection only, no rulings), REZ-115 (a
storage backfill, no pair decisions), the §1 HOLD on ref 1168 and the
"check carefully" rows of §3a (questions, not rulings).

USAGE
-----
    PYTHONPATH=. python ops/backfill_human_decisions.py            # dry run
    PYTHONPATH=. python ops/backfill_human_decisions.py --apply    # founder only
    PYTHONPATH=. python ops/backfill_human_decisions.py --verify   # read-only replay

Transport: Supabase REST + service-role key, as in seed_resolution_edges.
`--verify` uses the ETL database connection and only reads.
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass

import httpx

from ops.seed_resolution_edges import FOUNDER_RULINGS, Rest, sorted_pair_ids


@dataclass(frozen=True)
class EdgePlan:
    side_a: str  # a slug, or "ref:<source_code>:<source_ref>" for the holder
    side_b: str
    verdict: str
    rationale: str
    source: str


@dataclass(frozen=True)
class LockPlan:
    side: str
    column: str
    value: object
    reason: str
    source: str


# §2 candidate rows the founder rejected by importing a new buying house.
REZ117_REJECTED_CANDIDATES: dict[str, tuple[str, ...]] = {
    "953": ("mas-fashion-bd", "sas-fashions"),
    "330": ("akr-fashions", "har-fashion"),
    "1573": ("w-apparels", "apparel-4"),
    "1020": ("js-international", "cj-international"),
    "1129": ("amin-enterprise", "rn-enterprise"),
    "296": ("maxtrims-international", "max-international", "maximo-international"),
    "528": ("sap-fashions", "bsa-fashion", "saz-fashion", "sas-fashions", "sag-fashion"),
    "1261": ("textil-fashions", "fashion-tex", "q-tex-fashion", "r-tex-fashion"),
}

# Rebuilt 6 Oct 2026 (see module docstring). (split-off, older supplier,
# split-off BKMEA no., older supplier's BKMEA no.)
BKMEA_UNMERGE_PAIRS: tuple[tuple[str, str, str, str], ...] = (
    ("aboni-textile", "aboni-knitwear", "624", "625"),
    ("ak-fashion", "ahsan-apparels", "286", "1920"),
    ("ak-fashion", "ak-knitwear", "286", "1449/489"),
    ("ar-knitwear", "ra-apparels", "289", "1391"),
    ("bs-knitwear", "sb-knitwear", "756", "1212"),
    ("crony-apparels", "abanti-colour-tex", "376", "617"),
    ("crony-apparels", "corny-fashion", "376", "377"),
    ("crony-apparels", "crony-tex-sweater", "376", "1831"),
    ("crony-apparels", "krony-knitwear", "376", "1101"),
    ("crony-apparels", "ss-cotton-fabrics", "376", "378"),
    ("euphoria-apparels", "ingenitex-bd", "2129", "2411"),
    ("fair-apparels-bd", "fair-clothings", "557", "752"),
    ("fair-apparels-bd", "fair-knitting", "557", "651"),
    ("fair-cotton", "cotton-fair", "415", "558"),
    ("fatullah-fashion", "sweater-heaven", "338", "1514"),
    ("focus-apparels-bd", "focus-international", "2075", "2421"),
    ("focus-apparels-bd", "tawakkul-apparels", "2075", "2521"),
    ("jams-fashion", "jams-apparels", "389", "476"),
    ("jm-fashion", "jm-knitwear", "789", "1085"),
    ("kakado-bangladesh", "kakado-trading-bangladesh", "2048", "2100"),
    ("moontaha-fashion", "anita-apparels", "1666", "2398"),
    ("moontaha-fashion", "moontaha-apparels", "1666", "2079"),
    ("moontaha-fashion", "vestment-tune-style", "1666", "1537"),
    ("northern", "northern-fashion", "595", "1082"),
    ("rainbow-group", "rainbow-enterprise", "60", "644"),
    ("rib-line", "knit-men", "1823", "1097"),
    ("rib-line", "knit-men-composite", "1823", "1964"),
    ("rib-line", "rib-line-fashion", "1823", "1901"),
    ("rony-knitwear", "rony-fashion-international", "58", "851"),
    ("rs-export-import", "new-rs-hi-fashion", "1764", "1938"),
    ("rs-export-import", "sr-apparels", "1764", "2390"),
    ("sincere-export", "sincere-knitwear", "160", "284"),
    ("union-enterprise", "union-fashion", "941", "1368"),
    ("united-apparels", "united-knitwear", "17", "27"),
    ("united-apparels", "wave-tex-apparels", "17", "578"),
)

# admin_audit_log patch keys that are not the suppliers column name.
AUDIT_PATCH_COLUMNS = {"published": "is_published"}

BGMEA_SOURCE = "BGMEA"


def build_edge_plan() -> list[EdgePlan]:
    """Every ruling, from the code tables that already encode it."""
    from ops.move_bgmea_orphan_registrations import MOVES
    from ops.apply_rez117_ambiguous_decisions import DECISIONS

    plan = [
        EdgePlan(r.slug_a, r.slug_b, r.verdict, r.rationale,
                 "ops/seed_resolution_edges.py")
        for r in FOUNDER_RULINGS
    ]
    for m in MOVES:
        plan.append(EdgePlan(
            m.from_slug, m.to_slug, "different",
            f"BGMEA {m.ref} ({m.registered_name}) was on {m.from_slug}; "
            f"founder moved it to {m.to_slug} ({m.provenance}).",
            "ops/plans/bgmea-attribution-decisions.md §1 (REZ-116)",
        ))
    for d in DECISIONS:
        src = "ops/plans/bgmea-attribution-decisions.md §2 (REZ-117)"
        if d.action in ("move", "move_retag"):
            plan.append(EdgePlan(
                d.from_slug, d.to_slug, "different",
                f"BGMEA {d.ref} ({d.registered_name}) was on {d.from_slug}; "
                f"founder moved it to {d.to_slug}.", src,
            ))
        elif d.action == "import_move":
            holder = f"ref:{BGMEA_SOURCE}:{d.ref}"
            plan.append(EdgePlan(
                d.from_slug, holder, "different",
                f"BGMEA {d.ref} ({d.registered_name}) was on {d.from_slug}; "
                "founder imported it as its own buying house.", src,
            ))
            for cand in REZ117_REJECTED_CANDIDATES.get(d.ref, ()):
                plan.append(EdgePlan(
                    holder, cand, "different",
                    f"{d.registered_name} (BGMEA {d.ref}) is not {cand}: the "
                    "founder rejected this candidate and imported a new row.",
                    src,
                ))
    for split, older, reg_split, reg_older in BKMEA_UNMERGE_PAIRS:
        plan.append(EdgePlan(
            split, older, "different",
            f"BKMEA members {reg_split} and {reg_older} are separate legal "
            "entities; merged by a shared contact, split 31 Jul 2026.",
            "ops/unmerge_bkmea_suppliers.py run of 31 Jul 2026 "
            "(pairs rebuilt from production 6 Oct 2026)",
        ))
    return plan


def build_lock_plan(audit_rows: list[dict]) -> list[LockPlan]:
    from ops.apply_rez117_ambiguous_decisions import DECISIONS

    plan: list[LockPlan] = []
    for d in DECISIONS:
        if not d.set_buying_house:
            continue
        side = d.to_slug or f"ref:{BGMEA_SOURCE}:{d.ref}"
        plan.append(LockPlan(
            side, "entity_type", "buying_house",
            f"Founder policy 12 Aug 2026: associate-register company "
            f"{d.registered_name} is a buying house.",
            "ops/plans/bgmea-attribution-decisions.md §2 (REZ-117)",
        ))
    for row in audit_rows:
        for key, value in (row.get("patch") or {}).items():
            plan.append(LockPlan(
                f"id:{row['target_id']}", AUDIT_PATCH_COLUMNS.get(key, key), value,
                f"Set by hand in the admin editor {row['created_at'][:10]}.",
                f"admin_audit_log {row['id']}",
            ))
    # Audit rows come newest first; later ones for the same (side, column)
    # are dropped here. Two side spellings of one row are caught in run().
    seen: set[tuple[str, str]] = set()
    out: list[LockPlan] = []
    for lock in plan:
        if (lock.side, lock.column) in seen:
            continue
        seen.add((lock.side, lock.column))
        out.append(lock)
    return out


class Resolver:
    """Side string -> supplier row (id, slug, plus any asked-for column)."""

    def __init__(self, rest: Rest) -> None:
        self.rest = rest
        self._source_ids: dict[str, str] = {}

    def _source_id(self, code: str) -> str:
        if code not in self._source_ids:
            row = self.rest.one("sources", {"select": "id", "code": f"eq.{code}"})
            if row is None:
                raise RuntimeError(f"source {code} not found")
            self._source_ids[code] = row["id"]
        return self._source_ids[code]

    def supplier(self, side: str, extra: str = "") -> dict | None:
        cols = "id,slug,company_name" + (f",{extra}" if extra else "")
        if side.startswith("ref:"):
            _, code, ref = side.split(":", 2)
            rows = self.rest.all_rows("source_records", {
                "select": "supplier_id",
                "source_id": f"eq.{self._source_id(code)}",
                "source_ref": f"eq.{ref}",
            })
            ids = {r["supplier_id"] for r in rows}
            if len(ids) != 1:
                return None  # missing or ambiguous: never guess
            side = f"id:{ids.pop()}"
        if side.startswith("id:"):
            return self.rest.one("suppliers", {"select": cols, "id": f"eq.{side[3:]}"})
        return self.rest.one("suppliers", {"select": cols, "slug": f"eq.{side}"})


def _insert(rest: Rest, path: str, body: dict) -> str:
    try:
        rest.insert(path, body)
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code == 409:  # live-row unique index
            return "already-present"
        raise
    return "inserted"


def run(rest: Rest, *, apply: bool) -> dict[str, int]:
    resolver = Resolver(rest)
    counts: dict[str, int] = {}

    def tally(status: str) -> None:
        counts[status] = counts.get(status, 0) + 1

    print("== Same / never-same rulings ==")
    seen_pairs: set[tuple[str, str]] = set()
    for e in build_edge_plan():
        left, right = resolver.supplier(e.side_a), resolver.supplier(e.side_b)
        if left is None or right is None:
            missing = [s for s, r in ((e.side_a, left), (e.side_b, right)) if r is None]
            status = "structurally-satisfied" if e.verdict == "same" and len(missing) == 1 else "missing-side"
            print(f"SKIP ({status})  {e.side_a} / {e.side_b}  missing={missing}  [{e.source}]")
            tally(status)
            continue
        if left["id"] == right["id"]:
            print(f"SKIP (same-row)  {e.side_a} / {e.side_b} resolve to one supplier  [{e.source}]")
            tally("same-row")
            continue
        a, b = sorted_pair_ids(left["id"], right["id"])
        if (a, b) in seen_pairs:
            tally("duplicate-in-plan")
            continue
        seen_pairs.add((a, b))
        label = f"{left['slug']} {'=' if e.verdict == 'same' else '≠'} {right['slug']}"
        if not apply:
            print(f"WOULD INSERT  {label}  [{e.source}]\n  {e.rationale}")
            tally("would-insert-edge")
            continue
        status = _insert(rest, "resolution_edges", {
            "supplier_a": a, "supplier_b": b, "verdict": e.verdict,
            "decided_by": "ops:backfill_human_decisions",
            "rationale": e.rationale, "evidence_note": e.source,
        })
        print(f"{status.upper()}  {label}")
        tally(f"{status}-edge")

    print("\n== Field locks ==")
    audit = rest.all_rows("admin_audit_log", {
        "select": "id,target_id,patch,created_at",
        "action": "eq.admin_supplier_update",
        "target_table": "eq.suppliers",
        "order": "created_at.desc",
    })
    locked: dict[tuple[str, str], LockPlan] = {}
    for lock in build_lock_plan(audit):
        row = resolver.supplier(lock.side, lock.column)
        if row is None:
            print(f"SKIP (missing-side)  {lock.side}.{lock.column}  [{lock.source}]")
            tally("missing-side")
            continue
        prior = locked.get((row["id"], lock.column))
        if prior is not None:
            # One row named two ways (slug and id:). Never let one silently
            # win: a human looks at it.
            print(f"SKIP (conflict)  {row['slug']}.{lock.column}: {lock.value!r} "
                  f"[{lock.source}] vs {prior.value!r} [{prior.source}]")
            tally("conflict")
            continue
        locked[(row["id"], lock.column)] = lock
        if row.get(lock.column) != lock.value:
            # The value was changed again since; locking it would freeze
            # something no human set. Report it instead.
            print(f"SKIP (no-longer-holds)  {row['slug']}.{lock.column} = "
                  f"{row.get(lock.column)!r}, human set {lock.value!r}  [{lock.source}]")
            tally("no-longer-holds")
            continue
        label = f"{row['slug']}.{lock.column} = {lock.value!r}"
        if not apply:
            print(f"WOULD LOCK  {label}  [{lock.source}]")
            tally("would-insert-lock")
            continue
        status = _insert(rest, "supplier_field_locks", {
            "supplier_id": row["id"], "column_name": lock.column,
            "locked_value": lock.value, "locked_by": "ops:backfill_human_decisions",
            "reason": f"{lock.reason} [{lock.source}]",
        })
        print(f"{status.upper()}  {label}")
        tally(f"{status}-lock")

    print("\n" + json.dumps(counts, sort_keys=True))
    if not apply:
        print("Dry run: nothing written.")
    return counts


def matcher_would_merge(norm_a: str, norm_b: str) -> bool:
    """Would `_find_existing` join these two names if one row were missing?

    Squash equality (Pass 1.5) or the Pass 4 fuzzy bar with its order check.
    Contact passes are not modelled: they also need this name bar or more.
    """
    from rapidfuzz import fuzz

    from etl.core.upsert import _FUZZY_THRESHOLD, _names_compatible, _same_head_word

    if norm_a.replace(" ", "") == norm_b.replace(" ", ""):
        return True
    return (fuzz.token_sort_ratio(norm_a, norm_b) >= _FUZZY_THRESHOLD
            and _names_compatible(norm_a, norm_b)
            and _same_head_word(norm_a, norm_b))


def verify() -> int:
    """Read-only replay after apply.

    1. Every never-same pair: each side's name, mailbox and phones go back
       through `_find_existing` (no source ref, as a re-keyed source would
       send them) and must not land on the other side. Pairs whose names the
       matcher would join if one row disappeared are listed as at risk; C2's
       hold covers those.
    2. Every live lock still holds its locked value.
    """
    from etl.core import db
    from etl.core.upsert import _find_existing

    failures = 0
    with db.conn() as c, c.cursor() as cur:
        cur.execute(
            """select e.verdict,
                      a.id::text a_id, a.slug a_slug, a.company_name_norm a_norm,
                      a.email_primary a_email, a.phones a_phones,
                      b.id::text b_id, b.slug b_slug, b.company_name_norm b_norm,
                      b.email_primary b_email, b.phones b_phones
                 from public.resolution_edges e
                 join public.suppliers a on a.id = e.supplier_a
                 join public.suppliers b on b.id = e.supplier_b
                where e.superseded_at is null and e.verdict = 'different'"""
        )
        pairs = cur.fetchall()
        at_risk = 0
        for p in pairs:
            for me, other in (("a", "b"), ("b", "a")):
                # Blank slug: a re-read spelling never reproduces our slug,
                # so Pass 1 must not short-circuit the replay onto itself.
                got = _find_existing(
                    cur, slug="", norm=p[f"{me}_norm"] or "",
                    email=p[f"{me}_email"], phones=list(p[f"{me}_phones"] or []),
                )
                if got == p[f"{other}_id"]:
                    failures += 1
                    print(f"FAIL  {p[f'{me}_slug']} resolves to {p[f'{other}_slug']}")
            if matcher_would_merge(p["a_norm"] or "", p["b_norm"] or ""):
                at_risk += 1
                print(f"AT RISK  {p['a_slug']} / {p['b_slug']}: names clear the fuzzy bar")
        cur.execute(
            """select l.column_name, l.locked_value, to_jsonb(s) as row, s.slug
                 from public.supplier_field_locks l
                 join public.suppliers s on s.id = l.supplier_id
                where l.released_at is null"""
        )
        locks = cur.fetchall()
        for lock in locks:
            if lock["row"].get(lock["column_name"]) != lock["locked_value"]:
                failures += 1
                print(f"FAIL  {lock['slug']}.{lock['column_name']} drifted from "
                      f"{lock['locked_value']!r}")
        c.rollback()
    print(f"{len(pairs)} never-same pairs replayed, {at_risk} at risk; "
          f"{len(locks)} locks checked; {failures} failures.")
    return 1 if failures else 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--apply", action="store_true", help="write (founder only)")
    group.add_argument("--verify", action="store_true", help="read-only replay")
    args = parser.parse_args()
    if args.verify:
        return verify()
    run(Rest(), apply=args.apply)
    return 0


if __name__ == "__main__":
    sys.exit(main())
