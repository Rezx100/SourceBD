"""Merge certain split-evidence duplicate suppliers into one profile each.

WHY
---
REZ-56 (3 Aug 2026): the same legal entity exists as 2+ published suppliers
holding fragmented Tier 1-3 evidence — `FOUR H APPARELS LTD.`
[BGMEA,BKMEA,EPB,OEKO_TEX,RSC] vs `Four H Apparels Ltd.` [GOTS] — so each
public profile shows a fragment of the truth. `ops/audit_cross_register_coverage.py`
finds the clusters; this script heals the ones whose links are identity-proof
(the audit's `certain_merge_groups`: recomputed-slug equality, or a shared
source ref whose mechanics prove one entity). Fuzzy-class and ownership-dispute
clusters are reported by the audit and are NEVER merged here.

WINNER
------
The member with the most distinct active Tier 1-3 source codes (the profile
already showing the most of the truth); ties broken by most active records,
then earliest created_at. The winner keeps its name, slug, and identity
columns; `ops/backfill_supplier_identity.py` cleans the slug afterwards.

WHAT MOVES (nothing is deleted except byte-redundant rows)
----------------------------------------------------------
Every supplier-referencing column is ENUMERATED FROM THE SCHEMA at runtime
(FKs to public.suppliers, plus supplier_id columns without an FK such as
evidence_claims.supplier_id) — never hardcoded — and re-pointed to the
winner: source_records, evidence_claims/documents, certifications, addresses,
rsc_remediation, sanctions_screening, saved_suppliers, message_threads,
orders, claim_requests, rfq_quotes, and anything else that appears.

- source_records is unique on (supplier_id, source_id, source_ref): when both
  sides hold a scrape of the same register row, the NEWER fetched row
  survives (last-scraped-wins), every citation to the redundant row is
  re-pointed (evidence_claims subject + any FK to source_records), and only
  the redundant pointer row is dropped — a byte-identical reference to the
  same register entry, so no information is lost. Claim history stays
  append-only.
- Other tables with a unique constraint spanning the supplier column
  (saved_suppliers, supplier_aliases): the winner already holds the
  equivalent row, so the loser's duplicate is dropped and logged.

COLUMN RECONCILIATION
---------------------
- arrays (source_tags, phones, bgmea_reg_numbers): union, winner's order first.
- verified flags, is_sanctioned: OR.
- bkmea_reg_number: recomputed from the merged records by the 3 Aug 2026
  canonical rule — the NEWEST fetched valid `:detail` value wins
  (junk-guarded: must lead with its integer), else the newest valid list
  value — the same rule `ops/repair_bkmea_registry_display.py` enforces.
- other scalars: never overwrite non-null with null; when both sides hold a
  value the winner's is kept and the difference is printed for the founder.
- derived numeric profile columns (employees_*, capacity, machines): left in
  place — they were computed from the winner's own records and the merge only
  ADDS records; re-run `ops/backfill_profile_columns.py` afterwards to fold
  the gained records in (it max-merges).

TOMBSTONE
---------
Follows the established merge convention (`ops/spec08_retro_merge.py`): once
every reference points at the winner and a zero-reference check passes, the
loser's supplier row is deleted. Evidence and claim history survive on the
winner; the loser's row is an empty shell at that point.

USAGE
-----
    python ops/merge_duplicate_suppliers.py                 # dry run, prints the plan
    python ops/merge_duplicate_suppliers.py --apply         # execute, one transaction
    python ops/merge_duplicate_suppliers.py --apply --only "four h"   # one cluster first
    python ops/merge_duplicate_suppliers.py --apply --limit 3         # a slice first

Dry run is the default deliberately: the founder reviews the printed plan
before anything moves.
"""

from __future__ import annotations

import argparse
import os
import sys
from collections import defaultdict
from typing import Any

import psycopg
from psycopg.rows import dict_row

