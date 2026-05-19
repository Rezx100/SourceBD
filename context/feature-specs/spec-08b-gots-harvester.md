# Spec 08b — GOTS certification harvester

> Tier-3 cert source. Follow-on to Spec 08 (WRAP + OEKO-TEX). Pure scraper add — **no schema migration**.

## Motivation

Pillar 3 of the SBI score (Certifications, max 30) currently only counts WRAP + OEKO-TEX because those are the only cert kinds with a live scraper. GOTS already exists in the formula (`+5` per active cert in `etl/scoring/sbi.py`), in the `cert_kind` enum (`'gots'`), and in `public.sources` (`GOTS`, `tier3_cert`) — but zero rows have ever landed. Ingesting GOTS lifts the Pillar-3 ceiling for the organic-textile slice of the corpus without touching schema, scorer, or trust hierarchy.

The Global Organic Textile Standard exposes its certified-supplier list as a public JSON API at `https://www.global-trace-base.org/website-api/v2/certified-suppliers` (no auth, no token). Probing returns **884** active BD-country suppliers as of 2026-05-19.

## Source

| Item | Value |
|---|---|
| Source code | `GOTS` (already seeded) |
| Tier | `tier3_cert` (already mapped in `_TIER_MAP`) |
| List endpoint | `GET https://www.global-trace-base.org/website-api/v2/certified-suppliers?limit=100&offset=N&country=BD` |
| Detail endpoint | `GET https://www.global-trace-base.org/website-api/v2/certified-suppliers/{system_id}` |
| Pagination | `limit` + `offset` query params, envelope `{items, limit, offset, total}` |
| BD filter | `country=BD` (ISO-2; `country=Bangladesh` is silently ignored) |

### List-view row schema

```
system_id        e.g. "SCO021512"   (stable, our source_ref anchor)
company_name     e.g. "Aaron Denim Limited"
country          e.g. "Bangladesh"
product_category comma-separated, e.g. "Dyed fabrics, Greige fabrics"
brand_names      string or null
```

### Detail-view extra fields

```
gtb_license_number     e.g. "GOTS-23594"   (our certificate_no)
cb_license_number      e.g. "USB 002105"   (certification-body's internal id)
address1 / address2 / address3
postcode / city / state
contact_name / contact_email
website
certification_body     e.g. "USB Certification"  → certifications.issuer
field_of_operation     e.g. "Dyeing, Finishing"
product_details        rich, e.g. "PC0039 / Cotton 100%"
certificate_valid_until ISO date, e.g. "2027-03-27"  → certifications.expires_on
scope_certificate_ref  path to PDF; concatenate with API host
```

## Implementation

### New file: `etl/scrapers/gots.py`

- Class `GotsScraper(BaseScraper)` with `code = "gots"`, `source_code = "GOTS"`.
- `fetch()` async iterator:
  1. Paginate the list endpoint with `limit=100`, walking `offset` until `offset+limit >= total`.
  2. For each list row, GET the detail endpoint to enrich.
  3. Polite throttle: `httpx.AsyncClient(timeout=60.0)` + `await asyncio.sleep(0.2)` between detail calls (≈5 RPS, ~3 min for 884 records).
  4. Yield one `ScrapedRecord` per supplier with:
     - `source_code="GOTS"`, `source_ref=f"gots-{system_id}"` (stable across cert renewals).
     - `company_name = detail["company_name"].strip()`
     - `city = detail.get("city") or None`
     - `address_raw` = stitched `address1 / address2 / address3` (skip blanks, ` | ` separated).
     - `website = detail.get("website") or None`
     - `email = detail.get("contact_email") or None`
     - `payload = {gots_system_id, gots_license_number, gots_cb_license_number, gots_certification_body, gots_field_of_operation, gots_product_category, gots_product_details, gots_brand_names, gots_scope_certificate_url, gots_postcode, gots_state, certificate_valid_until}`.
- `run()` override (mirrors `WrapScraper.run`): upsert supplier → call `_write_certification(supplier_id, rec)` → close the etl_run.
- `_write_certification` writes one `public.certifications` row:
  - `kind = 'gots'`
  - `certificate_no = payload["gots_license_number"]` (e.g. `GOTS-23594`); fall back to `f"gots-{system_id}"` if license missing.
  - `issuer = payload["gots_certification_body"]`
  - `expires_on = parse(payload["certificate_valid_until"])` (ISO date)
  - `scope` = concise compose of `field_of_operation` + `product_category` (`Operations: … | Products: …`).
  - `document_url = payload["gots_scope_certificate_url"]` if present (already absolute or join with API host).
  - `source_record_id` from the `source_records` row written in the same txn.
  - ON CONFLICT `(supplier_id, kind, certificate_no)` DO UPDATE — same shape as `wrap.py` / `oeko_tex.py`.

