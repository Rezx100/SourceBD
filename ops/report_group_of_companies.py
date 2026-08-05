"""Relate the nine no-host-match BGMEA hosts, and size the backed-only identity gap (REZ-102).

WHY THIS EXISTS
---------------
REZ-90's keeper rule found nine suppliers where **no** BGMEA member ref on the
row bears the row's own ``company_name``. Its founder-approved gate forces all
13 of their excess refs to ``review``, so nothing can split on an identity the
row cannot support. This script answers the two questions that gate defers.

**Question 1 — what is the real relationship?** REZ-88/90 could only compare
names, and names are what produced the "group of companies" reading: a family
sharing the host's stem (``DK Design`` / ``DK Collection`` / ``DK Textile``)
looks like a garment group whose arms each hold a BGMEA membership. This
script tests that reading against evidence names cannot carry — the premises
and the switchboard on each BGMEA member record.

The test only means something if the evidence is independent of the fault. It
is not enough to notice that the host and a BGMEA record share a phone number:
``suppliers.phones``, ``address_raw`` and ``email_primary`` are **unions
written by the very attach under test**, so they agree with the foreign record
by construction. This script therefore splits host-side evidence in two:

  * ANCHOR — fields carried on the host's own non-BGMEA source records
    (BKMEA, RSC, BGAPMEA, OEKO-TEX, GOTS…). These were written by a different
    register and are admissible.
  * CONTAMINATED — the denormalised ``suppliers`` columns. Reported, never
    used to corroborate. Where these disagree with the anchor, the row is
    already publishing the intruder's address or mailbox, which is a second
    harm beyond the registration numbers and is counted separately.

**Question 2 — how big is the backed-only identity gap?** REZ-98's
backed-only view tests provenance: does a live record on this row vouch for
this number? It does not test identity: whether that record names this
company. Sizing "published suppliers holding a BGMEA record whose name
disagrees with the row" needs a name for each record, and the honest finding
is that production stores none — see below.

THE DENOMINATOR PROBLEM (read before quoting any number from part 2)
--------------------------------------------------------------------
``bgmea_web`` began storing ``scraped_company_name`` at REZ-56, but no run has
persisted one: **0 of 20,224 source records carry the field, BGMEA's 5,970
included**. A measurement predicated on it has an empty denominator and would
report a reassuring zero that means "not measured", not "no disagreement".

So names come from the two offline oracles instead, and they cover different
and unequal slices of the population:

  * ``ops/plans/rez-90-ref-names.json`` — 426 refs recovered by the REZ-88
    fetch. **Selected**: these are exactly the refs sitting on the 199
    multi-ref hosts, a population chosen for holding more than one
    registration. A disagreement rate measured here cannot be generalised.
  * ``etl/raw/BGMEA_Associate_Members.pdf`` — the associate register itself,
    keyed by registration number. **Unselected**: it covers every associate
    member whether or not the supplier holding it trips any detector, so it
    is the one oracle a population-level rate can be quoted from.

Neither covers general members outside the 426. Part 2 therefore reports a
covered denominator and an explicitly uncovered remainder rather than one
number, and the display-rule options are costed under both a fail-open and a
fail-closed reading of the uncovered remainder, because that choice moves the
answer by more than the measurement does.

READ-ONLY. There is no ``--apply``; this module issues no INSERT, UPDATE,
DELETE or PATCH on any path, and no HTTP to bgmea.com.bd.

USAGE
-----
    python ops/report_group_of_companies.py
    python ops/report_group_of_companies.py --out ops/plans/rez-102-report.md
    python ops/report_group_of_companies.py --json ops/plans/rez-102-counts.json

Exit codes: 0 report produced, 2 could not run.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections import defaultdict
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

from etl.core.normalize import normalize_company_name  # noqa: E402
from etl.lib.bd_place_lexicon import apply_place_lexicon  # noqa: E402
from etl.scrapers.bgmea_buying_house import PDF_PATH  # noqa: E402
from ops.check_supplier_conflations import is_member_ref  # noqa: E402
from ops.plan_multi_member_refs import (  # noqa: E402
    _load_associate_names,
    _same_company,
    root_form,
    root_tokens_loose,
)
from ops.repair_bgmea_conflations import Rest  # noqa: E402

NAME_CACHE_PATH = Path(__file__).resolve().parents[1] / "ops/plans/rez-90-ref-names.json"

# The nine REZ-90 reported. Pinned rather than re-derived so this report cannot
# silently drift onto a different population than the one the gate protects;
# the run re-derives them too and stops if the sets disagree.
EXPECTED_HOSTS = frozenset(
    {
        "ags-apparels",
        "as-knitwear",
        "dk-knitwear",
        "fariha-fashion",
        "global-knitwear",
        "jm-knitwear",
        "next-apparels",
        "pavel-fashion",
        "ra-apparels",
    }
)

# REZ-99 owns these; they carry no record and are out of scope here.
REZ99_STRANDED = {("as-knitwear", "2920"), ("global-knitwear", "1503"), ("jm-knitwear", "3172")}


# ---------------------------------------------------------------------------
# Premises and switchboard signatures
# ---------------------------------------------------------------------------
# Bangladeshi addresses identify a building by a house-and-road pair, and the
# same building is written a dozen ways ("House # 30" / "HOUSE NO-30" /
# "Home # 11/B"). Comparing whole strings finds nothing; comparing the pair
# finds the building. `hosue` and `home` are in the label set because the
# BGMEA register itself contains both spellings.
_PREMISE_RE = re.compile(
    r"\b(?P<label>house|hosue|home|holding|plot|road|rd|block|sector|level|floor|flat|unit|section)"
    r"\s*(?:no|nos|number)?\s*[-:.#]*\s*"
    r"(?P<value>\d+[a-z]?(?:\s*/\s*\d*[a-z]?)?|[a-z]\b)",
    re.IGNORECASE,
)
_LABEL_ALIASES = {"hosue": "house", "home": "house", "holding": "house", "rd": "road"}

# Words that place nothing: dropped before area tokens are compared. `dhaka`
# is here because half the register is in Dhaka, so sharing it means nothing.
_AREA_STOPWORDS = frozenset(
    {
        "house", "hosue", "home", "holding", "plot", "road", "block", "sector",
        "level", "floor", "flat", "unit", "section", "ground", "front", "back",
        "dhaka", "bangladesh", "bldg", "building", "tower", "complex", "centre",
        "center", "market", "lane", "avenue", "street", "opposite", "near",
        "north", "south", "east", "west", "new", "old", "main",
    }
)
_WORD_RE = re.compile(r"[a-z]{4,}")


def premises_key(address: str | None) -> str:
    """The building a Bangladeshi address names, as ``house=30|road=28``.

    Empty when the address gives no house-and-road pair — most trade-body
    records for older members are a locality only, and a locality is not a
    building. Returning "" rather than a partial key keeps the comparison
    from matching two different premises in the same neighbourhood.
    """
    if not address:
        return ""
    found: dict[str, str] = {}
    for m in _PREMISE_RE.finditer(apply_place_lexicon(address.lower())):
        label = m.group("label").lower()
        label = _LABEL_ALIASES.get(label, label)
        value = re.sub(r"\s+", "", m.group("value").lower()).strip("/")
        if value and label not in found:
            found[label] = value
    if "house" in found and "road" in found:
        return f"house={found['house']}|road={found['road']}"
    return ""


def area_tokens(address: str | None) -> frozenset[str]:
    """Locality words in an address, with the ones that place nothing removed."""
    if not address:
        return frozenset()
    lowered = apply_place_lexicon(address.lower())
    return frozenset(w for w in _WORD_RE.findall(lowered) if w not in _AREA_STOPWORDS)


def same_premises(a: str | None, b: str | None) -> tuple[bool, str]:
    """Whether two addresses name one building, and on what basis.

    An area that is stated on both sides must agree. An area stated on only
    one side cannot contradict the other, so the match stands but says so —
    that case is weaker evidence and a reader should see which it is.
    """
    ka, kb = premises_key(a), premises_key(b)
    if not ka or ka != kb:
        return False, ""
    ta, tb = area_tokens(a), area_tokens(b)
    if ta and tb:
        return (True, "premises+area") if ta & tb else (False, "")
    return True, "premises (area unstated on one side)"


# Trade-body contact fields hold several numbers in one string, separated by
# commas or slashes. Splitting on those FIRST and only then discarding
# non-digits is what keeps `0171-595204` one number: the register writes
# mobiles with an internal hyphen, and treating that hyphen as a separator
# silently shortens the number below the length floor and loses the match.
_PHONE_SPLIT_RE = re.compile(r"[,/;|]+")
_MIN_PHONE_DIGITS = 7


def phone_numbers(raw: str | None) -> frozenset[str]:
    """Every phone number in a free-text contact field, as bare digits.

    The country code and leading zeros come off so ``01711548158``,
    ``+8801711548158`` and ``1711548158`` are one number. Anything under seven
    digits is dropped: these fields also carry extension and room numbers, and
    letting a three-digit fragment match would manufacture links.
    """
    out: set[str] = set()
    for part in _PHONE_SPLIT_RE.split(raw or ""):
        digits = re.sub(r"\D", "", part).lstrip("0")
        if digits.startswith("880"):
            digits = digits[3:].lstrip("0")
        if len(digits) >= _MIN_PHONE_DIGITS:
            out.add(digits)
    return frozenset(out)


def shared_phones(a: str | None, b: str | None) -> set[str]:
    """Numbers two contact fields have in common, comparing by suffix.

    One register writes the Dhaka landline as ``8913263`` and another as
    ``02-8913263``; the trunk code is not part of the subscriber's number, so
    equality on the whole string reports no match where there plainly is one.
    A suffix test of at least seven digits handles every trunk-prefix variant
    without needing a table of them.
    """
    found: set[str] = set()
    for left in phone_numbers(a):
        for right in phone_numbers(b):
            if left == right or left.endswith(right) or right.endswith(left):
                found.add(min(left, right, key=len))
    return found


def email_keys(raw: str | None) -> frozenset[str]:
    """Mailboxes and their domains, so a shared domain counts as a group link."""
    out: set[str] = set()
    for token in re.findall(r"[\w.+-]+@[\w.-]+\.\w+", (raw or "").lower()):
        out.add(token)
        out.add(token.split("@", 1)[1])
    return frozenset(out)


# Words every second company in the register uses. A domain matching one of
# these says nothing about which company it belongs to.
_GENERIC_NAME_TOKENS = frozenset(
    {
        "fashion", "fashions", "apparel", "apparels", "garment", "garments",
        "knit", "knits", "knitwear", "textile", "textiles", "sourcing",
        "trading", "trade", "industries", "industry", "group", "wear", "wears",
        "sports", "sweater", "sweaters", "composite", "design", "designs",
        "clothing", "collection", "export", "exports", "style", "styles",
    }
)


def name_in_domain(member_name: str | None, email_field: str | None) -> str | None:
    """The distinctive word a member name shares with a mailbox domain, if any.

    ``Flaxen Fashionwears Limited`` and ``flaxen@flaxengroup.com`` are the same
    house; ``Global Fashion`` and any ``…fashion.com`` are not, which is why
    the industry vocabulary is excluded rather than scored.
    """
    if not member_name or not email_field:
        return None
    domains = {d for d in email_keys(email_field) if "@" not in d}
    for token in root_form(member_name).split():
        if len(token) < 5 or token in _GENERIC_NAME_TOKENS:
            continue
        if any(token in domain.split(".", 1)[0] for domain in domains):
            return token
    return None


# ---------------------------------------------------------------------------
# Evidence gathering
# ---------------------------------------------------------------------------
# Payload keys that carry a premises or a switchboard on a non-BGMEA record.
# Deliberately enumerated: a blanket "any string containing an @" would sweep
# in fields whose provenance has not been checked.
_ANCHOR_ADDRESS_KEYS = (
    "bkmea_factory_address",
    "bkmea_mailing_address",
    "bgapmea_company_address",
    "bgapmea_factory_address",
    "oeko_profile_address",
    "rsc_location",
)
_ANCHOR_PHONE_KEYS = (
    "bkmea_owner_mobile",
    "bkmea_rep_mobile",
    "bgapmea_phone",
    "bgapmea_fax",
    "oeko_profile_phone",
)
_ANCHOR_EMAIL_KEYS = (
    "bkmea_owner_email",
    "bkmea_rep_email",
    "bgapmea_email_raw",
    "oeko_profile_email",
)
_ANCHOR_NAME_KEYS = ("rsc_factory_name", "gots_brand_names")


@dataclass(frozen=True)
class Anchor:
    """What a host's non-BGMEA registers say about it, keyed by source code."""

    names: dict[str, str] = field(default_factory=dict)
    addresses: dict[str, str] = field(default_factory=dict)
    phones: dict[str, str] = field(default_factory=dict)
    emails: dict[str, str] = field(default_factory=dict)
    parent_groups: dict[str, str] = field(default_factory=dict)

    @property
    def phone_set(self) -> frozenset[str]:
        out: set[str] = set()
        for value in self.phones.values():
            out |= phone_numbers(value)
        return frozenset(out)

    @property
    def email_set(self) -> frozenset[str]:
        out: set[str] = set()
        for value in self.emails.values():
            out |= email_keys(value)
        return frozenset(out)


