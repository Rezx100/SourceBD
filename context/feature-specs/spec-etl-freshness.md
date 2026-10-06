# Spec: check each fact only as often as it really changes (ETL freshness rework)

Written 6 Oct 2026 from `.impeccable/handoff-etl-rework.md`. **This is a proposal. Nothing is built or applied.**
All schedules stay off until the founder answers §7.
Every number comes from production (`stnrfxrxfonwexzcvvpv`) on 6 Oct 2026 and was produced by a read-only query.
The queries are saved in `ops/plans/etl-volatility-2026-10-06.sql` (Q1–Q8); re-run them, do not write new ones (AGENTS rule 14).
Code facts come from a read of `etl/` at `launch-5-no-stripe` (HEAD `bab8f30`).

## 0. The answer in five lines

1. **The founder is right about addresses, names and registration numbers.**
   On the one register we re-read weekly (RSC), a factory's name changed for 5% of factories over five weeks, its parent group for 0.7%, and its training status for 0.9%.
   Monthly is plenty for these; a quarterly read loses little.
2. **Workers and safety progress move faster than expected.**
   RSC worker counts changed for 17% of factories in five weeks, and remediation progress for 70%.
   RSC is free to read (direct API, about 10 requests), so it stays weekly.
3. **Certificates are the real gap.** 312 certificates passed their expiry date *after* our last read.
   For those we cannot say whether they were renewed, and we never notice a withdrawal at all, because nothing marks a certificate that disappears from its body's list.
   GOTS and WRAP cost nothing to read (direct), so read them daily.
4. **Sanctions lists are free to read (OFAC, UK, EU are direct downloads) and were last read in June.**
   The UFLPA copy is worse: its newest entry is dated Jan 2025, and the DHS page has changed 8 times since August.
   Delistings are never handled either. Read all six daily.
5. **About a third of what ran daily was waste.**
   `sbi_recompute` changed rows only on the day after the weekly RSC run.
   `verify_evidence` re-checked 1,959 RSC PDFs 9,795 times; they are addressed by their content hash and cannot change.
   8 of the 15 Firecrawl monitors report "changed" on most days because their pages are dynamic, so they are noise that we pay for.

## 1. Volatility map (measured)

How it was measured:

- `source_records` keeps only the latest `raw_hash` (no history), so field-level change comes from `evidence_claims`: the distinct values per (supplier, subject, field) across documents (Q3).
- Record-level change comes from the change-skip counters in `etl_runs`, which work since 2 Aug (Q2).
- Page-level change comes from 973 Firecrawl monitor deliveries, 1 Aug to 6 Oct (Q6).

**BKMEA caveat.** BKMEA's apparent 10–22% field change happens within 1–2 days. It comes from re-listing and conflation (the REZ-34 Phase D population), not from real-world change, so it is excluded below.

| Fact | Where we hold it | Measured change | Harm if wrong N days | Who is hurt | Recommended check |
| -- | -- | -- | -- | -- | -- |
| Company name | suppliers, RSC, registers | RSC 5.1% / 35 days (22 of 433) | Low: buyer can still find it | buyer search | monthly (registers), weekly via RSC for free |
| Registration / membership no. | BGMEA, BKMEA, EPB | EPB 1 of 6 re-observed; BKMEA noise | Low | buyer trust | monthly, on a list-page signal |
| Address | registers, RSC, OEKO-TEX | not separable from noise; EPB 1 of 6 | Low: buyers confirm on visit | buyer | monthly |
| Phone / email | registers (sign-in gated) | no history (registers read once) | Medium: a dead contact wastes an RFQ | buyer | monthly with the register; never on its own |
| Workers (total, M/F) | RSC, BKMEA, BGMEA, brands | **RSC 16.8% / 35 days** (72 of 429) | Medium: capacity decision | buyer | weekly via RSC; monthly via registers |
| Production capacity, machines | BKMEA | 6–7% (noise-dominated) | Low | buyer | monthly |
| Products / HS lines | EPB, BKMEA, brands | BKMEA products 5% | Low | buyer | monthly (EPB), quarterly (brands) |
| Membership status / category | BGMEA, BKMEA, BGAPMEA | BKMEA category 4.3%; the BGMEA list page changed on 8 of 65 days | Medium: a lapsed member still shown as a member | buyer | weekly list-page check, detail only on change |
| RSC safety status / remediation | RSC | **status 6.5%, remediation status 14.5%, progress 70% / 35 days**; about 4% of records change each week (Q2: 80–102 of 2,285 every week since 7 Aug) | High: safety decision | buyer, legal (due diligence) | weekly (free) |
| RSC inspection report links | RSC | 3.6–4% / 35 days | Medium | buyer | weekly with RSC |
| **Certificate expiry date** | GOTS, WRAP, SA8000 | 312 expired after our last read; 126 expire within 30 days; GOTS and WRAP certificates last about a year, so about 2% roll over each week | **High: a buyer relies on an expired certificate, or wrongly drops a renewed one** | buyer, legal | **daily** (GOTS, WRAP: free) |
| **Certificate withdrawn / suspended** | GOTS, WRAP, SA8000, OEKO-TEX | **invisible today**: no removal handling anywhere | **High** | buyer, legal | **daily** where free, and "no longer listed" detection |
| OEKO-TEX listing | OEKO-TEX (no dates published) | buying-guide page changed on 32 of 63 days (dynamic); no expiry data at all | Medium | buyer | weekly (a 2.6-hour run) |
| Certificate number, issuer, scope | cert bodies | change only with a renewal | Low | buyer | with the expiry check |
| **Sanctions / forced-labour entries** | OFAC, UK OFSI, EU, UFLPA, US WRO, ILAB | EU added 99 entries in 2026 so far (about 2 a week); UK 334 in 2025; Bangladesh entities are rare (UK 2, EU 2, OFAC 0) | **Severe**: legal exposure, broken product promise | buyer, legal | **daily** |
| Sanctions delisting | same | **not handled**: an entry removed upstream stays forever | High: a wrongly hidden supplier | supplier, buyer | daily (full-list reconcile) |
| Brand supplier-list membership | H&M, M&S, ASOS, Next | lists published about twice a year; Next's page changed once in 65 days, H&M's 9 times | Low–medium | buyer | quarterly, plus on a monitor signal |
| RSC monthly reports, updates | RSC | monthly | Low (aggregate only) | marketing | monthly |