from ops.audit_cross_register_coverage import Member, _fetch, discover_clusters

# Every FK-bearing column referencing public.suppliers.id.
FK_REFERENCES_SQL = """
select tc.table_name, kcu.column_name
  from information_schema.table_constraints tc
  join information_schema.key_column_usage kcu
    on tc.constraint_name = kcu.constraint_name and tc.table_schema = kcu.table_schema
  join information_schema.constraint_column_usage ccu
    on tc.constraint_name = ccu.constraint_name and tc.table_schema = ccu.table_schema
 where tc.constraint_type = 'FOREIGN KEY'
   and tc.table_schema = 'public'
   and ccu.table_schema = 'public' and ccu.table_name = 'suppliers' and ccu.column_name = 'id'
 order by tc.table_name
"""

# supplier_id columns WITHOUT an FK (polymorphic-adjacent tables like
# evidence_claims) — the same class the REZ-56 verification enumerated.
# BASE TABLE only: v_* relations are views over source_records/suppliers —
# they cannot be updated and their rows follow the re-point automatically.
NON_FK_REFERENCES_SQL = """
select c.table_name, c.column_name
  from information_schema.columns c
  join information_schema.tables t
    on t.table_schema = c.table_schema and t.table_name = c.table_name
   and t.table_type = 'BASE TABLE'
 where c.table_schema = 'public'
   and (c.column_name = 'supplier_id' or c.column_name like '%\\_supplier\\_id' escape '\\')
   and not exists (
         select 1
           from information_schema.table_constraints tc
           join information_schema.key_column_usage kcu
             on tc.constraint_name = kcu.constraint_name and tc.table_schema = kcu.table_schema
           join information_schema.constraint_column_usage ccu
             on tc.constraint_name = ccu.constraint_name and tc.table_schema = ccu.table_schema
          where tc.constraint_type = 'FOREIGN KEY'
            and ccu.table_schema = 'public' and ccu.table_name = 'suppliers'
            and kcu.table_schema = c.table_schema
            and kcu.table_name = c.table_name and kcu.column_name = c.column_name)
 order by c.table_name
"""

# Unique/primary constraints per table, for re-point collision detection.
CONSTRAINTS_SQL = """
select tc.constraint_name, kcu.column_name
  from information_schema.table_constraints tc
  join information_schema.key_column_usage kcu
    on tc.constraint_name = kcu.constraint_name and tc.table_schema = kcu.table_schema
 where tc.table_schema = 'public'
   and tc.constraint_type in ('UNIQUE', 'PRIMARY KEY')
   and tc.table_name = %s
 order by tc.constraint_name, kcu.ordinal_position
"""

# References TO source_records rows (needed when a redundant source_records
# row is dropped: its citers move to the surviving row).
FK_TO_SOURCE_RECORDS_SQL = """
select tc.table_name, kcu.column_name
  from information_schema.table_constraints tc
  join information_schema.key_column_usage kcu
    on tc.constraint_name = kcu.constraint_name and tc.table_schema = kcu.table_schema
  join information_schema.constraint_column_usage ccu
    on tc.constraint_name = ccu.constraint_name and tc.table_schema = ccu.table_schema
 where tc.constraint_type = 'FOREIGN KEY'
   and tc.table_schema = 'public'
   and ccu.table_schema = 'public' and ccu.table_name = 'source_records' and ccu.column_name = 'id'
 order by tc.table_name
"""

SOURCE_RECORD_ROWS_SQL = """
select sr.id::text, sr.source_id::text, sr.source_ref, sr.fetched_at, sr.status
  from public.source_records sr
 where sr.supplier_id = any(%s::uuid[])
"""

