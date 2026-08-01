# SourceBD - Current State

Last compacted for agent-token efficiency: 30 Jun 2026.

## Phase
Phase 7 - Public Beta launch prep.

## Shipped Baseline
- Phase 0 data moat and Phases 1-5 are shipped in the codebase.
- Phase 6 hardening H1-H8 is shipped in codebase.
- FE-SITEWIDE design conformance pass is complete enough to be the current visual baseline.
- P1 deploy artefacts and Phase 7 P2-P4 beta surfaces are reported as landed.

## Current Goal
Launch-readiness closeout:
- Deploy to VPS `109.104.153.228`.
- Apply migrations 0048-0049 and 0060 to production Supabase.
- Run the 30-day zero P1/P2 Sentry incident window before calling beta fully live.

## Supplier Identity + Evidence Status Split
31 Jul 2026 - Complete, in the working tree. Triggered by "why does
/admin/evidence say 11,320 need review?", which turned out to be two defects
stacked on each other.

Architectural decisions worth keeping:

- **Superseding a citation is not a problem, and no longer looks like one.**
  `supersede_claims` wrote `stale` — the verifier's word for "the cited page no
  longer contains this value" — for the routine case of re-scraping a page. The
  worklist therefore counted ~11.9k non-problems while the verifier had never
  run once (`evidence_verifications` was empty), and grew by ~5,800 per
  `bkmea_detail` run without bound. Migration 0087 adds a `superseded` status
  that sits outside every needs-review filter.
- **But supersession is classified, not assumed.** Retiring everything silently
  would have hidden the second defect. The rule (writer and migration agree):
  same `url_hash` -> `superseded`; different URL but same value -> `superseded`;
  **different URL asserting a different value -> `contradicted`, and stays
  visible**. `evidence_documents` is unique on (url_hash, content_sha256), so a
  refetch of a changed page keeps its url_hash — that is what distinguishes "the
  page moved on" from "another page disagrees".
- **Contact overlap is not identity.** 82 suppliers held BKMEA member records for
  genuinely different companies. Bangladesh RMG groups run legally distinct
  factories off one switchboard and one group mailbox, and `_find_existing`
  Pass 2/3 merged on email or phone with no name check: ABANTI COLOUR TEX with
  CRONY APPARELS, SWEATER HEAVEN with FATULLAH FASHION, ABONI KNITWEAR with
  ABONI TEXTILE. Both passes now require a name floor (85) below the fuzzy
  threshold — the contact is corroboration, so the names need only be
  recognisably the same company. A duplicate supplier is visible and mergeable;
  a conflation silently publishes one factory's data under another's name.
- **`token_sort_ratio` is blind to the signal that separates these names.** It
  sorts tokens before comparing, so COTTON FAIR vs FAIR COTTON scores 100 and
  H. R TEXTILE MILLS vs G. R TEXTILE MILLS scores 94 — both over the 92
  threshold, both different companies. Pass 4 now also requires an
  order-sensitive `fuzz.ratio` over threshold, and forbids swapping one leading
  initials block for another. Pinned in
  `etl/tests/test_supplier_dedup_guards.py` against the real observed pairs, in
  both directions: conflations must not merge, true variants must still merge.
- **Max-merge hides downward corrections.** `backfill_profile_columns.py` uses
  `greatest()`, so when BKMEA corrected KNIT GUARD APPARELS from 150 sewing
  machines to 36, the profile kept 150. Known, not yet fixed — it needs a
  per-source current-value rule rather than a running maximum.

**Applied to production 31 Jul 2026** (main `bf9647d`). Migration 0087 took
needs_review from ~11.9k to 881, with 12,551 claims filed as `superseded`. The
unmerge split 40 groups into 39 new suppliers (10,245 -> 10,284) in one
transaction, taking conflated suppliers from 82 to 47; `backfill_profile_columns.py`
recomputed the derived columns afterwards. The unmerge moves source records and
evidence claims only; buyer-facing rows (saved_suppliers, message_threads, orders,
claim_requests) stay with the surviving supplier because there is no honest way to
know which company the buyer meant.

The 47 remaining are deliberate: BKMEA re-listing one company under two
membership numbers (a different base number opens the question, the names settle
it), or records with no scraped name, where inventing one is worse than leaving
it. One duplicate source record is stranded on CRONY FASHION LTD — two parents
each held a scrape of the same page and `source_records` is unique on
(supplier_id, source_id, source_ref).

Two things make this durable rather than a one-off cleanup:

- **`ops/deploy_vps.sh` now builds the etl image too.** It built only web. The
  etl service bakes the pipeline source in and cron invokes it with
  `docker compose run`, which reuses the existing tag — so the guards went live
  in the web container and were *absent from the scrapers that needed them*,
  while `/api/health` reported the new commit and the deploy looked clean. The
  next BKMEA run would have re-merged everything just split apart. Web and etl
  are one commit and must be built as one.
- **`ops/check_supplier_conflations.py`**, daily at 03:17 via
  `ops/conflation_check_cron.sh`, on the assumption the guards will eventually be
  circumvented. It reuses `_names_compatible`, so detection cannot drift from the
  rule it polices. A check that cannot run also alerts — otherwise a broken DSN
  disarms it silently. `ops/` is mounted rather than baked (the etl Dockerfile
  copies only `etl/` and `supabase/`).

## Firecrawl Acquisition Layer + Verified Provenance
29 Jul 2026 - Complete, in the working tree, from the accepted plan
`firecrawl_acquisition_layer`. Acquisition is now a separate concern from parsing
and persistence, and every stored fact carries a checkable citation.

Architectural decisions worth keeping:

- **Firecrawl replaces the acquisition concern only** (Hard-Rule-4 exception,
  founder-approved 29 Jul 2026, recorded in `context/architecture.md`). Parsing
  and persistence stay in our Python, so Hard Rule 5 field fidelity is never
  delegated. Extraction is deterministic at 1 credit/page; Firecrawl's LLM `json`
  mode is deliberately unused for registry facts.
- **Three adapters behind one interface** (`etl/acquire/`): Firecrawl for 14 HTML
  sources, Direct (httpx) for the 11 typed feeds Firecrawl cannot express
  (JSON/CSV/XML/XLSX/Power-BI), Local for the 2 on-disk sources. Every source
  emits identical evidence rows regardless of transport — asserted over the whole
  registry in `etl/tests/test_feed_sources_acquire.py`, not left to convention.
- **A citation is a URL plus a locator plus a verbatim excerpt** (migration 0084:
  `evidence_documents`, `evidence_claims`, `evidence_verifications`,
  `evidence_monitors`, `firecrawl_webhook_events`). The excerpt is what makes the
  no-dead-links guarantee machine-checkable: a page that returns 200 but has
  dropped the fact is caught, not just a 404.
- **`verify_mode` on each document decides verification depth** — `full` (a GET
  or a file, replays exactly, so a missing excerpt is real drift), `liveness` (a
  Firecrawl action sequence produced the payload; a replay reaches the page but
  not the payload, so a missing excerpt means "could not check"), `none` (a POST
  body cannot be reissued, so it is excluded from the queue and rests on its
  archived Bunny snapshot). Without this split every action-driven and POST-driven
  claim would be marked stale on the first pass.
