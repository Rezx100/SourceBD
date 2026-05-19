# Spec 08e — SA8000 certification harvester

> Tier-3 cert source. Follow-on to Spec 08b (GOTS). Adds one seed migration (`0013_seed_sa8000_source.sql`) — `cert_kind` enum already had `'sa8000'`, `_CERT_POINTS['sa8000']=5` already wired in `etl/scoring/sbi.py`.

## Motivation

Pillar 3 of the SBI score weights `'sa8000'` at `+5` per active cert but no scraper has ever landed rows. SA8000 is a top-three social-compliance cert globally (Social Accountability International, SAAS-accredited CBs) and the BD-active certificates — though few — sit on flagship suppliers (SQ Group, Dutch-Bangla Pack, Shabab Fabrics) where additional Tier-3 corroboration is high signal.

Discovery (5 probes) confirmed the public surface is `https://sa-intl.org/sa8000-search/`, an SPA built on the WordPress plugin `cwp-sa8000-search`. The plugin exposes two unauthenticated AJAX endpoints on `admin-ajax.php` that return everything the dashboard renders — no token, no nonce, no Playwright.

**Actual BD count**: 7 total / 4 active "Certified" / 3 "Withdrawn/cancelled" (as of 2026-05-19). The queue entry's optimistic ≈40-80 estimate was wrong; reality is small but the endpoint cost is even smaller (~80 LoC).

## Source

| Item | Value |
|---|---|
| Source code | `SA8000` (seeded by `0013_seed_sa8000_source.sql`) |
| Tier | `tier3_cert` (added to `_TIER_MAP` in this spec) |
| List endpoint | `GET https://sa-intl.org/wp-admin/admin-ajax.php?action=cwp_get_results&Country=Bangladesh&Industry=&Certification_status=&Certified_Organization=&Certification_ID=&Description%20of%20Operations=&City=&CB=&direct=0` |
| Detail endpoint | `POST https://sa-intl.org/wp-admin/admin-ajax.php` with form body `action=get_popup_content&id=<data-pop>` |
| Pagination | None — single response returns the full BD list (HTML `<table>`); pagination is client-side in the SPA. |
| Country filter | `Country=Bangladesh` (full name; dropdown driven by the table values). |

### List response shape (HTML)

```html
<p class="st">Found <b>7</b> matching results</p>
<a href="…export_results…direct=0" class="exr form">Export</a>
<table class="ui-sortable-table table table-bordered table-striped">
  <thead><tr>
    <th>Organization Name</th><th>Certification Body</th><th>Certificate ID</th>
    <th>Certification status</th><th>Industry</th><th># of Workers</th><th></th>
  </tr></thead>
  <tbody>
    <tr class="pages page-1 display">
      <td>Dutch-Bangla Pack Ltd.</td>
      <td>Bureau Veritas Certification</td>
      <td>IND.23.15506/SA/S</td>
      <td>Certified</td>
      <td>Consumer Goods: (A5) Household & Personal Products</td>
      <td>1095</td>
      <td><a class="ab-button ab-button-shape-rounded" data-pop="4321">More Info</a></td>
    </tr>
    …
  </tbody>
</table>
```

### Detail response shape (JSON envelope wrapping HTML fragment)

```json
{"success": true, "data": "<ul>
  <li><b>Certified Organization:</b> Dutch-Bangla Pack Ltd.</li>
  <li><b>Certification Body:</b> Bureau Veritas Certification</li>
  <li><b>Certificate ID number:</b> IND.23.15506/SA/S</li>
  <li><b>Certification Status:</b> Certified</li>
  <li><b>Industry:</b> Consumer Goods: (A5) Household & Personal Products</li>
  <li><b>Address:</b> 10th floor, Navana DH Tower 6 Panthapath, 6 Panthapath, Dhaka, 1215, Bangladesh</li>
  <li><b>Initial Certification Date:</b> 2020-07-10</li>
  <li><b>Latest Certification Date:</b> 2023-07-09</li>
  <li><b>Expiration Date:</b> 2026-07-08</li>
  <li><b>Withdrawal Date:</b> 2021-06-11</li>   <!-- only when status is Withdrawn/cancelled -->
</ul><p><b>Description of Operations:</b> Manufacturing and marketing of …</p>"}
```

The address is freeform, comma-separated, but the last three comma-tokens are reliably `City, Postcode, Country`. We extract `city` from the second-to-last token-pair and keep the full string in `address_raw`.

## Implementation

### Migration: `supabase/migrations/0013_seed_sa8000_source.sql`

Single `insert ... on conflict (code) do nothing` row:

```sql
insert into public.sources (code, display_name, tier, base_url) values
  ('SA8000', 'SAAS SA8000 Certified Organisations Directory',
   'tier3_cert', 'https://sa-intl.org/sa8000-search/')
on conflict (code) do nothing;
```

### `_TIER_MAP` addition

`etl/core/upsert.py::_TIER_MAP` gains `"SA8000": "tier3_cert"` alongside the existing `WRAP / OEKO_TEX / GOTS` entries.

### New file: `etl/scrapers/sa8000.py`

