"""Find supplier rows that are one company filed twice, and sort them: certain, or a person decides.

WHY THIS EXISTS
---------------
Founder, 13 Oct 2026: audit the whole supplier table for duplicates; merge
the certain ones, and put the doubtful ones on a page he can tick through.

Earlier passes each looked through one keyhole: `audit_cross_register_coverage`
(same recomputed slug, or a shared register entry) and
`report_premises_siblings` (a name ending in "Shed" or "Unit-2"). This one
compares every row with every other row on every signal the table holds:

  name      a "core" key (plurals, Co./Company, Pvt./Private, spacing
            folded) and a fuzzy score on it
  entry     one register entry held by two rows
  cross-ref a BGMEA entry naming the EPB number another row holds
  contact   a phone, a mailbox, a mailbox domain or a website in common
  place     one house-and-road, the same locality words, map pins

WHAT COUNTS AS CERTAIN
----------------------
A pair is merged without asking only when ALL of these hold:

  1. The names are one company name: the core keys are equal; or the rows
     hold the same entry of a membership register and the names are a typo
     apart; or exactly one long word differs by a letter or two.
  2. Something that belongs to one company ties them: a phone, a mailbox, a
     website, a house-and-road, a register entry, the EPB number. Locality
     words or a parent group count only when no third row has a similar name.
  3. Nothing speaks against it: no membership register lists them as two
     entries, the districts agree (or the addresses do), no person ruled
     them two companies, neither is a building of another row, neither is
     claimed, and they are not a factory beside a real buying house.
  4. No other row with the same name conflicts with either of them.

Sister concerns share phones and buildings, so contact never makes a pair
certain without the name; a similar name never does without contact.
Numbers and domains that sit on many rows (an agent, an ISP, a trade body)
are not evidence and are dropped first.

Everything else that still looks like one company is ASK: it goes to the
founder's page with the evidence and a suggested answer. Two rows with
different entries in the safety register are two buildings: the suggestion
there is to link (`facility_of`), never to merge.

READ-ONLY. No `--apply`; GET requests only. The merge itself is
`ops/merge_duplicate_suppliers.py --pair`, or its SQL twin
(`ops/plans/duplicate-suppliers-merge.sql`) where the database port is closed.

USAGE
-----
    python ops/report_duplicate_suppliers.py --json ops/plans/duplicate-suppliers.json \
        --html ops/plans/duplicate-suppliers-review.html
    python ops/report_duplicate_suppliers.py --cache DIR   # reuse a pull (suppliers.json, ...)

Exit codes: 0 report produced, 2 could not run.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

from rapidfuzz import fuzz, process
from rapidfuzz.distance import Levenshtein

from etl.core.normalize import normalize_company_name
from ops.report_group_of_companies import phone_numbers, premises_key
from ops.report_premises_siblings import _GENERIC_MAIL, _entry_refs, _site_host, classify, evidence

# Registers where two entries mean two members (or, for RSC, two buildings).
# A certificate register (OEKO-TEX, GOTS, WRAP) issues several certificates
# to one company, so two entries there say nothing.
_ASSOCIATE = "BGMEA (associate)"
_ONE_ENTRY_EACH = ("BGMEA", _ASSOCIATE, "BKMEA", "BGAPMEA", "BTMA", "EPB", "RSC", "BEPZA")

# Words that do not tell two companies apart. "bd"/"bangladesh" are kept (as
# one word): "X Ltd" and "X (BD) Ltd" can be a foreign parent and its local arm.
_CORE_DROP = frozenset({"the", "ms", "messrs", "co", "company", "pvt", "private", "ltd", "limited", "plc", "and"})
_CORE_ALIAS = {"bangladesh": "bd", "garment": "garments", "centre": "center", "intl": "international"}

FUZZY_FLOOR = 88  # core-name score that makes a pair worth a look on the name alone
FUZZY_WITH_CONTACT = 72  # ... when a phone, mailbox, website or address also matches
# A phone on more rows than this is an agent's or a trade body's; a mailbox
# domain or website on more rows is an ISP's or a portal's. Not evidence.
CROWD_PHONE, CROWD_DOMAIN, CROWD_HOST = 6, 15, 8

# Evidence that belongs to one company (grade A), as `evidence()` words it.
_OWN = ("both hold", "same BGMEA number", "same BKMEA number", "same EPB number", "same RJSC number",
        "shared phone", "same mailbox", "same website", "same house and road", "map pins", "names the EPB number")


def core_tokens(name: str) -> list[str]:
    out = []
    for tok in normalize_company_name(re.sub(r"\bint'?l\b\.?", "international", name or "", flags=re.I)).split():
        if tok in _CORE_DROP:
            continue
        if len(tok) > 4 and tok.endswith("ies"):
            tok = tok[:-3] + "y"
        elif out and len(tok) > 4 and tok.endswith("s") and not tok.endswith("ss"):
            # Never the first word: "Cosmo" and "Cosmos", "Sister" and "Sisters" are two companies.
            tok = tok[:-1]
        out.append(_CORE_ALIAS.get(tok, tok))
    return out


def entry_key(code: str, ref: str | None, fields: dict) -> str:
    """The register's own number for an entry, so one entry scraped two ways is one entry.

    BKMEA is filed twice per member, under the membership number ("866") and
    under the detail page's id ("859:detail"): two number spaces, so "859" the
    member and "859:detail" the page are different companies. The membership
    number, which both scrapes carry, is the entry. OEKO-TEX refs end in the
    standard ("oeko-tex-4412:100", ":step"); the customer number is the entry.
    """
    ref = ref or ""
    if code == "BKMEA":
        m = re.match(r"\s*(\d+)", str(fields.get("bkmea_membership_no") or ""))
        return m.group(1) if m else f"page-{ref}"
    if code == "OEKO_TEX":
        return ref.split(":", 1)[0]
    return ref


def _field_values(records: list[dict], want: tuple[str, ...], skip: tuple[str, ...] = ()) -> list[str]:
    out = []
    for rec in records:
        for key, value in rec["fields"].items():
            if isinstance(value, str) and any(w in key for w in want) and not any(s in key for s in skip):
                out.append(value)
    return out


def _digits(values: set[str]) -> set[str]:
    return {d for d in (re.sub(r"\D", "", v).lstrip("0") for v in values) if d}


class Profile:
    """One supplier row with everything its register entries add to it."""

    def __init__(self, sup: dict, records: list[dict]) -> None:
        self.s = sup
        self.id = sup["id"]
        self.records = records
        self.tokens = core_tokens(sup["company_name"] or "")
        self.core = "".join(self.tokens)
        self.core_spaced = " ".join(self.tokens)
        # What `evidence()` reads: each entry under its register's own number.
        # BGMEA keeps two registers with their own numbers (general manufacturers,
        # associate buying houses); a company can sit in both, so they are two codes here.
        for r in records:
            if r["code"] == "BGMEA" and r["fields"].get("bgmea_member_type") == "associate_buying_house":
                r["code"] = _ASSOCIATE
        self.evidence_records = [
            {"code": r["code"], "source_ref": entry_key(r["code"], r["source_ref"], r["fields"]),
             "fields": {k: v for k, v in r["fields"].items() if "address" in k}}
            for r in records
        ]
        self.refs = _entry_refs(self.evidence_records)
        self.codes = sorted(self.refs)
        # A real buying house holds the associate entry and no factory's register.
        # `entity_type` alone is not that: the loader's default for any BGMEA
        # row is "buying_house", so 500-odd general manufacturers carry it.
        self.buying_house = _ASSOCIATE in self.refs and not ({"BGMEA", "RSC", "BKMEA", "BTMA", "BGAPMEA"} & set(self.refs))
        self.phones = set(phone_numbers(", ".join(sup.get("phones") or [])))
        for v in _field_values(records, ("phone", "tel", "mobile")):
            self.phones |= phone_numbers(v)
        mails = " ".join([sup.get("email_primary") or "", *_field_values(records, ("email",))]).lower()
        self.mailboxes = set(re.findall(r"[\w.+-]+@[\w.-]+\.\w+", mails))
        self.domains = {m.split("@", 1)[1] for m in self.mailboxes} - _GENERIC_MAIL
        hosts = {_site_host(sup)} | {_site_host({"website": v}) for v in _field_values(records, ("website",))}
        self.hosts = {h for h in hosts if h and "." in h}
        addresses = [sup.get("address_raw") or "", *_field_values(records, ("address",), ("mailing",))]
        self.premises = {k for k in map(premises_key, addresses) if k}
        # EPB numbers this row holds itself, and the ones its BGMEA entry names.
        self.epb_own = _digits({str(r["fields"].get("epb_reg_no")) for r in records if r["code"] == "EPB"})
        self.epb_named = _digits({str(r["fields"].get("epb_reg_no")) for r in records if r["code"].startswith("BGMEA")})
        self.for_evidence: dict = {}

    def drop_crowded(self, phones: set[str], domains: set[str], hosts: set[str]) -> None:
        """Keep only contact details that could belong to one company."""
        self.phones = {n for n in self.phones if n[-8:] not in phones}
        self.domains -= domains
        self.hosts -= hosts
        own_site = self.s.get("website") if _site_host(self.s) in self.hosts else None
        # The row as `evidence()` reads it, with the entries' contact details folded in.
        self.for_evidence = dict(
            self.s, phones=sorted(self.phones), website=own_site or next(iter(sorted(self.hosts)), None),
            email_primary=" ".join(sorted(m for m in self.mailboxes if m.split("@", 1)[1] in self.domains)),
        )

    @property
    def tier13(self) -> int:
        return len({r["code"].split(" ")[0] for r in self.records if r["tier"] in ("tier1_gov", "tier2_industry", "tier3_cert")})


# ---------------------------------------------------------------------------
# Candidate pairs
# ---------------------------------------------------------------------------

def _pairs_in_blocks(blocks: dict[Any, list[str]], cap: int = 40) -> set[tuple[str, str]]:
    out = set()
    for ids in blocks.values():
        ids = sorted(set(ids))
        if 2 <= len(ids) <= cap:
            out.update((a, b) for i, a in enumerate(ids) for b in ids[i + 1:])
    return out


def find_candidates(profiles: dict[str, Profile]) -> tuple[dict[tuple[str, str], set[str]], dict[str, set[str]]]:
    """Pairs worth judging with why, and each row's near-namesakes (score >= FUZZY_FLOOR)."""
    signals: dict[tuple[str, str], set[str]] = defaultdict(set)
    namesakes: dict[str, set[str]] = defaultdict(set)
    ps = list(profiles.values())

    blocks: dict[str, dict[Any, list[str]]] = defaultdict(lambda: defaultdict(list))
    for p in ps:
        blocks["same name"][p.core].append(p.id)
        for code, refs in p.refs.items():
            for ref in refs:
                blocks["same register entry"][(code, ref)].append(p.id)
        for n in p.phones:
            blocks["phone"][n[-8:]].append(p.id)
        for m in p.mailboxes:
            blocks["mailbox"][m].append(p.id)
        for d in p.domains:
            blocks["mailbox domain"][d].append(p.id)
        for h in p.hosts:
            blocks["website"][h].append(p.id)
        for k in p.premises:
            blocks["house and road"][k].append(p.id)
        for n in p.epb_own:
            blocks["epb"][n].append(p.id)
    blocks["same name"].pop("", None)
    for label in ("same name", "same register entry"):
        for pair in _pairs_in_blocks(blocks[label]):
            signals[pair].add(label)

    for p in ps:
        for n in p.epb_named - p.epb_own:
            for other in blocks["epb"].get(n, []):
                if other != p.id:
                    signals[tuple(sorted((p.id, other)))].add("epb cross-reference")  # type: ignore[index]

    # Fuzzy core names, every row against every row, in slabs.
    names = [p.core_spaced for p in ps]
    for scorer in (fuzz.ratio, fuzz.token_sort_ratio):
        for start in range(0, len(ps), 500):
            scores = process.cdist(names[start:start + 500], names, scorer=scorer,
                                   score_cutoff=FUZZY_WITH_CONTACT, workers=-1)
            for i, j in zip(*scores.nonzero()):
                a, b = ps[start + int(i)], ps[int(j)]
                if a.id < b.id and len(a.core) >= 4 and len(b.core) >= 4:
                    if scores[i, j] >= FUZZY_FLOOR:
                        signals[(a.id, b.id)].add("similar name")
                        namesakes[a.id].add(b.id)
                        namesakes[b.id].add(a.id)
                    else:
                        signals[(a.id, b.id)]  # noqa: B018  parked: kept only if contact also matches

    # Contact and place only count beside a name that is at least alike.
    for label in ("phone", "mailbox", "mailbox domain", "website", "house and road"):
        for pair in _pairs_in_blocks(blocks[label]):
            if pair in signals:
                signals[pair].add(f"shared {label}")
    return {pair: s for pair, s in signals.items() if s}, namesakes


