"""List published profiles named after a building or a unit, beside the main company they belong to.

WHY THIS EXISTS
---------------
Founder, 13 Oct 2026: a company with sheds and extensions should be one
profile. `zaheen-knitwear` (ZAHEEN KNITWEARS LTD) and
`zaheen-knitwear-limited-shed-3-4-5-...` are two published profiles for one
company, because the safety register (RSC) inspects buildings and lists each
as its own factory, and `extension_base_name` (the loader's rule for "this
name is a building of that company") does not know the word "shed".

The mechanism for one company with several buildings already exists and is
live: `suppliers.facility_of` (migration 0091), the publish guard that keeps a
linked building unpublished across re-scrapes (0092), the redirect from the
building's old address to its main company (0096), and the Facilities panel
on the main record (0097-0099). 610 rows were linked that way before this
report. A building is LINKED, never merged: it keeps its own RSC factory id,
inspection reports and worker count, which a merge would pile onto one row.
`ops/merge_duplicate_suppliers.py` stays what it is, the tool for two rows
that are one register entry.

This script finds what that earlier pass did not reach and sorts it:

  (a)  a building-qualified profile with a published main profile
  (b1) a unit-qualified profile with a published main profile
  (b2) qualified profiles that share a base name with each other, no main profile
  (c)  a qualified profile with no other published profile of that base name
  (d)  some other trailing bracket ("(Group)", "(EPZ)") beside a same-name profile

A "main profile" is found by exact recomputed identity only, the rule
`etl.core.upsert._find_facility_parent` uses: the name without its qualifier
normalises to the same squashed `company_name_norm`. Never fuzzy.

Every pair carries the evidence that it is one company (a shared register
number, register entry, phone, mailbox domain, website, address or map pin;
the RSC listing both; the district), and a verdict. A shared name alone is
said to be a shared name alone.

READ-ONLY. There is no `--apply`. This module issues GET requests only.

USAGE
-----
    python ops/report_premises_siblings.py
    python ops/report_premises_siblings.py --out ops/plans/premises-siblings-report.md \
        --json ops/plans/premises-siblings.json

Exit codes: 0 report produced, 2 could not run.
"""

from __future__ import annotations

import argparse
import json
import logging
import math
import re
import sys
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

from etl.core.normalize import (  # noqa: E402
    clean_display_name,
    extension_base_name,
    normalize_company_name,
)
from ops.report_group_of_companies import (  # noqa: E402
    area_tokens,
    same_premises,
    shared_phones,
)

# A trailing bracket that is part of the company's name, never a qualifier
# after it (the same list as `PART_OF_NAME` in lib/dashboard/facts.ts).
_PART_OF_NAME_RE = re.compile(r"^(?:bangladesh|bd|pvt\.?|private|pvt\.?\s*ltd\.?)$", re.IGNORECASE)
_TRAILING_BRACKET_RE = re.compile(r"(?:\s*[&,-]\s*|\s*)[(\[]([^()\[\]]*)[)\]]+\.?\s*$")

# Words that name a building on the company's own site. The first group is
# the `PREMISES` list in lib/dashboard/facts.ts (what PR 505 cuts from
# titles); the rest are the building spellings `extension_base_name` knows.
# "Relocated" is deliberately absent: a company that moved is still one
# factory, so those rows are read by hand in group (d), not linked as a site.
_BUILDING_RE = re.compile(
    r"\b(?:sheds?|buildings?|bldg|annexe?|extension|extention|ext|expansion|extended|warehouse|"
    r"floors?|block|plot|new\s+location)\b",
    re.IGNORECASE,
)
_UNIT_RE = re.compile(
    r"\b(?:units?|u[\s-]*\d+|factory|plant|division|div|dv|section|mills?|branch)\b|^[\s\-.,]*\d+[\s\-.,\d]*$",
    re.IGNORECASE,
)
# A bracket that gives a former name is a note about the company, not a site.
_FORMER_RE = re.compile(r"\b(?:former(?:ly)?|old\s+name|previous(?:ly)?)\b", re.IGNORECASE)
# What `extension_base_name` leaves behind when it takes only the number off
# "... Ltd. Building - 2" or "... Ltd. Ext.-1".
_DANGLING_WORD_RE = re.compile(
    r"[\s,.-]+(?:ext|extension|buildings?|bldg|units?|sheds?)\.?\s*$", re.IGNORECASE
)
# A unit number inside the registered name ("N. T. APPARELS UNIT-2 LIMITED").
# Not a trailing qualifier, so not a candidate; counted so the gap is visible.
_UNIT_INSIDE_RE = re.compile(r"\bunit[\s-]*(?:\d+|[ivx]+)\b(?=.*\b(?:ltd|limited)\b)", re.IGNORECASE)

