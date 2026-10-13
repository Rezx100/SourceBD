"""Where does the site contradict itself, a register, or its own marketing?

WHY THIS EXISTS
---------------
SourceBD sells "receipts, not opinions": every fact on a company is a dated
entry from a named public register. A buyer's compliance team tests that by
looking for one place where two parts of the site disagree. This script looks
first. Founder, 13 Oct 2026; findings and ranking: `ops/plans/data-integrity-audit.md`.

READ-ONLY. GET requests only; there is no `--apply`. It prints counts and
slugs, never a phone number, a mailbox or a person's name.

USAGE
-----
    python ops/audit_data_integrity.py --cache DIR     # pull once into DIR, reuse after
    python ops/audit_data_integrity.py --cache DIR --json out.json
    python ops/audit_data_integrity.py --cache DIR --only C1,F1

The endpoint half (live site, database API as a signed-out visitor) is
`ops/audit_endpoints.py`.

Exit codes: 0 report produced, 2 could not run.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import socket
import sys
import time
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path
from typing import Any

# What each check reads. Contact columns are pulled to be counted and compared, never printed.
# Every table has an `order`: a table read in pages with none can repeat a row and drop another.
TABLES: dict[str, dict[str, str]] = {
    "suppliers": {
        "select": "id,slug,company_name,name_display,entity_type,bgmea_reg_numbers,bgmea_verified,bkmea_reg_number,"
                  "bkmea_verified,bgapmea_verified,btma_verified,rjsc_reg_number,epb_erc_number,bepza_zone,"
                  "contact_name,contact_role,email_primary,phones,website,address_raw,city,district,country,lat,lng,"
                  "source_tags,is_sanctioned,is_published,claimed_by,completeness_pct,created_at,updated_at,"
                  "employees_total,employees_male,employees_female,production_capacity_pcs_day,machines_sewing,"
                  "established_date,principal_products,factory_types,parent_group_name,sanctioned_reason,"
                  "sanctions_reviewed_at,sanctions_cleared,sanctions_cleared_reason,t13_source_count,facility_of",
        "order": "id",
    },
    "sources": {"select": "id,code,display_name,tier,base_url,listed", "order": "code"},
    "records": {"path": "source_records", "select": "id,supplier_id,source_id,source_ref,status,fields,fetched_at", "order": "id"},
    "certifications": {"select": "id,supplier_id,kind,certificate_no,issuer,issued_on,expires_on,source_record_id,"
                                 "document_url,verified,rejected_at,last_seen_at,listing_status,created_at", "order": "id"},
    "rsc": {"path": "rsc_remediation", "select": "id,supplier_id,rsc_factory_id,rsc_factory_name,active,source_record_id,"
                                                 "fetched_at,progress_pct,workers_count,remediation_status", "order": "id"},
    "screening": {"path": "sanctions_screening", "select": "supplier_id,list,match_score,list_entry_ref,screened_at,active", "order": "id"},
    "list_entries": {"path": "sanctions_list_entries", "select": "list,listing_status,fetched_at,last_seen_at", "order": "id"},
    "volza": {"path": "volza_export_checks", "select": "supplier_id,name_searched,match_class,volza_supplier_name,shipments,"
                                                       "fetched_at,expires_at,window_end", "order": "supplier_id"},
}


def load_env() -> None:
    """A worktree has no `.env`; the founder's checkout does."""
    for path in (Path(".env"), Path(__file__).resolve().parents[1] / ".env", Path("E:/SourceBD/.env")):
        if path.is_file():
            for line in path.read_text(encoding="utf-8").splitlines():
                key, sep, value = line.partition("=")
                if sep and not key.lstrip().startswith("#"):
                    os.environ.setdefault(key.strip(), value.strip().strip("\"'"))
            return


def pin_dns(host: str) -> None:
    """Some networks here cannot resolve the Supabase host. Ask 1.1.1.1 over HTTPS and pin the answer."""
    try:
        socket.getaddrinfo(host, 443)
        return
    except socket.gaierror:
        pass
    import httpx

    answer = httpx.get("https://1.1.1.1/dns-query", params={"name": host, "type": "A"},
                       headers={"accept": "application/dns-json"}, timeout=20).json()
    address = next(a["data"] for a in answer["Answer"] if a["type"] == 1)
    real = socket.getaddrinfo
    socket.getaddrinfo = lambda h, *a, **k: real(address if h == host else h, *a, **k)  # type: ignore[assignment]


def _all_rows(rest: Any, path: str, params: dict[str, str], page: int = 500) -> list[dict]:
    """`Rest.all_rows` with a retry: the connection drops now and then on the 23,000 register entries."""
    out: list[dict] = []
    while True:
        for attempt in range(5):
            try:
                r = rest.client.get(f"{rest.base}/{path}", params=params,
                                    headers={"Range": f"{len(out)}-{len(out) + page - 1}"})
                r.raise_for_status()
                break
            except Exception:  # noqa: BLE001
                if attempt == 4:
                    raise
                time.sleep(2 * (attempt + 1))
        rows = r.json()
        out.extend(rows)
        if len(rows) < page:
            return out


def load(cache: Path | None, tables: dict[str, dict[str, str]] = TABLES) -> dict[str, list[dict]]:
    """Every table the checks read. With a cache directory, pulls only what is not there yet."""
    out: dict[str, list[dict]] = {}
    rest = None
    for name, spec in tables.items():
        path = cache / f"{name}.json" if cache else None
        if path and path.is_file():
            out[name] = json.loads(path.read_text(encoding="utf-8"))
            continue
        if rest is None:
            load_env()
            from urllib.parse import urlparse

            pin_dns(urlparse(os.environ.get("SUPABASE_URL", "")).hostname or "")
            from ops.repair_bgmea_conflations import Rest  # GET-only use: all_rows

            rest = Rest()
        params = {k: v for k, v in spec.items() if k != "path"}
        out[name] = _all_rows(rest, spec.get("path", name), params)
        if path:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(json.dumps(out[name], ensure_ascii=False), encoding="utf-8")
        print(f"pulled {name}: {len(out[name])}", file=sys.stderr)
    return out


