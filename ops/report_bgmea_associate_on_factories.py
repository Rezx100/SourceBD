"""Factories that hold a BGMEA buying-house entry: whose entry is it? One page for the founder.

WHY THIS EXISTS
---------------
Some rows shown as a factory hold an entry on BGMEA's associate (buying
house) register and none on its general one. The founder's rule of 12 Aug 2026
(`ops/plans/bgmea-attribution-decisions.md`, section 2): an associate-register
company is a buying house; an associate number sitting on a factory that is a
different company comes off it and goes on the buying house's own profile.

So each entry is one question, and the answer needs BGMEA's own name for the
entry (`ops/plans/bgmea-names.json`, harvested 5 Aug 2026) and whatever an
independent register says ties it to the row. The tie test is the one
`ops/split_bgmea_foreign_records.py` uses: premises, phone or mailbox on the
row's non-BGMEA entries, never the row's own address, which the loader may
have copied from the BGMEA entry itself.

WHAT IT SUGGESTS
----------------
  move   BGMEA names another company and nothing independent ties it here.
  leave  BGMEA names another company but a register ties it to this row (a
         group arm) or the name is close; or it is the row's own entry and
         the row has sewing machines, 50 or more workers, or a safety, export
         or audit register.
  tag    it is the row's own entry and nothing says the row makes garments.

"Own" means the same name once Ltd., spacing and case are set aside. A name
that is only close ("Otto Connection" on Cotton Connection, "Fashion Tex
International" on Fashion Tex) is shown as close.

READ-ONLY. GET requests only; no `--apply`. The founder decides on the page.

USAGE
-----
    python ops/report_bgmea_associate_on_factories.py
    python ops/report_bgmea_associate_on_factories.py --cache DIR   # DIR/pull.json

Exit codes: 0 report produced, 2 could not run.
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import defaultdict
from pathlib import Path
from typing import Any

from etl.core.bgmea_identity import MEMBER_TYPE_ASSOCIATE, MEMBER_TYPE_GENERAL
from etl.core.normalize import normalize_company_name
from ops.report_duplicate_suppliers import write_page
from ops.report_group_of_companies import (
    build_anchor,
    email_keys,
    name_agrees,
    name_in_domain,
    same_premises,
    shared_phones,
)

NAMES_PATH = Path("ops/plans/bgmea-names.json")
# Registers that only list a producing site. BKMEA is not here: it has office members.
_MAKES_GARMENTS = ("RSC", "EPB", "WRAP", "SA8000", "BRAND_")
_OFFICE_WORKERS = 50

_SECTIONS = (
    ("several", "Several buying-house entries on one factory",
     "One company does not hold four buying-house memberships. Most of these belong to other companies with a similar name."),
    ("other", "The entry is in another company's name",
     "BGMEA lists this entry under a different name from the profile it sits on. Where the name is only close, "
     "the row says so."),
    ("own", "The entry is in this company's own name",
     "Your rule of 12 Aug says an associate member is a buying house. I suggest Leave only where the profile has "
     "sewing machines, 50 or more workers, or a safety, export or audit register behind it."),
)


def load(cache: Path | None) -> dict[str, Any]:
    if cache:
        return json.loads((cache / "pull.json").read_text(encoding="utf-8"))
    from ops.repair_bgmea_conflations import Rest  # GET-only use: all_rows

    rest = Rest()
    sources = rest.all_rows("sources", {"select": "id,code"})
    bgmea = next(s["id"] for s in sources if s["code"] == "BGMEA")
    typed = rest.all_rows("source_records", {
        "select": "supplier_id,member_type:fields->>bgmea_member_type", "source_id": f"eq.{bgmea}", "status": "eq.active"})
    general = {r["supplier_id"] for r in typed if r["member_type"] == MEMBER_TYPE_GENERAL}
    wanted = sorted({r["supplier_id"] for r in typed if r["member_type"] == MEMBER_TYPE_ASSOCIATE} - general)
    suppliers, records = [], []
    for i in range(0, len(wanted), 40):  # chunked to keep URLs sane
        ids = ",".join(wanted[i:i + 40])
        suppliers += rest.all_rows("suppliers", {
            "select": "id,slug,company_name,is_published,district,employees_total,machines_sewing",
            "id": f"in.({ids})", "entity_type": "eq.factory"})
        records += rest.all_rows("source_records", {
            "select": "supplier_id,source_id,source_ref,status,fields", "supplier_id": f"in.({ids})", "status": "eq.active"})
    kept = {s["id"] for s in suppliers}
    return {
        "suppliers": suppliers, "sources": sources, "records": [r for r in records if r["supplier_id"] in kept],
        "namesakes": rest.all_rows("suppliers", {"select": "slug,company_name,is_published", "entity_type": "eq.buying_house"}),
    }


def same_name(a: str | None, b: str | None) -> bool:
    """One company name, not merely a similar one.

    `name_agrees` also takes a typo apart, and "X International" for "X": often
    the buying arm, a second company. Those are shown as close, never as own.
    """
    return bool(a and b) and normalize_company_name(a) == normalize_company_name(b)


def ties(entry: dict, registered: dict, anchor: Any) -> list[str]:
    """What an independent register says connects this BGMEA entry to the row."""
    fields = entry["fields"] or {}
    out = []
    for key, value in anchor.addresses.items():
        if same_premises(fields.get("raw_address"), value)[0]:
            out.append(f"the same premises as its {key.split(':')[0]} entry")
    for key, value in anchor.phones.items():
        if shared_phones(fields.get("raw_tel"), value):
            out.append(f"a phone number on its {key.split(':')[0]} entry")
    for key, value in anchor.emails.items():
        if registered.get("email") and email_keys(registered["email"]) & email_keys(value):
            out.append(f"the mailbox on its {key.split(':')[0]} entry")
        elif name_in_domain(registered.get("name"), value):
            out.append(f"its name is in the mail domain of the {key.split(':')[0]} entry")
    return sorted(set(out))


def build(pull: dict[str, Any], names: dict[str, dict]) -> list[dict]:
    code = {s["id"]: s["code"] for s in pull["sources"]}
    by_supplier: dict[str, list[dict]] = defaultdict(list)
    for r in pull["records"]:
        by_supplier[r["supplier_id"]].append(r)
    out = []
    for s in sorted(pull["suppliers"], key=lambda s: s["company_name"].lower()):
        records = by_supplier[s["id"]]
        anchor = build_anchor(records, code)
        registers = sorted({code[r["source_id"]] for r in records} - {"BGMEA"})
        makes = (
            s.get("machines_sewing") is not None or (s.get("employees_total") or 0) >= _OFFICE_WORKERS
            or any(c.startswith(_MAKES_GARMENTS) for c in registers)
        )
        entries = sorted(
            (r for r in records if code[r["source_id"]] == "BGMEA"
             and (r["fields"] or {}).get("bgmea_member_type") == MEMBER_TYPE_ASSOCIATE),
            key=lambda r: (not r["source_ref"].isdigit(), int(r["source_ref"]) if r["source_ref"].isdigit() else 0, r["source_ref"]),
        )
        own_address = next(iter(anchor.addresses.values()), None)
        for e in entries:
            registered = names.get(e["source_ref"]) or {}
            if registered.get("register") != "associate":
                registered = {}
            same = same_name(s["company_name"], registered.get("name"))
            near = not same and name_agrees(s["company_name"], registered.get("name"))
            why = ties(e, registered, anchor)
            home = None if same else next(
                (b for b in pull["namesakes"] if same_name(b["company_name"], registered.get("name"))), None)
            out.append({
                "supplier_id": s["id"], "slug": s["slug"], "company": s["company_name"], "published": s["is_published"],
                "district": s.get("district"), "workers": s.get("employees_total"), "machines": s.get("machines_sewing"),
                "registers": registers, "own_address": own_address, "makes_garments": makes,
                "ref": e["source_ref"], "registered_to": registered.get("name"), "email": registered.get("email"),
                "entry_address": (e["fields"] or {}).get("raw_address"), "entry_phone": (e["fields"] or {}).get("raw_tel"),
                "same_name": same, "near_name": near, "ties": why, "entries_on_row": len(entries),
                "home": home and {"slug": home["slug"], "name": home["company_name"]},
                "section": "several" if len(entries) > 1 else ("own" if same else "other"),
                "suggest": ("leave" if makes else "tag") if same else ("leave" if why or near else "move"),
            })
    return out


def page_data(rows: list[dict]) -> list[dict]:
    """The rows as the review page reads them. Numbers each row (`n`) in place."""
    page, n = [], 0
    for key, title, why in _SECTIONS:
        items = []
        for r in (r for r in rows if r["section"] == key):
            n += 1
            r["n"] = n
            meta = [r["district"] or "district not filed",
                    f"{r['workers']:,} workers" if r["workers"] else "workers not filed",
                    f"{r['machines']:,} sewing machines" if r["machines"] else "no machines filed"]
            said = [f"associate no. {r['ref']}"] + ([r["email"]] if r["email"] else [])
            where = " · ".join(x for x in (r["entry_address"], r["entry_phone"]) if x)
            for_it = (["BGMEA lists it under this company's own name"] if r["same_name"] else []) + r["ties"]
            against = [] if r["same_name"] else [
                "BGMEA's name for it is close to this company's, not the same" if r["near_name"]
                else "BGMEA lists it under another name"]
            if r["home"]:
                against.append(f"we already have a buying house called {r['home']['name']}")
            items.append({
                "n": n, "sug": r["suggest"],
                "keep": {"name": r["company"], "meta": " · ".join(meta), "address": (r["own_address"] or "")[:120],
                         "src": r["registers"], "url": f"https://sourcebd.net/suppliers/{r['slug']}" if r["published"] else None},
                "drop": {"name": r["registered_to"] or "(BGMEA's name not recovered)", "meta": " · ".join(said),
                         "address": where[:160], "src": ["BGMEA associate"], "url": None},
                "ties": for_it, "against": against,
            })
        if items:
            page.append({"title": title, "why": why, "items": items})
    return page


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--json", type=Path, default=Path("ops/plans/bgmea-associate-on-factories.json"))
    parser.add_argument("--html", type=Path, default=Path("ops/plans/bgmea-associate-on-factories-review.html"))
    parser.add_argument("--cache", type=Path, default=None, help="directory holding an earlier pull (pull.json)")
    args = parser.parse_args()
    try:
        pull = load(args.cache)
    except Exception as exc:  # noqa: BLE001
        print(f"ERROR: could not read production: {exc}", file=sys.stderr)
        return 2
    rows = build(pull, json.loads(NAMES_PATH.read_text(encoding="utf-8"))["names"])
    page = page_data(rows)  # numbers the rows, so before the JSON is written
    args.json.write_text(json.dumps(rows, indent=1, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")
    write_page(args.html, page)
    print(f"{len({r['slug'] for r in rows})} factories, {len(rows)} buying-house entries")
    for key, title, _ in _SECTIONS:
        part = [r for r in rows if r["section"] == key]
        print(f"  {title}: {len(part)} ("
              + ", ".join(f"{d} {sum(r['suggest'] == d for r in part)}" for d in ("move", "tag", "leave")) + ")")
    print(f"json: {args.json}; page: {args.html}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
