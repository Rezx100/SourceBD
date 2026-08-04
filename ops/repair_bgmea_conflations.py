"""Split suppliers that hold a BGMEA general-member record for a different company.

WHY
---
Found 4 Aug 2026 by the founder's EPB review: `3S International Ltd.`,
`AKH Knitwear Ltd.`, `Aman Sweaters Ltd.` and `Ananta Sportswear Ltd.` are all
on BGMEA's live member list and were all scraped on 24 Jul 2026 — but none has
a profile, because each record was merged into a sister company's supplier
(3S TEXTILE, AKH Apparels, Aman Knittings, ABM Fashions) by the pre-31-Jul
contact-overlap passes in `_find_existing`: a shared group mailbox or
switchboard number, no name check. The 31 Jul repair
(`ops/unmerge_bkmea_suppliers.py`) and the daily detector
(`ops/check_supplier_conflations.py`) covered BKMEA records only, so the
BGMEA-sourced population from the same defect era was never repaired.
Production scan on 4 Aug found 808 stowaway records.

THE NAME ORACLE
---------------
BKMEA records store the scraped Factory Name in `fields`; BGMEA records never
did — `bgmea_web`'s payload carried no name key (fixed 4 Aug: it now stores
`scraped_company_name`), which is exactly why no detector could see this
class. The oracle here is a snapshot of BGMEA's live member list
(member id -> name + reg number), taken 4 Aug 2026 without re-running the
scraper. Pass it with --members-file; each entry must be
`{"id": "...", "name": "...", "reg": "..."}`.

WHAT IT DOES
------------
For every BGMEA source_record whose ref is `general:{reg}`:

1. Look up the member's name in the oracle; compare against the host
   supplier's name with the SAME normalization + compatibility predicate the
   ingest matcher uses (`normalize_company_name`, `_names_compatible`).
   Compatible, or one name is a normalized prefix of the other (the
   extension/unit class, deliberately separate suppliers): leave alone.
2. Incompatible: the record is a stowaway. A record only ever JOINS an
   existing supplier on exact identity — recomputed-slug equality or squash
   (space-stripped norm) equality, the matcher's Pass 1/1.5 bars.
   Fuzzy-similar candidates (Pass-4 bar) are deliberately NOT joined: the
   first dry run proposed joining Anika Apparels into ANITA APPARELS and
   Bando Apparels into BRAND APPARELS — trading a conflation for a
   conflation. A fuzzy-only candidate means the record gets its own supplier
   and the pair surfaces in the nightly audit's variant signal for a human:
   a visible duplicate is recoverable, a silent conflation is not.
3. Move the record's evidence claims with it and attempt publication on the
   destination (the DB trigger enforces the Tier 1-3 rule server-side).
4. Project the record's own stored fields onto the destination profile —
   employees, machines, capacity, established date, factory types, principal
   products, contact columns — mirroring `ops/backfill_profile_columns.py`
   semantics: numeric fields take the HIGHEST value across sources (founder
   rule, 4 Aug 2026 — three sources with three workforce counts means the
   max, never the sum), arrays union, scalars fill only when empty.
5. Recompute the same columns for every parent that lost a record, from the
   parent's own REMAINING records only, so nothing of the stowaway's data
   lingers on the wrong profile.

Buyer-facing rows (saved_suppliers, message_threads, orders, claim_requests)
are never moved — same rule as the BKMEA unmerge, same reasoning.

TRANSPORT
---------
Supabase REST with the service-role key (SUPABASE_URL +
SUPABASE_SERVICE_ROLE_KEY), because the Postgres pooler ports are unreachable
from the dev machine. There is no wrapping transaction, so every step is
idempotent and ordered so that a mid-run failure leaves a visible,
re-runnable state, never a half-moved record: the record move is the commit
point, and claims/columns follow it. Re-running continues where a crashed or
interrupted run stopped (already-moved records are no longer flagged;
already-created suppliers are found by the exact-identity guard).

USAGE
-----
    python ops/repair_bgmea_conflations.py                     # dry run
    python ops/repair_bgmea_conflations.py --apply             # execute
    python ops/repair_bgmea_conflations.py --apply --limit 5   # slice first
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from typing import Any

import httpx
from rapidfuzz import fuzz

from etl.core.normalize import make_slug, normalize_company_name, normalize_phones
from etl.core.upsert import _FUZZY_THRESHOLD, _names_compatible

DERIVED_COLUMNS = (
    "employees_total",
    "employees_male",
    "employees_female",
    "production_capacity_pcs_day",
    "production_capacity_dozen_yearly",
    "machines_sewing",
)

# Sanity caps carried over from ops/backfill_profile_columns.py.
_CAPS = {
    "employees_total": 200_000,
    "employees_male": 200_000,
    "employees_female": 200_000,
    "machines_sewing": 20_000,
    "production_capacity_pcs_day": 10_000_000,
    "production_capacity_dozen_yearly": 200_000_000,
}

# Prefix compatibility guard: "akh knitting and dyeing extension" hosting the
# record of "akh knitting and dyeing" is the extension/unit class, not a
# conflation. Only trusted when the shorter norm is substantial.
_MIN_PREFIX_LEN = 10

_DIGITS_RE = re.compile(r"[^0-9]")


class Rest:
    def __init__(self) -> None:
        base = os.environ.get("SUPABASE_URL", "").rstrip("/")
        key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
        if not base or not key:
            print("ERROR: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set", file=sys.stderr)
            raise SystemExit(1)
        self.base = base + "/rest/v1"
        self.client = httpx.Client(
            headers={"apikey": key, "Authorization": f"Bearer {key}"}, timeout=60
        )

    def all_rows(self, path: str, params: dict[str, str]) -> list[dict]:
        out: list[dict] = []
        offset = 0
        while True:
            r = self.client.get(
                f"{self.base}/{path}",
                params=params,
                headers={"Range": f"{offset}-{offset + 999}"},
            )
            r.raise_for_status()
            rows = r.json()
            out.extend(rows)
            if len(rows) < 1000:
                return out
            offset += 1000

    def one(self, path: str, params: dict[str, str]) -> dict | None:
        rows = self.all_rows(path, params)
        return rows[0] if rows else None

    def patch(self, path: str, params: dict[str, str], body: dict) -> list[dict]:
        r = self.client.patch(
            f"{self.base}/{path}",
            params=params,
            json=body,
            headers={"Prefer": "return=representation"},
        )
        r.raise_for_status()
        return r.json()

    def insert(self, path: str, body: dict) -> dict:
        r = self.client.post(
            f"{self.base}/{path}",
            json=body,
            headers={"Prefer": "return=representation"},
        )
        r.raise_for_status()
        return r.json()[0]


def _compatible(host_name: str, member_name: str) -> bool:
    a = normalize_company_name(host_name or "")
    b = normalize_company_name(member_name or "")
    if not a or not b:
        # Nothing to compare — do not flag what cannot be checked.
        return True
    if _names_compatible(a, b):
        return True
    shorter, longer = sorted((a, b), key=len)
    return len(shorter) >= _MIN_PREFIX_LEN and longer.startswith(shorter)


class SupplierPool:
    """Precomputed identity index over every supplier (the guard is called
    hundreds of times; recomputing 10k normalizations per call took the first
    dry run to 11 minutes)."""

    def __init__(self, suppliers: list[dict]) -> None:
        self.by_slug: dict[str, list[dict]] = {}
        self.by_squash: dict[str, list[dict]] = {}
        self.normed: list[tuple[str, dict]] = []
        for s in suppliers:
            name = s.get("company_name") or ""
            norm = normalize_company_name(name)
            if not norm:
                continue
            self.by_slug.setdefault(make_slug(name), []).append(s)
            self.by_squash.setdefault(norm.replace(" ", ""), []).append(s)
            self.normed.append((norm, s))

    def add(self, supplier: dict) -> None:
        name = supplier.get("company_name") or ""
        norm = normalize_company_name(name)
        if not norm:
            return
        self.by_slug.setdefault(make_slug(name), []).append(supplier)
        self.by_squash.setdefault(norm.replace(" ", ""), []).append(supplier)
        self.normed.append((norm, supplier))


def _guard_matches(
    member_name: str, pool: SupplierPool | list[dict], exclude_id: str
) -> tuple[list[dict], list[dict]]:
    """(exact, fuzzy) suppliers already carrying this company's identity.

    Exact = recomputed-slug equality or squash equality (the matcher's
    Pass 1/1.5 — no conflation surface). Fuzzy = the Pass-4 bar, returned for
    reporting only: joining on it here would re-conflate (Anika/ANITA,
    Bando/BRAND were both single fuzzy matches on the first dry run).
    Recomputed norms on both sides — stored-column drift is what hid twins.
    """
    if isinstance(pool, list):
        pool = SupplierPool(pool)
    norm = normalize_company_name(member_name)
    slug = make_slug(member_name)
    squash = norm.replace(" ", "")
    exact: list[dict] = []
    seen: set[str] = {exclude_id}
    for s in pool.by_slug.get(slug, []) + pool.by_squash.get(squash, []):
        if s["id"] not in seen:
            seen.add(s["id"])
            exact.append(s)
    fuzzy: list[dict] = []
    for s_norm, s in pool.normed:
        if s["id"] in seen:
            continue
        if (
            fuzz.token_sort_ratio(norm, s_norm) >= _FUZZY_THRESHOLD
            and _names_compatible(norm, s_norm)
        ):
            seen.add(s["id"])
            fuzzy.append(s)
    return exact, fuzzy


# ----------------------------------------------------------------------
# Profile projection — REST port of ops/backfill_profile_columns.py rules
# for the record shapes BGMEA and BKMEA store, applied max-merge (numerics),
# union (arrays), fill-only (scalars/contacts).
# ----------------------------------------------------------------------
def _to_int(value: Any) -> int | None:
    digits = _DIGITS_RE.sub("", str(value or ""))
    return int(digits) if digits else None


def _numbers_from_record(fields: dict[str, Any], source: str) -> dict[str, int]:
    out: dict[str, int] = {}

    def put(col: str, raw: Any) -> None:
        val = _to_int(raw)
        if val and 0 < val <= _CAPS[col]:
            out[col] = max(out.get(col, 0), val)

    if source == "BGMEA":
        employees = fields.get("employees")
        if isinstance(employees, dict):
            for v in employees.values():
                put("employees_total", v)
            put("employees_male", employees.get("Employee Male"))
            put("employees_female", employees.get("Employee Female"))
        put("machines_sewing", fields.get("num_machines"))
        put("production_capacity_dozen_yearly", fields.get("production_capacity_dozen_yearly"))
    elif source == "BKMEA":
        put("employees_total", fields.get("bkmea_employees_total"))
        put("employees_male", fields.get("bkmea_employees_male"))
        put("employees_female", fields.get("bkmea_employees_female"))
        put("machines_sewing", fields.get("bkmea_machines_sewing"))
        put("production_capacity_pcs_day", fields.get("bkmea_production_capacity"))
    return out


def _lists_from_record(fields: dict[str, Any], source: str) -> dict[str, list[str]]:
    factory_types: list[str] = []
    products: list[str] = []
    if source == "BGMEA":
        for ft in fields.get("factory_types") or []:
            t = ((ft or {}).get("Type") or "").strip()
            if t:
                factory_types.append(t)
        for p in fields.get("principal_products") or []:
            p = (p or "").strip()
            if p:
                products.append(p)
    elif source == "BKMEA":
        raw = fields.get("bkmea_products") or ""
        for part in re.split(r"[,;/]+", raw):
            part = part.strip()
            if part:
                products.append(part)
        factory_types.append("Knit")  # every BKMEA member is a knitwear factory
    return {"factory_types": factory_types, "principal_products": products}


def _scalars_from_record(fields: dict[str, Any], source: str) -> dict[str, Any]:
    out: dict[str, Any] = {}
    if source == "BGMEA":
        if (fields.get("established_date") or "").strip():
            out["established_date"] = fields["established_date"].strip()
        address = fields.get("factory_address") or fields.get("mailing_address")
        if address:
            out["address_raw"] = address
        email = fields.get("factory_email") or fields.get("mailing_email")
        if email and "@" in str(email):
            out["email_primary"] = str(email).strip()
        phone = fields.get("factory_phone") or fields.get("mailing_phone")
        if phone:
            phones = normalize_phones(str(phone))
            if phones:
                out["phones"] = phones
    return out


def _merge_into_profile(
    rest: Rest, supplier_id: str, fields: dict[str, Any], source: str, reg: str | None
) -> None:
    """Write the record's data onto the destination profile.

    Numerics: highest value wins across whatever the profile already carries
    (three sources with three workforce counts -> the max, never the sum).
    Arrays: union. Scalars/contacts: fill only when the profile has none.
    """
    current = rest.one(
        "suppliers",
        {
            "select": "id,"
            + ",".join(DERIVED_COLUMNS)
            + ",established_date,factory_types,principal_products,address_raw,"
            "email_primary,phones,bgmea_reg_numbers,bgmea_verified,source_tags",
            "id": f"eq.{supplier_id}",
        },
    )
    if current is None:
        return
    body: dict[str, Any] = {}

    for col, val in _numbers_from_record(fields, source).items():
        if val > (current.get(col) or 0):
            body[col] = val

    lists = _lists_from_record(fields, source)
    for col in ("factory_types", "principal_products"):
        merged = sorted({*(current.get(col) or []), *lists[col]})
        if merged and merged != sorted(current.get(col) or []):
            body[col] = merged

    for col, val in _scalars_from_record(fields, source).items():
        if not current.get(col):
            body[col] = val

    if source == "BGMEA" and reg:
        regs = sorted({*(current.get("bgmea_reg_numbers") or []), reg})
        if regs != sorted(current.get("bgmea_reg_numbers") or []):
            body["bgmea_reg_numbers"] = regs
        if not current.get("bgmea_verified"):
            body["bgmea_verified"] = True
        tags = sorted({*(current.get("source_tags") or []), "BGMEA"})
        if tags != sorted(current.get("source_tags") or []):
            body["source_tags"] = tags

    if body:
        rest.patch("suppliers", {"id": f"eq.{supplier_id}"}, body)


def _recompute_parent(rest: Rest, parent_id: str, source_codes: dict[str, str]) -> None:
    """Rebuild the parent's derived numbers from its REMAINING records only.

    The stowaway's worker count must not linger on the wrong profile, and the
    parent's own numbers must survive — so the columns are recomputed from
    scratch, not max-merged with the polluted current values.
    """
    records = rest.all_rows(
        "source_records",
        {
            "select": "source_id,fields",
            "supplier_id": f"eq.{parent_id}",
            "status": "eq.active",
        },
    )
    best: dict[str, int] = {}
    for rec in records:
        source = source_codes.get(rec["source_id"])
        if source not in ("BGMEA", "BKMEA"):
            continue
        for col, val in _numbers_from_record(rec.get("fields") or {}, source).items():
            best[col] = max(best.get(col, 0), val)
    body: dict[str, Any] = {c: best.get(c) for c in DERIVED_COLUMNS}
    rest.patch("suppliers", {"id": f"eq.{parent_id}"}, body)


def _unique_slug(rest: Rest, base: str, taken: set[str]) -> str:
    base = base or "supplier"
    for suffix in range(0, 100):
        candidate = base if suffix == 0 else f"{base}-{suffix + 1}"
        if candidate in taken:
            continue
        if rest.one("suppliers", {"select": "id", "slug": f"eq.{candidate}"}) is None:
            taken.add(candidate)
            return candidate
    raise RuntimeError(f"no free slug for {base!r}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="execute (default: dry run)")
    parser.add_argument("--limit", type=int, default=None, help="only process N conflations")
    parser.add_argument(
        "--members-file",
        default="ops/_tmp_bgmea_live_members.json",
        help="BGMEA live member-list snapshot (id/name/reg per entry)",
    )
    args = parser.parse_args()

    with open(args.members_file, encoding="utf-8") as f:
        members = json.load(f)
    by_reg = {m["reg"].strip(): m["name"].strip() for m in members if m.get("reg")}
    print(f"oracle: {len(by_reg)} members by reg")

    rest = Rest()
    src = rest.one("sources", {"select": "id,code", "code": "eq.BGMEA"})
    if src is None:
        print("ERROR: BGMEA source row not found", file=sys.stderr)
        return 1
    sources = rest.all_rows("sources", {"select": "id,code"})
    source_codes = {s["id"]: s["code"] for s in sources}

    records = rest.all_rows(
        "source_records",
        {
            "select": "id,supplier_id,source_id,source_ref",
            "source_id": f"eq.{src['id']}",
            "source_ref": "like.general:*",
        },
    )
    suppliers = rest.all_rows(
        "suppliers", {"select": "id,company_name,slug,is_published"}
    )
    sup_by_id = {s["id"]: s for s in suppliers}
    pool = SupplierPool(suppliers)
    print(f"{len(records)} BGMEA general records, {len(suppliers)} suppliers loaded")

    conflations: list[dict] = []
    no_oracle = 0
    for rec in records:
        reg = rec["source_ref"].split(":", 1)[1]
        member_name = by_reg.get(reg)
        if member_name is None:
            no_oracle += 1
            continue
        host = sup_by_id.get(rec["supplier_id"])
        if host is None:
            continue
        if not _compatible(host["company_name"], member_name):
            conflations.append(
                {"record": rec, "reg": reg, "member_name": member_name, "host": host}
            )

    print(
        f"{len(conflations)} stowaway record(s) detected "
        f"({no_oracle} record(s) had no live-list entry — resigned members, skipped)\n"
    )

    if args.limit is not None:
        conflations = conflations[: args.limit]

    created = joined = skipped_ambiguous = stranded = published = errors = 0
    slugs_taken: set[str] = set()
    dest_by_slug: dict[str, str] = {}  # one destination per company across the run
    parents_touched: set[str] = set()

    for c in sorted(conflations, key=lambda x: x["member_name"].lower()):
        rec, host = c["record"], c["host"]
        member_name = c["member_name"]
        member_slug = make_slug(member_name)
        exact, fuzzy = _guard_matches(member_name, pool, host["id"])

        if len(exact) > 1:
            skipped_ambiguous += 1
            names = ", ".join(f"{m['company_name']!r}" for m in exact)
            print(f"SKIP  {member_name!r} (reg {c['reg']}) hosted by {host['company_name']!r}")
            print(f"      {len(exact)} exact-identity candidates ({names}) — human decides")
            continue

        dest_id = dest_by_slug.get(member_slug) or (exact[0]["id"] if exact else None)
        action = (
            "join-prior-split" if member_slug in dest_by_slug
            else ("join-existing" if exact else "create")
        )
        note = ""
        if exact and action == "join-existing":
            note = f" -> {exact[0]['company_name']!r}"
        elif not exact and fuzzy:
            names = ", ".join(f"{m['company_name']!r}" for m in fuzzy[:3])
            note = f"; fuzzy near-matches NOT joined: {names} (audit variant signal will report)"
        print(
            f"move  {member_name!r} (reg {c['reg']}) out of {host['company_name']!r} "
            f"[{action}{note}]"
        )

        if not args.apply:
            dest_by_slug.setdefault(member_slug, "dry-run")
            created += action == "create"
            joined += action != "create"
            continue

        try:
            full = rest.one(
                "source_records", {"select": "id,fields", "id": f"eq.{rec['id']}"}
            )
            fields = (full or {}).get("fields") or {}

            if dest_id is None:
                slug = _unique_slug(rest, member_slug, slugs_taken)
                body = {
                    "company_name": member_name,
                    "slug": slug,
                    "company_name_norm": normalize_company_name(member_name),
                }
                try:
                    new_supplier = rest.insert("suppliers", body)
                except httpx.HTTPStatusError as exc:
                    if exc.response.status_code != 409:
                        raise
                    # A previous interrupted run already created it; adopt it.
                    existing = rest.one(
                        "suppliers",
                        {"select": "id,company_name,slug", "slug": f"eq.{slug}"},
                    )
                    if existing is None:
                        raise
                    new_supplier = existing
                dest_id = new_supplier["id"]
                pool.add({"id": dest_id, "company_name": member_name})
                created += 1
            else:
                joined += 1
            dest_by_slug[member_slug] = dest_id

            # Commit point: the record move. Unique (supplier_id, source_id,
            # source_ref) collision means the destination already holds this
            # page — leave the duplicate stranded on the parent, visible and
            # fixable.
            collision = rest.one(
                "source_records",
                {
                    "select": "id",
                    "supplier_id": f"eq.{dest_id}",
                    "source_id": f"eq.{rec['source_id']}",
                    "source_ref": f"eq.{rec['source_ref']}",
                },
            )
            if collision:
                stranded += 1
                print("      stranded — destination already holds this source page")
                continue
            moved = rest.patch(
                "source_records",
                {"id": f"eq.{rec['id']}", "supplier_id": f"eq.{host['id']}"},
                {"supplier_id": dest_id},
            )
            if not moved:
                stranded += 1
                print("      record no longer on parent — skipped (already repaired?)")
                continue

            rest.patch(
                "evidence_claims",
                {
                    "supplier_id": f"eq.{host['id']}",
                    "subject_table": "eq.source_records",
                    "subject_id": f"eq.{rec['id']}",
                },
                {"supplier_id": dest_id},
            )
            parents_touched.add(host["id"])

            # The moved company keeps its data: project the record's fields
            # onto the destination (max-merge numerics, union arrays,
            # fill-only scalars).
            _merge_into_profile(rest, dest_id, fields, "BGMEA", c["reg"])

            try:
                rows = rest.patch(
                    "suppliers",
                    {"id": f"eq.{dest_id}", "is_published": "eq.false"},
                    {"is_published": True},
                )
                published += len(rows)
            except httpx.HTTPStatusError as exc:
                print(f"      publish refused by trigger: {exc.response.text[:120]}")
        except Exception as exc:  # noqa: BLE001
            errors += 1
            print(f"      ERROR, continuing: {exc}")

    if args.apply and parents_touched:
        print(f"\nrecomputing derived columns for {len(parents_touched)} parent(s)…")
        for pid in parents_touched:
            try:
                _recompute_parent(rest, pid, source_codes)
            except Exception as exc:  # noqa: BLE001
                errors += 1
                print(f"  ERROR recomputing {pid}: {exc}")

    print(
        f"\n{len(conflations)} conflation(s) processed: {created} new supplier(s), "
        f"{joined} joined an existing supplier, {skipped_ambiguous} skipped as ambiguous, "
        f"{stranded} stranded duplicates; {published} newly published; "
        f"{len(parents_touched)} parent(s) recomputed; {errors} error(s)."
    )
    if args.apply:
        print("Applied." if not errors else "Applied with errors — re-run to converge.")
    else:
        print("Dry run — nothing written. Re-run with --apply to execute.")
    return 0 if not errors else 1


if __name__ == "__main__":
    sys.exit(main())