# ---------------------------------------------------------------------------
# Judging a pair
# ---------------------------------------------------------------------------

def _one_word_typo(a: list[str], b: list[str]) -> bool:
    """Exactly one word differs, both spellings are long, and they are a letter or two apart."""
    if len(a) != len(b):
        return False
    diff = [(x, y) for x, y in zip(a, b) if x != y]
    return len(diff) == 1 and min(map(len, diff[0])) >= 6 and Levenshtein.distance(*diff[0]) <= 2


def _same_district(a: dict, b: dict) -> bool | None:
    da, db = (a.get("district") or "").strip().lower(), (b.get("district") or "").strip().lower()
    if not da or not db:
        return None
    return fuzz.ratio(da, db) >= 85  # "Narayanganj" / "Narayangonj"


def judge(a: Profile, b: Profile, signals: set[str], different: set[frozenset[str]],
          namesakes: dict[str, set[str]], profiles: dict[str, Profile]) -> dict[str, Any]:
    ev = evidence(a.for_evidence, b.for_evidence, a.evidence_records, b.evidence_records)
    strong = list(ev.strong)
    if a.mailboxes & b.mailboxes:
        strong.append(f"same mailbox ({len(a.mailboxes & b.mailboxes)})")
    if (a.epb_named & b.epb_own) or (b.epb_named & a.epb_own):
        strong.append("one's BGMEA entry names the EPB number the other holds")
    own = [s for s in strong if any(k in s for k in _OWN)]
    place = [s for s in strong if s not in own]
    address_agrees = any(s.startswith(("same house and road", "addresses share")) for s in strong)

    two_entries = [c for c in ev.listed_twice if c in _ONE_ENTRY_EACH]
    same_entry = [c for c in _ONE_ENTRY_EACH if a.refs.get(c, set()) & b.refs.get(c, set())]
    score = int(max(fuzz.ratio(a.core_spaced, b.core_spaced), fuzz.token_sort_ratio(a.core_spaced, b.core_spaced)))
    same_name = a.core == b.core
    typo = not same_name and _one_word_typo(a.tokens, b.tokens)
    one_entry_typo = not same_name and bool(same_entry) and score >= FUZZY_FLOOR
    # Namesakes other than each other and rows of this very name.
    others = {
        i for i in (namesakes[a.id] | namesakes[b.id]) - {a.id, b.id}
        if profiles[i].core not in (a.core, b.core)
    }

    hard: list[str] = []  # the registers or a person say two companies
    soft: list[str] = []  # not enough to be sure
    notes = list(ev.notes)
    if frozenset((a.id, b.id)) in different:
        hard.append("ruled two companies by a person before")
    if two_entries:
        hard.append("listed as two entries in " + ", ".join(two_entries))
    if a.buying_house != b.buying_house:
        hard.append("one is a buying house (BGMEA associate member), the other a factory")
    for line in ev.against:
        if line.startswith("districts differ"):
            if _same_district(a.s, b.s):
                continue
            (notes if address_agrees else soft).append(line)
        else:
            hard.append(line)
    for p in (a, b):
        if p.s.get("facility_of"):
            soft.append(f"{p.s['company_name']} is already linked as a building of another company")
        if p.s.get("claimed_by"):
            soft.append(f"{p.s['company_name']} is claimed by its owner")
    if not (a.s.get("is_published") or b.s.get("is_published")):
        soft.append("neither is published")
    if not (same_name or typo or one_entry_typo):
        soft.append(f"names differ (alike {score}%)")
    if typo and own and all("mailbox domain" in s for s in own):
        soft.append("a spelling apart and tied only by an email domain, which a group shares")
    if not own:
        if not place:
            soft.append("only the name ties them")
        elif others:
            soft.append("same area, but other companies have similar names")

    return {
        "certain": not hard and not soft,
        "score": score, "same_name": same_name, "typo": typo or one_entry_typo,
        "signals": sorted(signals), "own": own, "place": place, "supporting": ev.supporting,
        "hard": hard, "soft": soft, "notes": notes,
        "two_entries": two_entries, "same_entry": same_entry,
    }


