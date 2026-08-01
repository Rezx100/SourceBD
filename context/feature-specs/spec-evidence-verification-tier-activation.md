# Spec — activate the evidence verification tier (REZ-34)

Status: **Phases A/B/C complete 2 Aug 2026 — the tier is live in production.
Phase D (contradicted-claims triage) remains as a standing routine.** From the
REZ-34 audit conducted the same day; implementation happens in a fresh session
per the one-spec workflow.
Linear: **REZ-34** (P0). **REZ-42** (P1, webhook inbox lock-scope race) rides
along — same module, and activation is what arms it.
Founder decisions, 2 Aug 2026: (1) the verifier re-checks `bkmea_detail`
documents over the **direct** transport, not Firecrawl (parity-proven 8/8 on
29 Jul; ~0 credits vs ~1,770 credits/week); (2) spec first, then implement.

## What is broken (production-verified 2 Aug 2026)

The provenance system promises every citation is machine-checkable. The checking
half has never operated, and the audit found the cause is not only operational
("never scheduled") but four code defects stacked under it:

- `evidence_verifications`: **0 rows ever**. `verify_evidence` has never run (no
  `etl_runs` row for either job).
- `firecrawl_webhook_events`: **0 deliveries ever**.
- 6 `evidence_monitors` rows, all with **`monitor_id = NULL`** and
  `meta.registered_webhook =
  "https://sourcebd.net/api/v1/webhooks/firecrawl/api/v1/webhooks/firecrawl"`
  (path doubled). Created 30 Jul 21:27–21:29 by manual CLI runs.
- 3,741 documents show `verify_status='live'` stamped at ingest
  (`last_verified_at = fetched_at`). Only **2 documents are due** at the default
  168h interval today; the real wave lands 6 Aug (2,556) and 7 Aug (1,180).
- Claims: 24,704 active / 12,551 superseded / **1,093 contradicted** (881
  unreviewed — this *is* the current needs-review count) / 10 orphaned.
  Contradicted: 77 distinct suppliers, 1,077 from `bkmea_detail`, 16 from `rsc`.
- `etl_schedules` holds only `rsc` (weekly, enabled) and `rsc_reports`
  (disabled). No schedule for either maintenance job.

## Root causes

**R1 — `_monitor_spec` does not match the real `/v2/monitor` API.**
`etl/evidence/monitors.py:69` sends `{name, urls: [...], schedule: "daily",
scrapeOptions, webhook}`. Firecrawl's actual schema (confirmed against current
docs during the audit) is `{name, targets: [{type: "scrape", urls: [...],
scrapeOptions}], schedule: {text: "daily"}, webhook: {url, headers, events}}`.
Wrong on `urls` vs `targets`, on `schedule` (bare string vs object), and missing
an explicit `events` subscription. Firecrawl rejects it with a 400.

**R2 — the adapter records that 400 as a success.**
`_request_with_retry` (`etl/acquire/firecrawl.py:409-418`) returns `err=None`
for any 4xx that carries a JSON body, and `create_monitor` (`firecrawl.py:351`)
— unlike `fetch()` — never checks `payload["success"]`. The error payload flows
to `_extract_monitor_id` → `None` → a local row written with NULL `monitor_id`,
counted as "created". The 6 production rows are phantoms: nothing exists
upstream to report anything. The existing tests mock `create_monitor`, which is
why this was invisible.

**R3 — VPS config: doubled webhook URL.** `FIRECRAWL_WEBHOOK_BASE_URL` on the VPS
is set to the full endpoint URL, and `webhook_url()`'s `urljoin` appends
`WEBHOOK_PATH` again. Even a successful registration would deliver to a 404.

**R4 — event-contract drift: real deliveries would be recorded and ignored.**
Firecrawl sends `{success, type: "monitor.page", id, data: [{monitorId, url,
status: "changed"|"same"|"new"|"removed"|"error", ...}]}` — `data` is an
**array**. Against the current code:

- `CHANGE_EVENTS` in `etl/evidence/webhook_inbox.py` expects
  `"monitor.page.changed"` etc.; the real type `"monitor.page"` is not in the
  set, so every delivery drains as `ignored` even when the page changed.
