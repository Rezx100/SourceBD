"""Seed resolution_edges from known founder rulings (REZ-65 / REZ-57 A5).

WHY
---
Human identity decisions (sarada-knitwear = sarda-knitwear; sarada-knitwear ≠
sarada-fashions; corny-fashion ≠ crony-fashion) lived only in run logs. A4
made `resolution_edges` load-bearing; this script writes the rulings we
already made so a future matcher change cannot silently undo them.

THE TRAP
--------
`sarda-knitwear` was merged into `sarada-knitwear` and tombstoned. The FK
rejects an edge to a deleted row — correctly. That ruling is already
structurally satisfied by the completed merge; do not insert it, do not
resurrect the loser.

USAGE
-----
    python ops/seed_resolution_edges.py            # dry run (default)
    python ops/seed_resolution_edges.py --apply    # write (founder approves)

Transport: Supabase REST + service-role key (pooler ports are unreachable
from the dev machine — do not use psycopg). Dry run is the default;
`--apply` is required to write. Do not run `--apply` against production
without founder approval.
"""

from __future__ import annotations

import argparse
import os
import sys
from dataclasses import dataclass
from typing import Protocol

import httpx


@dataclass(frozen=True)
class FounderRuling:
    slug_a: str
    slug_b: str
    verdict: str
    rationale: str


# Encode exactly these and nothing else. Do not infer additional rulings.
FOUNDER_RULINGS: tuple[FounderRuling, ...] = (
    FounderRuling(
        slug_a="sarada-knitwear",
        slug_b="sarda-knitwear",
        verdict="same",
        rationale=(
            "Founder-verified 3 Aug 2026: same premises, same owner. "
            "Merged via seeded `--pair sarada-knitwear,sarda-knitwear`."
        ),
    ),
    FounderRuling(
        slug_a="sarada-knitwear",
        slug_b="sarada-fashions",
        verdict="different",
        rationale=(
            "Founder ruling 4 Aug 2026: sister company, different premises. "
            "Deliberately left separate."
        ),
    ),
    FounderRuling(
        slug_a="corny-fashion",
        slug_b="crony-fashion",
        verdict="different",
        rationale=(
            "Open ownership question, 2 Aug 2026. Two substantive suppliers "
            "each holding BKMEA memberships. Never auto-merge; requires "
            "human decision. Encoded as different so future runs cannot "
            "silently merge them."
        ),
    ),
)


def sorted_pair_ids(id_a: str, id_b: str) -> tuple[str, str]:
    """Canonical order for chk_resolution_edges_canonical_order (a < b)."""
    if id_a == id_b:
        raise ValueError("supplier_a and supplier_b must differ")
    return (id_a, id_b) if id_a < id_b else (id_b, id_a)


class RestClient(Protocol):
    def one(self, path: str, params: dict[str, str]) -> dict | None: ...

    def insert(self, path: str, body: dict) -> dict: ...


class Rest:
    """Supabase REST + service-role key (same pattern as repair_bgmea_conflations)."""

    def __init__(self) -> None:
        base = os.environ.get("SUPABASE_URL", "").rstrip("/")
        key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
        if not base or not key:
            print("ERROR: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set", file=sys.stderr)
            raise SystemExit(1)
        self.base = base + "/rest/v1"
        self.client = httpx.Client(
            headers={"apikey": key, "Authorization": f"Bearer {key}"}, timeout=60
        )

    def all_rows(self, path: str, params: dict[str, str]) -> list[dict]:
        out: list[dict] = []
        offset = 0
        while True:
            r = self.client.get(
                f"{self.base}/{path}",
                params=params,
                headers={"Range": f"{offset}-{offset + 999}"},
            )
            r.raise_for_status()
            rows = r.json()
            out.extend(rows)
            if len(rows) < 1000:
                return out
            offset += 1000

    def one(self, path: str, params: dict[str, str]) -> dict | None:
        rows = self.all_rows(path, params)
        return rows[0] if rows else None

    def insert(self, path: str, body: dict) -> dict:
        r = self.client.post(
            f"{self.base}/{path}",
            json=body,
            headers={"Prefer": "return=representation"},
        )
        r.raise_for_status()
        return r.json()[0]


