"""Detect suppliers that hold registry records for a different company.

WHY THIS EXISTS
---------------
On 31 Jul 2026, 82 supplier profiles were found publishing two or more companies'
data as one. `S. B. KNITWEAR` carried B. S KNITWEAR and B. S TEXTILE; `ABANTI
COLOUR TEX` carried CRONY APPARELS. Nobody noticed for months, because a
conflated supplier looks completely normal from the outside — it has a name, an
address, a worker count and a certification list. They are just not all the same
company's.

On 4 Aug 2026 the founder found the same class again on the BGMEA side —
`Ananta Sportswear Ltd.` hiding inside `ABM Fashions Ltd.`, 808 stowaway
records in total — because this check scanned BKMEA only. It now scans BGMEA
general-member records too: any record whose scraped name is not the host
supplier's company is flagged, single record or not (the stowaway class needs
no second membership to be wrong).

On 5 Aug 2026 a third class surfaced while verifying A8's largest numeric
corrections: 199 suppliers hold more than one distinct BGMEA `source_ref`
(230 excess refs). Every one of those records predates the REZ-56
`scraped_company_name` write, so the name-based BGMEA scan matched nothing and
reported clean. A BGMEA or BKMEA *member* ref identifies exactly one legal
entity, so two distinct active member refs from the same register is a
structural conflation — no name comparison required. That pass is reported
separately below as `multi_member_ref`.

`etl/core/upsert.py` now refuses the matches that caused it, and
`etl/tests/test_supplier_dedup_guards.py` pins that behaviour in CI. This script
is the third leg: it assumes those defences will eventually be circumvented — by
a new source, a threshold someone tunes, or a scraper that populates
`company_name_norm` differently — and makes the result *loud* instead of
invisible. A silent conflation is the expensive failure; a detected one is an
afternoon.

WHAT COUNTS AS A CONFLATION
---------------------------
Two BKMEA records under one supplier with different base membership numbers are
the *signal*, not the verdict: BKMEA re-issues numbers, so one company can
legitimately hold 1449 and 489. The names settle it, using `_names_compatible` —
the same predicate that governs merging in `_find_existing` and splitting in
`unmerge_bkmea_suppliers.py`. One definition of "the same company", applied
everywhere, so the detector cannot drift away from the rule it is policing.

Records with no scraped name are reported separately and do not fail the run.
There is nothing to compare, so calling them conflations would be a guess, and
a check that cries wolf gets switched off. (BGMEA records scraped before
4 Aug 2026 carry no `scraped_company_name` — they were repaired in bulk by
`ops/repair_bgmea_conflations.py` against a live-list snapshot and become
checkable here as re-scrapes refresh their fields.)

For BGMEA, a host name that merely EXTENDS the record's name (or vice versa —
"AKH Knitting & Dyeing Ltd. (Extension)" hosting "AKH Knitting & Dyeing Ltd.")
is the extension/unit class, deliberately separate suppliers, never flagged.

Structural multi-member-ref (REZ-88): more than one distinct *active member*
`source_ref` from the same register on one supplier. BKMEA `:detail`
enrichment refs are not member refs and are ignored. Two rows sharing the
same `source_ref` (an ordinary re-scrape) are NOT flagged — that case is
common and must stay silent. Cross-register (one BGMEA + one BKMEA) is a
different signal class and is not flagged here.

USAGE
-----
    python ops/check_supplier_conflations.py           # human-readable (psycopg)
    python ops/check_supplier_conflations.py --rest    # Supabase REST (dev machine)
    python ops/check_supplier_conflations.py --quiet   # only print on failure

Exit codes: 0 clean, 1 conflations found, 2 could not run the check.
"""

from __future__ import annotations

import argparse
import os
import sys
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import psycopg
from psycopg.rows import dict_row
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

from etl.core.normalize import normalize_company_name  # noqa: E402
from etl.core.upsert import _names_compatible  # noqa: E402
from ops.repair_bgmea_conflations import Rest, _compatible as _host_record_compatible  # noqa: E402
from ops.unmerge_bkmea_suppliers import MERGED_SUPPLIERS_SQL  # noqa: E402

