"""F5b — cross-source contact merge.

For each supplier, walk all `source_records` in **tier order (1 → 4)** and
COALESCE-fill the supplier-table contact columns:

    address_raw, email_primary, phones, contact_name, contact_role, website

A higher-tier record always provides the preferred value for an empty
column. We **never** overwrite a non-null supplier value (Hard Rule #5 —
the ingest path already locked in the highest-tier evidence at the time of
the original upsert; this job only fills in fields that historic ingest
order left null on cross-tagged suppliers).

Per-source key map is derived from the F5 scoping audit (see
`ops/_f5_scoping_audit.py` output) — only sources that publish each kind of
data are consulted.

Tier 5/6 (sanctions / cross-check) NEVER contribute contact data: those
sources publish entity names only.

Tier 1 sources lack person/phone/email; Tier 2 (BGMEA/BKMEA/BTMA/BGAPMEA)
provide the bulk; Tier 3 OEKO_TEX provides address/email/phone but no
person; brand sources provide only address.
"""
from __future__ import annotations

import re
from typing import Iterable

from etl.core.db import db
from etl.core.field_locks import locked_columns
from etl.core.logging import get_logger
from etl.core.normalize import normalize_phones

log = get_logger("etl.jobs.contact_merge")


# Tier rank used both for ORDER BY and for the in-Python walk.
_TIER_RANK = {
    "tier1_gov": 1,
    "tier2_industry": 2,
    "tier3_cert": 3,
    "tier4_brand": 4,
    "tier5_regulatory": 99,   # never consulted
    "tier6_crosscheck": 99,
}

# Per-source key map. Each entry returns a dict with the canonical contact
# slots populated from this source's payload. Sources with no contact data
# simply return an empty dict.

_EMAIL_RX = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")


def _first_email(*candidates: str | None) -> str | None:
    for c in candidates:
        if not c:
            continue
        m = _EMAIL_RX.search(c)
        if m:
            return m.group(0).strip().lower()
    return None


def _trim(s: str | None) -> str | None:
    if s is None:
        return None
    s = str(s).strip()
    return s or None


