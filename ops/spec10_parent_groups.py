"""Spec 10 — populate `public.suppliers.parent_group_name` for known corporate
parent groups whose member factories are name-identifiable from current
register data; enqueue ambiguous clusters as `verification_queue`
queue_type='group_parent_review'.

Algorithm:
  PASS A (deterministic): for each seed in ops.spec10_seeds.PARENT_GROUP_SEEDS,
    find every supplier whose `company_name_norm` matches any seed pattern;
    if cluster size >= 3, write `parent_group_name = seed.name` on all
    members. Idempotent: only updates rows where the column is NULL or
    already equals the seed name.

  PASS B (algorithmic, queue-only): bucket every supplier by
    first_sig_token(company_name_norm). For buckets with size >= 3 that did
    NOT receive a seed-driven parent assignment, insert one
    `verification_queue` row per bucket (queue_type='group_parent_review')
    with the candidate token + member ids + names in source_data. Idempotent
    via (queue_type, source_data->>'cluster_token').

  Pure dedup/grouping engine. No supplier rows are deleted or merged.
  No FK reassignment. Only the new column is written.

Run:
    python -m ops.spec10_parent_groups               # dry-run
    python -m ops.spec10_parent_groups --live        # apply
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from typing import Any

import psycopg
from psycopg.rows import dict_row

from etl.core.config import settings
from ops.spec10_seeds import PARENT_GROUP_SEEDS, first_sig_token

SUPABASE_URL = settings.supabase_db_url or os.environ.get("SUPABASE_DB_URL", "")
if not SUPABASE_URL:
    print("SUPABASE_DB_URL not set", file=sys.stderr)
    sys.exit(2)

CLUSTER_MIN_SIZE = 3
RULE_VERSION = "spec10_parent_groups_v1"


def assign_deterministic(cur, dry: bool) -> dict[str, Any]:
    """For each seed with >=3 matches, set parent_group_name on members."""
    summary: list[dict[str, Any]] = []
    total_updated = 0
    matched_ids: set[str] = set()

    for seed in PARENT_GROUP_SEEDS:
        compiled = [re.compile(p) for p in seed["patterns"]]
        cur.execute(
            "select id::text as id, company_name, company_name_norm, parent_group_name "
            "from public.suppliers where company_name_norm is not null"
        )
        rows = cur.fetchall()
        members = [
            r for r in rows
            if any(rx.search(r["company_name_norm"]) for rx in compiled)
        ]
        if len(members) < CLUSTER_MIN_SIZE:
            summary.append({
                "name": seed["name"],
                "matched": len(members),
                "assigned": 0,
                "skipped_below_min": True,
            })
            continue

        # Idempotent assign: only update rows where parent_group_name is NULL
        # or already equals the seed name. Refuse to overwrite a conflicting
        # existing assignment (would indicate cross-group ambiguity to log).
        to_update = [r for r in members if r["parent_group_name"] is None]
        conflicts = [
            r for r in members
            if r["parent_group_name"] is not None
            and r["parent_group_name"] != seed["name"]
        ]
        if not dry:
            for r in to_update:
                cur.execute(
                    "update public.suppliers set parent_group_name = %s, updated_at = now() "
                    "where id = %s and parent_group_name is null",
                    (seed["name"], r["id"]),
                )
        total_updated += len(to_update)
        for r in members:
            matched_ids.add(r["id"])
        summary.append({
            "name": seed["name"],
            "matched": len(members),
            "assigned": len(to_update) if not dry else 0,
            "would_assign": len(to_update) if dry else None,
            "already_set": len(members) - len(to_update) - len(conflicts),
            "conflicts": len(conflicts),
            "examples": [r["company_name"] for r in members[:5]],
        })
    return {"summary": summary, "total_updated": total_updated, "matched_ids": matched_ids}


def enqueue_ambiguous(cur, matched_ids: set[str], dry: bool) -> dict[str, Any]:
    """First-significant-token clusters of size >=3 not covered by a seed
    assignment → queue_type='group_parent_review'."""
    cur.execute(
        "select id::text as id, company_name, company_name_norm, district, source_tags, parent_group_name "
        "from public.suppliers where company_name_norm is not null"
    )
    rows = cur.fetchall()
    buckets: dict[str, list[dict]] = {}
    for r in rows:
        tok = first_sig_token(r["company_name_norm"])
        if not tok:
            continue
        buckets.setdefault(tok, []).append(r)

    candidates = []
    for tok, members in buckets.items():
        if len(members) < CLUSTER_MIN_SIZE:
            continue
        # Drop members already covered by a deterministic seed assignment;
        # only enqueue if the residual (unassigned) still has >=3 members.
        residual = [m for m in members if m["id"] not in matched_ids and m["parent_group_name"] is None]
        if len(residual) < CLUSTER_MIN_SIZE:
            continue
        candidates.append({"token": tok, "members": residual})

    candidates.sort(key=lambda c: -len(c["members"]))

    # Idempotency: look up existing open group_parent_review rows by cluster_token.
    cur.execute(
        "select id, source_data->>'cluster_token' as tok "
        "from public.verification_queue "
        "where queue_type='group_parent_review' and reviewed_at is null"
    )
    existing_tokens = {r["tok"]: r["id"] for r in cur.fetchall() if r["tok"]}

    n_inserted = 0
    n_skipped_existing = 0
    new_examples: list[str] = []
    for cand in candidates:
        tok = cand["token"]
        if tok in existing_tokens:
            n_skipped_existing += 1
            continue
        members = cand["members"]
        payload = {
            "cluster_token": tok,
            "cluster_size": len(members),
            "member_ids": [m["id"] for m in members],
            "member_names": [m["company_name"] for m in members[:20]],
            "districts_present": sorted({m["district"] for m in members if m["district"]}),
            "rule": RULE_VERSION,
            "rule_detail": (
                f"first_significant_token cluster size >= {CLUSTER_MIN_SIZE}; "
                "no seed-list match; admin must decide whether members share a "
                "corporate parent or are unrelated companies sharing a common word."
            ),
        }
        if not dry:
            cur.execute(
                "insert into public.verification_queue "
                "  (queue_type, supplier_a_id, supplier_b_name, confidence, source_data) "
                "values ('group_parent_review', %s, %s, %s, %s::jsonb)",
                (
                    members[0]["id"],
                    f"<cluster '{tok}' with {len(members)} members>",
                    None,
                    json.dumps(payload),
                ),
            )
        n_inserted += 1
        if len(new_examples) < 10:
            new_examples.append(f"  '{tok}' x{len(members)}: {members[0]['company_name']!r} ...")

    return {
        "candidate_clusters": len(candidates),
        "existing_open_rows": len(existing_tokens),
        "inserted": n_inserted if not dry else 0,
        "would_insert": n_inserted if dry else None,
        "skipped_existing": n_skipped_existing,
        "examples": new_examples,
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--live", action="store_true")
    args = ap.parse_args()
    dry = not args.live

    with psycopg.connect(SUPABASE_URL, prepare_threshold=None, row_factory=dict_row) as conn:
        conn.autocommit = True
        with conn.cursor() as cur:
            # Verify schema prerequisites.
            cur.execute(
                "select 1 from information_schema.columns "
                "where table_schema='public' and table_name='suppliers' "
                "  and column_name='parent_group_name'"
            )
            if cur.fetchone() is None:
                print("ERROR: public.suppliers.parent_group_name column missing. "
                      "Apply migration 0011 first.", file=sys.stderr)
                return 2
            cur.execute(
                "select 1 from pg_type t join pg_enum e on e.enumtypid=t.oid "
                "where t.typname='queue_type' and e.enumlabel='group_parent_review'"
            )
            if cur.fetchone() is None:
                print("ERROR: queue_type enum lacks 'group_parent_review'. "
                      "Apply migration 0011 first.", file=sys.stderr)
                return 2

            print("=== PASS A: deterministic seed assignment ===", flush=True)
            det = assign_deterministic(cur, dry=dry)
            for s in det["summary"]:
                print(f"  {s['name']:24s} matched={s['matched']:3d}  "
                      f"assigned={s['assigned']}  already_set={s.get('already_set',0)}  "
                      f"conflicts={s.get('conflicts',0)}", flush=True)
            print(f"  total parent_group_name rows updated: {det['total_updated']}", flush=True)

            print("\n=== PASS B: algorithmic clusters → group_parent_review queue ===", flush=True)
            amb = enqueue_ambiguous(cur, det["matched_ids"], dry=dry)
            print(f"  candidate clusters    : {amb['candidate_clusters']}", flush=True)
            print(f"  existing open rows    : {amb['existing_open_rows']}", flush=True)
            print(f"  inserted              : {amb['inserted']}", flush=True)
            if dry:
                print(f"  would_insert          : {amb['would_insert']}", flush=True)
            print(f"  skipped (idempotent)  : {amb['skipped_existing']}", flush=True)
            for ex in amb["examples"]:
                print(ex, flush=True)

            if dry:
                print("\nDRY-RUN. Re-run with --live to apply.", flush=True)
            else:
                print("\nDONE.", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