**Verdict on the hypothesis.** It is confirmed for identity facts: name, registration number, address, contact and membership number.
It is **wrong for two slow-looking facts**: worker counts and RSC remediation move every week. RSC is free, so the fix costs nothing.
It is **right and urgent** for certificates and sanctions, and the gap there is not cadence alone: we have no way to notice that something *disappeared*.

## 2. Per-source plan

Credits come from `estimate_credits` (1 per page) and the recorded spend in `evidence_documents.credits_used` (bkmea_detail 4,402 credits, 30 Jul–2 Aug).
`etl_runs` does not record credits today (`meta` holds only `matched_suppliers`); §4.9 fixes that.
Monitors are assumed to cost about 1 credit per check: **confirm against the Firecrawl invoice.**

| Source (scraper) | Tier | Transport today | Decision | Cheapest change detection | Credits / month |
| -- | -- | -- | -- | -- | -- |
| OFAC (ofac_sdn) | 5 | direct, 2 CSV | **Keep, daily** | `If-Modified-Since` / ETag on the CSV; file sha256 skip; entry-level hash skip | 0 |
| UK OFSI (uk_ofsi) | 5 | direct, 1 XML | **Keep, daily** | ETag + file sha256 | 0 |
| EU (eu_sanctions) | 5 | direct, 1 XML | **Keep, daily** | ETag + file sha256 | 0 |
| UFLPA (uflpa) | 5 | firecrawl → direct | **Keep, daily; fix the stale read first** (newest entry Jan 2025) | page sha256 (direct first, Firecrawl only if direct is blocked) | 0–30 |
| US WRO (cbp_wro) | 5 | firecrawl → direct, Wayback fallback | **Keep, daily**; drop the Wayback fallback for scheduled runs (a 2024 snapshot is not a fresh read: fail instead) | page sha256 | 0–30 |
| ILAB TVPRA (ilab_tvpra) | 5 | firecrawl + XLSX direct | **Weekly** (the list is country × good, updated about every two years) | XLSX sha256 | 0–4 |
| GOTS (gots) | 3 | direct API | **Keep, daily** (list); detail call only for new or changed licences | list-row hash, then detail | 0 |
| WRAP (wrap) | 3 | direct Power BI, 1 POST | **Keep, daily** | response sha256 | 0 |
| SA8000 (sa8000) | 3 | firecrawl, 1 call | **Weekly** (7 records) | page sha256 | about 4–20 |
| OEKO-TEX (oeko_tex) | 3 | direct, about 2.6 h | **Weekly**; skip the per-row profile GET when the list row is unchanged; remove the session key from the hash (it defeats change-skip today) | list-row hash | 0 |
| RSC (rsc) | 1 | direct API, about 10 requests | **Keep, weekly** | change-skip already works (about 96% skipped) | 0 |
| RSC documents (rsc_documents) | 1 | direct | **On signal only**: run after `rsc` when an inspection URL changed; stop the blanket download | new URL in `rsc_remediation` | 0 |
| RSC reports / updates | 1 | firecrawl | **Monthly**; drop their monitors (they report a change daily) | index page sha256 | 2 |
| EPB (epb_web) | 1 | direct | **Monthly** | change-skip (exists) | 0 |
| BGMEA (bgmea_web) | 2 | firecrawl → direct, about 4,500 pages | **Monthly list; detail only for new or changed list rows**; keep its monitor (8 of 65 days changed = a real signal) | list-row hash gate (the bkmea_detail pattern) | about 214 list + about 100 detail ≈ 300; 0 if direct parity holds |
| BKMEA (bkmea_web + bkmea_detail) | 2 | firecrawl → direct | **Monthly list; detail gated (exists)**; keep monitor | list-hash gate (built, REZ-36) | about 10 + 50 = 60 |
| BGAPMEA (bgapmea_web) | 2 | firecrawl → direct, about 1,330 pages | **Monthly list; gated detail**; keep monitor | list-row hash gate (new) | about 83 + 30 = 110 |
| BTMA (btma_spinning) | 2 | local files | **Manual.** Honest label: "Read from BTMA's directory, 21 May 2026" | none possible | 0 |
| BGMEA buying houses (bgmea_buying_house) | 2 | local PDF | **Manual**, re-read when BGMEA publishes a new PDF | file sha256 | 0 |
| H&M, Next, ASOS (brand_*) | 4 | firecrawl landing + direct file | **Quarterly, or on a monitor signal**; keep the H&M and Next monitors, drop ASOS (changes daily); remove `date.today()` from the hash (it defeats change-skip today) | file sha256 | about 6 |
| M&S (brand_ms) | 4 | direct + Playwright | **Quarterly**; drop its monitor | file / API hash | 0 |
| Primark (brand_primark) | 4 | firecrawl | **Pause**: 0 records ever; its own spec (`spec-brand-primark-global-sourcing-map.md`) retargets it | none | 0 |
| Inditex | 4 | none | **Retire the `sources` row** (publishes no list) | none | 0 |
| BEPZA, DIFE, RJSC | 1 | no scraper | **Not read; say so.** Remove them from public source counts until a scraper exists | none | 0 |
| Monitors kept (7) | — | Firecrawl | bgmea_web, bkmea_web, bgapmea_web, brand_hm, brand_next, uflpa, ilab_tvpra | Firecrawl monitor | about 210 |