# Every BGMEA general record, its scraped name (present on records written
# after 4 Aug 2026), and the supplier it currently sits on. Associate-name
# disagreements are tracked under REZ-102 / bgmea-identity-gap — not this scan.
BGMEA_RECORDS_SQL = """
select sr.id            as record_id,
       sr.supplier_id,
       sr.source_ref,
       sr.fields->>'scraped_company_name' as scraped_name,
       sr.fields->>'bgmea_member_type' as member_type,
       sr.fields->>'bgmea_reg_number' as reg_number,
       sup.company_name,
       sup.slug,
       sup.entity_type
  from public.source_records sr
  join public.sources s on s.id = sr.source_id and s.code = 'BGMEA'
  join public.suppliers sup on sup.id = sr.supplier_id
 where sr.source_ref like 'general:%'
 order by sup.company_name, sr.source_ref;
"""

# REZ-115: published suppliers still holding bare (register-less) digits, or
# two published suppliers asserting the same register+number identity.
BGMEA_IDENTITY_SQL = """
with exploded as (
  select s.id as supplier_id,
         s.slug,
         s.company_name,
         n.value as identity
    from public.suppliers s
    cross join lateral unnest(coalesce(s.bgmea_reg_numbers, '{}'::text[])) as n(value)
   where s.is_published = true
)
select identity,
       count(*) as holders,
       array_agg(supplier_id::text order by slug) as supplier_ids,
       array_agg(slug order by slug) as slugs,
       bool_or(identity !~ '^(general|associate):[0-9]+$') as bare_or_malformed
  from exploded
 group by identity
having bool_or(identity !~ '^(general|associate):[0-9]+$')
    or count(*) > 1
 order by identity;
"""

# Display-side: two published companies still presenting the same register+number
# via the live view (label encodes register; value is the digit).
BGMEA_DISPLAY_COLLISION_SQL = """
select label, value,
       count(distinct supplier_id) as holders,
       array_agg(distinct supplier_id::text order by supplier_id::text) as supplier_ids
  from public.v_supplier_registry_ids_direct
 where source_code = 'BGMEA'
   and label in ('BGMEA General member #', 'BGMEA Associate member #')
 group by label, value
having count(distinct supplier_id) > 1
 order by label, value;
"""

# Active member refs for the structural multi-ref pass (BGMEA + BKMEA).
# BKMEA detail enrichments use `{id}:detail` and are not member identities.
STRUCTURAL_MEMBER_REFS_SQL = """
select sr.supplier_id,
       s.code as source_code,
       sr.source_ref,
       sr.status,
       sup.company_name,
       sup.slug,
       sup.entity_type
  from public.source_records sr
  join public.sources s on s.id = sr.source_id and s.code in ('BGMEA', 'BKMEA')
  join public.suppliers sup on sup.id = sr.supplier_id
 where sr.status = 'active'
   and (
         s.code = 'BGMEA'
      or (s.code = 'BKMEA' and position(':detail' in sr.source_ref) = 0)
   )
 order by s.code, sup.company_name, sr.source_ref;
"""


@dataclass(frozen=True)
class MultiMemberRefFinding:
    """One supplier holding multiple distinct member refs of one register."""

    supplier_id: str
    source_code: str
    company_name: str
    slug: str
    source_refs: tuple[str, ...]

    @property
    def excess(self) -> int:
        return max(0, len(self.source_refs) - 1)


def is_member_ref(source_code: str, source_ref: str | None) -> bool:
    """Whether this source_ref is a member-identity key for the register.

    BKMEA `{detail_id}:detail` rows enrich an existing member; they are not
    a second membership. BGMEA associate (bare reg) and general (`general:`)
    refs are both member identities in the BGMEA register.
    """
    if not source_ref:
        return False
    if source_code == "BKMEA" and ":detail" in source_ref:
        return False
    return True


