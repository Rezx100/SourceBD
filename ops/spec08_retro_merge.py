"""Spec 08 retroactive merge — move WRAP/OEKO-TEX records onto register
suppliers when both `token_sort_ratio` and `token_set_ratio` agree at >= 92.

Pass-A: load register pool + cert-only suppliers in-memory.
Pass-B: for each cert-only supplier, find best register candidate using two
        rapidfuzz scorers; classify as auto_merge / queue / skip.
Pass-C: in --live mode, perform each merge in its own savepoint:
        - reassign cert supplier's source_records & certifications rows to
          the target register supplier (unique-violation rows are dropped);
        - union source_tags;
        - refresh completeness on the target;
        - delete the now-empty cert-only supplier row.
        For queue rows, insert one verification_queue row (queue_type
        'fuzzy_match_review') and leave the supplier untouched.

Run:
    python -m ops.spec08_retro_merge                # dry-run (default)
    python -m ops.spec08_retro_merge --live         # apply
    python -m ops.spec08_retro_merge --live --limit 50
"""
from __future__ import annotations

import argparse
import json
import sys
from typing import Any

from rapidfuzz import fuzz, process

from etl.core.db import db

REGISTER_SOURCES = ["BGMEA", "BKMEA", "RSC", "EPB", "BTMA", "BGAPMEA"]

AUTO_MERGE_THRESHOLD = 92         # require BOTH scorers >= this
QUEUE_LOW = 85                    # best of either scorer in [85, 92) -> queue
SIG_TOKEN_MIN_LEN = 4
SIG_TOKEN_MIN_COUNT = 2           # require >=2 shared significant tokens


# -----------------------------------------------------------------------------
def _sig_tokens(norm: str) -> set[str]:
    return {t for t in norm.split() if len(t) >= SIG_TOKEN_MIN_LEN}


def fetch_pool() -> tuple[dict[str, str], dict[str, str], dict[str, set[str]]]:
    with db.conn() as c, c.cursor() as cur:
        cur.execute(
            """select s.id::text as id, s.company_name, s.company_name_norm
                  from public.suppliers s
                 where s.source_tags && %s::text[]""",
            (REGISTER_SOURCES,),
        )
        rows = cur.fetchall()
    norms = {r["id"]: (r["company_name_norm"] or "") for r in rows}
    names = {r["id"]: r["company_name"] for r in rows}
    sigs = {sid: _sig_tokens(n) for sid, n in norms.items()}
    return norms, names, sigs


def fetch_cert_only() -> list[dict[str, Any]]:
    with db.conn() as c, c.cursor() as cur:
        cur.execute(
            """select s.id::text as id, s.slug, s.company_name,
                      s.company_name_norm, s.source_tags
                 from public.suppliers s
                where s.source_tags && ARRAY['WRAP','OEKO_TEX']::text[]
                  and not (s.source_tags && %s::text[])""",
            (REGISTER_SOURCES,),
        )
        return cur.fetchall()


# -----------------------------------------------------------------------------
def classify(
    cert: dict[str, Any],
    pool_norms: dict[str, str],
    pool_names: dict[str, str],
    pool_sigs: dict[str, set[str]],
) -> dict[str, Any]:
    """Return decision dict: {action, target_id, target_name, sort, set, ...}."""
    norm = cert["company_name_norm"] or ""
    if not norm:
        return {"action": "skip", "reason": "empty_norm"}

    cert_sigs = _sig_tokens(norm)
    if len(cert_sigs) < SIG_TOKEN_MIN_COUNT:
        return {"action": "skip", "reason": "too_few_significant_tokens"}

    # Top-5 by token_sort to bound the rescore work
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

    if best["sort"] >= AUTO_MERGE_THRESHOLD and best["set"] >= AUTO_MERGE_THRESHOLD:
        best["action"] = "auto_merge"
        return best
    if best["sort"] >= QUEUE_LOW or best["set"] >= QUEUE_LOW:
        best["action"] = "queue"
        return best
    best["action"] = "skip"
    best["reason"] = "below_queue_threshold"
    return best