- The route reads `monitorId` at the payload root (it lives in `data[0]`) and
  treats `data` as an object, so `page_url` also extracts as NULL — the requeue
  path never fires.
- `_touch_monitor` no-ops on NULL `monitor_id`, so `last_status` stays NULL
  forever even with traffic.

**R5 — REZ-42 lock-scope race (confirmed by reading).**
`webhook_inbox._pending` holds `FOR UPDATE SKIP LOCKED` only inside its `with`
block; the locks release before processing begins. Two overlapping
`process-webhooks` runs (minutely cron + a manual run) process the same
deliveries twice. Benign at 0 deliveries; live the moment monitors fire.

**R6 — the verifier cannot replay its largest document set faithfully, and has
no budget guard.** `_refetch` (`etl/evidence/verifier.py:145`) rebuilds the
request from `meta` alone, which stores only `{label, verify_mode,
only_main_content}` — per-source `request_headers`/`proxy`/parsers are dropped.
1,770 of 1,771 Firecrawl-adapter documents are `bkmea_detail`, ingested **with
browser headers**, which forces `storeInCache=false` upstream: a headerless
replay risks false drift/inconclusive on the biggest set, and `maxAge` can never
hit a cache that was never written, so every Firecrawl re-check bills 1 credit
(~1,770/week steady state). Separately, the verifier calls
`FirecrawlAdapter.fetch` directly, bypassing `AcquisitionMixin._check_budget` —
`FIRECRAWL_MAX_CREDITS_PER_RUN` does not apply to it at all.

**R7 — a first run with defaults proves nothing.** With
`last_verified_at = fetched_at`, only 2 documents are due before 6 Aug, so
`verify-evidence --limit 500` today checks 2 documents and exits "success". And
`--interval-hours 0` is silently swallowed by
`interval_hours or DEFAULT_INTERVAL_HOURS` in `etl/cli.py:130`.

**Already correct — do not touch:** the schedule/queue plumbing (cron drains
minutely; both jobs are in the SQL allow-list; the 60–43200 minute CHECK admits
a daily schedule), the webhook route's auth design and its middleware exclusion
(`middleware.ts:249`), the inbox's requeue-don't-conclude discipline, the
verifier's transient-failure rules, and the `/admin/evidence` triage surface
(contradicted filter + acknowledge/retire/recheck RPC all exist).

## Scope

### Phase A — code

1. **Fix the monitor spec** (`etl/evidence/monitors.py` `_monitor_spec`): emit
   `targets: [{type: "scrape", urls: [target_url], scrapeOptions: {formats:
   ["markdown"], onlyMainContent: false}}]`, `schedule: {text:
   DEFAULT_SCHEDULE}`, and `webhook: {url, headers, events: ["monitor.page"]}`.
2. **Fail loudly on monitor creation** (`etl/acquire/firecrawl.py`
   `create_monitor`): raise on non-2xx or `success: false`, mirroring
   `fetch()`'s guard. A failed registration must never write a local row.
3. **Parse the real envelope** (`app/api/v1/webhooks/firecrawl/route.ts` +
   `etl/evidence/webhook_inbox.py`):
   - Route: read `data` as an array; extract `monitorId` / `url` from the first
     page entry into the existing columns; keep storing the full payload. One
     row per page entry, dedupe key `fc:{envelope id}:{index}` (fall back to the
     body hash as today). Our monitors are one URL each, but the contract allows
     many.
   - Inbox: classify from `payload.data[i].status` — `changed` / `new` /
     `removed` → requeue; `same` → touch monitor, ignore; `error` → touch
     monitor and increment `consecutive_errors` (the column exists and is
     currently only ever reset). `monitor.check.completed` → touch monitor,
     ignore. Requeue-don't-conclude stays.
4. **REZ-42**: hold the claiming transaction for the whole drain in
   `process_pending` (select `FOR UPDATE SKIP LOCKED` → process → mark, one
   connection, commit at the end). A batch is ≤200 rows of local UPDATEs, so the
   transaction is short; a delivery arriving mid-drain waits one minute. No
   schema change (no new `process_status` value needed).