_GENERIC_MAIL = frozenset(
    {"gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "live.com", "ymail.com",
     "aol.com", "bdcom.com", "bol-online.com", "bangla.net", "citechco.net", "dhaka.net",
     "bijoy.net", "agni.com", "link3.net", "bttb.net.bd", "btcl.net.bd", "rocketmail.com"}
)
_TIER_13 = frozenset({"tier1_gov", "tier2_industry", "tier3_cert"})


def identity_key(name: str) -> str:
    """The squashed normalised name: `_find_facility_parent`'s exact-identity test."""
    return normalize_company_name(name).replace(" ", "")


@dataclass(frozen=True)
class Qualified:
    """A name that ends in a qualifier.

    `chain` is the name with one more qualifier taken off at each step,
    nearest first: "X (Unit-2) (Extension)" gives ["X (Unit-2)", "X"]. The
    company's profile is looked for first, the unit's only when it has none.
    """

    kind: str  # building | unit | other
    qualifier: str
    chain: tuple[str, ...]

    @property
    def base(self) -> str:
        return self.chain[-1]


def _balanced(name: str) -> bool:
    depth = 0
    for ch in name:
        depth += 1 if ch in "([" else -1 if ch in ")]" else 0
        if depth < 0:
            return False
    return depth == 0


def _strip_once(name: str) -> str | None:
    """Take one trailing qualifier off, or None when the name ends in none."""
    m = _TRAILING_BRACKET_RE.search(name) if _balanced(name) else None
    if m and not _PART_OF_NAME_RE.match(m.group(1).strip()):
        rest = name[: m.start()].strip(" -,&")
        if re.fullmatch(r"[\s\d,&-]*", m.group(1)):
            # "... TEXTILE UNIT (2)": the bracket is only the number of the word before it.
            rest = _DANGLING_WORD_RE.sub("", rest).strip(" -,&")
        if rest:
            return rest
    # Forms without a bracket ("... Ltd. Unit-2", "... - Extension 2") and
    # brackets that do not balance: the loader's own rule, never a second one.
    base = extension_base_name(name)
    if not base:
        return None
    return _DANGLING_WORD_RE.sub("", base).strip(" -,&") or None


def classify(name: str) -> Qualified | None:
    """The qualifier a stored name ends with, or None for a plain name."""
    clean = clean_display_name(name or "")
    if not clean:
        return None
    chain: list[str] = []
    current = clean
    for _ in range(6):
        nxt = _strip_once(current)
        if not nxt or nxt.lower() == current.lower() or not identity_key(nxt):
            break
        chain.append(nxt)
        current = nxt
    if not chain:
        return None
    # The outermost qualifier (the last thing in the name) says what this row is.
    outer = clean[len(chain[0]):] if clean.lower().startswith(chain[0].lower()) else clean
    whole = clean[len(chain[-1]):] if clean.lower().startswith(chain[-1].lower()) else clean
    outer = outer.strip(" -,&.")
    if _FORMER_RE.search(outer):
        kind = "other"
    else:
        kind = "building" if _BUILDING_RE.search(outer) else "unit" if _UNIT_RE.search(outer) else "other"
    return Qualified(kind=kind, qualifier=whole.strip(" -,&."), chain=tuple(chain))


# ---------------------------------------------------------------------------
# Evidence that two profiles are one company
# ---------------------------------------------------------------------------

@dataclass
class Evidence:
    strong: list[str] = field(default_factory=list)
    supporting: list[str] = field(default_factory=list)
    against: list[str] = field(default_factory=list)
    # Said beside the evidence, never counted as evidence.
    notes: list[str] = field(default_factory=list)
    same_entry: bool = False
    # A register that holds both profiles as separate entries: the register
    # itself says they are two things (for RSC, two buildings).
    listed_twice: list[str] = field(default_factory=list)

    @property
    def verdict(self) -> str:
        if self.same_entry:
            return "same register entry"
        if self.strong:
            return "strong, but check" if self.against else "strong"
        if self.against:
            return "check by hand"
        if self.supporting:
            return "name and district"
        return "name only"


def _reg_int(value: str | None) -> str | None:
    m = re.match(r"\s*(\d+)", value or "")
    return m.group(1) if m else None


def _mail_domains(sup: dict) -> set[str]:
    out = set()
    for token in re.findall(r"[\w.+-]+@([\w.-]+\.\w+)", (sup.get("email_primary") or "").lower()):
        if token not in _GENERIC_MAIL:
            out.add(token)
    return out


def _site_host(sup: dict) -> str | None:
    raw = (sup.get("website") or "").strip().lower()
    if not raw:
        return None
    host = urlparse(raw if "//" in raw else "//" + raw).hostname or ""
    return host[4:] if host.startswith("www.") else host or None


def _addresses(sup: dict, records: list[dict]) -> list[str]:
    """Every address a register filed for this row. Mailing addresses are a
    head office, not the factory, so they are left out."""
    out = [sup.get("address_raw") or ""]
    for rec in records:
        for key, value in (rec.get("fields") or {}).items():
            if "address" in key and "mailing" not in key and isinstance(value, str):
                out.append(value)
    seen: dict[str, str] = {}
    for a in out:
        k = re.sub(r"[^a-z0-9]", "", a.lower())
        if len(k) >= 8 and a.strip().lower() != "none":
            seen.setdefault(k, a.strip())
    return list(seen.values())


