"""Classify REZ-88 structural multi-member-ref excess refs (plan only).

Reads production via Supabase REST. Re-fetches BGMEA general member pages for
each ``general:`` ref (company name from the page title) and recovers associate
names from the local Associate Members PDF. Does NOT write scraped_company_name
onto historical records and does NOT mutate suppliers.

USAGE
-----
    python ops/plan_multi_member_refs.py
    python ops/plan_multi_member_refs.py --out ops/plans/rez-88-multi-ref-plan.md
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import httpx
import pdfplumber
from bs4 import BeautifulSoup
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

from etl.core.normalize import extension_base_name, normalize_company_name  # noqa: E402
from etl.core.upsert import _names_compatible  # noqa: E402
from etl.scrapers.bgmea_buying_house import (  # noqa: E402
    PDF_PATH,
    _column_lines,
    _parse_column,
)
from ops.check_supplier_conflations import find_multi_member_refs, is_member_ref  # noqa: E402
from ops.repair_bgmea_conflations import Rest  # noqa: E402

BASE = "https://www.bgmea.com.bd"
DETAIL_URL = f"{BASE}/member/{{mid}}"
_BROWSER_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": f"{BASE}/page/member-list",
}
_TITLE_RE = re.compile(r"BGMEA\s*\|\s*Member Details\s*(.+)", re.IGNORECASE)


@dataclass
class RefInfo:
    source_ref: str
    record_id: str
    member_id: str | None
    reg: str | None
    live_name: str | None
    name_source: str  # member-page | associate-pdf | unresolved


def _title_company(html: str) -> str | None:
    soup = BeautifulSoup(html, "lxml")
    if not soup.title or not soup.title.string:
        return None
    m = _TITLE_RE.search(soup.title.string.strip())
    if not m:
        return None
    name = m.group(1).strip()
    return name or None


def _load_associate_names(pdf_path: Path) -> dict[str, str]:
    """reg → company name from the local Associate Members PDF."""
    out: dict[str, str] = {}
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            width = page.width
            left = _column_lines(page, 0, width * 0.5)
            right = _column_lines(page, width * 0.5, width)
            for col in (left, right):
                for rec in _parse_column(col):
                    out[str(rec["reg"])] = rec["name"]
    return out


def _fetch_general_names(
    member_ids: list[str], *, pause_s: float = 0.35
) -> dict[str, str]:
    """member_id → live company name from the BGMEA member detail page title."""
    out: dict[str, str] = {}
    with httpx.Client(headers=_BROWSER_HEADERS, timeout=40, follow_redirects=True) as client:
        for i, mid in enumerate(member_ids):
            try:
                r = client.get(DETAIL_URL.format(mid=mid))
                if r.status_code != 200:
                    print(f"  warn: member {mid} HTTP {r.status_code}", file=sys.stderr)
                else:
                    name = _title_company(r.text)
                    if name:
                        out[mid] = name
                    else:
                        print(f"  warn: member {mid} no title name", file=sys.stderr)
            except httpx.HTTPError as exc:
                print(f"  warn: member {mid} fetch failed: {exc}", file=sys.stderr)
            if pause_s and i + 1 < len(member_ids):
                time.sleep(pause_s)
            if (i + 1) % 25 == 0:
                print(f"  fetched {i + 1}/{len(member_ids)} member pages", flush=True)
    return out


def _pick_keeper(host_name: str, refs: list[RefInfo]) -> RefInfo:
    """Keep the ref whose recovered name best matches the host supplier."""
    host_n = normalize_company_name(host_name or "")

    def score(info: RefInfo) -> tuple[int, int, str]:
        # Higher is better. Prefer name-compatible, then general:, then ref order.
        name_n = normalize_company_name(info.live_name or "")
        compatible = 1 if host_n and name_n and _names_compatible(host_n, name_n) else 0
        is_general = 1 if info.source_ref.startswith("general:") else 0
        return (compatible, is_general, info.source_ref)

    return max(refs, key=score)


def _classify(host_name: str, keeper: RefInfo, excess: RefInfo) -> str:
    """Classify one excess ref relative to the keeper that stays on the host."""
    if not excess.live_name:
        return "unresolved"
    host_n = normalize_company_name(host_name or "")
    keep_n = normalize_company_name(keeper.live_name or host_name or "")
    exc_n = normalize_company_name(excess.live_name)

    base = extension_base_name(excess.live_name)
    if base:
        base_n = normalize_company_name(base)
        if (keep_n and _names_compatible(base_n, keep_n)) or (
            host_n and _names_compatible(base_n, host_n)
        ):
            return "attach-as-facility"

    if (keep_n and _names_compatible(exc_n, keep_n)) or (
        host_n and _names_compatible(exc_n, host_n)
    ):
        return "merge"
    return "split"


def _load_bgmea_multi(rest: Rest) -> tuple[list[dict], dict[str, list[dict]]]:
    bgmea_id = rest.all_rows("sources", {"select": "id,code", "code": "eq.BGMEA"})[0]["id"]
    suppliers = {
        r["id"]: r for r in rest.all_rows("suppliers", {"select": "id,company_name,slug"})
    }
    rows = rest.all_rows(
        "source_records",
        {
            "select": "id,supplier_id,source_ref,status,fields",
            "source_id": f"eq.{bgmea_id}",
            "status": "eq.active",
        },
    )
    structural = []
    by_supplier_records: dict[str, list[dict]] = defaultdict(list)
    for r in rows:
        if not is_member_ref("BGMEA", r.get("source_ref")):
            continue
        sid = r["supplier_id"]
        by_supplier_records[sid].append(r)
        sup = suppliers.get(sid) or {}
        structural.append(
            {
                "supplier_id": sid,
                "source_code": "BGMEA",
                "source_ref": r["source_ref"],
                "status": r["status"],
                "company_name": sup.get("company_name"),
                "slug": sup.get("slug"),
            }
        )
    findings = find_multi_member_refs(structural)
    return findings, by_supplier_records


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--out",
        default="ops/plans/rez-88-multi-ref-plan.md",
        help="plan markdown path",
    )
    parser.add_argument(
        "--skip-fetch",
        action="store_true",
        help="use associate PDF + cached live-members JSON only (no HTTP)",
    )
    parser.add_argument(
        "--members-file",
        default="ops/_tmp_bgmea_live_members.json",
        help="fallback general-member name oracle (reg/id → name)",
    )
    args = parser.parse_args()

    rest = Rest()
    findings, by_records = _load_bgmea_multi(rest)
    excess_total = sum(f.excess for f in findings)
    print(
        f"structural BGMEA multi_member_ref: {len(findings)} suppliers, "
        f"{excess_total} excess refs"
    )
    if len(findings) != 199 or excess_total != 230:
        print(
            f"STOP: expected 199 suppliers / 230 excess refs, "
            f"got {len(findings)} / {excess_total}. Not writing a plan.",
            file=sys.stderr,
        )
        return 2

    # Index records for the 199.
    multi_ids = {f.supplier_id for f in findings}
    member_ids: list[str] = []
    bare_regs: set[str] = set()
    for sid in multi_ids:
        for r in by_records[sid]:
            ref = r["source_ref"]
            fields = r.get("fields") or {}
            if ref.startswith("general:"):
                mid = fields.get("bgmea_member_id")
                if mid:
                    member_ids.append(str(mid))
            elif str(ref).isdigit():
                bare_regs.add(str(ref))

    member_ids = sorted(set(member_ids))
    print(f"re-fetching {len(member_ids)} general member pages…")
    general_by_mid: dict[str, str] = {}
    if not args.skip_fetch:
        general_by_mid = _fetch_general_names(member_ids)
    else:
        print("  (--skip-fetch: using members-file fallback only)")

    # Fallback oracle from the 4 Aug list snapshot (reg + id).
    members_path = Path(args.members_file)
    by_reg: dict[str, str] = {}
    by_id: dict[str, str] = {}
    if members_path.exists():
        for m in json.loads(members_path.read_text(encoding="utf-8")):
            if m.get("reg") and m.get("name"):
                by_reg[str(m["reg"])] = m["name"]
            if m.get("id") and m.get("name"):
                by_id[str(m["id"])] = m["name"]
        print(f"fallback oracle: {len(by_reg)} regs / {len(by_id)} ids from {members_path}")

    print(f"parsing associate PDF for {len(bare_regs)} bare regs…")
    if not PDF_PATH.exists():
        print(f"ERROR: associate PDF missing at {PDF_PATH}", file=sys.stderr)
        return 2
    associate = _load_associate_names(PDF_PATH)
    print(f"  associate PDF names: {len(associate)}")

    counts = {"split": 0, "attach-as-facility": 0, "merge": 0, "unresolved": 0}
    plan_rows: list[dict[str, Any]] = []

    for finding in sorted(findings, key=lambda f: (f.company_name or "", f.supplier_id)):
        infos: list[RefInfo] = []
        # One RefInfo per distinct source_ref (dedupe re-scrape rows).
        seen_refs: set[str] = set()
        for r in sorted(by_records[finding.supplier_id], key=lambda x: x["source_ref"] or ""):
            ref = r["source_ref"]
            if ref in seen_refs:
                continue
            seen_refs.add(ref)
            fields = r.get("fields") or {}
            mid = fields.get("bgmea_member_id")
            mid_s = str(mid) if mid else None
            reg = None
            live_name = None
            name_source = "unresolved"
            if ref.startswith("general:"):
                reg = ref.split(":", 1)[1]
                if mid_s and mid_s in general_by_mid:
                    live_name = general_by_mid[mid_s]
                    name_source = "member-page"
                elif mid_s and mid_s in by_id:
                    live_name = by_id[mid_s]
                    name_source = "members-file-id"
                elif reg in by_reg:
                    live_name = by_reg[reg]
                    name_source = "members-file-reg"
            elif str(ref).isdigit():
                reg = str(ref)
                if reg in associate:
                    live_name = associate[reg]
                    name_source = "associate-pdf"
            infos.append(
                RefInfo(
                    source_ref=ref,
                    record_id=r["id"],
                    member_id=mid_s,
                    reg=reg,
                    live_name=live_name,
                    name_source=name_source,
                )
            )

        keeper = _pick_keeper(finding.company_name, infos)
        for info in infos:
            if info.source_ref == keeper.source_ref:
                continue
            action = _classify(finding.company_name, keeper, info)
            counts[action] += 1
            plan_rows.append(
                {
                    "slug": finding.slug,
                    "company_name": finding.company_name,
                    "supplier_id": finding.supplier_id,
                    "keeper_ref": keeper.source_ref,
                    "keeper_name": keeper.live_name,
                    "excess_ref": info.source_ref,
                    "excess_name": info.live_name,
                    "excess_name_source": info.name_source,
                    "action": action,
                }
            )

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    lines = [
        "# REZ-88 multi-member-ref plan",
        "",
        "Detection-only. **No splits, merges, or unpublishing.**",
        "",
        "## Reproduction",
        "",
        f"- BGMEA-sourced suppliers with >1 distinct active member `source_ref`: "
        f"**{len(findings)}** (expected 199)",
        f"- Excess refs: **{excess_total}** (expected 230)",
        "- Signal class: `multi_member_ref` (structural; no name comparison)",
        "- Why the name-based detector missed them: all 199 lack "
        "`fields.scraped_company_name` (pre-REZ-56 `bgmea_web` payload)",
        "",
        "## Name recovery",
        "",
        f"- General member pages re-fetched: **{len(general_by_mid)}** / {len(member_ids)}",
        f"- Associate PDF names available: **{len(associate)}**",
        "- Historical `scraped_company_name` was **not** backfilled",
        "",
        "## Classification counts (excess refs)",
        "",
        "| class | count |",
        "| -- | -- |",
        f"| split | {counts['split']} |",
        f"| attach-as-facility | {counts['attach-as-facility']} |",
        f"| merge | {counts['merge']} |",
        f"| unresolved | {counts['unresolved']} |",
        f"| **total** | **{sum(counts.values())}** |",
        "",
        "## Rules",
        "",
        "- Keeper = ref whose recovered name is `_names_compatible` with the host;",
        "  ties prefer `general:` over bare associate regs.",
        "- `attach-as-facility`: excess name matches `extension_base_name` against",
        "  keeper/host (A7 definition; not `_compatible`).",
        "- `merge`: recovered names compatible with keeper/host.",
        "- `split`: distinct legal entity — becomes its own supplier.",
        "- `unresolved`: no live name recovered for the excess ref.",
        "",
        "## Per-ref plan",
        "",
        "| host slug | keeper ref | keeper name | excess ref | excess name | action |",
        "| -- | -- | -- | -- | -- | -- |",
    ]
    for row in plan_rows:
        lines.append(
            f"| {row['slug']} | `{row['keeper_ref']}` | {row['keeper_name'] or '—'} | "
            f"`{row['excess_ref']}` | {row['excess_name'] or '—'} | {row['action']} |"
        )
    lines.append("")
    out_path.write_text("\n".join(lines), encoding="utf-8")
    print(f"wrote {out_path}")
    print(
        f"counts: split={counts['split']} attach-as-facility={counts['attach-as-facility']} "
        f"merge={counts['merge']} unresolved={counts['unresolved']}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
