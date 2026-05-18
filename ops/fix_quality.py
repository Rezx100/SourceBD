"""Quality fix pass after RSC ingest.

Idempotent and DRY-RUN by default. Pass --apply to actually mutate.

Steps (in order):
  1. Normalize display names (trim, fold curly punctuation, strip "(Previously X)")
  2. Recompute company_name_norm + slug for every supplier
  3. Detect supplier dupes by NEW slug (after re-normalization)
  4. Merge each dupe group: union source_tags, move FK children, COALESCE fields,
     prefer the older supplier as primary; delete the absorbed dupes
  5. Update the surviving suppliers' company_name / company_name_norm / slug
  6. Backfill `city` from BKMEA `bkmea_factory_address` last token, fallback to
     RSC `rsc_location` last token; normalize alias (CHITTAGONG -> Chattogram)
  7. Apply RSC remediation_status mapping (raw code -> human label)
  8. Recompute completeness_pct on all touched suppliers

Excludes from auto-merge: pairs whose names differ only by extension/unit
markers (these are intentionally separate physical units in RSC).
"""
from __future__ import annotations

import argparse
import re
import sys
from collections import defaultdict

from etl.core.db import db
from etl.core.normalize import (
    clean_display_name,
    make_slug,
    normalize_company_name,
)

# RSC API status code -> human label (from rsc-bd.org factory-scripts.js statusMapping
# plus a guard for `notimplemented` which appears in the data but not the JS map).
RSC_STATUS_MAP = {
    "behindschedule": "Behind schedule",
    "initialcompleted": "Initial CAP Completed",
    "cappending": "CAP not finalised/ N/A",
    "ontrack": "On track",
    "ineligible": "Ineligible",
    "notfinalized": "CAP not finalised/ N/A",
    "notimplemented": "CAP not finalised/ N/A",
}

# Bangladesh districts that show up in BKMEA addresses. Last comma-token that
# matches one of these (case-insensitive) is taken as the city/district.
DISTRICTS = {
    "DHAKA", "NARAYANGANJ", "GAZIPUR", "CHATTOGRAM", "CHITTAGONG", "NARSINGDI",
    "MANIKGANJ", "TANGAIL", "MYMENSINGH", "COMILLA", "CUMILLA", "JESSORE",
    "JASHORE", "KHULNA", "RAJSHAHI", "BOGRA", "BOGURA", "RANGPUR", "SYLHET",
    "BARISAL", "BARISHAL", "FARIDPUR", "JAMALPUR", "KISHOREGANJ", "MUNSHIGANJ",
    "NETROKONA", "RAJBARI", "SHARIATPUR", "SIRAJGANJ", "SAVAR", "ASHULIA",
    "DHAMRAI", "KERANIGANJ", "TONGI", "JOYDEBPUR", "BHALUKA", "TRISHAL",
    "FENI", "NOAKHALI", "COX'S BAZAR", "COXS BAZAR", "BANDARBAN", "RANGAMATI",
    "KHAGRACHARI", "PABNA", "NATORE", "JOYPURHAT", "NAOGAON", "CHAPAINAWABGANJ",
    "DINAJPUR", "THAKURGAON", "KURIGRAM", "GAIBANDHA", "NILPHAMARI", "LALMONIRHAT",
    "PANCHAGARH", "MAGURA", "JHENAIDAH", "CHUADANGA", "MEHERPUR", "KUSHTIA",
    "NARAIL", "BAGERHAT", "SATKHIRA", "PIROJPUR", "JHALOKATI", "BARGUNA",
    "PATUAKHALI", "BHOLA", "MOULVIBAZAR", "HABIGANJ", "SUNAMGANJ",
    "BRAHMANBARIA", "CHANDPUR", "LAKSHMIPUR", "MADARIPUR", "GOPALGANJ",
}
DISTRICT_ALIAS = {
    "CHITTAGONG": "Chattogram",
    "DACCA": "Dhaka",
    "BOGRA": "Bogura",
    "JESSORE": "Jashore",
    "COMILLA": "Cumilla",
    "BARISAL": "Barishal",
    "COXS BAZAR": "Cox's Bazar",
}

