# Spec H8 — Backup + restore drill on Supabase

> Phase 6 hardening spec #8 — the final Phase-6 spec per
> `context/phases.md`. Follows H1 (Sentry + PostHog), H2 (rate
> limiting), H3 (Stripe webhook hardening), H4 (Resend email
> templates), H5 (in-app onboarding tour), H6 (a11y skip link +
> loading skeletons), H7 (trademark + legal pages). One spec =
> one PR on `development`.

## Scope

Ship the **backup + restore drill scaffolding** required before
public launch:

1. **Runbook** at `docs/runbooks/backup-restore.md` — the
   canonical, dated, step-by-step procedure for taking a
   point-in-time clone of the production Supabase project,
   restoring it into a sandbox project, and verifying the
   restored data matches the source within tolerance.
   States the **RPO** (24 h, Supabase free-tier daily backup) and
   **RTO** (4 h end-to-end including DNS cutover) targets.
   Defines **drill cadence**: one full drill per quarter, recorded
   in `progress-tracker.md` under a `### Backup drill — YYYY-MM-DD`
   subsection.
2. **Verification harness** at `ops/backup_drill.py` — pure
   Python, no new deps (uses `psycopg` already in `etl/`).
   Two modes:
   - `snapshot --url $SUPABASE_DB_URL --out ops/_h8_baseline.json`
     records a manifest of (a) the live migration head, (b) per-table
     row counts for the critical-table list, (c) a UTC timestamp.
   - `verify --baseline ops/_h8_baseline.json --url $RESTORE_TARGET_DATABASE_URL`
     re-runs the manifest against the restore target and asserts:
     migration head matches, every critical table is within
     `tolerance_pct = 1.0` (allows for in-flight rows during the
     PITR cutoff), exits non-zero with a per-table delta report
     on failure.
3. **`.env.example`** — add `RESTORE_TARGET_DATABASE_URL` (server-only,
   no `NEXT_PUBLIC_` prefix per `code-standards.md`).
4. **Smoke** at `ops/_h8_smoke.py` — disk-only, no network. Verifies
   the runbook + harness + env wiring are all present and that
   the route count + migration head invariants are unchanged.

## Out of scope (operational)

These are real-world, out-of-band tasks the **user** owns. The spec
does NOT execute them; it ships the scaffolding so the user can
run the drill on demand.

- **Spinning up the restore-target Supabase project.** A second,
  empty Supabase project (e.g. `sourcebd-restore-drill`) provides
  the destination for the quarterly drill. Pooler connection
  string flows into `RESTORE_TARGET_DATABASE_URL` on whichever
  host runs the drill (laptop or VPS).
- **Executing the quarterly drill.** Per the runbook: pause writes →
  snapshot baseline → `pg_dump` source → `pg_restore` into target →
  `python ops/backup_drill.py verify …` → log result in
  `progress-tracker.md`. The runbook is the source of truth; the
  spec just lands the runbook and the verifier.
- **Upgrading the Supabase plan for PITR < 24 h.** Current tier
  gives daily backups (RPO 24 h). Tightening to PITR sub-hour
  requires a paid tier upgrade — operational decision, not a
  spec deliverable.

## Out of scope (deferred)

- **Automated drill on a cron.** The first quarterly drill is
  manual so the operator builds muscle memory and the runbook
  gets corrected based on real experience. An Inngest-driven
  automated drill is a follow-up spec once the manual procedure
  has been executed at least twice without amendment.
- **Storage bucket restore.** `supplier-docs` (private) +
  `supplier-media` (public) buckets currently carry < 100 MB of
  user-uploaded content. The runbook documents the bucket export
  procedure (Supabase CLI `storage download`) but a full storage
  drill is a follow-up once supplier-portal uploads cross 1 GB.
- **Schema drift detector.** A separate spec will compare the live
  schema introspection against `supabase/migrations/*.sql` to flag
  out-of-band schema changes; not in scope here.

## Architectural choices

1. **No new tools.** `architecture.md` rule #4. The harness uses
   `psycopg` (already in `etl/` deps) and standard library only.
   `pg_dump` / `pg_restore` are bundled with PostgreSQL — they're
   not a new dependency.
