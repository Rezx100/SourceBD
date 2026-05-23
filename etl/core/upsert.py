"""Idempotent supplier + source_record upsert.

Strategy:
  0. If a source_record already exists for (source_code, source_ref), return its
     supplier_id directly. This guarantees deterministic self-source idempotency:
     re-ingesting the same scraper never remaps a row to a different supplier,
     even when Pass 3 phone-overlap would otherwise pick an ambiguous sibling.
  1. Match against existing suppliers via slug -> email -> phone -> fuzzy name (spec §4.2).
  2. If matched, ENRICH (never overwrite non-null with null, add source_tag).
  3. If not matched, INSERT new supplier.
  4. Upsert source_records row keyed on (supplier_id, source_id, source_ref).
  5. After insert/enrich, set is_published = true ONLY if Tier 1-3 source exists
     (the DB trigger enforces this; we just attempt and swallow violation).
"""
from __future__ import annotations

from typing import Any

from rapidfuzz import fuzz, process

from etl.core.db import db, get_source_id
from etl.core.logging import get_logger
from etl.core.normalize import make_slug, normalize_company_name, normalize_phones
from etl.core.scraper import ScrapedRecord

log = get_logger("etl.upsert")

_FUZZY_THRESHOLD = 92  # rapidfuzz returns 0-100


def upsert_supplier_with_source(rec: ScrapedRecord) -> str:
    """Returns supplier_id (uuid as str)."""
    slug = make_slug(rec.company_name)
    norm = normalize_company_name(rec.company_name)
    phones = normalize_phones(rec.phone_raw)
    email = (rec.email or "").strip().lower() or None

    with db.conn() as c, c.cursor() as cur:
        supplier_id = _find_existing(
            cur, slug=slug, norm=norm, email=email, phones=phones,
            source_code=rec.source_code, source_ref=rec.source_ref,
        )

        if supplier_id is None:
            supplier_id = _insert_supplier(
                cur, slug=slug, norm=norm, email=email, phones=phones, rec=rec
            )
            log.info("supplier.created", supplier_id=supplier_id, name=rec.company_name,
                     source=rec.source_code, ref=rec.source_ref)
        else:
            _enrich_supplier(cur, supplier_id=supplier_id, email=email, phones=phones, rec=rec)
            log.info("supplier.enriched", supplier_id=supplier_id, source=rec.source_code,
                     ref=rec.source_ref)

        _upsert_source_record(cur, supplier_id=supplier_id, rec=rec)
        _apply_source_specific(cur, supplier_id=supplier_id, rec=rec)
        _maybe_publish(cur, supplier_id)
        _refresh_completeness(cur, supplier_id)
        c.commit()

    return supplier_id


# -----------------------------------------------------------------------------
def _find_existing(
    cur, *, slug: str, norm: str, email: str | None, phones: list[str],
    source_code: str | None = None, source_ref: str | None = None,
) -> str | None:
    # Pass 0: self-source idempotency. If we have already ingested this exact
    # (source_id, source_ref), reuse the same supplier_id deterministically.
    if source_code and source_ref:
        src_id = get_source_id(source_code)
        cur.execute(
            "select supplier_id from public.source_records "
            "where source_id = %s and source_ref = %s "
            "order by fetched_at asc limit 1",
            (src_id, source_ref),
        )
        row = cur.fetchone()
        if row:
            return str(row["supplier_id"])

    # Pass 1: slug
    cur.execute("select id from public.suppliers where slug = %s", (slug,))
    row = cur.fetchone()
    if row:
        return str(row["id"])

    # Pass 2: email
    if email:
        cur.execute("select id from public.suppliers where email_primary = %s", (email,))
        row = cur.fetchone()
        if row:
            return str(row["id"])

    # Pass 3: phone overlap
    if phones:
        cur.execute("select id from public.suppliers where phones && %s::text[]", (phones,))
        row = cur.fetchone()
        if row:
            return str(row["id"])

    # Pass 4: fuzzy name (within trigram-prefiltered candidates)
    cur.execute(
        """select id, company_name_norm
             from public.suppliers
            where company_name_norm %% %s
            limit 50""",
        (norm,),
    )
    rows = cur.fetchall()
    if rows:
        choices = {str(r["id"]): r["company_name_norm"] for r in rows}
        match = process.extractOne(norm, choices, scorer=fuzz.token_sort_ratio)
        if match and match[1] >= _FUZZY_THRESHOLD:
            return match[2]
    return None


