# SourceBD ETL — enterprise scraping framework

## Layout
```
etl/
  core/          Reusable: config, logging, http, ratelimit, db, normalize, scraper, upsert
  scrapers/      One file per source (bgmea_pdf, bkmea_web, rsc, ...)
  raw/           Input artifacts (PDFs, HTML caches) — gitignored
  parsed/        Intermediate JSON outputs — gitignored
  cli.py         Entry point
```

## Local quickstart

```powershell
# 1. fill .env (copy from .env.example, set SUPABASE_DB_URL with real password)
copy .env.example .env

# 2. build container
docker compose build etl

# 3. apply schema
docker compose run --rm etl migrate

# 4. verify
docker compose run --rm etl ping

# 5. run a scraper
docker compose run --rm etl run bkmea_web
docker compose run --rm etl run rsc

# 6. BGMEA: drop the PDF first
copy "C:\path\to\BGMEA_Associate_Members.pdf" etl\raw\
docker compose run --rm etl run bgmea_pdf
```

## Adding a new source

1. Add a row to the `sources` insert in `supabase/migrations/0001_phase0_core.sql` (or a new migration).
2. Add tier mapping in `etl/core/upsert.py::_TIER_MAP`.
3. Create `etl/scrapers/<code>.py` subclassing `BaseScraper`.
4. Implement `async def fetch(self) -> AsyncIterator[ScrapedRecord]`.
5. Register in `etl/cli.py::SCRAPERS`.

## Invariants enforced

- **Trust hierarchy**: every fact has a `source_records` row, tier is denormalized.
- **No Tier 6 publish**: DB trigger blocks `is_published = true` without ≥1 active Tier 1-3 source.
- **Sanctions = SBI 0**: trigger forces `sbi_scores.total = 0` whenever supplier `is_sanctioned`.
- **Idempotent**: `(supplier_id, source_id, source_ref)` is unique; rerunning a scraper is safe.
- **Non-destructive enrichment**: `COALESCE` everywhere — never overwrite a non-null with null.