2. **Critical-table list is hard-coded in `ops/backup_drill.py`,
   not introspected.** The list captures *what we care about
   restoring* — supplier corpus, source provenance, certifications,
   sanctions, SBI, the buyer/supplier surface tables (RFQs,
   messages, claims, saved sets), and the H-spec hardening
   tables (Stripe webhook events, email log, rate-limit buckets,
   onboarding state). Tables outside the list (verification
   queues, etl_runs, ephemeral logs) are checked-existence-only.
   A drift in the critical-table list is a spec-bump signal.
3. **Tolerance = 1.0 %.** The PITR cutoff and the
   `pg_dump`-then-`pg_restore` window admit a small number of
   in-flight inserts on append-only tables (`messages`,
   `email_log`, `stripe_webhook_events`, `rate_limit_buckets`).
   Setting tolerance to zero would fail every drill on a live
   project. 1 % is small enough that a real data-loss event
   trips the verifier.
4. **Baseline manifest is a flat JSON in `ops/_h8_baseline.json`.**
   `ops/_*` is gitignored by convention so the manifest never
   commits accidentally with timestamps from a real drill.
5. **`RESTORE_TARGET_DATABASE_URL` is server-only.** No
   `NEXT_PUBLIC_` prefix — the URL carries a DB password and
   must never reach the client bundle.
6. **No DB migration.** Migration head stays at
   `0047_onboarding_state.sql`. The spec ships ops + docs only.
7. **No route changes.** Route count stays at 68 (H7 baseline).
   The smoke check hard-asserts this so a drive-by route addition
   in a future PR can't silently slip through this spec's diff.
8. **Runbook lives at `docs/runbooks/`, not under `context/`.**
   `context/` is for active specs + project rules; `docs/runbooks/`
   is for evergreen operational procedures. This is the first
   runbook the repo gains; the directory is created by this spec.

## Deliverables

### Docs
- `docs/runbooks/backup-restore.md` — full drill procedure.

### Ops
- `ops/backup_drill.py` — pure-Python harness with `snapshot` +
  `verify` CLI modes.

### Wiring
- `.env.example` — append `RESTORE_TARGET_DATABASE_URL` with a
  Spec H8 comment block.

### Smoke
- `ops/_h8_smoke.py` — disk-only, no network. Checks:
  1. Runbook file exists, contains the required H2 section
     headings: `## RPO / RTO`, `## Drill cadence`,
     `## Prerequisites`, `## Procedure`, `## Verification`,
     `## Rollback`.
  2. `ops/backup_drill.py` exists, defines `CRITICAL_TABLES` as
     a list, exposes `snapshot` + `verify` CLI subcommands,
     and references `RESTORE_TARGET_DATABASE_URL` (not the
     production `SUPABASE_DB_URL` as the verify target).
  3. `ops/backup_drill.py` declares `TOLERANCE_PCT = 1.0`.
  4. `.env.example` contains `RESTORE_TARGET_DATABASE_URL` and
     keeps the value empty (no committed secret).
  5. Forbidden-token scan on every new file — none of the M5
     forbidden tokens (`email_primary`, `phones`, `contact_name`,
     `contact_role`, `nid_number`, `proprietor_nid`, `owner_phone`,
     `trade_license_number`, `body_ciphertext`, `internal_score`,
     `supplier_score_internal`, plus regex `\bsbi\b` and
     `\bpillar_`) appear in any new file. Table-name references
     to `sbi_scores` in `CRITICAL_TABLES` are unavoidable (it's
     the actual table name) — the scan deliberately allow-lists
     the string `"sbi_scores"` so the column-leak rule is upheld
     without false-positiving on the table-name reference.
  6. `.next/routes-manifest.json` route count = 68 (H7 baseline,
     unchanged).
  7. Migration head on disk is `0047_onboarding_state.sql`
     (asserts no drive-by migration landed in this spec).

## Validation

```
pnpm typecheck
pnpm lint
pnpm build           # expect route count 68
python ops/_h8_smoke.py
```

No DB migration to apply. **No VPS work for this spec** — the
runbook is the handoff for the user-owned quarterly drill, and
the verifier is invoked on demand against whichever target the
operator chooses.

## Commit

`feat(ops): ship Spec H8 backup + restore drill scaffolding`
on `development`. Push. Surface the commit ref.