def pick_winner(members: list[Profile]) -> Profile:
    """`merge_duplicate_suppliers._pick_winner`, published rows first: most Tier 1-3 registers, most entries, oldest."""
    def rank(p: Profile) -> tuple:
        return (bool(p.s.get("is_published")), not p.s.get("facility_of"), p.tier13, len(p.records))
    return max(sorted(members, key=lambda p: p.s["created_at"], reverse=True), key=rank)


def card(p: Profile) -> dict[str, Any]:
    s = p.s
    rsc = [r["fields"] for r in p.records if r["code"] == "RSC"]
    return {
        "id": s["id"], "slug": s["slug"], "name": s["company_name"],
        "kind": "buying house" if p.buying_house else "factory",
        "published": bool(s["is_published"]), "building_of": s.get("facility_of"),
        "district": s.get("district"), "address": s.get("address_raw"),
        "workers": s.get("employees_total") or next((f.get("rsc_workers_count") for f in rsc), None),
        "group": s.get("parent_group_name") or next((f.get("rsc_parent_group") for f in rsc if f.get("rsc_parent_group")), None),
        "website": s.get("website"), "registers": {c: sorted(p.refs[c]) for c in p.codes},
        "created": (s.get("created_at") or "")[:10],
    }


_UNIT_WORD_RE = re.compile(r"^(?:unit|u|shed|building|bldg|extension|ext|division|div|section|plant|factory|\d+)$")


