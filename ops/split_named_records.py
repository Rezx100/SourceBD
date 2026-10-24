"""Give register records that name a different company their own profile (24 Oct 2026).

WHY
---
The founder's Volza review found `FUNNY SWEATER LTD.` showing exports that Volza files under
`Sunny Sweater Ltd`. The record held Sunny Sweater's BGMEA membership and EPB registration: the names
differ by one letter, scored 92, and passed `_names_compatible`. A scan for one-letter differences in the
leading word found nine more; the register entries' addresses and owners settled each one by hand:

  split   funny-sweater    BGMEA 6512 + EPB 663 are Sunny Sweater Ltd., Sataish, Tongi, Gazipur (Xu Yung);
                           Funny Sweater is BKMEA 1751, Siddhirganj, Narayanganj (Gazi Md. Monsur)
  split   azim-garments    BGMEA 2791 is Aziz Garments Ltd., Goshaildanga, Chittagong (Abdul Mannan Rana);
                           Azim Garments is BGMEA 634, Mohammadpur, Dhaka (Fazle Azim)
  split   rafia-knitwear   BGMEA 6708 is Rafin Knitwears Ltd., Mirpur-11, Dhaka (Khandoker Saifur Rahman);
                           Rafia Knitwears is BKMEA 1152, Demra, Dhaka (Mst. Firoza Khanam)
  split   united-attires   BGMEA 2651 is Unitex Attires Ltd., DT Road, Kadamtali, Chittagong (Md. Anwar Shadath);
                           United Attires is BKMEA 1074, Godnail, Narayanganj (Md. Nabi Newaz)
  rename  veetex-fabrics   both its records (BKMEA 421, 2209) name VERTEX FABRICS LTD; nothing says Veetex.
                           The slug stays so saved links keep working.
  keep    badgetex, benimoy, temakaw, varonica, refat: one company, two spellings (same plot and owner, or
          an EPB name with nothing on record against it)

Each split runs the same steps as `ops/repair_bgmea_conflations.py`: create the company (or join an
exact-identity profile), move the record and its evidence claims, project its fields onto the new
profile, try to publish (the database trigger enforces the tier rule), and recompute the old profile from
its remaining records. Buyer-facing rows (saved suppliers, threads, orders, claims) stay where they are.

Funny Sweater's Volza row was the Sunny Sweater search; Volza found nothing under "FUNNY SWEATER", so the
row becomes "not on Volza". Sunny Sweater is fetched by the next Tradeline run once
`etl/raw/volza/candidates.json` is deleted (the plan rebuilds it from production).

REST with the service key, no wrapping transaction: every step is idempotent and a rerun finishes a
stopped run (moved records are no longer on the host; a created company is found again by its slug).

    python ops/split_named_records.py            # dry run: what would change
    python ops/split_named_records.py --apply    # the founder runs it
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Any

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from etl.core.normalize import make_slug, normalize_company_name  # noqa: E402
from ops.repair_bgmea_conflations import (  # noqa: E402
    Rest,
    SupplierPool,
    _guard_matches,
    _locked_columns,
    _merge_into_profile,
    _recompute_parent,
    _unique_slug,
)

# host slug, the other company's name, its records as (source code, source_ref)
SPLITS: list[tuple[str, str, list[tuple[str, str]]]] = [
    ("funny-sweater", "Sunny Sweater Ltd.", [("BGMEA", "general:6512"), ("EPB", "663")]),
    ("azim-garments", "Aziz Garments Ltd.", [("BGMEA", "general:2791")]),
    ("rafia-knitwear", "Rafin Knitwears Ltd.", [("BGMEA", "general:6708")]),
    ("united-attires", "Unitex Attires Ltd.", [("BGMEA", "general:2651")]),
]
RENAMES: list[tuple[str, str]] = [("veetex-fabrics", "Vertex Fabrics Ltd.")]
# host slug -> the name Volza was searched under for that company alone (it found nothing)
VOLZA_NOT_FOUND: dict[str, str] = {"funny-sweater": "FUNNY SWEATER"}


def split(rest: Rest, pool: SupplierPool, source_codes: dict[str, str], code_ids: dict[str, str],
          host_slug: str, name: str, refs: list[tuple[str, str]], apply: bool, taken: set[str]) -> int:
    host = rest.one("suppliers", {"select": "id,company_name", "slug": f"eq.{host_slug}"})
    if host is None:
        print(f"SKIP  {host_slug}: no such supplier")
        return 1
    records = []
    for code, ref in refs:
        rec = rest.one("source_records", {"select": "id,supplier_id,source_id,source_ref,fields",
                                          "source_id": f"eq.{code_ids[code]}", "source_ref": f"eq.{ref}"})
        if rec is None:
            print(f"SKIP  {code} {ref}: record not found")
            return 1
        records.append((code, rec))
    exact, fuzzy = _guard_matches(name, pool, host["id"])
    if len(exact) > 1:
        print(f"SKIP  {name!r}: {len(exact)} exact-identity profiles already exist; a person decides")
        return 1
    dest = exact[0] if exact else None
    where = f"joins {dest['company_name']!r}" if dest else "new profile"
    if fuzzy and not dest:
        where += f" (near names not joined: {', '.join(m['company_name'] for m in fuzzy[:3])})"
    on_host = [(c, r) for c, r in records if r["supplier_id"] == host["id"]]
    print(f"split {host['company_name']!r} -> {name!r} [{where}]: "
          + ", ".join(f"{c} {r['source_ref']}" + ("" if r["supplier_id"] == host["id"] else " (already moved)")
                      for c, r in records))
    if not apply or not on_host:
        return 0

    if dest is None:
        slug = _unique_slug(rest, make_slug(name), taken)
        try:
            dest = rest.insert("suppliers", {"company_name": name, "slug": slug,
                                             "company_name_norm": normalize_company_name(name)})
        except httpx.HTTPStatusError as exc:  # an earlier stopped run created it
            if exc.response.status_code != 409:
                raise
            dest = rest.one("suppliers", {"select": "id,company_name", "slug": f"eq.{slug}"})
        pool.add({"id": dest["id"], "company_name": name})
    for code, rec in on_host:
        # commit point: the move; claims and profile columns follow it
        moved = rest.patch("source_records", {"id": f"eq.{rec['id']}", "supplier_id": f"eq.{host['id']}"},
                           {"supplier_id": dest["id"]})
        if not moved:
            continue
        rest.patch("evidence_claims", {"supplier_id": f"eq.{host['id']}", "subject_table": "eq.source_records",
                                       "subject_id": f"eq.{rec['id']}"}, {"supplier_id": dest["id"]})
        reg = rec["source_ref"].split(":", 1)[1] if code == "BGMEA" else None
        _merge_into_profile(rest, dest["id"], rec.get("fields") or {}, code, reg, source_codes)
    try:
        rest.patch("suppliers", {"id": f"eq.{dest['id']}", "is_published": "eq.false"}, {"is_published": True})
    except httpx.HTTPStatusError as exc:
        print(f"      not published (tier rule): {exc.response.text[:120]}")
    _recompute_parent(rest, host["id"], source_codes)
    return 0


def rename(rest: Rest, slug: str, name: str, apply: bool) -> int:
    sup = rest.one("suppliers", {"select": "id,company_name", "slug": f"eq.{slug}"})
    if sup is None:
        print(f"SKIP  {slug}: no such supplier")
        return 1
    if sup["company_name"] == name:
        print(f"name  {slug}: already {name!r}")
        return 0
    if "company_name" in _locked_columns(rest, sup["id"]):
        print(f"SKIP  {slug}: an admin locked the name")
        return 1
    print(f"name  {slug}: {sup['company_name']!r} -> {name!r} (slug kept)")
    if apply:
        rest.patch("suppliers", {"id": f"eq.{sup['id']}"},
                   {"company_name": name, "company_name_norm": normalize_company_name(name)})
    return 0


def volza_not_found(rest: Rest, slug: str, searched: str, apply: bool) -> int:
    sup = rest.one("suppliers", {"select": "id", "slug": f"eq.{slug}"})
    row = sup and rest.one("volza_export_checks", {"select": "match_class,volza_supplier_name,shipments",
                                                   "supplier_id": f"eq.{sup['id']}"})
    if not row or row["match_class"] == "none":
        print(f"volza {slug}: nothing to change")
        return 0
    print(f"volza {slug}: {row['shipments']} shipments of {row['volza_supplier_name']!r} -> not on Volza "
          f"(nothing under {searched!r})")
    if apply:
        body: dict[str, Any] = {
            "match_class": "none", "shipments": 0, "exporters_matched": 0, "volza_supplier_name": None,
            "fob_usd": None, "buyers": None, "top_shipments": [], "name_searched": searched,
            "markets": None, "small_orders": None, "summary": None, "top_record": None}
        rest.patch("volza_export_checks", {"supplier_id": f"eq.{sup['id']}"}, body)
    return 0


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--apply", action="store_true", help="write to production (the founder runs it)")
    a = p.parse_args()
    rest = Rest()
    sources = rest.all_rows("sources", {"select": "id,code"})
    source_codes = {s["id"]: s["code"] for s in sources}
    code_ids = {s["code"]: s["id"] for s in sources}
    pool = SupplierPool(rest.all_rows("suppliers", {"select": "id,company_name"}))
    taken: set[str] = set()
    problems = sum(split(rest, pool, source_codes, code_ids, *s, a.apply, taken) for s in SPLITS)
    problems += sum(rename(rest, *r, a.apply) for r in RENAMES)
    problems += sum(volza_not_found(rest, slug, searched, a.apply) for slug, searched in VOLZA_NOT_FOUND.items())
    print(("Applied." if a.apply else "Dry run: nothing written. The founder runs it with --apply.")
          + (f" {problems} item(s) skipped; see above." if problems else ""))
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