- **Transient failure never retires a citation.** Timeouts, 403s and 5xx leave the
  last known good state, log `inconclusive`, and double the retry backoff. Only a
  definitive 404/410 orphans claims — and a *missing local file* is inconclusive,
  not dead, because an unmounted raw directory is our problem, not a retraction.
  This is the REZ-30 rule, and it is carried into the UI: `/admin/evidence` lists
  "could not be checked" separately from "checked and no longer supported".
- **XML feeds keep their markup when excerpting.** OFSI and the EU list put their
  payload in attributes (`wholeName="..."`), so stripping tags would delete every
  value and leave every claim unverifiable. Writer and verifier both route through
  `strips_tags_for()`, so an excerpt is re-checked under the rules that produced it.
- **Multi-record responses are excerpted against the single record they describe**
  (`json_record_window`, `_rows_with_raw`). One RSC response carries 200 factories;
  a page-wide search would let a neighbouring factory's worker count stand as this
  one's evidence.
- **Two-tier verification.** Firecrawl `/v2/monitor` on the ~20 index pages each
  source declares via `monitor_targets()` (declared on the source, so an entry
  point cannot change and quietly stop being watched), webhooking
  `/api/v1/webhooks/firecrawl`. That route only authenticates and records — it has
  10 seconds before Firecrawl retries — and the worker drains the inbox. A change
  notification requeues documents by clearing `last_verified_at`; it never
  concludes a fact is wrong, or a cosmetic redeploy would orphan thousands of
  claims. The `verify-evidence` job covers the long tail.
- **Maintenance jobs are registered separately from sources** (`JOBS` vs
  `SCRAPERS`, union `RUNNABLE`). `verify_evidence` and `refresh_monitors` run
  through the same admin queue, timer UI and run history, but a job has no
  transport and no evidence, so folding them into `SCRAPERS` would weaken the
  registry-wide invariant into a convention.
- **Playwright is retired everywhere except `brand_ms`**, which must read a
  per-contributor `x-oar-client-key` out of live iframe request headers — no scrape
  API exposes that. `etl/core/ssl_rsc.py` also stays: both RSC sources still reach
  rsc-bd.org directly for binaries and the direct fallback.

**An excerpt is never taken from a document wider than the record it belongs to.**
On a page carrying hundreds of records, a shared value — `"active"`, a repeated
worker count, a district name — can match a *neighbouring* record, and the claim
would then quote one supplier's bytes as another's evidence. Every multi-record
source therefore narrows to its own slice first, and where that slice cannot be
anchored it passes `NO_EXCERPT` so the claim keeps its URL and locator but goes
unquoted. `NO_EXCERPT` is deliberately distinct from `None`, which still means
"search the document body" and is only sound for single-subject documents; both
are falsy, so `writer.excerpt_source()` tests for `None` by identity and is
pinned by a test. Found in review: `btma_spinning`, `rsc`, `gots`, `epb_web` and
`wrap` all had a page-wide fall-through.

**Normalisation and dedup are unchanged by this work**, which is the point: the
refactor replaced how bytes are acquired, not what happens to values afterwards.
`upsert_supplier_with_source` is called identically — the only edit captures its
return value so evidence can be attached — so every supplier still gets
`make_slug` + `normalize_company_name` + `normalize_phones`, the five-pass dedup
ladder (source_ref → slug → email → phone-overlap → fuzzy name at 92), then
`contact_merge` and `address_norm`. Watchlist sources never insert suppliers at
all; they screen existing ones at a stricter 95. Evidence claims deliberately
store the source's **raw** value rather than the canonical one, because a
citation must quote what was published — normalising it would break excerpt
verification and misstate the source. `bd_place_lexicon.py` and
`lib/bd-place-lexicon.ts` are now held in lockstep by a test that compares pairs
*and* ordering (ordering is part of the contract: `ccepz` must precede `cepz`)
and that asserts a rule-count floor first so it cannot pass vacuously if the
source scrape ever breaks.

**Runs abort before passing a credit ceiling.** `FIRECRAWL_MAX_CREDITS_PER_RUN`
(0 = off) caps billable spend per run, and a source may tighten it via
`max_credits_per_run` but never loosen it. Enforced in `AcquisitionMixin.acquire`
and `acquire_many` — the only two paths every source shares — *before* the call,
priced with `estimate_credits`, because a credit is gone the moment the request
leaves. Batches are checked whole, since a per-item check cannot stop an
overspend already in flight concurrently. Exceeding raises `CreditBudgetExceeded`
rather than stopping quietly: a half-scraped registry that looks complete is
worse than a failed run, because it silently ages out every record it never
reached. Only the Firecrawl transport is charged; direct and local are exempt.
`credits_spent` now tracks true spend on the mixin, separate from the existing
`credits_used`, which counts only cited documents — the gap between the two is
spend that bought nothing citable. Verified live: with the ceiling at 1, exactly
one page was fetched and the second was refused.

**Firecrawl resolves hrefs against the page URL before returning HTML**, and that
silently fabricates data. BGMEA renders an absent website as `<a href="">`: read
directly the href is empty and correctly becomes None, but Firecrawl returns it
as the member's *own profile URL*, which passes a bare `startswith("https://")`
check and lands on the supplier as its website. `external_website()` in
`etl/core/normalize.py` now screens on host, since a registry's domain is never a
member's own site. Found by `compare-parity bgmea_web --limit 1` — the first live
Firecrawl run of any source — which is precisely the class of bug the harness
exists to catch, and an argument for running it per source before cutover rather
than trusting unit tests. Audited the other five href extractions: `bgapmea`
takes its website from label text rather than an href, `gots` and `btma` from
JSON, and the rest are navigation links where absolutisation is harmless. The one
latent case the audit turned up is now closed too: `bkmea_web` built `detail_url`
from an href, so a blank one would have absolutised to the listing page and been
stored as that member's detail link. It is now derived from the id parsed out of
the href, which also settles relative-against-absolute hrefs on one spelling —
the same shape `epb_web` and `bgapmea_web` already use. Nothing downstream
regressed because `bkmea_detail` selects on `bkmea_detail_id`, never the URL.

Firecrawl smoke test: `compare-parity bgmea_web --limit 1` → PASS (1 record,
identical across transports). 5 credits spent in total, all of it deliberate.
`compare-parity` writes nothing to the database, which is what makes it the right
first live test while migration 0084 is still unapplied.

Verification run locally: `python -m pytest etl/tests -q` → 332 passed;
`npx tsc --noEmit` clean; `npm test` → 159 passed; `ruff` clean across every file
this work touches. Firecrawl auth confirmed working against the live API. Migration 0084 parses under libpg_query (68 statements) via
`python ops/validate_sql_syntax.py` — syntax only, which cannot catch an
unresolvable column reference.

Fixed 31 Jul 2026 (initially deferred, pulled forward because it bills real
money): `etl/jobs/barikoi_geocode.py` re-billed every address the place lexicon
rewrites, on every run. `_store()` keyed the cache with `normalize_key()` (lexicon
applied) while `_list_pending()` looked up with plain lowercase-and-whitespace SQL
(no lexicon), so any address containing a renamed district — Chittagong→Chattogram,
Comilla→Cumilla, Jessore→Jashore — never matched, was re-selected as pending, and
cost 2 Rupantor calls again. `on conflict do nothing` hid it and the run counted the
re-geocode under `resolved`, so the only symptom was quota burn.

