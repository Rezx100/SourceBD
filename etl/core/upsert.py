"""Idempotent supplier + source_record upsert.

Strategy:
  0. If a source_record already exists for (source_code, source_ref), return its
     supplier_id directly. This guarantees deterministic self-source idempotency:
     re-ingesting the same scraper never remaps a row to a different supplier,
     even when Pass 3 phone-overlap would otherwise pick an ambiguous sibling.
     `ScrapedRecord.alias_refs` match here too, so a chained enrichment record
     (bkmea_detail) resolves through its parent list row's ref.
  0.5 Change-skip: if the stored row for this exact (source, ref) already
     carries this payload's raw_hash, skip the enrich and the evidence rewrite
     entirely — but still touch fetched_at so freshness monitoring does not
     false-age a record we verified just now. The caller counts records_skipped.
  1. Match against existing suppliers via slug -> email -> phone -> fuzzy name (spec §4.2).
  2. If matched, ENRICH (never overwrite non-null with null, add source_tag).
  3. If not matched, INSERT new supplier.
  4. Upsert source_records row keyed on (supplier_id, source_id, source_ref).
  5. After insert/enrich, set is_published = true ONLY if Tier 1-3 source exists
     (the DB trigger enforces this; we just attempt and swallow violation).
"""
from __future__ import annotations

import re
from typing import Any

from rapidfuzz import fuzz, process

from etl.core.db import db, get_source_id
from etl.core.logging import get_logger
from etl.core.normalize import (
    extension_base_name,
    make_slug,
    normalize_company_name,
    normalize_phones,
)
from etl.core.resolution_edges import apply_same_edge_canonical
from etl.core.scraper import ScrapedRecord

log = get_logger("etl.upsert")

_FUZZY_THRESHOLD = 92  # rapidfuzz returns 0-100

# A registry membership number always leads with its integer: "2638 - C/2026".
# A half-rendered page can yield a blank like "- C/2009" — not a fact.
_REG_NO_HEAD_RE = re.compile(r"^\d+\s*-")

# A shared email or phone is not, on its own, evidence of identity. Bangladesh
# RMG groups run many legally distinct factories off one switchboard and one
# group mailbox, so contact overlap alone merged genuinely different companies:
# ABANTI COLOUR TEX with CRONY APPARELS (both sunny@abanti.net), SWEATER HEAVEN
# with FATULLAH FASHION (both ffashion@bol-online.com), ABONI KNITWEAR with
# ABONI TEXTILE, FAKIR APPARELS with FAKIR FASHION, and others — 82 suppliers
# ended up holding BKMEA member records for more than one company.
#
# Contact matches must now clear a name floor too. It is deliberately below
# _FUZZY_THRESHOLD: the contact is real corroborating evidence, so the names
# need only be recognisably the same company rather than a fuzzy match in their
# own right. Erring towards a duplicate supplier is the right trade — a
# duplicate is visible and mergeable, whereas a conflation silently publishes
# one factory's worker count and certifications under another's name.
_CONTACT_NAME_FLOOR = 85

# Longest leading token still read as an initials block once
# `normalize_company_name` has collapsed "H. R." to "hr".
_MAX_INITIALS_LEN = 3