def build_anchor(records: list[dict], source_code: dict[str, str]) -> Anchor:
    """Identity evidence from every non-BGMEA record on one supplier.

    Values are tagged with the register that asserted them so the report can
    show, for each link, which independent source is doing the corroborating.
    """
    names: dict[str, str] = {}
    addresses: dict[str, str] = {}
    phones: dict[str, str] = {}
    emails: dict[str, str] = {}
    groups: dict[str, str] = {}
    for rec in records:
        code = source_code.get(rec.get("source_id") or "", "?")
        if code == "BGMEA" or (rec.get("status") or "") != "active":
            continue
        fields = rec.get("fields") or {}
        raw_kv = fields.get("bkmea_raw_kv") or {}
        factory_name = raw_kv.get("Factory Name")
        if factory_name:
            names[f"{code}:{rec['source_ref']}"] = factory_name
        for key in _ANCHOR_NAME_KEYS:
            if fields.get(key):
                names[f"{code}:{key}"] = str(fields[key])
        for key in _ANCHOR_ADDRESS_KEYS:
            if fields.get(key):
                addresses[f"{code}:{key}:{rec['source_ref']}"] = str(fields[key])
        for key in _ANCHOR_PHONE_KEYS:
            if fields.get(key):
                phones[f"{code}:{key}"] = str(fields[key])
        for key in _ANCHOR_EMAIL_KEYS:
            if fields.get(key):
                emails[f"{code}:{key}"] = str(fields[key])
        if fields.get("rsc_parent_group"):
            groups[code] = str(fields["rsc_parent_group"])
    return Anchor(names, addresses, phones, emails, groups)