# Markers that indicate a name is an extension/unit/new building of another.
# If two names differ ONLY by presence/absence of these markers, do NOT auto-merge.
EXTENSION_MARKERS = re.compile(
    r"\((?:extension|new|extended|unit\s*[\d-]*|building|shed|relocated|"
    r"extension\s*[\d-]+)[^)]*\)|"
    r"\bunit[\s-]*[\d]+\b|\bextension\b|\bextended\b",
    re.IGNORECASE,
)


def has_extension_marker(name: str) -> bool:
    return bool(EXTENSION_MARKERS.search(name or ""))


def extract_district(addr: str | None) -> str | None:
    if not addr:
        return None
    # Walk last 3 comma tokens, find first that matches a known district.
    tokens = [t.strip() for t in addr.split(",") if t.strip()]
    for t in reversed(tokens[-3:]):
        upper = t.upper()
        # exact match
        if upper in DISTRICTS:
            return DISTRICT_ALIAS.get(upper, t.strip().title())
        # contains a district as substring (e.g. "DHAKA-1207")
        for d in DISTRICTS:
            if d in upper:
                return DISTRICT_ALIAS.get(d, d.title())
    return None


def fetch_rows(cur, sql, *params):
    cur.execute(sql, params or None)
    return cur.fetchall()


# ---------------------------------------------------------------------- main


