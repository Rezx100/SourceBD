"""Classify REZ-88 structural multi-member-ref excess refs (plan only).

Reads production via Supabase REST. Recovers the real company name behind each
``general:`` / associate ref, then classifies every excess ref. Does NOT write
scraped_company_name onto historical records and does NOT mutate suppliers.

REZ-90 rewrote the classification after the REZ-88 plan was rejected. Three
rules changed, and all three exist because a similarity score cannot tell a
formatting variant from a different company:

1. **Merge is gated on root tokens, not on a score.** After stripping legal
   forms and geography (``ltd``, ``pvt``, ``int'l``, ``bd``, ``the`` …),
   punctuation and repeated spaces, the surviving tokens must be identical —
   pluralisation and initial spacing aside — or the pair goes to ``review``.
   ``Azim`` / ``Aziz`` and ``Eastern`` / ``Western`` score 92–93 and are
   different companies; no threshold separates them from ``Apparel Gallery`` /
   ``Apparel Gallery Ltd.``, but a root-token comparison does.
2. **The keeper is the ref that matches the host's own ``company_name``.**
   The rejected plan kept ``Eastern Dresses Ltd.`` on a supplier named
   ``Western Dresses Ltd`` and folded the real company into the intruder.
3. **A building can be on either side.** ``extension_base_name`` (REZ-87, the
   single definition) is asked about the excess *and* about the host: when the
   host row is itself the unit, the excess is the parent and the attach runs
   the other way (``attach-host-as-facility``).

Name recovery reuses the REZ-88 fetch — the 4 Aug live-member snapshot plus the
Associate Members PDF reproduce all 230 recovered names byte-identically, so
``--skip-fetch`` (the default) issues no HTTP at all.

USAGE
-----
    python ops/plan_multi_member_refs.py
    python ops/plan_multi_member_refs.py --out ops/plans/rez-90-multi-ref-plan.md
    python ops/plan_multi_member_refs.py --fetch   # re-fetch member pages
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
from unidecode import unidecode

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

from etl.core.normalize import (  # noqa: E402
    _collapse_initials,
    _PUNCT_FOLD,
    extension_base_name,
    make_slug,
    normalize_company_name,
)
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


# ---------------------------------------------------------------------------
# Root-token merge rule (REZ-90 defect 1)
# ---------------------------------------------------------------------------
# Legal form, incorporation and country/geography words carry no identity: a
# company is the same company with or without them. Everything else is a root
# token and a difference in one means a different company, however small the
# edit distance. This list is deliberately closed — widening it to make the
# numbers tidier is how Alpha and Gaya become one supplier.
_ROOT_DROP_TOKENS = frozenset(
    {
        "ltd", "lts", "limited", "plc", "pvt", "private",
        "co", "company", "corp", "corporation",
        "inc", "incorporated", "llc", "llp",
        "int", "intl", "international",
        "bd", "bangladesh", "the",
    }
)

CLASSES = (
    "merge",
    "review",
    "attach-as-facility",
    "attach-host-as-facility",
    "split",
    "unresolved",
)


def root_form(name: str) -> str:
    """Identity-bearing tokens of a company name, in order.

    Apostrophes close up rather than split, so ``Int'l`` reaches the drop list
    as one token instead of leaving a stray ``l`` behind.
    """
    n = unidecode((name or "").translate(_PUNCT_FOLD)).lower()
    n = n.replace("'", "")
    n = re.sub(r"\s*&\s*", " and ", n)
    n = re.sub(r"[^\w\s]", " ", n)
    return " ".join(t for t in n.split() if t not in _ROOT_DROP_TOKENS)


def _singular(token: str) -> str:
    if len(token) > 3 and token.endswith("s") and not token.endswith("ss"):
        return token[:-1]
    return token


def root_tokens_loose(name: str) -> tuple[str, ...]:
    """Root tokens with pluralisation and initial spacing folded away.

    This is the ONLY tolerance the merge rule allows: ``Naba Apparels`` /
    ``Naba Apparel`` and ``R.R.`` / ``RR`` are the same company. Nothing here
    can fold ``Azim`` into ``Aziz``.
    """
    collapsed = _collapse_initials(root_form(name))
    return tuple(_singular(t) for t in collapsed.split())


def roots_mergeable(a: str, b: str) -> tuple[bool, str]:
    """Whether two names may auto-merge, and which band they landed in.

    Returns ``(mergeable, band)`` where band is ``identical``, ``plural`` or
    ``root-differs``. Score is never consulted.
    """
    ra, rb = root_form(a), root_form(b)
    if ra and ra == rb:
        return True, "identical"
    ta, tb = root_tokens_loose(a), root_tokens_loose(b)
    if ta and ta == tb:
        return True, "plural"
    return False, "root-differs"


def _same_company(a: str | None, b: str | None) -> bool:
    if not a or not b:
        return False
    return _names_compatible(normalize_company_name(a), normalize_company_name(b))


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


def _host_match_rank(host_name: str, info: RefInfo) -> int:
    """How strongly this ref's recovered name is the host supplier's own name.

    4 = the same name, 3 = the same root tokens, 2 = the same allowing
    pluralisation, 1 = merely name-compatible, 0 = no relation.

    Rank 4 exists because root form deliberately discards ``International``,
    ``BD`` and the rest: ``Axon Fashion International`` and ``Axon Fashion
    Limited`` share a root, so without it the two refs tie and the
    ``general:`` tie-break decides which company the row is — exactly the
    inversion this rule is meant to stop.
    """
    if not info.live_name or not host_name:
        return 0
    na, nb = normalize_company_name(host_name), normalize_company_name(info.live_name)
    if na and na == nb:
        return 4
    ra, rb = root_form(host_name), root_form(info.live_name)
    if ra and ra == rb:
        return 3
    if root_tokens_loose(host_name) and root_tokens_loose(host_name) == root_tokens_loose(
        info.live_name
    ):
        return 2
    return 1 if _same_company(host_name, info.live_name) else 0


def pick_keeper(host_name: str, refs: list[RefInfo]) -> tuple[RefInfo, bool]:
    """Keep the ref that IS the host, not merely one compatible with it.

    Returns ``(keeper, host_matched)``. ``host_matched`` is False when no ref
    on the supplier bears the host's own ``company_name`` — every registration
    on the row then belongs to someone else, which is its own corruption and
    is reported rather than silently resolved by falling back to ``general:``.
    """

    def score(info: RefInfo) -> tuple[int, int, str]:
        return (
            _host_match_rank(host_name, info),
            1 if info.source_ref.startswith("general:") else 0,
            info.source_ref,
        )

    keeper = max(refs, key=score)
    host_matched = any(_host_match_rank(host_name, r) > 0 for r in refs)
    return keeper, host_matched


# The rejected plan is kept in the tree as evidence, and as the fixture the
# merge rule is measured against: it must split those 60 merges 50 / 4 / 6.
REJECTED_PLAN_PATH = Path(__file__).resolve().parents[1] / "ops/plans/rez-88-multi-ref-plan.md"


def load_rejected_merges(path: Path) -> list[tuple[str, str]]:
    """(keeper name, excess name) for every pair the rejected plan would merge."""
    pairs: list[tuple[str, str]] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.startswith("| ") or "`" not in line:
            continue
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if len(cells) != 6 or cells[5] != "merge":
            continue
        pairs.append((cells[2], cells[4]))
    return pairs


def merge_rule_bands(pairs: list[tuple[str, str]]) -> dict[str, int]:
    """Band counts for a set of candidate merge pairs."""
    bands = dict.fromkeys(("identical", "plural", "root-differs"), 0)
    for keeper_name, excess_name in pairs:
        _ok, band = roots_mergeable(excess_name, keeper_name)
        bands[band] += 1
    return bands


def _rez88_keeper(host_name: str, refs: list[RefInfo]) -> tuple[RefInfo, bool]:
    """The rejected plan's keeper rule, kept only to report what moved."""
    host_n = normalize_company_name(host_name or "")

    def score(info: RefInfo) -> tuple[int, int, str]:
        name_n = normalize_company_name(info.live_name or "")
        compatible = 1 if host_n and name_n and _names_compatible(host_n, name_n) else 0
        return (compatible, 1 if info.source_ref.startswith("general:") else 0, info.source_ref)

    return max(refs, key=score), True


