"""Report per-number provenance for `suppliers.bgmea_reg_numbers` (REZ-98).

WHY THIS EXISTS
---------------
`v_supplier_registry_ids_direct` publishes BGMEA registration numbers by
unnesting the denormalised `suppliers.bgmea_reg_numbers` array, not by reading
`source_records`. Every other register in that view (EPB, BGAPMEA, BTMA) is
derived from a live source record, and RSC from its sidecar table. BGMEA is the
only pill row whose value can outlive the record that put it there.

It outlives it because nothing ever removes an array element. All four writers
union:

  * `etl/core/upsert.py::_apply_source_specific` — appends the scraped
    `bgmea_reg_number` with `distinct unnest(existing || ARRAY[reg])`.
  * `ops/merge_duplicate_suppliers.py` — `ARRAY_COLUMNS` union on merge.
  * `ops/fix_quality.py` — union when a duplicate is absorbed.
  * `ops/repair_bgmea_conflations.py::_merge_into_profile` — union onto the
    destination profile.

So an entry arrives in two steps. First `_find_existing` attaches another
company's BGMEA record to the host (the pre-31-Jul contact-overlap class:
Avant Garments and Arbella Fashion share `arif@arbellafashion.com` and one
Gulshan mailing address), and the append writes its number onto the host.
Later `ops/repair_bgmea_conflations.py` moves the record to the right
supplier — but its `_recompute_parent` rebuilds only the numeric
`DERIVED_COLUMNS` from the host's remaining records, never the array. The
record leaves; the number stays.

`bgmea_verified` is a single supplier-level boolean applied to every element,
so each of those residues renders as "verified" with nothing having verified
that specific number.

This script measures that. It is READ-ONLY: there is no `--apply`, and it
issues no UPDATE, INSERT or DELETE on any path.

The founder chose option (a), backed-only display, shipped as
`supabase/migrations/20260805_rez98_registry_ids_bgmea_backed_only.sql`. That
stops the false claim on the profile but does NOT clean the array, which still
feeds SBI Pillar 1. This report therefore stays live as the sizing tool for the
array repair, and its option counts stay in so the two rules can be compared
again after any change.

WHAT COUNTS AS BACKED
---------------------
A number is backed when the SAME supplier holds an ACTIVE BGMEA source record
for it. `bgmea_web` keys general members as `general:{reg}` (see
`etl/scrapers/bgmea_web.py`), so the ref is the primary test, with the stored
`fields->>'bgmea_reg_number'` as the fallback for rows keyed `member:{id}`
because the register published no number.

Unbacked numbers are classified further by where the live record actually
sits, which is what distinguishes a stale residue from a phantom:

  * `moved`  — an active BGMEA record for that number exists on a DIFFERENT
    supplier. The number is a residue of a record that has since been moved.
  * `phantom` — no active BGMEA record for that number exists anywhere.

USAGE
-----
    python ops/report_bgmea_array_provenance.py           # human-readable
    python ops/report_bgmea_array_provenance.py --rest    # Supabase REST
    python ops/report_bgmea_array_provenance.py --json out.json

Exit codes: 0 report produced, 2 could not run.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from collections import defaultdict
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import psycopg
from dotenv import load_dotenv
from psycopg.rows import dict_row

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

from ops.repair_bgmea_conflations import Rest  # noqa: E402

# Published suppliers carrying at least one BGMEA number, exactly the rows the
# view unnests.
SUPPLIERS_SQL = """
select s.id::text as id,
       s.slug,
       s.company_name,
       s.bgmea_reg_numbers,
       s.bgmea_verified
  from public.suppliers s
 where s.is_published = true
   and array_length(s.bgmea_reg_numbers, 1) > 0
 order by s.slug
"""

# Every BGMEA source record, whatever supplier it currently sits on: the
# "moved vs phantom" split needs the whole population, not just the hosts'.
RECORDS_SQL = """
select sr.supplier_id::text as supplier_id,
       sr.source_ref,
       sr.status::text as status,
       sr.fields->>'bgmea_reg_number' as reg_number
  from public.source_records sr
  join public.sources s on s.id = sr.source_id and s.code = 'BGMEA'
