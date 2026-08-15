"""Dry-run: live EPB RMG exporters vs companies we already list.

No DB writes. Fetches association + category passes (unique by exporter id).
Matching uses a local snapshot of suppliers (slug / squash / fuzzy), the same
rules as upsert `_find_existing` passes 0, 1, 1.5, and 4. Email/phone are
unused because EPB search rows do not carry them.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from rapidfuzz import fuzz, process

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from etl.core.normalize import make_slug, normalize_company_name  # noqa: E402
from etl.core.upsert import _FUZZY_THRESHOLD, _names_compatible  # noqa: E402
from etl.scrapers.epb_web import EpbScraper  # noqa: E402

PLANS = Path(__file__).resolve().parents[1] / "ops" / "plans"
LIVE_PATH = PLANS / "_epb_attach_live.json"
SNAP_PATH = PLANS / "_epb_attach_snapshot.json"
OUT = PLANS / "_epb_attach_dryrun.json"

NAMED = (
    "interstoff-apparels",
    "sarada-fashions",
    "epyllion-style",
)


def _pass_label(rec) -> str:
    assoc = rec.payload.get("epb_associations") or []
    if assoc:
        return f"association:{assoc[0]}"
    cats = rec.payload.get("epb_categories") or []
    names = [c.get("name") for c in cats if isinstance(c, dict) and c.get("name")]
    return "category:" + ",".join(names[:3]) if names else "category"


async def fetch_live(limit: int | None) -> list[dict[str, Any]]:
    scraper = EpbScraper(existing_only=True)
    rows: list[dict[str, Any]] = []
    async for rec in scraper.fetch():
        rows.append(
            {
                "source_ref": rec.source_ref,
                "company_name": rec.company_name,
                "slug": make_slug(rec.company_name),
                "norm": normalize_company_name(rec.company_name),
                "pass": _pass_label(rec),
                "epb_reg_no": rec.payload.get("epb_reg_no"),
                "detail_url": rec.payload.get("epb_detail_url"),
            }
        )
        if limit is not None and len(rows) >= limit:
            break
        if len(rows) % 200 == 0:
            print(f"fetched {len(rows)}", flush=True)
    return rows


def _canonical(same_index: dict[str, list[dict[str, Any]]], candidate_id: str) -> str:
    edges = same_index.get(candidate_id) or []
    for edge in edges:
        other = (
            edge["supplier_b"]
            if edge["supplier_a"] == candidate_id
            else edge["supplier_a"]
        )
        cand_pub = (
            edge["a_published"]
            if edge["supplier_a"] == candidate_id
            else edge["b_published"]
        )
        other_pub = (
            edge["b_published"]
            if edge["supplier_a"] == candidate_id
            else edge["a_published"]
        )
        if cand_pub and other_pub:
            return candidate_id
        if other_pub and not cand_pub:
            return other
    return candidate_id


def match_rows(live: list[dict[str, Any]], snap: dict[str, Any]) -> dict[str, Any]:
    suppliers = snap["suppliers"]
    by_id = {s["id"]: s for s in suppliers}
    by_slug = {s["slug"]: s["id"] for s in suppliers}
    by_squash: dict[str, str] = {}
    for s in suppliers:
        squashed = (s.get("company_name_norm") or "").replace(" ", "")
        if squashed and squashed not in by_squash:
            by_squash[squashed] = s["id"]
    names = {
        s["id"]: s["company_name_norm"]
        for s in suppliers
        if s.get("company_name_norm")
    }
    epb_by_ref = {r["source_ref"]: r["supplier_id"] for r in snap["epb"]}
    bgmea = set(snap["bgmea_ids"])
    same_index: dict[str, list[dict[str, Any]]] = {}
    for e in snap.get("same_edges") or []:
        same_index.setdefault(e["supplier_a"], []).append(e)
        same_index.setdefault(e["supplier_b"], []).append(e)

    buckets: Counter[str] = Counter()
    would_attach: list[dict[str, Any]] = []
    no_match: list[dict[str, Any]] = []
    named: dict[str, Any] = {}

    for row in live:
        ref = row["source_ref"]
        sid: str | None
        if ref in epb_by_ref:
            outcome = "already_has_epb"
            sid = epb_by_ref[ref]
        else:
            sid = by_slug.get(row["slug"])
            if sid is None:
                squashed = (row["norm"] or "").replace(" ", "")
                sid = by_squash.get(squashed) if squashed else None
            if sid is None and row["norm"]:
                match = process.extractOne(
                    row["norm"], names, scorer=fuzz.token_sort_ratio
                )
                if (
                    match
                    and match[1] >= _FUZZY_THRESHOLD
                    and _names_compatible(row["norm"], match[0])
                ):
                    sid = match[2]
            outcome = "would_attach" if sid else "no_match"
            if sid:
                sid = _canonical(same_index, sid)

        host = by_id.get(sid) if sid else None
        if host:
            host = {
                **host,
                "has_bgmea": host["id"] in bgmea,
            }

        rec_out = {**row, "outcome": outcome, "host": host}
        buckets[outcome] += 1
        if host:
            if host["is_published"] and not host["is_facility"]:
                buckets["matched_published_mother"] += 1
            if host["has_bgmea"] or host["has_bkmea"]:
                buckets["matched_bgmea_or_bkmea"] += 1
            if outcome == "would_attach" and (host["has_bgmea"] or host["has_bkmea"]):
                buckets["would_attach_bgmea_or_bkmea"] += 1
                if host["is_published"] and not host["is_facility"]:
                    buckets["would_attach_published_assoc_mother"] += 1
        if outcome == "would_attach":
            would_attach.append(rec_out)
        elif outcome == "no_match":
            no_match.append(rec_out)
        if host and host.get("slug") in NAMED:
            named[host["slug"]] = rec_out
        elif any(key in row["slug"] for key in ("interstoff", "sarada", "epyllion")):
            named.setdefault(row["slug"], rec_out)

    live_assoc = sum(1 for r in live if r["pass"].startswith("association:"))
    live_cat = sum(1 for r in live if r["pass"].startswith("category:"))
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "live_unique": len(live),
        "live_from_association_pass": live_assoc,
        "live_from_category_pass_only": live_cat,
        "snapshot_suppliers": len(suppliers),
        "snapshot_epb": len(epb_by_ref),
        "buckets": dict(buckets),
        "named": named,
        "would_attach_sample": [
            {
                "source_ref": r["source_ref"],
                "company_name": r["company_name"],
                "pass": r["pass"],
                "host_slug": r["host"]["slug"] if r["host"] else None,
                "host_name": r["host"]["company_name"] if r["host"] else None,
                "published": r["host"]["is_published"] if r["host"] else None,
            }
            for r in would_attach[:40]
        ],
        "no_match_sample": [
            {
                "source_ref": r["source_ref"],
                "company_name": r["company_name"],
                "pass": r["pass"],
                "slug": r["slug"],
            }
            for r in no_match[:40]
        ],
        "would_attach_count": len(would_attach),
        "no_match_count": len(no_match),
        "would_attach": would_attach,
        "no_match": no_match,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--fetch-only", action="store_true")
    parser.add_argument("--match-only", action="store_true")
    args = parser.parse_args()

    if args.match_only:
        live = json.loads(LIVE_PATH.read_text(encoding="utf-8"))
    else:
        live = asyncio.run(fetch_live(args.limit))
        LIVE_PATH.write_text(
            json.dumps(live, indent=2, ensure_ascii=False), encoding="utf-8"
        )
        print(f"wrote {LIVE_PATH} ({len(live)} exporters)", flush=True)

    if args.fetch_only:
        by_pass = Counter(r["pass"].split(":")[0] for r in live)
        print(json.dumps({"live_unique": len(live), "by_pass": dict(by_pass)}, indent=2))
        return

    snap = json.loads(SNAP_PATH.read_text(encoding="utf-8"))
    plan = match_rows(live, snap)
    written = {
        k: v
        for k, v in plan.items()
        if k not in {"would_attach", "no_match"}
    }
    OUT.write_text(json.dumps(written, indent=2, default=str), encoding="utf-8")
    summary = {
        k: plan[k]
        for k in plan
        if k not in {
            "would_attach_sample",
            "no_match_sample",
            "named",
            "would_attach",
            "no_match",
        }
    }
    print(json.dumps(summary, indent=2))
    print("named:", json.dumps(plan["named"], indent=2, default=str))
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