def section_and_lean(v: dict[str, Any], a: Profile, b: Profile) -> tuple[str, str] | None:
    """Where an uncertain pair goes on the founder's page and what is suggested, or None for noise."""
    hard = " ".join(v["hard"])
    if "ruled two companies" in hard:
        # Shown again only when a register now says otherwise.
        return ("ruled", "merge") if v["same_entry"] and v["score"] >= FUZZY_FLOOR else None
    if v["same_name"]:
        if "buying house" in hard:
            return "buying-house", "separate"
        if "RSC" in v["two_entries"]:
            return "two-buildings", "link"
        if v["two_entries"]:
            return "two-entries", "separate"
        if hard:
            return "same-name-conflict", "separate"
        if any(s.startswith("districts differ") for s in v["soft"]):
            return "same-name-far", "merge" if v["own"] else "separate"
        return "same-name", "merge"
    if a.s.get("facility_of") or b.s.get("facility_of"):
        return None  # a building of another company: sorted already
    short, long_ = sorted((a.tokens, b.tokens), key=len)
    if v["same_entry"]:
        # One membership under two names: a typo or a bracketed note is one member.
        alike = v["score"] >= FUZZY_FLOOR or long_[: len(short)] == short
        return "one-entry", "merge" if alike and not hard else "separate"
    if hard:
        return None  # similar names the registers list separately: sister concerns
    if v["typo"] and (v["own"] or v["place"]):
        return "spelling", "merge"
    if long_[: len(short)] == short and v["own"]:
        extra = long_[len(short):]
        longer = a if a.tokens is long_ else b
        if any(_UNIT_WORD_RE.match(w) for w in extra):
            return "name-inside", "link"
        if classify(longer.s["company_name"] or "") or any("EPB number" in s for s in v["own"]):
            return "name-inside", "merge"  # a brand in brackets, or the register's own cross-reference
        return None  # "X Ltd" and "X Washing Ltd": a sister concern
    if v["score"] >= 93 and v["own"]:
        return "spelling", "merge"
    return None