def _km(a: dict, b: dict) -> float | None:
    try:
        la, lo, lb, lp = (float(a["lat"]), float(a["lng"]), float(b["lat"]), float(b["lng"]))
    except (KeyError, TypeError, ValueError):
        return None
    x = math.radians(lp - lo) * math.cos(math.radians((la + lb) / 2))
    return 6371 * math.hypot(x, math.radians(lb - la))


def _entry_refs(records: list[dict]) -> dict[str, set[str]]:
    out: dict[str, set[str]] = defaultdict(set)
    for rec in records:
        # "1572:detail" is entry 1572 and "oeko-tex-21325:step" is certificate
        # 21325. A leading "general:" (BGMEA's second register) is kept.
        # A suffix follows a number; in "general:35" the number IS the entry.
        out[rec["code"]].add(re.sub(r"(?<=\d):(?:detail|step|\d+)$", "", rec.get("source_ref") or ""))
    return out


# Address words that place a town, not a building.
_PLACE_NOISE = frozenset(
    {"area", "bazar", "bazaar", "road", "sadar", "extension", "industrial", "works", "thana",
     "upazila", "post", "union", "ward", "south", "north", "east", "west", "para", "nagar"}
)


def evidence(q: dict, p: dict, q_recs: list[dict], p_recs: list[dict]) -> Evidence:
    """What says `q` and `p` are one company, beyond the name they share."""
    ev = Evidence()
    q_refs, p_refs = _entry_refs(q_recs), _entry_refs(p_recs)
    for code in sorted(set(q_refs) & set(p_refs)):
        shared = sorted(q_refs[code] & p_refs[code])
        if shared:
            ev.same_entry = True
            ev.strong.append(f"both hold {code} entry {', '.join(shared)}")
        else:
            ev.listed_twice.append(code)
            ev.notes.append(
                f"{code} lists both, as entries {', '.join(sorted(p_refs[code]))} and {', '.join(sorted(q_refs[code]))}"
            )

    bg = set(q.get("bgmea_reg_numbers") or []) & set(p.get("bgmea_reg_numbers") or [])
    if bg:
        ev.strong.append(f"same BGMEA number {', '.join(sorted(bg))}")
    bk_q, bk_p = _reg_int(q.get("bkmea_reg_number")), _reg_int(p.get("bkmea_reg_number"))
    if bk_q and bk_q == bk_p:
        ev.strong.append(f"same BKMEA number {bk_q}")
    for col, label in (("epb_erc_number", "EPB number"), ("rjsc_reg_number", "RJSC number")):
        if q.get(col) and q.get(col) == p.get(col):
            ev.strong.append(f"same {label} {q[col]}")

    phones = shared_phones(", ".join(q.get("phones") or []), ", ".join(p.get("phones") or []))
    if phones:
        # A switchboard is contact detail: the report says it matched, not what it is.
        ev.strong.append(f"{len(phones)} shared phone number{'s' if len(phones) > 1 else ''}")
    domains = _mail_domains(q) & _mail_domains(p)
    if domains:
        ev.strong.append(f"same mailbox domain {', '.join(sorted(domains))}")
    if _site_host(q) and _site_host(q) == _site_host(p):
        ev.strong.append(f"same website {_site_host(q)}")

    q_addr, p_addr = _addresses(q, q_recs), _addresses(p, p_recs)
    # A district or town both rows sit in is the district line below, not an address match.
    towns = _PLACE_NOISE | {
        w for s in (q, p) for col in ("district", "city") for w in area_tokens(s.get(col))
    }
    address_hit = None
    for a in q_addr:
        for b in p_addr:
            ok, basis = same_premises(a, b)
            if ok:
                address_hit = f"same house and road ({basis})"
            elif not address_hit:
                ta, tb = area_tokens(a) - towns, area_tokens(b) - towns
                both = ta & tb
                if len(both) >= 2 and len(both) / max(1, len(ta | tb)) >= 0.5:
                    address_hit = f"addresses share {', '.join(sorted(both)[:4])}"
    if address_hit:
        ev.strong.append(address_hit)
    elif not q_addr:
        ev.notes.append("no address on the qualified profile")

    km = _km(q, p)
    if km is not None:
        if km <= 0.5:
            ev.strong.append(f"map pins {round(km * 1000)} m apart")
        elif km > 5:
            ev.against.append(f"map pins {km:.0f} km apart")

    group_q, group_p = (q.get("parent_group_name") or "").strip(), (p.get("parent_group_name") or "").strip()
    if group_q and group_q.lower() == group_p.lower():
        ev.strong.append(f"same parent group {group_q}")

    dq, dp = (q.get("district") or "").strip(), (p.get("district") or "").strip()
    if dq and dp:
        (ev.supporting if dq.lower() == dp.lower() else ev.against).append(
            f"same district {dq}" if dq.lower() == dp.lower() else f"districts differ: {dq} / {dp}"
        )
    return ev