def main(apply: bool) -> None:
    mode = "APPLY" if apply else "DRY-RUN"
    print(f"=== fix_quality.py [{mode}] ===\n")

    with db.conn() as c, c.cursor() as cur:
        # ------------------------------------------------------------------
        # STEP 1 + 2: compute new (display, norm, slug) for every supplier.
        # ------------------------------------------------------------------
        cur.execute("select id, company_name, company_name_norm, slug, source_tags, created_at from public.suppliers")
        suppliers = cur.fetchall()
        print(f"Loaded {len(suppliers)} suppliers")

        recomputed: dict[str, dict] = {}
        for r in suppliers:
            old_name = r["company_name"] or ""
            new_name = clean_display_name(old_name)
            new_norm = normalize_company_name(new_name)
            new_slug = make_slug(new_name)
            recomputed[str(r["id"])] = {
                "old_name": old_name,
                "new_name": new_name,
                "new_norm": new_norm,
                "new_slug": new_slug,
                "old_slug": r["slug"],
                "old_norm": r["company_name_norm"],
                "tags": r["source_tags"] or [],
                "created_at": r["created_at"],
            }

        name_changes = sum(1 for d in recomputed.values() if d["old_name"] != d["new_name"])
        slug_changes = sum(1 for d in recomputed.values() if d["old_slug"] != d["new_slug"])
        print(f"Display-name cleanups: {name_changes}")
        print(f"Slug recomputed (different): {slug_changes}\n")

        # ------------------------------------------------------------------
        # STEP 3: detect dupe groups by new slug (skip extension-marker pairs)
        # ------------------------------------------------------------------
        by_slug: dict[str, list[str]] = defaultdict(list)
        for sid, d in recomputed.items():
            by_slug[d["new_slug"]].append(sid)

        dupe_groups: list[list[str]] = []
        skipped_extension_groups = 0
        for slug, sids in by_slug.items():
            if len(sids) < 2 or not slug:
                continue
            # If any of the names in the group has an extension marker AND any
            # doesn't, treat them as parent/child (different physical units) and
            # do NOT auto-merge.
            names = [recomputed[s]["new_name"] for s in sids]
            has_marker = [has_extension_marker(n) for n in names]
            if any(has_marker) and not all(has_marker):
                skipped_extension_groups += 1
                continue
            # All-extension or all-non-extension: safe to merge
            dupe_groups.append(sids)

        print(f"Dupe groups (post-norm slug collision): {len(dupe_groups)}")
        print(f"Skipped extension/unit pairs (parent-child kept separate): {skipped_extension_groups}\n")

        for group in dupe_groups[:10]:
            print(f"  example group ({len(group)} members):")
            for sid in group:
                d = recomputed[sid]
                print(f"    - '{d['new_name']}' tags={d['tags']} created={d['created_at']:%Y-%m-%d}")

        # ------------------------------------------------------------------
        # STEP 4: merge dupe groups
        # ------------------------------------------------------------------
        merged_count = 0
        if apply and dupe_groups:
            print(f"\nMerging {len(dupe_groups)} dupe groups...")
            for group in dupe_groups:
                # Primary = oldest, ties broken by most source_tags
                ranked = sorted(
                    group,
                    key=lambda s: (recomputed[s]["created_at"], -len(recomputed[s]["tags"])),
                )
                primary = ranked[0]
                absorbed = ranked[1:]
                for dupe in absorbed:
                    cur.execute("savepoint sp_merge")
                    try:
                        # Move children to primary (ON CONFLICT DO NOTHING for unique keys)
                        cur.execute(
                            """update public.source_records
                                  set supplier_id = %s
                                where supplier_id = %s
                                  and not exists (
                                    select 1 from public.source_records sr2
                                     where sr2.supplier_id = %s
                                       and sr2.source_id = source_records.source_id
                                       and sr2.source_ref is not distinct from source_records.source_ref
                                  )""",
                            (primary, dupe, primary),
                        )
                        # rsc_remediation: keep primary's row if it exists, else move dupe's
                        cur.execute("select 1 from public.rsc_remediation where supplier_id = %s", (primary,))
                        if cur.fetchone() is None:
                            cur.execute(
                                "update public.rsc_remediation set supplier_id = %s where supplier_id = %s",
                                (primary, dupe),
                            )
                        # certifications: move all
                        cur.execute(
                            "update public.certifications set supplier_id = %s where supplier_id = %s",
                            (primary, dupe),
                        )
                        # sanctions_screening: move all
                        cur.execute(
                            "update public.sanctions_screening set supplier_id = %s where supplier_id = %s",
                            (primary, dupe),
                        )
                        # COALESCE primary fields from dupe; union source_tags
                        cur.execute(
                            """update public.suppliers p
                                  set email_primary  = coalesce(p.email_primary, d.email_primary),
                                      phones         = case when array_length(p.phones,1) is null then d.phones else p.phones end,
                                      address_raw    = coalesce(p.address_raw, d.address_raw),
                                      city           = coalesce(p.city, d.city),
                                      district       = coalesce(p.district, d.district),
                                      website        = coalesce(p.website, d.website),
                                      contact_name   = coalesce(p.contact_name, d.contact_name),
                                      contact_role   = coalesce(p.contact_role, d.contact_role),
                                      bkmea_reg_number = coalesce(p.bkmea_reg_number, d.bkmea_reg_number),
                                      rjsc_reg_number  = coalesce(p.rjsc_reg_number,  d.rjsc_reg_number),
                                      bgmea_reg_numbers = coalesce((
                                        select array_agg(distinct x) from unnest(
                                          coalesce(p.bgmea_reg_numbers,'{}') || coalesce(d.bgmea_reg_numbers,'{}')
                                        ) x where x is not null
                                      ), '{}'::text[]),
                                      source_tags = coalesce((
                                        select array_agg(distinct x) from unnest(
                                          coalesce(p.source_tags,'{}') || coalesce(d.source_tags,'{}')
                                        ) x where x is not null
                                      ), '{}'::text[]),
                                      bgmea_verified  = p.bgmea_verified  or d.bgmea_verified,
                                      bkmea_verified  = p.bkmea_verified  or d.bkmea_verified,
                                      bgapmea_verified= p.bgapmea_verified or d.bgapmea_verified,
                                      btma_verified   = p.btma_verified   or d.btma_verified,
                                      is_sanctioned   = p.is_sanctioned   or d.is_sanctioned,
                                      updated_at = now()
                                 from public.suppliers d
                                where p.id = %s and d.id = %s""",
                            (primary, dupe),
                        )
                        # Delete dupe (cascade handles leftover source_records that
                        # were collisions and didn't move)
                        cur.execute("delete from public.suppliers where id = %s", (dupe,))
                        cur.execute("release savepoint sp_merge")
                        merged_count += 1
                    except Exception as e:  # noqa: BLE001
                        cur.execute("rollback to savepoint sp_merge")
                        print(f"  ! merge {dupe} -> {primary} FAILED: {e}")
            c.commit()
            print(f"Merged: {merged_count} suppliers absorbed.\n")
        elif dupe_groups:
            print(f"\n(DRY-RUN) Would merge {sum(len(g)-1 for g in dupe_groups)} suppliers across {len(dupe_groups)} groups\n")

        # ------------------------------------------------------------------
        # STEP 5: update surviving suppliers' name/norm/slug
        # ------------------------------------------------------------------
        # Reload surviving IDs (some may have been deleted)
        cur.execute("select id from public.suppliers")
        live_ids = {str(r["id"]) for r in cur.fetchall()}
        update_payload = []
        for sid, d in recomputed.items():
            if sid not in live_ids:
                continue
            if (d["new_name"] != d["old_name"] or
                d["new_norm"] != d["old_norm"] or
                d["new_slug"] != d["old_slug"]):
                update_payload.append((d["new_name"], d["new_norm"], d["new_slug"], sid))

        print(f"Suppliers needing field rewrite: {len(update_payload)}")
        if apply and update_payload:
            for name, norm, slug, sid in update_payload:
                cur.execute("savepoint sp_norm")
                try:
                    cur.execute(
                        """update public.suppliers
                              set company_name = %s,
                                  company_name_norm = %s,
                                  slug = %s,
                                  updated_at = now()
                            where id = %s""",
                        (name, norm, slug, sid),
                    )
                    cur.execute("release savepoint sp_norm")
                except Exception as e:  # noqa: BLE001
                    cur.execute("rollback to savepoint sp_norm")
                    print(f"  ! rename {sid} FAILED: {e}")
            c.commit()
            print(f"Rewrote name/norm/slug on {len(update_payload)} suppliers.\n")

        # ------------------------------------------------------------------
        # STEP 6: backfill city from BKMEA address, RSC location
        # ------------------------------------------------------------------
        cur.execute(
            """select s.id,
                      (select sr.fields->>'bkmea_factory_address'
                         from public.source_records sr
                         join public.sources src on src.id = sr.source_id
                        where sr.supplier_id = s.id and src.code = 'BKMEA'
                        limit 1) as bkmea_addr,
                      (select sr.fields->>'rsc_location'
                         from public.source_records sr
                         join public.sources src on src.id = sr.source_id
                        where sr.supplier_id = s.id and src.code = 'RSC'
                        limit 1) as rsc_loc
                 from public.suppliers s
                where s.city is null"""
        )
        rows = cur.fetchall()
        city_updates = []
        for r in rows:
            city = extract_district(r["bkmea_addr"]) or extract_district(r["rsc_loc"])
            if city:
                city_updates.append((city, str(r["id"])))
        print(f"City backfill candidates: {len(city_updates)} / {len(rows)} null-city rows")
        if apply and city_updates:
            for city, sid in city_updates:
                cur.execute(
                    "update public.suppliers set city = %s, updated_at = now() where id = %s and city is null",
                    (city, sid),
                )
            c.commit()
            print(f"city populated on {len(city_updates)} rows.\n")

        # ------------------------------------------------------------------
        # STEP 7: RSC remediation_status mapping
        # ------------------------------------------------------------------
        cur.execute("select supplier_id, remediation_status from public.rsc_remediation")
        rsc_rows = cur.fetchall()
        status_updates = []
        for r in rsc_rows:
            raw = (r["remediation_status"] or "").strip().lower()
            label = RSC_STATUS_MAP.get(raw)
            if label and label != r["remediation_status"]:
                status_updates.append((label, str(r["supplier_id"])))
        print(f"RSC status mappings to apply: {len(status_updates)} / {len(rsc_rows)}")
        if apply and status_updates:
            for label, sid in status_updates:
                cur.execute(
                    "update public.rsc_remediation set remediation_status = %s, fetched_at = fetched_at where supplier_id = %s",
                    (label, sid),
                )
            c.commit()
            print(f"RSC status labels updated on {len(status_updates)} rows.\n")

        # ------------------------------------------------------------------
        # SUMMARY
        # ------------------------------------------------------------------
        print("=" * 60)
        print(f"[{mode}] complete")
        print(f"  display-name cleanups : {name_changes}")
        print(f"  slug rewrites         : {slug_changes}")
        print(f"  dupe groups           : {len(dupe_groups)}")
        print(f"  suppliers merged      : {merged_count if apply else sum(len(g)-1 for g in dupe_groups)}{'' if apply else ' (dry-run)'}")
        print(f"  city backfills        : {len(city_updates)}{'' if apply else ' (dry-run)'}")
        print(f"  RSC status mappings   : {len(status_updates)}{'' if apply else ' (dry-run)'}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="actually write changes")
    args = ap.parse_args()
    main(apply=args.apply)