- Class `Sa8000Scraper(BaseScraper)` with `code = "sa8000"`, `source_code = "SA8000"`.
- `fetch()` async iterator:
  1. GET the list endpoint once with `Country=Bangladesh`. Parse the response HTML with BeautifulSoup; iterate `<tr class="pages …">` rows.
  2. From each row, extract: org name (col 0), certification body (col 1), certificate ID (col 2), status (col 3), industry (col 4), worker count (col 5), `data-pop` id (col 6 anchor). Skip rows with no `data-pop` or no org name.
  3. POST `get_popup_content` for the `data-pop` id. Parse `data["data"]` as HTML and walk the `<ul><li>` items into a `{label: value}` dict. Also grab the `<p>` "Description of Operations" tail.
  4. Polite throttle: `await asyncio.sleep(0.3)` between popup calls (~7 calls total for BD; ~2 s wall).
  5. Yield `ScrapedRecord` per row with `source_code="SA8000"`, `source_ref=f"sa8000-{certificate_id_slug}"` where `certificate_id_slug` lowercases the raw cert ID and replaces `/` and `.` with `-` (stable across renewals — SAAS issues a new cert ID per renewal cycle, but for our 1-per-supplier-cert model we key on the active cert ID; idempotent re-runs of the same cert ID are no-ops via the `(supplier_id, source_id, source_ref)` UNIQUE).
- `run()` override (mirrors `WrapScraper.run` / `GotsScraper.run`): upsert supplier → call `_write_certification(supplier_id, rec)` → close the `etl_run`.
- `_write_certification` writes one `public.certifications` row:
  - `kind = 'sa8000'`
  - `certificate_no = <raw certificate ID>` (e.g. `IND.23.15506/SA/S`)
  - `issuer = <certification body>` (e.g. `Bureau Veritas Certification`)
  - `issued_on = parse(payload["latest_certification_date"])` (fall-back: `initial_certification_date`).
  - `expires_on = parse(payload["expiration_date"])`
  - `scope = "<industry> | Status: <status>"` (and ` | Withdrawn: <date>` suffix when applicable).
  - `document_url = "https://sa-intl.org/sa8000-search/"` (no per-cert PDF surface; the search page is the canonical evidence entry point).
  - `source_record_id` from the `source_records` row written in the same txn.
  - ON CONFLICT `(supplier_id, kind, certificate_no)` DO UPDATE — same shape as `wrap.py` / `gots.py`.

### Status semantics

Both `Certified` and `Withdrawn/cancelled` rows are ingested. The status is preserved in `payload.sa8000_status` and stamped onto `certifications.scope`. SBI scoring already requires `expires_on >= today` to award the `+5` (see `etl/scoring/sbi.py` Pillar-3 logic), so withdrawn rows with past expiry naturally score zero.

### Register in CLI

Add to `etl/cli.py` `SCRAPERS` dict: `"sa8000": Sa8000Scraper`. New CLI: `etl run sa8000`.

## Tests

New file `etl/tests/test_sa8000.py`:

- `test_parse_list_row`: 1-row HTML fixture → expected `(org_name, cb, cert_id, status, industry, workers, data_pop)`.
- `test_parse_popup_ul`: popup `<ul><li><b>Field:</b> value</li>…</ul>` fixture → expected dict keying on canonical labels.
- `test_extract_city`: address `"… DOHS Baridhara, Dhaka-1206, Bangladesh"` → `"Dhaka-1206"`; address `"…, Mymensingh, N/A, 2240, Bangladesh"` → `"Mymensingh"`; empty / no commas → `None`.
- `test_certificate_no_slug`: `"IND.23.15506/SA/S"` → `"ind-23-15506-sa-s"`.
- `test_parse_expires`: `"2026-07-08"` → `date(2026,7,8)`; null/malformed → `None`.

## Deployment + run

1. `scp` `etl/scrapers/sa8000.py`, updated `etl/cli.py`, updated `etl/core/upsert.py`, and the new migration `supabase/migrations/0013_seed_sa8000_source.sql` to VPS.
2. `docker compose run --rm --entrypoint python etl -m etl.cli migrate` (applies 0013).
3. `docker compose build etl` (existing image; no new deps).
4. `docker compose run --rm --entrypoint python etl -m etl.cli run sa8000` (live, no dry-run flag; dedup engine + idempotency key make re-runs safe).
5. After completion, `docker compose run --rm --entrypoint python etl -m etl.cli sbi` to refresh Pillar 3 for affected suppliers.

## Acceptance criteria

1. `public.certifications` gains ~7 rows where `kind = 'sa8000'` (4 active, 3 withdrawn).
2. Cross-source merge attaches a portion of the SA8000 rows onto existing register-source (BGMEA/BKMEA/RSC/EPB) supplier rows during ingest. Measure the merged-vs-cert-only split and log it.
3. Idempotent: a second `run sa8000` reports `seen=7`, **zero new `certifications` rows** (ON CONFLICT path).
4. SBI backfill recomputes Pillar 3 for the affected suppliers; expected nudge: `+5` per active SA8000 cert on suppliers whose Pillar-3 cap was not previously saturated.
5. Tracker close-out: row added to "Completed" + new row in the live metrics table for SA8000 suppliers + SA8000 certs.

## Out of scope

- Other countries — `Country=Bangladesh` only.
- The "all countries" CSV export (the `direct=1` `exr.form` path triggers a Gravity Forms gate followed by a CSV; not needed since BD is in scope and the HTML table already carries everything).
- Mirroring popup HTML to Bunny CDN — no per-cert PDF exists; mirroring the canonical SAAS site is unnecessary.
- ISO 9001/14001/45001, GRS, RCS, Fairtrade, BCI — also wired-but-not-ingested in `_CERT_POINTS`; not queued.
- Admin UI changes — cert-only residual flows through the existing `fuzzy_match_review` queue (Spec 10).

## Hard rules satisfied

- No new tool (uses `httpx` + `BeautifulSoup` from existing `architecture.md`).
- Single seed-only SQL migration; no schema changes.
- Source tier hierarchy respected — SA8000 lands at `tier3_cert` and never overwrites Tier 1/2 fields on merge.
- Idempotency via `(supplier_id, kind, certificate_no)` UNIQUE + `(supplier_id, source_id, source_ref)` UNIQUE.
- Phase 0 acceptance gate already passed — this is a moat-breadth top-up.
- One spec per session.