# ---------------------------------------------------------------------------
# The founder's page
# ---------------------------------------------------------------------------

# In the order he should read them: the likeliest merges first.
_SECTIONS = (
    ("certain", "Certain, not merged yet",
     "These pass every test for a certain duplicate. They wait here only because the last merge ran before them."),
    ("same-name", "Same name, nothing else to go on",
     "The names are the same once Ltd, Co. and plurals are set aside, no register lists them as two members and the "
     "districts do not disagree. Often one side is a safety-register entry, which carries no address."),
    ("spelling", "Names a letter or two apart",
     "The spelling differs slightly and something else matches: a phone, an email domain, a website or the address."),
    ("ruled", "Ruled two companies before",
     "A person ruled these two companies in July. The trade body now shows both under one membership number."),
    ("one-entry", "One membership number on two profiles",
     "The register has one member; the site shows two profiles holding that entry. Close names are one company "
     "written two ways. Where the names differ, one profile may be holding the other's entry."),
    ("name-inside", "One name sits inside the other",
     "The longer name adds a unit, a section, or a brand in brackets."),
    ("same-name-far", "Same name, different districts",
     "A head office and its factory, or two unrelated companies with one name."),
    ("two-buildings", "Same name, two entries in the safety register",
     "The safety register inspects buildings, so these are two buildings of one company."),
    ("buying-house", "A factory and a buying house under one name",
     "One profile is a BGMEA associate member (a buying house), the other a factory. You said buying houses stay."),
    ("two-entries", "Same name, but a register lists two members",
     "The trade body gave them two membership numbers."),
    ("same-name-conflict", "Same name, something speaks against it", "Read the line in red."),
)
_LEAN_WORD = {"merge": "merge", "link": "attach", "separate": "leave"}