**Total: about 600–900 credits a month, with a hard ceiling at 1,500 (§4.8).**
For comparison, one full BGMEA run is about 4,500 credits, and the 15 monitors alone cost about 450 a month.

**Legal and robots notes.**

- OFAC, OFSI, EU, DHS, CBP and DOL publish for reuse; daily is normal.
- GOTS, WRAP and OEKO-TEX are public search tools. Keep rps ≤ 0.5 and an identifying user agent.
- WRAP's Power BI endpoint is unofficial and could break or be closed. Treat a failure as "unread", never as "removed" (§4.4).
- BGMEA, BKMEA and BGAPMEA are member directories behind bot protection (hence Firecrawl). Monthly is gentler than today's ad-hoc full passes.
- Brand files are published disclosures; quarterly is in line with how often they are published.

## 3. The freshness contract (what buyers see)

Each fact class gets a maximum age. **Age = now minus the last *successful complete* read of that source.**
A run that fails or stops early does not refresh the date.

| Fact class | Target cadence | Max age (SLA) | When the SLA is missed |
| -- | -- | -- | -- |
| Sanctions & forced-labour lists | daily | **48 h** | Label the line as overdue (wording below); Slack alert at 48 h; at 7 days the Compliance hub shows a banner |
| Certificates: GOTS, WRAP | daily | **72 h** | Label; Slack alert |
| Certificates: SA8000, OEKO-TEX | weekly | **10 days** | Label; Slack alert |
| RSC safety & remediation, workers from RSC | weekly | **14 days** | Label; Slack alert |
| Registers (BGMEA, BKMEA, BGAPMEA, EPB): identity, contact, membership | monthly | **45 days** | Label only; Slack alert at 60 days |
| Brand lists | quarterly | **120 days** | Label only |
| Manual sources (BTMA, BGMEA buying-house PDF) | manual | none | Always shown with the date read, never "current" |

Wording on screen. It is plain and uses no scores. It follows the rule already on the home page: we say what we found, never "clear".

