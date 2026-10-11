-- 0143 — The reveal's spend log names its row (11 Oct 2026).
--
-- Production runs pg_safeupdate for API callers: an UPDATE with no WHERE clause is refused ("UPDATE requires a
-- WHERE clause", 21000). 0141's _volza_reveal_spend updated the one settings row without one, so the first live
-- reveal (Moon Readywears, 11 Oct 05:10 UTC) failed after Volza had answered: volza_reveal_finish and
-- volza_reveal_abort both called it and were both refused, so nothing was saved and the spend was not logged.
-- CI's Postgres and the dry run (run as the owner) do not load pg_safeupdate, so neither saw it.
--
-- 1. _volza_reveal_spend updates `where id` (the settings row's key is the constant true).
-- 2. That lost call is logged at its worst case, $1.35, so the monthly cap counts it.
-- 3. Its claim, which nothing released, is cleared once it has lapsed (two minutes), as a later click would.
--
-- Guard: lib/migrations-safeupdate.test.ts fails on any UPDATE or DELETE without a WHERE in a migration from 0141 on.
--
-- Rollback: re-run 0141's definition of _volza_reveal_spend (it is wrong on production, so do not).

create or replace function public._volza_reveal_spend(p_cost_usd numeric, p_credit_remaining_usd numeric)
returns void
language sql
security definer
set search_path = public
as $$
  update public.volza_reveal_settings
     set spent_usd = case when spent_month = (date_trunc('month', now() at time zone 'utc'))::date
                          then spent_usd else 0 end + greatest(coalesce(p_cost_usd, 0), 0),
         spent_month = (date_trunc('month', now() at time zone 'utc'))::date,
         credit_remaining_usd = coalesce(p_credit_remaining_usd, credit_remaining_usd),
         updated_at = now()
   where id;
$$;

revoke all on function public._volza_reveal_spend(numeric, numeric) from public, anon, authenticated, service_role;

-- The lost call of 11 Oct 2026, 05:10 UTC, at its worst case. Only where 0141's first month is still the one
-- counted, so a replay elsewhere (CI) adds nothing it should not: CI's settings row has spent nothing.
update public.volza_reveal_settings
   set spent_usd = spent_usd + 1.35, updated_at = now()
 where id
   and spent_month = date '2026-10-01'
   and exists (select 1 from public.volza_shipment_reveals r
                 join public.suppliers s on s.id = r.supplier_id
                where s.slug = 'moon-readywears' and r.fetched_at is null);

delete from public.volza_shipment_reveals
 where fetched_at is null and claimed_at < now() - interval '2 minutes';