# Evidence lines in the founder's words; None drops a line the page already
# says another way. A phone or a mailbox is never spelled out, only that it matched.
_PLAIN: tuple[tuple[str, str | None], ...] = (
    (r"^\d+ shared phone numbers?$", "the same phone number"),
    (r"^same mailbox \(\d+\)$", "the same email address"),
    (r"^same mailbox domain (.+)$", r"the same email domain (\1)"),
    (r"^same website (.+)$", r"the same website (\1)"),
    (r"^same house and road.*$", "the same house and road"),
    (r"^addresses share (.+)$", r"both addresses mention \1"),
    (r"^same (?:BGMEA|BKMEA|EPB|RJSC) number .+$", None),
    (r"^both hold (.+)$", r"both hold \1"),
    (r"^one's BGMEA entry names.*$", "BGMEA's entry for one names the EPB number the other holds"),
    (r"^listed as two entries in (.+)$", r"\1 lists them as two members"),
    (r"^one is a buying house.*$", "one is a buying house, the other a factory"),
    (r"^only the name ties them$", None),
    (r"^names differ.*$", None),
    (r"^ruled two companies by a person before$", "they were ruled two companies before"),
    (r"^same area, but other companies have similar names$", "other companies have similar names"),
)


def _plain(line: str) -> str | None:
    for pattern, said in _PLAIN:
        if re.match(pattern, line):
            return re.sub(pattern, said, line) if said else None
    return line


def _page_profile(c: dict) -> dict:
    meta = [c["district"] or "district not filed", f"{c['workers']:,} workers" if c["workers"] else "workers not filed"]
    if c["group"]:
        meta.append(c["group"])
    if not c["published"]:
        meta.append("not on the site")
    return {
        "name": c["name"], "meta": " · ".join(meta), "address": (c["address"] or "")[:120],
        "src": list(c["registers"]), "url": f"https://sourcebd.net/suppliers/{c['slug']}" if c["published"] else None,
    }


def page_data(asks: list[dict]) -> list[dict]:
    """The ask list as the review page reads it. Numbers each pair (`n`) in place."""
    out, n = [], 0
    for key, title, why in _SECTIONS:
        items = []
        for r in (r for r in asks if r["section"] == key):
            n += 1
            r["n"] = n  # the caller's row when it is an ask; a pending merge is numbered on the page only
            items.append({
                "n": n, "sug": _LEAN_WORD[r["lean"]],
                "keep": _page_profile(r["keep"]), "drop": _page_profile(r["drop"]),
                "ties": [s for s in map(_plain, r["own"] + r["place"] + r["supporting"]) if s],
                "against": [s for s in map(_plain, r["hard"] + r["soft"]) if s],
            })
        if items:
            out.append({"title": title, "why": why, "items": items})
    return out