The fix moves the pending decision out of SQL into a pure `select_pending`, so
`normalize_key` is the only thing in the system that computes a cache key. Porting
the lexicon into SQL instead was rejected: it would have created a third copy to
hold in lockstep, and two already needed a dedicated parity test.

**Measuring it against production corrected the diagnosis, and found something
worse.** `normalize_key` only gained the lexicon in REZ-28 (28 Jul 2026), so the
cache held two generations of key. Of 17,973 rows: 14,568 the lexicon does not
touch, and 3,405 keyed by the pre-REZ-28 raw spelling. Canonical-keyed rows:
**zero** — so the re-billing had not actually cost anything yet. The job had not
run since REZ-28, and the bug was armed rather than firing.

The live harm was the other direction. Those 3,405 raw-keyed rows all hold real
coordinates, and the app's read path applies the lexicon, so it was looking for a
key that is not there: **every supplier in a renamed district had silently lost its
map pin when REZ-28 shipped.** The map fails closed by design — a cache miss yields
no pin and no error — which is why nobody saw 3,405 geocodes go dark.

Repaired in place on 30 Jul rather than by re-geocoding: `address_raw` is stored
next to the key, so the canonical key is recomputable for every row without asking
Barikoi anything. `ops/rekey_geocode_cache.py` updated 3,344 rows, 0 failures. The
remaining 61 are duplicates, not gaps (54 already have a canonical row serving the
app, 7 collapse onto a shared key). Free and instant where the backfill would have
cost 6,688 Rupantor calls for the same result, and reversible — the previous key is
`raw_key(address_raw)`.

The audit after the re-key is the clearest statement of why the code fix matters:
pending is now **0 calls** under the new scan and **6,688** under the old one. The
old code against the repaired data would re-bill the entire cache on every run.
`ops/audit_geocode_cache.py` re-runs that comparison read-only at any time. Full
write-up in `context/feature-specs/spec-barikoi-geocode-cache-key-leak.md`.

Not yet verified, and to be checked before deploy:
- **The `Dockerfile` base image change is unbuilt locally** (no Docker on the dev
  machine). It moves from `mcr.microsoft.com/playwright/python:v1.47.0-jammy` to
  `python:3.12-slim-bookworm` plus `playwright install --with-deps chromium`,
  since Chromium is now the only browser used. Build it before deploying.
- ~~Migration 0084 has not been applied~~ **Applied to production 30 Jul 2026**
  via the Supabase MCP, along with 0085. Verified after apply, not just assumed:
  5 tables with RLS on, 6 functions, 18 indexes, 4 triggers, and an allow-list of
  28 codes with `brand_inditex` absent and `verify_evidence` / `refresh_monitors`
  present. The `service_role` grant on `firecrawl_webhook_record` matters and is
  confirmed present — revoking the function from `public` also removes the
  implicit grant the webhook route relied on, so without it every delivery 500s
  while every test still passes.

  Access was proven rather than inferred (`ops/verify_evidence_access.py`): with
  the anon key, all five admin RPCs answer 401 "admin only", the webhook function
  answers 401 "permission denied", and direct reads of all three tables answer
  401. The advisor lists those RPCs as anon-executable, which is true of 71
  pre-existing RPCs here too — the real control is the `admin_etl_assert_admin()`
  call inside each one, per hard rule 7.

  One sharp edge checked and cleared: `etl_job_queue` and `etl_schedules` both
  CHECK `scraper_code` against this allow-list, and dropping `brand_inditex` from
  it is a narrowing, not the widening the migration header describes. Postgres
  does not re-validate existing rows, but it does re-check on UPDATE, so a live
  row for a removed code would break the moment a worker touched it. There are no
  `etl_schedules` rows and exactly one `etl_job_queue` row: a terminal `failed`
  job from 26 Jun whose error is "no disclosure file link found on
  inditex.com" — the very evidence for retiring the source. Terminal jobs are
  never picked up or updated, so it cannot trip the constraint, and it is left in
  place deliberately as the audit trail for that decision.

  0085 exists because the advisor flagged a mutable `search_path` on 0084's
  url_hash trigger function once it was live. Kept as its own migration rather
  than folded back, since editing an applied migration makes a fresh database and
  production disagree about history even when they agree about schema. 11
  pre-existing functions still carry that finding, `touch_updated_at` among them;
  out of scope here.
- No Firecrawl monitors are registered yet: `refresh_monitors` needs
  `FIRECRAWL_API_KEY`, `FIRECRAWL_WEBHOOK_BASE_URL` and
  `FIRECRAWL_WEBHOOK_SECRET` set, and refuses to register a monitor that would
  report to nobody.

### Live parity sweep, 29 Jul 2026

Every Firecrawl source was compared against its direct baseline on the real API,
about 60 credits in total. Nine sources are identical across transports:
`bgmea_web`, `bkmea_web`, `bkmea_detail`, `bgapmea_web`, `brand_asos`,
`brand_hm`, `brand_next`, `ilab_tvpra`, `cbp_wro`. Two need a product decision
(below) and four are legitimately not comparable.

The sweep found more than the earlier website-absolutisation bug, and the common
thread is worth stating plainly: **the dangerous failure is not an error, it is
silence.** Four separate paths could fetch successfully, parse to zero rows, and
report success. On a forced-labor watchlist that means every supplier screens
clean; on a brand disclosure it means existing suppliers quietly stop being
refreshed. Fixes therefore favour raising loudly over returning empty.

What was fixed:

- **The harness could not test sanctions sources at all.** It keyed every record
  on `source_ref`, but watchlist sources yield `SanctionEntry`, keyed on
  `entry_ref` with no `payload`. All three raised `AttributeError` and were
  silently unvalidated — the sources where a false positive brands a real factory
  as sanctioned. `record_ref` / `comparable_fields` now handle both shapes, and a
  record carrying neither key is refused rather than collapsing every entry onto
  one dictionary key. `raw` is excluded from comparison: it is our own capture of
  the scrape, not a publisher assertion, so it differs by design.
- **`cbp_wro` reported an empty Withhold Release Order list via Firecrawl.** CBP
  redirects the listing to a Tableau dashboard which is still on cbp.gov and
  still carries three `<table>` tags, so the old gate (`"<table" in text`) waved
  it through; every table was then skipped and zero entries yielded without
  error. Direct meanwhile gets a 403 and correctly falls back to Wayback, which
  is why only one transport was wrong. The gate now requires a table whose header
  names both the entities and merchandise columns, using the same predicate the
  parser uses so the two cannot drift, and a readable page parsing to zero
  entries now raises.
- **`brand_next` had two independent breakages.** Next renamed the tier 1 file
  from `T1 2025.pdf` to `PLC LIST FEB 2026 - TIER1.pdf`, so it was no longer
  found; the tier is now read from the decoded filename, never the whole URL,
  because the folder is called `Tier 1 -2 - 3 lists` and a URL-wide match would
  have picked up the Tier 2 and Tier 3 lists sitting beside it and published
  downstream subcontractors as direct manufacturers. They also changed the PDF's
  internal layout, inserting `Site Id` and `Country` ahead of the old first
  column, so positional indexing found no country and produced zero rows. The
  parser is now header-driven and handles both layouts: 397 Bangladesh rows,
  identical on both transports.
