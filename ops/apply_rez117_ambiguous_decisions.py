"""REZ-117: apply founder decisions on the 18 ambiguous BGMEA records.

Policy (12 Aug 2026): Associate-register companies are buying houses
(entity_type=buying_house). Take associate numbers off factories that are a
different company; import a buying-house row when needed.

Decisions: ops/plans/bgmea-attribution-decisions.md §2.

Dry-run by default. --apply requires --expect-fingerprint.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal

import httpx
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

from etl.core.bgmea_identity import identity_from_source_record  # noqa: E402
from etl.core.normalize import make_slug, normalize_company_name  # noqa: E402

SNAPSHOT_DIR = Path(__file__).resolve().parent / "plans"
NAMES_PATH = SNAPSHOT_DIR / "bgmea-names.json"
ACCEPTED_FINGERPRINT = (
    "7dbe53dc01e5747b5b683d0cdc9ad39592e4ec5c240c19ecf6d435cc078d5a26"
)

Action = Literal["stay", "stay_retag", "move", "move_retag", "import_move"]


@dataclass(frozen=True)
class Decision:
    ref: str
    action: Action
    from_slug: str
    to_slug: str | None  # None for import (slug derived from registered_name)
    registered_name: str
    set_buying_house: bool
    notes: str = ""


# Exact founder table — do not re-derive.
DECISIONS: tuple[Decision, ...] = (
    Decision("953", "import_move", "as-knitwear", None, "A. S. Fashion", True, "prop Md. Shamsul Alam"),
    Decision("231", "stay_retag", "am-fashion", "am-fashion", "A.M. Fashion International Ltd.", True, "same legal entity"),
    Decision("330", "import_move", "ra-apparels", None, "A.R. Fashion", True, "not AKR/HAR"),
    Decision("679", "stay", "atima-fashions", "atima-fashions", "Atima Knitwear Ltd.", False, "sister ops founder ruling"),
    Decision("1573", "import_move", "desh-bangla-enterprise", None, "Bangladesh Apparel Inc.", True),
    Decision("1020", "import_move", "jr-enterprise", None, "J.R. International", True),
    Decision("1398", "stay", "jms-clothing", "jms-clothing", "JMS International", False, "sister trade identities"),
    Decision("1129", "import_move", "nm-fashion", None, "M.N. Enterprise", True),
    Decision("296", "import_move", "shan-knitting-and-processing", None, "Maxim International", True),
    Decision("1283", "move_retag", "ms-fashion-wear", "mim-fashion-wear", "Mim Fashion wear's", True),
    Decision("528", "import_move", "as-knitwear", None, "S.A. Fashion", True),
    Decision("1261", "import_move", "tex-apparels", None, "Tex Fashion (BD)", True),
    Decision("331", "move_retag", "mirza-fashion-and-design", "union-fashion", "Union Fashion", True),
    Decision("general:4572", "stay", "kenpark-bangladesh", "kenpark-bangladesh", "Kenpark Bangladesh Apparel (Pvt) Ltd.", False, "parent identity"),
    Decision("general:5756", "move", "cut-n-sew", "snowtex-outerwear", "Snowtex Outerwear Ltd.", False),
    Decision("general:3778", "move", "4a-yarn-dyeing", "south-end-sweater", "South End Sweater Co. Ltd.", False),
    Decision("general:3624", "move", "gm-fashion", "southeast-sweater", "Southeast Sweaters Ltd.", False),
    Decision(
        "general:2436",
        "move",
        "univogue-garments",
        "univogue-garments-co-ltd-unit-2",
        "Univogue Garments Co. Ltd. Unit-II",
        False,
        "unpublished building; mother must show building_name",
    ),
)

# Associate refs allowed to remain on a factory host (founder STAY, no retag).
ASSOCIATE_ON_FACTORY_ALLOWLIST: frozenset[str] = frozenset({"679", "1398"})


class Rest:
    def __init__(self) -> None:
        base = os.environ.get("SUPABASE_URL", "").rstrip("/")
        key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
        if not base or not key:
            raise SystemExit("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set")
        self.base = base + "/rest/v1"
        self.rpc = base + "/rest/v1/rpc"
        self.client = httpx.Client(
            headers={"apikey": key, "Authorization": f"Bearer {key}"},
            timeout=120,
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
        data = r.json()
        return data[0] if isinstance(data, list) else data

    def rpc_json(self, name: str, body: dict) -> Any:
        r = self.client.post(f"{self.rpc}/{name}", json=body)
        r.raise_for_status()
        return r.json()


@dataclass
class PlannedItem:
    ref: str
    action: Action
    source_record_id: str
    source_id: str
    from_supplier_id: str
    from_slug: str
    to_supplier_id: str | None
    to_slug: str
    to_exists: bool
    create_name: str | None
    identity: str
    set_buying_house: bool
    notes: str
    to_is_published: bool | None = None
    to_facility_of: str | None = None
    mother_slug: str | None = None


def fingerprint(plan: list[PlannedItem]) -> str:
    payload = [
        {
            "ref": p.ref,
            "action": p.action,
            "source_record_id": p.source_record_id,
            "from_supplier_id": p.from_supplier_id,
            "from_slug": p.from_slug,
            "to_slug": p.to_slug,
            "to_supplier_id": p.to_supplier_id,
            "create_name": p.create_name,
            "identity": p.identity,
            "set_buying_house": p.set_buying_house,
            "to_is_published": p.to_is_published,
            "to_facility_of": p.to_facility_of,
            "mother_slug": p.mother_slug,
        }
        for p in sorted(plan, key=lambda x: x.ref)
    ]
    return hashlib.sha256(
        json.dumps(payload, separators=(",", ":"), ensure_ascii=True).encode()
    ).hexdigest()


def _bgmea_id(rest: Rest) -> str:
    row = rest.one("sources", {"select": "id", "code": "eq.BGMEA"})
    if not row:
        raise RuntimeError("BGMEA source missing")
    return str(row["id"])


def _supplier(rest: Rest, slug: str) -> dict:
    row = rest.one(
        "suppliers",
        {
            "select": "id,slug,company_name,entity_type,is_published,facility_of,bgmea_reg_numbers",
            "slug": f"eq.{slug}",
        },
    )
    if not row:
        raise RuntimeError(f"supplier not found: {slug}")
    return row


def _active_sr(rest: Rest, source_id: str, ref: str) -> dict:
    row = rest.one(
        "source_records",
        {
            "select": "id,supplier_id,source_id,source_ref,status,fields",
            "source_id": f"eq.{source_id}",
            "source_ref": f"eq.{ref}",
            "status": "eq.active",
        },
    )
    if not row:
        raise RuntimeError(f"active BGMEA SR missing for {ref}")
    return row


def _identities(rest: Rest, source_id: str, supplier_id: str) -> list[str]:
    rows = rest.all_rows(
        "source_records",
        {
            "select": "source_ref,fields",
            "source_id": f"eq.{source_id}",
            "supplier_id": f"eq.{supplier_id}",
            "status": "eq.active",
        },
    )
    out = []
    for rec in rows:
        ident = identity_from_source_record(rec)
        if ident:
            out.append(ident)
    return sorted(set(out))


def _locked_columns(rest: Rest, supplier_id: str) -> set[str]:
    rows = rest.all_rows(
        "supplier_field_locks",
        {
            "select": "column_name",
            "supplier_id": f"eq.{supplier_id}",
            "released_at": "is.null",
        },
    )
    return {str(r["column_name"]) for r in rows if r.get("column_name")}


def _decision_dest_slug(d: Decision) -> str:
    if d.action in ("stay", "stay_retag"):
        return d.from_slug
    if d.action in ("move", "move_retag"):
        assert d.to_slug
        return d.to_slug
    return make_slug(d.registered_name)


def _gate_univogue_unit2(rest: Rest, dest: dict) -> tuple[str, str]:
    """Return (facility_of, mother_slug). Raise if attachment is wrong."""
    facility_of = dest.get("facility_of")
    if not facility_of:
        raise RuntimeError(
            "general:2436 destination must be an attached facility (facility_of required)"
        )
    mother = rest.one(
        "suppliers",
        {"select": "id,slug,is_published", "id": f"eq.{facility_of}"},
    )
    if not mother or not mother.get("is_published"):
        raise RuntimeError("general:2436: destination facility mother missing/unpublished")
    if mother["slug"] != "univogue-garments":
        raise RuntimeError("general:2436 destination mother must be univogue-garments")
    if dest.get("is_published"):
        raise RuntimeError("general:2436 destination must remain unpublished building")
    return str(facility_of), str(mother["slug"])


def assert_univogue_2436_visible_on_mother(rest: Rest) -> None:
    payload = rest.rpc_json(
        "buyer_supplier_profile", {"p_slug": "univogue-garments"}
    )
    pills = payload.get("pills") or []
    ok = [
        x
        for x in pills
        if x.get("source_code") == "BGMEA"
        and str(x.get("value")) == "2436"
        and x.get("building_name")
    ]
    if not ok:
        raise RuntimeError(
            "POST-APPLY: univogue-garments missing BGMEA 2436 with building_name"
        )


def _bgmea_pill_values(payload: dict) -> set[str]:
    out: set[str] = set()
    for p in payload.get("pills") or []:
        if p.get("source_code") == "BGMEA" and p.get("value") is not None:
            out.add(str(p["value"]))
    return out


def assert_profile_entity_type(rest: Rest, slug: str, expected: str) -> None:
    payload = rest.rpc_json("buyer_supplier_profile", {"p_slug": slug})
    supplier = payload.get("supplier") or {}
    got = supplier.get("entity_type") if isinstance(supplier, dict) else None
    if got is None:
        got = payload.get("entity_type")
    if got != expected:
        raise RuntimeError(
            f"POST-APPLY: {slug} entity_type={got!r} want {expected!r}"
        )


def assert_bgmea_value_on_profile(rest: Rest, slug: str, value: str) -> None:
    payload = rest.rpc_json("buyer_supplier_profile", {"p_slug": slug})
    if value not in _bgmea_pill_values(payload):
        raise RuntimeError(f"POST-APPLY: {slug} missing BGMEA pill value {value}")


def assert_bgmea_value_absent_on_profile(rest: Rest, slug: str, value: str) -> None:
    payload = rest.rpc_json("buyer_supplier_profile", {"p_slug": slug})
    if value in _bgmea_pill_values(payload):
        raise RuntimeError(f"POST-APPLY: {slug} still shows BGMEA pill value {value}")


def assert_named_counterexample_profiles(rest: Rest) -> None:
    """RPC/HTTP boundary for the issue's named counterexamples."""
    assert_bgmea_value_absent_on_profile(rest, "as-knitwear", "953")
    assert_bgmea_value_absent_on_profile(rest, "as-knitwear", "528")
    assert_bgmea_value_on_profile(rest, "as-fashion", "953")
    assert_profile_entity_type(rest, "as-fashion", "buying_house")
    assert_bgmea_value_on_profile(rest, "sa-fashion", "528")
    assert_profile_entity_type(rest, "sa-fashion", "buying_house")

    assert_bgmea_value_on_profile(rest, "am-fashion", "231")
    assert_profile_entity_type(rest, "am-fashion", "buying_house")

    assert_bgmea_value_absent_on_profile(rest, "mirza-fashion-and-design", "331")
    assert_bgmea_value_absent_on_profile(rest, "union-fashions", "331")
    assert_bgmea_value_on_profile(rest, "union-fashion", "331")
    assert_profile_entity_type(rest, "union-fashion", "buying_house")

    assert_bgmea_value_absent_on_profile(rest, "cut-n-sew", "5756")
    assert_bgmea_value_on_profile(rest, "snowtex-outerwear", "5756")
    assert_bgmea_value_absent_on_profile(rest, "4a-yarn-dyeing", "3778")
    assert_bgmea_value_on_profile(rest, "south-end-sweater", "3778")
    assert_bgmea_value_absent_on_profile(rest, "gm-fashion", "3624")
    assert_bgmea_value_on_profile(rest, "southeast-sweater", "3624")

    assert_univogue_2436_visible_on_mother(rest)