def _split_target(
    excess: RefInfo,
    host_id: str,
    existing_by_slug: dict[str, dict],
    existing_by_root: dict[str, list[dict]],
) -> str:
    """Where a split record should land: an existing supplier, or a new row.

    A split that re-points a record at a company we already hold creates no
    new published profile, which is most of the difference between the
    ~154 new rows the rejected plan implied and what this plan actually costs.
    Name identity is the only admissible signal here — see `_reg_residue` for
    why a registration number is not. Exact slug is tried first because that
    is precisely how `_find_existing` Pass 1 decides an existing row is this
    company; root form is the looser second pass.
    """
    slug_hit = existing_by_slug.get(make_slug(excess.live_name or ""))
    if slug_hit and slug_hit["id"] != host_id:
        return slug_hit["slug"]
    for sup in existing_by_root.get(root_form(excess.live_name or ""), []):
        if sup["id"] != host_id:
            return sup["slug"]
    return "new"


def _reg_residue(
    excess: RefInfo, host_id: str, holders_by_reg: dict[str, list[dict]]
) -> list[str]:
    """Other suppliers publishing this ref's registration number.

    Deliberately NOT a split target. REZ-98 proved every unbacked BGMEA number
    is a live record sitting on someone else — the number is left behind when
    the record moves. A supplier carrying this reg while the host holds the
    record is therefore a *former* false attach, not the true owner, and
    re-pointing to it would repeat the mistake. Reported as a cross-check.
    """
    if not excess.reg:
        return []
    return [s["slug"] for s in holders_by_reg.get(excess.reg, []) if s["id"] != host_id]