@dataclass
class Ref:
    """One BGMEA member record on a host, with its recovered name and contacts."""

    source_ref: str
    reg: str
    name: str | None
    name_source: str
    member_type: str
    address: str
    tel: str
    linked_to_anchor: list[str] = field(default_factory=list)
    linked_to_siblings: dict[str, list[str]] = field(default_factory=dict)

    @property
    def label(self) -> str:
        return self.name or f"(name not recovered: {self.source_ref})"

    @property
    def has_link(self) -> bool:
        return bool(self.linked_to_anchor or self.linked_to_siblings)


def link_reasons(addr_a: str, tel_a: str, addr_b: str, tel_b: str) -> list[str]:
    """Every independent way two parties evidence the same premises or office."""
    reasons: list[str] = []
    ok, basis = same_premises(addr_a, addr_b)
    if ok:
        reasons.append(f"same premises ({basis})")
    shared = shared_phones(tel_a, tel_b)
    if shared:
        reasons.append(f"shared phone {sorted(shared)[0]}")
    return reasons


def relate_host(refs: list[Ref], anchor: Anchor) -> str:
    """The relationship the evidence supports for one host.

    Three outcomes, and the difference between the last two is the whole
    point of the exercise:

    * ``group-corroborated`` — at least one BGMEA record shares a premises or
      a switchboard with the host's OWN register entry. A second, independent
      source agrees these are one operation, so "group parent with children"
      is evidenced rather than inferred from a shared word.
    * ``refs-cohere-only`` — the BGMEA records evidence each other but nothing
      ties any of them to the host. The registrations are one group; the host
      is not shown to be in it. A split moves a coherent block off the row.
    * ``no-link`` — no premises or switchboard is shared by anything. Whatever
      joined these records to this row left no trace in the register.
    """
    if any(r.linked_to_anchor for r in refs):
        return "group-corroborated"
    if any(r.linked_to_siblings for r in refs):
        return "refs-cohere-only"
    return "no-link"