- **`brand_hm` cited two different URLs for one file.** H&M's filename really
  contains a space; direct returns it literally and Firecrawl percent-encodes it,
  so the stored citation depended on the transport. `canonical_url` in
  `etl/core/normalize.py` converges both on the encoded form without
  double-encoding an already-encoded URL.
- **Soft 404s are now detectable.** `AcquiredDoc.landed_on_site_root` reports a
  request for a specific page answered with the homepage, which is how sites
  retire pages while returning 200. This matters for provenance specifically: a
  citation is a promise that a URL shows a human the cited fact, and a homepage
  cannot keep it.
- **The harness no longer cries wolf.** A sweep that reports things it never
  could have validated as regressions gets ignored, and then a real failure gets
  ignored with it. `SKIP` is now distinct from `FAIL` (exit code 3), and is never
  treated as a pass. `rsc_reports`, `rsc_updates` and `rsc_documents` declare
  `yields_records = False` because they override `run()` and leave `fetch()` a
  stub, so there was never anything to diff. `sa8000` has no direct baseline at
  all. `uflpa` is skipped because DHS serves our address a 403 while Firecrawl
  returns the list — the migration working, not failing.
- **`compare-parity` reports credits spent**, so a sweep can be costed.
- One sampling trap worth remembering: `bkmea_detail` "failed" only because it
  fetches 590 detail pages concurrently and does not yield in a fixed order, so
  `--limit 1` sampled a different factory on each side. It is 8/8 identical at
  `--limit 8`. The report now says so instead of implying a data conflict.

Two sources are blocked on a decision rather than on engineering:

- **`brand_inditex` is retired** (decided 29 Jul 2026). Its landing page now 200s
  and redirects to the Inditex homepage, and more fundamentally Inditex does not
  publish a factory-level supplier list at all: only aggregate country counts,
  with the actual list shared privately with IndustriALL Global Union under their
  Global Framework Agreement. Know The Chain penalises them for exactly this. No
  selector fixes a disclosure that does not exist, so the scraper was removed from
  all four places that referenced it — the Python registry, the admin catalog and
  transport map, and the SQL allow-list in 0084 — each with a comment saying why,
  so it does not get re-added. `BRAND_INDITEX` stays in `upsert.py`'s tier map on
  purpose: rows ingested before today still need their tier resolved.
- **`brand_primark` is pointed at the wrong document**, and is queued as its own
  spec (`context/feature-specs/spec-brand-primark-global-sourcing-map.md`). It
  parses the Modern Slavery Statement, which is narrative prose, so zero rows is
  the correct output from the wrong file. Primark does publish a real factory list
  — the Global Sourcing Map at `globalsourcingmap.primark.com`, with factory
  names, addresses, worker counts and gender splits, and an Excel export.
  Deferring is safe because it now fails loudly rather than reporting an empty
  supplier list.

## Recent Admin Scraper Ops
26 Jun 2026 - Admin scraper operations implemented from the accepted plan.
Scope adds `/admin/sources`, admin-only ETL queue/schedule RPCs and API
routes, the `etl_job_queue` / `etl_schedules` migration, a VPS cron runner
for due schedules and queued jobs, and a shared scraper catalog that includes
BGMEA, BKMEA, BGAPMEA, EPB, BTMA, RSC, WRAP, OEKO-TEX, GOTS, SA8000,
sanctions/regulatory, and brand-disclosure scrapers. ETL execution remains in
the Python/Docker ETL service; the web app only enqueues and reports.
`pnpm typecheck`, `pnpm lint`, Python compile checks, `python -m etl.cli list`,
and `python -m etl.cli run-queue --limit 0` pass. Lint still reports
pre-existing warnings outside this work.

27 Jun 2026 - Admin scraper monitoring upgraded and deployed to VPS
`109.104.153.228`. Scope adds live progress counters, heartbeat timestamps,
per-job event timelines (`etl_job_events`), an admin polling status API, and a
live `/admin/sources` monitor with elapsed time, visual record bars, and
operator-facing action text. Production migration
`0064_admin_etl_live_monitoring.sql` applied and verified; web rebuilt and
restarted healthy. Local verification passed: `python -m py_compile` for ETL
progress files, `pnpm typecheck`, and `pnpm lint` (same pre-existing warnings).
Production smoke: `/api/health` OK, `docker compose ps` healthy, cron installed,
and `docker compose run --rm etl run-queue --limit 0` returned processed 0 /
failed 0.

26 Jun 2026 - Scraper operations deployed to VPS `109.104.153.228` via a
tmux-backed finish deploy after the first SSH build disconnected. Production
Supabase migration `0063_admin_etl_scraper_ops.sql` applied and verified,
`sourcebd-etl:latest` and `sourcebd-web:latest` built, web container recreated
healthy, and the scraper queue cron installed:
`/opt/sourcebd/ops/scraper_queue_cron.sh` every minute. Final smoke checks:
`/api/health` OK, `docker compose ps` healthy, ETL CLI lists `wrap`, and
`docker compose run --rm etl run-queue --limit 0` returns processed 0 / failed 0.

## Recent Admin Repair
26 Jun 2026 - Admin UI overhaul completed in the working tree under
`context/feature-specs/spec-ADMIN-CONSOLE-repair.md`. Scope is presentation
and operator usability across `/admin`, using the existing SourceBD app
surface primitives and vendored Magic UI-style layout components without new
dependencies or backend changes. Changes add shared admin UI wrappers, polish
supplier and queue workflows, migrate admin moderation/list/detail pages to a
consistent responsive system, and add the review queue to admin topbar quick
navigation. `pnpm typecheck` and `pnpm lint` pass; lint still reports
pre-existing warnings outside the touched admin work.

26 Jun 2026 - Admin console repair completed in the working tree under
`context/feature-specs/spec-ADMIN-CONSOLE-repair.md`. Changes add a unified
`/admin/queue` hub, clearer supplier publication feedback and profile
revalidation, operator-focused supplier list/detail labels, and moderation
page polish. `pnpm typecheck` and `pnpm lint` pass; `pnpm build` still fails
on Windows before compilation with `.next/trace` EPERM.

## Recent Barikoi Integration
6 Jul 2026 - Barikoi location services integrated (founder-approved Hard-Rule-4
exception; see architecture.md → Maps/geocoding). Web: `lib/barikoi.ts`
(server-side Rupantor resolution, DB-cache-first with bounded live fallback),
`components/supplier/locations-map.tsx` (`bkoi-gl` map, forest pins, no scroll
hijack), wired into the profile Locations card on both app and marketing
routes. ETL: `etl/jobs/barikoi_geocode.py` + `geocode-addresses` CLI command
backfill `public.address_geocodes` (mig `0077_address_geocodes.sql`).
Verified: typecheck/lint/py_compile pass; Rupantor API key smoke-tested OK.
PENDING OPS: migration 0077 is NOT yet applied — Supabase pooler ports
5432/6543 are unreachable from the dev machine; apply from the VPS
(`python -m etl.cli migrate` or psql) and then run
`python -m etl.cli geocode-addresses --limit 500` to start the backfill.
Until then the profile map works via live geocoding only (first 4 addresses
per profile, memoised in-process).

