"""Read-only supplier search quality smoke checks.

Usage:
  python ops/discover_search_audit.py --limit 10

Requires SUPABASE_DB_URL. The script calls public.discover_suppliers and
public.buyer_smart_match, then compares counts for buyer-style queries that
exercise synonyms, misspellings, compound product intent, and city filters.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from collections.abc import Iterable
from dataclasses import dataclass

import psycopg
from psycopg.rows import dict_row


@dataclass(frozen=True)
class SearchCase:
    label: str
    q: str
    city: str | None = None


CASES = [
    SearchCase("pant canonical", "pant"),
    SearchCase("pants synonym", "pants"),
    SearchCase("pant with Gazipur city filter", "pant", "Gazipur"),
    SearchCase("children canonical", "children"),
    SearchCase("children typo", "childrean"),
    SearchCase("kids synonym", "kids"),
    SearchCase("kids compound garment", "kids shirt"),
    SearchCase("children compound garment", "children shirt"),
    SearchCase("ladies synonym", "ladies"),
    SearchCase("women canonical", "women"),
]


DISCOVER_RPC_SQL = """
select *
  from public.discover_suppliers(
    %(q)s,
    null::text[],
    null::int,
    null::text[],
    null::int,
    %(city)s,
    null::text,
    null::text,
    'default',
    %(limit)s,
    0,
    null::text[],
    null::text[],
    null::text[],
    null::int,
    null::int
  )