"""

MOVED = "moved"
PHANTOM = "phantom"


def record_numbers(record: dict[str, Any]) -> set[str]:
    """Registration numbers an ACTIVE BGMEA record vouches for.

    `general:{reg}` is `bgmea_web`'s member key, so the ref alone is proof.
    The stored payload field covers rows keyed `member:{id}` — the register
    published no number for them, so the ref carries none.
    """
    if (record.get("status") or "") != "active":
        return set()
    out: set[str] = set()
    ref = (record.get("source_ref") or "").strip()
    if ref.startswith("general:"):
        value = ref.split(":", 1)[1].strip()
        if value:
            out.add(value)
    reg = (record.get("reg_number") or "").strip()
    if reg:
        out.add(reg)
    return out


@dataclass(frozen=True)
class SupplierProvenance:
    """One published supplier's BGMEA numbers, split by whether it holds the record."""

    supplier_id: str
    slug: str
    company_name: str
    numbers: tuple[str, ...]
    backed: tuple[str, ...]
    unbacked: tuple[str, ...]
    # value -> supplier_id of whoever currently holds the live record
    unbacked_holders: dict[str, str] = field(default_factory=dict)

    @property
    def is_multi(self) -> bool:
        return len(self.numbers) > 1

    @property
    def fully_backed(self) -> bool:
        return not self.unbacked

    @property
    def entirely_unbacked(self) -> bool:
        return bool(self.numbers) and not self.backed

    def unbacked_kind(self, value: str) -> str:
        return MOVED if value in self.unbacked_holders else PHANTOM


def classify(
    suppliers: list[dict[str, Any]], records: list[dict[str, Any]]
) -> list[SupplierProvenance]:
    """Per-number backing for every published supplier. Pure — no I/O.

    Order of `numbers` is the array's own order, which is the order the view
    unnests and the profile renders.
    """
    own: dict[str, set[str]] = defaultdict(set)
    holders: dict[str, str] = {}
    for rec in records:
        sid = str(rec.get("supplier_id") or "")
        for value in record_numbers(rec):
            if sid:
                own[sid].add(value)
                holders.setdefault(value, sid)

    out: list[SupplierProvenance] = []
    for sup in suppliers:
        sid = str(sup["id"])
        numbers = tuple(str(n).strip() for n in (sup.get("bgmea_reg_numbers") or []) if str(n).strip())
        mine = own.get(sid, set())
        backed = tuple(n for n in numbers if n in mine)
        unbacked = tuple(n for n in numbers if n not in mine)
        out.append(
            SupplierProvenance(
                supplier_id=sid,
                slug=sup.get("slug") or "",
                company_name=sup.get("company_name") or "",
                numbers=numbers,
                backed=backed,
                unbacked=unbacked,
                unbacked_holders={
                    n: holders[n] for n in unbacked if n in holders and holders[n] != sid
                },
            )
        )
    return out


def summarise(rows: list[SupplierProvenance]) -> dict[str, int]:
    """Counts for REZ-98 steps 2 and 4. Pure."""
    multi = [r for r in rows if r.is_multi]
    unbacked_values = [(r, v) for r in rows for v in r.unbacked]
    return {
        # --- what is published today ---
        "suppliers_showing_bgmea": len(rows),
        "numbers_shown": sum(len(r.numbers) for r in rows),
        # --- step 2: the multi-number class ---
        "multi_number_suppliers": len(multi),
        "multi_all_backed": sum(1 for r in multi if r.fully_backed),
        "multi_some_unbacked": sum(
            1 for r in multi if r.unbacked and r.backed
        ),
        "multi_entirely_unbacked": sum(1 for r in multi if r.entirely_unbacked),
        "single_number_unbacked": sum(
            1 for r in rows if not r.is_multi and r.entirely_unbacked
        ),
        # --- where the unbacked numbers live ---
        "unbacked_numbers": len(unbacked_values),
        "unbacked_moved": sum(1 for r, v in unbacked_values if r.unbacked_kind(v) == MOVED),
        "unbacked_phantom": sum(1 for r, v in unbacked_values if r.unbacked_kind(v) == PHANTOM),
        # --- step 4 option (a): show only backed numbers ---
        "a_suppliers_losing_a_number": sum(1 for r in rows if r.unbacked),
        "a_numbers_removed": len(unbacked_values),
        "a_suppliers_losing_bgmea_entirely": sum(1 for r in rows if r.entirely_unbacked),
        "a_suppliers_multi_to_single": sum(1 for r in multi if len(r.backed) == 1),
        "a_suppliers_still_multi": sum(1 for r in multi if len(r.backed) > 1),
        # --- step 4 option (b): show all with per-number provenance ---
        "b_numbers_removed": 0,
        "b_suppliers_affected": 0,
        "b_numbers_relabelled": len(unbacked_values),
    }


def _load_via_psycopg(dsn: str) -> tuple[list[dict], list[dict]]:
    with psycopg.connect(dsn, prepare_threshold=None, row_factory=dict_row) as conn:
        with conn.cursor() as cur:
            cur.execute(SUPPLIERS_SQL)
            suppliers = cur.fetchall()
        with conn.cursor() as cur:
            cur.execute(RECORDS_SQL)
            records = cur.fetchall()
    return list(suppliers), list(records)