# ---------------------------------------------------------------------------
# The data, indexed once
# ---------------------------------------------------------------------------

CERT_CODES = ("GOTS", "OEKO_TEX", "WRAP", "SA8000")
FLAG_OF = {"BGMEA": "bgmea_verified", "BKMEA": "bkmea_verified", "BGAPMEA": "bgapmea_verified", "BTMA": "btma_verified"}
TIER_13 = ("tier1_gov", "tier2_industry", "tier3_cert")
# Registers where one entry is one member (or, for RSC, one building). A certificate
# body lists several certificates per company, so those are compared by certificate number.
ONE_ENTRY_EACH = ("BGMEA", "BGMEA (associate)", "BKMEA", "BGAPMEA", "BTMA", "EPB", "RSC")
STALE_DAYS = 90

# The 64 districts as the government spells them now.
DISTRICTS = frozenset((
    "Bagerhat Bandarban Barguna Barishal Bhola Bogura Brahmanbaria Chandpur Chapainawabganj Chattogram Chuadanga "
    "Cumilla Dhaka Dinajpur Faridpur Feni Gaibandha Gazipur Gopalganj Habiganj Jamalpur Jashore "
    "Jhalokati Jhenaidah Joypurhat Khagrachhari Khulna Kishoreganj Kurigram Kushtia Lakshmipur Lalmonirhat "
    "Madaripur Magura Manikganj Meherpur Moulvibazar Munshiganj Mymensingh Naogaon Narail Narayanganj Narsingdi "
    "Natore Netrokona Nilphamari Noakhali Pabna Panchagarh Patuakhali Pirojpur Rajbari Rajshahi Rangamati Rangpur "
    "Satkhira Shariatpur Sherpur Sirajganj Sunamganj Sylhet Tangail Thakurgaon"
).split()) | {"Cox's Bazar"}

_CONTACT_SHAPES = {
    "an email address": re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+"),
    "a web address": re.compile(r"(?:https?://|www\.)\S+", re.I),
    "a mobile number": re.compile(r"(?<!\d)(?:\+?88)?0?1[3-9]\d{2}[\s-]?\d{6}(?!\d)"),
    "a labelled phone": re.compile(r"\b(?:tel|phone|mobile|cell|fax|mob)\b[\s.:#-]*\+?\d[\d\s-]{5,}", re.I),
}


def _day(value: Any) -> date | None:
    try:
        return date.fromisoformat(str(value)[:10])
    except ValueError:
        return None


def _number(value: Any) -> int | None:
    digits = re.sub(r"[^\d]", "", str(value if value is not None else ""))
    return int(digits) if digits else None


def entry_number(code: str, ref: str | None, fields: dict) -> str:
    """The register's own number for an entry. BGMEA's two registers and BKMEA's two scrapes are told apart."""
    from ops.report_duplicate_suppliers import entry_key

    return entry_key(code.split(" ")[0], ref, fields)


class Data:
    """Every table by the key the checks ask for. `shown` is what a buyer can reach:
    a published company, or a building whose own company is published."""

    def __init__(self, tables: dict[str, list[dict]], today: date | None = None) -> None:
        self.today = today or date.today()
        self.sources = {s["id"]: s for s in tables.get("sources", [])}
        self.suppliers = {s["id"]: s for s in tables.get("suppliers", [])}
        self.records: dict[str, list[dict]] = defaultdict(list)
        for r in tables.get("records", []):
            src = self.sources.get(r["source_id"])
            if not src or r.get("status", "active") != "active":
                continue
            fields = r.get("fields") or {}
            code = src["code"]
            if code == "BGMEA" and fields.get("bgmea_member_type") == "associate_buying_house":
                code = "BGMEA (associate)"
            self.records[r["supplier_id"]].append(dict(r, code=code, tier=src["tier"], fields=fields))
        self.certs: dict[str, list[dict]] = defaultdict(list)
        for c in tables.get("certifications", []):
            self.certs[c["supplier_id"]].append(c)
        self.rsc = {r["supplier_id"]: r for r in tables.get("rsc", [])}
        self.screening = tables.get("screening", [])
        self.list_entries = tables.get("list_entries", [])
        self.volza = tables.get("volza", [])
        all_rows = list(self.suppliers.values())
        self.published = [s for s in all_rows if s.get("is_published")]
        self.buildings = [s for s in all_rows if s.get("facility_of")]
        self.shown = self.published + [
            s for s in self.buildings
            if not s.get("is_published") and self.suppliers.get(s["facility_of"], {}).get("is_published")
        ]

    def of(self, supplier_id: str, *codes: str) -> list[dict]:
        return [r for r in self.records[supplier_id] if r["code"].split(" ")[0] in codes or r["code"] in codes]

    def codes(self, supplier_id: str) -> set[str]:
        return {r["code"].split(" ")[0] for r in self.records[supplier_id]}

    def page_slug(self, supplier: dict) -> str:
        """Where a buyer reads this row: its own page, or its company's when it is a building."""
        parent = self.suppliers.get(supplier.get("facility_of") or "")
        return parent["slug"] if parent and not supplier.get("is_published") else supplier["slug"]


