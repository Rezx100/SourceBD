"""Spec 10 — diagnostic report on current dedup / parent-group state.

Read-only. No DB mutations. Produces a JSON blob + human summary covering:
  1. Suppliers + scratch-slug count.
  2. verification_queue counts by queue_type (open only).
  3. partner_factories / bh_factory_relationships baseline.
  4. parent_group_name column presence + non-null count.
  5. WRAP-only RMG residual count + first-10 names.
  6. Candidate parent-group clusters (algorithmic first-significant-token).
  7. Seed-list parent group recall against current corpus.

Run:
    python -m ops.spec10_dedup_diag
    python -m ops.spec10_dedup_diag --json ops/_spec10_diag.json
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

import psycopg
from psycopg.rows import dict_row

from etl.core.config import settings
from ops.spec10_seeds import PARENT_GROUP_SEEDS, STOP_TOKENS, first_sig_token

SUPABASE_URL = settings.supabase_db_url or os.environ.get("SUPABASE_DB_URL", "")
if not SUPABASE_URL:
    print("SUPABASE_DB_URL not set", file=sys.stderr)
    sys.exit(2)

REGISTER_SOURCES = ["BGMEA", "BKMEA", "RSC", "EPB", "BTMA", "BGAPMEA"]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--json", type=Path, default=None, help="write JSON output here")
    args = ap.parse_args()

    out: dict = {}

    with psycopg.connect(SUPABASE_URL, prepare_threshold=None, row_factory=dict_row) as conn, conn.cursor() as cur:
        cur.execute("select count(*) as n from public.suppliers")
        out["suppliers_total"] = cur.fetchone()["n"]

        cur.execute("select count(*) as n from public.suppliers where slug ~ '^__rn_'")
        out["scratch_slugs"] = cur.fetchone()["n"]

        cur.execute(
            "select queue_type, count(*) as n from public.verification_queue "
            "where reviewed_at is null group by queue_type order by 1"
        )
        out["queue_open"] = {r["queue_type"]: r["n"] for r in cur.fetchall()}

        cur.execute("select count(*) as n from public.partner_factories")
        out["partner_factories_total"] = cur.fetchone()["n"]

        cur.execute(
            "select column_name from information_schema.columns "
            "where table_schema='public' and table_name='suppliers' "
            "  and column_name='parent_group_name'"
        )
        out["parent_group_column_present"] = cur.fetchone() is not None

        if out["parent_group_column_present"]:
            cur.execute(
                "select parent_group_name, count(*) as n from public.suppliers "
                "where parent_group_name is not null group by 1 order by n desc"
            )
            out["parent_groups_populated"] = [
                {"name": r["parent_group_name"], "n": r["n"]} for r in cur.fetchall()
            ]
        else:
            out["parent_groups_populated"] = []

        cur.execute(
            "select count(*) as n from public.suppliers "
            "where 'WRAP'=ANY(source_tags) and not (source_tags && %s::text[])",
            (REGISTER_SOURCES,),
        )
        out["wrap_only_rmg_residual"] = cur.fetchone()["n"]

        cur.execute(
            "select company_name from public.suppliers "
            "where 'WRAP'=ANY(source_tags) and not (source_tags && %s::text[]) "
            "order by company_name limit 10",
            (REGISTER_SOURCES,),
        )
        out["wrap_only_rmg_examples"] = [r["company_name"] for r in cur.fetchall()]

        # Seed-list recall.
        seed_recall = []
        for seed in PARENT_GROUP_SEEDS:
            where = " or ".join(["company_name_norm ~ %s"] * len(seed["patterns"]))
            params = list(seed["patterns"])
            cur.execute(
                f"select count(*) as n from public.suppliers where {where}", params
            )
            seed_recall.append({
                "parent_group_name": seed["name"],
                "matched_factories": cur.fetchone()["n"],
            })
        out["seed_recall"] = seed_recall

        # Algorithmic candidates: first significant token clusters >= 3.
        cur.execute(
            "select id, company_name, company_name_norm from public.suppliers "
            "where company_name_norm is not null"
        )
        rows = cur.fetchall()
        buckets: dict[str, list[dict]] = {}
        for r in rows:
            tok = first_sig_token(r["company_name_norm"])
            if not tok:
                continue
            buckets.setdefault(tok, []).append(r)
        clusters = [
            {"token": tok, "size": len(members)}
            for tok, members in buckets.items() if len(members) >= 3
        ]
        clusters.sort(key=lambda x: -x["size"])
        out["algorithmic_clusters_count"] = len(clusters)
        out["algorithmic_clusters_top20"] = clusters[:20]
        out["stop_tokens"] = sorted(STOP_TOKENS)

    print(json.dumps(out, indent=2, default=str))

    if args.json:
        args.json.parent.mkdir(parents=True, exist_ok=True)
        args.json.write_text(json.dumps(out, indent=2, default=str), encoding="utf-8")
        print(f"\nwrote: {args.json}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