## Recent Map UX
28 Jul 2026 - REZ-30: Supplier map enrichment pack shipped (12 points).
`components/supplier/locations-map.tsx` rewritten again. **Fullscreen removed** — the map is
taller inline instead (380 / 470 / 540px), since fullscreen hides the address list that gives
the pins meaning. Pins now carry two independent channels: address kind (head shape + tone,
numbered to match the list rows) and geocode precision (filled = premises, hollow =
area-level). Confidence keys off `confidence_pct < 70` only — `address_status` is
"incomplete" on every cached row, so a cue based on it would flag 100% of pins and say
nothing (~39% of the cache is below 70, so the cue discriminates). Pins within 60 m get a
pixel spiderfy so each stays clickable. Added an on-map site switcher (arrow keys / Home on
the focused map region), straight-line distance sentence, curated-landmark context chips, a
live scale bar, `?site=N` permalinks via `history.replaceState`, GeoJSON pin export, and an
optional "other published SourceBD sites nearby" layer. New `lib/geo.ts` (haversine, bbox,
centroid, span, spiderfy, metresPerPixel), `lib/bd-landmarks.ts` (curated ports/airports/
EPZs/belts), `lib/nearby-suppliers.ts` + `app/api/suppliers/nearby` (rate-limited via
`lib/rate-limit/limits.ts`).

Three real bugs found and fixed while verifying, worth remembering:
1. **`GROUP_KIND` lived in a `"use client"` module** and was imported by the server component
   `profile-overview-tab.tsx`. A plain object imported out of a client module is a
   client-reference proxy, not the object, so every lookup returned `undefined` and every pin
   silently fell back to kind "other" — the map legend contradicted the address list. The
   table now lives in `lib/dedup-addresses.ts` as `CATEGORY_BY_GROUP` (server-safe) and the
   client re-uses it. **Lesson: never import a value table from a `"use client"` file into a
   Server Component; it fails silently, not loudly.**
2. **Attribution did not follow the basemap.** The satellite style is Barikoi's but its
   imagery is Stadia/Airbus/CNES/PlanetObserver, so crediting only Barikoi + OSM over
   satellite was factually wrong. `MAP_ATTRIBUTION` is now per-style.
3. **The nearby layer cached its own failures.** One dropped request wrote `[]` into the
   per-anchor cache, so the layer stayed empty for the rest of the session and the strip
   claimed "No other published sites within 6 km" — asserting a fact it had not established.
   Failures are no longer cached, and the strip distinguishes loading / failed / genuinely
   empty. This also explained an intermittent smoke failure that was really a cold
   dev-server compile hiding behind misleading copy.

Verified with a throwaway Playwright pass over a 4-site profile (`fakir-apparels`) and a
single-site profile: pin/legend/popup agreement, no fullscreen control anywhere, scale bar,
distance + landmark chips, keyboard cycling and permalink round-trip, satellite attribution
swap, nearby layer (12 sites, spiderfied), GeoJSON payload fields, deep-link cold load, and
mobile 400px layout. `pnpm test` 143/143, `pnpm typecheck` + `pnpm lint` pass (same
pre-existing warnings outside this work). Zero new Rupantor/live Barikoi geocode calls.

28 Jul 2026 - REZ-29: Supplier profile Locations map UX overhauled. `components/supplier/locations-map.tsx`
rewritten: satellite ↔ street style toggle (`barikoi_satellite` / `osm_barikoi_v1`), campus default
zoom 16, per-style maxZoom (19 / 20), one overview map for multi-site suppliers (fitBounds +
click-to-focus flyTo with "All sites" back button), fullscreen mode (Esc or ✕ exit, map.resize on
toggle — **superseded by REZ-30, which removed fullscreen**), copy lat/lng to clipboard + Open in
Google Maps link in per-pin popup (**the Google Maps link was since removed**). New
`components/supplier/locations-section.tsx` client wrapper holds shared `selectedIndex` state
binding map ↔ address list (address row click → map flyTo; map pin click → row highlight). Marker
index mapping pre-computed from `geocodeLocations` return order and stored as `markerIndex: number |
null` on each `SerializableLocation`. `profile-overview-tab.tsx` updated to use `LocationsSection`
(inline `AddressRow` and `GROUP_ICON` removed; `ProfileAddressesCard` updated similarly). Zero new
Barikoi geocode/Rupantor calls. `pnpm typecheck` + `pnpm lint` pass (same pre-existing warnings
outside this work).

## Recent Address Canonicalization
28 Jul 2026 - REZ-28: Shared BD place lexicon implemented. `lib/bd-place-lexicon.ts`
(`applyPlaceLexicon`) + `etl/lib/bd_place_lexicon.py` (`apply_place_lexicon`) carry
the founder-confirmed 50+ pair lexicon (A1–A2 new pairs, B1–B7 UI transliterations,
C1 district corrections, C2 locality/EPZ aliases; D negatives enforced by omission:
Sreepur≠Sripur, bare Nawabganj≠Chapainawabganj). Wired into: (1) `normaliseAddressKey`
in `dedup-addresses.ts` — replaces the old inline `TRANSLITERATION_PAIRS` so variant
spellings now merge into one `UniqueLocation` on the profile Locations card;
(2) `normalizeAddressKey` in `barikoi.ts` — geocode cache lookups canonicalize before
querying `address_geocodes`, so one cached row resolves both spellings without any new
Barikoi API calls; (3) `normalize_key` in `etl/jobs/barikoi_geocode.py` — future
geocode entries stored under the canonical key. `pnpm test` 108/108 pass; pytest
74/74 pass; `pnpm typecheck` + `pnpm lint` + `python -m py_compile` pass (same
pre-existing lint warnings outside this work). Raw source strings unchanged.

## Recent Map Update
27 Jul 2026 - REZ-27: Supplier profile Locations map switched to Barikoi
satellite imagery (`barikoi_satellite` style) at building-level zoom 18.
Companies with 2+ unique geocoded addresses now render a separate
`AddressMap` instance per address (each labeled with its address text)
instead of a single multi-pin fitBounds view. Single-address profiles keep
one map. No new dependencies; no Rupantor re-geocoding — all maps reuse
cached coordinates from `address_geocodes`. `pnpm typecheck` + `pnpm lint`
pass (same pre-existing warnings outside this work). Touch: only
`components/supplier/locations-map.tsx`.