- **Certificate, read within SLA:** "GOTS · valid until 15 Dec 2026 · checked with GOTS 6 Oct 2026"
- **Certificate expired, body lists no newer one:** "GOTS · expired 3 Sep 2026 · GOTS lists no newer certificate (checked 6 Oct 2026)"
- **Certificate expired but re-listed (renewal):** the new row replaces it: "valid until 2 Sep 2027 · checked with GOTS 6 Oct 2026"
- **Certificate no longer listed:** "GOTS · no longer listed by GOTS since 6 Oct 2026 (was valid until 15 Dec 2026)". Shown in the caution tone, with the Compliance hub's ask for a new certificate.
- **Certificate, SLA missed:** "GOTS · valid until 15 Dec 2026 when GOTS last showed it, 26 Jun 2026 · not re-checked since"
- **OEKO-TEX** (no dates published): "OEKO-TEX STANDARD 100 · listed by OEKO-TEX on 6 Oct 2026"
- **Sanctions, within SLA:** "No match on the OFAC, UK, EU, UFLPA and US withhold-release lists we read on 6 Oct 2026"
- **Sanctions, SLA missed:** "No match on the lists as we last read them on 2 Oct 2026. They have not been re-read since."
- **Sanctions hit (auto-flag, §4.6):** "Possible match on the UK sanctions list (read 6 Oct 2026) · under review". The record leaves search until reviewed.
- **Registry facts:** keep today's per-source date marks, with "over 30 / 90 days ago" (`components/site/status.tsx`). The 90-day public label on the Methodology page stays as is.

## 4. System design

No new tools. Everything below uses what `context/architecture.md` approves: Postgres, the Docker ETL image, cron, the Firecrawl API and the Slack webhook.
Inngest is approved but unused, and is not needed.

### 4.1 Scheduling