# ---------------------------------------------------------------------------
# Sorting the population
# ---------------------------------------------------------------------------

def proposed_action(bucket: str, ev: Evidence | None) -> str:
    if bucket == "c":
        return "no change to data; title may drop the qualifier once the founder picks how (section 5)"
    if bucket == "b2":
        return "no main profile to link to; founder decides which profile is the company"
    assert ev is not None
    if ev.same_entry:
        return "duplicate of one register entry: ops/merge_duplicate_suppliers.py --pair, not a link"
    if bucket == "d":
        # The bracket names no building or unit, so the name cannot say which
        # it is. The registers can: one that lists both holds two things.
        if ev.listed_twice:
            return f"read first; {', '.join(ev.listed_twice)} lists them as two, so a link if they are one company"
        return "read first; no register holds both, so likely one company filed twice: merge only on the founder's yes"
    if ev.verdict == "check by hand":
        return "do not link until the conflict is read"
    if ev.verdict == "name only":
        return "link as a building of the main profile, after a look (name is the only evidence)"
    return "link as a building of the main profile (facility_of)"


# Founder, 13 Oct 2026: "must stay: buying house". It says what the company
# is, so no title drops it; every other lone qualifier goes.
_TITLE_KEEPS_RE = re.compile(r"buying\s+house", re.IGNORECASE)


def plan_for(bucket: str, q: Qualified, pairs: list[dict], claims: int) -> str:
    """What the founder's "merge smartly and carefully" comes to for one row.

    attach: becomes a building of the main profile (one profile on the site,
            the building's own registers kept apart and labelled).
    merge:  one company filed twice; the main profile absorbs the row.
    read:   the evidence does not carry a change; a person decides.
    """
    if bucket == "c":
        return "title-keep" if _TITLE_KEEPS_RE.search(q.qualifier) else "title-drop"
    if len(pairs) != 1:
        return "read"
    ev: Evidence = pairs[0]["evidence"]
    if ev.same_entry:
        return "merge"
    if bucket in ("a", "b1"):
        return "attach" if ev.verdict in ("strong", "name and district") else "read"
    # (d): the bracket names no site, so only evidence beyond the name moves a
    # row, and never when two bracketed rows claim the same main profile
    # ("Anowara Fashions (Anowara Group)" and "(Habib Group)" are two owners).
    if ev.verdict != "strong" or claims > 1:
        return "read"
    if not ev.listed_twice:
        return "merge"
    # Only the safety register lists buildings. Two memberships or two
    # certificates under one name are not a site, so a person reads those.
    return "attach" if "RSC" in ev.listed_twice else "read"


def build(suppliers: list[dict]) -> dict[str, Any]:
    """Bucket every published, unlinked profile whose name ends in a qualifier."""
    published = [s for s in suppliers if s.get("is_published") and not s.get("facility_of")]
    by_key: dict[str, list[dict]] = defaultdict(list)
    for s in published:
        by_key[identity_key(s["company_name"])].append(s)
    unpublished_by_key: dict[str, list[dict]] = defaultdict(list)
    for s in suppliers:
        if not s.get("is_published"):
            unpublished_by_key[identity_key(s["company_name"])].append(s)

    qualified: dict[str, Qualified] = {}
    for s in published:
        q = classify(s["company_name"])
        if q:
            qualified[s["id"]] = q
    by_root: dict[str, list[dict]] = defaultdict(list)
    for s in published:
        q = qualified.get(s["id"])
        if q:
            by_root[identity_key(q.base)].append(s)

    rows: list[dict] = []
    for s in published:
        q = qualified.get(s["id"])
        if not q:
            continue
        # The company's own profile wins over a nearer unit's: a building
        # linked to a unit that is itself linked would hang off an
        # unpublished row, and the redirect (0096) does not follow two steps.
        mothers: list[dict] = []
        for step in reversed(q.chain):
            mothers = [m for m in by_key.get(identity_key(step), []) if m["id"] != s["id"]]
            if mothers:
                break
        siblings = [x for x in by_root[identity_key(q.base)] if x["id"] != s["id"]]
        if mothers:
            bucket = {"building": "a", "unit": "b1"}.get(q.kind, "d")
        elif siblings:
            bucket = "b2"
        else:
            bucket = "c"
        rows.append(
            {
                "bucket": bucket,
                "supplier": s,
                "qualified": q,
                "mothers": mothers,
                "siblings": siblings,
                "unpublished_same_base": unpublished_by_key.get(identity_key(q.base), []),
            }
        )
    inside = [
        s for s in published
        if s["id"] not in qualified and _UNIT_INSIDE_RE.search(s["company_name"] or "")
    ]
    return {
        "rows": rows,
        "published": len(published),
        "linked": sum(1 for s in suppliers if s.get("facility_of")),
        "unit_inside_name": inside,
    }