# 3 Aug 2026 canonical rule for suppliers.bkmea_reg_number: the NEWEST fetched
# valid :detail row's value wins, else the newest fetched valid list row's.
# "Valid" = leads with its membership integer (detail pages with a blank or
# junk membership cell are not the truth about the number).
BKMEA_REG_RECOMPUTE_SQL = """
select sr.fields->>'bkmea_reg_number' as reg
  from public.source_records sr
  join public.sources s on s.id = sr.source_id and s.code = 'BKMEA'
 where sr.supplier_id = %s::uuid
   and sr.status = 'active'
   and sr.fields->>'bkmea_reg_number' ~ %s
 order by (sr.source_ref like '%%:detail') desc, sr.fetched_at desc
 limit 1
"""
_REG_HEAD_RE = r"^\d+\s*-"

SUPPLIER_ROW_SQL = """
select id::text, company_name, slug, company_name_norm, entity_type,
       bgmea_reg_numbers, bgmea_verified, bkmea_reg_number, bkmea_verified,
       bgapmea_verified, btma_verified, rjsc_reg_number, epb_erc_number, bepza_zone,
       contact_name, contact_role, email_primary::text as email_primary, phones, website,
       address_raw, city, district, country, lat, lng,
       source_tags, is_sanctioned, is_published, claimed_by::text as claimed_by,
       completeness_pct, created_at
  from public.suppliers
 where id = any(%s::uuid[])
"""

ARRAY_COLUMNS = ("bgmea_reg_numbers", "phones", "source_tags")
OR_COLUMNS = ("bgmea_verified", "bkmea_verified", "bgapmea_verified", "btma_verified", "is_sanctioned")
COALESCE_COLUMNS = (
    "rjsc_reg_number", "epb_erc_number", "bepza_zone",
    "contact_name", "contact_role", "email_primary", "website",
    "address_raw", "city", "district", "lat", "lng", "claimed_by",
)


def _pick_winner(members: list[Member]) -> Member:
    def key(m: Member) -> tuple[int, int, int]:
        return (len(m.tier13_codes), len(m.records), -m.created_at.toordinal())

    return max(members, key=key)


def _union(a: list | None, b: list | None) -> list:
    out: list = []
    for v in (a or []) + (b or []):
        if v not in out:
            out.append(v)
    return out


def _repoint_plan(
    cur,
    references: list[tuple[str, str]],
    winner_id: str,
    loser_id: str,
    constraints_cache: dict[str, list[tuple[str, list[str]]]],
) -> list[dict]:
    """Per table/column: rows that re-point cleanly vs rows colliding on a
    unique constraint that spans the supplier column."""
    plan: list[dict] = []
    for table, column in references:
        constraints = constraints_cache[table]
        # source_records same-register-row collisions are handled separately
        # (newest fetched survives, citations follow) — not by generic drops.
        spanning = [] if table == "source_records" else [cols for name, cols in constraints if column in cols]
        cur.execute(
            f'select count(*) as n from public."{table}" where "{column}" = %s::uuid',
            (loser_id,),
        )
        total = cur.fetchone()["n"]
        if not total:
            continue
        collisions = 0
        if spanning:
            for cols in spanning:
                others = [c for c in cols if c != column]
                if not others:
                    # Singleton constraint on the supplier column itself (e.g.
                    # sbi_scores PK(supplier_id)): one row per supplier, so if
                    # the winner already holds one, every loser row collides.
                    cur.execute(
                        f'''select count(*) as n
                              from public."{table}" l
                             where l."{column}" = %s::uuid
                               and exists (select 1 from public."{table}" w
                                            where w."{column}" = %s::uuid)''',
                        (loser_id, winner_id),
                    )
                    collisions += cur.fetchone()["n"]
                    continue
                cond = " and ".join(f'w."{c}" = l."{c}"' for c in others)
                cur.execute(
                    f'''select count(*) as n
                          from public."{table}" l
                         where l."{column}" = %s::uuid
                           and exists (select 1 from public."{table}" w
                                        where w."{column}" = %s::uuid and {cond})''',
                    (loser_id, winner_id),
                )
                collisions += cur.fetchone()["n"]
        plan.append(
            {"table": table, "column": column, "rows": total, "collisions": collisions, "spanning": spanning}
        )
    return plan


