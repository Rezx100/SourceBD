-- 0156 — A server copy of every Volza result we paid for, kept the full year and never deleted early (22 Oct 2026).
--
-- On 22 Oct 2026 the raw results folder on the founder's machine was lost with an old worktree. The fetch
-- plan read "already fetched" from those files, so a fetch would have paid again for 457 suppliers
-- (PR #578 fixed the plan). The founder: what we paid for must be saved and must not be deleted, whatever
-- anyone does, so a later fetch within the year costs nothing.
--
-- ops/tradeline.py saves each results file here after a fetch, restores lost files from it, and skips every
-- supplier in it. One row per supplier per results file, the record exactly as Volza's answer was written.
--
-- Volza's licence (Shivani, email of 8 Oct 2026, see 0137) lets us store results for up to one year, so a row
-- expires one year after its fetch at the latest. Until then the triggers refuse every delete, update and
-- truncate, and there is no foreign key: a supplier merged or removed keeps its paid result. After expiry
-- the loader deletes it, as the licence requires.
--
-- Not readable by buyers: no grant to anon or authenticated, RLS on with no policy.
--
-- Rollback (needs the founder: the guard refuses deletes, so drop the triggers first):
--   drop table public.volza_raw_results;
--   drop function public.volza_raw_results_guard();

create table public.volza_raw_results (
  results_file text not null check (results_file ~ '^[A-Za-z0-9_.-]+\.jsonl$'),
  supplier_id  uuid not null,
  fetched_at   timestamptz not null,
  expires_at   timestamptz not null,
  record       jsonb not null check (jsonb_typeof(record) = 'object'),
  saved_at     timestamptz not null default now(),
  primary key (results_file, supplier_id),
  check (expires_at > fetched_at and expires_at <= fetched_at + interval '1 year')
);

create index volza_raw_results_supplier_idx on public.volza_raw_results (supplier_id);

comment on table public.volza_raw_results is
  'Every Volza result we paid for, as fetched, kept until expires_at (at most one year, Volza licence). '
  'Deletes, updates and truncates are refused before expiry. Service role only. Migration 0156.';

create or replace function public.volza_raw_results_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'TRUNCATE' then
    raise exception 'volza_raw_results keeps every paid Volza result for its year; truncate is refused (0156)';
  end if;
  if tg_op = 'UPDATE' then
    raise exception 'volza_raw_results rows are kept as fetched; update is refused (0156)';
  end if;
  if old.expires_at > now() then
    raise exception 'volza_raw_results row for supplier % (%) is kept until %; delete is refused (0156)',
      old.supplier_id, old.results_file, old.expires_at;
  end if;
  return old;
end
$$;

create trigger volza_raw_results_keep_rows
  before update or delete on public.volza_raw_results
  for each row execute function public.volza_raw_results_guard();

create trigger volza_raw_results_keep_table
  before truncate on public.volza_raw_results
  for each statement execute function public.volza_raw_results_guard();

alter table public.volza_raw_results enable row level security;
revoke all on table public.volza_raw_results from public, anon, authenticated;
grant select, insert, delete on table public.volza_raw_results to service_role;
