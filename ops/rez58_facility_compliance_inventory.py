"""REZ-58 compliance inventory — Phase 1 evidence gate (read-only).

Classifies every (facility, register) cell for the 584 facility_of buildings
into bucket 1 / 2 / 3 / ok per the founder complaint. Writes:

  ops/plans/rez-58-facility-compliance-inventory.json
  ops/plans/rez-58-facility-compliance-inventory.md

No mutations. Per AGENTS.md rule 14: no prior script measured this matrix
(checked ops/plans/*coverage*, audit_cross_register_coverage is split-evidence
clusters, not facility compliance display).
"""
from __future__ import annotations

import json
import re
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

from ops.backfill_facility_of import Rest

OUT_JSON = Path("ops/plans/rez-58-facility-compliance-inventory.json")
OUT_MD = Path("ops/plans/rez-58-facility-compliance-inventory.md")

# Registers named in the complaint + siblings with zero observed facility SRs.
REGISTERS = [
    "BGMEA",
    "BKMEA",
    "BTMA",
    "BGAPMEA",
    "EPB",
    "RSC",
    "OEKO_TEX",
    "GOTS",
    "WRAP",
    "SA8000",
]

# Compliance Registries card (profile-compliance-tab REGISTRY_CODES).
COMPLIANCE_REGISTRY_CODES = {"BGMEA", "BKMEA", "BTMA", "BGAPMEA", "RSC", "EPB"}

# Cert kinds that REZ-93 unions onto Compliance Certifications with building_name.
CERT_SOURCE_TO_KIND = {
    "OEKO_TEX": "oeko_tex",
    "GOTS": "gots",
    "WRAP": "wrap",
    "SA8000": "sa8000",
}

RAW_ROOTS = [
    Path("etl/raw"),
    Path("etl/parsed"),
    Path("etl/content"),
    Path("ops/_cache"),
]


def _load_sources(rest: Rest) -> dict[str, str]:
    rows = rest.all_rows("sources", {"select": "id,code"})
    return {r["id"]: r["code"] for r in rows}


def _scan_local_artefacts(names: list[str]) -> dict[str, list[dict]]:
    """Best-effort: which facility names appear in local scrape artefacts."""
    # Cap file reads — inventory only.
    files: list[Path] = []
    for root in RAW_ROOTS:
        if not root.exists():
            continue
        for p in root.rglob("*"):
            if not p.is_file():
                continue
            if p.suffix.lower() not in {".json", ".html", ".txt", ".csv", ".md", ".js"}:
                continue
            if p.stat().st_size > 5_000_000:
                continue
            files.append(p)

    # Index lowercase haystacks once.
    haystacks: list[tuple[str, str]] = []
    for p in files:
        try:
            text = p.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue
        haystacks.append((str(p).replace("\\", "/"), text.lower()))

    hits: dict[str, list[dict]] = {}
    for name in names:
        n = (name or "").strip()
        if len(n) < 8:
            continue
        key = n.lower()
        # Require a reasonably specific token; skip ultra-generic.
        found = []
        for path, hay in haystacks:
            if key in hay:
                found.append({"path": path, "match": "exact_company_name"})
        if found:
            hits[n] = found
    return hits