def name_agrees(host_name: str, member_name: str | None) -> bool:
    """Whether a recovered member name is the host's own company.

    The same ladder REZ-90's keeper rule uses (normalised equality, root form,
    loose root tokens, then `_names_compatible`), so this report and the gate
    cannot disagree about which rows match none of their refs.
    """
    if not member_name or not host_name:
        return False
    if normalize_company_name(host_name) == normalize_company_name(member_name):
        return True
    if root_form(host_name) and root_form(host_name) == root_form(member_name):
        return True
    loose = root_tokens_loose(host_name)
    if loose and loose == root_tokens_loose(member_name):
        return True
    return _same_company(host_name, member_name)


# ---------------------------------------------------------------------------
# Part 2 — the backed-only identity gap
# ---------------------------------------------------------------------------
UNCOVERED = "no-name-oracle"
AGREES = "agrees"
DISAGREES = "disagrees"


@dataclass(frozen=True)
class GapRow:
    """One published supplier's BGMEA records, judged on identity not provenance."""

    slug: str
    company_name: str
    verdicts: tuple[tuple[str, str, str | None], ...]  # (ref, verdict, recovered name)

    @property
    def covered(self) -> tuple[tuple[str, str, str | None], ...]:
        return tuple(v for v in self.verdicts if v[1] != UNCOVERED)

    @property
    def any_covered(self) -> bool:
        return bool(self.covered)

    @property
    def all_disagree(self) -> bool:
        return bool(self.covered) and all(v[1] == DISAGREES for v in self.covered)

    @property
    def some_disagree(self) -> bool:
        return any(v[1] == DISAGREES for v in self.covered)


def measure_identity_gap(
    suppliers: dict[str, dict],
    bgmea_by_supplier: dict[str, list[dict]],
    names_by_ref: dict[str, str],
) -> list[GapRow]:
    """Identity verdict per BGMEA record for every published supplier holding one.

    A record is ``UNCOVERED`` when no oracle knows the registered name. That is
    not "agrees" — the whole denominator problem is that treating it as
    agreement is what makes the gap look small.
    """
    rows: list[GapRow] = []
    for sid, recs in bgmea_by_supplier.items():
        sup = suppliers.get(sid)
        if not sup or not sup.get("is_published"):
            continue
        verdicts: list[tuple[str, str, str | None]] = []
        for rec in recs:
            member_name = names_by_ref.get(str(rec["source_ref"]))
            if not member_name:
                verdicts.append((rec["source_ref"], UNCOVERED, None))
                continue
            verdict = AGREES if name_agrees(sup.get("company_name") or "", member_name) else DISAGREES
            verdicts.append((rec["source_ref"], verdict, member_name))
        if verdicts:
            rows.append(
                GapRow(
                    slug=sup.get("slug") or "",
                    company_name=sup.get("company_name") or "",
                    verdicts=tuple(verdicts),
                )
            )
    return rows


def _reg_of_ref(record: dict) -> str | None:
    """The registration number a BGMEA member record stands behind."""
    ref = str(record.get("source_ref") or "")
    if ref.startswith("general:"):
        return ref.split(":", 1)[1]
    if ref.isdigit():
        return ref
    value = (record.get("fields") or {}).get("bgmea_reg_number")
    return str(value) if value else None