5. **Faithful, cheap verification replay** (`etl/evidence/verifier.py`):
   - Resolve the source class from `SCRAPERS[row["scraper_code"]]` and apply its
     `request_headers` (and `rps`/TLS via the same construction the class uses)
     to the replay request. Keep `only_main_content` from `meta`.
   - Add a per-source class attribute `verify_transport: str | None = None`.
     When set, the verifier re-checks on that transport instead of the ingest
     adapter. Set `verify_transport = "direct"` on `BkmeaDetailScraper`
     (founder-approved 2 Aug 2026; parity-proven). Everything else replays on
     the ingest adapter.
   - Enforce a credit ceiling in `VerifyEvidenceJob`: track cumulative
     `credits_used` and stop before exceeding the budget, priced with
     `estimate_credits` *before* each Firecrawl fetch. Budget defaults to
     `settings.firecrawl_max_credits_per_run` (0 = off, consistent with
     sources), overridable per run. This is what makes the queue-dispatched
     weekly job safe unattended.
6. **CLI** (`etl/cli.py`): `interval_hours is None → DEFAULT` instead of
   `or DEFAULT`, so `--interval-hours 0` means "everything is due"; add
   `--max-credits`.

### Phase B — config (VPS)

- `/opt/sourcebd/.env`: `FIRECRAWL_WEBHOOK_BASE_URL=https://sourcebd.net` (bare
  origin — no path). Confirm `FIRECRAWL_WEBHOOK_SECRET` is present; both
  services read the same `.env` via `env_file`, and the **web** container needs
  it (the route 404s without it).
- Optional hardening: `webhook_url()` strips a trailing `WEBHOOK_PATH` from the
  base if present, so this misconfig cannot recur silently.
- Deploy web + etl together (`ops/deploy_vps.sh` builds both — the 31 Jul
  lesson). The web container must be recreated for the env change.

### Phase C — activation runbook (in order)

1. `docker compose run --rm etl refresh-monitors --dry-run` → expect the full
   planned target list (~15).
2. Ground-truth upstream: `list_monitors()` from the etl container; prune any
   strays from the 30 Jul attempts with `delete_monitor` before re-registering
   (duplicates would double-deliver).
3. `docker compose run --rm etl refresh-monitors` → every row gains a real
   `monitor_id`; the upsert self-heals the 6 phantom rows (coalesces
   `monitor_id`, overwrites `registered_webhook`). No manual SQL.
4. Prove the webhook path end-to-end: `curl -X POST
   https://sourcebd.net/api/v1/webhooks/firecrawl` with the secret header and a
   real-shape payload (`type: "monitor.page"`, `data: [{monitorId, url, status:
   "changed"}]`) → 200; row lands in `firecrawl_webhook_events`;
   `process-webhooks` drains it → `processed=1`, that source's documents
   requeued (`last_verified_at` cleared), monitor `last_check_at`/`last_status`
   set. Negative checks: wrong secret → 401.
5. First verifier smoke: `docker compose run --rm etl verify-evidence --limit 50
   --interval-hours 0` → watch the outcome mix (expect mostly `live`), confirm
   `credits_used ≈ 0` under direct replay, confirm rows in
   `evidence_verifications`.
6. Schedule both jobs daily via `admin_etl_schedule_upsert`
   (`('verify_evidence', true, 1440, now())`, `('refresh_monitors', true, 1440,
   now())`) — admin UI or SQL; no migration needed. Queue-dispatched runs use
   defaults (limit 500, 168h interval): the 6–7 Aug due wave (3,736 docs) drains
   in ~8 daily runs. Acceptable — say so in the run history rather than forcing
   a catch-up.
7. Watch the first two scheduled cycles in `/admin/sources` run history and the
   `/admin/evidence` health strip (monitors card should show a real
   `last_check_at`).

### Phase D — contradicted-claims triage (standing routine)

881 unreviewed contradicted claims across 77 suppliers, 98.5% `bkmea_detail`,
concentrated in addresses and employee counts. This is the known
remaining-conflation population wearing evidence clothes. Per supplier
(`/admin/evidence?status=contradicted`, grouped by company): decide whether the
two registry records are one company (keep the newer/higher-tier value, `retire`
the losing claim with a note) or two companies (unmerge candidate, per the
31 Jul `ops/unmerge_bkmea_suppliers.py` pattern). The 16 `rsc` claims pair-check
the same way. The verifier never creates or resolves contradicted claims — they
are born in `supersede_claims` at ingest — so every `bkmea_detail` re-scrape can
mint new ones. That is the system working; triage is a routine, not a backlog to
zero once.