def _insert_supplier(
    cur, *, slug: str, norm: str, email: str | None, phones: list[str], rec: ScrapedRecord
) -> str:
    cur.execute(
        """insert into public.suppliers
             (slug, company_name, company_name_norm, entity_type,
              contact_name, contact_role, email_primary, phones, website,
              address_raw, city, district, source_tags)
           values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s, ARRAY[%s])
           returning id""",
        (
            slug, rec.company_name, norm,
            rec.entity_type or _entity_type_for(rec.source_code),
            rec.contact_name, rec.contact_role, email, phones, rec.website,
            rec.address_raw, rec.city, rec.district, rec.source_code,
        ),
    )
    return str(cur.fetchone()["id"])


def _enrich_supplier(
    cur, *, supplier_id: str, email: str | None, phones: list[str], rec: ScrapedRecord
) -> None:
    # Build COALESCE updates so we never overwrite non-null with null
    cur.execute(
        """update public.suppliers set
             contact_name  = coalesce(contact_name, %s),
             contact_role  = coalesce(contact_role, %s),
             email_primary = coalesce(email_primary, %s),
             phones        = (
               select array(select distinct unnest(coalesce(phones, '{}'::text[]) || %s::text[]))
             ),
             website       = coalesce(website, %s),
             address_raw   = coalesce(address_raw, %s),
             city          = coalesce(city, %s),
             district      = coalesce(district, %s),
             source_tags   = (
               select array(select distinct unnest(coalesce(source_tags, '{}'::text[]) || ARRAY[%s]::text[]))
             )
           where id = %s""",
        (
            rec.contact_name, rec.contact_role, email, phones,
            rec.website, rec.address_raw, rec.city, rec.district,
            rec.source_code, supplier_id,
        ),
    )


def _upsert_source_record(cur, *, supplier_id: str, rec: ScrapedRecord) -> None:
    src_id = get_source_id(rec.source_code)
    tier = _tier_for(rec.source_code)
    cur.execute(
        """insert into public.source_records
             (supplier_id, source_id, source_tier, source_ref, fields, raw_hash, status)
           values (%s,%s,%s,%s,%s::jsonb,%s,'active')
           on conflict (supplier_id, source_id, source_ref) do update set
             fields = coalesce(public.source_records.fields, '{}'::jsonb) || excluded.fields,
             raw_hash = excluded.raw_hash,
             fetched_at = now(),
             status = 'active'""",
        (
            supplier_id, src_id, tier, rec.source_ref,
            _to_jsonb(rec.payload), rec.hash(),
        ),
    )


def _apply_source_specific(cur, *, supplier_id: str, rec: ScrapedRecord) -> None:
    """Set register-specific verified flags + reg numbers, and upgrade
    entity_type='unknown' to the source's default when a Tier 1-2
    register attaches (BGMEA, BKMEA, BTMA, BGAPMEA, RSC, EPB)."""
    code = rec.source_code
    if code == "BGMEA":
        reg = rec.payload.get("bgmea_reg_number")
        if reg:
            cur.execute(
                """update public.suppliers set
                     bgmea_verified = true,
                     bgmea_reg_numbers = (
                       select array(select distinct unnest(
                         coalesce(bgmea_reg_numbers,'{}'::text[]) || ARRAY[%s]::text[]
                       ))
                     ),
                     entity_type = case when entity_type = 'unknown' then 'buying_house' else entity_type end
                   where id = %s""",
                (reg, supplier_id),
            )
    elif code == "BKMEA":
        reg = rec.payload.get("bkmea_reg_number")
        cur.execute(
            """update public.suppliers set
                 bkmea_verified = true,
                 bkmea_reg_number = coalesce(bkmea_reg_number, %s),
                 entity_type = case when entity_type = 'unknown' then 'factory' else entity_type end
               where id = %s""",
            (reg, supplier_id),
        )
    elif code == "BTMA":
        cur.execute(
            """update public.suppliers set
                 btma_verified = true,
                 entity_type = case when entity_type = 'unknown' then 'factory' else entity_type end
               where id = %s""",
            (supplier_id,),
        )
    elif code == "BGAPMEA":
        cur.execute(
            """update public.suppliers set
                 bgapmea_verified = true,
                 entity_type = case when entity_type = 'unknown' then 'factory' else entity_type end
               where id = %s""",
            (supplier_id,),
        )
    elif code in ("EPB", "RSC"):
        cur.execute(
            """update public.suppliers set
                 entity_type = case when entity_type = 'unknown' then 'factory' else entity_type end
               where id = %s""",
            (supplier_id,),
        )
    elif code in ("OEKO_TEX", "WRAP", "SA8000"):
        # Tier-3 cert bodies that audit producing sites only — never buying houses.
        cur.execute(
            """update public.suppliers set
                 entity_type = case when entity_type = 'unknown' then 'factory' else entity_type end
               where id = %s""",
            (supplier_id,),
        )
    elif code == "GOTS":
        # GOTS certifies producers (spinning/weaving/knitting/dyeing/...) and
        # also a "Trading" / "No processing" scope. Pull the actual GOTS
        # field-of-operation string and classify accordingly.
        ops = (rec.payload.get("gots_field_of_operation") or "").lower()
        production_markers = (
            "manufactur", "processing", "spinning", "weaving", "knitting",
            "dyeing", "printing", "finishing", "garment", "making",
            "wet processing", "washing", "laundering", "pre-treatment",
            "preparatory", "packing", "embroidery", "embellishment",
        )
        # Note: "no processing" contains the substring "processing", so it would
        # falsely match. Strip it first.
        ops_check = ops.replace("no processing", "")
        if any(m in ops_check for m in production_markers):
            cur.execute(
                """update public.suppliers set
                     entity_type = case when entity_type = 'unknown' then 'factory' else entity_type end
                   where id = %s""",
                (supplier_id,),
            )
        elif "trading" in ops or "trader" in ops:
            cur.execute(
                """update public.suppliers set
                     entity_type = case when entity_type = 'unknown' then 'buying_house' else entity_type end
                   where id = %s""",
                (supplier_id,),
            )
    elif code.startswith("BRAND_"):
        # Brand supplier-list disclosures publish direct manufacturing partners
        # (Transparency Pledge / Higg). Brand offices are never on these lists.
        cur.execute(
            """update public.suppliers set
                 entity_type = case when entity_type = 'unknown' then 'factory' else entity_type end
               where id = %s""",
            (supplier_id,),
        )


