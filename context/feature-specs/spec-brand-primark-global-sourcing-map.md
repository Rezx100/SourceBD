# Spec — retarget `brand_primark` at the Global Sourcing Map

Status: **queued** (raised 29 Jul 2026 by the Firecrawl transport parity sweep)
Owner: unassigned
Depends on: nothing. Independent of the Firecrawl acquisition PR.

## Why

`brand_primark` parses the wrong document. It reads Primark's **Modern Slavery
Statement**, which is narrative prose about their due-diligence programme, so the
factory-row parser correctly extracts nothing from it. The live sweep recorded
`bd_rows: 0` from an 810KB… (7.8MB) PDF that had downloaded and mirrored fine.

Zero rows was previously silent. The scraper fetched, parsed, yielded nothing and
reported success, so the source looked healthy while contributing no suppliers.
That silence is now closed: `BrandDisclosureBase._require_rows` refuses a
disclosure that parses to no Bangladesh rows, so `brand_primark` fails loudly
until this spec lands. It is safe to leave failing — it is not silently wrong.

## What Primark actually publishes

The factory-level list is the **Global Sourcing Map**, not the Modern Slavery
Statement:

- Landing page: `https://globalsourcingmap.primark.com/`
- Covers tier one factories, roughly 95% of product sold.
- Each entry carries factory name, site address, worker count and gender split —
  which maps onto the same fields the other brand disclosures populate.
- Published as an interactive map **with an Excel download**, refreshed annually.
- The Modern Slavery Statement cites this map as its own source for factory
  figures, which is the clearest confirmation that the map is the primary record
  and the statement is downstream commentary.

## Scope

1. Point `BrandPrimarkScraper.landing_url` at the Global Sourcing Map and find the
   Excel export link. Expect the link to be client-side rendered: the map is an
   interactive app, so `wait_for_ms` or a Firecrawl action may be needed, and the
   export may sit behind a button rather than an `<a href>`.
2. Write the workbook parser. Reuse `parse_bytes` if the sheet is conventional;
   otherwise add a Primark-specific reader beside `parse_next_t1_pdf`.
3. Filter to Bangladesh and emit the standard brand-disclosure fields:
   `factory_name`, `address`, `country`, `female_workers`, `male_workers`.
4. Derive `disclosure_date` from the publication, not `date.today()`. The current
   code falls back to today when it cannot find a date, which makes every run look
   like a fresh disclosure.
5. Keep provenance: cite the map's own export URL, and mirror the workbook to
   Bunny as the other brands do.

## Acceptance

- `python -m etl.cli compare-parity brand_primark --limit 5` passes, or reports
  SKIP with a stated reason if Primark's CDN blocks the direct baseline (it
  currently 403s the landing page, so SKIP is a legitimate outcome here).
- A run yields a plausible Bangladesh row count, and `_require_rows` no longer
  fires.
- Every emitted row carries an excerpt-backed claim, verifiable by
  `verify-evidence`.

## Notes for whoever picks this up

Do not reinstate `brand_inditex` alongside this. It was retired the same day for a
different reason: Inditex publishes **no** factory-level list at any URL, only
aggregate per-country counts, sharing the real list privately with IndustriALL
Global Union. That is a disclosure that does not exist, not a link that moved.
