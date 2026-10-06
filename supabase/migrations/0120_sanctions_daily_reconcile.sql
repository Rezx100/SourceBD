-- 0120 — sanctions lists read daily: last-seen tracking, delisting, review on every hit.
-- Spec: context/feature-specs/spec-etl-freshness.md, slice S1 (§4.4, §4.6).
--
-- WHY
-- ---
-- The six lists were read once in June/July and are on no schedule. A daily
-- read needs three things the table cannot hold today:
--   * which run last saw each entry (`last_seen_at`, `last_seen_run_id`), so
--     an entry the publisher removed can be told apart from one we did not read;
--   * `listing_status`: 'listed' or 'no_longer_listed' (rows are never deleted);
--   * `content_hash`, so an unchanged entry costs no upsert, no re-screen and
--     no evidence rewrite (OFAC's ~14k entries took ~3 h a run).
-- And a confident hit flips `is_sanctioned` (trigger) but never opened a
-- review row, so `admin_sanctions_queue_list` was always empty. The trigger
-- now opens one (founder, 6 Oct 2026: hide at once, review after).
--
-- Also: disabled daily schedule rows for the six lists (the founder enables
-- them in /admin/sources), and `sanctions_lists_read()` for the buyer-facing
-- "lists we read on <date>" line.
--
-- Additive only. Nothing is deleted or rewritten except `propagate_sanctions`,
-- whose live body (6 Oct 2026) is reproduced below with one insert added.
--
-- REVERSE
-- -------
--   drop function if exists public.sanctions_lists_read();
--   (restore propagate_sanctions from the body in the comment at §3)
--   alter table public.sanctions_list_entries
--     drop column if exists content_hash, drop column if exists last_seen_at,
--     drop column if exists last_seen_run_id, drop column if exists listing_status;
--   delete from public.etl_schedules where scraper_code in
--     ('ofac_sdn','uk_ofsi','eu_sanctions','uflpa','ilab_tvpra') and not enabled;

-- ---------------------------------------------------------------------------
-- 1. Columns
-- ---------------------------------------------------------------------------
alter table public.sanctions_list_entries
  add column if not exists content_hash     text,
  add column if not exists last_seen_at     timestamptz,
  add column if not exists last_seen_run_id uuid,
  add column if not exists listing_status   text not null default 'listed';

do $$ begin
  alter table public.sanctions_list_entries
    add constraint chk_sle_listing_status check (listing_status in ('listed', 'no_longer_listed'));
exception when duplicate_object then null; end $$;

update public.sanctions_list_entries set last_seen_at = fetched_at where last_seen_at is null;

create index if not exists idx_sle_list_listing on public.sanctions_list_entries (list, listing_status);

-- ---------------------------------------------------------------------------
-- 2. Daily schedules, disabled. ILAB is a country x good list revised every
--    ~2 years: weekly. No cbp_wro schedule: CBP replaced its table with a
--    Tableau dashboard in 2025, so every read is the Dec 2024 Wayback snapshot.
-- ---------------------------------------------------------------------------
insert into public.etl_schedules (scraper_code, enabled, interval_minutes, metadata)
values
  ('ofac_sdn',     false, 1440,  '{"spec": "etl-freshness S1", "max_age_hours": 48}'),
  ('uk_ofsi',      false, 1440,  '{"spec": "etl-freshness S1", "max_age_hours": 48}'),
  ('eu_sanctions', false, 1440,  '{"spec": "etl-freshness S1", "max_age_hours": 48}'),
  ('uflpa',        false, 1440,  '{"spec": "etl-freshness S1", "max_age_hours": 48}'),
  ('ilab_tvpra',   false, 10080, '{"spec": "etl-freshness S1", "max_age_hours": 240}')
on conflict (scraper_code) do nothing;

-- ---------------------------------------------------------------------------
-- 3. A hit opens a review row. Live body before this migration:
--      if new.active then
--        update public.suppliers set is_sanctioned = true where id = new.supplier_id;
--        update public.sbi_scores set total = 0, sanctioned_zero = true where supplier_id = new.supplier_id;
--      end if;
--      return new;
-- ---------------------------------------------------------------------------
create or replace function public.propagate_sanctions()
returns trigger
language plpgsql
as $function$
begin
  if new.active then
    update public.suppliers set is_sanctioned = true where id = new.supplier_id;
    update public.sbi_scores set total = 0, sanctioned_zero = true where supplier_id = new.supplier_id;
    -- One open review row per (supplier, list entry); a re-screen never stacks.
    insert into public.verification_queue (queue_type, supplier_a_id, supplier_b_name, confidence, source_data)
    select 'sanctions_hit', new.supplier_id, new.matched_name, new.match_score,
           jsonb_build_object(
             'kind', 'hit',
             'list', new.list::text,
             'matched_name', new.matched_name,
             'match_score', new.match_score,
             'entry_ref', new.list_entry_ref,
             'entry_id', new.details->>'sanctions_list_entry_id')
     where not exists (
       select 1 from public.verification_queue q
        where q.queue_type = 'sanctions_hit'
          and q.supplier_a_id = new.supplier_id
          and q.reviewed_at is null
          and q.source_data->>'entry_ref' = new.list_entry_ref);
  end if;
  return new;
end $function$;

-- ---------------------------------------------------------------------------
-- 4. When each list was last read, for the buyer line. Public facts only:
--    list code, entries still listed, last read. No supplier data.
--    "Read" = the last run that read the whole current list (its
--    etl_runs.meta.reconcile.<list>.action is 'reconcile' or 'held'); a partial
--    run never moves the date. Lists not yet read under this migration fall
--    back to their last fetch, which was a full read.
-- ---------------------------------------------------------------------------
create or replace function public.sanctions_lists_read()
returns table (list text, entries_listed bigint, last_read timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  with lists as (
    select e.list::text as list,
           count(*) filter (where e.listing_status = 'listed') as entries_listed,
           max(e.last_seen_at) as last_seen
      from public.sanctions_list_entries e
     group by e.list
  )
  select l.list,
         l.entries_listed,
         coalesce(
           (select max(r.finished_at) from public.etl_runs r
             where r.status = 'success'
               and r.meta -> 'reconcile' -> l.list ->> 'action' in ('reconcile', 'held')),
           case when not exists (select 1 from public.etl_runs r where r.meta -> 'reconcile' ? l.list)
                then l.last_seen end)
    from lists l
$$;

revoke all on function public.sanctions_lists_read() from public;
grant execute on function public.sanctions_lists_read() to anon, authenticated;
