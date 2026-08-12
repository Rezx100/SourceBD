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


def fingerprint(plan: list[PlannedItem]) -> str:
    payload = [
        {
            "ref": p.ref,
            "action": p.action,
            "source_record_id": p.source_record_id,
            "from_supplier_id": p.from_supplier_id,
            "to_slug": p.to_slug,
            "to_supplier_id": p.to_supplier_id,
            "create_name": p.create_name,
            "set_buying_house": p.set_buying_house,
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


def _unique_slug(rest: Rest, base: str) -> str:
    slug = base
    n = 2
    while True:
        hit = rest.one("suppliers", {"select": "id", "slug": f"eq.{slug}"})
        if not hit:
            return slug
        slug = f"{base}-{n}"
        n += 1


def build_plan(rest: Rest) -> list[PlannedItem]:
    source_id = _bgmea_id(rest)
    plan: list[PlannedItem] = []
    for d in DECISIONS:
        sr = _active_sr(rest, source_id, d.ref)
        host = _supplier(rest, d.from_slug)
        if str(sr["supplier_id"]) != str(host["id"]):
            if d.to_slug:
                dest = _supplier(rest, d.to_slug)
                if str(sr["supplier_id"]) == str(dest["id"]):
                    continue
            if d.action == "import_move":
                # Already moved onto an imported row — treat as done.
                holder = rest.one(
                    "suppliers",
                    {
                        "select": "id,slug,company_name",
                        "id": f"eq.{sr['supplier_id']}",
                    },
                )
                if holder and normalize_company_name(
                    holder.get("company_name") or ""
                ) == normalize_company_name(d.registered_name):
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
        if d.action in ("stay", "stay_retag"):
            to_slug = d.from_slug
            to_id = str(host["id"])
            to_exists = True
        elif d.action in ("move", "move_retag"):
            assert d.to_slug
            dest = _supplier(rest, d.to_slug)
            to_slug = d.to_slug
            to_id = str(dest["id"])
            to_exists = True
        elif d.action == "import_move":
            create_name = d.registered_name
            to_slug = make_slug(d.registered_name)
            existing = rest.one(
                "suppliers",
                {"select": "id,slug,entity_type", "slug": f"eq.{to_slug}"},
            )
            if existing:
                to_id = str(existing["id"])
                to_exists = True
                to_slug = existing["slug"]
            else:
                to_exists = False
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
            )
        )
    return plan


def _reconcile(rest: Rest, source_id: str, *supplier_ids: str) -> None:
    for sid in sorted(set(supplier_ids)):
        if not sid:
            continue
        identities = _identities(rest, source_id, sid)
        patched = rest.patch(
            "suppliers",
            {"id": f"eq.{sid}"},
            {"bgmea_reg_numbers": identities},
        )
        if not patched:
            raise RuntimeError(f"failed bgmea_reg_numbers write for {sid}")


def _retag_buying_house(rest: Rest, supplier_id: str) -> None:
    rest.patch(
        "suppliers",
        {"id": f"eq.{supplier_id}"},
        {"entity_type": "buying_house"},
    )