def _extract(code: str, fields: dict) -> dict[str, object]:
    """Map a single source_record payload to canonical contact slots."""
    out: dict[str, object] = {}
    if code == "BGMEA":
        out["address_raw"] = _trim(
            fields.get("factory_address")
            or fields.get("mailing_address")
            or fields.get("raw_address")
        )
        out["email_primary"] = _first_email(
            fields.get("factory_email"),
            fields.get("mailing_email"),
        )
        # BGMEA publishes no contact_name field; intentionally omitted.
        phones_raw = " , ".join(
            v for v in (
                fields.get("factory_phone"),
                fields.get("mailing_phone"),
                fields.get("raw_tel"),
            ) if v
        )
        if phones_raw:
            out["phones"] = normalize_phones(phones_raw)
    elif code == "BKMEA":
        out["address_raw"] = _trim(
            fields.get("factory_address") or fields.get("bkmea_factory_address")
            or fields.get("mailing_address") or fields.get("bkmea_mailing_address")
        )
        # Owner > Rep (owner is the binding signatory).
        owner = _trim(fields.get("bkmea_owner_name") or fields.get("owner_name"))
        rep = _trim(fields.get("bkmea_rep_name") or fields.get("rep_name"))
        if owner:
            out["contact_name"] = owner
            out["contact_role"] = "Owner"
        elif rep:
            out["contact_name"] = rep
            out["contact_role"] = "Representative"
        out["email_primary"] = _first_email(
            fields.get("bkmea_owner_email") or fields.get("owner_email"),
            fields.get("bkmea_rep_email") or fields.get("rep_email"),
        )
        phones_raw = " , ".join(
            v for v in (
                fields.get("bkmea_owner_mobile") or fields.get("owner_mobile"),
                fields.get("bkmea_rep_mobile") or fields.get("rep_mobile"),
            ) if v
        )
        if phones_raw:
            out["phones"] = normalize_phones(phones_raw)
    elif code == "BTMA":
        out["address_raw"] = _trim(
            fields.get("factory_address") or fields.get("mailing_address")
        )
        person = _trim(fields.get("raw_contact_person"))
        if person:
            out["contact_name"] = person
            # BTMA does not publish a role label.
        out["email_primary"] = _first_email(fields.get("raw_email"))
        phones_raw = fields.get("raw_tel")
        if phones_raw:
            out["phones"] = normalize_phones(phones_raw)
    elif code == "BGAPMEA":
        out["address_raw"] = _trim(
            fields.get("bgapmea_factory_address") or fields.get("bgapmea_company_address")
        )
        owner = _trim(fields.get("bgapmea_owner_name"))
        if owner:
            out["contact_name"] = owner
            out["contact_role"] = "Owner"
        out["email_primary"] = _first_email(fields.get("bgapmea_email_raw"))
        phones_raw = fields.get("bgapmea_phone")
        if phones_raw:
            out["phones"] = normalize_phones(phones_raw)
    elif code == "EPB":
        out["address_raw"] = _trim(
            fields.get("epb_factory_address") or fields.get("epb_office_address")
        )
    elif code == "RSC":
        out["address_raw"] = _trim(fields.get("rsc_location"))
    elif code == "OEKO_TEX":
        out["address_raw"] = _trim(fields.get("oeko_profile_address"))
        out["email_primary"] = _first_email(fields.get("oeko_profile_email"))
        phones_raw = fields.get("oeko_profile_phone")
        if phones_raw:
            out["phones"] = normalize_phones(phones_raw)
        web = _trim(fields.get("oeko_profile_website"))
        if web:
            out["website"] = web
    elif code.startswith("BRAND_"):
        out["address_raw"] = _trim(fields.get("address"))
    # GOTS / WRAP / SA8000 publish no contact data — handled by empty dict.
    return out


# -----------------------------------------------------------------------------
def _fetch_supplier(cur, supplier_id: str) -> dict | None:
    cur.execute(
        "select id, address_raw, email_primary, phones, contact_name, "
        "       contact_role, website "
        "from public.suppliers where id = %s",
        (supplier_id,),
    )
    r = cur.fetchone()
    if r is None:
        return None
    return r if isinstance(r, dict) else {
        "id": r[0], "address_raw": r[1], "email_primary": r[2],
        "phones": r[3], "contact_name": r[4], "contact_role": r[5], "website": r[6],
    }


def _fetch_records(cur, supplier_id: str) -> list[tuple[str, str, dict]]:
    cur.execute(
        """select s.code, sr.source_tier, sr.fields
             from public.source_records sr
             join public.sources s on s.id = sr.source_id
            where sr.supplier_id = %s""",
        (supplier_id,),
    )
    out: list[tuple[str, str, dict]] = []
    for r in cur.fetchall():
        if isinstance(r, dict):
            out.append((r["code"], r["source_tier"], r["fields"] or {}))
        else:
            out.append((r[0], r[1], r[2] or {}))
    return out