# ---------------------------------------------------------------------------
# Production reads (GET only)
# ---------------------------------------------------------------------------

_SUPPLIER_COLUMNS = (
    "id,slug,company_name,is_published,facility_of,district,city,address_raw,phones,"
    "email_primary,website,employees_total,bgmea_reg_numbers,bkmea_reg_number,"
    "epb_erc_number,rjsc_reg_number,parent_group_name,source_tags,lat,lng"
)


def load_suppliers(rest: Any) -> list[dict]:
    return rest.all_rows("suppliers", {"select": _SUPPLIER_COLUMNS, "order": "id"})


def load_records(rest: Any, supplier_ids: list[str]) -> dict[str, list[dict]]:
    """Active Tier 1-3 register entries for the profiles in the report."""
    sources = {s["id"]: s for s in rest.all_rows("sources", {"select": "id,code,tier"})}
    out: dict[str, list[dict]] = defaultdict(list)
    for i in range(0, len(supplier_ids), 60):
        chunk = supplier_ids[i : i + 60]
        for rec in rest.all_rows(
            "source_records",
            {
                "select": "supplier_id,source_id,source_ref,fields",
                "supplier_id": f"in.({','.join(chunk)})",
                "status": "eq.active",
                "order": "id",
            },
        ):
            src = sources.get(rec["source_id"])
            if src and src["tier"] in _TIER_13:
                fields = {
                    k: v for k, v in (rec.get("fields") or {}).items() if "address" in k
                }
                out[rec["supplier_id"]].append(
                    {"code": src["code"], "source_ref": rec["source_ref"], "fields": fields}
                )
    return out


# ---------------------------------------------------------------------------
# Report
# ---------------------------------------------------------------------------

def _codes(records: list[dict]) -> str:
    return ", ".join(sorted({r["code"] for r in records})) or "none"


def _cell(text: Any) -> str:
    return str(text if text not in (None, "") else "-").replace("|", "/")


def _profile(s: dict, recs: dict[str, list[dict]]) -> str:
    workers = f"{s['employees_total']:,}" if s.get("employees_total") else "-"
    return (
        f"{_cell(s['company_name'])}<br>`{s['slug']}`<br>"
        f"{_cell(s.get('district'))} · {workers} workers · {_codes(recs.get(s['id'], []))}"
    )


def finish(data: dict[str, Any], recs: dict[str, list[dict]]) -> list[dict]:
    """Attach evidence, verdict and proposed action to every row."""
    out = []
    for row in data["rows"]:
        s = row["supplier"]
        pairs = []
        for m in row["mothers"]:
            ev = evidence(s, m, recs.get(s["id"], []), recs.get(m["id"], []))
            pairs.append({"main": m, "evidence": ev})
        best = pairs[0]["evidence"] if len(pairs) == 1 else None
        action = (
            "more than one main profile shares this name; resolve those first"
            if len(pairs) > 1
            else proposed_action(row["bucket"], best)
        )
        out.append({**row, "pairs": pairs, "action": action})
    claims = Counter(r["pairs"][0]["main"]["id"] for r in out if r["bucket"] == "d" and r["pairs"])
    for r in out:
        n = claims[r["pairs"][0]["main"]["id"]] if r["bucket"] == "d" and r["pairs"] else 1
        r["plan"] = plan_for(r["bucket"], r["qualified"], r["pairs"], n)
    out.sort(key=lambda r: (r["bucket"], identity_key(r["qualified"].base), r["supplier"]["slug"]))
    return out


_BUCKET_TITLES = {
    "a": "(a) Building-qualified profile with a published main profile",
    "b1": "(b1) Unit-qualified profile with a published main profile",
    "b2": "(b2) Qualified profiles sharing a base name, with no main profile",
    "c": "(c) Qualified profile with no other published profile of that name",
    "d": "(d) Another trailing bracket beside a same-name profile",
}