def upsert_supplier_with_source(rec: ScrapedRecord) -> str | None:
    """Returns supplier_id (uuid as str), or None when the record was skipped
    as unchanged (the stored source_records row already carries this payload's
    raw_hash) — or when an attach-only record (`rec.enrich_only`) matched no
    existing supplier. A None return means: no enrich, no source-record
    rewrite beyond fetched_at, and the caller must not record evidence or run
    per-record downstream writes — it counts records_skipped instead."""
    # Local import: avoids the cycle (etl.core.sanctions imports
    # _names_compatible from this module at module level).
    from etl.core.sanctions import screen_supplier_against_entries

    slug = make_slug(rec.company_name)
    norm = normalize_company_name(rec.company_name)
    phones = normalize_phones(rec.phone_raw)
    email = (rec.email or "").strip().lower() or None

    with db.conn() as c, c.cursor() as cur:
        if _source_record_unchanged(cur, rec):
            c.commit()
            log.info("source_record.unchanged",
                     source=rec.source_code, ref=rec.source_ref)
            return None
        supplier_id = _find_existing(
            cur, slug=slug, norm=norm, email=email, phones=phones,
            source_code=rec.source_code, source_ref=rec.source_ref,
            alias_refs=rec.alias_refs,
        )

        if supplier_id is None:
            if rec.enrich_only:
                # Attach-only (founder decision D, 4 Aug 2026): the widened
                # EPB category enumeration enriches suppliers we already know
                # but never creates single-source EPB profiles. Nothing has
                # been written yet, so there is nothing to roll back.
                log.info("supplier.enrich_only_unmatched",
                         name=rec.company_name, source=rec.source_code,
                         ref=rec.source_ref)
                c.commit()
                return None
            # REZ-67 / A7: extension-pattern names with a known parent attach
            # as facilities (facility_of set → A2 keeps them unpublished).
            # Exact recomputed identity only — never fuzzy (Anika/ANITA).
            # No parent → create and publish as today; B5 collects orphans.
            facility_of: str | None = None
            base = extension_base_name(rec.company_name)
            if base is not None:
                facility_of = _find_facility_parent(cur, base)
            supplier_id = _insert_supplier(
                cur, slug=slug, norm=norm, email=email, phones=phones, rec=rec,
                facility_of=facility_of,
            )
            log.info("supplier.created", supplier_id=supplier_id, name=rec.company_name,
                     source=rec.source_code, ref=rec.source_ref,
                     facility_of=facility_of)
        else:
            _enrich_supplier(cur, supplier_id=supplier_id, email=email, phones=phones, rec=rec)
            log.info("supplier.enriched", supplier_id=supplier_id, source=rec.source_code,
                     ref=rec.source_ref)

        _upsert_source_record(cur, supplier_id=supplier_id, rec=rec)
        _apply_source_specific(cur, supplier_id=supplier_id, rec=rec)
        _maybe_publish(cur, supplier_id)
        _refresh_completeness(cur, supplier_id)
        # REZ-32: screen the supplier against stored sanctions entries INSIDE
        # the transaction. Screening is the P0 invariant, not enrichment, so
        # it cannot live in the post-commit best-effort block below — a
        # failure must raise and roll this record back. BaseScraper.run's
        # per-record try/except contains that as records_skipped: loud, and
        # self-healing on the next ingest.
        screen_supplier_against_entries(cur, supplier_id=supplier_id, norm=norm)
        c.commit()

    # F5 post-ingest enrichment: keep contacts merged and city/district
    # derived for the supplier we just touched. Best-effort — never block
    # an ingest on enrichment failure.
    try:
        from etl.jobs.contact_merge import run_for as _merge_for
        from etl.jobs.address_norm import run_for as _norm_for

        _merge_for(supplier_id)
        _norm_for(supplier_id)
    except Exception as exc:  # noqa: BLE001
        log.error("upsert.post_enrich_failed", supplier_id=supplier_id, error=str(exc))

    return supplier_id


# -----------------------------------------------------------------------------
def _source_record_unchanged(cur, rec: ScrapedRecord) -> bool:
    """Post-fetch change-skip: True when the stored row for this exact
    (source, ref) already carries this payload's hash.

    One code path for every scraper (REZ-36): a record whose content has not
    changed since it was last ingested must not re-enrich the supplier or
    rewrite its evidence — before migration 0087 that rewrite minted ~5,800
    stale claims per bkmea_detail run, and it still re-bills the write path
    for nothing. fetched_at is still touched: the record WAS verified just
    now, and freshness monitoring keys off that column.
    """
    src_id = get_source_id(rec.source_code)
    cur.execute(
        "select supplier_id, raw_hash from public.source_records "
        "where source_id = %s and source_ref = %s",
        (src_id, rec.source_ref),
    )
    rows = cur.fetchall()
    supplier_ids = {str(r["supplier_id"]) for r in rows}
    if len(supplier_ids) != 1:
        # 0 rows: never ingested. >1 supplier: the ref is ambiguous (a
        # stranded duplicate like CRONY FASHION's) — fall through to the full
        # upsert, whose Pass 0 resolves it deterministically. Skipping on an
        # ambiguous ref could freeze the wrong supplier's row.
        return False
    if rows[0]["raw_hash"] != rec.hash():
        # Covers a NULL stored hash (never computed) as well as a real change.
        return False
    cur.execute(
        "update public.source_records set fetched_at = now() "
        "where source_id = %s and source_ref = %s",
        (src_id, rec.source_ref),
    )
    return True