def _apply_repoint(cur, plan_item: dict, winner_id: str, loser_id: str) -> None:
    table, column = plan_item["table"], plan_item["column"]
    for cols in plan_item["spanning"]:
        others = [c for c in cols if c != column]
        if not others:
            # Singleton constraint (e.g. sbi_scores PK): the winner's own row
            # is the kept equivalent; the loser's derived row drops.
            cur.execute(
                f'''delete from public."{table}" l
                     where l."{column}" = %s::uuid
                       and exists (select 1 from public."{table}" w
                                    where w."{column}" = %s::uuid)''',
                (loser_id, winner_id),
            )
            continue
        cond = " and ".join(f'w."{c}" = l."{c}"' for c in others)
        # The winner already holds the equivalent row; the loser's duplicate
        # carries nothing the winner lacks.
        cur.execute(
            f'''delete from public."{table}" l
                 where l."{column}" = %s::uuid
                   and exists (select 1 from public."{table}" w
                                where w."{column}" = %s::uuid and {cond})''',
            (loser_id, winner_id),
        )
    cur.execute(
        f'update public."{table}" set "{column}" = %s::uuid where "{column}" = %s::uuid',
        (winner_id, loser_id),
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="execute (default: dry run)")
    parser.add_argument("--limit", type=int, default=None, help="only process N merge groups")
    parser.add_argument("--only", metavar="NAME", help="only groups containing a member named like NAME")
    args = parser.parse_args()

    dsn = os.environ.get("SUPABASE_DB_URL")
    if not dsn:
        print("ERROR: SUPABASE_DB_URL not set", file=sys.stderr)
        return 1

    with psycopg.connect(dsn, prepare_threshold=None, autocommit=False, row_factory=dict_row) as conn:
        with conn.cursor() as cur:
            members, code_by_id = _fetch(cur)
            clusters = discover_clusters(members, code_by_id, cur)

            groups: list[list[Member]] = [g for c in clusters for g in c.merge_groups]
            if args.only:
                groups = [g for g in groups if any(args.only.lower() in m.name.lower() for m in g)]
            groups.sort(key=lambda g: g[0].name)
            if args.limit is not None:
                groups = groups[: args.limit]
            if not groups:
                print("No merge groups in scope.")
                return 0

            cur.execute(FK_REFERENCES_SQL)
            fk_refs = [(r["table_name"], r["column_name"]) for r in cur.fetchall()]
            cur.execute(NON_FK_REFERENCES_SQL)
            nonfk_refs = [(r["table_name"], r["column_name"]) for r in cur.fetchall()]
            references = sorted(set(fk_refs + nonfk_refs))
            cur.execute(FK_TO_SOURCE_RECORDS_SQL)
            sr_citers = [(r["table_name"], r["column_name"]) for r in cur.fetchall()]

            tables = sorted({t for t, _ in references})
            constraints_cache: dict[str, list[tuple[str, list[str]]]] = {}
            for t in tables + ["source_records"]:
                cur.execute(CONSTRAINTS_SQL, (t,))
                grouped: dict[str, list[str]] = defaultdict(list)
                for r in cur.fetchall():
                    grouped[r["constraint_name"]].append(r["column_name"])
                constraints_cache[t] = list(grouped.items())

        print(f"{len(groups)} merge group(s) in scope.")
        print("Re-point targets enumerated from the schema:")
        for t, c in references:
            print(f"  {t:<38} .{c}")
        print(f"source_records row citers: {sr_citers or '[]'}")

        grand_moves: dict[str, int] = defaultdict(int)
        grand_drops: dict[str, int] = defaultdict(int)
        merged = 0

        for group in groups:
            winner = _pick_winner(group)
            losers = [m for m in group if m.id != winner.id]
            loser_ids = [m.id for m in losers]

            print("\n" + "=" * 78)
            print(
                f"MERGE {' + '.join(f'{m.name!r}[{m.id[:6]}]' for m in group)}"
                + ("" if args.apply else "   (dry run)")
            )
            print(
                f"  winner: {winner.name!r}[{winner.id[:6]}] "
                f"({len(winner.tier13_codes)} Tier 1-3 codes, {len(winner.records)} records)"
            )
            for m in losers:
                print(f"  loser:  {m.name!r}[{m.id[:6]}] ({len(m.tier13_codes)} codes, {len(m.records)} records)")

            with conn.cursor() as cur:
                # ---- supplier rows for column reconciliation ----------------
                cur.execute(SUPPLIER_ROW_SQL, ([winner.id] + loser_ids,))
                sup_rows = {r["id"]: r for r in cur.fetchall()}
                w = sup_rows[winner.id]

                # ---- source_records: same register row on both sides --------
                cur.execute(SOURCE_RECORD_ROWS_SQL, ([winner.id] + loser_ids,))
                sr_rows = cur.fetchall()
                by_key: dict[tuple[str, str | None], list[dict]] = defaultdict(list)
                for r in sr_rows:
                    by_key[(r["source_id"], r["source_ref"])].append(r)

                redundant: list[tuple[dict, dict]] = []  # (drop, keep)
                for key, rows in by_key.items():
                    if len(rows) < 2 or key[1] is None:
                        continue  # no unique collision (NULL refs never collide)
                    rows.sort(key=lambda r: r["fetched_at"], reverse=True)
                    keep, drops = rows[0], rows[1:]
                    for d in drops:
                        redundant.append((d, keep))
                if redundant:
                    grand_drops["source_records"] += len(redundant)
                    print(f"  source_records: {len(redundant)} redundant register pointer(s):")
                    for d, keep in redundant:
                        print(
                            f"    drop {d['id'][:8]} (fetched {d['fetched_at']:%Y-%m-%d}), "
                            f"keep {keep['id'][:8]} (fetched {keep['fetched_at']:%Y-%m-%d}) ref={d['source_ref']!r}"
                        )

                # ---- re-point plan ------------------------------------------
                per_loser_plans = {
                    lid: _repoint_plan(cur, references, winner.id, lid, constraints_cache)
                    for lid in loser_ids
                }
                for lid, p in per_loser_plans.items():
                    for item in p:
                        note = f", {item['collisions']} unique-collision drop(s)" if item["collisions"] else ""
                        print(
                            f"  re-point {item['table']:<34}.{item['column']:<18} "
                            f"{item['rows']} row(s) from [{lid[:6]}]{note}"
                        )
                        grand_moves[item["table"]] += item["rows"] - item["collisions"]
                        grand_drops[item["table"]] += item["collisions"]

                # ---- column reconciliation preview --------------------------
                updates: dict[str, Any] = {}
                conflicts: list[str] = []
                for lid in loser_ids:
                    loser_row = sup_rows[lid]
                    for col in ARRAY_COLUMNS:
                        updates[col] = _union(updates.get(col, w[col]), loser_row[col])
                    for col in OR_COLUMNS:
                        updates[col] = bool(updates.get(col, w[col]) or loser_row[col])
                    for col in COALESCE_COLUMNS:
                        cur_val = updates.get(col, w[col])
                        if cur_val in (None, "", "unknown"):
                            updates[col] = loser_row[col]
                        elif loser_row[col] not in (None, "", "unknown") and loser_row[col] != cur_val:
                            conflicts.append(f"{col}: winner keeps {cur_val!r} (loser had {loser_row[col]!r})")
                if updates.get("entity_type", w["entity_type"]) == "unknown":
                    for lid in loser_ids:
                        if sup_rows[lid]["entity_type"] != "unknown":
                            updates["entity_type"] = sup_rows[lid]["entity_type"]
                            break
                for c in conflicts:
                    print(f"  column conflict — {c}")

                # ---- apply --------------------------------------------------
                if args.apply:
                    # redundant source_records: citations follow the surviving row
                    for d, keep in redundant:
                        cur.execute(
                            """update public.evidence_claims
                                  set subject_id = %s::uuid
                                where subject_table = 'source_records' and subject_id = %s::uuid""",
                            (keep["id"], d["id"]),
                        )
                        for t, c in sr_citers:
                            cur.execute(
                                f'update public."{t}" set "{c}" = %s::uuid where "{c}" = %s::uuid',
                                (keep["id"], d["id"]),
                            )
                        cur.execute("delete from public.source_records where id = %s::uuid", (d["id"],))

                    for lid, p in per_loser_plans.items():
                        for item in p:
                            _apply_repoint(cur, item, winner.id, lid)
                        # polymorphic citations of the supplier row itself —
                        # not enumerable via information_schema.
                        cur.execute(
                            """update public.evidence_claims
                                  set subject_id = %s::uuid
                                where subject_table = 'suppliers' and subject_id = %s::uuid""",
                            (winner.id, lid),
                        )

                    # canonical bkmea_reg_number from the merged records
                    cur.execute(BKMEA_REG_RECOMPUTE_SQL, (winner.id, _REG_HEAD_RE))
                    reg = cur.fetchone()
                    if reg:
                        updates["bkmea_reg_number"] = reg["reg"]

                    if updates:
                        set_sql = ", ".join(f'"{k}" = %s' for k in updates)
                        cur.execute(
                            f'update public.suppliers set {set_sql}, updated_at = now() where id = %s::uuid',
                            (*updates.values(), winner.id),
                        )

                    # completeness reads the consolidated records — recompute
                    # after the re-point, same call the ingest makes.
                    cur.execute(
                        "update public.suppliers set completeness_pct = public.compute_completeness(%s::uuid) where id = %s::uuid",
                        (winner.id, winner.id),
                    )

                    # zero-reference check, then tombstone (spec08 convention)
                    for lid in loser_ids:
                        leftovers = []
                        for t, c in references:
                            cur.execute(
                                f'select count(*) as n from public."{t}" where "{c}" = %s::uuid', (lid,)
                            )
                            n = cur.fetchone()["n"]
                            if n:
                                leftovers.append(f"{t}.{c}={n}")
                        cur.execute(
                            """select count(*) as n from public.evidence_claims
                                where subject_table = 'suppliers' and subject_id = %s::uuid""",
                            (lid,),
                        )
                        n = cur.fetchone()["n"]
                        if n:
                            leftovers.append(f"evidence_claims.subject_id={n}")
                        if leftovers:
                            raise RuntimeError(
                                f"loser {lid} still referenced: {', '.join(leftovers)} — refusing to delete"
                            )
                        cur.execute("delete from public.suppliers where id = %s::uuid", (lid,))
                merged += 1

        print("\n" + "=" * 78)
        print("SUMMARY")
        print("=" * 78)
        print(f"{merged} merge group(s) processed.")
        for t in sorted(set(grand_moves) | set(grand_drops)):
            print(
                f"  {t:<38} {grand_moves[t]:>4} row(s) re-pointed, "
                f"{grand_drops[t]} duplicate(s) dropped"
            )
        if args.apply:
            conn.commit()
            print(
                "\nApplied. Now run, in order:\n"
                "  python ops/backfill_profile_columns.py\n"
                "  python ops/repair_bkmea_registry_display.py --apply   (canonical registry columns)\n"
                "  python ops/backfill_supplier_identity.py --apply      (slug/norm cleanup)\n"
                "  python ops/audit_cross_register_coverage.py           (confirm clusters resolved)"
            )
        else:
            conn.rollback()
            print("\nDry run — nothing written. Re-run with --apply to execute.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