def run_for(supplier_id: str) -> dict[str, int]:
    """Merge contacts for one supplier. Returns counters of fields filled."""
    counters = {k: 0 for k in (
        "address_raw", "email_primary", "phones", "contact_name", "contact_role", "website",
    )}
    with db.conn() as c, c.cursor() as cur:
        cur_supplier = _fetch_supplier(cur, supplier_id)
        if cur_supplier is None:
            return counters
        records = _fetch_records(cur, supplier_id)
        # Tier order: lowest rank first; within tier, preserve fetch order.
        records.sort(key=lambda t: _TIER_RANK.get(t[1], 99))

        # Build merged candidate by walking in tier order. Higher-tier (lower
        # rank) wins because we only setdefault.
        merged: dict[str, object] = {}
        merged_phones: list[str] = []
        for code, tier, fields in records:
            if _TIER_RANK.get(tier, 99) >= 99:
                continue
            ext = _extract(code, fields)
            # (contact_name, contact_role) is atomic: a role only describes the
            # name from the SAME source. Never let a later source's role
            # attach to an earlier source's name.
            if "contact_name" in ext and "contact_name" not in merged:
                merged["contact_name"] = ext["contact_name"]
                if ext.get("contact_role"):
                    merged["contact_role"] = ext["contact_role"]
            for k, v in ext.items():
                if v is None or k in ("contact_name", "contact_role"):
                    continue
                if k == "phones":
                    for p in v:  # type: ignore[union-attr]
                        if p not in merged_phones:
                            merged_phones.append(p)
                else:
                    merged.setdefault(k, v)

        # Now write fill-only updates: COALESCE current value with merged.
        # Skip any column with a live supplier_field_locks row (REZ-86 / A6b).
        locked = locked_columns(cur, supplier_id)
        updates: dict[str, object] = {}
        for k in ("address_raw", "email_primary", "website"):
            if k in locked:
                continue
            if not cur_supplier.get(k) and merged.get(k):
                updates[k] = merged[k]
                counters[k] += 1
        # contact_name + contact_role are atomic: only set role when we
        # are setting the name in this write (otherwise role would attach
        # to whatever name was already there from an unknown source).
        if (
            "contact_name" not in locked
            and not cur_supplier.get("contact_name")
            and merged.get("contact_name")
        ):
            updates["contact_name"] = merged["contact_name"]
            counters["contact_name"] += 1
            if (
                "contact_role" not in locked
                and not cur_supplier.get("contact_role")
                and merged.get("contact_role")
            ):
                updates["contact_role"] = merged["contact_role"]
                counters["contact_role"] += 1
        # Phones: union (never lose existing entries).
        existing_phones = list(cur_supplier.get("phones") or [])
        added_phones = [p for p in merged_phones if p not in existing_phones]
        if added_phones and "phones" not in locked:
            updates["phones"] = existing_phones + added_phones
            counters["phones"] += len(added_phones)

        if updates:
            cols_sql = ", ".join(f"{k} = %s" for k in updates)
            cur.execute(
                f"update public.suppliers set {cols_sql} where id = %s",
                (*updates.values(), supplier_id),
            )
            c.commit()
    return counters


def _list_target_ids(cur) -> Iterable[str]:
    """Suppliers with at least one tier 1-4 source_record AND at least one
    contact column still null."""
    cur.execute(
        """select distinct sr.supplier_id
             from public.source_records sr
             join public.suppliers su on su.id = sr.supplier_id
            where sr.source_tier in ('tier1_gov','tier2_industry','tier3_cert','tier4_brand')
              and (
                su.address_raw is null or su.email_primary is null or
                su.contact_name is null or su.contact_role is null or
                su.website is null or coalesce(array_length(su.phones,1),0) = 0
              )"""
    )
    return [str(r["supplier_id"]) if isinstance(r, dict) else str(r[0]) for r in cur.fetchall()]


def run(limit: int | None = None) -> dict[str, int]:
    stats = {"scanned": 0, "address_raw": 0, "email_primary": 0, "phones": 0,
             "contact_name": 0, "contact_role": 0, "website": 0}
    with db.conn() as c, c.cursor() as cur:
        ids = _list_target_ids(cur)
    if limit is not None:
        ids = list(ids)[:limit]
    log.info("contact_merge.start", n=len(ids))
    for sid in ids:
        stats["scanned"] += 1
        try:
            row = run_for(sid)
            for k, v in row.items():
                stats[k] = stats.get(k, 0) + v
        except Exception as exc:  # noqa: BLE001
            log.error("contact_merge.row_failed", supplier_id=sid, error=str(exc))
        if stats["scanned"] % 500 == 0:
            log.info("contact_merge.progress", **stats)
    log.info("contact_merge.done", **stats)
    return stats
