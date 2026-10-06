# Handoff: build the ETL freshness rework end to end (written 6 Oct 2026)

For a fresh Opus session. The founder wants the rest of `spec-etl-freshness.md` **built and shipped, slice by slice, without further design rounds**. The answers below are settled; do not re-ask them.

Before each slice, read only that slice's spec sections. Bind by `AGENTS.md`, `CLAUDE.md` and the guard hook:

- never `cd` in Bash;
- never `ssh`; never `--apply`;
- print the commands meant for the founder rather than running them.

## Where things stand

| What | State |
| -- | -- |
| Spec `context/feature-specs/spec-etl-freshness.md` | Merged (PR #324). Sections 0–8 are the design; §8 is the founder's spelling concern. |
| S1 sanctions daily (PR #325) | Auto-merge to `development`. Code: `etl/core/sanctions.py` (hash skip, `plan_reconcile`, `_reconcile`), `cbp_wro` Wayback = partial, UFLPA browser UA, record cell "Not listed · on the lists read …". |
| Migration `0120_sanctions_daily_reconcile` | **Applied 6 Oct 2026** through MCP `apply_migration` (version `20261006030947`, file sha256 `ad8388ae…07e6c`). Verified: 4 columns, 5 disabled schedules, the trigger opens review rows, `sanctions_lists_read()` answers. |
| Admin link in the buyer menu (PR #326) | Auto-merge. `admin@sourcebd.net` already had `profiles.role = admin`; the v4 frame simply had no link. |
| Founder still to do for S1 | Promote `development` → `main` and approve Deploy Production, **then** enable the five schedules (`ofac_sdn`, `uk_ofsi`, `eu_sanctions`, `uflpa`, `ilab_tvpra`) in `/admin/sources`. UFLPA's first run will likely be `partial`: the list grew from 160 to 205 entries. Read its `etl_runs.meta.reconcile`, then give the founder the release command: `docker compose run --rm etl run uflpa --accept-delistings`. |

## Settled founder decisions (6 Oct 2026, do not re-ask)

1. Scheduled reads may change buyer-visible facts without per-change approval under spec §4.6. The circuit breaker holds any run that would change more than 5% of a source's rows, remove more than 2%, or create more than 20 companies.
2. A sanctions match hides the supplier at once and is reviewed after. A supplier is only ever cleared by a human.
3. Firecrawl ceiling: 1,500 credits a month.
4. BEPZA, DIFE and RJSC come out of the public source list and counts until they are read.
5. Server crontab (founder pasted it 6 Oct):
   - **Installed:** `scraper_queue_cron.sh` every minute, `health_slack_cron.sh` every 5 minutes, `conflation_check_cron.sh` daily at 03:17.
   - **Not installed:** `split_check_cron.sh` (the duplicate-company detector; install it with C1 — the line is in the script header) and `saved_search_alerts_cron.sh` (buyer Monday email; the founder's call, so ask once).
6. **The founder's main worry.** Re-reads must never undo corrected data, never add spelling-variant rows, and never mint twin companies. §8 is the plan; C1 and C2 are not optional.

## The order (§8.4) and what "done" means for each slice

The order is **C1 → C2 + C4 → S2 → S3 → S4 → S5 + C3 → S6**.

Each slice follows the same steps:

1. Branch off `origin/development`.
2. Build.
3. Run only its tests.
4. Do one `/code-review` pass and fix the real findings.
5. Open a PR to `development` with `gh pr merge --auto --squash`.
6. Then the next slice.

**Migrations.**

- Number them from `0121`.
- Dry-run each on production before asking (the method is below).
- Write `ops/plans/<NNNN>-dry-run.md`.
- Add a row to the ledger in `context/current-state.md`. It is at about 16.1 of 16 KB, so archive a section into `context/archive/state-2026-sep.md` if a row will not fit.
- The founder says "apply NNNN". Apply with MCP `apply_migration`, gated on the file's sha256, then verify with a read.

**Code before migrations.** Shipped code must fail soft until its migration is applied (the deploy-order hazard in current-state).

### C1: save every past human decision where the ETL already obeys it

- **Built but empty in production:**
  - `supplier_field_locks` (0094, read by `etl/core/field_locks.py`, honoured in `_enrich_supplier` and the jobs);
  - `resolution_edges` (0093, read by `etl/core/resolution_edges.py` through `apply_same_edge_canonical` in `upsert.py`).
  - Both have **0 rows**.
- **The job:** write `ops/backfill_human_decisions.py`. It is a dry run by default; `--apply` is the founder's.
- **Sources it reads** (grep these, do not read the archives whole):
  - `ops/plans/rez-102-group-of-companies-report.md`
  - `rez-115-bgmea-register-identity-evidence.md`
  - `rez-116-orphan-moves-dry-run.md`
  - `rez-117-ambiguous-decisions-dry-run.md`
  - `bgmea-attribution-decisions.md`
  - the BKMEA unmerge log (`ops/unmerge_bkmea_suppliers.py`)
  - the sarada rulings named in the 0093 header
  - `admin_audit_log` `admin_supplier_update` (3 rows)
- **What it writes:** a same / never-same edge per ruled pair (the caller contract is `supplier_a < supplier_b`), and a field lock for each value a human set by hand.
- **Install `split_check_cron.sh`.** Print the founder's one-line crontab append:
  ```
  (crontab -l; echo "23 3 * * * …") | crontab -
  ```
  The founder logs in with `ssh -i $env:USERPROFILE\.ssh\sourcebd_vps root@109.104.153.228`; plain `ssh root@…` is refused.
- **Done when:**
  - the dry run lists each edge and lock with its source report;
  - after the founder applies it, a replay test shows `_find_existing` honouring every never-same pair and `_enrich_supplier` leaving every locked column alone.

### C2 + C4: hold near-matches; the circuit breaker

- **C2.** In `upsert_supplier_with_source`, where a record would **create** a company, score it against existing companies. Hold the record instead of creating when any of these is true:
  - name similarity is 80–92;
  - it shares a registration number, phone or email under a different name;
  - it shares a plot or holding number in the same district.
- **Holding a record.** Write a `verification_queue` row of type `fuzzy_match_review`. The enum value exists, as do 264 historical rows. Store the record payload so a "same" or "different" decision can replay it. Every decision writes a `resolution_edges` row, so the same pair is never asked twice.
  - Admin UI: `/admin/queue` exists; check it can show the two spellings side by side before building anything new.
- **C4.** Wrap a scheduled run's writes so they can be rolled back when the diff counts exceed the limits in decision 1. Write the diff as a dry-run report and post the summary to Slack (`SLACK_WEBHOOK_ETL`; `ops/slack_notify.sh` is the existing sender). Sanctions already has its own version (`plan_reconcile`); reuse its shape.
- **Fixture tests:**
  - Kainzanul / Kainjanul and Gazipur / Gajipur merge or are held;
  - Sreepur ≠ Sripur;
  - Anika ≠ ANITA;
  - COTTON FAIR ≠ FAIR COTTON;
  - a locked field survives;
  - a never-same pair is never merged.

### S2: certificates (GOTS and WRAP daily, OEKO-TEX and SA8000 weekly)

- **Migration:** add `last_seen_at`, `last_seen_run_id`, `listing_status` and `flipped_by_run_id` on `certifications`.
- **Reconcile** uses the same completeness guard as S1 (move `plan_reconcile` somewhere both can import it).
- **OEKO-TEX fixes:**
  - drop the session key in `oeko_profile_url` from the hash;
  - make `source_ref` `oeko-tex-{idx}:{standard}`;
  - skip the profile GET when the list row is unchanged.
- **GOTS:** make the detail call only for new or changed licences.
- **Wording:** the spec §3 lines, on the record's certificate rows, the Compliance hub and Saved.
- **0108** (`compliance_expired_certs`, not applied) gains "no longer listed" as a reason. Coordinate with its own dry run.
- **First run:** report the certificates not seen in a dry-run file for the founder before anything is marked.
- **Done when** every one of the 312 "expired after our last read" certificates is renewed, expired-and-listed, or no longer listed.

### S3: freshness on `/admin/sources`, plus Slack

- Add `max_age_hours` (already in schedule `metadata` for S1), a run window and jitter on `etl_schedules`.
- Add `etl_runs.meta` fields `credits_used` and `complete`.
- **The Sources page shows, per source:**
  - its age against the SLA;
  - the last 5 runs;
  - failures in a row;
  - credits this month against 1,500;
  - the last circuit-breaker trip.
- **Slack:** an immediate message for sanctions and certificates, and one daily digest otherwise.
- **Queue runner:**
  - `flock` the drain and enqueue steps in `ops/scraper_queue_cron.sh`;
  - concurrency cap 2;
  - one running job per scraper code;
  - retries: 3 attempts with backoff, then dead-letter.

### S4: stop the waste (numbers in spec §5)

- `sbi_recompute` runs only when a supplier source upserted something, debounced to once a day.
- `verify_evidence` runs only for documents whose source missed its SLA, at 50 a day.
- `refresh_monitors` runs on deploy only.
- `rsc_documents` runs only on new inspection URLs.
- **Firecrawl:**
  - the monthly ceiling, enforced in `_check_budget`;
  - `max_credits_per_run` set on every Firecrawl source;
  - give the founder the list of 8 noisy monitors to disable (spec §5): rsc_reports, rsc_updates, sa8000, brand_ms, brand_asos, brand_primark, cbp_wro, oeko_tex.

### S5 + C3: monthly registers and the weekly spelling list

- **Registers.** List-row hash gates for `bgmea_web` and `bgapmea_web`, copying `bkmea_detail._needs_enrichment`. Try direct-transport parity first (`etl/parity.py`, `compare-parity`). Monthly schedules.
- **Monitors.** A monitor delivery `changed` on a list page enqueues that source's scraper, debounced to 24 hours.
- **C3.** After each register run:
  - compare each address that fails to merge against the company's other addresses (plot number, district, geocode cache point);
  - write likely variant pairs to a weekly list for the founder.
- **Approved pairs** go into `lib/bd-place-lexicon.ts` and `etl/lib/bd_place_lexicon.py` together, with a test. Nothing is folded automatically.

### S6: brands and leftovers

- Remove `date.today()` from brand payload hashes.
- Quarterly schedules.
- Retire the Inditex `sources` row.
- Pause Primark.
- Take BEPZA, DIFE and RJSC out of the public counts (`marketing_facts`, `components/site/sources.ts`).

## Methods that worked in this session

- **Dry-running a migration on production without risk.**
  - Wrap its statements in `do $dry$ begin execute $m$ … $m$; raise exception 'DRY RUN OK | …', <checks>; end $dry$;`. The raise rolls everything back by construction.
  - Then confirm with a read that nothing stayed.
  - Example and output: `ops/plans/0120-dry-run.md`.
- **Fast local checks.**
  - Python: `FIRECRAWL_API_KEY=x python -m pytest etl/tests/<file> -q -p no:cacheprovider`.
  - TypeScript, one file: `npx tsc -p tsconfig.npm-test.json`, then `node --require ./test-stubs/register-node-test-aliases.cjs --experimental-websocket --test ".tests-build/<path>.test.js"`.
  - Typecheck: `npx tsc --noEmit`.
  - Lint: `$env:ESLINT_USE_FLAT_CONFIG='false'; node node_modules/eslint/bin/eslint.js <files>`.
  - Never the full `pnpm test`; CI runs it.
- **Volatility queries:** `ops/plans/etl-volatility-2026-10-06.sql`. Re-run rather than rewrite (AGENTS 14).
- **Linear is not connected**, so issue order is unchecked (AGENTS 12). Say so in each PR rather than claiming an order.

## How to talk to the founder

- Five-line replies, plain words, no jargon.
- Name issues and PRs with a short description.
- After each slice, give one line: what it does for buyers, the PR, and what the founder must do (an apply, a deploy click, a schedule to enable).

## Ready-to-paste prompt

```
Follow context/feature-specs/handoff-etl-freshness-build.md. Build the rest of the ETL freshness rework end to end, in its order: C1 (save my past fixes so re-reads cannot undo them), C2 + C4 (hold near-match companies for review, and the safety stop for big runs), S2 (daily certificate checks), S3 (freshness alerts on the Sources page and in Slack), S4 (switch off the wasteful daily jobs), S5 + C3 (monthly register reads with my weekly spelling list), S6 (brand lists). One PR per slice with auto-merge, one code review each. Dry-run every migration on production and ask me to apply it; never apply, deploy, ssh or enable a schedule yourself. Plain words, five-line updates.
```