def apply_plan(rest: Rest, plan: list[PlannedItem]) -> None:
    source_id = _bgmea_id(rest)
    for p in plan:
        dest_id = p.to_supplier_id
        if p.action == "import_move" and not p.to_exists:
            assert p.create_name
            slug = _unique_slug(rest, make_slug(p.create_name))
            created = rest.insert(
                "suppliers",
                {
                    "company_name": p.create_name,
                    "slug": slug,
                    "company_name_norm": normalize_company_name(p.create_name),
                    "entity_type": "buying_house",
                    "is_published": True,
                },
            )
            dest_id = str(created["id"])
            p.to_slug = slug
            p.to_supplier_id = dest_id
        elif p.action == "import_move" and dest_id:
            if p.set_buying_house:
                _retag_buying_house(rest, dest_id)

        if p.action in ("stay", "stay_retag"):
            if p.set_buying_house:
                _retag_buying_house(rest, p.from_supplier_id)
            continue

        assert dest_id
        if str(p.from_supplier_id) == dest_id:
            if p.set_buying_house:
                _retag_buying_house(rest, dest_id)
            continue

        moved = rest.patch(
            "source_records",
            {"id": f"eq.{p.source_record_id}", "supplier_id": f"eq.{p.from_supplier_id}"},
            {"supplier_id": dest_id},
        )
        if not moved:
            raise RuntimeError(f"failed to move {p.ref}")
        rest.patch(
            "evidence_claims",
            {
                "subject_table": "eq.source_records",
                "subject_id": f"eq.{p.source_record_id}",
            },
            {"supplier_id": dest_id},
        )
        if p.set_buying_house:
            _retag_buying_house(rest, dest_id)
        _reconcile(rest, source_id, p.from_supplier_id, dest_id)

        if p.ref == "general:2436":
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


def rez117_decision_violations(ref_holders: dict[str, set[str]]) -> list[str]:
    """Pure REZ-117 placement invariant (durable guard for detector + tests)."""
    lines: list[str] = []
    for d in DECISIONS:
        holders = ref_holders.get(d.ref, set())
        if not holders:
            lines.append(f"  {d.ref} missing from active BGMEA records")
            continue
        if d.action in ("stay", "stay_retag"):
            allowed = {d.from_slug}
        elif d.action in ("move", "move_retag"):
            assert d.to_slug
            allowed = {d.from_slug, d.to_slug}
        elif d.action == "import_move":
            allowed = {d.from_slug, make_slug(d.registered_name)}
        else:
            lines.append(f"  {d.ref} unknown action {d.action}")
            continue
        bad = holders - allowed
        if bad:
            lines.append(
                f"  {d.ref} on {sorted(holders)} — allowed only {sorted(allowed)} "
                f"({d.action})"
            )
    return lines


def rez117_buying_house_tag_violations(
    ref_holders: dict[str, set[str]],
    entity_by_slug: dict[str, str],
) -> list[str]:
    """When a retag destination already holds the ref, it must be buying_house."""
    lines: list[str] = []
    for d in DECISIONS:
        if not d.set_buying_house:
            continue
        holders = ref_holders.get(d.ref, set())
        if d.action in ("stay", "stay_retag"):
            dest = d.from_slug
        elif d.action in ("move", "move_retag"):
            assert d.to_slug
            dest = d.to_slug
        else:
            dest = make_slug(d.registered_name)
        if dest not in holders:
            continue
        et = entity_by_slug.get(dest)
        if et is None:
            continue
        if et != "buying_house":
            lines.append(
                f"  {d.ref} host {dest!r} entity_type={et!r} — need buying_house"
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
        print(f"ERROR: plan size {len(plan)} != {len(DECISIONS)}", file=sys.stderr)
        return 2
    if not args.apply:
        print("\nDry-run only. Re-run with --apply --expect-fingerprint <sha> after acceptance.")
        return 0
    if not args.expect_fingerprint:
        print("ERROR: --apply requires --expect-fingerprint", file=sys.stderr)
        return 2
    plan2 = build_plan(rest)
    fp2 = fingerprint(plan2)
    if fp2 != args.expect_fingerprint or fp2 != fp:
        print(
            f"ERROR: fingerprint mismatch approved={args.expect_fingerprint} dry={fp} now={fp2}",
            file=sys.stderr,
        )
        return 3
    snap = write_snapshot(plan2, rest)
    print(f"\nsnapshot: {snap}")
    apply_plan(rest, plan2)
    leftover = build_plan(rest)
    # stay/stay_retag still appear if we don't skip — build_plan continues for already-on-dest only for moves
    # For stay actions, build_plan always includes them if still on from_slug. Filter:
    pending = [p for p in leftover if p.action not in ("stay", "stay_retag")]
    if pending:
        print(f"ERROR: {len(pending)} moves still pending", file=sys.stderr)
        return 4
    print("apply complete.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
