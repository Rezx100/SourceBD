"""REZ-116: move founder-decided orphaned BGMEA registrations to rightful rows.

Evidence + decisions: ops/plans/bgmea-attribution-decisions.md §1 (11 Aug 2026).

Dry-run by default. ``--apply`` only after fingerprint matches an accepted plan.

Transport: Supabase REST (service role). Direct Postgres times out from the
founder machine — same path as the attribution report.

Provenance notes (must survive into commit / Linear):
  * refs 1604 and 1556 rest on founder trade knowledge, not register evidence.
  * ref 1168 is HOLD — never moved by this script.
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
from typing import Any

import httpx
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

from etl.core.bgmea_identity import identity_from_source_record  # noqa: E402

SNAPSHOT_DIR = Path(__file__).resolve().parent / "plans"
DECISIONS_PATH = SNAPSHOT_DIR / "bgmea-attribution-decisions.md"


@dataclass(frozen=True)
class MoveSpec:
    ref: str
    from_slug: str
    to_slug: str
    registered_name: str
    provenance: str  # register_exact | founder_trade_knowledge_2026-08-11
    notes: str = ""


@dataclass(frozen=True)
class HoldSpec:
    ref: str
    current_slug: str
    candidate_slug: str
    registered_name: str
    reason: str


# Exact founder decisions — do not re-derive by name matching.
MOVES: tuple[MoveSpec, ...] = (
    MoveSpec(
        "general:4562",
        "vintage-denim-apparels",
        "vintage-denim",
        "Vintage Denim Ltd.",
        "register_exact",
    ),
    MoveSpec(
        "797",
        "asdwa-fashion",
        "fashion-comfort-bd",
        "Fashion Comfort (BD) Ltd.",
        "register_exact",
    ),
    MoveSpec(
        "460",
        "channel-expor-tex-international",
        "hm-textile",
        "HM Textile",
        "register_exact",
    ),
    MoveSpec(
        "1464",
        "dhaka-natex-sourcing",
        "natex-of-scandinavia-as-bangladesh",
        "Natex of Scandinavia A/S Bangladesh",
        "register_exact",
    ),
    MoveSpec(
        "1128",
        "the-fashion-island",
        "riviera-resources",
        "Riviera Resources Ltd.",
        "register_exact",
    ),
    MoveSpec(
        "general:4298",
        "section-seven-apparels",
        "section-seven",
        "Section Seven Ltd.",
        "register_exact",
        "destination unpublished — founder accepted 11 Aug",
    ),
    MoveSpec(
        "1604",
        "raz-apparels",
        "ar-sourcing",
        "A.R.Z Sourcing BD",
        "founder_trade_knowledge_2026-08-11",
        "no register entry for AR Sourcing; founder trade knowledge",
    ),
    MoveSpec(
        "1556",
        "md-tex",
        "sunrise-apparels",
        "Sunrise Apparel BD",
        "founder_trade_knowledge_2026-08-11",
        "no register entry for Sunrise Apparels; founder trade knowledge",
    ),
    MoveSpec(
        "general:2431",
        "bangladesh-dresses",
        "bangladesh-dressess-ltd-unit-2",
        "Bangladesh Dresses Ltd.(Unit-2)",
        "register_exact",
        "Unit-2 exclusively; not blended into parent",
    ),
    MoveSpec(
        "general:5663",
        "standard-stitches",
        "standard-stitches-ltd-woven-unit",
        "Standard Stitches Ltd. (Woven Unit)",
        "register_exact",
        "unpublished attached building; requires mother facility-registry render",
    ),
)

HOLDS: tuple[HoldSpec, ...] = (
    HoldSpec(
        "1168",
        "pa-textile",
        "p-fashion",
        "P.A. Fashion Ltd.",
        "register has no P. Fashion entry; not P. A. Textile's; founder HOLD",
    ),
)

# Founder-authorised attributions that disagree with register-name matching.
# Detector allowlist — never treat these as silent guesses.
FOUNDER_DECISION_ALLOWLIST: frozenset[str] = frozenset(
    m.ref for m in MOVES if m.provenance.startswith("founder_trade_knowledge")
) | frozenset(h.ref for h in HOLDS)


class Rest:
    def __init__(self) -> None:
        base = os.environ.get("SUPABASE_URL", "").rstrip("/")
        key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
        if not base or not key:
            print("ERROR: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set", file=sys.stderr)
            raise SystemExit(1)
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

    def rpc_json(self, name: str, body: dict) -> Any:
        r = self.client.post(f"{self.rpc}/{name}", json=body)
        r.raise_for_status()
        return r.json()


@dataclass
class PlannedMove:
    ref: str
    source_record_id: str
    source_id: str
    from_supplier_id: str
    from_slug: str
    to_supplier_id: str
    to_slug: str
    to_is_published: bool
    to_facility_of: str | None
    mother_slug: str | None
    identity: str
    registered_name: str
    provenance: str
    notes: str


def fingerprint(plan: list[PlannedMove]) -> str:
    payload = [
        {
            "ref": p.ref,
            "source_record_id": p.source_record_id,
            "from_supplier_id": p.from_supplier_id,
            "to_supplier_id": p.to_supplier_id,
            "identity": p.identity,
            "provenance": p.provenance,
        }
        for p in sorted(plan, key=lambda x: x.ref)
    ]
    blob = json.dumps(payload, separators=(",", ":"), ensure_ascii=True)
    return hashlib.sha256(blob.encode("utf-8")).hexdigest()


def _supplier_by_slug(rest: Rest, slug: str) -> dict:
    row = rest.one(
        "suppliers",
        {
            "select": "id,slug,company_name,is_published,facility_of,bgmea_reg_numbers",
            "slug": f"eq.{slug}",
        },
    )
    if not row:
        raise RuntimeError(f"supplier slug not found: {slug}")
    return row


def _bgmea_source_id(rest: Rest) -> str:
    row = rest.one("sources", {"select": "id", "code": "eq.BGMEA"})
    if not row:
        raise RuntimeError("BGMEA source missing")
    return str(row["id"])


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
        raise RuntimeError(f"active BGMEA source_record not found for ref={ref}")
    return row


def _identities_for_supplier(rest: Rest, source_id: str, supplier_id: str) -> list[str]:
    rows = rest.all_rows(
        "source_records",
        {
            "select": "id,source_ref,fields,status",
            "source_id": f"eq.{source_id}",
            "supplier_id": f"eq.{supplier_id}",
            "status": "eq.active",
        },
    )
    out: list[str] = []
    for rec in rows:
        ident = identity_from_source_record(rec)
        if ident:
            out.append(ident)
    return sorted(set(out))


def verify_mother_facility_registry_render(rest: Rest) -> None:
    """Observable-boundary gate for moving onto an unpublished building.

    REZ-110: mother Compliance pills include facility registries labelled with
    building_name. Probe a known live mother (birds-garments / Unit-2 #2455).
    """
    payload = rest.rpc_json("buyer_supplier_profile", {"p_slug": "birds-garments"})
    pills = payload.get("pills") or []
    labelled = [
        p
        for p in pills
        if p.get("building_name")
        and p.get("source_code") == "BGMEA"
        and str(p.get("value")) == "2455"
    ]
    if not labelled:
        raise RuntimeError(
            "BLOCKED: mother facility-registry render not observed on "
            "birds-garments (expected BGMEA 2455 with building_name). "
            "Do not move general:5663."
        )


def build_plan(rest: Rest) -> list[PlannedMove]:
    source_id = _bgmea_source_id(rest)
    # Gate once for the building move.
    verify_mother_facility_registry_render(rest)

    plan: list[PlannedMove] = []
    for spec in MOVES:
        sr = _active_sr(rest, source_id, spec.ref)
        host = _supplier_by_slug(rest, spec.from_slug)
        dest = _supplier_by_slug(rest, spec.to_slug)
        if str(sr["supplier_id"]) == str(dest["id"]):
            # Already moved — skip rather than invent a no-op mutation.
            continue
        if str(sr["supplier_id"]) != str(host["id"]):
            raise RuntimeError(
                f"ref {spec.ref}: expected on {spec.from_slug} ({host['id']}), "
                f"found supplier_id={sr['supplier_id']}"
            )
        ident = identity_from_source_record(sr)
        if not ident:
            raise RuntimeError(f"ref {spec.ref}: cannot derive register identity from SR")

        mother_slug = None
        facility_of = dest.get("facility_of")
        if facility_of:
            mother = rest.one(
                "suppliers",
                {"select": "id,slug,is_published", "id": f"eq.{facility_of}"},
            )
            if not mother or not mother.get("is_published"):
                raise RuntimeError(
                    f"ref {spec.ref}: destination facility mother missing/unpublished"
                )
            mother_slug = mother["slug"]
            if spec.ref == "general:5663" and mother_slug != "standard-stitches":
                raise RuntimeError("general:5663 destination mother must be standard-stitches")

        plan.append(
            PlannedMove(
                ref=spec.ref,
                source_record_id=str(sr["id"]),
                source_id=source_id,
                from_supplier_id=str(host["id"]),
                from_slug=spec.from_slug,
                to_supplier_id=str(dest["id"]),
                to_slug=spec.to_slug,
                to_is_published=bool(dest.get("is_published")),
                to_facility_of=str(facility_of) if facility_of else None,
                mother_slug=mother_slug,
                identity=ident,
                registered_name=spec.registered_name,
                provenance=spec.provenance,
                notes=spec.notes,
            )
        )
    if len(plan) != len(MOVES):
        # If some already applied, plan may be shorter — caller reconciles.
        pass
    return plan


def write_snapshot(plan: list[PlannedMove], rest: Rest) -> Path:
    source_id = _bgmea_source_id(rest)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    path = SNAPSHOT_DIR / f"_snapshot_rez116_orphan_moves_{stamp}.json"
    rows: list[dict[str, Any]] = []
    touched: set[str] = set()
    for p in plan:
        touched.add(p.from_supplier_id)
        touched.add(p.to_supplier_id)
        sr = rest.one(
            "source_records",
            {
                "select": "id,supplier_id,source_id,source_ref,status,fields,fetched_at",
                "id": f"eq.{p.source_record_id}",
            },
        )
        claims = rest.all_rows(
            "evidence_claims",
            {
                "select": "*",
                "subject_table": "eq.source_records",
                "subject_id": f"eq.{p.source_record_id}",
            },
        )
        rows.append(
            {
                "move": asdict(p),
                "source_record": sr,
                "evidence_claims": claims,
            }
        )
    suppliers = []
    for sid in sorted(touched):
        s = rest.one(
            "suppliers",
            {
                "select": "id,slug,company_name,is_published,facility_of,bgmea_reg_numbers,bgmea_verified",
                "id": f"eq.{sid}",
            },
        )
        identities = _identities_for_supplier(rest, source_id, sid)
        suppliers.append({"supplier": s, "derived_identities": identities})
    blob = {
        "created_at": stamp,
        "fingerprint": fingerprint(plan),
        "moves": rows,
        "suppliers": suppliers,
        "holds": [asdict(h) for h in HOLDS],
    }
    path.write_text(json.dumps(blob, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")
    return path


def apply_plan(rest: Rest, plan: list[PlannedMove]) -> None:
    source_id = _bgmea_source_id(rest)
    for p in plan:
        collision = rest.one(
            "source_records",
            {
                "select": "id",
                "supplier_id": f"eq.{p.to_supplier_id}",
                "source_id": f"eq.{p.source_id}",
                "source_ref": f"eq.{p.ref}",
            },
        )
        if collision:
            raise RuntimeError(f"destination already holds {p.ref} — abort")
        moved = rest.patch(
            "source_records",
            {"id": f"eq.{p.source_record_id}", "supplier_id": f"eq.{p.from_supplier_id}"},
            {"supplier_id": p.to_supplier_id},
        )
        if not moved:
            raise RuntimeError(f"failed to move {p.ref} — record not on expected host")
        rest.patch(
            "evidence_claims",
            {
                "supplier_id": f"eq.{p.from_supplier_id}",
                "subject_table": "eq.source_records",
                "subject_id": f"eq.{p.source_record_id}",
            },
            {"supplier_id": p.to_supplier_id},
        )

    touched = {p.from_supplier_id for p in plan} | {p.to_supplier_id for p in plan}
    for sid in sorted(touched):
        identities = _identities_for_supplier(rest, source_id, sid)
        rest.patch(
            "suppliers",
            {"id": f"eq.{sid}"},
            {"bgmea_reg_numbers": identities},
        )


def print_plan(plan: list[PlannedMove], fp: str) -> None:
    print("== REZ-116 orphan BGMEA moves (dry-run) ==")
    print(f"moves: {len(plan)}  expected: {len(MOVES)}")
    print(f"fingerprint: {fp}")
    print(f"decisions_file: {DECISIONS_PATH}")
    print()
    for p in plan:
        vis = (
            f"mother={p.mother_slug} (facility)"
            if p.to_facility_of
            else ("published" if p.to_is_published else "UNPUBLISHED")
        )
        print(
            f"{p.ref:16} {p.identity:16}  {p.from_slug} -> {p.to_slug}  [{vis}]\n"
            f"                 registered={p.registered_name!r}\n"
            f"                 provenance={p.provenance}  {p.notes}"
        )
    print("\n== HOLD (not moved) ==")
    for h in HOLDS:
        print(
            f"{h.ref:16} on {h.current_slug}  candidate={h.candidate_slug}  "
            f"registered={h.registered_name!r}\n                 {h.reason}"
        )


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--apply", action="store_true")
    ap.add_argument(
        "--expect-fingerprint",
        default="",
        help="required with --apply: sha256 from the accepted dry-run",
    )
    args = ap.parse_args()
    rest = Rest()
    plan = build_plan(rest)
    fp = fingerprint(plan)
    print_plan(plan, fp)

    if len(plan) != len(MOVES):
        print(
            f"\nERROR: plan size {len(plan)} != {len(MOVES)} decisions "
            "(partial apply or population drift)",
            file=sys.stderr,
        )
        return 2

    if not args.apply:
        print("\nDry-run only. Re-run with --apply --expect-fingerprint <sha> after acceptance.")
        return 0

    if not args.expect_fingerprint:
        print("ERROR: --apply requires --expect-fingerprint", file=sys.stderr)
        return 2
    # Recompute against current production immediately before apply.
    plan2 = build_plan(rest)
    fp2 = fingerprint(plan2)
    if fp2 != args.expect_fingerprint or fp2 != fp:
        print(
            f"ERROR: fingerprint mismatch — approved={args.expect_fingerprint} "
            f"dry={fp} now={fp2}. Approval void.",
            file=sys.stderr,
        )
        return 3
    snap = write_snapshot(plan2, rest)
    print(f"\nsnapshot: {snap}")
    apply_plan(rest, plan2)
    # Post-apply reconcile
    plan3 = build_plan(rest)
    if plan3:
        print(
            f"ERROR: {len(plan3)} moves still pending after apply — restore from snapshot",
            file=sys.stderr,
        )
        return 4
    print("apply complete: 0 pending moves; HOLD list unchanged.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