def build_plan(rest: Rest) -> list[PlannedItem]:
    source_id = _bgmea_id(rest)
    plan: list[PlannedItem] = []
    for d in DECISIONS:
        sr = _active_sr(rest, source_id, d.ref)
        host = _supplier(rest, d.from_slug)
        dest_row: dict | None = None
        if str(sr["supplier_id"]) != str(host["id"]):
            if d.to_slug:
                dest_row = _supplier(rest, d.to_slug)
                if str(sr["supplier_id"]) == str(dest_row["id"]):
                    # Already on destination — still plan a retag if needed.
                    if d.set_buying_house and dest_row.get("entity_type") != "buying_house":
                        plan.append(
                            PlannedItem(
                                ref=d.ref,
                                action="stay_retag",
                                source_record_id=str(sr["id"]),
                                source_id=source_id,
                                from_supplier_id=str(dest_row["id"]),
                                from_slug=d.to_slug,
                                to_supplier_id=str(dest_row["id"]),
                                to_slug=d.to_slug,
                                to_exists=True,
                                create_name=None,
                                identity=identity_from_source_record(sr) or "",
                                set_buying_house=True,
                                notes="idempotent retag after prior move",
                                to_is_published=bool(dest_row.get("is_published")),
                            )
                        )
                    continue
            if d.action == "import_move":
                holder = rest.one(
                    "suppliers",
                    {
                        "select": "id,slug,company_name,entity_type,is_published",
                        "id": f"eq.{sr['supplier_id']}",
                    },
                )
                if holder and normalize_company_name(
                    holder.get("company_name") or ""
                ) == normalize_company_name(d.registered_name):
                    if d.set_buying_house and holder.get("entity_type") != "buying_house":
                        plan.append(
                            PlannedItem(
                                ref=d.ref,
                                action="stay_retag",
                                source_record_id=str(sr["id"]),
                                source_id=source_id,
                                from_supplier_id=str(holder["id"]),
                                from_slug=str(holder["slug"]),
                                to_supplier_id=str(holder["id"]),
                                to_slug=str(holder["slug"]),
                                to_exists=True,
                                create_name=None,
                                identity=identity_from_source_record(sr) or "",
                                set_buying_house=True,
                                notes="idempotent retag after prior import",
                                to_is_published=bool(holder.get("is_published")),
                            )
                        )
                    continue
            raise RuntimeError(
                f"{d.ref}: expected on {d.from_slug}, found supplier_id={sr['supplier_id']}"
            )
        ident = identity_from_source_record(sr)
        if not ident:
            raise RuntimeError(f"{d.ref}: no register identity")

        to_slug = d.to_slug
        to_id: str | None = None
        to_exists = False
        create_name: str | None = None
        to_is_published: bool | None = None
        to_facility_of: str | None = None
        mother_slug: str | None = None

        if d.action in ("stay", "stay_retag"):
            to_slug = d.from_slug
            to_id = str(host["id"])
            to_exists = True
            to_is_published = bool(host.get("is_published"))
        elif d.action in ("move", "move_retag"):
            assert d.to_slug
            dest = dest_row or _supplier(rest, d.to_slug)
            to_slug = d.to_slug
            to_id = str(dest["id"])
            to_exists = True
            to_is_published = bool(dest.get("is_published"))
            if d.ref == "general:2436":
                to_facility_of, mother_slug = _gate_univogue_unit2(rest, dest)
            elif dest.get("facility_of"):
                to_facility_of = str(dest["facility_of"])
        elif d.action == "import_move":
            create_name = d.registered_name
            to_slug = make_slug(d.registered_name)
            existing = rest.one(
                "suppliers",
                {
                    "select": "id,slug,entity_type,company_name,is_published",
                    "slug": f"eq.{to_slug}",
                },
            )
            if existing:
                if normalize_company_name(
                    existing.get("company_name") or ""
                ) != normalize_company_name(d.registered_name):
                    raise RuntimeError(
                        f"{d.ref}: slug {to_slug!r} occupied by "
                        f"{existing.get('company_name')!r} — refuse import_move"
                    )
                to_id = str(existing["id"])
                to_exists = True
                to_slug = existing["slug"]
                to_is_published = bool(existing.get("is_published"))
            else:
                to_exists = False
                to_is_published = True
        else:
            raise RuntimeError(f"unknown action {d.action}")

        plan.append(
            PlannedItem(
                ref=d.ref,
                action=d.action,
                source_record_id=str(sr["id"]),
                source_id=source_id,
                from_supplier_id=str(host["id"]),
                from_slug=d.from_slug,
                to_supplier_id=to_id,
                to_slug=to_slug or "",
                to_exists=to_exists,
                create_name=create_name,
                identity=ident,
                set_buying_house=d.set_buying_house,
                notes=d.notes,
                to_is_published=to_is_published,
                to_facility_of=to_facility_of,
                mother_slug=mother_slug,
            )
        )
    return plan