def _maybe_publish(cur, supplier_id: str) -> None:
    # Wrap in a savepoint: if the publish trigger refuses (no Tier 1-3
    # evidence yet), the surrounding transaction must remain usable so the
    # rest of the upsert (completeness refresh, commit) can proceed.
    cur.execute("savepoint sp_publish")
    try:
        cur.execute(
            "update public.suppliers set is_published = true where id = %s and is_published = false",
            (supplier_id,),
        )
        cur.execute("release savepoint sp_publish")
    except Exception:  # noqa: BLE001
        # Trigger refused publication (no Tier 1-3 evidence yet). That's fine.
        cur.execute("rollback to savepoint sp_publish")


def _refresh_completeness(cur, supplier_id: str) -> None:
    cur.execute(
        "update public.suppliers set completeness_pct = public.compute_completeness(%s) where id = %s",
        (supplier_id, supplier_id),
    )


# -----------------------------------------------------------------------------
_TIER_MAP = {
    "RSC": "tier1_gov", "RJSC": "tier1_gov", "DIFE": "tier1_gov",
    "EPB": "tier1_gov", "BEPZA": "tier1_gov",
    "BGMEA": "tier2_industry", "BKMEA": "tier2_industry",
    "BTMA": "tier2_industry", "BGAPMEA": "tier2_industry",
    "WRAP": "tier3_cert",  # BSCI removed 2026-05-19: no public surface (see progress-tracker decision log)
    "OEKO_TEX": "tier3_cert", "GOTS": "tier3_cert", "SA8000": "tier3_cert",
    "BRAND_HM": "tier4_brand", "BRAND_INDITEX": "tier4_brand",
    "BRAND_PRIMARK": "tier4_brand", "BRAND_ASOS": "tier4_brand",
    "BRAND_MS": "tier4_brand", "BRAND_NEXT": "tier4_brand",
    "UFLPA": "tier5_regulatory", "OFAC": "tier5_regulatory",
    "UK_OFSI": "tier5_regulatory", "EU_SANC": "tier5_regulatory",
}

_ENTITY_DEFAULT = {
    "BGMEA": "buying_house",
    "BKMEA": "factory",
    "BTMA": "factory",
    "RSC": "factory",
    "BGAPMEA": "factory",
    "EPB": "factory",
}


def _tier_for(code: str) -> str:
    return _TIER_MAP.get(code, "tier6_crosscheck")


def _entity_type_for(code: str) -> str:
    return _ENTITY_DEFAULT.get(code, "unknown")


def _to_jsonb(payload: dict[str, Any]) -> str:
    import json

    return json.dumps(payload, ensure_ascii=False, default=str)