def _find_existing(
    cur, *, slug: str, norm: str, email: str | None, phones: list[str],
    source_code: str | None = None, source_ref: str | None = None,
    alias_refs: tuple[str, ...] = (),
) -> str | None:
    # Pass order is load-bearing (production incidents). Do not reorder.
    # After any pass finds a candidate, honour live `same` edges via
    # apply_same_edge_canonical (positive-edge hook, REZ-64). Negative
    # (`different`) edges are enforced in ops merge/audit/split paths —
    # the incoming record has no second supplier id to compare at match time.
    #
    # Live same-edges are loaded once per process (see
    # etl.core.resolution_edges); never query resolution_edges per pass.
    candidate: str | None = None

    # Pass 0: self-source idempotency. If we have already ingested this exact
    # (source_id, source_ref), reuse the same supplier_id deterministically.
    # Aliases (a chained record's parent ref) match too, with the record's own
    # ref preferred so self-source history always wins over the parent's.
    if source_code and source_ref:
        src_id = get_source_id(source_code)
        refs = [source_ref, *alias_refs]
        cur.execute(
            "select supplier_id from public.source_records "
            "where source_id = %s and source_ref = any(%s::text[]) "
            "order by (source_ref = %s) desc, fetched_at asc limit 1",
            (src_id, refs, source_ref),
        )
        row = cur.fetchone()
        if row:
            candidate = str(row["supplier_id"])

    # Pass 1: slug
    if candidate is None:
        cur.execute("select id from public.suppliers where slug = %s", (slug,))
        row = cur.fetchone()
        if row:
            candidate = str(row["id"])

    # Pass 1.5: squash equality — names differing ONLY by spaces are one
    # spelling ("Master Cham" vs "Mastercham", "3-A Fashions" vs "3A
    # Fashions"). `make_slug` keeps the register's spacing, so Pass 1 misses
    # these, and single-letter register spellings can sit under the Pass 4
    # fuzzy bar — both mint twins (the WEST KNITWEAR class, 3 Aug 2026).
    # Exact equality, not similarity: no threshold, so no conflation surface
    # beyond what Pass 1 already accepts. Oldest row wins for determinism
    # when historical twins both match (the merge repair heals those). A
    # functional index on the replace() is the deferred optimization — schema
    # migration, needs the founder's explicit go-ahead; the per-record seq
    # scan at ~10k rows is acceptable meanwhile.
    if candidate is None:
        squashed = norm.replace(" ", "")
        if squashed:
            cur.execute(
                "select id from public.suppliers "
                "where replace(company_name_norm, ' ', '') = %s "
                "order by created_at asc limit 1",
                (squashed,),
            )
            row = cur.fetchone()
            if row:
                candidate = str(row["id"])

    # Pass 2: email, corroborated by the name.
    if candidate is None and email:
        cur.execute(
            "select id, company_name_norm from public.suppliers where email_primary = %s",
            (email,),
        )
        row = cur.fetchone()
        if row and _contact_match_allowed(norm, row["company_name_norm"]):
            candidate = str(row["id"])

    # Pass 3: phone overlap, corroborated by the name.
    if candidate is None and phones:
        cur.execute(
            "select id, company_name_norm from public.suppliers "
            "where phones && %s::text[]",
            (phones,),
        )
        for row in cur.fetchall():
            if _contact_match_allowed(norm, row["company_name_norm"]):
                candidate = str(row["id"])
                break

    # Pass 4: fuzzy name (within trigram-prefiltered candidates)
    if candidate is None:
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
            if (
                match
                and match[1] >= _FUZZY_THRESHOLD
                and _names_compatible(norm, match[0])
            ):
                candidate = match[2]

    if candidate is None:
        return None
    return apply_same_edge_canonical(cur, candidate)


def _leading_initials(norm: str) -> str | None:
    """The initials block a company leads with, if it has one.

    `normalize_company_name` collapses "H. R. TEXTILE MILLS" to
    "hr textile mills", so the identity of the company is carried by a short
    first token that the rest of the name does not distinguish.
    """
    parts = norm.split()
    if len(parts) < 2:
        return None
    head = parts[0]
    return head if head.isalpha() and len(head) <= _MAX_INITIALS_LEN else None