def _reconcile(rest: Rest, source_id: str, *supplier_ids: str) -> None:
    for sid in sorted(set(supplier_ids)):
        if not sid:
            continue
        locked = _locked_columns(rest, sid)
        if "bgmea_reg_numbers" in locked:
            raise RuntimeError(
                f"supplier {sid} has bgmea_reg_numbers locked — cannot reconcile"
            )
        identities = _identities(rest, source_id, sid)
        patched = rest.patch(
            "suppliers",
            {"id": f"eq.{sid}"},
            {"bgmea_reg_numbers": identities},
        )
        if not patched:
            raise RuntimeError(f"failed bgmea_reg_numbers write for {sid}")
        held = [str(x) for x in (patched[0].get("bgmea_reg_numbers") or [])]
        if sorted(held) != identities:
            raise RuntimeError(
                f"bgmea_reg_numbers mismatch after write on {sid}: "
                f"held={held} derived={identities}"
            )


def _retag_buying_house(rest: Rest, supplier_id: str) -> None:
    locked = _locked_columns(rest, supplier_id)
    if "entity_type" in locked:
        raise RuntimeError(
            f"supplier {supplier_id} has entity_type locked — cannot retag buying_house"
        )
    patched = rest.patch(
        "suppliers",
        {"id": f"eq.{supplier_id}"},
        {"entity_type": "buying_house"},
    )
    if not patched or patched[0].get("entity_type") != "buying_house":
        raise RuntimeError(f"failed to retag buying_house on {supplier_id}")


