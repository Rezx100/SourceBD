"""Separate BGMEA records that are plainly someone else's from possible group arms.

A name disagreement says a registration is registered to a different company.
It does not say the registration is on the wrong row. REZ-102 showed why: on
`dk-knitwear`, `L. A. T Sportwear Ltd.` shares no word with the supplier's name
yet sits at the address and on the phone line of that supplier's own BKMEA
entry, while two records that *do* share its name link to nothing. Repairing on
names alone would have removed the right record and kept the wrong ones.

So every disagreeing record is tested for an independent tie to the supplier:

* the premises on the supplier's own non-BGMEA register entries (BKMEA, RSC,
  BGAPMEA, OEKO-TEX, GOTS) — a different registry wrote those, so they cannot
  have been produced by the mis-attach under test;
* the switchboard on those same entries;
* the mailbox domain, now that `ops/harvest_bgmea_names.py` has recovered the
  contact email BGMEA lists for each membership — a signal the earlier pass
  did not have for the general register;
* the other BGMEA records on the same row, which shows a coherent block even
  when nothing ties it to the host.

Two outcomes:

``foreign``   nothing ties the record to this supplier. Safe to act on.
``possible-group``  something does. Needs a human ruling, never a bulk fix.

Read-only. Proposes nothing and writes nothing.

    python ops/split_bgmea_foreign_records.py
"""
from __future__ import annotations

import json
import os
import sys
from collections import defaultdict
from pathlib import Path
from typing import Any

sys.path.append(str(Path(__file__).resolve().parents[1]))

from etl.core.config import settings  # noqa: E402

os.environ.setdefault("SUPABASE_URL", str(settings.supabase_url or ""))
os.environ.setdefault(
    "SUPABASE_SERVICE_ROLE_KEY", str(settings.supabase_service_role_key or "")
)

from ops.report_bgmea_array_provenance import Rest  # noqa: E402
from ops.report_group_of_companies import (  # noqa: E402
    build_anchor,
    email_keys,
    link_reasons,
    name_agrees,
    name_in_domain,
    same_premises,
    shared_phones,
)

NAMES_PATH = Path(__file__).resolve().parents[1] / "ops" / "plans" / "bgmea-names.json"
OUT_PATH = (
    Path(__file__).resolve().parents[1] / "ops" / "plans" / "bgmea-foreign-split.md"
)
CHUNK = 40


def load_harvest() -> dict[str, dict[str, Any]]:
    return json.loads(NAMES_PATH.read_text(encoding="utf-8"))["names"]


def fetch(rest: Rest) -> dict[str, Any]:
    source_code = {s["id"]: s["code"] for s in rest.all_rows("sources", {"select": "id,code"})}
    bgmea_id = next(sid for sid, code in source_code.items() if code == "BGMEA")
    suppliers = {
        r["id"]: r
        for r in rest.all_rows(
            "suppliers",
            {"select": "id,slug,company_name,is_published,address_raw,phones,"
                       "email_primary,bkmea_reg_number"},
        )
    }
    bgmea = rest.all_rows(
        "source_records",
        {
            "select": "supplier_id,source_id,source_ref,status,fields",
            "source_id": f"eq.{bgmea_id}",
            "status": "eq.active",
        },
    )
    return {"source_code": source_code, "suppliers": suppliers, "bgmea": bgmea}


def fetch_anchor_records(rest: Rest, supplier_ids: list[str]) -> dict[str, list[dict]]:
    """Every active record on the affected suppliers, chunked to keep URLs sane."""
    out: dict[str, list[dict]] = defaultdict(list)
    for i in range(0, len(supplier_ids), CHUNK):
        batch = supplier_ids[i : i + CHUNK]
        rows = rest.all_rows(
            "source_records",
            {
                "select": "supplier_id,source_id,source_ref,status,fields",
                "supplier_id": f"in.({','.join(batch)})",
                "status": "eq.active",
            },
        )
        for r in rows:
            out[r["supplier_id"]].append(r)
    return out


def record_contacts(rec: dict, harvested: dict[str, Any]) -> tuple[str, str, str]:
    """Address, phone and email for one BGMEA record.

    The email comes from the harvest: BGMEA publishes it on the member list but
    the stored record never kept it, which is why this signal is new.
    """
    fields = rec.get("fields") or {}
    ref = str(rec["source_ref"])
    entry = harvested.get(ref) or {}
    address = str(
        fields.get("raw_address")
        or fields.get("factory_address")
        or fields.get("mailing_address")
        or ""
    )
    tel = str(
        fields.get("raw_tel")
        or fields.get("factory_phone")
        or fields.get("mailing_phone")
        or ""
    )
    return address, tel, str(entry.get("email") or "")