# -----------------------------------------------------------------------------
def apply_merge(cur, cert: dict[str, Any], dec: dict[str, Any]) -> str:
    """Move cert supplier's source_records + certifications onto target,
    union source_tags, refresh completeness, delete cert supplier.
    Returns 'merged' on success, 'conflict_dropped' if any rows were dropped
    due to unique-key collision with target, 'failed' if savepoint rolled back.
    """
    src_id = cert["id"]
    tgt_id = dec["target_id"]
    status = "merged"

    cur.execute("savepoint sp_merge")
    try:
        # Reassign source_records one row at a time so a unique violation only
        # drops that row, not the whole merge.
        cur.execute(
            "select id from public.source_records where supplier_id = %s",
            (src_id,),
        )
        sr_ids = [r["id"] for r in cur.fetchall()]
        for sr_pk in sr_ids:
            cur.execute("savepoint sp_sr")
            try:
                cur.execute(
                    "update public.source_records set supplier_id = %s where id = %s",
                    (tgt_id, sr_pk),
                )
                cur.execute("release savepoint sp_sr")
            except Exception:  # noqa: BLE001
                cur.execute("rollback to savepoint sp_sr")
                cur.execute("delete from public.source_records where id = %s", (sr_pk,))
                cur.execute("release savepoint sp_sr")
                status = "conflict_dropped"

        # Same per-row strategy for certifications.
        cur.execute(
            "select id from public.certifications where supplier_id = %s",
            (src_id,),
        )
        cert_ids = [r["id"] for r in cur.fetchall()]
        for cert_pk in cert_ids:
            cur.execute("savepoint sp_c")
            try:
                cur.execute(
                    "update public.certifications set supplier_id = %s where id = %s",
                    (tgt_id, cert_pk),
                )
                cur.execute("release savepoint sp_c")
            except Exception:  # noqa: BLE001
                cur.execute("rollback to savepoint sp_c")
                cur.execute("delete from public.certifications where id = %s", (cert_pk,))
                cur.execute("release savepoint sp_c")
                status = "conflict_dropped"

        # Union source_tags from cert supplier onto target.
        cur.execute(
            """update public.suppliers tgt set
                 source_tags = (
                   select array(select distinct unnest(
                     coalesce(tgt.source_tags, '{}'::text[]) ||
                     coalesce((select s.source_tags from public.suppliers s where s.id = %s), '{}'::text[])
                   ))
                 )
               where tgt.id = %s""",
            (src_id, tgt_id),
        )

        # Refresh completeness on the target.
        cur.execute(
            "update public.suppliers set completeness_pct = public.compute_completeness(%s) where id = %s",
            (tgt_id, tgt_id),
        )

        # Delete the now-empty cert supplier (FKs cascade).
        cur.execute("delete from public.suppliers where id = %s", (src_id,))

        cur.execute("release savepoint sp_merge")
        return status
    except Exception as exc:  # noqa: BLE001
        cur.execute("rollback to savepoint sp_merge")
        print(f"   ! merge failed for {src_id} -> {tgt_id}: {exc}", file=sys.stderr)
        return "failed"


def enqueue(cur, cert: dict[str, Any], dec: dict[str, Any]) -> None:
    cur.execute(
        """insert into public.verification_queue
             (queue_type, supplier_a_id, supplier_b_name, confidence, source_data)
           values ('fuzzy_match_review', %s, %s, %s, %s::jsonb)""",
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
                "rule": f"spec08_retro_merge: sort>={QUEUE_LOW} or set>={QUEUE_LOW}, "
                        f"below auto_merge {AUTO_MERGE_THRESHOLD}/{AUTO_MERGE_THRESHOLD}",
            }),
        ),
    )


# -----------------------------------------------------------------------------
def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--live", action="store_true", help="apply changes (default: dry-run)")
    ap.add_argument("--limit", type=int, default=0, help="stop after N decisions (0 = all)")
    args = ap.parse_args()

    print("Loading register pool ...")
    pool_norms, pool_names, pool_sigs = fetch_pool()
    print(f"  register pool size: {len(pool_norms)}")

    print("Loading cert-only suppliers ...")
    cert_rows = fetch_cert_only()
    print(f"  cert-only suppliers: {len(cert_rows)}")

    n_auto = n_queue = n_skip = 0
    n_merged = n_conflict = n_failed = n_enqueued = 0
    auto_examples: list[str] = []
    queue_examples: list[str] = []

    if args.live:
        ctx = db.conn()
        c = ctx.__enter__()
        cur = c.cursor()
    else:
        ctx = c = cur = None  # type: ignore[assignment]

    try:
        for i, cert in enumerate(cert_rows, 1):
            if args.limit and (n_auto + n_queue) >= args.limit:
                break
            dec = classify(cert, pool_norms, pool_names, pool_sigs)
            action = dec["action"]
            # Dual-scorer >=92 produced too many false positives on short-prefix
            # BD garments names sharing 3-4 generic industry tokens. Drop the
            # auto-merge band; everything that would have auto-merged is sent
            # to the verification queue for admin review.
            if action == "auto_merge":
                action = "queue"
                dec["action"] = "queue"
            if action == "queue":
                n_queue += 1
                if len(queue_examples) < 15:
                    queue_examples.append(
                        f"  {cert['company_name']!r:55} ~ {dec['target_name']!r:55} "
                        f"sort={dec['sort']:.1f} set={dec['set']:.1f}"
                    )
                if args.live:
                    enqueue(cur, cert, dec)
                    n_enqueued += 1
                    c.commit()
            else:
                n_skip += 1

            if i % 500 == 0:
                print(f"  progress {i}/{len(cert_rows)}: auto={n_auto} queue={n_queue} skip={n_skip}")
    finally:
        if args.live and ctx is not None:
            ctx.__exit__(None, None, None)

    print("\n=== Decision summary ===")
    print(f"  auto_merge candidates: {n_auto}")
    print(f"  queue candidates     : {n_queue}")
    print(f"  skipped              : {n_skip}")
    if args.live:
        print(f"  merged applied       : {n_merged} (conflict_dropped subset: {n_conflict})")
        print(f"  merge failures       : {n_failed}")
        print(f"  enqueued to verification_queue: {n_enqueued}")

    if auto_examples:
        print("\n=== Sample auto_merge actions ===")
        for line in auto_examples:
            print(line)
    if queue_examples:
        print("\n=== Sample queue actions ===")
        for line in queue_examples:
            print(line)

    if not args.live:
        print("\n[dry-run] no changes were made. re-run with --live to apply.")


if __name__ == "__main__":
    main()