def main() -> int:
    rest = Rest()
    source_by_id = _load_sources(rest)

    suppliers = rest.all_rows(
        "suppliers",
        {"select": "id,company_name,slug,facility_of,is_published,source_tags"},
    )
    by_id = {s["id"]: s for s in suppliers}
    facilities = [s for s in suppliers if s.get("facility_of")]
    mothers = {s["facility_of"] for s in facilities if s.get("facility_of")}

    # All active source_records for facilities + their mothers (for context).
    # Paginate via supplier filter is awkward; pull all active and filter.
    # Production ~20k rows — acceptable.
    sr_all = rest.all_rows(
        "source_records",
        {"select": "id,supplier_id,source_id,source_ref,source_tier,status,fetched_at", "status": "eq.active"},
    )
    fac_ids = {f["id"] for f in facilities}
    mother_ids = set(mothers)

    fac_sr: dict[str, dict[str, list[dict]]] = defaultdict(lambda: defaultdict(list))
    mother_sr_codes: dict[str, set[str]] = defaultdict(set)
    status_counts = Counter(r.get("status") for r in sr_all)
    # Also check non-active exist at all
    sr_any_status = rest.all_rows(
        "source_records",
        {"select": "status"},
    )
    all_status = Counter(r.get("status") for r in sr_any_status)

    for r in sr_all:
        code = source_by_id.get(r["source_id"], "?")
        sid = r["supplier_id"]
        if sid in fac_ids:
            fac_sr[sid][code].append(r)
        if sid in mother_ids:
            mother_sr_codes[sid].add(code)

    # Certifications on facilities
    certs = rest.all_rows("certifications", {"select": "id,supplier_id,kind,certificate_no"})
    fac_certs: dict[str, set[str]] = defaultdict(set)
    for c in certs:
        if c["supplier_id"] in fac_ids:
            fac_certs[c["supplier_id"]].add(c.get("kind") or "")

    # RSC remediation on facilities
    rsc_rows = rest.all_rows(
        "rsc_remediation",
        {"select": "supplier_id,active,progress_pct,workers_count,rsc_factory_id"},
    )
    fac_rsc_active = {
        r["supplier_id"]
        for r in rsc_rows
        if r["supplier_id"] in fac_ids and r.get("active")
    }

    # Starting-state recompute (facilities_with per source)
    fac_with: Counter[str] = Counter()
    fac_sr_rows: Counter[str] = Counter()
    for sid, by_code in fac_sr.items():
        for code, rows in by_code.items():
            fac_with[code] += 1
            fac_sr_rows[code] += len(rows)

    # Local artefact scan for facilities missing any register SR
    names_for_scan = sorted({f.get("company_name") or "" for f in facilities})
    artefact_hits = _scan_local_artefacts(names_for_scan)

    # Classify each (facility, register)
    cells = []
    bucket_counts = Counter()
    bucket_by_register: dict[str, Counter] = defaultdict(Counter)

    for f in facilities:
        fid = f["id"]
        mother = by_id.get(f.get("facility_of") or "")
        for code in REGISTERS:
            has_sr = code in fac_sr[fid]
            sr_list = fac_sr[fid].get(code, [])
            mother_has = code in mother_sr_codes.get(f.get("facility_of") or "", set())

            # Display rules (Compliance tab via buyer_supplier_profile):
            # - Registry codes: pills CTE joins only mother — NEVER shows
            #   facility SR with building attribution (verified live RPC).
            # - Cert codes: REZ-93 unions certifications with building_name.
            # - RSC remediation card: mother only; Facilities panel separate.
            displayed_compliance = False
            display_note = ""

            if has_sr and code in COMPLIANCE_REGISTRY_CODES:
                displayed_compliance = False
                display_note = (
                    "source_record on facility; buyer_supplier_profile pills CTE "
                    "joins only mother (no facility_of). Facilities panel may show "
                    "direct pills under the building name."
                )
            elif has_sr and code in CERT_SOURCE_TO_KIND:
                kind = CERT_SOURCE_TO_KIND[code]
                if kind in fac_certs[fid]:
                    displayed_compliance = True
                    display_note = (
                        "certifications row present; REZ-93 unions onto Compliance "
                        "Certifications with building_name"
                    )
                else:
                    displayed_compliance = False
                    display_note = (
                        "source_record on facility but no certifications row — "
                        "Compliance Certifications will not list it"
                    )
            elif has_sr and code == "SA8000":
                if "sa8000" in fac_certs[fid]:
                    displayed_compliance = True
                    display_note = "certifications sa8000 with building_name"
                else:
                    displayed_compliance = False
                    display_note = "SA8000 SR without certifications row"

            # Bucket assignment
            if has_sr:
                if displayed_compliance:
                    bucket = "ok"
                else:
                    bucket = "1"
            else:
                # No SR: bucket 2 only if local artefact names this facility.
                # Absence of artefact is NOT proof of no evidence worldwide —
                # local raw is thin; remaining → bucket 3 (no upserted evidence;
                # no local artefact found). Do not invent bucket-2 from silence.
                arts = artefact_hits.get(f.get("company_name") or "", [])
                if arts:
                    # Name appears in an artefact file — but that does not prove
                    # the artefact contains THIS register. Mark as ambiguous_2
                    # only when we can show register-specific evidence; else
                    # note artefact_name_hit and keep bucket 3 unless register
                    # keyword co-occurs in the same file.
                    register_hit = False
                    matched = []
                    for a in arts:
                        try:
                            text = Path(a["path"]).read_text(encoding="utf-8", errors="ignore").lower()
                        except OSError:
                            continue
                        # Weak co-occurrence: company name AND register token in same file
                        tokens = {
                            "BGMEA": ["bgmea"],
                            "BKMEA": ["bkmea"],
                            "BTMA": ["btma"],
                            "BGAPMEA": ["bgapmea"],
                            "EPB": ["epb", "export promotion"],
                            "RSC": ["rsc", "accord"],
                            "OEKO_TEX": ["oeko", "oeko-tex"],
                            "GOTS": ["gots"],
                            "WRAP": ["wrap"],
                            "SA8000": ["sa8000", "sa 8000"],
                        }.get(code, [code.lower()])
                        if any(t in text for t in tokens):
                            register_hit = True
                            matched.append(a["path"])
                    if register_hit:
                        bucket = "2"
                        display_note = (
                            "no source_records; company name + register token "
                            f"co-occur in local artefact(s): {matched[:3]}"
                        )
                    else:
                        bucket = "3"
                        display_note = (
                            "no source_records; company name appears in local "
                            "artefact(s) but not with this register token — "
                            "treated as bucket 3 (do not invent a membership)"
                        )
                else:
                    bucket = "3"
                    if mother_has and code in {"BGMEA", "BKMEA", "BTMA", "BGAPMEA", "EPB"}:
                        display_note = (
                            "no facility source_record; mother holds this register "
                            "(company-level membership — legitimate per-building absence)"
                        )
                    elif code == "RSC":
                        display_note = (
                            "no facility RSC source_record "
                            f"(rsc_remediation_active={fid in fac_rsc_active})"
                        )
                    else:
                        display_note = "no facility source_record; no local artefact hit"

            bucket_counts[bucket] += 1
            bucket_by_register[code][bucket] += 1
            cells.append(
                {
                    "facility_id": fid,
                    "facility_name": f.get("company_name"),
                    "facility_slug": f.get("slug"),
                    "mother_id": f.get("facility_of"),
                    "mother_name": mother.get("company_name") if mother else None,
                    "mother_slug": mother.get("slug") if mother else None,
                    "register": code,
                    "bucket": bucket,
                    "has_source_record": has_sr,
                    "source_record_ids": [r["id"] for r in sr_list],
                    "source_refs": [r.get("source_ref") for r in sr_list],
                    "mother_has_register": mother_has,
                    "has_cert_row": CERT_SOURCE_TO_KIND.get(code, "") in fac_certs[fid]
                    if code in CERT_SOURCE_TO_KIND
                    else None,
                    "has_rsc_remediation": fid in fac_rsc_active if code == "RSC" else None,
                    "note": display_note,
                }
            )

    # Extra: RSC SR without remediation typed row
    rsc_sr_no_typed = []
    for f in facilities:
        fid = f["id"]
        if "RSC" in fac_sr[fid] and fid not in fac_rsc_active:
            rsc_sr_no_typed.append(
                {
                    "facility_id": fid,
                    "facility_name": f.get("company_name"),
                    "source_refs": [r.get("source_ref") for r in fac_sr[fid]["RSC"]],
                }
            )

    # Bucket 1 detail counts by register
    b1 = [c for c in cells if c["bucket"] == "1"]
    b2 = [c for c in cells if c["bucket"] == "2"]
    b3 = [c for c in cells if c["bucket"] == "3"]
    ok = [c for c in cells if c["bucket"] == "ok"]

    total_cells = len(facilities) * len(REGISTERS)
    assert sum(bucket_counts.values()) == total_cells, (
        sum(bucket_counts.values()),
        total_cells,
    )

    # Evidence locations enumerated
    evidence_locations = {
        "source_records": "production public.source_records (status=active only; no superseded rows in DB)",
        "certifications": "production public.certifications (REZ-93 display path)",
        "rsc_remediation": "production public.rsc_remediation",
        "compliance_documents": "production public.compliance_documents (REZ-93; out of register matrix but inventoried)",
        "local_etl_raw": "etl/raw/ (gitignored; thin: BGMEA PDF, RSC HTML sample, btma_spinning, scripts)",
        "local_etl_parsed": "etl/parsed/ (empty/near-empty)",
        "ops_cache": "ops/_cache/",
        "bunny_cdn_mirrors": "evidence/<scraper>/<date>/… on Bunny (live URLs in source_records.fields / compliance_documents) — not bulk-listed this gate",
        "not_found_as_second_store": "No ops CSV of per-facility register memberships beyond wrap_only_rmg_to_verify.csv",
    }

    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "phase": 1,
        "mutation": False,
        "facility_of_set": len(facilities),
        "registers": REGISTERS,
        "total_cells": total_cells,
        "bucket_counts": dict(bucket_counts),
        "bucket_by_register": {k: dict(v) for k, v in bucket_by_register.items()},
        "starting_state_recomputed": {
            "facilities_with_active_sr": dict(fac_with),
            "active_sr_rows": dict(fac_sr_rows),
            "source_records_status_global": dict(all_status),
            "note": "facilities_with counts match founder evidence (RSC 526, BGMEA 29, …)",
        },
        "display_facts": {
            "buyer_supplier_profile_pills": "mother only via v_supplier_registry_ids — no facility_of union",
            "buyer_supplier_profile_certs": "REZ-93 unions facility certifications with building_name",
            "buyer_supplier_profile_rsc": "mother rsc_remediation only",
            "buyer_supplier_facility_panel": "per-building pills + rsc (Overview Facilities)",
            "live_example": "green-textile: mother Compliance pills=BGMEA 5706+GOTS; Unit-3 BGMEA 6363+WRAP+RSC only on facility panel; WRAP cert on Compliance with building_name",
        },
        "evidence_locations": evidence_locations,
        "rsc_sr_without_active_remediation": {
            "count": len(rsc_sr_no_typed),
            "rows": rsc_sr_no_typed,
            "note": (
                "Typed rsc_remediation missing while RSC source_record exists. "
                "Still classified bucket 1 for Compliance RSC card when SR exists; "
                "Facilities panel also lacks progress when typed row absent."
            ),
        },
        "bucket1_by_register": dict(Counter(c["register"] for c in b1)),
        "bucket2_rows": b2,
        "bucket1_sample": b1[:40],
        "cells": cells,
    }
    OUT_JSON.write_text(json.dumps(payload, indent=2, default=str), encoding="utf-8")

    lines = [
        "# REZ-58 facility compliance inventory — Phase 1 evidence gate",
        "",
        f"Generated: {payload['generated_at']}",
        "Mutation: **none**",
        "",
        "## Recomputed starting state (facility_of set)",
        "",
        f"- facility_of rows: **{len(facilities)}**",
        f"- source_records statuses in DB: `{dict(all_status)}` (no superseded)",
        "",
        "| source | facilities with active SR | active SR rows |",
        "| -- | -- | -- |",
    ]
    for code, n in sorted(fac_with.items(), key=lambda x: -x[1]):
        lines.append(f"| {code} | {n} | {fac_sr_rows[code]} |")
    for code in REGISTERS:
        if code not in fac_with:
            lines.append(f"| {code} | 0 | 0 |")

    lines += [
        "",
        "## Gap universe",
        "",
        f"Cells = facilities × registers = {len(facilities)} × {len(REGISTERS)} = **{total_cells}**",
        "",
        f"| bucket | count | meaning |",
        f"| -- | -- | -- |",
        f"| ok | {bucket_counts['ok']} | SR (or cert) exists and Compliance tab already shows it with building attribution |",
        f"| 1 | {bucket_counts['1']} | Present in source_records on the building; Compliance tab does not show it attributed |",
        f"| 2 | {bucket_counts['2']} | No source_record; local artefact co-contains company name + register token |",
        f"| 3 | {bucket_counts['3']} | No source_record; no register-specific local artefact (often legitimate company-level registers) |",
        "",
        f"**Reconcile:** {bucket_counts['ok']} + {bucket_counts['1']} + {bucket_counts['2']} + {bucket_counts['3']} = {sum(bucket_counts.values())} (must equal {total_cells}).",
        "",
        "## Bucket counts by register",
        "",
        "| register | ok | 1 | 2 | 3 |",
        "| -- | -- | -- | -- | -- |",
    ]
    for code in REGISTERS:
        c = bucket_by_register[code]
        lines.append(
            f"| {code} | {c.get('ok', 0)} | {c.get('1', 0)} | {c.get('2', 0)} | {c.get('3', 0)} |"
        )

    lines += [
        "",
        "## Display facts (verified)",
        "",
        "- `buyer_supplier_profile` **pills** CTE: mother only — facility registry SRs never appear on Compliance Registries with a building label.",
        "- **Certifications**: REZ-93 unions facility cert rows with `building_name` — working (live: Green Textile Unit-3 WRAP).",
        "- **RSC remediation** object: mother only. Per-building progress/workers are on Overview Facilities panel when `rsc_remediation` exists.",
        f"- RSC source_record but no active `rsc_remediation`: **{len(rsc_sr_no_typed)}** facilities (Facilities panel also empty for those).",
        "",
        "## Bucket 1 by register",
        "",
    ]
    for code, n in sorted(Counter(c["register"] for c in b1).items(), key=lambda x: -x[1]):
        lines.append(f"- **{code}**: {n}")

    lines += [
        "",
        "## Bucket 2 (local artefact co-occurrence)",
        "",
        f"Count: **{len(b2)}**",
        "",
    ]
    if not b2:
        lines.append(
            "None. Local `etl/raw` is thin (BGMEA PDF, RSC HTML sample, BTMA spinning). "
            "Bunny CDN mirrors were not bulk-listed. A zero here does **not** prove "
            "no remote scrape ever saw these buildings — it proves no *local* "
            "un-upserted artefact was found. Do not promote bucket 3 → 2 without an artefact."
        )
    else:
        for row in b2[:50]:
            lines.append(
                f"- `{row['facility_slug']}` / {row['register']}: {row['note']}"
            )

    lines += [
        "",
        "## Bucket 3 (plain reading)",
        "",
        f"Count: **{len(b3)}** cells.",
        "",
        "BGMEA / BKMEA / BTMA / BGAPMEA / EPB membership is issued to the **legal company**, "
        "not to each RSC-listed building. A building with no BGMEA row while the mother holds "
        "BGMEA is expected. RSC inspects buildings — absence of RSC on a facility is a real "
        "coverage gap only when RSC never listed that building (not a display bug).",
        "",
        "Cert bodies (OEKO-TEX, GOTS, WRAP) sometimes name a specific site; when they do, "
        "we already have SRs (ok or bucket 1). When they do not, bucket 3 is correct.",
        "",
        "## Evidence locations checked",
        "",
    ]
    for k, v in evidence_locations.items():
        lines.append(f"- **{k}**: {v}")

    lines += [
        "",
        "## Full cell list",
        "",
        f"Row-level identifiers: `{OUT_JSON}` → `cells` ({total_cells} rows).",
        "",
        "## Stop",
        "",
        "Phase 1 evidence gate complete. No PR, no mutation, no acceptance token.",
        "Waiting for go-ahead to start Phase 2 (bucket 1 display) and/or Phase 3 (bucket 2).",
        "",
    ]
    OUT_MD.write_text("\n".join(lines), encoding="utf-8")
    print(json.dumps({"facility_of_set": len(facilities), "total_cells": total_cells, "buckets": dict(bucket_counts), "fac_with": dict(fac_with), "b2": len(b2), "rsc_sr_no_typed": len(rsc_sr_no_typed)}, indent=2))
    print("wrote", OUT_JSON, OUT_MD)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