def main() -> int:
    harvested = load_harvest()
    rest = Rest()
    data = fetch(rest)
    suppliers = data["suppliers"]

    bgmea_by_supplier: dict[str, list[dict]] = defaultdict(list)
    for rec in data["bgmea"]:
        bgmea_by_supplier[rec["supplier_id"]].append(rec)

    # Which records name a different company than the row they sit on.
    disagreeing: dict[str, list[dict]] = defaultdict(list)
    for sid, recs in bgmea_by_supplier.items():
        sup = suppliers.get(sid)
        if not sup or not sup.get("is_published"):
            continue
        for rec in recs:
            entry = harvested.get(str(rec["source_ref"]))
            if not entry:
                continue
            if not name_agrees(sup.get("company_name") or "", entry["name"]):
                disagreeing[sid].append(rec)

    affected = sorted(disagreeing)
    print(f"{sum(len(v) for v in disagreeing.values())} disagreeing records on "
          f"{len(affected)} suppliers; fetching their other registers...")
    anchors_raw = fetch_anchor_records(rest, affected)

    foreign: list[dict[str, Any]] = []
    possible: list[dict[str, Any]] = []
    for sid in affected:
        sup = suppliers[sid]
        anchor = build_anchor(anchors_raw.get(sid, []), data["source_code"])
        siblings = bgmea_by_supplier[sid]
        for rec in disagreeing[sid]:
            ref = str(rec["source_ref"])
            entry = harvested[ref]
            addr, tel, email = record_contacts(rec, harvested)
            reasons: list[str] = []

            for key, value in anchor.addresses.items():
                ok, basis = same_premises(addr, value)
                if ok:
                    reasons.append(f"same premises as {key} ({basis})")
            for key, value in anchor.phones.items():
                shared = shared_phones(tel, value)
                if shared:
                    reasons.append(f"shares phone {sorted(shared)[0]} with {key}")
            for key, value in anchor.emails.items():
                if email and email_keys(email) & email_keys(value):
                    reasons.append(f"same mailbox as {key}")
                token = name_in_domain(entry["name"], value)
                if token:
                    reasons.append(f"name is in {key}'s mail domain (`{token}`)")
            for other in siblings:
                if other is rec:
                    continue
                o_ref = str(other["source_ref"])
                o_entry = harvested.get(o_ref)
                if not o_entry or not name_agrees(
                    sup.get("company_name") or "", o_entry["name"]
                ):
                    continue
                o_addr, o_tel, _ = record_contacts(other, harvested)
                for why in link_reasons(addr, tel, o_addr, o_tel):
                    reasons.append(f"{why} as the supplier's own record {o_ref}")

            row = {
                "slug": sup.get("slug"),
                "company_name": sup.get("company_name"),
                "ref": ref,
                "registered_to": entry["name"],
                "reasons": reasons,
                "has_own_record": any(
                    harvested.get(str(o["source_ref"]))
                    and name_agrees(
                        sup.get("company_name") or "",
                        harvested[str(o["source_ref"])]["name"],
                    )
                    for o in siblings
                ),
            }
            (possible if reasons else foreign).append(row)

    OUT_PATH.write_text(render(foreign, possible), encoding="utf-8")
    print(f"\nforeign (no tie at all)      : {len(foreign)} records")
    print(f"possible group arm (has ties): {len(possible)} records")
    print(f"  suppliers affected         : "
          f"{len({r['slug'] for r in foreign + possible})}")
    print(f"\nwrote {OUT_PATH}")
    print("No production writes.")
    return 0


def render(foreign: list[dict], possible: list[dict]) -> str:
    lines = [
        "# BGMEA registrations that name another company, split by evidence",
        "",
        "Every record below is registered to a company other than the supplier",
        "displaying it. The split is about whether anything *independent* ties it",
        "to that supplier anyway — a shared building, switchboard or mailbox on a",
        "register BGMEA did not write.",
        "",
        f"- **foreign — no tie at all: {len(foreign)} records**",
        f"- **possible group arm — something ties it: {len(possible)} records**",
        "",
        "## Foreign — nothing connects these to the row",
        "",
        "No shared premises, no shared phone, no shared mailbox, and no link to",
        "any record on the row that does name the supplier.",
        "",
        "| supplier | registration | registered to | row has a record of its own |",
        "| -- | -- | -- | -- |",
    ]
    for r in sorted(foreign, key=lambda x: (x["slug"] or "", x["ref"])):
        own = "yes" if r["has_own_record"] else "**no**"
        lines.append(
            f"| `{r['slug']}` — {r['company_name']} | {r['ref']} | {r['registered_to']} | {own} |"
        )

    lines += [
        "",
        "## Possible group arm — evidence ties these to the row",
        "",
        "A different name, but a real connection. These are the L. A. T shape and",
        "must not be removed in bulk; each needs a ruling.",
        "",
        "| supplier | registration | registered to | why it may belong |",
        "| -- | -- | -- | -- |",
    ]
    for r in sorted(possible, key=lambda x: (x["slug"] or "", x["ref"])):
        why = "; ".join(r["reasons"][:2])
        lines.append(
            f"| `{r['slug']}` — {r['company_name']} | {r['ref']} | {r['registered_to']} | {why} |"
        )
    lines.append("")
    return "\n".join(lines)


if __name__ == "__main__":
    raise SystemExit(main())