- **Keep `etl_schedules`**, with three additive columns:
  - `run_window_start_utc smallint`: the hour a run may start (for example 02 UTC for sanctions, after OFAC's evening US publication).
  - `jitter_minutes smallint default 15`.
  - `max_age_hours int`: the SLA in §3; it lives on the schedule, so one place owns it.
- Fixed `interval_minutes` stays. Its CHECK already allows 60–43,200. Monthly is 43,200, the current maximum, which is enough.
- `next_run_at` is anchored to the window (`date_trunc('day') + window + random jitter`), so runs do not drift around the clock the way `now() + interval` makes them drift today.
- **Signal-driven runs.** A monitor delivery with status `changed` for a *source list page* enqueues that **source's scraper**, not a verify requeue, with a 24-hour debounce per source.
  This replaces "page changed → re-verify citations" with "page changed → re-read the register", which is what actually refreshes the buyer's fact.
- **Chained runs.** On success with `records_upserted > 0`:
  - `rsc` enqueues `rsc_documents`, limited to rows whose URLs changed;
  - any supplier source enqueues `sbi_recompute`, debounced to once a day.
  - No change means no chain.

### 4.2 The worker

- **Today.** Cron runs every minute and calls `run-queue --limit 1`. Each tick starts a fresh container, and nothing stops ticks from overlapping.
  A 3-hour OFAC run means 180 overlapping ticks, each able to claim another job. Concurrency is unbounded by design and bounded only by luck.
- **Change.** Wrap the cron body in `flock -n /tmp/sourcebd-etl.lock` for the drain and enqueue steps.
  Give `run-queue` a concurrency cap: count jobs in `running` before claiming, with a default cap of 2.
  The cap is one per source code, enforced by the claim query (`not exists running job with same scraper_code`).
- **Do not add a long-lived daemon.** A container per run is fine at this volume, about 10 runs a day after the change, and it isolates a crash to one run.
- **Long runs.** OFAC averages about 2.9 hours, almost all of it per-entry screening. Gated by file sha256, an unchanged day costs one HEAD request.
  On a changed day, screen only the *new or changed* entries against suppliers (entry-side), and run the supplier-side screen only for suppliers changed that day. That already happens inside the upsert.

### 4.3 Change detection and skip (one ladder for every source)

1. **Request level.** Send `If-None-Match` / `If-Modified-Since` where the server supports it, and store the ETag and Last-Modified per URL on a new `etl_fetch_cache(url, etag, last_modified, sha256, fetched_at)` table.
   A 304 means unchanged: the run succeeds with 0 work and still counts as a fresh read for the SLA. Today nothing sends these (verified by grep).
2. **File level.** sha256 of the whole download. If it equals the last one, stop.
3. **List-row level** for list-then-detail sources. Hash each list row and fetch the detail only when its row hash changed or it is new.
   `bkmea_detail._needs_enrichment` is the pattern to copy into `bgmea_web` and `bgapmea_web`.
4. **Record level.** The existing `raw_hash` skip in `upsert.py`. Fix three things that defeat it:
   - `date.today()` in brand payloads;
   - the session key in `oeko_profile_url`;
   - the OEKO-TEX shared `source_ref` across standards (make it `oeko-tex-{idx}:{standard}`).
   Sanctions entries get the same hash skip; today every entry is re-upserted every run.

### 4.4 Non-destructive writes and "no longer listed"

This is the core missing piece: a fact that disappears from its source.

- **Columns.** Add `last_seen_at timestamptz` and `last_seen_run_id uuid` to `certifications` and `sanctions_list_entries`.
  Add `listing_status text check in ('listed','no_longer_listed') default 'listed'` to both.
  Additive only; nothing is deleted.
- **Reconcile.** After a run that **completed and read the whole list**, mark every row of that source whose `last_seen_run_id` is not this run as `no_longer_listed`.
  - **Completeness guard.** Reconcile only if the run reached its last page *and* `records_seen ≥ 90%` of the previous complete run. Otherwise the run is "partial": no reconcile, and the read date does not advance.
    A WRAP Power BI outage or a site redesign must never look like 400 withdrawals.
  - **Relisting.** A row seen again flips back to `listed`.
- **Sanctions.** An entry that is `no_longer_listed` deactivates its `sanctions_screening` rows (`active = false`).
  The propagate trigger already exists to recompute `is_sanctioned`; it gets one additive branch for un-flagging.
  Un-flagging a supplier is **never automatic**: it opens a review row (§4.6).
- **Expiry.** Stays date arithmetic on `expires_on` (already correct without scraping).

### 4.5 How a change becomes visible

There is no staging. Registry columns are canonical-latest-wins (founder rule, 3 Aug), and the scraper writes the live row.
What changes is *which* writes may happen unattended (§4.6).

### 4.6 Approval policy (AGENTS rule 15, made precise)

Rule 15 is about *operator* actions such as `--apply`, migrations and bulk merges. This spec proposes a standing, written policy for *scheduled* reads, approved once by the founder:

| Change from a scheduled read | Unattended? | Why |
| -- | -- | -- |
| A certificate's dates, number or scope updated by its issuing body | **yes** | Tier 3 is the source of truth; we display what they publish |
| A new certificate for a known supplier | **yes** | same |
| Certificate `no_longer_listed` | **yes**, if the completeness guard passed and fewer than 5% of that source's rows flip in one run | |
| Sanctions *hit* on a supplier | **yes, fail-safe**: flag and hide from search at once, and queue for review | Hiding a possibly sanctioned supplier is the safe direction |
| Sanctions *clear* (delisting, or a hit judged false) | **no**: review queue (`admin_sanctions_decide` exists) | Un-hiding is the risky direction |
| Registry identity fields (name, address, workers) | **yes** | the existing practice since 3 Aug |
| New supplier minted | as today (the publish guard requires Tier 1–3) | trust hierarchy |
| Any run that would change more than 5% of a source's rows, or remove more than 2% | **no**: the run writes nothing, posts its dry-run summary to Slack and waits for the founder | circuit breaker against a parser or site change |

The circuit breaker is the safety. It works by running the upsert inside one transaction and rolling it back when the diff counts exceed the limit, then saving the diff as a `_snapshot` report.

### 4.7 Retries, dead letter, alerting

- **Retries.** The job gets up to 3 attempts with backoff (15 min, 1 h, 4 h). `etl_job_queue.attempts` exists; add `max_attempts` and `retry_after`.
- **Dead letter.** After the last attempt the job is `failed`, and the source's consecutive-failure count increments.
- **Slack** (`SLACK_WEBHOOK_ETL` exists). Alert on:
  - the first failure of a daily source, or the second consecutive failure of anything else;
  - an SLA miss (§3);
  - a circuit breaker trip;
  - the credit ceiling reached.
  - It sends one daily digest, plus immediate messages only for sanctions and certificates.

### 4.8 Cost budget

- **Per run.** Set `max_credits_per_run` on every Firecrawl source. The attribute exists and none sets it today. Use the per-source numbers in §2 × 1.5.
- **Per month.** A new `firecrawl_monthly_ceiling` (default 1,500), read by `_check_budget` from `sum(credits)` this calendar month.
  When reached, Firecrawl runs fail with `CreditBudgetExceeded` and Slack says so. Direct sources keep running.

### 4.9 Observability: `/admin/sources` per source

Per source, show:

- last successful complete read;
- age against SLA (green / amber / red);
- next run;
- the last 5 runs (seen / changed / skipped / failed);
- consecutive failures;
- credits this month against the ceiling;
- the last circuit-breaker trip;
- the count of `no_longer_listed` rows.

To feed this, `etl_runs.meta` gains `credits_used`, `complete` (bool), `http_304`, `file_unchanged`.

### 4.10 Secrets

No change: `/opt/sourcebd/.env` only. No new secrets are needed.

### 4.11 Backfill and replay

- **First run.** A source's first complete run after the migration sets `last_seen_at` for every row it sees.
  Rows it does not see are **not** marked on that first run. They are reported in a dry-run file for the founder, because 312 expired certificates need a human glance once.
- **Replay.** Any run can be re-done from the raw cache (`etl/raw`) with `--from-cache`; the existing parity harness `etl/parity.py` covers that.

### 4.12 Tests

All of these are pytest with fixtures, mocked cursors where SQL is simple, and pure functions for gates.

- Completeness guard: a partial run never reconciles.
- Reconcile flips and unflips correctly.
- 304 / unchanged file counts as a fresh read.
- Circuit breaker rolls back above the threshold.
- Hash stability for brand and OEKO-TEX payloads (the same input on two days gives the same hash).
- Credit ceiling stops before spend.
- `next_run_at` stays inside the window.
- One SQL test per new function on the migration replay (Postgres 16 in CI).
- At the buyer boundary (AGENTS rule 16), one route test per wording state in §3.

### 4.13 Runbook and rollback

- **Every slice ships schedules disabled.**
  - The founder enables them one at a time, through `/admin/sources` or `admin_etl_schedule_upsert`, after the first run has been read.
  - Disable is one flag.
- **Rollback of a bad run.**
  - The circuit breaker prevents the large ones.
  - For small ones, each run writes `last_seen_run_id`, so "undo run X" is `listing_status = 'listed' where flipped_by_run = X`. Add `flipped_by_run_id` for this.
- **Migrations** are additive. Rollback is "stop reading the new columns"; nothing needs dropping.

### 4.14 Adding source number 26 in a day

1. A `sources` row in a migration.
2. A scraper class with `transport`, `rps`, and a `fetch()` that yields records. If it is a list, declare `complete` when the last page is reached.
3. Register the class in `registry.py`, the SQL allow-list and `lib/admin/etl-scrapers.ts`.
4. Add a schedule row with its window and `max_age_hours`.
5. Add a fixture test from one saved page.
6. Run with `--dry-run`, then enable.

The ladder in §4.3 and the reconcile in §4.4 come from the base class, so a new source writes no change-detection code.

## 5. What to stop

| Stop | Evidence | Saving |
| -- | -- | -- |
| Daily `sbi_recompute` | Changed rows only on Saturdays, the day after the weekly RSC run: 51–67 rows each. In 66 runs, 0 changes on every other day since 15 Aug | about 50 empty runs a month; becomes a chained run (§4.1) |
| Blanket `verify_evidence` (500 pages a day) | 30,062 checks in 67 days. 9,795 were re-checks of 1,959 RSC PDFs, which are keyed by content hash and so cannot change. bkmea_detail checks found 3,692 "changed", the same conflation population re-reported. `content_changed` is true on 15,724 "live" BKMEA checks, so the page-hash signal is useless there | About 15,000 direct requests a month to BKMEA and RSC. Replace with: a re-read **is** the verification. Keep the verifier only for documents whose source has missed its SLA, at 50 a day |
| `refresh_monitors` daily | 66 runs, 0 changes | Run it only when the monitor list in code changes (on deploy) |
| 8 noisy monitors (rsc_reports, rsc_updates, sa8000, brand_ms, brand_asos, brand_primark, cbp_wro, oeko_tex) | "changed" on 27–64 of about 65 days: dynamic pages | about 240 credits a month, and the verify work they trigger |
| `rsc_documents` blanket download | Every run downloads up to 5 PDFs per factory, then dedups by hash | Only on new URLs |
| Full BGMEA / BGAPMEA detail passes | about 4,500 and about 1,330 pages a run; the list page changed on 8 and 3 days out of 65 | more than 90% of their credits |
| cbp_wro Wayback fallback in scheduled runs | A 2024 snapshot is not a fresh read | honesty |

## 6. Order of work

Each slice gets its own branch and PR, and is merged by CI. Migrations are applied by the founder; schedules are enabled by the founder.
This order follows from the measured risk. It is **not** cross-checked against Linear: Linear is not connected in this session, so the open issues have not been read (AGENTS rule 12).
Read the ETL epics before starting S1.

**S0: no code, founder only.**

- Paste `crontab -l` from the VPS; it is the only way to know which of the 5 `ops/*_cron.sh` are live.
- Disable the 8 noisy monitors on Firecrawl's side. They currently create verify work while `verify_evidence` is off, and that work is piling up.

**S1: sanctions daily.** This is the biggest legal risk, and it costs 0 credits.

- Migration: `last_seen_at`, `listing_status`, `last_seen_run_id` on `sanctions_list_entries`, and the `etl_fetch_cache` table.
- Code: the file-sha and ETag skip; the entry hash skip; reconcile with the completeness guard; the delisting review row; fix UFLPA (find out why the newest entry is Jan 2025 — parser or page); remove the WRO Wayback fallback for scheduled runs.
- Schedules: 6 lists, daily in a 02–04 UTC window. Enabled by the founder after one dry run each.
- Screen: the sanctions line wording from §3, with the list read date from `max(last complete run)`.
- **How we know it worked in production:**
  - `/admin/sources` shows all 6 lists read within 48 hours for 7 days running;
  - an injected test entry is flagged, then cleared through review;
  - unchanged days show `file_unchanged` and run in under a minute.

**S2: certificates.** GOTS and WRAP daily, OEKO-TEX and SA8000 weekly.

- Migration: the same three columns plus `flipped_by_run_id` on `certifications`.
- Code: reconcile; the OEKO-TEX hash and ref fixes; a GOTS detail call only for changed rows.
- Screen: the certificate wording from §3 on the record, the Compliance hub and Saved.
  `compliance_expired_certs` (migration 0108, not yet applied) gains "no longer listed" as a reason.
- First run: the dry-run list of rows not seen, for the founder.
- **How we know it worked:** of the 312 "expired after last read" certificates, each is now renewed, still expired-and-listed, or no longer listed, and none is unknown.

**S3: freshness SLA on the admin page, plus Slack.**

- The schedule columns, the `etl_runs.meta` fields, the Sources page and the alerts.
- **How we know it worked:** a deliberately disabled schedule turns amber and then red, and Slack fires once.

**S4: stop list.**

- sbi chaining; the verifier reduced to the SLA-missed set; `refresh_monitors` on deploy; `rsc_documents` on signal.
- The Firecrawl monthly ceiling and the per-source caps.

**S5: registers.**

- List-row gates for BGMEA and BGAPMEA (try direct transport parity first: 0 credits if it holds).
- Monthly schedules.
- Monitor signal → source run.

**S6: brands.**

- The hash fix; quarterly schedules; retire Inditex; pause Primark.
- Take BEPZA, DIFE and RJSC out of public counts.

**Smallest first slice that closes the biggest buyer risk: S1, then S2.** The handoff guessed sanctions + certificates + label, and the data agrees.
They are split in two because sanctions needs no new parser work and certificates need the OEKO-TEX fixes.

## 7. Questions for the founder (recommended answer first)

**Answered 6 Oct 2026:** the founder accepted the recommendations on 1–4.
For 5, the founder ran `crontab -l` on the VPS on 6 Oct. Three jobs are installed:

- `scraper_queue_cron.sh`, every minute;
- `health_slack_cron.sh`, every 5 minutes;
- `conflation_check_cron.sh`, daily at 03:17.

`/etc/cron.d` holds only the system's `e2scrub_all`. Two jobs are **not installed**:

- `split_check_cron.sh`, the daily detector for one company split across duplicate profiles. That is the twin problem in §8, so install it with C1.
- `saved_search_alerts_cron.sh`, the Monday "new matches" email that the product promises buyers. It is not part of this spec; it is flagged to the founder.
The founder added a new concern: re-reads must not undo corrected data. It is answered in §8.

1. **May scheduled reads change what buyers see without asking you each time, under the §4.6 policy?**
   That covers certificate dates and status, new certificates, and a sanctions *hit* that hides the supplier at once. Clears always wait for review, and any run changing more than 5% stops for you.
   *Recommended: yes.* Without it, a daily check means a daily approval.
2. **When a sanctions match is found, hide the supplier from search immediately, before review?**
   *Recommended: yes.* Matching is strict (name ratio ≥ 95, at least 2 shared tokens), so false hits should be rare, and we aim to review within one working day.
3. **What is the Firecrawl ceiling per month?** *Recommended: 1,500 credits.* That is about twice the planned spend, and Firecrawl jobs stop and alert you when it is reached.
4. **BEPZA, DIFE and RJSC have never been read. Take them out of the public source list and counts until we build them?** *Recommended: yes.*
5. **Which cron jobs are on the server?** Please paste `crontab -l` from the VPS.
   *Default if you don't: assume only the scraper queue runs, and leave the other four untouched.*

Command for the founder (on the SourceBD VPS, `109.104.153.228`):

```bash
crontab -l
```

## 8. Re-reads must never undo corrected data (founder concern, 6 Oct 2026)

**The concern.** The registers spell the same company and the same place differently: "Gazipur", "Gajipur" and "Kajipur", or a village written three ways by EPB, BGMEA and BKMEA. Earlier versions put those raw spellings on screen as extra address rows or extra companies, which broke data the founder had cleaned up. More frequent reads must not bring that back.

### 8.1 What the code does today (read 6 Oct, branch `launch-5-no-stripe`)

- **Raw text is kept per source and never overwrites another source.** Each company has one stored record per source, keyed by that source's own id (`source_records`, unique on supplier + source + ref).
  - When a source is re-read with a new spelling, only *that source's* text is replaced. No row is added.
  - When a new source is read, one row per source is added.
- **The clean look is computed when the page is drawn, not stored.**
  - Addresses are grouped by premises in `lib/dedup-addresses.ts`. A place lexicon (`lib/bd-place-lexicon.ts`, mirrored in `etl/lib/bd_place_lexicon.py`) folds known spellings together. Hard blocks, such as different plot numbers or Sreepur ≠ Sripur, keep different places apart.
  - Alternate spellings show as "Also recorded as" under one row.
  - Names go through `clean_display_name` and `splitQualifier`.
  - **Consequence:** a re-read goes through the same cleaning, so a spelling the lexicon already knows is safe.
- **Company-level columns only fill blanks.** `_enrich_supplier` uses `coalesce(column, new)`, so address, city, phone and website are never overwritten once set. The company name is set when the company is created and is never rewritten by a re-read.
- **Human decisions are meant to be protected by two tables.**
  - Field locks (`supplier_field_locks`, 0094) stop the ETL writing a locked column.
  - Same/never-same rulings (`resolution_edges`, 0093) tell the matcher that two companies are or are not one.
  - The matcher reads both.

### 8.2 The gaps (measured on production 6 Oct)

1. **Both protection tables are empty: 0 field locks and 0 resolution rulings.**
   Every past fix lives in ops scripts and their reports, not in a table the ETL reads. That includes REZ-102 (nine suppliers holding another company's BGMEA records), REZ-116/117 (orphan moves and ambiguous decisions), the BKMEA unmerges and the sarada rulings.
   A matcher change or a re-keyed source could redo a fixed mistake.
2. **The biggest risk is a new company minted from a misspelt name.**
   The matcher tries the source's own id, then the exact name, then email/phone, then a fuzzy name match at 92+ with an order check. Below 92 it **creates a new company**, which gives a twin (the WEST KNITWEAR class).
   20 companies were created in the last 60 days. Monthly register reads will meet new spellings every month.
3. **The place lexicon is a fixed, founder-approved list (118 lines).** A spelling it does not know ("Kajipur", "Mawna" variants) shows as a second location row until someone adds the pair.
   That is deliberate, because a wrong merge is worse than a visible duplicate, but nothing today *notices* the new spelling.
4. **Nothing stops a run that changes many records at once.** The circuit breaker in §4.6 is proposed, not built.

### 8.3 The plan: a check step between "scraped" and "on screen"

No new tools. It reuses the review queue (`verification_queue`, `fuzzy_match_review` already exists) and the geocode cache (no new Barikoi calls). It is the slim, scheduled-run version of the queued entity-resolution core (`spec-resolution-core.md`), which stays the long-term replacement.

**C1. Write every past human decision into the tables the ETL already obeys. Do this first.**

- An ops script, dry-run by default, reads the decision reports in `ops/plans/` (REZ-102, 115, 116, 117, the BKMEA unmerge log and the BGMEA attribution decisions). It writes `resolution_edges` rows (same / never-same) and `supplier_field_locks` for values a human set by hand.
- The founder reviews the dry run, then it is applied (AGENTS rule 15).
- After this, a re-read cannot undo those fixes, because the matcher and the writer already check these tables.

**C2. A run never creates a company or a new location row on a near-match.** Every record a run would turn into a **new company** is scored against existing companies:

| Case | Result |
| -- | -- |
| Name similarity 80–92 | Held |
| Same registration, phone or email under a different name | Held |
| Same plot/holding number in the same district | Held |
| Clearly new (below 80, no shared identifier) | Created as today |
| Confident match (92+, or the source's own id) | Attached as today |

- A held record goes to the review queue showing both spellings side by side. It does not appear on screen until a reviewer says "same" or "different".
- **The decision is saved as a resolution ruling,** so the same pair is never asked twice.

**C3. New spellings of places are collected, not guessed.**

- After each run, every address string that does not merge into an existing premises is compared with the company's other addresses: same plot number, same district, and the same map point in the geocode cache.
- Likely variants ("Kajipur" ↔ "Gazipur", "Mouna" ↔ "Mawna") go into a weekly list for the founder.
- An approved pair is added to the lexicon (TS and Python together, with a test).
- **Nothing is folded automatically.** The lexicon's rule stays: only founder-approved pairs. Until then the variant shows under "Also recorded as" if it is the same premises, or as its own row if it is not.

**C4. Hold the whole run if it would change too much.** This is the §4.6 circuit breaker: more than 5% of a source's records changed, more than 2% removed, or more than 20 new companies in one run. The run writes nothing and posts its summary; the founder decides.

**C5. Tests that pin it.**

- Fixture records with known spellings must merge or be held exactly as expected: Kainzanul/Kainjanul, Gazipur/Gajipur, Sreepur ≠ Sripur, and Anika ≠ ANITA.
- A re-read of a locked field leaves it unchanged.
- A ruled never-same pair is never merged.

### 8.4 Where it goes in the order of work

- **C1** comes before any schedule is enabled. It is cheap and protects everything after it.
- **C2 and C4** come before S2: certificate bodies can create companies. Sanctions (S1) creates no companies or addresses, so S1 can go first.
- **C3** comes with S5, the monthly register reads, which are where new place spellings arrive.

This changes §6's order to **S0 → S1 → C1 → C2 + C4 → S2 → S3 → S4 → S5 + C3 → S6**.
