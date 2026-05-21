"""Spec 16 cleanup: fix 5 BTMA general-member rows that Pass-3 phone-overlap
falsely matched to sibling mills sharing HQ phones (parent-group artifact).

For each of {132, 184, 216, 227, 249}:
  * Delete the two existing wrong BTMA source_records.
  * Remove BTMA tag from sibling suppliers if no remaining BTMA source_records.
  * Build the correct ScrapedRecord from the raw JSON and INSERT a fresh
    supplier directly (bypassing the framework's phone-overlap dedup that
    would re-match wrongly). Also write the BTMA source_record.

Idempotent: re-running just no-ops if the target supplier slug already exists.
"""
from __future__ import annotations

from etl.core.db import db, get_source_id
from etl.core.normalize import make_slug, normalize_company_name, normalize_phones
from etl.scrapers.btma_spinning import _Row, _row_to_record, DEFAULT_DATA_DIR, _iter_rows

TARGETS = {
    ("General Member", "132"),
    ("General Member", "184"),
    ("General Member", "216"),
    ("General Member", "227"),
    ("General Member", "249"),
}


def main() -> None:
    # Load the canonical records from raw JSON for the 5 targets.
    records = []
    for row in _iter_rows(DEFAULT_DATA_DIR):
        if (row.section, row.sl_no) in TARGETS:
            records.append(_row_to_record(row))
    assert len(records) == 5, f"expected 5 target rows, found {len(records)}"

    btma_src_id = get_source_id("BTMA")

    with db.conn() as c, c.cursor() as cur:
        for rec in records:
            print(f"=== {rec.source_ref} -> {rec.company_name!r} ===")

            # 1. Find existing wrong source_records.
            cur.execute(
                """select sr.id, sr.supplier_id, s.company_name, s.source_tags
                     from public.source_records sr
                     join public.suppliers s on s.id = sr.supplier_id
                    where sr.source_id = %s and sr.source_ref = %s""",
                (btma_src_id, rec.source_ref),
            )
            wrong = cur.fetchall()
            for w in wrong:
                print(f"  wrong sr={w['id']} on supplier={w['supplier_id']} "
                      f"name={w['company_name']!r}")

            # 2. Delete the wrong source_records.
            for w in wrong:
                cur.execute("delete from public.source_records where id = %s", (w["id"],))

            # 3. For each wrong supplier, drop BTMA tag if no remaining BTMA source_records.
            for w in wrong:
                sup_id = w["supplier_id"]
                cur.execute(
                    "select count(*) as n from public.source_records "
                    "where supplier_id = %s and source_id = %s",
                    (sup_id, btma_src_id),
                )
                if cur.fetchone()["n"] == 0:
                    cur.execute(
                        "update public.suppliers "
                        "set source_tags = array_remove(source_tags, 'BTMA') "
                        "where id = %s",
                        (sup_id,),
                    )
                    print(f"  untagged BTMA from {sup_id}")

            # 4. Insert correct supplier (or no-op if slug exists).
            slug = make_slug(rec.company_name)
            norm = normalize_company_name(rec.company_name)
            phones = normalize_phones(rec.phone_raw)
            email = (rec.email or "").strip().lower() or None

            cur.execute("select id from public.suppliers where slug = %s", (slug,))
            existing = cur.fetchone()
            if existing:
                supplier_id = str(existing["id"])
                print(f"  supplier already exists slug={slug!r} id={supplier_id}")
                cur.execute(
                    "update public.suppliers set source_tags = ("
                    "  select array(select distinct unnest("
                    "    coalesce(source_tags,'{}'::text[]) || ARRAY['BTMA']::text[]"
                    "  ))"
                    ") where id = %s",
                    (supplier_id,),
                )
            else:
                cur.execute(
                    """insert into public.suppliers
                         (slug, company_name, company_name_norm, entity_type,
                          contact_name, contact_role, email_primary, phones, website,
                          address_raw, city, district, source_tags)
                       values (%s,%s,%s,'factory',%s,%s,%s,%s,%s,%s,%s,%s, ARRAY['BTMA'])
                       returning id""",
                    (
                        slug, rec.company_name, norm,
                        rec.contact_name, rec.contact_role, email, phones, rec.website,
                        rec.address_raw, rec.city, rec.district,
                    ),
                )
                supplier_id = str(cur.fetchone()["id"])
                print(f"  inserted supplier id={supplier_id}")

            # 5. Write the BTMA source_record onto the correct supplier.
            import json as _json
            cur.execute(
                """insert into public.source_records
                     (supplier_id, source_id, source_tier, source_ref, fields, raw_hash, status)
                   values (%s,%s,'tier2_industry',%s,%s::jsonb,%s,'active')
                   on conflict (supplier_id, source_id, source_ref) do update set
                     fields = coalesce(public.source_records.fields, '{}'::jsonb) || excluded.fields,
                     raw_hash = excluded.raw_hash,
                     fetched_at = now(),
                     status = 'active'""",
                (
                    supplier_id, btma_src_id, rec.source_ref,
                    _json.dumps(rec.payload, ensure_ascii=False, default=str),
                    rec.hash(),
                ),
            )
            # 6. Refresh completeness.
            cur.execute(
                "update public.suppliers set completeness_pct = "
                "public.compute_completeness(%s) where id = %s",
                (supplier_id, supplier_id),
            )

        c.commit()
    print("done.")


if __name__ == "__main__":
    main()