def write_page(path: Path, page: list[dict]) -> None:
    """Refill the review page. The page is its own template: one `const DATA = ...;` line."""
    data = json.dumps(page, ensure_ascii=False).replace("</", "<\\/")
    lines = path.read_text(encoding="utf-8").split("\n")
    at = next(i for i, line in enumerate(lines) if line.startswith("const DATA = "))
    lines[at] = f"const DATA = {data};"
    path.write_text("\n".join(lines), encoding="utf-8", newline="\n")


# ---------------------------------------------------------------------------
# Loading and building
# ---------------------------------------------------------------------------

_SUPPLIER_COLUMNS = (
    "id,slug,company_name,entity_type,bgmea_reg_numbers,bkmea_reg_number,rjsc_reg_number,epb_erc_number,"
    "email_primary,phones,website,address_raw,city,district,lat,lng,is_published,claimed_by,created_at,"
    "employees_total,parent_group_name,facility_of"
)


def load(cache: Path | None) -> tuple[list[dict], list[dict], list[dict], list[dict]]:
    if cache:
        return tuple(json.loads((cache / f"{n}.json").read_text(encoding="utf-8"))  # type: ignore[return-value]
                     for n in ("suppliers", "sources", "records", "resolution_edges"))
    from ops.repair_bgmea_conflations import Rest  # GET-only use: all_rows

    rest = Rest()
    return (
        rest.all_rows("suppliers", {"select": _SUPPLIER_COLUMNS, "order": "id"}),
        rest.all_rows("sources", {"select": "id,code,tier"}),
        rest.all_rows("source_records", {"select": "supplier_id,source_id,source_ref,status,fields", "order": "id"}),
        rest.all_rows("resolution_edges", {"select": "supplier_a,supplier_b,verdict,superseded_at"}),
    )