def _names_compatible(a: str, b: str) -> bool:
    """Reject two name-similarity failure modes `token_sort_ratio` cannot see.

    That scorer sorts tokens before comparing, which is what lets it see through
    word-order noise — and also what makes it blind to word order as a signal:

    - "COTTON FAIR (PVT) LTD" and "FAIR COTTON (PVT) LTD" score **100**. They
      are two different BKMEA members. An order-sensitive ratio scores them 55.
    - "H. R TEXTILE MILLS" and "G. R TEXTILE MILLS" score **94**, over the
      threshold, on a one-letter difference in the initials that *are* the
      company's identity. Likewise "S. B. KNITWEAR" against "B. S KNITWEAR".

    So a fuzzy match must additionally survive an order-sensitive comparison,
    and may not silently swap one initials block for another.
    """
    ia, ib = _leading_initials(a), _leading_initials(b)
    if ia is not None and ib is not None and ia != ib:
        return False
    return fuzz.ratio(a, b) >= _FUZZY_THRESHOLD


def _contact_match_allowed(norm: str, candidate_norm: str | None) -> bool:
    """Whether a shared email/phone may merge these two names."""
    if not candidate_norm:
        # Nothing to corroborate against. The contact is all we have, and on its
        # own it is not identity — see _CONTACT_NAME_FLOOR.
        return False
    if _leading_initials(norm) != _leading_initials(candidate_norm):
        return False
    return max(
        fuzz.token_sort_ratio(norm, candidate_norm),
        fuzz.ratio(norm, candidate_norm),
    ) >= _CONTACT_NAME_FLOOR


def _find_facility_parent(cur, base_name: str) -> str | None:
    """Exact recomputed identity only (Pass 1 slug / Pass 1.5 squash).

    Fuzzy matching is forbidden here: a dry run once proposed Anika→ANITA
    and Bando→BRAND, which would have been re-conflations.
    """
    parent_slug = make_slug(base_name)
    cur.execute("select id from public.suppliers where slug = %s", (parent_slug,))
    row = cur.fetchone()
    if row:
        return str(row["id"])
    parent_norm = normalize_company_name(base_name)
    squashed = parent_norm.replace(" ", "")
    if squashed:
        cur.execute(
            "select id from public.suppliers "
            "where replace(company_name_norm, ' ', '') = %s "
            "order by created_at asc limit 1",
            (squashed,),
        )
        row = cur.fetchone()
        if row:
            return str(row["id"])
    return None


def _insert_supplier(
    cur, *, slug: str, norm: str, email: str | None, phones: list[str],
    rec: ScrapedRecord, facility_of: str | None = None,
) -> str:
    cur.execute(
        """insert into public.suppliers
             (slug, company_name, company_name_norm, entity_type,
              contact_name, contact_role, email_primary, phones, website,
              address_raw, city, district, source_tags, facility_of)
           values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s, ARRAY[%s], %s)
           returning id""",
        (
            slug, rec.company_name, norm,
            rec.entity_type or _entity_type_for(rec.source_code),
            rec.contact_name, rec.contact_role, email, phones, rec.website,
            rec.address_raw, rec.city, rec.district, rec.source_code,
            facility_of,
        ),
    )
    return str(cur.fetchone()["id"])


def _locked_columns(cur, supplier_id: str) -> set[str]:
    """Live field locks for one supplier (released_at IS NULL).

    Loaded once per `_enrich_supplier` / `_apply_source_specific` call —
    not per SET fragment. Empty set = no locks = ETL behaviour unchanged.
    """
    cur.execute(
        """select column_name
             from public.supplier_field_locks
            where supplier_id = %s
              and released_at is null""",
        (supplier_id,),
    )
    rows = cur.fetchall() or []
    out: set[str] = set()
    for row in rows:
        if isinstance(row, dict):
            out.add(str(row["column_name"]))
        else:
            out.add(str(row[0]))
    return out


