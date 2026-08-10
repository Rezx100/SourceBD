# REZ-58 facility compliance inventory — Phase 1 evidence gate

Generated: 2026-08-10T02:34:52.304691+00:00
Mutation: **none**

## Recomputed starting state (facility_of set)

- facility_of rows: **584**
- source_records statuses in DB: `{'active': 20225}` (no superseded)

| source | facilities with active SR | active SR rows |
| -- | -- | -- |
| RSC | 526 | 567 |
| BGMEA | 29 | 29 |
| OEKO_TEX | 18 | 20 |
| BKMEA | 11 | 24 |
| WRAP | 10 | 14 |
| BRAND_HM | 10 | 10 |
| GOTS | 10 | 10 |
| BRAND_MS | 7 | 8 |
| BRAND_NEXT | 2 | 2 |
| EPB | 1 | 2 |
| BTMA | 0 | 0 |
| BGAPMEA | 0 | 0 |
| SA8000 | 0 | 0 |

## Gap universe

Cells = facilities × registers = 584 × 10 = **5840**

| bucket | count | meaning |
| -- | -- | -- |
| ok | 38 | SR (or cert) exists and Compliance tab already shows it with building attribution |
| 1 | 567 | Present in source_records on the building; Compliance tab does not show it attributed |
| 2 | 0 | No source_record; local artefact co-contains company name + register token |
| 3 | 5235 | No source_record; no register-specific local artefact (often legitimate company-level registers) |

**Reconcile:** 38 + 567 + 0 + 5235 = 5840 (must equal 5840).

## Bucket counts by register

| register | ok | 1 | 2 | 3 |
| -- | -- | -- | -- | -- |
| BGMEA | 0 | 29 | 0 | 555 |
| BKMEA | 0 | 11 | 0 | 573 |
| BTMA | 0 | 0 | 0 | 584 |
| BGAPMEA | 0 | 0 | 0 | 584 |
| EPB | 0 | 1 | 0 | 583 |
| RSC | 0 | 526 | 0 | 58 |
| OEKO_TEX | 18 | 0 | 0 | 566 |
| GOTS | 10 | 0 | 0 | 574 |
| WRAP | 10 | 0 | 0 | 574 |
| SA8000 | 0 | 0 | 0 | 584 |

## Display facts (verified)

- `buyer_supplier_profile` **pills** CTE: mother only — facility registry SRs never appear on Compliance Registries with a building label.
- **Certifications**: REZ-93 unions facility cert rows with `building_name` — working (live: Green Textile Unit-3 WRAP).
- **RSC remediation** object: mother only. Per-building progress/workers are on Overview Facilities panel when `rsc_remediation` exists.
- RSC source_record but no active `rsc_remediation`: **44** facilities (Facilities panel also empty for those).

## Bucket 1 by register

- **RSC**: 526
- **BGMEA**: 29
- **BKMEA**: 11
- **EPB**: 1

## Bucket 2 (local artefact co-occurrence)

Count: **0**

None. Local `etl/raw` is thin (BGMEA PDF, RSC HTML sample, BTMA spinning). Bunny CDN mirrors were not bulk-listed. A zero here does **not** prove no remote scrape ever saw these buildings — it proves no *local* un-upserted artefact was found. Do not promote bucket 3 → 2 without an artefact.

## Bucket 3 (plain reading)

Count: **5235** cells.

BGMEA / BKMEA / BTMA / BGAPMEA / EPB membership is issued to the **legal company**, not to each RSC-listed building. A building with no BGMEA row while the mother holds BGMEA is expected. RSC inspects buildings — absence of RSC on a facility is a real coverage gap only when RSC never listed that building (not a display bug).

Cert bodies (OEKO-TEX, GOTS, WRAP) sometimes name a specific site; when they do, we already have SRs (ok or bucket 1). When they do not, bucket 3 is correct.

## Evidence locations checked

- **source_records**: production public.source_records (status=active only; no superseded rows in DB)
- **certifications**: production public.certifications (REZ-93 display path)
- **rsc_remediation**: production public.rsc_remediation
- **compliance_documents**: production public.compliance_documents (REZ-93; out of register matrix but inventoried)
- **local_etl_raw**: etl/raw/ (gitignored; thin: BGMEA PDF, RSC HTML sample, btma_spinning, scripts)
- **local_etl_parsed**: etl/parsed/ (empty/near-empty)
- **ops_cache**: ops/_cache/
- **bunny_cdn_mirrors**: evidence/<scraper>/<date>/… on Bunny (live URLs in source_records.fields / compliance_documents) — not bulk-listed this gate
- **not_found_as_second_store**: No ops CSV of per-facility register memberships beyond wrap_only_rmg_to_verify.csv

## Full cell list

Row-level identifiers: `ops\plans\rez-58-facility-compliance-inventory.json` → `cells` (5840 rows).

## Brand attributions (extra — not in register matrix)

Facility active brand source_records: BRAND_HM 10, BRAND_MS 7, BRAND_NEXT 2.
`buyer_supplier_profile` brands CTE joins mother only → these **19 facility-held brand rows** are the same class as bucket 1 (present, not on Compliance Brand attribution with a building label). Row IDs are in `source_records` for those suppliers; full list regenerable from the script.

## Stop

Phase 1 evidence gate complete. No PR, no mutation, no acceptance token.
Waiting for go-ahead to start Phase 2 (bucket 1 display) and/or Phase 3 (bucket 2).