def summarise_gap(rows: list[GapRow], name_source_by_ref: dict[str, str]) -> dict[str, int]:
    """Counts for question 2, with the covered and uncovered slices kept apart."""
    covered_rows = [r for r in rows if r.any_covered]
    all_verdicts = [v for r in rows for v in r.verdicts]
    covered_verdicts = [v for v in all_verdicts if v[1] != UNCOVERED]
    pdf_refs = {ref for ref, src in name_source_by_ref.items() if src == "associate-pdf"}
    unbiased = [
        r for r in rows if any(v[1] != UNCOVERED and v[0] in pdf_refs for v in r.verdicts)
    ]
    return {
        "published_holding_bgmea_record": len(rows),
        "bgmea_records_on_them": len(all_verdicts),
        "records_with_a_recoverable_name": len(covered_verdicts),
        "records_without_a_name_oracle": len(all_verdicts) - len(covered_verdicts),
        "suppliers_measurable": len(covered_rows),
        "suppliers_not_measurable": len(rows) - len(covered_rows),
        "measurable_all_records_disagree": sum(1 for r in covered_rows if r.all_disagree),
        "measurable_some_record_disagrees": sum(1 for r in covered_rows if r.some_disagree),
        "measurable_every_record_agrees": sum(
            1 for r in covered_rows if not r.some_disagree
        ),
        "records_disagreeing": sum(1 for v in covered_verdicts if v[1] == DISAGREES),
        "records_agreeing": sum(1 for v in covered_verdicts if v[1] == AGREES),
        "unbiased_slice_suppliers": len(unbiased),
        "unbiased_slice_some_disagree": sum(1 for r in unbiased if r.some_disagree),
    }


def display_rule_options(rows: list[GapRow], counts: dict[str, int]) -> dict[str, int]:
    """Cost of each display rule, fail-open and fail-closed on unmeasurable records.

    A rule that additionally requires the backing record to NAME the supplier
    has to decide what to do with a record whose registered name nobody knows.
    Today that is most of them, so the choice dominates the measurement: fail
    closed and the BGMEA pill largely disappears; fail open and the rule
    changes almost nothing until a `bgmea_web` run lands.
    """
    fail_open_numbers = counts["records_disagreeing"]
    fail_closed_numbers = counts["records_disagreeing"] + counts["records_without_a_name_oracle"]
    return {
        "i_status_quo_numbers_removed": 0,
        "i_status_quo_suppliers_affected": 0,
        # Fail open: an unknown name is treated as agreement, so only a record
        # positively shown to name someone else is withheld.
        "ii_open_numbers_removed": fail_open_numbers,
        "ii_open_suppliers_losing_a_number": sum(1 for r in rows if r.some_disagree),
        "ii_open_suppliers_losing_pill": sum(
            1 for r in rows if r.some_disagree and not any(v[1] == AGREES for v in r.verdicts)
        ),
        # Fail closed: a record must be shown to name the supplier. With no
        # `scraped_company_name` in production this withholds most of the
        # register, which is the point of costing both readings.
        "ii_closed_numbers_removed": fail_closed_numbers,
        "ii_closed_suppliers_losing_a_number": sum(
            1 for r in rows if any(v[1] != AGREES for v in r.verdicts)
        ),
        "ii_closed_suppliers_losing_pill": sum(
            1 for r in rows if all(v[1] != AGREES for v in r.verdicts)
        ),
        "iii_label_numbers_removed": 0,
        "iii_label_numbers_relabelled": fail_closed_numbers,
        "iv_measure_first_numbers_removed": 0,
        "iv_measure_first_records_needing_a_name": counts["records_without_a_name_oracle"],
    }


# ---------------------------------------------------------------------------
# Load
# ---------------------------------------------------------------------------
def load(rest: Rest) -> dict[str, Any]:
    """Everything both questions need, in four production reads."""
    source_code = {s["id"]: s["code"] for s in rest.all_rows("sources", {"select": "id,code"})}
    bgmea_id = next(sid for sid, code in source_code.items() if code == "BGMEA")
    suppliers = {
        r["id"]: r
        for r in rest.all_rows(
            "suppliers",
            {
                "select": "id,slug,company_name,is_published,entity_type,facility_of,"
                "bgmea_reg_numbers,bkmea_reg_number,address_raw,phones,email_primary,"
                "contact_name,website,parent_group_name,source_tags"
            },
        )
    }
    bgmea_records = [
        r
        for r in rest.all_rows(
            "source_records",
            {
                "select": "supplier_id,source_id,source_ref,status,fields",
                "source_id": f"eq.{bgmea_id}",
                "status": "eq.active",
            },
        )
        if is_member_ref("BGMEA", r.get("source_ref"))
    ]
    bgmea_by_supplier: dict[str, list[dict]] = defaultdict(list)
    seen: set[tuple[str, str]] = set()
    for r in bgmea_records:
        key = (r["supplier_id"], r["source_ref"])
        if key in seen:
            continue
        seen.add(key)
        bgmea_by_supplier[r["supplier_id"]].append(r)

    host_ids = [
        sid
        for sid, sup in suppliers.items()
        if sup.get("slug") in EXPECTED_HOSTS
    ]
    host_records = rest.all_rows(
        "source_records",
        {
            "select": "supplier_id,source_id,source_ref,status,fields",
            "supplier_id": f"in.({','.join(host_ids)})",
        },
    )
    return {
        "source_code": source_code,
        "suppliers": suppliers,
        "bgmea_by_supplier": dict(bgmea_by_supplier),
        "host_records": host_records,
    }


