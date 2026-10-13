"""Suppliers shown as a buying house whose only BGMEA entry is a manufacturer's.

WHY THIS EXISTS
---------------
BGMEA keeps two registers. General members make garments (entry
``general:N``, ``bgmea_member_type = general_manufacturer``). Associate members
are buying houses (a bare number, ``associate_buying_house``). Until 13 Oct
2026 the loader gave every row BGMEA touched the type "buying house" when the
row had none (`etl/core/upsert.py`), whichever register the record came from.
Found by the duplicate audit (`ops/plans/duplicate-suppliers-audit.md`).

WHAT IT REPORTS
---------------
  fix    marked buying house, holds a live general entry, and nothing says
         buying house: no associate entry (live or retired), no associate
         number on the row, no person's lock on the type, not claimed.
  ask    the same, but a person locked the type or the company is claimed:
         a person said so, so a person decides.
  stays  marked buying house and holds an associate entry. Never touched.

The founder's rule, 13 Oct 2026: real buying houses must stay buying houses.

READ-ONLY. GET requests only; there is no `--apply`. `--sql` writes the
rehearsal block for the rows in `fix` (it ends in a raise, so it commits
nothing); the founder's go-ahead is needed to apply it (AGENTS rule 15).

USAGE
-----
    python ops/report_bgmea_entity_type.py
    python ops/report_bgmea_entity_type.py --cache DIR   # suppliers.json, records.json, locks.json

Exit codes: 0 report produced, 2 could not run.
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path
from typing import Any

from etl.core.bgmea_identity import ASSOCIATE_PREFIX, MEMBER_TYPE_ASSOCIATE, MEMBER_TYPE_GENERAL, is_legacy_bare

_SUPPLIER_COLUMNS = (
    "id,slug,company_name,entity_type,is_published,claimed_by,facility_of,bgmea_reg_numbers,"
    "employees_total,machines_sewing,district,created_at"
)
_RECORD_COLUMNS = "supplier_id,source_ref,status,member_type:fields->>bgmea_member_type"


def load(cache: Path | None) -> tuple[list[dict], list[dict], list[dict]]:
    if cache:
        return tuple(json.loads((cache / f"{n}.json").read_text(encoding="utf-8"))  # type: ignore[return-value]
                     for n in ("suppliers", "records", "locks"))
    from ops.repair_bgmea_conflations import Rest  # GET-only use: all_rows

    rest = Rest()
    bgmea = rest.one("sources", {"select": "id", "code": "eq.BGMEA"})
    if bgmea is None:
        raise RuntimeError("no BGMEA row in sources")
    return (
        rest.all_rows("suppliers", {"select": _SUPPLIER_COLUMNS, "order": "id"}),
        rest.all_rows("source_records", {"select": _RECORD_COLUMNS, "source_id": f"eq.{bgmea['id']}", "order": "id"}),
        rest.all_rows("supplier_field_locks",
                      {"select": "supplier_id", "column_name": "eq.entity_type", "released_at": "is.null"}),
    )


def bgmea_standing(records: list[dict], reg_numbers: list[str] | None) -> str:
    """Which BGMEA register a row stands on, from its entries and its own numbers.

    A retired associate entry, or an associate (or old bare) number left on
    the row, still counts as "associate": when in doubt the row is a buying
    house, because turning a real one into a factory is the costly mistake.
    """
    live = [r for r in records if r["status"] == "active"]
    general = any(r["member_type"] == MEMBER_TYPE_GENERAL for r in live)
    associate = any(r["member_type"] == MEMBER_TYPE_ASSOCIATE for r in records) or any(
        n.startswith(ASSOCIATE_PREFIX) or is_legacy_bare(n) for n in reg_numbers or ()
    )
    if general and associate:
        return "both"
    if associate:
        return "associate only"
    if general:
        return "general only"
    return "no register named" if live else "no BGMEA entry"


def build(suppliers: list[dict], records: list[dict], locks: list[dict]) -> dict[str, Any]:
    by_supplier: dict[str, list[dict]] = defaultdict(list)
    for r in records:
        by_supplier[r["supplier_id"]].append(r)
    locked = {row["supplier_id"] for row in locks}

    table: Counter[tuple[str, str]] = Counter()
    published: Counter[tuple[str, str]] = Counter()
    fix, ask, other = [], [], []
    for s in suppliers:
        standing = bgmea_standing(by_supplier[s["id"]], s.get("bgmea_reg_numbers"))
        cell = (s["entity_type"], standing)
        table[cell] += 1
        published[cell] += bool(s["is_published"])
        if s["entity_type"] != "buying_house" or standing in ("associate only", "both"):
            continue
        row = {
            "id": s["id"], "slug": s["slug"], "name": s["company_name"], "published": s["is_published"],
            "district": s.get("district"), "workers": s.get("employees_total"),
            "sewing_machines": s.get("machines_sewing"), "building_of_another": bool(s.get("facility_of")),
            "created": (s.get("created_at") or "")[:10],
            "entries": sorted(r["source_ref"] for r in by_supplier[s["id"]] if r["status"] == "active"),
        }
        if standing != "general only":
            other.append(dict(row, bgmea=standing))
        elif s["id"] in locked or s.get("claimed_by"):
            ask.append(dict(row, why="type locked by a person" if s["id"] in locked else "claimed by the company"))
        else:
            fix.append(row)

    for rows in (fix, ask, other):
        rows.sort(key=lambda r: (r["name"].lower(), r["id"]))
    return {
        "suppliers": len(suppliers),
        "published": sum(1 for s in suppliers if s["is_published"]),
        "table": [{"entity_type": e, "bgmea": b, "suppliers": n, "published": published[(e, b)]}
                  for (e, b), n in sorted(table.items())],
        "stays": table[("buying_house", "associate only")] + table[("buying_house", "both")],
        "fix": fix, "ask": ask, "buying_house_without_a_register": other,
    }


_SQL = """\
-- Rows shown as a buying house whose only BGMEA entry is a manufacturer's: set them to factory.
-- Written by ops/report_bgmea_entity_type.py on {today} from the {n} rows in
-- ops/plans/bgmea-entity-type.json ("fix"). Plan and evidence: ops/plans/bgmea-entity-type.md.
--
-- One transaction. It re-checks every row at run time and takes only those that still
-- qualify: still a buying house, a live general entry, no associate entry (live or
-- retired), no associate number on the row, no lock on the type, not claimed. The rows as
-- they were go to public._snapshot_entity_type_{stamp} first (RLS on, nothing granted).
-- It REFUSES (raises, nothing written) unless exactly {n} rows qualify, {n} are updated,
-- and the count of buying houses holding an associate entry is the same before and after.
--
-- AS WRITTEN THIS IS A REHEARSAL: the last statement raises, so nothing commits.
-- To apply (founder's go-ahead only), delete the line marked REHEARSAL.
--
-- Undo:  update public.suppliers s set entity_type = t.entity_type
--          from public._snapshot_entity_type_{stamp} t where t.id = s.id;

do $fix$
declare
  ids uuid[] := array[
{ids}
  ]::uuid[];
  n_snap int; n_upd int; real_before int; real_after int; bh_before int; bh_after int;
begin
  select count(*) filter (where s.entity_type = 'buying_house'),
         count(*) filter (where s.entity_type = 'buying_house' and exists (
           select 1 from public.source_records sr join public.sources so on so.id = sr.source_id
            where sr.supplier_id = s.id and so.code = 'BGMEA'
              and sr.fields->>'bgmea_member_type' = 'associate_buying_house'))
    into bh_before, real_before from public.suppliers s;

  create table public._snapshot_entity_type_{stamp} as
    select s.id, s.slug, s.company_name, s.entity_type, s.is_published, s.updated_at, now() as snapshot_at
      from public.suppliers s
     where s.id = any (ids)
       and s.entity_type = 'buying_house'
       and s.claimed_by is null
       and not exists (select 1 from unnest(s.bgmea_reg_numbers) x where x like 'associate:%' or x ~ '^[0-9]+$')
       and not exists (select 1 from public.supplier_field_locks l
                        where l.supplier_id = s.id and l.column_name = 'entity_type' and l.released_at is null)
       and exists (select 1 from public.source_records sr join public.sources so on so.id = sr.source_id
                    where sr.supplier_id = s.id and so.code = 'BGMEA' and sr.status = 'active'
                      and sr.fields->>'bgmea_member_type' = 'general_manufacturer')
       and not exists (select 1 from public.source_records sr join public.sources so on so.id = sr.source_id
                        where sr.supplier_id = s.id and so.code = 'BGMEA'
                          and sr.fields->>'bgmea_member_type' = 'associate_buying_house');
  get diagnostics n_snap = row_count;
  alter table public._snapshot_entity_type_{stamp} enable row level security;
  revoke all on public._snapshot_entity_type_{stamp} from anon, authenticated;

  update public.suppliers s set entity_type = 'factory'
    from public._snapshot_entity_type_{stamp} t where t.id = s.id;
  get diagnostics n_upd = row_count;

  select count(*) filter (where s.entity_type = 'buying_house'),
         count(*) filter (where s.entity_type = 'buying_house' and exists (
           select 1 from public.source_records sr join public.sources so on so.id = sr.source_id
            where sr.supplier_id = s.id and so.code = 'BGMEA'
              and sr.fields->>'bgmea_member_type' = 'associate_buying_house'))
    into bh_after, real_after from public.suppliers s;

  if n_snap <> {n} or n_upd <> {n} or real_after <> real_before or bh_after <> bh_before - {n} then
    raise exception 'REFUSED | rows that qualify % (want {n}) | updated % | buying houses % -> % | holding an associate entry % -> %',
      n_snap, n_upd, bh_before, bh_after, real_before, real_after;
  end if;
  raise exception 'DRY RUN OK | snapshot % | set to factory % | buying houses % -> % | holding an associate entry % -> %',
    n_snap, n_upd, bh_before, bh_after, real_before, real_after;  -- REHEARSAL
end $fix$;
"""


def write_sql(path: Path, fix: list[dict], today: date) -> None:
    ids = ",\n".join(f"    '{r['id']}'" for r in fix)
    path.write_text(
        _SQL.format(today=today.isoformat(), stamp=today.strftime("%Y%m%d"), n=len(fix), ids=ids),
        encoding="utf-8", newline="\n",
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--json", type=Path, default=Path("ops/plans/bgmea-entity-type.json"))
    parser.add_argument("--sql", type=Path, default=None, help="write the rehearsal block for the fix rows here")
    parser.add_argument("--cache", type=Path, default=None, help="directory holding an earlier pull")
    args = parser.parse_args()
    try:
        data = load(args.cache)
    except Exception as exc:  # noqa: BLE001
        print(f"ERROR: could not read production: {exc}", file=sys.stderr)
        return 2
    out = build(*data)
    args.json.write_text(json.dumps(out, indent=1, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")
    if args.sql:
        write_sql(args.sql, out["fix"], date.today())

    fix = out["fix"]
    print(f"suppliers {out['suppliers']} ({out['published']} published)")
    print(f"{'type':<14}{'BGMEA entries':<20}{'rows':>6}{'published':>11}")
    for row in out["table"]:
        print(f"{row['entity_type']:<14}{row['bgmea']:<20}{row['suppliers']:>6}{row['published']:>11}")
    print(f"fix: {len(fix)} shown as buying house on a manufacturer's entry alone "
          f"({sum(r['published'] for r in fix)} published, "
          f"{sum(r['sewing_machines'] is not None for r in fix)} with sewing machines on file, "
          f"{sum(r['building_of_another'] for r in fix)} a building of another company)")
    print(f"ask: {len(out['ask'])} more where a person locked the type or the company is claimed")
    print(f"stays: {out['stays']} buying houses holding an associate entry")
    print(f"buying house with no register behind it: {len(out['buying_house_without_a_register'])} (listed, not touched)")
    print(f"json: {args.json}" + (f"; sql: {args.sql}" if args.sql else ""))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