def _compensate_move(
    rest: Rest,
    source_id: str,
    p: PlannedItem,
    dest_id: str,
    *,
    created_dest: bool = False,
    retagged_dest: bool = False,
    prior_entity_type: str | None = None,
) -> None:
    """Reverse one move after a mid-apply failure; raise if reverse fails."""
    moved = rest.patch(
        "source_records",
        {"id": f"eq.{p.source_record_id}"},
        {"supplier_id": p.from_supplier_id},
    )
    if not moved or str(moved[0].get("supplier_id")) != p.from_supplier_id:
        raise RuntimeError(f"compensate failed for source_record {p.ref}")
    rest.patch(
        "evidence_claims",
        {
            "subject_table": "eq.source_records",
            "subject_id": f"eq.{p.source_record_id}",
        },
        {"supplier_id": p.from_supplier_id},
    )
    stale = rest.all_rows(
        "evidence_claims",
        {
            "select": "id,supplier_id",
            "subject_table": "eq.source_records",
            "subject_id": f"eq.{p.source_record_id}",
        },
    )
    for c in stale:
        if str(c.get("supplier_id")) != p.from_supplier_id:
            raise RuntimeError(f"compensate: evidence_claims still wrong for {p.ref}")
    if created_dest:
        # Soft-delete path: unpublish so the orphan is not buyer-visible.
        rest.patch(
            "suppliers",
            {"id": f"eq.{dest_id}"},
            {"is_published": False},
        )
    elif retagged_dest and prior_entity_type and prior_entity_type != "buying_house":
        rest.patch(
            "suppliers",
            {"id": f"eq.{dest_id}"},
            {"entity_type": prior_entity_type},
        )
    _reconcile(rest, source_id, p.from_supplier_id, dest_id)


