# Backup + restore drill — Supabase

> Spec H8 runbook. The canonical, dated, step-by-step procedure
> for proving we can recover from a Supabase-level data-loss
> event (project deletion, schema corruption, mass DELETE,
> sanctions-misfire that nukes `is_published` across the corpus).
>
> One drill per quarter. Log each run as a
> `### Backup drill — YYYY-MM-DD` subsection in
> `context/progress-tracker.md` with the verifier output and
> the wall-clock time it took end-to-end.

## RPO / RTO

- **RPO (recovery point objective): 24 h.** Supabase free tier
  takes one automated logical backup per day. Any data committed
  between the last nightly backup and the loss event is
  irretrievable without a paid tier upgrade.
- **RTO (recovery time objective): 4 h.** End-to-end from
  declaring the incident to a fully restored project serving the
  web app, including DNS / connection-string cutover.

Tightening RPO to sub-hour requires a paid Supabase plan with
PITR enabled. That is an operational decision tracked outside
this runbook.

## Drill cadence

- **One full drill per quarter.** Calendar reminder owned by the
  operator. Skipping a quarter is a flag; two consecutive skips
  is an incident.
- **Each drill is logged** in `context/progress-tracker.md` under
  a `### Backup drill — YYYY-MM-DD` subsection with: wall-clock
  duration, verifier output (paste the `H8 verify PASSED …` line
  verbatim), any deviation from this runbook, and any amendment
  the runbook needs as a result.
- **First two drills are manual.** Automation lands in a follow-up
  spec only after the manual procedure has executed twice without
  amendment.

## Prerequisites

- A second Supabase project provisioned (e.g.
  `sourcebd-restore-drill`), distinct from production
  (`stnrfxrxfonwexzcvvpv`). The restore target must be empty
  before each drill; if it carries leftover state from the
  previous drill, drop and recreate the `public` schema first.
- `pg_dump` + `pg_restore` from PostgreSQL ≥ 15 on the operator
  host. Bundled with PostgreSQL; not a SourceBD dependency.
- `psycopg` (already in `etl/` deps via `pyproject.toml`) on the
  operator host so the verifier can run.
- The following env vars set in the operator's shell:
  - `SUPABASE_DB_URL` — production pooler URL (read-only access
    is sufficient for `pg_dump`; the operator may use the
    transaction pooler since `pg_dump` runs in repeatable-read
    mode).
  - `RESTORE_TARGET_DATABASE_URL` — restore-target pooler URL,
    distinct from `SUPABASE_DB_URL`. The verifier refuses to
    run against the production URL.

## Procedure

1. **Declare the drill.** Post in the ops channel:
   `H8 drill starting YYYY-MM-DD HH:MMZ`. This silences false
   alarms on the verifier output.
2. **Snapshot the baseline** against production:
   ```
   python ops/backup_drill.py snapshot \
     --url "$SUPABASE_DB_URL" \
     --out ops/_h8_baseline.json
   ```
   The manifest records the migration head, per-table row counts
   for the critical-table list, and a UTC timestamp. The file
   path matches the `ops/_*` gitignore pattern so the baseline
   never commits.
3. **Dump production** to a local file:
   ```
   pg_dump --format=custom --no-owner --no-acl \
     --schema=public \
     --file=ops/_h8_drill.dump \
     "$SUPABASE_DB_URL"
   ```
   The `--schema=public` flag restricts the dump to application
   tables. Auth and storage live in separate schemas and are
   restored via Supabase's own tooling (see Storage note below).
4. **Reset the restore target.** Connect with `psql` and:
   ```
   drop schema public cascade;
   create schema public;
   grant all on schema public to postgres, anon, authenticated, service_role;
   ```
5. **Re-apply migrations** against the restore target. Supabase's
   migration runner is acceptable; alternately, replay
   `supabase/migrations/*.sql` in order. The migration head must
   match production before `pg_restore` runs.
6. **Restore the dump** into the target:
   ```
   pg_restore --no-owner --no-acl --data-only --disable-triggers \
     --dbname="$RESTORE_TARGET_DATABASE_URL" \
     ops/_h8_drill.dump
   ```
   `--data-only` because step 5 already created the schema;
   `--disable-triggers` because triggers (e.g. `enforce_sanctions_zero`,
   `enforce_publish_tier`) would otherwise fire on the bulk reload
   and corrupt scoring / publish state on rows that were already at
   the correct end-state in production.
7. **Re-enable and re-run state triggers** if needed — typically
   none, because the dumped data already reflects post-trigger
   state. Document any exception in the drill log.

## Verification

8. **Run the verifier** against the restore target:
   ```
   python ops/backup_drill.py verify \
     --baseline ops/_h8_baseline.json \
     --url "$RESTORE_TARGET_DATABASE_URL"
   ```
   The verifier asserts: migration head matches, every critical
   table is within `tolerance_pct = 1.0`, the restore target URL
   is **not** the production URL. Exit code 0 = PASS, non-zero =
   FAIL with a per-table delta report.
9. **Spot-check 3 random suppliers** by slug. Open the restored
   project's Supabase studio, query
   `select slug, company_name, is_published, sources_count
    from v_supplier_card limit 3` and compare against production.
   The receipts payload (cert counts, register memberships) must
   match.
10. **Log the result** in `context/progress-tracker.md` under
    `### Backup drill — YYYY-MM-DD`. Paste the verifier's PASS
    line verbatim, note the wall-clock duration, list any
    deviation from this runbook.

## Rollback

The drill never touches production. The only rollback step is
**dropping the restore-target schema** so the next drill starts
clean:

```
drop schema public cascade;
create schema public;
```

If the drill *did* somehow point at production (the verifier
refuses to, but the operator might run `pg_restore` against the
wrong URL): Supabase's automated nightly backup is the recovery
path. Restore from the most recent nightly snapshot via the
Supabase dashboard. Log the incident under the active drill's
entry and revisit operator procedure.

## Storage buckets

Out of scope for v1 — `supplier-docs` (private) and
`supplier-media` (public) carry < 100 MB combined and are
backed up via Supabase's own object-storage replication. A full
storage-restore drill lands in a follow-up spec once supplier
uploads cross 1 GB.

Document the export command for reference only:

```
supabase storage download supplier-docs ./ops/_h8_storage/supplier-docs
supabase storage download supplier-media ./ops/_h8_storage/supplier-media
```

## Last reviewed

2026-06-03 — initial version (Spec H8).