### Register in CLI

Add to `etl/cli.py` `SCRAPERS` dict: `"gots": GotsScraper`. New CLI: `etl run gots`.

### Scope filter

GOTS only certifies textile / apparel operations — no footwear, no pharma. No `_NON_RMG_CATEGORIES` filter needed. Keep all 884 BD rows.

## Tests

New file `etl/tests/test_gots.py`:

- Fixture: a captured list-response JSON (3 rows) and a captured detail-response JSON.
- `test_paginate_envelope`: walk a multi-page mock and confirm offset arithmetic terminates correctly at `total`.
- `test_address_compose`: 3-field address with blanks compresses to `addr1 | addr3`.
- `test_certificate_no_fallback`: when `gtb_license_number` is null, cert row uses `f"gots-{system_id}"`.
- `test_expires_parse`: `"2027-03-27"` → `date(2027, 3, 27)`; null / malformed → `None` (no crash).
- `test_scope_compose`: `field_of_operation + product_category` → `"Operations: Dyeing, Finishing | Products: Dyed fabrics"`.

## Deployment + run

1. `scp` `etl/scrapers/gots.py` + updated `etl/cli.py` to VPS.
2. `docker compose build etl` (the existing image; no new deps — uses `httpx` + `BeautifulSoup` already in base).
3. `docker compose run --rm --entrypoint python etl -m etl.cli run gots` (live, no dry-run flag — the dedup engine + idempotency key make re-runs safe).
4. After completion, backfill SBI for any supplier whose cert load changed:
   `docker compose run --rm --entrypoint python etl -m etl.cli sbi` (idempotent via `inputs_hash` — only re-scores suppliers whose canonical input blob changed).

## Acceptance criteria

1. **`public.certifications` gains rows where `kind = 'gots'`.** Expected ≈ 884 (one per BD supplier; multi-cert per supplier rare in GOTS).
2. **Cross-source merge** attaches a fraction of the GOTS suppliers onto existing register-source (BGMEA/BKMEA/RSC/EPB/BTMA/BGAPMEA) suppliers — measure and log the % merged-vs-cert-only.
3. **Tier-3 publish eligibility**: GOTS-only suppliers (no Tier-1/2 corroboration) are still publishable on their own (per the existing `tier3_cert` policy), same as WRAP-only / OEKO-only suppliers.
4. **Idempotent**: a second `run gots` invocation reports `seen=884`, `upserted` reflecting the dedup-engine upsert (some non-zero is fine because OEKO/WRAP already does this) but **zero new `certifications` rows** (the `ON CONFLICT (supplier_id, kind, certificate_no) DO UPDATE` is the safety net).
5. **SBI backfill** recomputes Pillar 3 for affected suppliers (typically nudges medians upward by +5 per GOTS-certed supplier).
6. **Tracker close-out**: row added to "Completed" + new row in the live metrics table for GOTS suppliers + GOTS certs.

## Out of scope

- BSCI / SEDEX-SMETA / SA8000 — queued as Specs 08c / 08d / 08e behind this spec. Each is a separate session.
- ISO 9001/14001/45001, BCI, GRS, RCS, Fairtrade — also in the "wired-but-not-ingested" set; not queued yet (lower priority than the three above for BD RMG).
- Cert-document mirroring to Bunny CDN (the `scope_certificate_ref` PDFs). The DB stores the public URL; mirroring is a separate follow-on if/when origin takedown risk warrants.
- Admin UI for any GOTS-specific review queue (no new queue type introduced; cert-only residual flows through the existing `fuzzy_match_review` queue per Spec 10).
- OCR of the GOTS scope certificate PDFs.

## Hard rules satisfied

- No new tool (uses `httpx` + stdlib already in `architecture.md`).
- No schema migration (existing `cert_kind` enum + `GOTS` source row + `tier3_cert` mapping).
- Source tier hierarchy respected — GOTS lands at `tier3_cert` and never overwrites Tier 1/2 fields on merge.
- Idempotency via `(supplier_id, kind, certificate_no)` UNIQUE + `(supplier_id, source_id, source_ref)` UNIQUE.
- Phase 0 / 0.5 already passed acceptance gate — this is a moat-breadth top-up, not a Phase 1 feature.