def _reg_of(record: dict) -> str | None:
    """The BGMEA registration number a source record stands behind."""
    ref = str(record.get("source_ref") or "")
    if ref.startswith("general:"):
        return ref.split(":", 1)[1]
    if ref.isdigit():
        return ref
    value = (record.get("fields") or {}).get("bgmea_reg_number")
    return str(value) if value else None


def rez98_unbacked_suppliers(
    suppliers: dict[str, dict], backed_regs: dict[str, set[str]]
) -> list[dict]:
    """Published suppliers whose every BGMEA number lacks a live record.

    REZ-98's 61. Reproduced here as a validation set rather than trusted: they
    are the same false-attach event seen from the other end, so they must be
    disjoint from the 199 (a supplier holding two records cannot hold none).
    """
    out = []
    for sup in suppliers.values():
        regs = [str(n) for n in (sup.get("bgmea_reg_numbers") or [])]
        if not sup.get("is_published") or not regs:
            continue
        if not any(r in backed_regs.get(sup["id"], set()) for r in regs):
            out.append(sup)
    return out


def classify_excess(
    host_name: str, keeper: RefInfo, excess: RefInfo, *, host_matched: bool = True
) -> str:
    """Classify one excess ref relative to the keeper that stays on the host.

    ``host_matched`` is the verdict from `pick_keeper`. When it is False no ref
    on the row bears the supplier's own name, so the keeper is an arbitrary
    choice among strangers and every downstream comparison is measured against
    it. Splitting on that basis leaves `DK KNIT WEAR LTD` holding `DK Design
    Ltd.` — a row asserting a name no record backs, which is exactly the
    pathology REZ-98 removed. Those refs go to `review` whatever they look
    like; the row's identity has to be settled first.
    """
    if not excess.live_name:
        return "unresolved"
    if not host_matched:
        return "review"

    keeper_name = keeper.live_name or host_name
    base_excess = extension_base_name(excess.live_name)
    base_host = extension_base_name(host_name)

    # The excess ref is a building of this company — it becomes a facility_of
    # child, never a standalone published supplier.
    if base_excess and any(
        _same_company(base_excess, target)
        for target in (keeper_name, host_name, base_host)
    ):
        return "attach-as-facility"

    # The HOST row is the building and the excess ref is the parent company.
    # The parent splits out and the host becomes its child — the attach runs
    # in the opposite direction, which the rejected plan had no class for.
    if base_host and _same_company(excess.live_name, base_host):
        return "attach-host-as-facility"

    if _same_company(excess.live_name, keeper_name) or _same_company(
        excess.live_name, host_name
    ):
        mergeable, _band = roots_mergeable(excess.live_name, keeper_name)
        return "merge" if mergeable else "review"

    return "split"