## Recent Frontend Polish
23 Jul 2026 (homepage promotion) - The founder-approved /home-demo
composition is now the production homepage at `app/(marketing)/page.tsx`
(hero dashboard demo → MoatStats → EvidenceAnatomy → BuyerWorkflowBento →
RecordNetworkSection → IsometricDecisionPath → closing CTA), keeping the
old homepage's SEO metadata (title/description/keywords/canonical/OG/
twitter) and Organization JSON-LD. `/home-demo` is retired to a
`permanentRedirect("/")`. The scenic light footer (skyline artwork +
blended wordmark, formerly `demo-footer.tsx`) is now the shared
`components/marketing/footer.tsx` `MarketingFooter`, mounted globally by
the (marketing) layout — the deep-forest footer and the page-scoped
`:has()` footer-hiding hack are gone; `demo-footer.tsx` deleted.
Bugbot review fixes (pixel-neutral): (1) nav/footer `/#sources` and
`/#how-we-verify` links now resolve — anchor wrappers with `scroll-mt-24`
around EvidenceAnatomy (`#sources`) and RecordNetworkSection
(`#how-we-verify`); (2) EvidenceAnatomyStage auto-advance now PAUSES while
a tab holds visible keyboard focus (`:focus-visible` tracked on the
tablist, progress bar `animationPlayState: paused`) so the roving tabindex
can never desync (WCAG 2.2.2) — pointer users keep uninterrupted
rotation. Known-and-accepted: the Registries demo panel still pads to six
rows with peer registries/plausible IDs — the stage never names the
supplier (anonymous illustrative composite, IDs part-blurred), founder
approved the rendering; flagged for future legal review alongside the
brand-strip wording. Typecheck + lint pass; dev smoke: `/` 200 with both
anchors + scenic footer + JSON-LD, `/pricing` renders the global scenic
footer, `/home-demo` redirects to `/`.
DEPLOYED 23 Jul 2026: merged to main (PR #16, c8c1812; main branch was
restored at 22f5093 after being deleted on GitHub, then result-card.tsx
merge conflicts resolved keeping the development side — it subsumed
main's #14 mobile-spacing fix) and deployed to VPS 109.104.153.228 via
`ops/deploy_vps.sh --ref=main --require-git` in tmux. Rollback ref
8b0af65 in `.deploy/previous-sha`. Production smoke green:
sourcebd.net `/` + `/api/health` + `/discover` + product icon +
skyline art 200, `/pricing` global footer, `/home-demo` redirect doc.
The deploy script's "public health check failed" warning was transient
(Caddy active, public health 200 immediately after).

23 Jul 2026 (hero dashboard demo) - /home-demo hero product window is now
an animated `HeroDashboardDemo`
(`components/marketing/home/hero-dashboard-demo.tsx`, mounted by
`HomeHero`): the approved static buyer dashboard plus one looping ~22.6s
"Find matches" workflow — cursor opens Find matches, completes the REAL
Smart Match wizard (Step 1 types "knit shirts" + Factory, Step 2 OEKO-TEX
+ BGMEA, Step 3 review pills → Find matches → "Matching…"), the real
405-matches results render as hero-scaled `DiscoverResultCard` replicas
with real "Matched on" pill grammar (production top result Apparel
Promoters Ltd, 405/24 counts, Load-more affordance), the buyer follows the
top card via the SaveButton bell, and the dashboard returns with the
Saved-suppliers tile/badge odometering 10→11 before a seamless loop
(counts persist across the seam; invisible resets mid-story). Founder
correction honored: the match surface is a faithful replica of
/app/match + PageHeader + StepBar + proto-card steps — no invented search
rail/profile panel. Animation language is byte-compatible with
`BuyerWorkflowBento` (event-mark clock, ~55 renders/loop, same cursor
SVG/easing, flip-on-release, reduced-motion = settled static dashboard).
Mobile (<md) is the true product shell: bottom tab bar, stacked wizard,
native smooth pane auto-scroll that reveals each upcoming control above
the tab bar. Typecheck + lint pass; Playwright-verified across the loop at
1440px and 400px (wizard steps, results, follow, 11/11 return, loop seam).
(`components/marketing/home/demo-footer.tsx`) modeled on a founder
reference: light link registers, neutrality disclaimer (legal copy
unchanged), then a full-bleed flat-vector Bangladesh RMG industrial
skyline (`public/marketing/footer-rmg-skyline.png`, AI-generated,
strictly forest-green shades) with an oversized "SourceBD" watermark in
the sky. Band background #F4F7F5 is sampled from the artwork's flat sky
so band and art read as one surface; the watermark uses
`mix-blend-mode: darken` so skyline layers occlude the letterforms like
the reference. Shared `MarketingFooter` is hidden on this route only via
a page-scoped `#main-content:has(main[data-demo-footer]) + footer` rule;
production `/` and all other marketing pages keep the deep-forest
footer. Typecheck + lint pass; Playwright-verified desktop 1440px +
mobile 400px.

23 Jul 2026 (buyer workflow choreography pass) - Founder's fourth review
(9.3/10; "stop adding features, refine choreography only") addressed in
`buyer-workflow-bento.tsx`, timing/easing only: pre-wake — the next
chapter's card un-dims 200–250ms before its chapter starts (conversation
card brightens while the plane is in flight) so the eye never hunts;
longer ease-in-out on state changes (card dim 500ms, shortlist +
compliance row highlights 500ms, RFQ field fills 300ms, MSA ladder
cross-fades 300ms); shortlist outro extended — row highlight releases
~350ms into the RFQ chapter instead of cutting; supplier reply gains a
Delivered → Seen receipt ladder; loop reset now STAGGERED per card via
per-card `on()` closures (shortlist resets at 11.05s during the MSA
download click, then RFQ 11.25s, conversation 11.4s, rest 11.5s) so no
single detectable restart frame exists. Follow-up in the same session:
active windows now OVERLAP instead of cutting at chapter boundaries — a
card stays active until its task visibly settles (shortlist through its
highlight release, RFQ through the whole plane flight, conversation while
the buyer is still typing, compliance until the shield check settles), so
focus never leaves a card mid-animation. Handoff redesign in the same
session: the paper-plane flight is REMOVED entirely (any second traveler
read as a duplicate/morphing pointer) — the shared cursor never hides or
changes shape and its 700ms glide card 2 → 3 is the only cross-card
motion (`planeLaunch`/`planeArrive` marks renamed
`handoffStart`/`handoffEnd`). PaperPlaneTilt remains only as static
icons. MSA card also got a spacing pass (wider column gap/padding,
looser checklist rhythm) + sequenced status crossfades (incoming label
delays 100ms) after a cramped-text review. Grid-level premium spacing
pass (founder-adjusted): UNIFORM proportional gutters (mobile gap-6, md
gap-5, xl gap-6 — founder rejected asymmetric x/y gaps); card padding
xl:p-6; card header→demo offset mt-5; card shadow lightened from
0_18px_40px_-34px/0.22 to 0_8px_20px_-16px/0.10 (heavy ambient shadow
read as over-elevated on the active card). Compliance chapter payoff
added: cursor now CLICKS the GOTS alert row (compClick 8.25s) and a
certificate-alert detail popover opens under the row (compRelease 8.4s →
compPopClose 9.15s) — mono kicker, cert/supplier, expiry + renewal
reminder lines, "View certificate" hint; new marks slot between existing
ones so no other timing shifted; hidden in reduced motion (transient).
Sequencing pass (founder pass 5, SUPERSEDES chapter-overlap timing):
loop retimed 12s → 22s, chapters strictly sequential — each card's last
animation settles, ~1s dwell, then the cursor departs; only remaining
overlaps are pre-wake un-dim + cursor glides. Send button label now
flips to "Sending…" on press RELEASE (sendRelease), never at press-down.
Active windows = chapter start → cursor departure. All intra-chapter
beat deltas preserved. Typecheck + lint pass.

23 Jul 2026 (buyer workflow motion-quality pass) - Founder's third review
(video frame-by-frame) addressed in `buyer-workflow-bento.tsx`, timing and
choreography only (no visual redesign): chapters now overlap 150–250ms so
each action reads as causing the next (cursor leaves while the shortlist
toast settles; plane launches while the success copy settles; compliance
starts while the buyer is still drafting; MSA spins up while the shield
check settles); Send RFQ → success is a strict causal chain (click →
button "Sending…" → 300ms beat → panel wakes → success); compliance row
gets a temporary gray+border emphasis at the update moment then relaxes;
MSA runs Queued → Generating → Preparing → Ready → Download-enabled as
separate beats; completed cards keep near-invisible ambient life (new
`AmbientPulse` on toast/sent/ready checks, draft caret keeps blinking);
bookmark click gains a one-shot neutral confirmation ripple. Typecheck +
lint pass.