def render(rows: list[dict], data: dict[str, Any], recs: dict[str, list[dict]], generated: str) -> str:
    counts = Counter(r["bucket"] for r in rows)
    kinds = Counter((r["bucket"], r["qualified"].kind) for r in rows)
    verdicts = Counter(
        (r["bucket"], r["pairs"][0]["evidence"].verdict if len(r["pairs"]) == 1 else "several main profiles")
        for r in rows if r["pairs"]
    )
    L: list[str] = []
    add = L.append
    add("# Sheds, extensions and units published as their own profiles: dry run")
    add("")
    add(f"Generated {generated} by `ops/report_premises_siblings.py`. **Nothing was changed.** "
        "Read-only against production; the script has no apply mode.")
    add("")
    add("## 1. Counts")
    add("")
    add(f"Published profiles not already linked as a building: **{data['published']:,}**. "
        f"Names ending in a qualifier: **{len(rows)}**.")
    add("")
    add("| group | profiles | of which building / unit / other |")
    add("| -- | -- | -- |")
    for b in ("a", "b1", "b2", "c", "d"):
        add(f"| {_BUCKET_TITLES[b]} | **{counts[b]}** | "
            f"{kinds[(b, 'building')]} / {kinds[(b, 'unit')]} / {kinds[(b, 'other')]} |")
    add("")
    add("Evidence behind each pair that has a main profile:")
    add("")
    add("| group | strong | strong, but check | name and district | name only | check by hand | same register entry | several main profiles |")
    add("| -- | -- | -- | -- | -- | -- | -- | -- |")
    for b in ("a", "b1", "d"):
        add(f"| {b} | " + " | ".join(
            str(verdicts[(b, v)]) for v in
            ("strong", "strong, but check", "name and district", "name only", "check by hand",
             "same register entry", "several main profiles")
        ) + " |")
    add("")
    add(f"Not candidates, counted so the gap is visible: **{len(data['unit_inside_name'])}** published names "
        "carry a unit number inside the registered name (\"... UNIT-2 LIMITED\"). Those are registered "
        "company names and are left alone.")
    add("")
    add("These figures replace the ad-hoc SQL count of 13 Oct 2026 (211 qualified names, about 132 with a "
        "same-name profile, 79 alone). That count normalised names its own way; this one uses the loader's "
        "rule, so the two differ by a few rows.")
    add("")

    linkable = [r for r in rows if r["bucket"] in ("a", "b1")]
    ready = [
        r for r in linkable
        if len(r["pairs"]) == 1 and r["pairs"][0]["evidence"].verdict in ("strong", "name and district")
    ]
    rsc_only = [r for r in linkable if {x["code"] for x in recs.get(r["supplier"]["id"], [])} <= {"RSC"}]
    unknown_to_loader = [r for r in linkable if extension_base_name(r["supplier"]["company_name"]) is None]
    add("## 2. Link or merge")
    add("")
    add("**Link.** A shed, extension or unit profile becomes a building of the main company "
        f"(`facility_of`, migration 0091), which is how {data['linked']:,} rows were already handled. "
        "It is not merged, because:")
    add("")
    add("- The safety register lists each building as its own factory, with its own inspection reports, "
        "progress and worker count. Read on 13 Oct 2026: Zaheen's main entry is RSC factory 11497 (893 "
        "workers, 93% done); the sheds are factory 24449 (1,634 workers, 75% done). A merge puts both on one row and the record can "
        "no longer say which building a report belongs to.")
    add("- A link survives the nightly re-scrape (the publish guard, 0092), sends the old address to the "
        "main company (0096, live) and shows the building on the main record's Facilities panel "
        "(0097-0099). A merge deletes the second row.")
    add("- A link is undone by clearing one column. A merge is not undone.")
    add("")
    add("The one exception is a pair that holds the **same register entry** on both rows: that is one "
        "entry filed twice, and `ops/merge_duplicate_suppliers.py --pair` is the tool.")
    add("")
    add("## 3. What an apply would do (not built, not run)")
    add("")
    add(f"Of the **{len(linkable)}** profiles in (a) and (b1), **{len(ready)}** have one main profile and "
        f"no conflict; the rest need a read first (two main profiles of the same name, a district that "
        "differs, or one entry filed twice).")
    add("")
    add("1. Snapshot the rows, then set `facility_of` on each approved profile. The guard unpublishes it; "
        "its address redirects to the main company.")
    add(f"2. Check first, on one pair: {len(linkable) - len(rsc_only)} of the {len(linkable)} hold a register "
        "other than RSC (a membership or a certificate filed under the unit's name). The main record must "
        "show those after the link, or the buyer loses them. The August inventory "
        "(`ops/plans/rez-58-facility-compliance-inventory.md`) found that gap for memberships; 0099 was "
        "written to close it and has not been re-measured here.")
    add(f"3. Teach the loader the missing spellings. `extension_base_name` does not recognise "
        f"{len(unknown_to_loader)} of these {len(linkable)} names (\"Shed\", \"Warehouse\", \"Building-2\", "
        "\"Garments Division\"), which is why they were published as companies. A linked row stays linked, "
        "but the next new shed the RSC lists would be published the same way until the rule knows the word. "
        "A code change with tests, no data.")
    add("")

    add("## 4. Every candidate")
    add("")
    for b in ("a", "b1", "d"):
        add(f"### {_BUCKET_TITLES[b]}")
        add("")
        add("| qualified profile | main profile | evidence they are one company | verdict | proposed |")
        add("| -- | -- | -- | -- | -- |")
        for r in (x for x in rows if x["bucket"] == b):
            for i, pair in enumerate(r["pairs"]):
                ev = pair["evidence"]
                said = "; ".join(
                    ev.strong + ev.supporting + [f"AGAINST: {x}" for x in ev.against] + [f"({x})" for x in ev.notes]
                ) or "the name only"
                add(f"| {_profile(r['supplier'], recs) if i == 0 else '(same)'} | {_profile(pair['main'], recs)} | "
                    f"{_cell(said)} | {ev.verdict if len(r['pairs']) == 1 else 'several main profiles'} | {r['action']} |")
        add("")

    add(f"### {_BUCKET_TITLES['b2']}")
    add("")
    add("| base name | profiles sharing it |")
    add("| -- | -- |")
    seen: set[str] = set()
    for r in (x for x in rows if x["bucket"] == "b2"):
        key = identity_key(r["qualified"].base)
        if key in seen:
            continue
        seen.add(key)
        members = [r["supplier"], *r["siblings"]]
        add(f"| {_cell(r['qualified'].base)} | " + "<br><br>".join(_profile(m, recs) for m in members) + " |")
    add("")

    add(f"### {_BUCKET_TITLES['c']}")
    add("")
    add("| profile | qualifier | kind | title without it | unpublished rows of that name |")
    add("| -- | -- | -- | -- | -- |")
    for r in (x for x in rows if x["bucket"] == "c"):
        q = r["qualified"]
        hidden = r["unpublished_same_base"]
        note = "-" if not hidden else ", ".join(f"`{h['slug']}`" for h in hidden[:3]) + (" ..." if len(hidden) > 3 else "")
        add(f"| {_profile(r['supplier'], recs)} | {_cell(q.qualifier)} | {q.kind} | {_cell(q.base)} | {note} |")
    add("")

    c_rows = [r for r in rows if r["bucket"] == "c"]
    c_kinds = Counter(r["qualified"].kind for r in c_rows)
    add("## 5. Group (c): how the app would learn \"no other profile\" (a proposal, nothing built)")
    add("")
    add("Whether a qualifier can be dropped depends on the other rows, not on the name: \"Unit-2\" is "
        "noise while the company has one profile and the only thing telling two profiles apart once a "
        "second is published. A title is drawn from one row, so the answer has to be stored or looked up.")
    add("")
    add("**Option 1, recommended: a stored display name.** `suppliers.name_display` already exists; it is "
        "empty on every row and only the admin pages read it. A re-runnable job (this script's rule) writes "
        "the name without its qualifier for group (c), and clears it again when a second profile of that "
        "name is published. The buyer pages show it when set, the filed name otherwise; the filed name stays "
        "on the record as \"Registered name\" and the qualifier is listed on the Sites tab, as PR 505 does "
        "for buildings. Cost: the two readers that feed search and the record return one more column (one "
        "migration), and the job runs after each register load. An admin can overrule any title by hand, "
        "which matters for the awkward ones below.")
    add("")
    add("**Option 2: a flag worked out live.** Store each row's base name once and let the readers count "
        "other published rows with the same base. Never out of date, but it adds a column, an index and a "
        "count to every search row, and nobody can overrule a single title.")
    add("")
    add(f"Either way the founder also picks **which qualifiers go**. Of the {len(c_rows)}: "
        f"{c_kinds['building']} name a building (already cut from titles by PR 505 where bracketed), "
        f"{c_kinds['unit']} name a unit or division, and {c_kinds['other']} are something else: a filing "
        "note (\"FOR UD\"), an abbreviation (\"KSI\"), a group or sister-concern line. Recommended: drop "
        "buildings and units by rule, and decide the others from the list above, since \"(Buying House)\" "
        "or \"(Spinning Mills)\" can be the only words saying what the company is.")
    add("")

    plans = Counter(r["plan"] for r in rows)
    add("## 6. The plan (founder, 13 Oct 2026: \"must stay: buying house, and everything else must merge "
        "smartly and carefully\")")
    add("")
    add("| step | profiles | what happens |")
    add("| -- | -- | -- |")
    add(f"| attach | **{plans['attach']}** | becomes a building of its main profile: one profile on the site, "
        "the old address redirects, its own registers show on the main record under the building's name |")
    add(f"| merge | **{plans['merge']}** | one company filed twice: the main profile absorbs it "
        "(`ops/merge_duplicate_suppliers.py --pair`), which cannot be undone |")
    add(f"| read | **{plans['read']}** | left alone: a district that differs, two main profiles, no main "
        "profile, two rows claiming one company, or a name with nothing else behind it |")
    add(f"| title drops the qualifier | **{plans['title-drop']}** | no data change |")
    add(f"| title keeps it | **{plans['title-keep']}** | \"Buying House\" stays |")
    add("")
    add("Checked on production before proposing the attach: the live record reader already shows a linked "
        "building's memberships and certificates on the main record, labelled with the building; 69 of the "
        "610 rows linked earlier rely on it.")
    add("")
    for step, verb in (("attach", "becomes a building of"), ("merge", "is absorbed by")):
        add(f"### {step}")
        add("")
        for r in (x for x in rows if x["plan"] == step):
            add(f"- `{r['supplier']['slug']}` {verb} `{r['pairs'][0]['main']['slug']}`")
        add("")
    add("### read")
    add("")
    for r in (x for x in rows if x["plan"] == "read"):
        add(f"- `{r['supplier']['slug']}` ({r['bucket']}): {r['action']}")
    add("")
    return "\n".join(L)