## Rejected alternatives

- **Schedule-and-kick as written in the issue.** Produces green runs over an
  inert tier: 2 documents checked, phantom monitors, first real delivery
  ignored. A verification tier that looks activated but is not is worse than an
  admittedly-off one.
- **Store full request options in `evidence_documents.meta` at ingest.** Does
  nothing for the 3,741 existing documents and splits the declaration of how to
  fetch a source away from the source. Class-attribute replay covers every
  existing document for free and keeps one declaration point (the same
  philosophy as `monitor_targets`).
- **Drop the monitor tier, rely on the weekly sweep.** A registry list-page
  restructure invalidates ~4,300 citations at once; ~15 credits/day for daily
  monitors is the cheapest early warning in the system.
- **Firecrawl's `goal` / LLM judge on monitors.** Puts a language model between
  the register and the notification — the same determinism rule that keeps LLM
  `json` mode out of extraction. No goal is set, so the judge stays off.
- **A `processing` status for REZ-42 via CHECK migration.** Holding the claim
  transaction achieves the same exclusion with no migration.

## Acceptance

Phase A, local:

- Contract test: `_monitor_spec` emits `targets[0].type/urls/scrapeOptions`,
  `schedule.text`, `webhook.events` — fails if the shape drifts again.
- `create_monitor` raises on a `success: false` payload and on a non-2xx JSON
  body (R2 regression).
- Route tests (npm): real envelope with `data` array → 200 and columns extracted
  from `data[0]`; multi-page `data` → one row per page; wrong secret → 401;
  unconfigured → 404.
- Inbox tests: status-driven classification (`changed`/`new`/`removed` requeue;
  `same` ignores but touches the monitor; `error` increments
  `consecutive_errors`); a two-worker overlap test pins REZ-42.
- Verifier tests: replay applies the source's `request_headers` and honours
  `verify_transport = "direct"`; falls back to the ingest adapter when
  undeclared; the budget stops a run before overspend; `--interval-hours 0` is
  honoured.
- `python -m pytest etl/tests -q`, `npm test`, `npx tsc --noEmit`, `ruff` — all
  clean apart from pre-existing warnings.

Phase C, production:

- All `evidence_monitors` rows have non-NULL `monitor_id` and the corrected
  webhook URL; `list_monitors()` upstream agrees.
- A real test delivery lands, drains, requeues, and sets monitor health columns.
- A smoke verify run writes `evidence_verifications` rows with sane outcomes and
  ~0 credits.
- Both schedules enabled; first two unattended cycles succeed in run history.

## Notes for whoever picks this up

- Do not "verify" the fix by running `verify-evidence` with defaults before
  6 Aug — 2 due documents and a green exit is the vacuous proof this spec exists
  to prevent. Use `--interval-hours 0` and a small `--limit`.
- The queue runner constructs jobs with no arguments (`scraper_cls()`), so
  scheduled `verify_evidence` always runs limit 500 / 168h. That is deliberate;
  the daily schedule plus per-doc interval is the cadence design, not a missing
  feature.
- `refresh-monitors` via CLI bypasses the job wrapper (no `etl_runs` row). Fine
  for manual runs; scheduled runs go through `RefreshMonitorsJob` and appear in
  run history.
- If a source's detail pages ever move to Firecrawl-only (direct blocked),
  remove its `verify_transport` override in the same commit, or verification
  will go inconclusive-backed-off and surface as `needs_attention` — which is
  the correct alarm, but know that it will fire.
- Activation log, 2 Aug 2026: the runbook's first live drain caught a defect
  no unit test could see — `_monitor_scraper_code`'s bare `%s is not null`
  parameter raised `IndeterminateDatatype` on real Postgres (psycopg server-side
  binding gives the guard no type context), crashing every change-status drain
  and rolling back cleanly. Fixed in `2b76046` (`%s::text`). Mocked-cursor
  tests cannot exercise server-side parameter typing; the production end-to-end
  step is the only test for that class, which is what it is for. The contained
  test event was reset to `pending` after the fix and drained as the C.4 proof
  (`attempts: 2`).