23 Jul 2026 (buyer workflow bento review pass) - Founder frame-by-frame
notes addressed in `buyer-workflow-bento.tsx`: continuous shared cursor
now travels bookmark → RFQ → Send → conversation → compliance → MSA
(only yields during the paper-plane handoff); non-active cards dim;
active card gets a neutral left hairline; RFQ right panel is a dormant
"Recipients / Waiting for Send RFQ" state until Send fires, then
Sending… → success; shortlist teaching beat stronger (row hierarchy +
toast pill); conversation keeps Seen + draft typing into the second
half; compliance active row has clearer neutral hierarchy; MSA writes
lines + progressive feature checks + scan while generating. Second-half
pacing tightened. Typecheck pass.

23 Jul 2026 (buyer workflow bento) - /home-demo section 4 replaced:
`CapabilityFeatureGrid` swapped out for a new `BuyerWorkflowBento`
(`components/marketing/home/buyer-workflow-bento.tsx`) built from the
founder's enterprise motion spec + mockup. Five cards (follow suppliers /
compose RFQ heroes + conversation / compliance / MSA supporting row) tell
one continuous 12s event-driven sourcing story: cursor follows a supplier
(bookmark fill, 23→24 odometer, ripple), RFQ fields paste-fill and Send
runs Send→Sending→Sent, a tiny forest paper plane (the ONLY cross-card
element, DOM-measured flight so it works on mobile stacks) hands off to
the conversation card (unread badge, reply, typing dots, Quotation.pdf),
compliance updates one certificate row (32→30 days, green dot, shield
check), MSA flips Queued→Generating→Ready, then everything soft-resets
inside the loop with no jump. Ambient motion: 120s confidence-ring drift,
3s status-dot opacity pulse, 4s online-dot breathing. Master clock emits
~30 discrete event marks per loop (no per-frame React renders); all
transitions are transform/opacity/color only. Green is semantic-only
(bookmark, checks, plane, dots, sending state); mockup's fabricated stats
strip intentionally NOT reproduced. Reduced motion renders the settled
end state (SSR-safe via mount gate). Old `capability-feature-grid.tsx` +
buyer-workflow-live-* files kept on disk but no longer routed. Typecheck +
lint pass; Playwright-verified at six story beats, mobile 400px, and
reduced-motion. NOTE: pre-existing hydration mismatch under reduced motion
traced to HeroBackdrop hero-wash animation style + NumberTicker (hero),
not this section.

23 Jul 2026 (founder edit pass 3) - Engine card's database orbit emblem
(generic ringed circle, dead white space) replaced with a compact
"Canonical record" footer row in the same idiom as the processing rows:
brand-forest db icon tile, "Assembling evidence…" while steps run, then
"Verified profile committed" + spring check the moment all five pipeline
steps complete — the footer is now the pipeline's landing state, not an
ornament. Card is shorter; typecheck/lint pass; Playwright-verified in
both states.