def finding(fid: str, sev: str, title: str, rows: Any, where: str, detail: str = "", count: int | None = None) -> dict:
    """One measured thing: how many, three slugs spread across the list, and where a buyer meets it."""
    slugs = sorted({r if isinstance(r, str) else r["slug"] for r in rows})
    spread = slugs[:: max(1, len(slugs) // 3)][:3]
    return {"id": fid, "sev": sev, "title": title, "count": len(slugs) if count is None else count,
            "examples": spread, "where": where, "detail": detail}


def _tally(values: Any, top: int = 12) -> str:
    return ", ".join(f"{k} {n}" for k, n in Counter(values).most_common(top))


# ---------------------------------------------------------------------------
# A. One number, every place (the database half)
# ---------------------------------------------------------------------------

def check_counts(d: Data) -> list[dict]:
    no_entry = [s for s in d.published if not d.records[s["id"]]]
    no_t13 = [s for s in d.published if d.records[s["id"]] and not any(r["tier"] in TIER_13 for r in d.records[s["id"]])]
    drift = [s for s in d.published
             if (s.get("t13_source_count") or 0) != len({r["source_id"] for r in d.records[s["id"]] if r["tier"] in TIER_13})]
    rows, entries = Counter(), defaultdict(set)
    for sid, recs in d.records.items():
        for r in recs:
            rows[r["code"].split(" ")[0]] += 1
            entries[r["code"].split(" ")[0]].add(entry_number(r["code"], r["source_ref"], r["fields"]))
    twice = {c: rows[c] - len(entries[c]) for c in rows if c in ONE_ENTRY_EACH and rows[c] > len(entries[c]) * 1.2}
    out = [
        finding("A1", "S2", "Published with no register entry at all", no_entry,
                "the company page: a profile with no source", "The product rule is no fact without a source."),
        finding("A2", "S2", "Published with no government, trade-body or certificate entry", no_t13,
                "search and the company page", "Only a brand list names them; the publish rule asks for a Tier 1 to 3 source."),
        finding("A3", "S2", "The stored source count differs from the entries held", drift,
                "the Sources number in search (stored) against the company page (counted live)"),
    ]
    if twice:
        out.append(finding(
            "A4", "S4", "The public facts function counts a register's \"records\" more than once per member", [],
            "`marketing_facts().sources[].records`, open to any visitor; no page prints it (/methodology prints suppliers)",
            "; ".join(f"{c}: {rows[c]} rows for {len(entries[c])} members" for c in sorted(twice)), count=sum(twice.values())))
    return out


# ---------------------------------------------------------------------------
# C. Badge versus receipt
# ---------------------------------------------------------------------------

def expected_completeness(s: dict, rsc_row: dict | None, certs: int) -> int:
    """`compute_completeness()` as production holds it (13 Oct 2026)."""
    score = 5 if s.get("company_name") else 0
    score += 10 * bool(s.get("bgmea_verified")) + 8 * bool(s.get("bkmea_verified")) + 7 * bool(s.get("rjsc_reg_number"))
    score += 8 * bool(s.get("email_primary")) + 5 * bool(s.get("phones")) + 4 * bool(s.get("address_raw")) + 3 * bool(s.get("contact_name"))
    score += 18 * bool(rsc_row and float(rsc_row.get("progress_pct") or 0) == 100) + 12 * bool(certs) + 10 * bool(s.get("claimed_by"))
    return min(100, score)


def check_badges(d: Data) -> list[dict]:
    out = []
    flag_no_entry, entry_no_flag = defaultdict(list), defaultdict(list)
    for s in d.published:
        held = d.codes(s["id"])
        for code, flag in FLAG_OF.items():
            if s.get(flag) and code not in held:
                flag_no_entry[code].append(s)
            if code in held and not s.get(flag):
                entry_no_flag[code].append(s)
    out.append(finding("C1", "S2", "\"Verified\" flag set with no entry from that trade body",
                       [s for rows in flag_no_entry.values() for s in rows],
                       "the completeness figure and its search filter; the BKMEA number pill reads this flag",
                       _tally(c for c, rows in flag_no_entry.items() for _ in rows)))
    out.append(finding("C2", "S2", "Holds the trade body's entry, \"verified\" flag not set",
                       [s for rows in entry_no_flag.values() for s in rows], "completeness (the points are missing)",
                       _tally(c for c, rows in entry_no_flag.items() for _ in rows)))

    bkmea_unbacked, bgmea_unbacked = [], []
    for s in d.published:
        number = re.sub(r"\s+", "", s.get("bkmea_reg_number") or "")
        if number and number not in {re.sub(r"\s+", "", str(r["fields"].get("bkmea_reg_number") or "")) for r in d.of(s["id"], "BKMEA")}:
            bkmea_unbacked.append(s)
        backed = set()
        for r in d.of(s["id"], "BGMEA"):
            kind = "associate" if r["code"] == "BGMEA (associate)" else "general"
            backed.add(f"{kind}:{str(r['fields'].get('bgmea_reg_number') or r['source_ref']).split(':')[-1].strip()}")
        if set(s.get("bgmea_reg_numbers") or []) - backed:
            bgmea_unbacked.append(s)
    out.append(finding("C3", "S2", "BKMEA number on the company that none of its BKMEA entries carries", bkmea_unbacked,
                       "Memberships on the company page (the BKMEA pill reads the stored number, not the entry)"))
    out.append(finding("C4", "S3", "BGMEA number stored on the company with no entry behind it", bgmea_unbacked,
                       "not shown (the page reads entries); the stored list is stale"))

    wrong = [s for s in d.published
             if (s.get("completeness_pct") or 0) != expected_completeness(s, d.rsc.get(s["id"]), len(d.certs[s["id"]]))]
    out.append(finding("C5", "S3", "Stored completeness differs from its own formula", wrong,
                       "the completeness filter and sort in search"))

    tags_missing = [s for s in d.published if d.codes(s["id"]) - set(s.get("source_tags") or []) - {"RSC"}]
    tags_extra = [s for s in d.published if set(s.get("source_tags") or []) - d.codes(s["id"])]
    out.append(finding("C6", "S2", "Source tags name a register the company holds no entry in", tags_extra,
                       "the register marks on a search row"))
    out.append(finding("C7", "S3", "Holds an entry the source tags leave out", tags_missing, "the register marks on a search row"))

    zone = [s for s in d.published if s.get("bepza_zone") and "BEPZA" not in d.codes(s["id"])]
    out.append(finding("C8", "S3", "An export-zone name with no BEPZA entry behind it", zone,
                       "the zone on the company record", "BEPZA is not read; the zone was inferred. " + _tally((s["bepza_zone"] for s in zone), top=4)))
    return out


def page_workers(d: Data, s: dict) -> tuple[int | None, bool]:
    """The record's headline figure as `production_workers_display_batch()` builds it: RSC headcounts
    when any site has one, else the filed totals, summed over the company and its buildings.
    Returns (figure, whether the company's own row is part of it)."""
    sites = []
    for site in [s] + [b for b in d.buildings if b["facility_of"] == s["id"]]:
        row = d.rsc.get(site["id"])
        rsc = row.get("workers_count") if row and row.get("active") else None
        sites.append((site["id"], rsc, site.get("employees_total")))
    use_rsc = any(rsc is not None for _, rsc, _ in sites)
    counted = [(sid, rsc if use_rsc else own) for sid, rsc, own in sites if (rsc if use_rsc else own) is not None]
    return (sum(v for _, v in counted) if counted else None), any(sid == s["id"] for sid, _ in counted)


def check_workers(d: Data) -> list[dict]:
    two_figures, without_self = [], []
    for s in d.published:
        shown, includes_self = page_workers(d, s)
        if shown is not None and s.get("employees_total") is not None and shown != s["employees_total"]:
            two_figures.append(s)
            if not includes_self:
                without_self.append(s)
    both = [s for s in d.published if None not in (s.get("employees_total"), s.get("employees_male"), s.get("employees_female"))]
    sums = [s for s in both if s["employees_total"] != s["employees_male"] + s["employees_female"]]
    huge = [s for s in d.published if (s.get("employees_total") or 0) > 50_000]
    half = [s for s in d.published if s.get("employees_total") is None and (s.get("employees_male") or s.get("employees_female"))]
    return [
        finding("W1", "S2", "Search and the company page give two worker figures", two_figures,
                "the Workers column in search and the export (the filed total) against the Workers tile on the page "
                "(safety-register headcounts), whose caption reads \"the number the company itself filed\"",
                f"On {len(without_self)} the page figure leaves the company's own row out and says so (\"excluded: <the company>\")."),
        finding("C9", "S2", "Workers total is not men plus women", sums, "Workers on the company page"),
        finding("C10", "S3", "More than 50,000 workers on one record", huge, "Workers in search and on the page; the Workers sort"),
        finding("C11", "S4", "Men or women filed, no total", half, "Workers on the company page"),
    ]


# ---------------------------------------------------------------------------
# C/E. Certificates and the safety register
# ---------------------------------------------------------------------------

def check_certificates(d: Data) -> list[dict]:
    have_row = {c["source_record_id"] for rows in d.certs.values() for c in rows}
    no_row, expiry_differs, expired, delisted, withdrawn = [], [], [], [], []
    by_number: dict[tuple[str, str], set[str]] = defaultdict(set)
    for s in d.shown:
        page = d.page_slug(s)
        for r in d.of(s["id"], *CERT_CODES):
            if r["id"] not in have_row:
                no_row.append(page)
            if "withdraw" in str(r["fields"].get("sa8000_status") or "").lower():
                withdrawn.append(page)
        for c in d.certs[s["id"]]:
            if c.get("rejected_at"):
                continue
            entry = next((r for r in d.records[s["id"]] if r["id"] == c["source_record_id"]), None)
            filed = _day(entry["fields"].get("expires_on")) if entry else None
            if filed and _day(c.get("expires_on")) != filed:
                expiry_differs.append(page)
            if _day(c.get("expires_on")) and _day(c["expires_on"]) < d.today:
                expired.append(page)
            if c.get("listing_status") == "no_longer_listed":
                delisted.append(page)
            if (c.get("certificate_no") or "").strip():
                by_number[(c["kind"], c["certificate_no"].strip())].add(page)
    shared = sorted({slug for pages in by_number.values() if len(pages) > 1 for slug in pages})
    return [
        finding("E1", "S1", "A withdrawn or cancelled SA8000 certificate, shown with only its expiry date", withdrawn,
                "Certificates on the company page", "The register says withdrawn; the page can only say expired."),
        finding("F2", "S1", "One certificate number on two companies", shared, "Certificates on both company pages",
                f"{sum(1 for p in by_number.values() if len(p) > 1)} certificate numbers", ),
        finding("E2", "S3", "Certificates past their expiry date", expired, "Certificates (shown as expired, with the date)",
                f"{len(expired)} certificates", ),
        finding("E3", "S3", "Certificates the body no longer lists", delisted, "Certificates and the Saved list (`listing_status`)",
                f"{len(delisted)} certificates"),
        finding("C12", "S2", "A certificate entry in Sources with no certificate row", no_row,
                "Sources lists the body; Certificates does not show the certificate"),
        finding("C13", "S2", "Certificate expiry differs from its own register entry", expiry_differs, "Certificates"),
    ]


def check_safety(d: Data) -> list[dict]:
    """The safety table keeps one row per company and the page shows only rows marked active;
    the register is per building and carries a status. Judged per page: a company and its buildings."""
    family: dict[str, list[dict]] = defaultdict(list)
    for s in d.shown:
        family[d.page_slug(s)].append(s)
    by_status: dict[str, list[str]] = defaultdict(list)
    says_none, hidden_good, hidden_adverse, several, no_row, figures = set(), [], [], [], [], []
    for page, rows in family.items():
        entries = [e for s in rows for e in d.of(s["id"], "RSC")]
        if not entries:
            continue
        statuses = {str(e["fields"].get("rsc_status_name") or "").strip().lower() for e in entries} - {""}
        active_rows = [d.rsc[s["id"]] for s in rows if d.rsc.get(s["id"], {}).get("active")]
        for status in statuses - {"active"}:
            by_status[status].append(page)
        if not active_rows:
            says_none.add(page)
            if "active" in statuses:
                hidden_good.append(page)
        elif statuses - {"active"}:
            hidden_adverse.append(page)
        for s in rows:
            own = d.of(s["id"], "RSC")
            row = d.rsc.get(s["id"])
            if len(own) > 1:
                several.append(page)
            if own and not row:
                no_row.append(page)
            kept = next((e for e in own if row and e["id"] == row.get("source_record_id")), None)
            if kept and row.get("active") and _number(kept["fields"].get("rsc_workers_count")) != row.get("workers_count"):
                figures.append(page)
    not_active = sorted({slug for rows in by_status.values() for slug in rows})
    ineligible = sorted(set(by_status.get("ineligible", [])))
    return [
        finding("S1a", "S1", "The safety register lists a factory as Ineligible and the page does not say so", ineligible,
                "the RSC tile and Safety section of the company page, beside an RSC number under Sources",
                f"{len(says_none & set(ineligible))} of these pages say \"no RSC record\". Ineligible is RSC's word for a "
                "factory its member brands may not source from."),
        finding("S1b", "S1", "One building shown as active while another entry on the company is not", hidden_adverse,
                "Safety on the company page", "The entry that is not active is listed under Sources with no status."),
        finding("S1c", "S2", "An active safety record exists and the page says \"no RSC record\"", hidden_good,
                "the RSC tile and Safety section", "The one row the safety table keeps is the building that is not active."),
        finding("S1d", "S2", "Safety register status other than active, not stated on the page", not_active,
                "the RSC tile and Safety section; Sources still lists RSC and counts it",
                f"{len(says_none & set(not_active))} say \"no RSC record\". "
                + _tally(st for st, rows in by_status.items() for _ in set(rows))),
        finding("S1e", "S2", "Two or more safety-register entries, one safety row", several,
                "Safety shows one building; Sources lists every entry"),
        finding("S1f", "S3", "Safety-register entry with no safety row at all", no_row, "Safety on the company page"),
        finding("S1g", "S3", "Safety row's worker figure differs from the entry it came from", figures, "Workers (the RSC line)"),
    ]


def check_memberships(d: Data) -> list[dict]:
    suspended = [s for s in d.shown if any(str(r["fields"].get("btma_status") or "").lower() == "suspended" for r in d.of(s["id"], "BTMA"))]
    only = [s for s in suspended if s.get("is_published") and d.codes(s["id"]) == {"BTMA"}]
    serial = [s for s in d.published if d.of(s["id"], "BTMA")]
    return [
        finding("M1", "S1", "BTMA lists the mill under suspension; the page shows a plain BTMA membership",
                [d.page_slug(s) for s in suspended], "Memberships and Sources on the company page; the BTMA filter in search",
                f"{len(only)} of them are published on that entry alone."),
        finding("M2", "S2", "BTMA \"registration number\" is the mill's position in the list, not a membership number",
                serial, "Memberships on the company page (`btma_sl_no`)", "A serial number changes when the list is re-ordered."),
    ]


# ---------------------------------------------------------------------------
# E. Dates
# ---------------------------------------------------------------------------

def check_dates(d: Data) -> list[dict]:
    ages: dict[str, list[int]] = defaultdict(list)
    stale_rows = []
    for s in d.shown:
        for r in d.records[s["id"]]:
            read = _day(r.get("fetched_at"))
            if not read:
                continue
            age = (d.today - read).days
            ages[r["code"].split(" ")[0]].append(age)
            if age > STALE_DAYS:
                stale_rows.append(d.page_slug(s))
    table = "; ".join(
        f"{code}: oldest {max(a)}d, median {sorted(a)[len(a) // 2]}d, {sum(1 for x in a if x > STALE_DAYS)} of {len(a)} over {STALE_DAYS}d"
        for code, a in sorted(ages.items()))
    future = [d.page_slug(s) for s in d.shown for r in d.records[s["id"]] if (_day(r.get("fetched_at")) or d.today) > d.today]

    shapes, odd_year = Counter(), []
    for s in d.published:
        value = (s.get("established_date") or "").strip()
        if not value:
            continue
        shapes["year" if re.fullmatch(r"\d{4}", value) else "full date" if re.fullmatch(r"\d{4}-\d{2}-\d{2}", value) else "other"] += 1
        year = int(value[:4]) if re.match(r"\d{4}", value) else None
        if year is None or year < 1850 or year > d.today.year:
            odd_year.append(s)
    return [
        finding("E4", "S3", f"Entries last read more than {STALE_DAYS} days ago", stale_rows,
                "the \"read\" date beside each source (honest per row); the footer says \"updated\" with the newest read of any register",
                table, ),
        finding("E5", "S2", "An entry read on a date in the future", future, "the \"read\" date in Sources"),
        finding("E6", "S3", "Founding year missing a century, in the future or not a year", odd_year, "\"founded\" under the company name"),
        finding("I6", "S4", "Year founded is stored in two formats", [], "the Founded sort and filter", _tally(shapes.elements()), count=shapes["full date"]),
    ]


# ---------------------------------------------------------------------------
# F. Wrong company's data
# ---------------------------------------------------------------------------

def former_name(name: str) -> tuple[str, str]:
    """A register name as (current, former): RSC writes "New Ltd (Previously Old Ltd)"."""
    name = (name or "").replace("\u00a0", " ")
    m = re.search(r"[(\[\s]*[(\[]\s*previously\b(.*)$", name, re.I)
    return (name[: m.start()].strip(), m.group(1).strip(" ()[].")) if m else (name.strip(), "")


def same_company(company: str, entry_name: str) -> bool:
    """The repo's own rule for one company written two ways (`repair_bgmea_conflations._compatible`),
    tried against the entry's current name and its former one."""
    from ops.repair_bgmea_conflations import _compatible

    current, former = former_name(entry_name)
    mine, _ = former_name(company)
    return any(n and _compatible(mine, n) for n in (current, former))


def check_wrong_company(d: Data) -> list[dict]:
    holders: dict[tuple[str, str], set[str]] = defaultdict(set)
    for s in d.suppliers.values():
        for r in d.records[s["id"]]:
            if r["code"] in ONE_ENTRY_EACH:
                holders[(r["code"], entry_number(r["code"], r["source_ref"], r["fields"]))].add(s["id"])
    shared_same, shared_other, pairs = [], [], Counter()
    for (code, _), ids in holders.items():
        rows = [d.suppliers[i] for i in ids]
        if len(rows) < 2 or not any(r in d.shown for r in rows):
            continue
        if len(rows) == 2 and d.page_slug(rows[0]) == d.page_slug(rows[1]):
            continue  # a building beside its own company: one member, shown once
        differ = any(not same_company(a["company_name"], b["company_name"]) for a in rows for b in rows if a["id"] < b["id"])
        (shared_other if differ else shared_same).extend(d.page_slug(r) for r in rows if r in d.shown)
        pairs[(code, differ)] += 1

    renamed, rsc_names = [], []
    for s in d.shown:
        for r in d.of(s["id"], "RSC"):
            filed = r["fields"].get("rsc_factory_name") or ""
            if filed and not same_company(s["company_name"], filed):
                rsc_names.append(d.page_slug(s))
            elif former_name(filed)[1] and not same_company(s["company_name"], former_name(filed)[0]):
                renamed.append(d.page_slug(s))
    by_id = {v["supplier_id"]: v for v in d.volza}
    customs = [s for s in d.published if (v := by_id.get(s["id"])) and v.get("match_class") == "exact"
               and not same_company(s["company_name"], v.get("volza_supplier_name") or s["company_name"])]
    return [
        finding("F1", "S1", "One membership number on two differently named companies", shared_other,
                "Memberships on both company pages: one of each pair shows a number that is the other's",
                "; ".join(f"{code} {n} numbers" for (code, differ), n in sorted(pairs.items()) if differ)),
        finding("F1b", "S3", "One membership number on two profiles of the same name", shared_same,
                "two profiles for one member", "; ".join(f"{code} {n}" for (code, differ), n in sorted(pairs.items()) if not differ)),
        finding("F3", "S1", "A safety-register entry filed under a different company's name", rsc_names,
                "Safety and Sources on the company page",
                "By the repo's same-company rule. Sister concerns (X Textile holding X Apparels' entry) and units; read each."),
        finding("F3b", "S3", "The safety register now lists the factory under a new name", renamed,
                "the company name: the page still carries the name the register calls \"previously\""),
        finding("F4", "S1", "Customs figures matched to an exporter with a different name", customs,
                "Exports on the company record (signed in)"),
    ]


# ---------------------------------------------------------------------------
# G. Buildings
# ---------------------------------------------------------------------------

def check_buildings(d: Data) -> list[dict]:
    orphan, hidden, chained, both, member, claimed = [], [], [], [], [], []
    for b in d.buildings:
        parent = d.suppliers.get(b["facility_of"])
        if not parent:
            orphan.append(b)
            continue
        if parent.get("facility_of"):
            chained.append(b)
        elif not parent.get("is_published"):
            hidden.append(b)
        if b.get("is_published"):
            both.append(b)
        if b.get("claimed_by"):
            claimed.append(b)
        if d.codes(b["id"]) & {"BGMEA", "BKMEA", "BGAPMEA", "BTMA", "EPB"} and not same_company(parent["company_name"], b["company_name"]):
            member.append(parent)
    return [
        finding("G1", "S2", "A building whose company no longer exists", orphan, "nowhere: its certificates and safety entry are lost"),
        finding("G2", "S3", "A building of a company that is not published", hidden, "nowhere: neither row is on the site"),
        finding("G3", "S2", "A building of a building", chained,
                "nowhere: the company page lists only its direct buildings, so this one's safety entry and certificates are lost"),
        finding("G4", "S2", "A building that is also published as its own company", both, "search lists it twice: alone and inside its company"),
        finding("G5", "S3", "A building its owner has claimed", claimed, "the owner's portal edits a row buyers never open"),
        finding("G6", "S2", "A trade-body member under a different name, shown as a building of this company", member,
                "Memberships on the company page carries the other member's number, labelled with the building's name"),
    ]


# ---------------------------------------------------------------------------
# H. Kinds and categories
# ---------------------------------------------------------------------------

def check_kinds(d: Data) -> list[dict]:
    general_only, makes_things, associate_factory, bad_hs, repeated_hs = [], [], [], [], []
    for s in d.published:
        codes = {r["code"] for r in d.records[s["id"]]}
        if s.get("entity_type") == "buying_house":
            if "BGMEA" in codes and "BGMEA (associate)" not in codes:
                general_only.append(s)
            elif "RSC" in codes or (s.get("machines_sewing") or 0) > 0:
                makes_things.append(s)
        elif codes == {"BGMEA (associate)"}:
            associate_factory.append(s)
        for r in d.of(s["id"], "EPB"):
            lines = r["fields"].get("epb_hscodes") if isinstance(r["fields"].get("epb_hscodes"), list) else []
            listed = [str(x.get("code") or "").strip() for x in lines if isinstance(x, dict)]
            if any(not re.fullmatch(r"\d{4}(\d{2})?", c) or not 1 <= int(c[:2]) <= 97 or c[:2] == "77" for c in listed):
                bad_hs.append(s)
            if len(listed) != len(set(listed)):
                repeated_hs.append(s)
    cased = [s for s in d.published if any(t != t.strip() or t[:1].islower() or "_" in t for t in s.get("factory_types") or [])]
    repeats = [s for s in d.published
               for col in ("principal_products", "factory_types", "phones")
               if len({str(x).strip().lower() for x in s.get(col) or []}) < len(s.get(col) or [])]
    return [
        finding("H1", "S2", "Typed \"buying house\", holds only a manufacturer's BGMEA membership", general_only,
                "the kind under the company name, the Type filter", "Repair waits for the founder: ops/plans/bgmea-entity-type.md."),
        finding("H2", "S2", "Typed \"buying house\" with a safety-register entry or sewing machines", makes_things,
                "the kind under the company name, beside factory facts on the same page"),
        finding("H3", "S2", "Typed \"factory\", holds only a buying-house (associate) membership", associate_factory,
                "the kind under the company name, the Type filter"),
        finding("H4", "S3", "An export line that is not a real HS heading", bad_hs, "Export lines on the company page"),
        finding("H5", "S4", "The same export line listed twice in one entry", repeated_hs, "Export lines; the HS count"),
        finding("H6", "S4", "Factory type written in a second spelling", cased, "the Factory type filter splits one type into two",
                _tally(t for s in cased for t in s["factory_types"] if t[:1].islower() or "_" in t)),
        finding("H7", "S4", "The same value twice inside one list", repeats, "Products as filed; the phone count"),
    ]


# ---------------------------------------------------------------------------
# I. Spelling and shape
# ---------------------------------------------------------------------------

def check_shape(d: Data) -> list[dict]:
    spelled = [s for s in d.published if (s.get("district") or "").strip() and s["district"].strip() not in DISTRICTS]
    def name(s: dict) -> str:
        return s.get("company_name") or ""

    caps = [s for s in d.published if name(s).upper() == name(s) and re.search(r"[A-Z]{4}", name(s))]
    broken = [s for s in d.published if "�" in name(s) or re.search(r"Ã.|â€|\s{2,}|^\s|\s$|\[\s*\]", name(s))
              or name(s).count("(") != name(s).count(")")]
    trailing = [s for s in d.published if re.search(r"[,;:\-/&]\s*$", name(s))]
    suffix = [s for s in d.published
              if re.search(r"\b(ltd|limited)\b\.?\W+\b(ltd|limited)\b", name(s), re.I)]
    aside = [s for s in d.published if re.search(r"previously|formerly|a concern of|sister concern|c/o", name(s), re.I)]
    not_web = [s for s in d.published
               if (s.get("website") or "").strip() and not re.fullmatch(r"(https?://)?([\w-]+\.)+[a-z]{2,}(/\S*)?", s["website"].strip(), re.I)]
    hosts: dict[str, list[dict]] = defaultdict(list)
    for s in d.published:
        m = re.match(r"(?:https?://)?(?:www\.)?([\w.-]+\.[a-z]{2,})", (s.get("website") or "").strip().lower())
        if m:
            hosts[m.group(1)].append(s)
    crowded = {h: rows for h, rows in hosts.items() if len(rows) >= 6}
    abroad = [s for s in d.published if s.get("lat") is not None and s.get("lng") is not None
              and not (20.3 <= s["lat"] <= 26.8 and 87.9 <= s["lng"] <= 92.8)]
    return [
        finding("I1", "S4", "District not spelled as one of the 64 districts", spelled,
                "the District filter and its counts; the place under the company name",
                _tally((s["district"] for s in spelled), top=20)),
        finding("I2", "S4", "Company name stored in capitals", caps, "the browser tab title and search engines (the page heading re-cases it)"),
        finding("I3", "S4", "Name with a broken character, stray spaces or half a bracket", broken, "the company name everywhere"),
        finding("I4", "S4", "Name ending in punctuation", trailing, "the company name everywhere"),
        finding("I5", "S4", "Legal form written twice in the name", suffix, "the company name everywhere"),
        finding("I7", "S4", "A note inside the name (\"previously\", \"a concern of\")", aside, "the company name and its web address"),
        finding("I8", "S3", "Website field that is not a web address", not_web, "the website link (signed in, Growth and above)"),
        finding("I9", "S3", "One website on six or more companies", [s for rows in crowded.values() for s in rows],
                "the website link: a group site or a portal shown as the company's own", f"{len(crowded)} websites"),
        finding("I10", "S3", "Map pin outside Bangladesh", abroad, "the map and \"nearby\" results"),
        finding("I11", "S3", "No district", [s for s in d.published if not (s.get("district") or "").strip()],
                "the place under the company name; the District filter misses the company"),
        finding("I12", "S3", "No address", [s for s in d.published if not (s.get("address_raw") or "").strip()], "Sites on the company page"),
    ]


# ---------------------------------------------------------------------------
# J. Sanctions
# ---------------------------------------------------------------------------

def check_sanctions(d: Data) -> list[dict]:
    lists = defaultdict(lambda: {"entries": 0, "seen": ""})
    for e in d.list_entries:
        row = lists[e["list"]]
        row["entries"] += e.get("listing_status") == "listed"
        row["seen"] = max(row["seen"], str(e.get("last_seen_at") or e.get("fetched_at") or "")[:10])
    table = "; ".join(f"{name}: {v['entries']} listed, last seen {v['seen']}" for name, v in sorted(lists.items()))
    week_ago = d.today.fromordinal(d.today.toordinal() - 7)
    old = [name for name, v in lists.items() if _day(v["seen"]) is None or _day(v["seen"]) < week_ago]  # never seen is not fresh
    active = defaultdict(list)
    for m in d.screening:
        active[m["supplier_id"]].append(m)
    hit_unflagged, flagged_no_hit, cleared_blind, dropped = [], [], [], []
    for s in d.suppliers.values():
        hits = [m for m in active[s["id"]] if m.get("active")]
        if hits and not s.get("is_sanctioned") and not s.get("sanctions_cleared"):
            hit_unflagged.append(s)
        if s.get("is_sanctioned") and not hits:
            flagged_no_hit.append(s)
        if s.get("sanctions_cleared") and not (s.get("sanctions_cleared_reason") or "").strip():
            cleared_blind.append(s)
        if active[s["id"]] and not hits and not s.get("sanctions_cleared") and not (s.get("sanctions_cleared_reason") or "").strip():
            dropped.append(s)
    return [
        finding("J1", "S1", "A live sanctions match and no warning on the company", hit_unflagged, "every page of that company"),
        finding("J2", "S1", "Marked sanctioned with no live match behind it", flagged_no_hit, "the sanction warning"),
        finding("J3", "S2", "A match set aside with no reason recorded on the company",
                [s for s in dropped if s.get("is_published")] or dropped, "\"Not listed\" on the Sanctions tile",
                "The list still carries the entry; the match was switched off with no review date, reason or audit-log line."),
        finding("J4", "S2", "Cleared with no reason recorded", cleared_blind, "\"Not listed\" on the Sanctions tile"),
        finding("J5", "S3", "Sanctions lists not seen for more than a week", [], "\"Not listed\" is as of the day each list was read",
                table, count=len(old)),
        finding("J6", "S4", "Lists held against the \"5 lists\" the public figure counts", [], "`marketing_stats().sanctions_lists_screened`",
                f"{len(lists)} lists hold entries: {', '.join(sorted(lists))}. The figure counts five named sources, not lists read.",
                count=abs(len(lists) - 5)),
    ]


# ---------------------------------------------------------------------------
# K. What must never leak (the database half): contact details inside open text
# ---------------------------------------------------------------------------

def contact_shapes(text: str | None) -> list[str]:
    """Which kinds of contact detail a text carries. Never the detail itself."""
    return [kind for kind, pattern in _CONTACT_SHAPES.items() if text and pattern.search(text)]


def check_contact_text(d: Data) -> list[dict]:
    """`address_raw` is readable by a signed-out visitor straight from the database API
    (a column grant, and both public functions return it); the stripper runs only in the app."""
    in_address, in_entry_address, kinds = [], [], Counter()
    for s in d.shown:
        found = contact_shapes(s.get("address_raw"))
        if found and s.get("is_published"):
            in_address.append(s)
            kinds.update(found)
        for r in d.records[s["id"]]:
            if any(contact_shapes(v) for k, v in r["fields"].items() if "address" in k and isinstance(v, str)):
                in_entry_address.append(d.page_slug(s))
                break
    products = [s for s in d.published if any(contact_shapes(str(p)) for p in s.get("principal_products") or [])]
    return [
        finding("K1", "S1", "A phone, mailbox or web address inside the address text a signed-out visitor can read", in_address,
                "the database API (`suppliers.address_raw`, `discover_suppliers().primary_address`, `buyer_supplier_profile().supplier.address_raw`)",
                _tally(kinds.elements())),
        finding("K2", "S1", "The same inside a register entry's address, returned by the public profile function", in_entry_address,
                "the database API (`buyer_supplier_profile().addresses`)"),
        finding("K3", "S1", "The same inside the products list", products, "the database API and the company page (`principal_products`)"),
    ]


CHECKS = {
    "A": check_counts, "C": check_badges, "W": check_workers, "CERT": check_certificates, "RSC": check_safety,
    "M": check_memberships, "E": check_dates, "F": check_wrong_company, "G": check_buildings, "H": check_kinds,
    "I": check_shape, "J": check_sanctions, "K": check_contact_text,
}


def run(tables: dict[str, list[dict]], only: set[str] | None = None, today: date | None = None) -> list[dict]:
    d = Data(tables, today)
    out = [f for key, check in CHECKS.items() if not only or key in only for f in check(d)]
    return sorted(out, key=lambda f: (f["sev"], -f["count"], f["id"]))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cache", type=Path, default=None, help="directory holding (or to hold) a pull")
    parser.add_argument("--json", type=Path, default=None, help="write the findings here")
    parser.add_argument("--only", default="", help=f"comma-separated groups: {','.join(CHECKS)}")
    parser.add_argument("--all", action="store_true", help="print the checks that came back clean too")
    args = parser.parse_args()
    try:
        tables = load(args.cache)
    except Exception as exc:  # noqa: BLE001
        print(f"ERROR: could not read production: {exc}", file=sys.stderr)
        return 2
    findings = run(tables, {k.strip().upper() for k in args.only.split(",") if k.strip()} or None)
    published = sum(1 for s in tables["suppliers"] if s.get("is_published"))
    print(f"suppliers {len(tables['suppliers'])}; published {published}; register entries {len(tables['records'])}")
    for f in findings:
        if f["count"] or args.all:
            print(f"{f['sev']}  {f['id']:<5} {f['count']:>6}  {f['title']}")
            if f["examples"]:
                print(f"{'':20}{', '.join(f['examples'])}")
            if f["detail"] and f["count"]:
                print(f"{'':20}{f['detail']}")
    clean = [f["id"] for f in findings if not f["count"]]
    print(f"clean: {', '.join(clean)}")
    if args.json:
        args.json.write_text(json.dumps({"published": published, "findings": findings}, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())


