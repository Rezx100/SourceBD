"""Release the admin review-queue backlog to buyer-facing destinations.

Each open verification_queue row is classified by etl.core.queue_release
and either mutated (attach / merge / publish / label) or closed because
the destination is already live.

Dry-run by default. --apply requires --expect-fingerprint matching this run.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import logging
import os
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

import httpx
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

logging.getLogger("httpx").setLevel(logging.WARNING)
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from etl.core.queue_release import (  # noqa: E402
    ReleasePlan,
    classify_queue_row,
    refuse_nested_parent,
)

SNAPSHOT_DIR = Path(__file__).resolve().parent / "plans"


class Rest:
    def __init__(self) -> None:
        base = os.environ.get("SUPABASE_URL", "").rstrip("/")
        key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
        if not base or not key:
            raise SystemExit("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set")
        self.base = base + "/rest/v1"
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

    def patch(self, path: str, params: dict[str, str], body: dict) -> list[dict]:
        r = self.client.patch(
            f"{self.base}/{path}",
            params=params,
            json=body,
            headers={"Prefer": "return=representation"},
        )
        r.raise_for_status()
        return r.json() if r.content else []


def fingerprint(plans: list[ReleasePlan]) -> str:
    payload = [list(p.fingerprint_parts()) for p in sorted(plans, key=lambda x: x.queue_id)]
    return hashlib.sha256(
        json.dumps(payload, separators=(",", ":"), ensure_ascii=True).encode()
    ).hexdigest()


def _ids(values: list[str | None]) -> list[str]:
    return sorted({v for v in values if v})


def load_open_queue(rest: Rest) -> list[dict]:
    return rest.all_rows(
        "verification_queue",
        {
            "select": "id,queue_type,supplier_a_id,supplier_b_name,confidence,source_data,created_at",
            "reviewed_at": "is.null",
            "order": "created_at.asc",
        },
    )


def load_suppliers(rest: Rest, ids: list[str]) -> dict[str, dict]:
    out: dict[str, dict] = {}
    for i in range(0, len(ids), 50):
        chunk = ids[i : i + 50]
        rows = rest.all_rows(
            "suppliers",
            {
                "select": "id,slug,company_name,company_name_norm,is_published,facility_of,source_tags,parent_group_name",
                "id": f"in.({','.join(chunk)})",
            },
        )
        for row in rows:
            out[str(row["id"])] = row
    return out


def load_published_index(rest: Rest) -> list[dict]:
    return rest.all_rows(
        "suppliers",
        {
            "select": "id,slug,company_name,company_name_norm,is_published,facility_of",
            "is_published": "eq.true",
            "facility_of": "is.null",
        },
    )


def load_rsc_ids(rest: Rest, ids: list[str]) -> set[str]:
    found: set[str] = set()
    for i in range(0, len(ids), 50):
        chunk = ids[i : i + 50]
        rows = rest.all_rows(
            "rsc_remediation",
            {"select": "supplier_id", "supplier_id": f"in.({','.join(chunk)})"},
        )
        for row in rows:
            found.add(str(row["supplier_id"]))
    return found


def load_tier13_stats(rest: Rest, ids: list[str]) -> dict[str, tuple[int, int]]:
    """Return {supplier_id: (distinct_tier13_sources, active_tier13_rows)}."""
    stats: dict[str, tuple[set[str], int]] = {i: (set(), 0) for i in ids}
    for i in range(0, len(ids), 50):
        chunk = ids[i : i + 50]
        rows = rest.all_rows(
            "source_records",
            {
                "select": "supplier_id,source_id",
                "supplier_id": f"in.({','.join(chunk)})",
                "status": "eq.active",
                "source_tier": "in.(tier1_gov,tier2_industry,tier3_cert)",
            },
        )
        for row in rows:
            sid = str(row["supplier_id"])
            sources, n = stats.get(sid, (set(), 0))
            sources.add(str(row["source_id"]))
            stats[sid] = (sources, n + 1)
    return {sid: (len(sources), n) for sid, (sources, n) in stats.items()}


def classify_all(rest: Rest, rows: list[dict]) -> list[ReleasePlan]:
    member_ids: list[str | None] = []
    supplier_ids: list[str | None] = []
    for row in rows:
        data = row.get("source_data") or {}
        supplier_ids.append(row.get("supplier_a_id"))
        supplier_ids.append(data.get("parent_supplier_id"))
        supplier_ids.append(data.get("extension_supplier_id"))
        supplier_ids.append(data.get("cert_supplier_id"))
        supplier_ids.append(data.get("target_supplier_id"))
        for mid in data.get("member_ids") or []:
            member_ids.append(str(mid))
    suppliers = load_suppliers(rest, _ids(supplier_ids + member_ids))
    fuzzy_ids = _ids(
        [
            (row.get("source_data") or {}).get("cert_supplier_id")
            or row.get("supplier_a_id")
            for row in rows
            if row.get("queue_type") == "fuzzy_match_review"
        ]
        + [
            (row.get("source_data") or {}).get("target_supplier_id")
            for row in rows
            if row.get("queue_type") == "fuzzy_match_review"
        ]
    )
    rsc_ids = load_rsc_ids(rest, fuzzy_ids)
    brand_ids = [
        str(row["supplier_a_id"])
        for row in rows
        if row.get("queue_type") == "brand_disclosure_match_review" and row.get("supplier_a_id")
    ]
    tier13 = load_tier13_stats(rest, list(dict.fromkeys(brand_ids + fuzzy_ids)))
    published = load_published_index(rest)

    plans: list[ReleasePlan] = []
    for row in rows:
        data = row.get("source_data") or {}
        qid = str(row["id"])
        qtype = str(row["queue_type"])
        if qtype == "group_parent_review" and data.get("rule") == "rsc_extension_rollup_v1":
            child_id = str(data.get("extension_supplier_id") or row.get("supplier_a_id") or "")
            parent_id = str(data.get("parent_supplier_id") or "")
            child = dict(suppliers.get(child_id) or {})
            parent = dict(suppliers.get(parent_id) or {})
            if child:
                child["id"] = child_id
            if parent:
                parent["id"] = parent_id
            plans.append(
                classify_queue_row(
                    queue_id=qid,
                    queue_type=qtype,
                    source_data=data,
                    supplier_a_id=row.get("supplier_a_id"),
                    child=child,
                    parent=parent,
                    published_matches=published,
                )
            )
            continue
        if qtype == "group_parent_review" and data.get("cluster_token"):
            members = []
            for mid in data.get("member_ids") or []:
                rec = dict(suppliers.get(str(mid)) or {"id": str(mid)})
                rec["id"] = str(mid)
                members.append(rec)
            plans.append(
                classify_queue_row(
                    queue_id=qid,
                    queue_type=qtype,
                    source_data=data,
                    supplier_a_id=row.get("supplier_a_id"),
                    members=members,
                )
            )
            continue
        if qtype == "fuzzy_match_review":
            cert_id = str(data.get("cert_supplier_id") or row.get("supplier_a_id") or "")
            target_id = str(data.get("target_supplier_id") or "")
            cert = dict(suppliers.get(cert_id) or {})
            target = dict(suppliers.get(target_id) or {})
            if cert_id in suppliers:
                cert["id"] = cert_id
            if target_id in suppliers:
                target["id"] = target_id
            cert["has_rsc"] = cert_id in rsc_ids
            target["has_rsc"] = target_id in rsc_ids
            cert_d, cert_n = tier13.get(cert_id, (0, 0))
            target_d, target_n = tier13.get(target_id, (0, 0))
            cert["tier13_count"] = cert_d
            target["tier13_count"] = target_d
            cert["record_count"] = cert_n
            target["record_count"] = target_n
            plans.append(
                classify_queue_row(
                    queue_id=qid,
                    queue_type=qtype,
                    source_data=data,
                    supplier_a_id=row.get("supplier_a_id"),
                    cert=cert,
                    target=target,
                    published_matches=published,
                )
            )
            continue
        if qtype == "brand_disclosure_match_review":
            sid = str(row.get("supplier_a_id") or "")
            brand = dict(suppliers.get(sid) or {})
            brand["id"] = sid
            brand["tier13_count"] = tier13.get(sid, (0, 0))[0]
            plans.append(
                classify_queue_row(
                    queue_id=qid,
                    queue_type=qtype,
                    source_data=data,
                    supplier_a_id=sid,
                    brand_row=brand,
                    published_matches=published,
                )
            )
            continue
        plans.append(
            classify_queue_row(
                queue_id=qid,
                queue_type=qtype,
                source_data=data,
                supplier_a_id=row.get("supplier_a_id"),
            )
        )
    return plans


def absorb(rest: Rest, winner_id: str, loser_id: str) -> None:
    winner_sr = rest.all_rows(
        "source_records",
        {"select": "id,source_id,source_ref", "supplier_id": f"eq.{winner_id}"},
    )
    have = {(str(r["source_id"]), r.get("source_ref")) for r in winner_sr}
    loser_sr = rest.all_rows(
        "source_records",
        {"select": "id,source_id,source_ref", "supplier_id": f"eq.{loser_id}"},
    )
    for rec in loser_sr:
        key = (str(rec["source_id"]), rec.get("source_ref"))
        if key in have:
            continue
        rest.patch("source_records", {"id": f"eq.{rec['id']}"}, {"supplier_id": winner_id})

    winner_certs = rest.all_rows(
        "certifications",
        {"select": "id,kind,certificate_no", "supplier_id": f"eq.{winner_id}"},
    )
    have_c = {(r.get("kind"), r.get("certificate_no")) for r in winner_certs}
    loser_certs = rest.all_rows(
        "certifications",
        {"select": "id,kind,certificate_no", "supplier_id": f"eq.{loser_id}"},
    )
    for rec in loser_certs:
        key = (rec.get("kind"), rec.get("certificate_no"))
        if key in have_c:
            continue
        rest.patch("certifications", {"id": f"eq.{rec['id']}"}, {"supplier_id": winner_id})

    rest.patch("evidence_claims", {"supplier_id": f"eq.{loser_id}"}, {"supplier_id": winner_id})
    winner_docs = rest.all_rows(
        "compliance_documents",
        {"select": "id,doc_type,sha256", "supplier_id": f"eq.{winner_id}"},
    )
    have_d = {(r.get("doc_type"), r.get("sha256")) for r in winner_docs}
    loser_docs = rest.all_rows(
        "compliance_documents",
        {"select": "id,doc_type,sha256", "supplier_id": f"eq.{loser_id}"},
    )
    for rec in loser_docs:
        key = (rec.get("doc_type"), rec.get("sha256"))
        if key in have_d:
            continue
        rest.patch(
            "compliance_documents",
            {"id": f"eq.{rec['id']}"},
            {"supplier_id": winner_id},
        )
    winner_rsc = rest.all_rows(
        "rsc_remediation",
        {"select": "id", "supplier_id": f"eq.{winner_id}"},
    )
    if not winner_rsc:
        rest.patch(
            "rsc_remediation",
            {"supplier_id": f"eq.{loser_id}"},
            {"supplier_id": winner_id},
        )

    both = rest.all_rows(
        "suppliers",
        {"select": "id,source_tags", "id": f"in.({winner_id},{loser_id})"},
    )
    tags: list[str] = []
    for row in both:
        tags.extend(row.get("source_tags") or [])
    rest.patch(
        "suppliers",
        {"id": f"eq.{winner_id}"},
        {"source_tags": list(dict.fromkeys(tags))},
    )
    rest.patch("suppliers", {"id": f"eq.{loser_id}"}, {"is_published": False})


def close_queue(rest: Rest, queue_id: str, action: str) -> None:
    admin = "merge" if action == "merge_into" else "approve"
    rest.patch(
        "verification_queue",
        {"id": f"eq.{queue_id}"},
        {
            "reviewed_at": datetime.now(timezone.utc).isoformat(),
            "admin_action": admin,
        },
    )


def apply_plan(rest: Rest, plan: ReleasePlan) -> None:
    if plan.action == "needs_human":
        return
    if plan.action == "attach_facility" and plan.parent_id:
        parents = rest.all_rows(
            "suppliers",
            {
                "select": "id,facility_of,company_name",
                "id": f"eq.{plan.parent_id}",
            },
        )
        parent = parents[0] if parents else None
        if refuse_nested_parent(parent):
            return
        children = [c for c in (plan.child_id, *plan.member_ids) if c and c != plan.parent_id]
        for cid in dict.fromkeys(children):
            rest.patch(
                "suppliers",
                {"id": f"eq.{cid}"},
                {"facility_of": plan.parent_id, "is_published": False},
            )
    elif plan.action in {"merge_into", "attach_brand"} and plan.winner_id and plan.loser_id:
        absorb(rest, plan.winner_id, plan.loser_id)
    elif plan.action == "publish" and plan.winner_id:
        rest.patch("suppliers", {"id": f"eq.{plan.winner_id}"}, {"is_published": True})
    elif plan.action in {"keep_separate", "already_attached"}:
        pass
    else:
        return
    close_queue(rest, plan.queue_id, plan.action)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--expect-fingerprint", default="")
    ap.add_argument("--limit", type=int, default=0)
    args = ap.parse_args()

    rest = Rest()
    rows = load_open_queue(rest)
    if args.limit:
        rows = rows[: args.limit]
    plans = classify_all(rest, rows)
    fp = fingerprint(plans)
    counts = Counter(p.action for p in plans)

    SNAPSHOT_DIR.mkdir(parents=True, exist_ok=True)
    out = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "open_rows": len(rows),
        "fingerprint": fp,
        "counts": dict(counts),
        "needs_human": [
            {
                "queue_id": p.queue_id,
                "queue_type": p.queue_type,
                "reason": p.reason,
                "destination": p.buyer_destination,
            }
            for p in plans
            if p.action == "needs_human"
        ],
        "mutations": [
            {
                "queue_id": p.queue_id,
                "action": p.action,
                "destination": p.buyer_destination,
                "winner_id": p.winner_id,
                "loser_id": p.loser_id,
                "parent_id": p.parent_id,
                "child_id": p.child_id,
                "group_name": p.group_name,
                "member_ids": list(p.member_ids),
            }
            for p in plans
            if p.action not in {"keep_separate", "already_attached", "needs_human"}
        ],
    }
    path = SNAPSHOT_DIR / "queue-release-dry-run.json"
    path.write_text(json.dumps(out, indent=2), encoding="utf-8")

    print(f"open_rows={len(rows)}")
    for action, n in sorted(counts.items(), key=lambda kv: (-kv[1], kv[0])):
        print(f"  {action:20s} {n}")
    print(f"fingerprint={fp}")
    print(f"wrote {path}")

    if not args.apply:
        print("DRY-RUN. Re-run with --apply --expect-fingerprint <fingerprint> to mutate.")
        return 0

    if args.expect_fingerprint != fp:
        print("FINGERPRINT MISMATCH. Refusing --apply.", file=sys.stderr)
        print(f"expected {args.expect_fingerprint}", file=sys.stderr)
        print(f"got      {fp}", file=sys.stderr)
        return 2

    applied = 0
    skipped = 0
    for plan in plans:
        if plan.action == "needs_human":
            skipped += 1
            continue
        apply_plan(rest, plan)
        applied += 1
        if applied % 50 == 0:
            print(f"  applied {applied}...", flush=True)
    print(f"applied={applied} skipped_needs_human={skipped}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