"""

MATCH_RPC_SQL = "select public.buyer_smart_match(%(payload)s::jsonb) as result"


def compact(values: Iterable[str] | None) -> str:
    if not values:
        return "-"
    return ", ".join(str(v) for v in list(values)[:4] if v) or "-"


@dataclass(frozen=True)
class CaseResult:
    total: int
    ids: set[str]


def supabase_headers() -> dict[str, str] | None:
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get(
        "SUPABASE_ANON_KEY"
    )
    if not key:
        return None
    return {
        "apikey": key,
        "authorization": f"Bearer {key}",
        "content-type": "application/json",
    }


def post_rpc(function_name: str, payload: dict[str, object]) -> object:
    base_url = os.environ.get("SUPABASE_URL") or os.environ.get(
        "NEXT_PUBLIC_SUPABASE_URL"
    )
    headers = supabase_headers()
    if not base_url or not headers:
        raise RuntimeError("SUPABASE_URL and SUPABASE_*_KEY are required for REST fallback")

    url = f"{base_url.rstrip('/')}/rest/v1/rpc/{function_name}"
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers=headers,
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=45) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"{function_name} failed over REST: {exc.code} {detail}") from exc


def run_discover_case(conn: psycopg.Connection, case: SearchCase, limit: int) -> CaseResult:
    with conn.cursor() as cur:
        cur.execute("set local statement_timeout = '30s'")
        cur.execute(DISCOVER_RPC_SQL, {"q": case.q, "city": case.city, "limit": limit})
        rows = cur.fetchall()

    total = rows[0]["total_count"] if rows else 0
    ids = {str(row["id"]) for row in rows}
    suffix = f" city={case.city!r}" if case.city else ""
    print(f"\n== {case.label}: {case.q!r}{suffix}")
    print(f"discover total={total} shown={len(rows)}")
    for idx, row in enumerate(rows[:limit], start=1):
        location = ", ".join(x for x in [row["city"], row["district"]] if x) or "-"
        print(
            f"  D{idx:02d}. {row['company_name']} | {location} | "
            f"products: {compact(row['principal_products'])}"
        )
    return CaseResult(total=total, ids=ids)


def run_match_case(conn: psycopg.Connection, case: SearchCase, limit: int) -> CaseResult:
    payload = {"product": case.q, "limit": limit, "offset": 0}
    if case.city:
        payload["city"] = case.city

    with conn.cursor() as cur:
        cur.execute("set local statement_timeout = '30s'")
        cur.execute(MATCH_RPC_SQL, {"payload": json.dumps(payload)})
        row = cur.fetchone()

    result = row["result"] if row else {}
    rows = result.get("results", [])
    total = int(result.get("total", 0))
    ids = {str(item["id"]) for item in rows}
    print(f"match    total={total} shown={len(rows)}")
    for idx, item in enumerate(rows[:limit], start=1):
        location = ", ".join(x for x in [item.get("city"), item.get("district")] if x) or "-"
        print(
            f"  M{idx:02d}. {item['company_name']} | {location} | "
            f"products: {compact(item.get('principal_products'))}"
        )
    return CaseResult(total=total, ids=ids)


def run_discover_case_rest(case: SearchCase, limit: int) -> CaseResult:
    rows = post_rpc(
        "discover_suppliers",
        {
            "p_q": case.q,
            "p_entity_types": None,
            "p_min_sources": None,
            "p_cert_kinds": None,
            "p_rsc_min": None,
            "p_city": case.city,
            "p_district": None,
            "p_category": None,
            "p_sort": "default",
            "p_limit": limit,
            "p_offset": 0,
            "p_registries": None,
            "p_factory_types": None,
            "p_brand_codes": None,
            "p_completeness_min": None,
            "p_workers_min": None,
        },
    )
    if not isinstance(rows, list):
        raise RuntimeError("discover_suppliers REST response was not a list")

    total = rows[0].get("total_count", 0) if rows else 0
    ids = {str(row["id"]) for row in rows}
    suffix = f" city={case.city!r}" if case.city else ""
    print(f"\n== {case.label}: {case.q!r}{suffix}")
    print(f"discover total={total} shown={len(rows)}")
    for idx, row in enumerate(rows[:limit], start=1):
        location = ", ".join(x for x in [row.get("city"), row.get("district")] if x) or "-"
        print(
            f"  D{idx:02d}. {row['company_name']} | {location} | "
            f"products: {compact(row.get('principal_products'))}"
        )
    return CaseResult(total=int(total), ids=ids)


def run_match_case_rest(case: SearchCase, limit: int) -> CaseResult:
    payload: dict[str, object] = {"product": case.q, "limit": limit, "offset": 0}
    if case.city:
        payload["city"] = case.city

    result = post_rpc("buyer_smart_match", {"p_input": payload})
    if not isinstance(result, dict):
        raise RuntimeError("buyer_smart_match REST response was not an object")

    rows = result.get("results", [])
    if not isinstance(rows, list):
        rows = []
    total = int(result.get("total", 0))
    ids = {str(item["id"]) for item in rows}
    print(f"match    total={total} shown={len(rows)}")
    for idx, item in enumerate(rows[:limit], start=1):
        location = ", ".join(x for x in [item.get("city"), item.get("district")] if x) or "-"
        print(
            f"  M{idx:02d}. {item['company_name']} | {location} | "
            f"products: {compact(item.get('principal_products'))}"
        )
    return CaseResult(total=total, ids=ids)


def run_cases_rest(limit: int) -> dict[str, tuple[CaseResult, CaseResult]]:
    print("Using Supabase REST RPC fallback.")
    results: dict[str, tuple[CaseResult, CaseResult]] = {}
    for case in CASES:
        discover = run_discover_case_rest(case, limit)
        match = run_match_case_rest(case, limit)
        results[case.label] = (discover, match)
    return results


def check_invariants(results: dict[str, tuple[CaseResult, CaseResult]], limit: int) -> int:
    failures: list[str] = []

    for label, (discover, match) in results.items():
        if discover.total != match.total:
            failures.append(
                f"{label}: Discover total {discover.total} != Find Matches total {match.total}"
            )

    def total(label: str) -> int:
        return results[label][0].total

    synonym_pairs = [
        ("pant canonical", "pants synonym"),
        ("children canonical", "kids synonym"),
        ("children canonical", "children typo"),
        ("ladies synonym", "women canonical"),
    ]
    for left, right in synonym_pairs:
        if total(left) != total(right):
            failures.append(f"{left} total {total(left)} != {right} total {total(right)}")

    if total("kids compound garment") > total("kids synonym"):
        failures.append("kids shirt should be narrower than kids")
    if total("children compound garment") > total("children canonical"):
        failures.append("children shirt should be narrower than children")

    kids_ids = results["kids synonym"][0].ids
    children_ids = results["children canonical"][0].ids
    if kids_ids and children_ids:
        print(f"\nchildren/kids overlap in top {limit}: {len(kids_ids & children_ids)}")

    if failures:
        print("\nFAILURES", file=sys.stderr)
        for failure in failures:
            print(f"- {failure}", file=sys.stderr)
        return 1
    print("\nAll search smoke invariants passed.")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--limit", type=int, default=10, help="Rows to show per query")
    args = parser.parse_args()

    limit = max(1, min(args.limit, 50))

    dsn = os.environ.get("SUPABASE_DB_URL")
    results: dict[str, tuple[CaseResult, CaseResult]]
    if dsn:
        try:
            with psycopg.connect(
                dsn,
                connect_timeout=10,
                prepare_threshold=None,
                row_factory=dict_row,
            ) as conn:
                results = {}
                for case in CASES:
                    discover = run_discover_case(conn, case, limit)
                    match = run_match_case(conn, case, limit)
                    results[case.label] = (discover, match)
        except psycopg.OperationalError as exc:
            print(f"Postgres connection failed, falling back to REST RPC: {exc}", file=sys.stderr)
            results = run_cases_rest(limit)
    else:
        results = run_cases_rest(limit)

    return check_invariants(results, limit)


if __name__ == "__main__":
    raise SystemExit(main())
