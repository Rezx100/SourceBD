"""Spec 10 — regenerate `verification_queue` rows of type `fuzzy_match_review`
from the current corpus.

Why: Spec 08's retroactive merge ran on the WRAP/OEKO-TEX cert-only residual
at a single point in time. Since then the corpus has grown (e.g. brand
disclosure ingest added 75 supplier rows). Some old queue rows now point at
deleted suppliers; new cert-only ↔ register pairs may have appeared.

Behavior:
  * Recomputes the dual-scorer (token_sort >=85 OR token_set >=85) candidate
    set from the live DB.
  * Drops every unreviewed `fuzzy_match_review` row whose `supplier_a_id` no
    longer exists OR whose recomputed candidate disagrees with stored data.
  * Inserts one queue row per current candidate. Uses
    `(queue_type='fuzzy_match_review', supplier_a_id, source_data->>'target_supplier_id')`
    as the idempotency key — a second invocation produces 0 inserts.
  * Auto-merge band stays disabled (Spec 08 decision (e)).
  * Pure dedup-engine code; no supplier rows are mutated.

Run:
    python -m ops.spec10_requeue_fuzzy                 # dry-run
    python -m ops.spec10_requeue_fuzzy --live          # apply
    python -m ops.spec10_requeue_fuzzy --live --limit 50
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from typing import Any

import psycopg
from psycopg.rows import dict_row
from rapidfuzz import fuzz, process

from etl.core.config import settings

SUPABASE_URL = settings.supabase_db_url or os.environ.get("SUPABASE_DB_URL", "")
if not SUPABASE_URL:
    print("SUPABASE_DB_URL not set", file=sys.stderr)
    sys.exit(2)

REGISTER_SOURCES = ["BGMEA", "BKMEA", "RSC", "EPB", "BTMA", "BGAPMEA"]

AUTO_MERGE_THRESHOLD = 92
QUEUE_LOW = 85
SIG_TOKEN_MIN_LEN = 4
SIG_TOKEN_MIN_COUNT = 2
RULE_VERSION = "spec10_requeue_v1"


def _sig_tokens(norm: str) -> set[str]:
    return {t for t in (norm or "").split() if len(t) >= SIG_TOKEN_MIN_LEN}


def classify(
    cert: dict[str, Any],
    pool_norms: dict[str, str],
    pool_names: dict[str, str],
    pool_sigs: dict[str, set[str]],
) -> dict[str, Any]:
    norm = cert["company_name_norm"] or ""
    if not norm:
        return {"action": "skip", "reason": "empty_norm"}
    cert_sigs = _sig_tokens(norm)
    if len(cert_sigs) < SIG_TOKEN_MIN_COUNT:
        return {"action": "skip", "reason": "too_few_significant_tokens"}

    top = process.extract(norm, pool_norms, scorer=fuzz.token_sort_ratio, limit=5)
    best: dict[str, Any] | None = None
    for _n, sort_score, key in top:
        target_sigs = pool_sigs.get(key, set())
        shared = cert_sigs & target_sigs
        if len(shared) < SIG_TOKEN_MIN_COUNT:
            continue
        set_score = fuzz.token_set_ratio(norm, pool_norms[key])
        score_pair = (sort_score, set_score)
        if best is None or score_pair > (best["sort"], best["set"]):
            best = {
                "target_id": key,
                "target_name": pool_names.get(key, key),
                "sort": float(sort_score),
                "set": float(set_score),
                "shared_tokens": sorted(shared),
            }
    if best is None:
        return {"action": "skip", "reason": "no_token_overlap_candidate"}
    # Auto-merge band intentionally disabled per Spec 08 decision (e).
    if best["sort"] >= QUEUE_LOW or best["set"] >= QUEUE_LOW:
        best["action"] = "queue"
        return best
    best["action"] = "skip"
    best["reason"] = "below_queue_threshold"
    return best


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--live", action="store_true")
    ap.add_argument("--limit", type=int, default=0)
    args = ap.parse_args()

    with psycopg.connect(SUPABASE_URL, prepare_threshold=None, row_factory=dict_row) as conn:
        conn.autocommit = True
        with conn.cursor() as cur:
            cur.execute(
                "select id::text as id, company_name, company_name_norm "
                "from public.suppliers where source_tags && %s::text[]",
                (REGISTER_SOURCES,),
            )
            pool = cur.fetchall()
            pool_norms = {r["id"]: r["company_name_norm"] or "" for r in pool}
            pool_names = {r["id"]: r["company_name"] for r in pool}
            pool_sigs = {sid: _sig_tokens(n) for sid, n in pool_norms.items()}
            print(f"register pool: {len(pool_norms)}", flush=True)

            cur.execute(
                "select id::text as id, slug, company_name, company_name_norm, source_tags "
                "from public.suppliers "
                "where source_tags && ARRAY['WRAP','OEKO_TEX']::text[] "
                "  and not (source_tags && %s::text[])",
                (REGISTER_SOURCES,),
            )
            cert_only = cur.fetchall()
            print(f"cert-only suppliers: {len(cert_only)}", flush=True)

            # Current candidate set keyed by (supplier_a_id, target_id).
            candidates: dict[tuple[str, str], dict[str, Any]] = {}
            n_skip = 0
            for cert in cert_only:
                dec = classify(cert, pool_norms, pool_names, pool_sigs)
                if dec["action"] != "queue":
                    n_skip += 1
                    continue
                candidates[(cert["id"], dec["target_id"])] = {
                    "cert": cert,
                    "dec": dec,
                }
            print(f"classified: queue={len(candidates)} skip={n_skip}", flush=True)

            # Existing open queue rows of this type.
            cur.execute(
                "select id, supplier_a_id::text as sa, source_data "
                "from public.verification_queue "
                "where queue_type='fuzzy_match_review' and reviewed_at is null"
            )
            existing: dict[tuple[str, str], str] = {}  # (sa, target) -> queue_id
            stale: list[str] = []
            for row in cur.fetchall():
                sa = row["sa"]
                sd = row["source_data"] or {}
                tgt = sd.get("target_supplier_id")
                if not sa or not tgt:
                    stale.append(row["id"])
                    continue
                # Stale if cert supplier gone OR pair no longer a candidate.
                if sa not in {c["cert"]["id"] for c in candidates.values()}:
                    if sa not in pool_norms:  # cert supplier deleted
                        stale.append(row["id"])
                        continue
                if (sa, tgt) not in candidates:
                    stale.append(row["id"])
                else:
                    existing[(sa, tgt)] = row["id"]

            new_pairs = [k for k in candidates if k not in existing]
            print(f"existing open queue rows: kept={len(existing)} stale={len(stale)} new={len(new_pairs)}",
                  flush=True)

            if args.limit:
                new_pairs = new_pairs[: args.limit]
                print(f"  limit applied: {len(new_pairs)} new inserts", flush=True)

            if not args.live:
                print("\nDRY-RUN. Re-run with --live to apply.", flush=True)
                return 0

            for qid in stale:
                cur.execute("delete from public.verification_queue where id = %s", (qid,))

            for key in new_pairs:
                payload = candidates[key]
                cert, dec = payload["cert"], payload["dec"]
                cur.execute(
                    "insert into public.verification_queue "
                    "  (queue_type, supplier_a_id, supplier_b_name, confidence, source_data) "
                    "values ('fuzzy_match_review', %s, %s, %s, %s::jsonb)",
                    (
                        cert["id"],
                        dec["target_name"],
                        round(min(dec["sort"], dec["set"]) / 100.0, 3),
                        json.dumps({
                            "cert_supplier_id": cert["id"],
                            "cert_supplier_name": cert["company_name"],
                            "cert_source_tags": cert["source_tags"],
                            "target_supplier_id": dec["target_id"],
                            "target_supplier_name": dec["target_name"],
                            "token_sort_ratio": dec["sort"],
                            "token_set_ratio": dec["set"],
                            "shared_significant_tokens": dec["shared_tokens"],
                            "rule": RULE_VERSION,
                            "rule_detail": (
                                f"sort>={QUEUE_LOW} or set>={QUEUE_LOW}; "
                                f"auto_merge {AUTO_MERGE_THRESHOLD}/{AUTO_MERGE_THRESHOLD} disabled"
                            ),
                        }),
                    ),
                )

            print(f"\nDONE. stale_dropped={len(stale)} new_inserted={len(new_pairs)}", flush=True)
            return 0


if __name__ == "__main__":
    raise SystemExit(main())