def apply_plan(rest: Rest, plan: list[PlannedItem]) -> None:
    source_id = _bgmea_id(rest)
    for p in plan:
        dest_id = p.to_supplier_id
        created_dest = False
        retagged_dest = False
        prior_entity_type: str | None = None

        if p.action == "import_move" and not p.to_exists:
            assert p.create_name
            hit = rest.one("suppliers", {"select": "id", "slug": f"eq.{p.to_slug}"})
            if hit:
                raise RuntimeError(
                    f"{p.ref}: approved slug {p.to_slug!r} appeared before create — "
                    "fingerprint void"
                )
            created = rest.insert(
                "suppliers",
                {
                    "company_name": p.create_name,
                    "slug": p.to_slug,
                    "company_name_norm": normalize_company_name(p.create_name),
                    "entity_type": "buying_house",
                    "is_published": True,
                },
            )
            dest_id = str(created["id"])
            p.to_supplier_id = dest_id
            created_dest = True
            retagged_dest = True
            prior_entity_type = None
        elif p.action == "import_move" and dest_id:
            if p.set_buying_house:
                row = rest.one(
                    "suppliers",
                    {"select": "entity_type", "id": f"eq.{dest_id}"},
                )
                prior_entity_type = None if not row else row.get("entity_type")
                if prior_entity_type != "buying_house":
                    _retag_buying_house(rest, dest_id)
                    retagged_dest = True

        if p.action in ("stay", "stay_retag"):
            if p.set_buying_house:
                _retag_buying_house(rest, p.from_supplier_id)
            continue

        assert dest_id
        if str(p.from_supplier_id) == dest_id:
            if p.set_buying_house:
                _retag_buying_house(rest, dest_id)
            continue

        prior_claims = rest.all_rows(
            "evidence_claims",
            {
                "select": "id,supplier_id",
                "subject_table": "eq.source_records",
                "subject_id": f"eq.{p.source_record_id}",
            },
        )
        if p.set_buying_house and not created_dest and not retagged_dest:
            row = rest.one(
                "suppliers",
                {"select": "entity_type", "id": f"eq.{dest_id}"},
            )
            prior_entity_type = None if not row else row.get("entity_type")

        moved = rest.patch(
            "source_records",
            {
                "id": f"eq.{p.source_record_id}",
                "supplier_id": f"eq.{p.from_supplier_id}",
            },
            {"supplier_id": dest_id},
        )
        if not moved:
            if created_dest:
                rest.patch(
                    "suppliers",
                    {"id": f"eq.{dest_id}"},
                    {"is_published": False},
                )
            elif retagged_dest and prior_entity_type and prior_entity_type != "buying_house":
                rest.patch(
                    "suppliers",
                    {"id": f"eq.{dest_id}"},
                    {"entity_type": prior_entity_type},
                )
            raise RuntimeError(f"failed to move {p.ref}")
        try:
            if prior_claims:
                claims = rest.patch(
                    "evidence_claims",
                    {
                        "subject_table": "eq.source_records",
                        "subject_id": f"eq.{p.source_record_id}",
                    },
                    {"supplier_id": dest_id},
                )
                if len(claims) != len(prior_claims):
                    raise RuntimeError(
                        f"{p.ref}: evidence_claims patch incomplete "
                        f"{len(claims)}/{len(prior_claims)}"
                    )
                verify = rest.all_rows(
                    "evidence_claims",
                    {
                        "select": "id,supplier_id",
                        "subject_table": "eq.source_records",
                        "subject_id": f"eq.{p.source_record_id}",
                    },
                )
                if len(verify) != len(prior_claims) or any(
                    str(c.get("supplier_id")) != dest_id for c in verify
                ):
                    raise RuntimeError(
                        f"{p.ref}: evidence_claims not fully repointed"
                    )
            else:
                leftover = rest.all_rows(
                    "evidence_claims",
                    {
                        "select": "id,supplier_id",
                        "subject_table": "eq.source_records",
                        "subject_id": f"eq.{p.source_record_id}",
                    },
                )
                if leftover:
                    raise RuntimeError(
                        f"{p.ref}: evidence_claims appeared during move — refuse"
                    )
            if p.set_buying_house and not created_dest:
                if prior_entity_type != "buying_house":
                    _retag_buying_house(rest, dest_id)
                    retagged_dest = True
            _reconcile(rest, source_id, p.from_supplier_id, dest_id)
            if p.ref == "general:2436":
                assert_univogue_2436_visible_on_mother(rest)
        except Exception:
            _compensate_move(
                rest,
                source_id,
                p,
                dest_id,
                created_dest=created_dest,
                retagged_dest=retagged_dest,
                prior_entity_type=prior_entity_type,
            )
            raise


