-- 0118 — Lock the ten old working-copy tables (6 Oct 2026).
--
-- Ten tables in production's `public` schema are leftovers of one-off data fixes (August 2026): snapshots and
-- "expected" copies written by ops/ scripts, and temporary holds. They were created with row-level security off,
-- and the default privileges of the Supabase project granted `anon` and `authenticated` every right on them
-- (SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER). So the public API key could read and change
-- them. They hold supplier ids and old field values, nothing a buyer sees, but a table anyone can truncate is not
-- one to leave open.
--
-- Lock, do not drop: row-level security on (with no policy, so no API role sees a row) and every right revoked
-- from `anon` and `authenticated`. The table owner and `service_role` keep access, and so do the ops/ scripts
-- (rez95_apply_production_workers.sql, rez95_rollback_employees_total.sql, backfill_bgmea_reg_identities.py): they
-- connect as the owner or the service role. Nothing is lost; a rollback or a later drop stays possible.
--
-- A table that is not there is skipped, so the file replays on a fresh database (CI) where none of them exist.
-- Idempotent: enabling RLS and revoking again change nothing.
--
-- Do not apply to production from this PR (AGENTS rule 15); the founder applies it after the dry run in
-- ops/plans/0118-0119-dry-run.md.
--
-- Reversible (not recommended; it reopens them to the public key):
--   alter table public.<name> disable row level security;
--   grant all on public.<name> to anon, authenticated;

set search_path = public;

do $$
declare
  t text;
begin
  foreach t in array array[
    '_a8_numeric_snapshot_20260805',
    '_rez91_employees_total_expected_20260805',
    '_rez91_employees_total_snapshot_20260805',
    '_rez95_production_workers_expected_20260805',
    '_snapshot_20260814_queue_release_queue',
    '_snapshot_20260814_queue_release_suppliers',
    '_snapshot_bgmea_reg_identities_20260810',
    '_snapshot_rez58_domain_revert_20260810',
    '_tmp_20260814_needs_human_hold',
    '_tmp_20260814_queue_release_apply29'
  ]
  loop
    if to_regclass(format('public.%I', t)) is not null then
      execute format('alter table public.%I enable row level security', t);
      execute format('revoke all on table public.%I from anon, authenticated', t);
    end if;
  end loop;
end
$$;