23 Jul 2026 (founder edit pass 2) - `IntelligenceEngineStage` refinements:
all greens moved to brand tokens (#1f4d3a / #2d6a4f, no generic #16a34a);
comets are now ONE tiny solid ball per trace (zero-length round dash
traveling the path, 6.5s, staggered) — gray on the ingest side, brand
green on the insight side, with card ports matching the tone; engine
card compacted (300px, tighter paddings, 68px db emblem with a
brand-forest core instead of near-black); processing rows run a
meaningful sequential pipeline (one Live row filling its bar per 2s
step, done rows keep a full bar + check, later rows show "Queued",
cycle resets after all five); column-label corner marks moved inline
into the label flex row so left/right always align; shadows reduced to
the shadow-l1 token + whisper hub glow; radii normalized to the
5/6/8/12/22 token family (rounded-card cards, rounded-hero engine,
rounded-pill tiles/rows, --r-md inner frame + metrics bar). Typecheck
+ lint pass; Playwright-verified at two animation phases.

23 Jul 2026 (later) - `IntelligenceEngineStage` rebuilt 1:1 against the
founder's second reference mockup. Beams are now thin solid light-gray
PCB traces with staggered rounded elbows (outer cards bend later →
nested cascade into each hub) and continuously traveling green packet
dashes (4 evenly spaced per trace via normalized `pathLength`; static
dashes under reduced motion) — replacing the dotted-track AnimatedBeam
comets. Cards gained green edge "ports" the beams anchor to; hubs are a
dark core in a green ring with a soft breathing glow; the engine card
is a double frame with corner ticks, "Source**BD**" two-tone wordmark,
five processing rows (icon tile + segmented green progress bar +
breathing tail + "Live" chip), and a dark database emblem with green
ring + expanding ripples. New chrome per the mockup: top-center "Live
reconciliation" pill, mono uppercase column labels, dotted-grid
patches + corner squares, a 4-metric stats bar (28+/18.7M+/1.1M+/96% —
same real audited values; mockup's illustrative counts NOT copied),
and the "Trusted records. Unified intelligence." caption. Right output
cards gained tiny illustrative mini-graphics (map/bars/dots/doc/check).
`roundedElbowPath` exported from `components/ui/animated-beam.tsx`
(component itself untouched, still used elsewhere). Typecheck + lint
pass; verified via Playwright screenshots desktop 1440px + mobile 400px.

23 Jul 2026 - Founder audit fix pass on the `IntelligenceEngineStage` from
earlier the same day, against a reference mockup screenshot. Fixes: (1)
left source cards now render real on-file provider logos via the existing
`sourceLogo()` helper (BGMEA ×2 "Registry"/"Members", EPB, RSC; NBR and
Certificates keep a neutral glyph fallback — no logo on file) instead of
generic gray icons, matching the `data-pipeline.tsx`/`trust-orbit.tsx`
convention already used elsewhere on this page; (2) every card→hub beam on
a side now shares one fixed elbow fraction (`ELBOW_TO_HUB` / mirrored
`ELBOW_FROM_HUB`) instead of a per-card spread, which was the root cause of
the tangled/overlapping curves near the collector and distributor nodes —
beams now form a clean single bus/spine into each hub; (3) `AnimatedBeam`
gained an opt-in `dashed` prop (dotted PCB-trace track with a slow marching
offset) used here so the base track reads as "carrying data" even without
motion; (4) hub nodes are now a visible dark dot inside one soft
forest-green fill + ring halo (was three near-invisible neutral rings);
(5) engine processing rows now show a title + subtitle per row inside a
light-green icon tile (was a single line, neutral icon); (6) the database
glyph is a forest-green ring badge on white (was a solid black fill); (7)
the metrics bar is wrapped in a bordered card with forest-green-tinted icon
badges (was a bare top border with neutral icons), and the "real-time"
caption gained small dot flourishes on both sides. Metric values stay the
real 28+/18.7M+/4.2M+/1.1M+/96% set from the original spec. `pnpm
typecheck` and `pnpm lint` pass (same pre-existing warnings); re-verified
visually via Playwright screenshots (desktop 1440px, mobile 400px, plus
zoomed hub and engine-card crops).

23 Jul 2026 - /home-demo section 5 ("How the record is built") animation
replaced with a new `IntelligenceEngineStage`
(`components/marketing/home/intelligence-engine-stage.tsx`): a calm,
industrial three-column diagram (six trusted-source cards → collector node →
SourceBD engine card with five live processing rows + database orbit →
distributor node → six verified-output cards), continuous PCB-trace beams
(gray lines, forest-green comets only), a 5-stat metrics bar with one-time
count-up + a small confidence ring, and a dedicated mobile stacked layout.
Scope is the animation only — the section's heading, three-step "how it
behaves" card, and authority-order strip are untouched. Extended the shared
`components/ui/animated-beam.tsx` primitive with `axis` (vertical elbow
routing) and `cornerRadius` (rounded PCB-style corners) props, both opt-in
and backward compatible with existing usages. Removed the now-unused
`record-network-stage.tsx` and its live-Discover-row plumbing in
`record-network-section.tsx` (the new diagram is illustrative, not tied to
one live supplier). Demo page only; production `/` untouched. `pnpm
typecheck` and `pnpm lint` pass (same pre-existing warnings); local
`/home-demo` smoke 200, verified visually via Playwright screenshots at
desktop (1440px) and mobile (400px) widths.

20 Jul 2026 - /home-demo mobile responsive polish completed in the working
tree. Scope is the demo homepage only: phone-first hero/product preview,
section density and wrapping, 44px touch targets, main/demo semantics,
reduced-motion behavior, and off-screen animation pausing. Production `/`,
data contracts, routes, and dependencies remain unchanged. `pnpm typecheck`
and `pnpm lint` pass (same pre-existing warnings). Runtime viewport smoke was
blocked on this Windows machine: both webpack and Turbopack exhausted the
available 8 GB memory while cold-compiling `/home-demo`; trace reported about
10 MB free, so the compile was stopped rather than left thrashing.

19 Jul 2026 - /home-demo polish pass (ad-hoc, working tree). Demo page
only; production `/` untouched. Section order now: hero → MoatStats →
EvidenceAnatomy → CapabilityFeatureGrid → WorkflowAgentsMarquee →
IsometricDecisionPath → VerifiedRecordSteps → closing forest CTA.
Removed ExploreIndexTeaser from the page. Evidence stage restyled from
deep-forest wash to a quiet stone surface (no under-stage glow); section
band `bg-neutral-50`; auto-advance no longer pauses on hover. Buyer
workflow animation: shared `FrameHairlines` inset/inherited-radius so
card corner hairlines do not clip; checklist milestone shadow softened
and top inset to keep the active-row hairline; Due badge removed from
Quality inspection. Local `/home-demo` smoke 200 after warm compile
(cold compile on Windows can take ~60–90s; watch for Next memory
restarts).

15 Jul 2026 - /home-demo audit remediation (38-item founder-selected list)
implemented in the working tree. Scope is the demo homepage only
(production `/` untouched). Structural: sections reordered to hero →
moat stats → evidence anatomy → positioning → live checks → new RSC
safety band → new brand-disclosure strip → decision path → new
explore-the-index teaser → new closing CTA; one shared `Kicker`
(`components/marketing/home/kicker.tsx`), one container (max-w-[1200px]),
two padding steps, hairline border-b separators. Data: MoatStats now
renders certifications_verified, sanctions_lists_screened and a
last_refreshed_at stamp; "corroborated" label corrected to "backed by a
government or association register"; live ≥2-source count in evidence
rail; new sections pull live counts via `discover_suppliers`
(`components/marketing/home/discover-count.ts`) with counts matched
1:1 to their /discover deep-link args. Brand-disclosure strip wording
("disclosed on {brand}'s published factory list", text-only, no brand
logos) is PENDING legal sign-off per frontend-design-spec.md §20 Q4.
A11y/fixes: evidence stage converted to tablist/tab/tabpanel with
arrow-key nav and fluid width (1024-1200px collapse fixed), marquee
grid holes removed (15 cards/15 slots), sub-12px text raised,
neutral-400 contrast failures lifted to neutral-500+. `pnpm typecheck`
and `pnpm lint` pass (same pre-existing warnings); /home-demo smoke
200 on local dev with all new sections rendering live numbers.

30 Jun 2026 - Principal product chip dedup and compound-label split deployed to VPS
`109.104.153.228`. Frontend-only (DB unchanged) in `lib/product-icons.ts`:
spelling correction for common BGMEA harvest typos, singular/plural merge
(Shirt/Shirts, Legging/Leggings, etc.), near-duplicate collapse and generic
suppression (e.g. generic Shirt hidden when Knit Shirt present), and compound
label split on `/`, `&`, `+` so `Sweater/Jacket` and `T-Shirt/Polo Shirt`
render as separate chips with distinct Noun Project icons. Supplemental trim/
packaging icons added (Poly Bag, Leggings, Lace, Hanger, Elastic, Athletic
Wear, Home Textile, Carton, Pajama, Back Board, Neck Board, Printed Label,
Tissue Paper, Hang Tag, Barcode; T-Shirt icon 4464232). Quick-deployed;
health OK.

29 Jun 2026 - Principal product icons integrated and deployed to VPS
`109.104.153.228`. Scope: local Noun Project "Principal products" apparel set
under `public/icons/products/` (plus supplemental packaging/trim/material icons
from Noun Project), `lib/product-icons.ts` slug resolver with RMG-aware label
normalisation, `components/supplier/product-icon.tsx` `<img>` rendering in
original icon colour, and principal-products strip typography aligned to
Overview tab body font in `app/globals.css`. Ops helpers:
`ops/download_product_icons.py`, `ops/audit_product_icons_offline.py`. Deleted
legacy `public/ApparelIcons/`. Quick-deployed to production; health OK.

25 Jun 2026 - Frontend design stabilization pass complete in working tree.
Presentation-only changes: solid nav chrome, iPhone-safe bottom navigation,
full-width hairline Discover cards, and cleanup of touched prototype
card/typography drift across marketing and app surfaces. `pnpm typecheck`
and `pnpm lint` pass; `pnpm build` compiled successfully but failed during
Windows standalone symlink copy with `EPERM`.

## Recent Maintenance
25 Jun 2026 - Context-token optimization complete. Daily agent boot now uses
`AGENTS.md`, `context/agent-brief.md`, `context/current-state.md`, and
`context/feature-specs/active.md`; the old append-only tracker is archived.

## Current Working Tree Warning
At the start of the token-optimization task, the repo already had a large uncommitted frontend/design diff plus deleted old Magic UI component files. Treat those as pre-existing user/session work unless explicitly told otherwise. Do not revert them while doing context cleanup.

## Daily Development Rules
- For micro edits, do not read the full historical tracker or all feature specs.
- Load only the core boot files plus the active spec and task-relevant source documents.
- Before asserting whether a file is modified, check `git status` or `git diff` against HEAD.
- For debugging, state the hypothesis and minimal change before editing when `context/current-issues.md` is involved.

## Historical Record
The old full tracker was archived at `context/archive/progress-tracker-archive-2026-06-25.md`. Use that archive for old shipped-spec details, architectural decisions, and production smoke history.