def rez117_decision_violations(ref_holders: dict[str, set[str]]) -> list[str]:
    """Post-apply placement: moves/imports must sit only on the destination."""
    lines: list[str] = []
    for d in DECISIONS:
        holders = ref_holders.get(d.ref, set())
        if not holders:
            lines.append(f"  {d.ref} missing from active BGMEA records")
            continue
        dest = _decision_dest_slug(d)
        if d.action in ("stay", "stay_retag"):
            allowed = {dest}
        else:
            # Destination only — from_slug still holding is a post-apply defect.
            allowed = {dest}
        if holders != allowed:
            lines.append(
                f"  {d.ref} on {sorted(holders)} — must be exactly on {dest!r} "
                f"({d.action})"
            )
    return lines


def rez117_buying_house_tag_violations(
    ref_holders: dict[str, set[str]],
    entity_by_slug: dict[str, str],
) -> list[str]:
    """Destinations that hold a retag ref must be buying_house."""
    lines: list[str] = []
    for d in DECISIONS:
        if not d.set_buying_house:
            continue
        holders = ref_holders.get(d.ref, set())
        dest = _decision_dest_slug(d)
        if dest not in holders:
            continue
        et = entity_by_slug.get(dest)
        if et != "buying_house":
            lines.append(
                f"  {d.ref} host {dest!r} entity_type={et!r} — need buying_house"
            )
    return lines