def find_multi_member_refs(rows: list[dict[str, Any]]) -> list[MultiMemberRefFinding]:
    """Structural conflation: >1 distinct active member ref on one supplier+register.

    Pure — no I/O. Ignores non-active rows, non-member refs, and the common
    case of two rows sharing the same source_ref (a re-scrape). Cross-register
    pairs are out of scope: grouping is per (supplier_id, source_code).
    """
    by_key: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        if (row.get("status") or "active") != "active":
            continue
        code = row.get("source_code") or ""
        ref = row.get("source_ref")
        if not is_member_ref(code, ref):
            continue
        sid = str(row["supplier_id"])
        by_key[(sid, code)].append(row)

    findings: list[MultiMemberRefFinding] = []
    for (sid, code), group in sorted(by_key.items()):
        refs = tuple(sorted({r["source_ref"] for r in group if r.get("source_ref")}))
        if len(refs) < 2:
            continue
        head = group[0]
        findings.append(
            MultiMemberRefFinding(
                supplier_id=sid,
                source_code=code,
                company_name=head.get("company_name") or "",
                slug=head.get("slug") or "",
                source_refs=refs,
            )
        )
    return findings


def _conflated_names(groups: dict[str, list[dict]]) -> list[tuple[str, str]]:
    """Pairs of scraped names under one supplier that are not the same company."""
    named = {
        base_no: [normalize_company_name(r["scraped_name"]) for r in rows if r["scraped_name"]]
        for base_no, rows in groups.items()
    }
    bases = [b for b, names in named.items() if names]
    clashes: list[tuple[str, str]] = []
    for i, left in enumerate(bases):
        for right in bases[i + 1 :]:
            if not any(_names_compatible(a, b) for a in named[left] for b in named[right]):
                a = next(r["scraped_name"] for r in groups[left] if r["scraped_name"])
                b = next(r["scraped_name"] for r in groups[right] if r["scraped_name"])
                clashes.append((a.strip(), b.strip()))
    return clashes


def _load_via_psycopg(
    dsn: str,
) -> tuple[list[dict], list[dict], list[dict], list[dict], list[dict]]:
    with psycopg.connect(dsn, prepare_threshold=None, row_factory=dict_row) as conn:
        with conn.cursor() as cur:
            cur.execute(MERGED_SUPPLIERS_SQL)
            bkmea_name_rows = cur.fetchall()
        with conn.cursor() as cur:
            cur.execute(BGMEA_RECORDS_SQL)
            bgmea_name_rows = cur.fetchall()
        with conn.cursor() as cur:
            cur.execute(STRUCTURAL_MEMBER_REFS_SQL)
            structural_rows = cur.fetchall()
        with conn.cursor() as cur:
            cur.execute(BGMEA_IDENTITY_SQL)
            identity_rows = cur.fetchall()
        with conn.cursor() as cur:
            cur.execute(BGMEA_DISPLAY_COLLISION_SQL)
            display_rows = cur.fetchall()
    return bkmea_name_rows, bgmea_name_rows, structural_rows, identity_rows, display_rows


