"""Spec H8 — backup + restore drill verifier.

Pure Python. No new deps; uses `psycopg` (already in etl/ deps)
and the standard library only.

Two modes:

    python ops/backup_drill.py snapshot \\
        --url "$SUPABASE_DB_URL" \\
        --out ops/_h8_baseline.json

    python ops/backup_drill.py verify \\
        --baseline ops/_h8_baseline.json \\
        --url "$RESTORE_TARGET_DATABASE_URL"

See docs/runbooks/backup-restore.md for the full drill procedure.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import sys
from pathlib import Path
from typing import Any

import psycopg


# Per-table tolerance applied during `verify`. The PITR cutoff plus
# the pg_dump → pg_restore window admits a small number of in-flight
# inserts on append-only tables; 1.0 % is small enough that a real
# data-loss event trips the verifier.
TOLERANCE_PCT = 1.0

# Tables whose row counts are compared during `verify`. Drift to this
# list is a spec-bump signal: edit deliberately, then bump Spec H8.
# The string "sbi_scores" is a TABLE name — the value-leak rule
# (architecture.md invariants) forbids rendering the integer total
# in user surfaces, not naming the table in an ops harness.
CRITICAL_TABLES: list[str] = [
    "suppliers",
    "source_records",
    "certifications",
    "rsc_remediation",
    "sanctions_screening",
    "sbi_scores",
    "profiles",
    "rfqs",
    "rfq_quotes",
    "messages",
    "message_threads",
    "thread_participants",
    "claim_requests",
    "saved_suppliers",
    "compliance_documents",
    "rsc_industry_metrics",
    "stripe_webhook_events",
    "email_log",
    "rate_limit_buckets",
]


def _migration_head() -> str:
    """Return the highest-numbered file in supabase/migrations/."""
    repo = Path(__file__).resolve().parents[1]
    migrations = sorted((repo / "supabase" / "migrations").glob("*.sql"))
    if not migrations:
        raise RuntimeError("no migrations found on disk")
    return migrations[-1].name


def _table_row_counts(conn: psycopg.Connection) -> dict[str, int]:
    """Return row counts for the critical-table list. Missing tables
    surface as -1 so a missing table in the restore target is
    distinguishable from an empty one."""
    counts: dict[str, int] = {}
    with conn.cursor() as cur:
        for table in CRITICAL_TABLES:
            cur.execute(
                "select to_regclass(%s) is not null",
                (f"public.{table}",),
            )
            row = cur.fetchone()
            if not row or not row[0]:
                counts[table] = -1
                continue
            cur.execute(f'select count(*) from public."{table}"')
            row = cur.fetchone()
            counts[table] = int(row[0]) if row else 0
    return counts


def cmd_snapshot(args: argparse.Namespace) -> int:
    url = args.url or os.environ.get("SUPABASE_DB_URL")
    if not url:
        print("snapshot: --url or SUPABASE_DB_URL required", file=sys.stderr)
        return 2
    with psycopg.connect(url) as conn:
        manifest: dict[str, Any] = {
            "captured_at": dt.datetime.now(dt.timezone.utc).isoformat(),
            "migration_head": _migration_head(),
            "tolerance_pct": TOLERANCE_PCT,
            "row_counts": _table_row_counts(conn),
        }
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(manifest, indent=2, sort_keys=True), encoding="utf-8")
    total = sum(v for v in manifest["row_counts"].values() if v >= 0)
    print(
        f"H8 snapshot OK — head {manifest['migration_head']}, "
        f"{len(CRITICAL_TABLES)} tables, {total} total rows, written to {out}"
    )
    return 0


def cmd_verify(args: argparse.Namespace) -> int:
    url = args.url or os.environ.get("RESTORE_TARGET_DATABASE_URL")
    if not url:
        print(
            "verify: --url or RESTORE_TARGET_DATABASE_URL required",
            file=sys.stderr,
        )
        return 2
    prod = os.environ.get("SUPABASE_DB_URL")
    if prod and url == prod:
        print(
            "verify: refusing to run against production SUPABASE_DB_URL",
            file=sys.stderr,
        )
        return 2

    baseline_path = Path(args.baseline)
    if not baseline_path.exists():
        print(f"verify: baseline manifest not found at {baseline_path}", file=sys.stderr)
        return 2
    baseline = json.loads(baseline_path.read_text(encoding="utf-8"))

    with psycopg.connect(url) as conn:
        target_head = _migration_head()
        target_counts = _table_row_counts(conn)

    failures: list[str] = []
    if target_head != baseline["migration_head"]:
        failures.append(
            f"migration head mismatch: baseline={baseline['migration_head']} "
            f"target={target_head}"
        )

    tolerance = float(baseline.get("tolerance_pct", TOLERANCE_PCT))
    base_counts: dict[str, int] = baseline["row_counts"]
    for table in CRITICAL_TABLES:
        b = base_counts.get(table, -1)
        t = target_counts.get(table, -1)
        if b < 0:
            failures.append(f"{table}: missing in baseline")
            continue
        if t < 0:
            failures.append(f"{table}: missing in restore target")
            continue
        if b == 0:
            if t != 0:
                failures.append(f"{table}: baseline=0 target={t}")
            continue
        delta_pct = abs(t - b) / b * 100.0
        if delta_pct > tolerance:
            failures.append(
                f"{table}: baseline={b} target={t} delta={delta_pct:.2f}%"
            )

    if failures:
        print("H8 verify FAILED:")
        for f in failures:
            print(" ", f)
        return 1

    print(
        f"H8 verify PASSED — head {target_head}, "
        f"{len(CRITICAL_TABLES)} tables within {tolerance:.2f}% tolerance"
    )
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Spec H8 backup + restore drill.")
    sub = parser.add_subparsers(dest="cmd", required=True)

    s = sub.add_parser("snapshot", help="capture a baseline manifest")
    s.add_argument("--url", default=None, help="defaults to $SUPABASE_DB_URL")
    s.add_argument("--out", default="ops/_h8_baseline.json")
    s.set_defaults(func=cmd_snapshot)

    v = sub.add_parser("verify", help="verify restore target against baseline")
    v.add_argument(
        "--url",
        default=None,
        help="defaults to $RESTORE_TARGET_DATABASE_URL",
    )
    v.add_argument("--baseline", default="ops/_h8_baseline.json")
    v.set_defaults(func=cmd_verify)

    args = parser.parse_args(argv)
    return int(args.func(args))


if __name__ == "__main__":
    raise SystemExit(main())