def rez117_associate_on_factory_violations(
    ref_holders: dict[str, set[str]],
    entity_by_slug: dict[str, str],
    member_type_by_ref: dict[str, str],
) -> list[str]:
    """Associate SR on factory without founder allowlist (scoped to the 18)."""
    lines: list[str] = []
    decision_refs = {d.ref for d in DECISIONS}
    for ref, holders in sorted(ref_holders.items()):
        if ref not in decision_refs:
            continue
        if ref.startswith("general:"):
            continue
        mt = (member_type_by_ref.get(ref) or "associate").lower()
        if mt.startswith("general"):
            continue
        if not (mt.startswith("associate") or mt == ""):
            continue
        if ref in ASSOCIATE_ON_FACTORY_ALLOWLIST:
            continue
        for slug in holders:
            et = entity_by_slug.get(slug)
            if et == "factory":
                lines.append(
                    f"  associate {ref} on factory {slug!r} — not in founder allowlist"
                )
    return lines


def write_snapshot(plan: list[PlannedItem], rest: Rest) -> Path:
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    path = SNAPSHOT_DIR / f"_snapshot_rez117_ambiguous_{stamp}.json"
    blob = {
        "created_at": stamp,
        "fingerprint": fingerprint(plan),
        "plan": [asdict(p) for p in plan],
    }
    path.write_text(json.dumps(blob, indent=2) + "\n", encoding="utf-8")
    return path


def print_plan(plan: list[PlannedItem], fp: str) -> None:
    print("== REZ-117 ambiguous BGMEA decisions (dry-run) ==")
    print(f"items: {len(plan)}  expected: {len(DECISIONS)}")
    print(f"fingerprint: {fp}")
    for p in plan:
        create = f" CREATE:{p.create_name!r}" if p.create_name and not p.to_exists else ""
        tag = " +buying_house" if p.set_buying_house else ""
        print(
            f"{p.ref:16} {p.action:12} {p.from_slug} -> {p.to_slug}{create}{tag}  {p.notes}"
        )


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--expect-fingerprint", default="")
    args = ap.parse_args()
    rest = Rest()
    plan = build_plan(rest)
    fp = fingerprint(plan)
    print_plan(plan, fp)
    if len(plan) != len(DECISIONS):
        # Pre-apply dry-run must cover all 18. Residual plans after a partial
        # apply are allowed only with --apply and a matching remainder fingerprint.
        if not args.apply:
            print(
                f"ERROR: plan size {len(plan)} != {len(DECISIONS)}",
                file=sys.stderr,
            )
            return 2
    if not args.apply:
        print(
            "\nDry-run only. Re-run with --apply --expect-fingerprint <sha> "
            "after acceptance."
        )
        return 0
    if not args.expect_fingerprint:
        print("ERROR: --apply requires --expect-fingerprint", file=sys.stderr)
        return 2
    plan2 = build_plan(rest)
    fp2 = fingerprint(plan2)
    if fp2 != args.expect_fingerprint or fp2 != fp:
        print(
            f"ERROR: fingerprint mismatch approved={args.expect_fingerprint} "
            f"dry={fp} now={fp2}",
            file=sys.stderr,
        )
        return 3
    snap = write_snapshot(plan2, rest)
    print(f"\nsnapshot: {snap}")
    apply_plan(rest, plan2)
    leftover = build_plan(rest)
    pending = [p for p in leftover if p.action not in ("stay", "stay_retag")]
    if pending:
        print(f"ERROR: {len(pending)} moves still pending", file=sys.stderr)
        return 4
    for d in DECISIONS:
        if not d.set_buying_house:
            continue
        slug = _decision_dest_slug(d)
        row = rest.one(
            "suppliers", {"select": "slug,entity_type", "slug": f"eq.{slug}"}
        )
        if not row or row.get("entity_type") != "buying_house":
            print(
                f"ERROR: {d.ref} destination {slug} not buying_house "
                f"({None if not row else row.get('entity_type')})",
                file=sys.stderr,
            )
            return 5
    assert_named_counterexample_profiles(rest)
    print("apply complete.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