def _load_via_rest() -> tuple[list[dict], list[dict], list[dict], list[dict], list[dict]]:
    """Production reads when the Postgres pooler is unreachable from this host."""
    rest = Rest()
    sources = {
        r["code"]: r["id"]
        for r in rest.all_rows("sources", {"select": "id,code", "code": "in.(BGMEA,BKMEA)"})
    }
    bgmea_id = sources["BGMEA"]
    bkmea_id = sources["BKMEA"]

    suppliers = {
        r["id"]: r
        for r in rest.all_rows(
            "suppliers",
            {
                "select": "id,company_name,slug,is_published,bgmea_reg_numbers,entity_type"
            },
        )
    }

    bgmea_all = rest.all_rows(
        "source_records",
        {
            "select": "id,supplier_id,source_ref,status,fields",
            "source_id": f"eq.{bgmea_id}",
            "status": "eq.active",
        },
    )
    bkmea_all = rest.all_rows(
        "source_records",
        {
            "select": "id,supplier_id,source_ref,status,fields",
            "source_id": f"eq.{bkmea_id}",
        },
    )

    # Name-based BGMEA stowaway scan (general: only), matching BGMEA_RECORDS_SQL.
    bgmea_name_rows: list[dict] = []
    for r in bgmea_all:
        if not (r.get("source_ref") or "").startswith("general:"):
            continue
        sup = suppliers.get(r["supplier_id"]) or {}
        fields = r.get("fields") or {}
        bgmea_name_rows.append(
            {
                "record_id": r["id"],
                "supplier_id": r["supplier_id"],
                "source_ref": r["source_ref"],
                "scraped_name": fields.get("scraped_company_name"),
                "member_type": fields.get("bgmea_member_type"),
                "reg_number": fields.get("bgmea_reg_number"),
                "company_name": sup.get("company_name"),
                "slug": sup.get("slug"),
                "entity_type": sup.get("entity_type"),
            }
        )

    # Name-based BKMEA multi-membership (mirrors MERGED_SUPPLIERS_SQL).
    bkmea_recs: list[dict] = []
    for r in bkmea_all:
        fields = r.get("fields") or {}
        mno = fields.get("bkmea_membership_no")
        if not mno:
            continue
        base_no = str(mno).split("-", 1)[0].strip()
        if not base_no:
            continue
        bkmea_recs.append(
            {
                "record_id": r["id"],
                "supplier_id": r["supplier_id"],
                "source_ref": r["source_ref"],
                "scraped_name": (fields.get("bkmea_raw_kv") or {}).get("Factory Name")
                if isinstance(fields.get("bkmea_raw_kv"), dict)
                else None,
                "base_no": base_no,
                "membership_no": mno,
            }
        )
    by_sup_bases: dict[str, set[str]] = defaultdict(set)
    for r in bkmea_recs:
        by_sup_bases[r["supplier_id"]].add(r["base_no"])
    multi_bases = {sid for sid, bases in by_sup_bases.items() if len(bases) > 1}
    bkmea_name_rows: list[dict] = []
    for r in bkmea_recs:
        if r["supplier_id"] not in multi_bases:
            continue
        sup = suppliers.get(r["supplier_id"]) or {}
        bkmea_name_rows.append(
            {
                **r,
                "company_name": sup.get("company_name"),
                "slug": sup.get("slug"),
            }
        )

    structural_rows: list[dict] = []
    for code, rows in (("BGMEA", bgmea_all), ("BKMEA", bkmea_all)):
        for r in rows:
            if r.get("status") != "active":
                continue
            if not is_member_ref(code, r.get("source_ref")):
                continue
            sup = suppliers.get(r["supplier_id"]) or {}
            structural_rows.append(
                {
                    "supplier_id": r["supplier_id"],
                    "source_code": code,
                    "source_ref": r["source_ref"],
                    "status": r["status"],
                    "company_name": sup.get("company_name"),
                    "slug": sup.get("slug"),
                    "entity_type": sup.get("entity_type"),
                }
            )

    # REZ-115 stored-identity scan (client-side equivalent of BGMEA_IDENTITY_SQL).
    from etl.core.bgmea_identity import parse_identity

    by_ident: dict[str, list[dict]] = defaultdict(list)
    for sid, sup in suppliers.items():
        if not sup.get("is_published"):
            continue
        for raw in sup.get("bgmea_reg_numbers") or []:
            ident = str(raw)
            by_ident[ident].append(
                {"supplier_id": sid, "slug": sup.get("slug"), "company_name": sup.get("company_name")}
            )
    identity_rows: list[dict] = []
    for ident, holders in sorted(by_ident.items()):
        bare = parse_identity(ident) is None
        if bare or len(holders) > 1:
            identity_rows.append(
                {
                    "identity": ident,
                    "holders": len(holders),
                    "supplier_ids": [h["supplier_id"] for h in holders],
                    "slugs": [h.get("slug") for h in holders],
                    "bare_or_malformed": bare,
                }
            )

    # Display collisions require the view; skip on REST (psycopg path covers it).
    display_rows: list[dict] = []
    return bkmea_name_rows, bgmea_name_rows, structural_rows, identity_rows, display_rows


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--quiet", action="store_true", help="print only when the check fails")
    parser.add_argument(
        "--rest",
        action="store_true",
        help="read via Supabase REST (use when the Postgres pooler is unreachable)",
    )
    args = parser.parse_args()

    try:
        if args.rest:
            (
                bkmea_name_rows,
                bgmea_rows,
                structural_rows,
                identity_rows,
                display_rows,
            ) = _load_via_rest()
        else:
            dsn = os.environ.get("SUPABASE_DB_URL")
            if not dsn:
                print("ERROR: SUPABASE_DB_URL not set (or pass --rest)", file=sys.stderr)
                return 2
            (
                bkmea_name_rows,
                bgmea_rows,
                structural_rows,
                identity_rows,
                display_rows,
            ) = _load_via_psycopg(dsn)
    except Exception as exc:  # noqa: BLE001
        # A check that cannot run is not a passing check.
        print(f"ERROR: could not query suppliers: {exc}", file=sys.stderr)
        return 2

    by_supplier: dict[str, list[dict]] = defaultdict(list)
    for row in bkmea_name_rows:
        by_supplier[str(row["supplier_id"])].append(row)

    conflated: list[str] = []
    undecidable = 0

    for supplier_id, supplier_rows in by_supplier.items():
        groups: dict[str, list[dict]] = defaultdict(list)
        for row in supplier_rows:
            groups[row["base_no"]].append(row)

        clashes = _conflated_names(groups)
        if clashes:
            company = supplier_rows[0]["company_name"]
            pairs = "; ".join(f"{a!r} vs {b!r}" for a, b in clashes)
            conflated.append(f"  {company}  [{supplier_id}]\n      {pairs}")
        elif any(not r["scraped_name"] for r in supplier_rows):
            undecidable += 1

    bgmea_stowaways: list[str] = []
    bgmea_unnamed = 0
    for row in bgmea_rows:
        if not row["scraped_name"]:
            bgmea_unnamed += 1
            continue
        if not _host_record_compatible(row["company_name"], row["scraped_name"]):
            bgmea_stowaways.append(
                f"  {row['scraped_name']!r} ({row['source_ref']}) sits on "
                f"{row['company_name']!r} [{row['supplier_id']}]"
            )

    multi_findings = find_multi_member_refs(structural_rows)
    multi_lines = [
        f"  {f.company_name}  [{f.supplier_id}] {f.source_code} "
        f"refs={list(f.source_refs)} (excess={f.excess})"
        for f in multi_findings
    ]
    multi_excess = sum(f.excess for f in multi_findings)

    bare_lines = [
        f"  {r['identity']!r} on {r['slugs']} [{r['supplier_ids']}]"
        for r in identity_rows
        if r.get("bare_or_malformed")
    ]
    stored_collision_lines = [
        f"  {r['identity']!r} shared by {r['holders']} published: {r['slugs']}"
        for r in identity_rows
        if not r.get("bare_or_malformed") and int(r.get("holders") or 0) > 1
    ]
    display_collision_lines = [
        f"  {r['label']} {r['value']} shared by {r['holders']}: {r['supplier_ids']}"
        for r in display_rows
    ]

    # REZ-116: founder-decided orphan moves / HOLD — never guess; never land
    # HOLD 1168 on p-fashion; each MOVE ref may only sit on from_slug (pre-apply)
    # or to_slug (post-apply).
    from ops.move_bgmea_orphan_registrations import rez116_decision_violations

    ref_holders: dict[str, set[str]] = defaultdict(set)
    for row in structural_rows:
        if row.get("source_code") != "BGMEA":
            continue
        ref = str(row.get("source_ref") or "")
        slug = str(row.get("slug") or "")
        if ref and slug:
            ref_holders[ref].add(slug)
    for row in bgmea_rows:
        ref = str(row.get("source_ref") or "")
        slug = str(row.get("slug") or "")
        if ref and slug:
            ref_holders[ref].add(slug)

    rez116_lines = rez116_decision_violations(ref_holders)

    from ops.apply_rez117_ambiguous_decisions import (
        rez117_associate_on_factory_violations,
        rez117_buying_house_tag_violations,
        rez117_decision_violations,
    )

    rez117_lines = rez117_decision_violations(ref_holders)
    entity_by_slug: dict[str, str] = {}
    member_type_by_ref: dict[str, str] = {}
    for row in structural_rows:
        slug = str(row.get("slug") or "")
        et = row.get("entity_type")
        if slug and et:
            entity_by_slug[slug] = str(et)
        ref = str(row.get("source_ref") or "")
        fields = row.get("fields") or {}
        if isinstance(fields, dict) and ref:
            mt = fields.get("bgmea_member_type")
            if mt:
                member_type_by_ref[ref] = str(mt)
        # bare associate refs have no "general:" prefix
        if ref and not ref.startswith("general:") and ref not in member_type_by_ref:
            member_type_by_ref[ref] = "associate"
    for row in bgmea_rows:
        slug = str(row.get("slug") or "")
        et = row.get("entity_type")
        if slug and et:
            entity_by_slug[slug] = str(et)
        ref = str(row.get("source_ref") or "")
        mt = row.get("member_type")
        if ref and mt:
            member_type_by_ref[ref] = str(mt)
    rez117_tag_lines = rez117_buying_house_tag_violations(ref_holders, entity_by_slug)
    rez117_assoc_factory_lines = rez117_associate_on_factory_violations(
        ref_holders, entity_by_slug, member_type_by_ref
    )

    failed = False
    if conflated:
        failed = True
        print(
            f"FAIL: {len(conflated)} supplier(s) hold BKMEA records for more than one company.\n"
            f"Repair with: python ops/unmerge_bkmea_suppliers.py  (dry run first)\n"
        )
        print("\n".join(conflated))
    if bgmea_stowaways:
        failed = True
        print(
            f"FAIL: {len(bgmea_stowaways)} BGMEA record(s) sit on a different company's supplier.\n"
            f"Repair with: python ops/repair_bgmea_conflations.py  (dry run first)\n"
        )
        print("\n".join(bgmea_stowaways))
    if multi_findings:
        failed = True
        print(
            f"FAIL: {len(multi_findings)} supplier(s) hold multiple distinct member refs "
            f"from the same register ({multi_excess} excess refs).\n"
            f"Signal class: multi_member_ref (structural — no name comparison). "
            f"Plan only — see ops/plans/rez-88-multi-ref-plan.md. Do not mutate.\n"
        )
        print("\n".join(multi_lines))
    if bare_lines:
        failed = True
        print(
            f"FAIL: {len(bare_lines)} published BGMEA identity value(s) lack a register "
            f"(REZ-115 — bare digits are not identities).\n"
            f"Repair with: python ops/backfill_bgmea_reg_identities.py\n"
        )
        print("\n".join(bare_lines[:50]))
    if stored_collision_lines:
        failed = True
        print(
            f"FAIL: {len(stored_collision_lines)} BGMEA register+number identities "
            f"are held by more than one published supplier (REZ-115).\n"
        )
        print("\n".join(stored_collision_lines[:50]))
    if display_collision_lines:
        failed = True
        print(
            f"FAIL: {len(display_collision_lines)} BGMEA display pills still collide "
            f"across published suppliers (REZ-115 view).\n"
        )
        print("\n".join(display_collision_lines[:50]))
    if rez116_lines:
        failed = True
        print(
            f"FAIL: {len(rez116_lines)} REZ-116 orphan-decision invariant(s) broken "
            f"(founder MOVE/HOLD table in ops/move_bgmea_orphan_registrations.py).\n"
        )
        print("\n".join(rez116_lines))
    if rez117_lines:
        failed = True
        print(
            f"FAIL: {len(rez117_lines)} REZ-117 ambiguous-decision invariant(s) broken "
            f"(founder table in ops/apply_rez117_ambiguous_decisions.py).\n"
        )
        print("\n".join(rez117_lines))
    if rez117_tag_lines:
        failed = True
        print(
            f"FAIL: {len(rez117_tag_lines)} REZ-117 buying-house tag invariant(s) broken "
            f"(associate destinations must be entity_type=buying_house).\n"
        )
        print("\n".join(rez117_tag_lines))
    if rez117_assoc_factory_lines:
        failed = True
        print(
            f"FAIL: {len(rez117_assoc_factory_lines)} REZ-117 associate-on-factory "
            f"invariant(s) broken (not in founder allowlist).\n"
        )
        print("\n".join(rez117_assoc_factory_lines))
    if failed:
        return 1

    if not args.quiet:
        print(
            f"OK: no supplier holds BKMEA records for two different companies "
            f"({len(by_supplier)} supplier(s) carry multiple membership numbers; "
            f"{undecidable} of those have records with no scraped name to check), "
            f"no named BGMEA record sits on the wrong supplier "
            f"({len(bgmea_rows)} BGMEA records scanned; {bgmea_unnamed} not yet "
            f"named — pre-4-Aug scrapes, checkable after the next bgmea_web run), "
            f"no supplier holds multiple distinct same-register member refs "
            f"(structural multi_member_ref clean), "
            f"and no published BGMEA bare/colliding identities "
            f"(REZ-115 identity scan clean)."
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