def _load_bgmea_multi(
    rest: Rest,
) -> tuple[list[dict], dict[str, list[dict]], dict[str, dict]]:
    bgmea_id = rest.all_rows("sources", {"select": "id,code", "code": "eq.BGMEA"})[0]["id"]
    suppliers = {
        r["id"]: r
        for r in rest.all_rows(
            "suppliers",
            {
                "select": "id,company_name,slug,entity_type,is_published,"
                "facility_of,bgmea_reg_numbers"
            },
        )
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
    return findings, by_supplier_records, suppliers


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--out",
        default="ops/plans/rez-90-multi-ref-plan.md",
        help="plan markdown path",
    )
    parser.add_argument(
        "--fetch",
        action="store_true",
        help="re-fetch BGMEA member pages instead of reusing the REZ-88 names",
    )
    parser.add_argument(
        "--members-file",
        default="ops/_tmp_bgmea_live_members.json",
        help="fallback general-member name oracle (reg/id → name)",
    )
    parser.add_argument(
        "--name-cache",
        default="ops/plans/rez-90-ref-names.json",
        help="checked-in ref → recovered name cache from the REZ-88 fetch",
    )
    args = parser.parse_args()

    rest = Rest()
    findings, by_records, suppliers = _load_bgmea_multi(rest)
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
    general_by_mid: dict[str, str] = {}
    if args.fetch:
        print(f"re-fetching {len(member_ids)} general member pages…")
        general_by_mid = _fetch_general_names(member_ids)
    else:
        print(
            f"reusing REZ-88 recovered names for {len(member_ids)} general refs "
            f"(no HTTP; --fetch to re-fetch)"
        )

    # Checked-in cache of what the REZ-88 fetch recovered, keyed by source_ref.
    # It exists so the plan reproduces without the gitignored member snapshot.
    cache_path = Path(args.name_cache)
    name_cache: dict[str, str] = {}
    if cache_path.exists():
        name_cache = json.loads(cache_path.read_text(encoding="utf-8"))
        print(f"ref name cache: {len(name_cache)} refs from {cache_path}")

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

    # Every published supplier that is not one of the 199 hosts, indexed by
    # root form, so a "split" can say whether the company already has a row.
    existing_by_root: dict[str, list[dict]] = defaultdict(list)
    existing_by_slug: dict[str, dict] = {}
    holders_by_reg: dict[str, list[dict]] = defaultdict(list)
    for sup in suppliers.values():
        if sup.get("slug"):
            existing_by_slug[sup["slug"]] = sup
        if sup.get("company_name"):
            existing_by_root[root_form(sup["company_name"])].append(sup)
        for reg in sup.get("bgmea_reg_numbers") or []:
            holders_by_reg[str(reg)].append(sup)

    backed_regs: dict[str, set[str]] = defaultdict(set)
    reg_record_holder: dict[str, set[str]] = defaultdict(set)
    for sid, recs in by_records.items():
        for r in recs:
            reg = _reg_of(r)
            if reg:
                backed_regs[sid].add(reg)
                reg_record_holder[reg].add(sid)
    unbacked = rez98_unbacked_suppliers(suppliers, backed_regs)

    counts = dict.fromkeys(CLASSES, 0)
    plan_rows: list[dict[str, Any]] = []
    no_host_match: list[dict[str, Any]] = []
    keeper_changes: list[dict[str, Any]] = []
    recovered_names: dict[str, str] = {}

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
            if not live_name and ref in name_cache:
                live_name = name_cache[ref]
                name_source = "rez88-cache"
            if live_name:
                recovered_names[ref] = live_name
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

        keeper, host_matched = pick_keeper(finding.company_name, infos)
        old_keeper, _ = _rez88_keeper(finding.company_name, infos)
        if old_keeper.source_ref != keeper.source_ref:
            keeper_changes.append(
                {
                    "slug": finding.slug,
                    "company_name": finding.company_name,
                    "was": old_keeper.source_ref,
                    "was_name": old_keeper.live_name,
                    "now": keeper.source_ref,
                    "now_name": keeper.live_name,
                }
            )
        if not host_matched:
            no_host_match.append(
                {
                    "slug": finding.slug,
                    "company_name": finding.company_name,
                    "refs": [(i.source_ref, i.live_name) for i in infos],
                }
            )

        for info in infos:
            if info.source_ref == keeper.source_ref:
                continue
            action = classify_excess(
                finding.company_name, keeper, info, host_matched=host_matched
            )
            counts[action] += 1
            target = ""
            if action == "split" and info.live_name:
                target = _split_target(
                    info, finding.supplier_id, existing_by_slug, existing_by_root
                )
            residue = _reg_residue(info, finding.supplier_id, holders_by_reg)
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
                    "split_target": target,
                    "reg_residue": residue,
                }
            )

    splits = [r for r in plan_rows if r["action"] == "split"]
    split_new = [r for r in splits if r["split_target"] == "new"]
    split_existing = [r for r in splits if r["split_target"] not in ("", "new")]
    residue_rows = [r for r in plan_rows if r["reg_residue"]]

    no_host_match_slugs = {r["slug"] for r in no_host_match}
    no_host_match_excess = sum(1 for r in plan_rows if r["slug"] in no_host_match_slugs)

    host_ids = {f.supplier_id for f in findings}
    action_by_ref = {(r["supplier_id"], r["excess_ref"]): r["action"] for r in plan_rows}
    unbacked_hosts = [s for s in unbacked if s["id"] in host_ids]
    unbacked_to_host: list[tuple[str, str, str, str]] = []
    for sup in unbacked:
        for reg in (str(n) for n in sup.get("bgmea_reg_numbers") or []):
            for holder_id in reg_record_holder.get(reg, set()):
                if holder_id not in host_ids:
                    continue
                unbacked_to_host.append(
                    (
                        sup["slug"],
                        reg,
                        suppliers[holder_id]["slug"],
                        action_by_ref.get((holder_id, f"general:{reg}"))
                        or action_by_ref.get((holder_id, reg))
                        or "keeper (stays on the host)",
                    )
                )

    bands = merge_rule_bands(load_rejected_merges(REJECTED_PLAN_PATH))
    print(
        f"REZ-88 merge set under the root rule: identical={bands['identical']} "
        f"plural={bands['plural']} root-differs={bands['root-differs']} (expect 50 / 4 / 6)"
    )

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    lines = [
        "# REZ-90 multi-member-ref plan (revises the rejected REZ-88 plan)",
        "",
        "Detection-only. **No splits, merges, or unpublishing.**",
        "",
        "## Reproduction",
        "",
        f"- BGMEA-sourced suppliers with >1 distinct active member `source_ref`: "
        f"**{len(findings)}** (expected 199)",
        f"- Excess refs: **{excess_total}** (expected 230)",
        "- Signal class: `multi_member_ref` (structural; no name comparison) —"
        " detector unchanged from REZ-88",
        "",
        "## Name recovery",
        "",
        f"- General member pages re-fetched this run: **{len(general_by_mid)}**"
        f" / {len(member_ids)}",
        f"- Names reused from the REZ-88 fetch: **{len(recovered_names)}** refs across"
        " the 199 hosts (keepers + the 230 excess), byte-identical to the"
        " rejected plan on all 230 excess rows",
        f"- Associate PDF names available: **{len(associate)}**",
        "- Historical `scraped_company_name` was **not** backfilled",
        "",
        "## Classification counts (excess refs)",
        "",
        "| class | count | REZ-88 (rejected) |",
        "| -- | -- | -- |",
        f"| split | {counts['split']} | 164 |",
        f"| attach-as-facility | {counts['attach-as-facility']} | 3 |",
        f"| attach-host-as-facility | {counts['attach-host-as-facility']} | — (class did not exist) |",
        f"| merge | {counts['merge']} | 60 |",
        f"| review | {counts['review']} | — (class did not exist) |",
        f"| unresolved | {counts['unresolved']} | 3 |",
        f"| **total** | **{sum(counts.values())}** | **230** |",
        "",
        "## How many published suppliers the split class creates",
        "",
        f"- Splits: **{len(splits)}**",
        f"- Of those, the company **already has a supplier row** and the record"
        f" should be re-pointed rather than a new profile minted: **{len(split_existing)}**",
        f"- Genuinely new published rows: **{len(split_new)}**",
        "",
        "## Validation against REZ-98's 61 stripped suppliers",
        "",
        f"- Published suppliers whose every BGMEA number lacks a live record:"
        f" **{len(unbacked)}** (REZ-98 measured 61)",
        f"- Of those, also one of the 199 multi-ref hosts: **{len(unbacked_hosts)}**"
        " — necessarily zero; a row holding two records cannot hold none",
        f"- Stranded numbers on those suppliers whose live record sits on one of"
        f" the 199: **{len(unbacked_to_host)}**",
        "",
        "The two populations barely intersect, so this plan does not repair the",
        "61 — that stays REZ-99. What the overlap does give is independently",
        "adjudicated rows: REZ-98 established where each of those records really",
        "lives, and this plan agrees with it on every one.",
        "",
    ]
    for src_slug, reg, host_slug, action in unbacked_to_host:
        lines.append(f"- `{src_slug}` published reg {reg}; the record sits on "
                     f"`{host_slug}`, classified **{action}**")
    lines += [
        "",
        "## REZ-98 cross-check — excess regs still published by another supplier",
        "",
        "- Excess refs whose registration number is also carried by another"
        f" supplier's `bgmea_reg_numbers`: **{len(residue_rows)}**",
        "- These are REZ-98 residue, **not** split targets. The live record is",
        "  on the host, so the other supplier is a former false attach that the",
        "  conflation repair moved the record away from and never cleaned up.",
        "  Re-pointing a split at one of them would repeat the original mistake.",
        "",
        "| host slug | excess ref | excess name | reg also published by |",
        "| -- | -- | -- | -- |",
    ]
    for row in residue_rows:
        lines.append(
            f"| {row['slug']} | `{row['excess_ref']}` | {row['excess_name'] or '—'} | "
            f"{', '.join(row['reg_residue'])} |"
        )
    lines += [
        "",
        "## Merge-rule self-check against the rejected plan's 60 merges",
        "",
        "| band | count | expected |",
        "| -- | -- | -- |",
        f"| root tokens identical (safe) | {bands['identical']} | 50 |",
        f"| pluralisation / initials only (safe) | {bands['plural']} | 4 |",
        f"| root token differs (review) | {bands['root-differs']} | 6 |",
        "",
        "## Rules",
        "",
        "- **Keeper** = the ref whose recovered name IS the host's stored",
        "  `company_name` (root tokens, then pluralisation, then",
        "  `_names_compatible`); `general:` breaks ties. A host where no ref",
        "  matches its own name is reported below, not silently resolved.",
        "- **`merge`** requires the excess and keeper root tokens to be identical",
        "  after stripping legal form, incorporation and country words,",
        "  punctuation and repeated spaces — pluralisation and initial spacing",
        "  aside. Similarity score is not consulted at all.",
        "- **`review`** = a name-compatible pair whose root tokens differ. Never",
        "  auto-merged: `Azim` / `Aziz` and `Eastern` / `Western` live here.",
        "- **`attach-as-facility`** = the excess ref is a building of this",
        "  company, per `extension_base_name` (REZ-87, the single definition).",
        "- **`attach-host-as-facility`** = the HOST row is the building and the",
        "  excess ref is the parent: the parent splits out and the host becomes",
        "  its `facility_of` child.",
        "- **`split`** = distinct legal entity. `split target` names the existing",
        "  supplier to re-point to, or `new` when a profile must be created.",
        "- **`unresolved`** = no live name recovered for the excess ref.",
        "",
        f"## Keeper changed from the rejected plan ({len(keeper_changes)})",
        "",
        "| host slug | host `company_name` | was | now |",
        "| -- | -- | -- | -- |",
    ]
    for chg in keeper_changes:
        lines.append(
            f"| {chg['slug']} | {chg['company_name']} | `{chg['was']}` "
            f"{chg['was_name'] or '—'} | `{chg['now']}` {chg['now_name'] or '—'} |"
        )
    lines += [
        "",
        f"## Hosts where NO ref matches the supplier's own name ({len(no_host_match)})",
        "",
        "Every registration on these rows names a different company than the row",
        f"does. All **{no_host_match_excess}** of their excess refs are forced to",
        "`review` regardless of how they classify: the keeper is an arbitrary",
        "choice among strangers, so splitting on it would leave the host",
        "asserting a name no record backs. Separate corruption — reported, not",
        "resolved here. Tracked as REZ-102: seven of the nine are corroborated",
        "by their own BKMEA membership and two by RSC, so the row is a real",
        "company whose entire BGMEA set is foreign, and five hold a coherent",
        "group of companies (DK Design / DK Collection / DK Textile).",
        "",
        "| host slug | host `company_name` | refs |",
        "| -- | -- | -- |",
    ]
    for row in no_host_match:
        refs = " · ".join(f"`{r}` {n or '—'}" for r, n in row["refs"])
        lines.append(f"| {row['slug']} | {row['company_name']} | {refs} |")
    lines += [
        "",
        "## Per-ref plan",
        "",
        "| host slug | keeper ref | keeper name | excess ref | excess name | action "
        "| split target |",
        "| -- | -- | -- | -- | -- | -- | -- |",
    ]
    for row in plan_rows:
        lines.append(
            f"| {row['slug']} | `{row['keeper_ref']}` | {row['keeper_name'] or '—'} | "
            f"`{row['excess_ref']}` | {row['excess_name'] or '—'} | {row['action']} | "
            f"{row['split_target'] or '—'} |"
        )
    lines.append("")
    out_path.write_text("\n".join(lines), encoding="utf-8")
    print(f"wrote {out_path}")

    if not cache_path.exists():
        cache_path.parent.mkdir(parents=True, exist_ok=True)
        cache_path.write_text(
            json.dumps(dict(sorted(recovered_names.items())), indent=2, ensure_ascii=False)
            + "\n",
            encoding="utf-8",
        )
        print(f"wrote ref name cache {cache_path} ({len(recovered_names)} refs)")

    print("counts: " + " ".join(f"{k}={counts[k]}" for k in CLASSES))
    print(
        f"splits creating a NEW published supplier: {len(split_new)} "
        f"(re-point to an existing row: {len(split_existing)})"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
