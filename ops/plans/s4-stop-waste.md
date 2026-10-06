# S4 — stop the waste (6 Oct 2026)

Spec: `context/feature-specs/spec-etl-freshness.md` §4.8, §5. No migration.

## What the code now does

| Was | Now |
| -- | -- |
| `sbi_recompute` every day (0 changes on 65 of 66 days) | Queued after a supplier source changed a company, at most once in 24 h. Its own schedule stays off. |
| `verify_evidence`: 500 documents a day across every source | 50 a run, and only documents of sources past their age limit. A re-read is the verification. Naming `--scraper` still checks all of that source's due documents. |
| `refresh_monitors` every day (0 changes in 66 runs) | Unchanged code: it only ever creates missing monitors, so a run costs nothing when the list is the same. Run it after a deploy that changes the monitor list (below). Its schedule stays off. |
| `rsc_documents`: re-downloads every inspection PDF | Downloads only URLs it does not already hold, and runs after an RSC read that changed something. |
| No monthly Firecrawl limit | 1,500 credits a calendar month across all sources (`FIRECRAWL_MONTHLY_CEILING`). At the limit a Firecrawl fetch stops, and Slack says so. Direct sources keep running. Monitor checks are billed by Firecrawl and are not counted here: about 210 a month. |
| No per-run Firecrawl limit on any source | Each Firecrawl source has the spec's §2 monthly estimate × 1.5 as its per-run limit; for example `bgmea_web` 450 and `bgapmea_web` 165. **A full BGMEA or BGAPMEA detail pass (~4,500 / ~1,330 pages) now stops at its limit until S5's list-row gate lands.** That is the intent: a deliberate bigger run is `run <code> --max-credits N`. |

## Founder steps

1. **Delete these 8 monitors in the Firecrawl dashboard.** The code no longer plans them, but the refresh job only creates monitors and never deletes them. Their names start `sourcebd:`.
   - `sourcebd:rsc_reports`
   - `sourcebd:rsc_updates`
   - `sourcebd:sa8000`
   - `sourcebd:brand_ms`
   - `sourcebd:brand_asos`
   - `sourcebd:brand_primark`
   - `sourcebd:cbp_wro`
   - `sourcebd:oeko_tex`
2. **Keep these schedules off** in `/admin/sources`: `sbi_recompute`, `refresh_monitors`, `rsc_documents`. They are now started by other runs or by hand.
3. **`verify_evidence` may run daily.** It now touches at most 50 documents, and only for overdue sources.
4. **After a deploy that changes a source's monitor URL**, run:
   ```
   docker compose run --rm etl run refresh_monitors
   ```
