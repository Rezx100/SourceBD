# Spec 16 — BTMA Spinning-Mills register ingestion

> Phase 0 data-backfill. Tier 2 industry register. Closes the long-standing
> Phase 0 deliverable from `phases.md` ("Python ETL workspace with parsers
> for: …, BTMA, …") that was wired in `_TIER_MAP` / `_ENTITY_TYPE_FOR` /
> `_REGISTER_TAGS` / `sbi.py` but never ingested.

## Source

Bangladesh Textile Mills Association (BTMA), spinning-mill register published
as a flat PDF at `https://btmadhaka.com`. The PDF is not a structured
download — the canonical structured form is the curated JSON extraction
produced from the PDF at:

```
C:\Users\Hp\Downloads\BTMA_extract\pages\page_01.json … page_34.json
```

528 rows across 4 sections:

| Section                                                       | Rows |
| ------------------------------------------------------------- | ---- |
| General Member                                                | 371  |
| Associate Member - A Spinning (Yarn Manufacturer)             | 65   |
| Mills Under Suspension                                        | 79   |
| Mills Under Suspension / Mills Under Implementation           | 13   |

All 528 rows are audited and typo-corrected (228 `needs_review` flags cleared
after manual verification; 23 in-data typos repaired; 35 audit notes
rewritten verbatim from "X retained verbatim" → "Source printed 'X';
corrected to 'Y'"). `needs_review=false` for every row.

Per-row schema (verbatim from the curated JSON):

```json
{
  "sl_no": "1",
  "mill_name": "A.T & T Spinning Mills Ltd.",
  "contact_person": "Md. Mukhlesur Rahman",
  "head_office": "60 (Old), 86 (New), Bangabandhu Road, Narayanganj.",
  "mill_site": "Jamairdia Masterbari, Valuka, Mymensingh.",
  "telephone": "7633811, 7645958, 7634008; 880-2-7634003",
  "fax": "8836347, 8836763-64",
  "email": "masud@nrggroup-bd.com; www.nrggroup.com",
  "installed_capacity": "22800 Spindles; 10 Autocone",
  "annual_production": "5790888 Kgs.",
  "needs_review": false,
  "notes": ""
}
```

## Trust tier

`BTMA` → `tier2_industry` (already mapped in `etl/core/upsert.py::_TIER_MAP`,
already seeded as a row in `public.sources` by migration 0001 line 59,
already weighted +2 in SBI Pillar 1 via `etl/scoring/sbi.py::_REGISTER_TAGS`).
`entity_type` default = `factory` (`_ENTITY_TYPE_FOR['BTMA']`).

## Files to add

1. `etl/raw/btma_spinning/pages/page_01.json … page_34.json` — staged copy of
   the curated source (gitignored under `etl/raw/`; VPS copy via scp).
2. `etl/scrapers/btma_spinning.py` — `BtmaSpinningScraper(BaseScraper)`.
3. `etl/tests/test_btma_spinning.py` — pure-helper unit tests + small JSON
   fixture under `etl/tests/fixtures/btma/`.
4. `etl/tests/fixtures/btma/page_01_excerpt.json` — 3-row fixture.
5. `supabase/migrations/0015_btma_address_branches.sql` — extends
   `v_supplier_addresses_direct` so the BTMA `factory_address` and
   `mailing_address` payload keys surface as `address_kind = 'factory'` and
   `'mailing'` respectively, mirroring the BGMEA / BKMEA pattern. Existing
   `registered` fallback branch (`fields.address` / `fields.raw_address`)
   is preserved for BGAPMEA + any future BTMA row that only carries the
   collapsed address form.
6. CLI registration in `etl/cli.py` (`btma_spinning` entry).

## Field mapping (XLSX/JSON → `ScrapedRecord`)

| Source field        | Destination                                                                 |
| ------------------- | --------------------------------------------------------------------------- |
| `mill_name`         | `company_name` (also `clean_display_name`'d)                                |
| `contact_person`    | `contact_name`; role-in-parens extracted to `contact_role` when present     |
| `head_office`       | `payload.mailing_address`; mirrored into `address_raw` if no `mill_site`    |
| `mill_site`         | `payload.factory_address`; preferred for `address_raw` + `city`/`district`  |
| `telephone`         | `phone_raw` (normalized by existing `normalize_phones`)                     |
| `fax`               | `payload.raw_fax` (no canonical column; preserved verbatim)                 |
| `email`             | first valid email → `email`; full string → `payload.raw_email`; URLs in    |
|                     | this field (e.g. `www.nrggroup.com`) → `website`                            |
| `installed_capacity`| `payload.installed_capacity` (free-text — "22800 Spindles; 10 Autocone")   |
| `annual_production` | `payload.annual_production` (free-text — "5790888 Kgs.")                   |
| `section`           | `payload.btma_section`                                                      |
| `sl_no`             | `payload.btma_sl_no`; used in `source_ref`                                  |
| `notes`             | `payload.btma_notes` (only when non-empty)                                  |

Derived:
- `source_ref = f"spinning-{section_slug}-{sl_no}"` — stable across re-runs.
- `payload.btma_status = "suspended"` for rows in any section whose name
  contains "Suspension" or "Implementation" (matches "Mills Under
  Suspension" and "Mills Under Suspension / Mills Under Implementation"). Suspended rows are loaded
  (suspension is itself useful evidence — buyers want to know) but the
  publish-eligibility trigger only fires `is_published=true` when Tier 1–3
  evidence exists, which BTMA satisfies on its own; suspended status is
  carried in `payload` only and rendered as a profile banner in Phase 1+
  surfaces (no UI work in this spec).
- `city` / `district` are inferred from `mill_site` via the existing
  `_detect_city`-style keyword table (lifted into a small private helper in
  the scraper module; do NOT modify `etl/core/normalize.py`).

## Idempotency

- Existing `source_records (supplier_id, source_id, source_ref)` UNIQUE +
  sha256 `raw_hash` (see `etl/core/scraper.py::ScrapedRecord.hash`).
- 4-pass dedup (slug → email → phone → fuzzy name ≥92) in
  `etl/core/upsert.py::_find_existing` auto-merges BTMA rows onto existing
  BGMEA / BKMEA / RSC / EPB / WRAP / OEKO-TEX / GOTS / SA8000 suppliers.
- Re-runs must converge: `seen=528`, `upserted=528`, 0 new rows in
  `public.suppliers`, 0 new rows in `public.source_records` after the first
  run.

## Migration 0015 (view-only)

`v_supplier_addresses_direct` currently exposes BTMA via a single
`registered` branch reading `fields.address` / `fields.raw_address`. This
spec's payload uses `mailing_address` + `factory_address`. The migration
adds two BTMA branches (factory, mailing) **before** the existing fallback
branch, keeps the fallback for any BTMA row that lacks the structured keys,
and preserves `v_supplier_addresses` = direct ∪ inherited (Spec 0014
behaviour unchanged). Drop / re-create is the only safe path because the
view is referenced by `v_supplier_address_summary`.

Reversibility: apply 0014 again (it has `create or replace view` and the
column list of the new view is identical, so dropping 0015 = re-running
0014). No `suppliers` or `source_records` writes.

## Cross-source merge expectations (dry-run report)

The dry-run must print, before any DB write in non-dry mode:

- Total rows parsed (expected: 528).
- Per-section row count (expected: 371 / 65 / 79 / 13).
- Existing-supplier matches via slug (exact match on normalized BTMA
  mill_name → existing supplier slug).
- Existing-supplier matches via email or phone overlap.
- Fuzzy candidates ≥85 (these would land in `verification_queue` as
  `fuzzy_match_review` per the auto-merge-off policy from Spec 08 (e)).
- Net-new supplier count (no existing match).
- Per-source overlap (BGMEA / BKMEA / RSC / EPB / WRAP / OEKO-TEX / GOTS /
  SA8000) on the matched set.

The flag is `--dry-run`; default is real ingest.

## Tests (`etl/tests/test_btma_spinning.py`)

Pure helpers, no network, no DB:

1. `test_section_slug_basic` — "General Member" → "general-member".
2. `test_parse_contact_role` — "Solaiman Ahmed (MD)" → ("Solaiman Ahmed",
   "MD"); plain name → (name, None).
3. `test_split_email_and_website` — "kmsaa@aaholdings.net;
   www.nrggroup.com" → (email="kmsaa@aaholdings.net",
   website="https://www.nrggroup.com").
4. `test_split_email_multiple` — "a@x.com; b@y.com" → first email +
   payload preserved.
5. `test_btma_status_suspended_for_two_sections` — "Mills Under Suspension"
   and "Suspension / Implementation" → status=suspended; other sections →
   status=None.
6. `test_detect_city_dhaka_district` — "Sreepur, Gazipur" → city=Gazipur,
   district=Gazipur.
7. `test_load_page_yields_rows` — 3-row fixture parses to 3
   `ScrapedRecord`s with expected `source_ref` values and payload keys.
8. `test_source_ref_stable` — same input → same `source_ref` (no time / hash
   dependency).

## CLI

```
python -m etl.cli run btma_spinning
python -m etl.cli run btma_spinning --dry-run   # match report only
```

## Acceptance

- 528 rows ingested. `public.source_records WHERE source_id=(BTMA)` count = 528.
- `public.suppliers` carries the `BTMA` source tag on every matched row.
- Cross-merge attaches ≥10% of BTMA rows onto existing register-source
  suppliers (BTMA spinning mills overlap heavily with BGMEA / BKMEA / RSC
  factories that also weave or knit; ≥10% is a conservative floor).
- Second-run idempotency: `seen=528`, 0 net new supplier rows, 0 net new
  source_records rows.
- SBI backfill on the affected supplier set lifts Pillar 1 by +2 for each
  newly-BTMA-tagged supplier (capped at the Pillar 1 ceiling of 25).
- `v_supplier_addresses` exposes both `factory` and `mailing` rows for
  every BTMA supplier that has both `mill_site` and `head_office`.

## Out of scope

- BGAPMEA register (separate Phase 0 backlog item; same shape but different
  source — not in this spec).
- BTMA non-spinning member categories (weaving, dyeing-finishing) — the
  spinning register is what was extracted from the source PDF; other BTMA
  member categories ship as separate specs if they ever land in structured
  form.
- UI work — Phase 1+ profile surfaces show factory vs mailing address
  separately as soon as `v_supplier_addresses` carries the rows.
- `payload.btma_status='suspended'` rendering as a banner — Phase 1+ UI.
- OCR / re-parse of the source PDF — the curated JSON is the contract.