def resolve_slug(rest: RestClient, slug: str) -> dict | None:
    return rest.one(
        "suppliers",
        {"select": "id,slug,company_name,is_published", "slug": f"eq.{slug}"},
    )


def seed_one(
    rest: RestClient,
    ruling: FounderRuling,
    *,
    apply: bool,
) -> str:
    """Process one founder ruling. Returns a status token for the summary.

    Statuses: would-insert | inserted | already-present | structurally-satisfied
    | missing-side
    """
    left = resolve_slug(rest, ruling.slug_a)
    right = resolve_slug(rest, ruling.slug_b)
    missing = [
        s
        for s, row in ((ruling.slug_a, left), (ruling.slug_b, right))
        if row is None
    ]
    if missing:
        # Same-verdict + missing loser = completed merge tombstone. Do not
        # insert (FK forbids it and that is correct).
        if ruling.verdict == "same" and len(missing) == 1:
            survivor = ruling.slug_a if ruling.slug_b in missing else ruling.slug_b
            print(
                f"STRUCTURALLY SATISFIED  {ruling.slug_a} / {ruling.slug_b}  "
                f"verdict={ruling.verdict}"
            )
            print(
                f"  missing slug(s): {missing} - ruling already applied by a "
                f"completed merge; survivor={survivor!r}. No edge inserted "
                f"(FK to a deleted row is meaningless)."
            )
            return "structurally-satisfied"
        print(
            f"MISSING  {ruling.slug_a} / {ruling.slug_b}  verdict={ruling.verdict}"
        )
        print(f"  slug(s) not found among suppliers: {missing} - skipped, no crash")
        return "missing-side"

    assert left is not None and right is not None
    supplier_a, supplier_b = sorted_pair_ids(left["id"], right["id"])
    body = {
        "supplier_a": supplier_a,
        "supplier_b": supplier_b,
        "verdict": ruling.verdict,
        "decided_by": "founder",
        "rationale": ruling.rationale,
    }
    label = (
        f"{ruling.slug_a}[{left['id'][:8]}] / {ruling.slug_b}[{right['id'][:8]}]  "
        f"verdict={ruling.verdict}  ordered=({supplier_a[:8]}.. < {supplier_b[:8]}..)"
    )
    if not apply:
        print(f"WOULD INSERT  {label}")
        print(f"  rationale: {ruling.rationale}")
        return "would-insert"

    try:
        rest.insert("resolution_edges", body)
    except httpx.HTTPStatusError as exc:
        # idx_resolution_edges_pair_active rejects a duplicate live pair.
        if exc.response.status_code == 409:
            print(f"ALREADY PRESENT  {label}")
            return "already-present"
        raise
    print(f"INSERTED  {label}")
    return "inserted"


def seed_all(rest: RestClient, rulings: tuple[FounderRuling, ...] = FOUNDER_RULINGS, *, apply: bool) -> int:
    counts: dict[str, int] = {
        "would-insert": 0,
        "inserted": 0,
        "already-present": 0,
        "structurally-satisfied": 0,
        "missing-side": 0,
    }
    for ruling in rulings:
        status = seed_one(rest, ruling, apply=apply)
        counts[status] = counts.get(status, 0) + 1

    print()
    if apply:
        print(
            f"Done: {counts['inserted']} inserted, "
            f"{counts['already-present']} already present, "
            f"{counts['structurally-satisfied']} structurally satisfied, "
            f"{counts['missing-side']} missing-side skipped."
        )
    else:
        print(
            f"Dry run - nothing written. "
            f"{counts['would-insert']} would insert, "
            f"{counts['structurally-satisfied']} structurally satisfied, "
            f"{counts['missing-side']} missing-side skipped. "
            f"Re-run with --apply to write."
        )
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="execute (default: dry run)")
    args = parser.parse_args()
    return seed_all(Rest(), apply=args.apply)


if __name__ == "__main__":
    sys.exit(main())