def _enrich_supplier(
    cur, *, supplier_id: str, email: str | None, phones: list[str], rec: ScrapedRecord
) -> None:
    # Build COALESCE updates so we never overwrite non-null with null.
    # Skip any column with a live supplier_field_locks row (REZ-66 / A6).
    locked = _locked_columns(cur, supplier_id)
    assignments: list[tuple[str, str, Any]] = [
        ("contact_name", "contact_name  = coalesce(contact_name, %s)", rec.contact_name),
        ("contact_role", "contact_role  = coalesce(contact_role, %s)", rec.contact_role),
        ("email_primary", "email_primary = coalesce(email_primary, %s)", email),
        (
            "phones",
            "phones        = ("
            "\n               select array(select distinct unnest("
            "coalesce(phones, '{}'::text[]) || %s::text[]))"
            "\n             )",
            phones,
        ),
        ("website", "website       = coalesce(website, %s)", rec.website),
        ("address_raw", "address_raw   = coalesce(address_raw, %s)", rec.address_raw),
        ("city", "city          = coalesce(city, %s)", rec.city),
        ("district", "district      = coalesce(district, %s)", rec.district),
        (
            "source_tags",
            "source_tags   = ("
            "\n               select array(select distinct unnest("
            "coalesce(source_tags, '{}'::text[]) || ARRAY[%s]::text[]))"
            "\n             )",
            rec.source_code,
        ),
    ]
    sets = [frag for col, frag, _ in assignments if col not in locked]
    params = [val for col, _, val in assignments if col not in locked]
    if not sets:
        return
    cur.execute(
        "update public.suppliers set\n             "
        + ",\n             ".join(sets)
        + "\n           where id = %s",
        (*params, supplier_id),
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


def _exec_unlocked_update(
    cur,
    *,
    supplier_id: str,
    locked: set[str],
    fragments: list[tuple[str, str, tuple[Any, ...]]],
) -> None:
    """Run UPDATE with only unlocked column fragments.

    Each fragment is ``(column_name, sql_set_fragment, params)``. When no
    listed column is locked the joined SQL matches the pre-lock statements
    byte-for-byte (same fragment order and text).
    """
    sets: list[str] = []
    params: list[Any] = []
    for col, frag, frag_params in fragments:
        if col in locked:
            continue
        sets.append(frag)
        params.extend(frag_params)
    if not sets:
        return
    cur.execute(
        "update public.suppliers set\n                     "
        + ",\n                     ".join(sets)
        + "\n                   where id = %s",
        (*params, supplier_id),
    )


def _apply_source_specific(cur, *, supplier_id: str, rec: ScrapedRecord) -> None:
    """Set register-specific verified flags + reg numbers, and upgrade
    entity_type='unknown' to the source's default when a Tier 1-2
    register attaches (BGMEA, BKMEA, BTMA, BGAPMEA, RSC, EPB).

    Live field locks (REZ-66) skip locked columns so admin overrides —
    especially entity_type and bkmea_reg_number — survive re-scrapes.
    """
    locked = _locked_columns(cur, supplier_id)
    code = rec.source_code
    if code == "BGMEA":
        reg = rec.payload.get("bgmea_reg_number")
        if reg:
            _exec_unlocked_update(
                cur,
                supplier_id=supplier_id,
                locked=locked,
                fragments=[
                    ("bgmea_verified", "bgmea_verified = true", ()),
                    (
                        "bgmea_reg_numbers",
                        "bgmea_reg_numbers = (\n"
                        "                       select array(select distinct unnest(\n"
                        "                         coalesce(bgmea_reg_numbers,'{}'::text[])"
                        " || ARRAY[%s]::text[]\n"
                        "                       ))\n"
                        "                     )",
                        (reg,),
                    ),
                    (
                        "entity_type",
                        "entity_type = case when entity_type = 'unknown' "
                        "then 'buying_house' else entity_type end",
                        (),
                    ),
                ],
            )
    elif code == "BKMEA":
        reg = rec.payload.get("bkmea_reg_number")
        # A membership number always leads with its integer ("2638 - C/2026").
        # Anything else — a blank "- C/2009" from a half-rendered page — is not
        # a fact and must never touch the column.
        if reg and not _REG_NO_HEAD_RE.match(reg.strip()):
            reg = None
        if reg and rec.canonical_registry:
            # The member's own detail page is the canonical registry record
            # (founder rule, 3 Aug 2026): the latest scrape wins outright, so a
            # re-registration shows without a review round-trip. The directory
            # list only ever fills a NULL column (below). Locks beat this
            # overwrite when present.
            _exec_unlocked_update(
                cur,
                supplier_id=supplier_id,
                locked=locked,
                fragments=[
                    ("bkmea_verified", "bkmea_verified = true", ()),
                    ("bkmea_reg_number", "bkmea_reg_number = %s", (reg,)),
                    (
                        "entity_type",
                        "entity_type = case when entity_type = 'unknown' "
                        "then 'factory' else entity_type end",
                        (),
                    ),
                ],
            )
        else:
            _exec_unlocked_update(
                cur,
                supplier_id=supplier_id,
                locked=locked,
                fragments=[
                    ("bkmea_verified", "bkmea_verified = true", ()),
                    (
                        "bkmea_reg_number",
                        "bkmea_reg_number = coalesce(bkmea_reg_number, %s)",
                        (reg,),
                    ),
                    (
                        "entity_type",
                        "entity_type = case when entity_type = 'unknown' "
                        "then 'factory' else entity_type end",
                        (),
                    ),
                ],
            )
    elif code == "BTMA":
        _exec_unlocked_update(
            cur,
            supplier_id=supplier_id,
            locked=locked,
            fragments=[
                ("btma_verified", "btma_verified = true", ()),
                (
                    "entity_type",
                    "entity_type = case when entity_type = 'unknown' "
                    "then 'factory' else entity_type end",
                    (),
                ),
            ],
        )
    elif code == "BGAPMEA":
        _exec_unlocked_update(
            cur,
            supplier_id=supplier_id,
            locked=locked,
            fragments=[
                ("bgapmea_verified", "bgapmea_verified = true", ()),
                (
                    "entity_type",
                    "entity_type = case when entity_type = 'unknown' "
                    "then 'factory' else entity_type end",
                    (),
                ),
            ],
        )
    elif code in ("EPB", "RSC"):
        _exec_unlocked_update(
            cur,
            supplier_id=supplier_id,
            locked=locked,
            fragments=[
                (
                    "entity_type",
                    "entity_type = case when entity_type = 'unknown' "
                    "then 'factory' else entity_type end",
                    (),
                ),
            ],
        )
    elif code in ("OEKO_TEX", "WRAP", "SA8000"):
        # Tier-3 cert bodies that audit producing sites only — never buying houses.
        _exec_unlocked_update(
            cur,
            supplier_id=supplier_id,
            locked=locked,
            fragments=[
                (
                    "entity_type",
                    "entity_type = case when entity_type = 'unknown' "
                    "then 'factory' else entity_type end",
                    (),
                ),
            ],
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
            _exec_unlocked_update(
                cur,
                supplier_id=supplier_id,
                locked=locked,
                fragments=[
                    (
                        "entity_type",
                        "entity_type = case when entity_type = 'unknown' "
                        "then 'factory' else entity_type end",
                        (),
                    ),
                ],
            )
        elif "trading" in ops or "trader" in ops:
            _exec_unlocked_update(
                cur,
                supplier_id=supplier_id,
                locked=locked,
                fragments=[
                    (
                        "entity_type",
                        "entity_type = case when entity_type = 'unknown' "
                        "then 'buying_house' else entity_type end",
                        (),
                    ),
                ],
            )
    elif code.startswith("BRAND_"):
        # Brand supplier-list disclosures publish direct manufacturing partners
        # (Transparency Pledge / Higg). Brand offices are never on these lists.
        # entity_type lock must beat this factory overwrite (REZ-66).
        _exec_unlocked_update(
            cur,
            supplier_id=supplier_id,
            locked=locked,
            fragments=[
                (
                    "entity_type",
                    "entity_type = case when entity_type = 'unknown' "
                    "then 'factory' else entity_type end",
                    (),
                ),
            ],
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
    # BRAND_INDITEX kept although the scraper retired 2026-07-29 (no public
    # factory list exists): rows ingested before then still resolve their tier.
    "BRAND_HM": "tier4_brand", "BRAND_INDITEX": "tier4_brand",
    "BRAND_PRIMARK": "tier4_brand", "BRAND_ASOS": "tier4_brand",
    "BRAND_MS": "tier4_brand", "BRAND_NEXT": "tier4_brand",
    "UFLPA": "tier5_regulatory", "OFAC": "tier5_regulatory",
    "UK_OFSI": "tier5_regulatory", "EU_SANC": "tier5_regulatory",
    # US_WRO and ILAB were previously absent and defaulted to tier6_crosscheck.
    # That was harmless while only the supplier upsert read this map, because
    # sanctions scrapers bypass it — but the evidence writer now stamps
    # source_tier on every claim, and a CBP Withhold Release Order is Tier 5
    # regulatory, not a cross-check hint.
    "US_WRO": "tier5_regulatory", "ILAB": "tier5_regulatory",
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