def attach_sql(rows: list[dict]) -> str:
    """The attach step as SQL that cannot commit: it ends by raising.

    The publish guard (0092) unpublishes a row when `facility_of` is set, and
    `facility_parent_slug` (0096) is what the old address redirects through;
    the last statement reports both and rolls everything back.
    """
    pairs = [(r["supplier"]["id"], r["pairs"][0]["main"]["id"]) for r in rows if r["plan"] == "attach"]
    values = ",\n    ".join(f"('{c}'::uuid, '{m}'::uuid)" for c, m in pairs)
    return f"""-- Generated by ops/report_premises_siblings.py. DRY RUN: the last statement raises, so nothing commits.
do $dry$
declare n_set int; n_hidden int; n_redirect int; n_main_bad int;
begin
  create temp table _attach(child uuid, main uuid) on commit drop;
  insert into _attach values
    {values};
  select count(*) into n_main_bad from _attach a join public.suppliers m on m.id = a.main
   where not m.is_published or m.facility_of is not null
      or a.main in (select child from _attach);
  update public.suppliers s set facility_of = a.main from _attach a
   where s.id = a.child and s.facility_of is null and s.is_published;
  get diagnostics n_set = row_count;
  select count(*) into n_hidden from _attach a join public.suppliers s on s.id = a.child where not s.is_published;
  select count(*) into n_redirect from _attach a join public.suppliers s on s.id = a.child
   where public.facility_parent_slug(s.slug) is not null;
  raise exception 'DRY RUN OK | pairs % | linked % | now unpublished % | old address redirects % | main not usable %',
    {len(pairs)}, n_set, n_hidden, n_redirect, n_main_bad;
end $dry$;
"""