def load_name_oracles() -> tuple[dict[str, str], dict[str, str]]:
    """source_ref → name, and source_ref → which oracle knew it.

    Keyed by the WHOLE ``source_ref``, never by the bare number. BGMEA runs two
    registers — general members and associate buying houses — and they number
    independently, so associate 35 is DK Textile Ltd. while ``general:35`` is a
    different company entirely. Stripping the prefix to look a number up in the
    associate PDF silently answers a question about one register with the other
    register's answer. `ops/plans/rez-90-ref-names.json` keeps them apart by
    storing general members under their prefixed ref, and this follows it.

    The consequence is that the PDF can only name associate refs. General
    members are nameable only from the 138 the REZ-88 fetch recovered, which
    is why part 2's measurable population is mostly the associate register.
    """
    names: dict[str, str] = {}
    source: dict[str, str] = {}
    if PDF_PATH.exists():
        for reg, name in _load_associate_names(PDF_PATH).items():
            names[str(reg)] = name
            source[str(reg)] = "associate-pdf"
    if NAME_CACHE_PATH.exists():
        cached = json.loads(NAME_CACHE_PATH.read_text(encoding="utf-8"))
        for ref, name in cached.items():
            if name and str(ref) not in names:
                names[str(ref)] = name
                source[str(ref)] = "rez-88-cache"
    return names, source


# ---------------------------------------------------------------------------
# Report
# ---------------------------------------------------------------------------
def build_hosts(
    data: dict[str, Any], names_by_ref: dict[str, str], name_source_by_ref: dict[str, str]
) -> list[dict[str, Any]]:
    """Per-host evidence: anchor, refs, links between them, and contamination."""
    suppliers = data["suppliers"]
    source_code = data["source_code"]
    records_by_supplier: dict[str, list[dict]] = defaultdict(list)
    for rec in data["host_records"]:
        records_by_supplier[rec["supplier_id"]].append(rec)

    out: list[dict[str, Any]] = []
    for sid, sup in suppliers.items():
        if sup.get("slug") not in EXPECTED_HOSTS:
            continue
        anchor = build_anchor(records_by_supplier[sid], source_code)
        refs: list[Ref] = []
        for rec in sorted(
            data["bgmea_by_supplier"].get(sid, []), key=lambda r: str(r["source_ref"])
        ):
            fields = rec.get("fields") or {}
            ref_key = str(rec["source_ref"])
            refs.append(
                Ref(
                    source_ref=ref_key,
                    reg=_reg_of_ref(rec) or "",
                    name=names_by_ref.get(ref_key),
                    name_source=name_source_by_ref.get(ref_key, "—"),
                    member_type=str(fields.get("bgmea_member_type") or "—"),
                    address=str(fields.get("raw_address") or ""),
                    tel=str(fields.get("raw_tel") or ""),
                )
            )

        for ref in refs:
            for key, value in anchor.addresses.items():
                ok, basis = same_premises(ref.address, value)
                if ok:
                    ref.linked_to_anchor.append(f"{key}: same premises ({basis})")
            for key, value in anchor.phones.items():
                shared = shared_phones(ref.tel, value)
                if shared:
                    ref.linked_to_anchor.append(f"{key}: shared phone {sorted(shared)[0]}")
            for key, value in anchor.emails.items():
                token = name_in_domain(ref.name, value)
                if token:
                    ref.linked_to_anchor.append(f"{key}: name matches mailbox domain (`{token}`)")
            for other in refs:
                if other is ref:
                    continue
                reasons = link_reasons(ref.address, ref.tel, other.address, other.tel)
                if reasons:
                    ref.linked_to_siblings[other.label] = reasons

        # Which published columns came from the foreign records rather than the
        # host's own register — the second harm, counted but never used as proof.
        ref_addresses = [r.address for r in refs]
        contamination: list[str] = []
        if sup.get("address_raw") and any(
            same_premises(sup["address_raw"], a)[0] for a in ref_addresses
        ):
            contamination.append("published address_raw is a BGMEA member record's address")
        published: set[str] = set()
        for phone in sup.get("phones") or []:
            published |= phone_numbers(phone)
        ref_phone_set: set[str] = set()
        for ref in refs:
            ref_phone_set |= phone_numbers(ref.tel)
        from_refs_only = (published & ref_phone_set) - anchor.phone_set
        if from_refs_only:
            contamination.append(
                f"{len(from_refs_only)} of {len(published)} published phone numbers come only "
                f"from the foreign BGMEA records"
            )
        if sup.get("email_primary") and not (
            email_keys(sup["email_primary"]) & anchor.email_set
        ):
            contamination.append(
                f"published email {sup['email_primary']} is on no register entry of the host's own"
            )

        out.append(
            {
                "slug": sup.get("slug"),
                "company_name": sup.get("company_name"),
                "anchor": anchor,
                "refs": refs,
                "relation": relate_host(refs, anchor),
                "contamination": contamination,
                "supplier": sup,
            }
        )
    return sorted(out, key=lambda h: h["slug"] or "")