def _load_via_rest() -> tuple[list[dict], list[dict]]:
    """Production reads when the Postgres pooler is unreachable from this host."""
    rest = Rest()
    source = rest.one("sources", {"select": "id", "code": "eq.BGMEA"})
    if source is None:
        raise RuntimeError("no BGMEA row in public.sources")
    bgmea_id = source["id"]
    suppliers = [
        r
        for r in rest.all_rows(
            "suppliers",
            {
                "select": "id,slug,company_name,bgmea_reg_numbers,bgmea_verified",
                "is_published": "is.true",
            },
        )
        if r.get("bgmea_reg_numbers")
    ]
    records = [
        {
            "supplier_id": r["supplier_id"],
            "source_ref": r.get("source_ref"),
            "status": r.get("status"),
            "reg_number": (r.get("fields") or {}).get("bgmea_reg_number"),
        }
        for r in rest.all_rows(
            "source_records",
            {"select": "supplier_id,source_ref,status,fields", "source_id": f"eq.{bgmea_id}"},
        )
    ]
    return suppliers, records


def _print_report(rows: list[SupplierProvenance], counts: dict[str, int]) -> None:
    print("== suppliers.bgmea_reg_numbers — per-number provenance (REZ-98) ==\n")
    print(
        f"Published suppliers showing a BGMEA number: {counts['suppliers_showing_bgmea']}"
        f"  ({counts['numbers_shown']} numbers on display)\n"
    )

    print("-- Step 2: the multi-number class --")
    print(f"  suppliers with >1 number          {counts['multi_number_suppliers']}")
    print(f"    every number backed             {counts['multi_all_backed']}")
    print(f"    some numbers unbacked           {counts['multi_some_unbacked']}")
    print(f"    entirely unbacked               {counts['multi_entirely_unbacked']}")
    print(f"  single-number, that one unbacked  {counts['single_number_unbacked']}\n")

    print("-- Where the unbacked numbers live --")
    print(f"  unbacked numbers total            {counts['unbacked_numbers']}")
    print(f"    live record on another supplier {counts['unbacked_moved']}  ({MOVED})")
    print(f"    no active record anywhere       {counts['unbacked_phantom']}  ({PHANTOM})\n")

    print("-- Step 4: display-rule options (founder decision — not chosen here) --")
    print("  (a) show only numbers backed by a live source record")
    print(f"        numbers removed from display  {counts['a_numbers_removed']}")
    print(f"        suppliers losing >=1 number   {counts['a_suppliers_losing_a_number']}")
    print(f"        suppliers losing BGMEA pill   {counts['a_suppliers_losing_bgmea_entirely']}")
    print(f"        suppliers multi -> single     {counts['a_suppliers_multi_to_single']}")
    print(f"        suppliers still showing >1    {counts['a_suppliers_still_multi']}")
    print("  (b) show all numbers with honest per-number provenance")
    print(f"        numbers removed from display  {counts['b_numbers_removed']}")
    print(f"        suppliers losing a number     {counts['b_suppliers_affected']}")
    print(f"        numbers needing a new label   {counts['b_numbers_relabelled']}\n")

    worst = sorted(rows, key=lambda r: (-len(r.unbacked), r.slug))[:10]
    if worst and worst[0].unbacked:
        print("-- Widest gaps --")
        for r in worst:
            if not r.unbacked:
                break
            detail = ", ".join(f"{v} ({r.unbacked_kind(v)})" for v in r.unbacked)
            print(f"  {r.slug:<34} shows {list(r.numbers)}  unbacked: {detail}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--rest",
        action="store_true",
        help="read via Supabase REST (use when the Postgres pooler is unreachable)",
    )
    parser.add_argument("--json", type=Path, default=None, help="also write counts as JSON here")
    args = parser.parse_args()

    try:
        if args.rest:
            suppliers, records = _load_via_rest()
        else:
            dsn = os.environ.get("SUPABASE_DB_URL")
            if not dsn:
                print("ERROR: SUPABASE_DB_URL not set (or pass --rest)", file=sys.stderr)
                return 2
            suppliers, records = _load_via_psycopg(dsn)
    except Exception as exc:  # noqa: BLE001
        print(f"ERROR: could not read supplier registry state: {exc}", file=sys.stderr)
        return 2

    rows = classify(suppliers, records)
    counts = summarise(rows)
    _print_report(rows, counts)

    if args.json:
        args.json.write_text(json.dumps(counts, indent=2, sort_keys=True), encoding="utf-8")
        print(f"\nwrote {args.json}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