def build(suppliers: list[dict], sources: list[dict], records: list[dict], edges: list[dict]) -> dict[str, Any]:
    src = {s["id"]: s for s in sources}
    by_supplier: dict[str, list[dict]] = defaultdict(list)
    for r in records:
        if r["status"] == "active" and r["source_id"] in src:
            by_supplier[r["supplier_id"]].append(
                dict(r, code=src[r["source_id"]]["code"], tier=src[r["source_id"]]["tier"], fields=r["fields"] or {})
            )
    profiles = {s["id"]: Profile(s, by_supplier[s["id"]]) for s in suppliers}

    def crowded(attr: str, limit: int, key=lambda x: x) -> set[str]:
        seen = Counter(key(v) for p in profiles.values() for v in getattr(p, attr))
        return {v for v, n in seen.items() if n > limit}

    crowd = (crowded("phones", CROWD_PHONE, lambda n: n[-8:]), crowded("domains", CROWD_DOMAIN), crowded("hosts", CROWD_HOST))
    for p in profiles.values():
        p.drop_crowded(*crowd)

    different = {
        frozenset((e["supplier_a"], e["supplier_b"]))
        for e in edges if e["verdict"] == "different" and not e["superseded_at"]
    }
    signals, namesakes = find_candidates(profiles)
    verdicts: dict[tuple[str, str], dict[str, Any]] = {}
    for (ia, ib), why in signals.items():
        a, b = profiles[ia], profiles[ib]
        fa, fb = a.s.get("facility_of"), b.s.get("facility_of")
        # A building beside its own company, or two buildings of one company: sorted already.
        if fa == b.id or fb == a.id or (fa and fa == fb):
            continue
        verdicts[(ia, ib)] = judge(a, b, why, different, namesakes, profiles)

    # Rule 4: a certain pair stays certain only if no row of the same name
    # conflicts with either side (three rows, two memberships: which is whose?).
    by_core: dict[str, set[str]] = defaultdict(set)
    by_entry: dict[tuple[str, str], set[str]] = defaultdict(set)
    for p in profiles.values():
        by_core[p.core].add(p.id)
        for c in _ONE_ENTRY_EACH:
            for ref in p.refs.get(c, ()):
                by_entry[(c, ref)].add(p.id)
    entry_mates: dict[str, set[str]] = defaultdict(set)
    for ids in by_entry.values():
        for i in ids:
            entry_mates[i] |= ids - {i}
    parent: dict[str, str] = {}

    def find(x: str) -> str:
        while parent.setdefault(x, x) != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    for (ia, ib), v in verdicts.items():
        if v["certain"]:
            parent[find(ia)] = find(ib)
    clusters: dict[str, set[str]] = defaultdict(set)
    for x in list(parent):
        clusters[find(x)].add(x)
    merges: list[dict] = []
    for members in clusters.values():
        reach = set().union(*(by_core[profiles[i].core] for i in members)) | members
        conflict = sorted(
            f"{profiles[x].s['company_name']} / {profiles[y].s['company_name']}: {'; '.join(verdicts[(x, y)]['hard'])}"
            for x in reach for y in reach if x < y and (x, y) in verdicts and verdicts[(x, y)]["hard"]
        )
        tangled = sorted(
            f"{profiles[x].s['company_name']} shares {c} entry {', '.join(sorted(profiles[x].refs[c] & profiles[y].refs[c]))} with {profiles[y].s['company_name']}"
            for x in members for y in entry_mates[x] - members
            for c in _ONE_ENTRY_EACH if profiles[x].refs.get(c, set()) & profiles[y].refs.get(c, set())
        )
        conflict = conflict or tangled
        if conflict:
            for (x, y), v in verdicts.items():
                if v["certain"] and x in members and y in members:
                    v["certain"] = False
                    v["soft"].append("tangled with a third profile: " + conflict[0])
            continue
        keep = pick_winner([profiles[i] for i in members])
        for i in sorted(members - {keep.id}):
            pair = tuple(sorted((keep.id, i)))
            v = verdicts.get(pair)
            if not v or not v["certain"]:  # linked through a third row: that link's evidence
                v = next(verdicts[q] for q in verdicts if i in q and verdicts[q]["certain"] and set(q) <= members)
            merges.append({"keep": card(keep), "drop": card(profiles[i]), **v})

    asks: list[dict] = []
    for (ia, ib), v in verdicts.items():
        if v["certain"]:
            continue
        a, b = profiles[ia], profiles[ib]
        placed = section_and_lean(v, a, b)
        if placed:
            keep = pick_winner([a, b])
            drop = b if keep is a else a
            asks.append({"section": placed[0], "lean": placed[1], "keep": card(keep), "drop": card(drop), **v})
    merges.sort(key=lambda r: r["keep"]["name"].lower())
    asks.sort(key=lambda r: (r["section"], r["keep"]["name"].lower()))
    return {
        "suppliers": len(suppliers), "published": sum(1 for s in suppliers if s["is_published"]),
        "pairs_judged": len(verdicts), "merge": merges, "ask": asks,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--json", type=Path, default=Path("ops/plans/duplicate-suppliers.json"))
    parser.add_argument("--cache", type=Path, default=None, help="directory holding an earlier pull")
    parser.add_argument("--html", type=Path, default=None, help="the review page to refill with the ask list")
    args = parser.parse_args()
    try:
        data = load(args.cache)
    except Exception as exc:  # noqa: BLE001
        print(f"ERROR: could not read production: {exc}", file=sys.stderr)
        return 2
    out = build(*data)
    # A certain pair nobody has merged yet is on the page too, first; numbering happens here,
    # so before the JSON is written.
    page = page_data([dict(r, section="certain", lean="merge") for r in out["merge"]] + out["ask"])
    if args.html:
        write_page(args.html, page)
    args.json.write_text(json.dumps(out, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    sections = Counter(f"{r['section']}:{r['lean']}" for r in out["ask"])
    print(f"suppliers {out['suppliers']}; pairs judged {out['pairs_judged']}; certain {len(out['merge'])}; ask {len(out['ask'])}")
    print("ask: " + ", ".join(f"{k}={v}" for k, v in sorted(sections.items())))
    print(f"json: {args.json}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