def render(
    hosts: list[dict[str, Any]],
    gap_rows: list[GapRow],
    counts: dict[str, int],
    options: dict[str, int],
    oracle_stats: dict[str, int],
) -> str:
    lines: list[str] = []
    add = lines.append
    add("# REZ-102 — the nine no-host-match hosts, and the backed-only identity gap")
    add("")
    add("Detection and reporting only. **No splits, merges, unpublishing or array edits.**")
    add("REZ-90's `review` gate is untouched and must stay closed on these rows.")
    add("")

    add("## Question 1 — what is the real relationship?")
    add("")
    add("Names alone produced the group-of-companies reading. This tests it against")
    add("the premises and switchboard on each member record, using only host-side")
    add("evidence that a **different** register asserted. The denormalised")
    add("`suppliers` columns are excluded from the test — they are unions written")
    add("by the same attach, so they agree with the intruder by construction.")
    add("")

    by_relation: dict[str, list[str]] = defaultdict(list)
    for host in hosts:
        by_relation[host["relation"]].append(host["slug"])
    add("| relationship | hosts |")
    add("| -- | -- |")
    for relation in ("group-corroborated", "refs-cohere-only", "no-link"):
        slugs = by_relation.get(relation, [])
        add(f"| `{relation}` | {len(slugs)} — {', '.join(f'`{s}`' for s in slugs) or '—'} |")
    add("")

    for host in hosts:
        add(f"### `{host['slug']}` — {host['company_name']}  →  **{host['relation']}**")
        add("")
        anchor: Anchor = host["anchor"]
        if anchor.names:
            add("Own-identity anchor (non-BGMEA registers):")
            for key, value in sorted(anchor.names.items()):
                add(f"- `{key}` → {value}")
        if anchor.parent_groups:
            for code, group in sorted(anchor.parent_groups.items()):
                add(f"- `{code}` parent group → **{group}**")
        add("")
        add("| ref | recovered name | oracle | member type | address | tel |")
        add("| -- | -- | -- | -- | -- | -- |")
        for ref in host["refs"]:
            add(
                f"| `{ref.source_ref}` | {ref.label} | {ref.name_source} | {ref.member_type} "
                f"| {ref.address or '—'} | {ref.tel or '—'} |"
            )
        add("")
        for ref in host["refs"]:
            if ref.linked_to_anchor:
                add(f"- **{ref.label}** ↔ host's own register: " + "; ".join(ref.linked_to_anchor))
            for other, reasons in sorted(ref.linked_to_siblings.items()):
                add(f"- {ref.label} ↔ {other}: " + "; ".join(reasons))
            if not ref.has_link:
                add(f"- {ref.label}: no premises or switchboard shared with anything on this row")
        if host["contamination"]:
            add("")
            add("Already published from the foreign records (not used as evidence above):")
            for item in host["contamination"]:
                add(f"- {item}")
        add("")

    add("## Question 2 — sizing the backed-only identity gap")
    add("")
    add("`v_supplier_registry_ids` asks whether a live record on the row backs the")
    add("number. It does not ask whether that record names this company. Sizing the")
    add("difference needs a registered name per record, and production stores none:")
    add(
        f"**{oracle_stats['records_with_scraped_company_name']} of "
        f"{oracle_stats['total_source_records']}** source records carry"
    )
    add("`scraped_company_name`, BGMEA's included. A measurement built on that field")
    add("has an empty denominator and would report zero disagreement because it")
    add("measured nothing, not because nothing is wrong.")
    add("")
    add("Names therefore come from two offline oracles with very different reach.")
    add("They are keyed by the whole `source_ref`, because BGMEA runs two registers")
    add("that number independently: associate `35` is DK Textile Ltd. while")
    add("`general:35` is another company, so stripping the prefix would answer a")
    add("question about one register with the other register's answer.")
    add("")
    add(
        f"- associate register PDF — {oracle_stats['associate_pdf_names']} names, "
        "**unselected**, but it can only name associate refs"
    )
    add(
        f"- REZ-88 recovered-name cache — {oracle_stats['cache_names']} names, **selected** on "
        "the 199"
    )
    add("  multi-ref hosts, and the only oracle here for general members, so no")
    add("  population rate may be quoted from it")
    add("")
    add("| measure | count |")
    add("| -- | -- |")
    for key in (
        "published_holding_bgmea_record",
        "bgmea_records_on_them",
        "records_with_a_recoverable_name",
        "records_without_a_name_oracle",
        "suppliers_measurable",
        "suppliers_not_measurable",
        "measurable_every_record_agrees",
        "measurable_some_record_disagrees",
        "measurable_all_records_disagree",
        "records_agreeing",
        "records_disagreeing",
        "unbiased_slice_suppliers",
        "unbiased_slice_some_disagree",
    ):
        add(f"| {key.replace('_', ' ')} | **{counts[key]}** |")
    add("")
    add("**What the denominator actually covers.** The measurable population is")
    add(f"{counts['suppliers_measurable']} of {counts['published_holding_bgmea_record']} published")
    add("suppliers holding a BGMEA record — the rest hold only general-member")
    add("registrations, which no oracle here can name. So this measures the")
    add("associate buying-house register almost exclusively, and says nothing about")
    add("the general-member register that makes up the bulk of the population.")
    add("The unbiased sub-population — suppliers with at least one record the")
    add(f"associate register itself names — is {counts['unbiased_slice_suppliers']}, of which")
    add(f"{counts['unbiased_slice_some_disagree']} hold at least one record naming another")
    add("company. That is the only rate quotable here, and it is a rate about")
    add("associate registrations, not about BGMEA records in general.")
    add("")
    add("### Display-rule options (counts only — not chosen here)")
    add("")
    add("A rule that also required the backing record to NAME the supplier must say")
    add("what to do with a record whose registered name nobody knows. That choice")
    add("moves the answer further than the measurement does.")
    add("")
    add("| option | numbers removed | suppliers losing a number | suppliers losing the pill |")
    add("| -- | -- | -- | -- |")
    add(
        f"| (i) status quo — backed-only, as shipped by REZ-98 | "
        f"{options['i_status_quo_numbers_removed']} | "
        f"{options['i_status_quo_suppliers_affected']} | 0 |"
    )
    add(
        f"| (ii-open) require a naming record, unknown names pass | "
        f"{options['ii_open_numbers_removed']} | "
        f"{options['ii_open_suppliers_losing_a_number']} | "
        f"{options['ii_open_suppliers_losing_pill']} |"
    )
    add(
        f"| (ii-closed) require a naming record, unknown names fail | "
        f"{options['ii_closed_numbers_removed']} | "
        f"{options['ii_closed_suppliers_losing_a_number']} | "
        f"{options['ii_closed_suppliers_losing_pill']} |"
    )
    add(
        f"| (iii) show all, label per number | {options['iii_label_numbers_removed']} | 0 | 0 "
        f"(relabels {options['iii_label_numbers_relabelled']}) |"
    )
    add(
        f"| (iv) recover names first, then decide | "
        f"{options['iv_measure_first_numbers_removed']} | 0 | 0 "
        f"(needs {options['iv_measure_first_records_needing_a_name']} names) |"
    )
    add("")
    add("Suppliers whose every named record disagrees with the row — the REZ-102")
    add("class seen population-wide:")
    add("")
    add("| supplier | company_name | records that name someone else |")
    add("| -- | -- | -- |")
    for row in sorted(gap_rows, key=lambda r: r.slug):
        if not row.all_disagree:
            continue
        detail = " · ".join(f"`{ref}` {name}" for ref, verdict, name in row.covered)
        add(f"| `{row.slug}` | {row.company_name} | {detail} |")
    add("")
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--out",
        default="ops/plans/rez-102-group-of-companies-report.md",
        help="report markdown path",
    )
    parser.add_argument("--json", type=Path, default=None, help="also write counts as JSON here")
    args = parser.parse_args()

    try:
        rest = Rest()
        data = load(rest)
    except Exception as exc:  # noqa: BLE001
        print(f"ERROR: could not read production: {exc}", file=sys.stderr)
        return 2

    found = {s.get("slug") for s in data["suppliers"].values() if s.get("slug") in EXPECTED_HOSTS}
    if found != EXPECTED_HOSTS:
        print(
            f"STOP: expected the nine REZ-90 hosts, found {sorted(found)}",
            file=sys.stderr,
        )
        return 2

    names_by_ref, name_source_by_ref = load_name_oracles()
    if not names_by_ref:
        print(
            "ERROR: no name oracle available (associate PDF and cache both missing)",
            file=sys.stderr,
        )
        return 2

    hosts = build_hosts(data, names_by_ref, name_source_by_ref)

    # REZ-99 owns the three stranded numbers. They carry no record, so they
    # cannot reach a report built from records — asserted rather than assumed,
    # because "out of scope" is worth being able to prove.
    touched = {(h["slug"], r.reg) for h in hosts for r in h["refs"]}
    trespass = touched & REZ99_STRANDED
    if trespass:
        print(f"STOP: report reached REZ-99's stranded numbers {sorted(trespass)}", file=sys.stderr)
        return 2

    gap_rows = measure_identity_gap(data["suppliers"], data["bgmea_by_supplier"], names_by_ref)
    counts = summarise_gap(gap_rows, name_source_by_ref)
    options = display_rule_options(gap_rows, counts)

    all_records = rest.all_rows(
        "source_records", {"select": "id,fields->>scraped_company_name"}
    )
    oracle_stats = {
        "total_source_records": len(all_records),
        "records_with_scraped_company_name": sum(
            1 for r in all_records if r.get("scraped_company_name")
        ),
        "associate_pdf_names": sum(1 for s in name_source_by_ref.values() if s == "associate-pdf"),
        "cache_names": sum(1 for s in name_source_by_ref.values() if s == "rez-88-cache"),
    }

    report = render(hosts, gap_rows, counts, options, oracle_stats)
    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(report, encoding="utf-8")
    print(f"wrote {out_path}")

    for host in hosts:
        print(f"  {host['slug']:<18} {host['relation']}")
    print()
    for key, value in counts.items():
        print(f"  {key:<40} {value}")

    if args.json:
        args.json.write_text(
            json.dumps(
                {"gap": counts, "options": options, "oracles": oracle_stats},
                indent=2,
                sort_keys=True,
            ),
            encoding="utf-8",
        )
        print(f"wrote {args.json}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