def to_json(rows: list[dict], recs: dict[str, list[dict]]) -> list[dict]:
    def slim(s: dict) -> dict:
        return {
            "id": s["id"], "slug": s["slug"], "company_name": s["company_name"],
            "district": s.get("district"), "employees_total": s.get("employees_total"),
            "sources": sorted({r["code"] for r in recs.get(s["id"], [])}),
        }

    out = []
    for r in rows:
        q = r["qualified"]
        out.append(
            {
                "bucket": r["bucket"], "kind": q.kind, "qualifier": q.qualifier, "base": q.base,
                "loader_rule_knows": extension_base_name(r["supplier"]["company_name"]) is not None,
                "profile": slim(r["supplier"]),
                "main": [
                    {**slim(p["main"]), "verdict": p["evidence"].verdict, "strong": p["evidence"].strong,
                     "supporting": p["evidence"].supporting, "against": p["evidence"].against,
                     "notes": p["evidence"].notes}
                    for p in r["pairs"]
                ],
                "siblings": [slim(x) for x in r["siblings"]],
                "unpublished_same_base": [x["slug"] for x in r["unpublished_same_base"]],
                "action": r["action"],
                "plan": r["plan"],
            }
        )
    return out


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", default="ops/plans/premises-siblings-report.md", help="report markdown path")
    parser.add_argument("--json", type=Path, default=None, help="also write every row as JSON here")
    parser.add_argument("--sql", type=Path, default=None, help="also write the attach step as a dry-run DO block")
    args = parser.parse_args()
    logging.getLogger("httpx").setLevel(logging.WARNING)

    try:
        from ops.repair_bgmea_conflations import Rest  # GET-only use: all_rows

        rest = Rest()
        suppliers = load_suppliers(rest)
        data = build(suppliers)
        involved = {r["supplier"]["id"] for r in data["rows"]}
        for r in data["rows"]:
            involved.update(m["id"] for m in r["mothers"])
            involved.update(m["id"] for m in r["siblings"])
        recs = load_records(rest, sorted(involved))
    except Exception as exc:  # noqa: BLE001
        print(f"ERROR: could not read production: {exc}", file=sys.stderr)
        return 2

    rows = finish(data, recs)
    generated = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    text = render(rows, data, recs, generated)
    Path(args.out).write_text(text + "\n", encoding="utf-8")
    if args.json:
        args.json.write_text(json.dumps(to_json(rows, recs), indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    if args.sql:
        args.sql.write_text(attach_sql(rows), encoding="utf-8")
    print("plan: " + ", ".join(f"{k}={v}" for k, v in sorted(Counter(r["plan"] for r in rows).items())))
    counts = Counter(r["bucket"] for r in rows)
    print(f"published {data['published']}; qualified {len(rows)}; " + ", ".join(f"{b}={counts[b]}" for b in ("a", "b1", "b2", "c", "d")))
    print(f"report: {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
