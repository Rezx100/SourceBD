-- 0113 — Saved searches: "Email me new matches" and "Save your last search?" (5 Oct 2026).
--
-- Spec: context/feature-specs/gap-14-saved-search-alerts.md (gap list row 14).
--
--   1. saved_searches.alert_weekly: the buyer's switch. The table's owner
--      policies (0104) already let the owner update their own rows, so the
--      switch needs no RPC.
--   2. saved_search_alerts: what the weekly job has already seen per search
--      (the matching supplier ids), when it last checked and last emailed.
--      Its own table, with no grant, so a buyer cannot rewrite what counts
--      as "new" for themselves or anyone else.
--   3. For the weekly job (service_role only):
--        saved_search_alerts_due(limit)  searches with the switch on, not
--                                        checked for 6 days, owner not
--                                        suspended, with the owner's email
--        saved_search_alert_new(id, ids) which of today's matches are new;
--                                        null on the first check (a baseline,
--                                        nothing is emailed)
--        saved_search_alert_record(id, ids, sent)
--                                        stores today's matches as seen
--   4. buyer_settings.last_search_state / last_search_at with
--      buyer_last_search_set(state) and buyer_last_search() for the card.
--
-- Hard invariants honoured:
--   * Server enforces auth + ownership: the job's functions are callable by
--     service_role only (revoked from public, anon, authenticated); the
--     buyer's two are SECURITY DEFINER on auth.uid()'s row only, anon revoked.
--   * Sizes are bounded: 20,000 ids a snapshot, 8 KB a last search (the same
--     bound saved_searches.query_state has).
--
-- Idempotent and additive: `if not exists`, `create or replace`,
-- constraints dropped before they are added. No existing row changes
-- (alert_weekly defaults to false: nobody is emailed until they ask).
--
-- Do not apply to production from this PR (AGENTS rule 15); the founder
-- applies it after the dry run in ops/plans/0113-dry-run.md.
--
-- Reversible:
--   drop function public.buyer_last_search();
--   drop function public.buyer_last_search_set(jsonb);
--   drop function public.saved_search_alert_record(uuid, uuid[], boolean);
--   drop function public.saved_search_alert_new(uuid, uuid[]);
--   drop function public.saved_search_alerts_due(int);
--   drop table public.saved_search_alerts;
--   alter table public.buyer_settings drop column last_search_at, drop column last_search_state;
--   alter table public.saved_searches drop column alert_weekly;

set search_path = public;

-- ----------------------------------------------------------------------
-- 1. The switch
-- ----------------------------------------------------------------------

alter table public.saved_searches
  add column if not exists alert_weekly boolean not null default false;

-- ----------------------------------------------------------------------
-- 2. What the job has seen
-- ----------------------------------------------------------------------

create table if not exists public.saved_search_alerts (
  search_id  uuid        primary key references public.saved_searches(id) on delete cascade,
  seen_ids   uuid[]      not null default '{}',
  checked_at timestamptz not null default now(),
  sent_at    timestamptz,
  constraint saved_search_alerts_seen_size check (cardinality(seen_ids) <= 20000)
);

alter table public.saved_search_alerts enable row level security;
revoke all on table public.saved_search_alerts from anon, authenticated;

-- ----------------------------------------------------------------------
-- 3. The job's three calls
-- ----------------------------------------------------------------------

create or replace function public.saved_search_alerts_due(p_limit int default 100)
returns table (search_id uuid, owner_id uuid, email text, name text, query_state jsonb,
               checked_at timestamptz, sent_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select s.id, s.owner_id, u.email::text, s.name, s.query_state, a.checked_at, a.sent_at
    from public.saved_searches s
    join auth.users u on u.id = s.owner_id
    join public.profiles p on p.id = s.owner_id
    left join public.saved_search_alerts a on a.search_id = s.id
   where s.alert_weekly
     and not coalesce(p.is_suspended, false)
     and u.email is not null
     and (a.checked_at is null or a.checked_at < now() - interval '6 days')
   order by a.checked_at nulls first, s.created_at
   limit greatest(1, least(coalesce(p_limit, 100), 1000));
$$;

create or replace function public.saved_search_alert_new(p_search_id uuid, p_ids uuid[])
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  select case when a.search_id is null then null
              else coalesce((select array_agg(distinct i) from unnest(coalesce(p_ids, '{}')) i
                              where i <> all (a.seen_ids)), '{}')
         end
    from (select 1) one
    left join public.saved_search_alerts a on a.search_id = p_search_id;
$$;

create or replace function public.saved_search_alert_record(p_search_id uuid, p_ids uuid[], p_sent boolean)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_ids uuid[];
begin
  select coalesce(array_agg(distinct i), '{}') into v_ids
    from unnest(coalesce(p_ids, '{}')) i where i is not null;
  if cardinality(v_ids) > 20000 then
    raise exception 'at most 20000 ids' using errcode = '22023';
  end if;
  if not exists (select 1 from public.saved_searches s where s.id = p_search_id) then
    raise exception 'no saved search with that id' using errcode = 'P0002';
  end if;
  insert into public.saved_search_alerts as a (search_id, seen_ids, checked_at, sent_at)
  values (p_search_id, v_ids, now(), case when p_sent then now() end)
  on conflict (search_id) do update
    set seen_ids   = excluded.seen_ids,
        checked_at = excluded.checked_at,
        sent_at    = coalesce(excluded.sent_at, a.sent_at);
end;
$$;

revoke all on function public.saved_search_alerts_due(int) from public, anon, authenticated;
revoke all on function public.saved_search_alert_new(uuid, uuid[]) from public, anon, authenticated;
revoke all on function public.saved_search_alert_record(uuid, uuid[], boolean) from public, anon, authenticated;
grant execute on function public.saved_search_alerts_due(int) to service_role;
grant execute on function public.saved_search_alert_new(uuid, uuid[]) to service_role;
grant execute on function public.saved_search_alert_record(uuid, uuid[], boolean) to service_role;

-- ----------------------------------------------------------------------
-- 4. The last search
-- ----------------------------------------------------------------------

alter table public.buyer_settings
  add column if not exists last_search_state jsonb,
  add column if not exists last_search_at    timestamptz;

alter table public.buyer_settings drop constraint if exists buyer_settings_last_search_state_check;
alter table public.buyer_settings add constraint buyer_settings_last_search_state_check
  check (last_search_state is null
         or (jsonb_typeof(last_search_state) = 'object' and octet_length(last_search_state::text) <= 8192));

create or replace function public.buyer_last_search_set(p_state jsonb)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_state is null or jsonb_typeof(p_state) <> 'object' or octet_length(p_state::text) > 8192 then
    raise exception 'p_state must be a jsonb object of at most 8 KB' using errcode = '22023';
  end if;
  insert into public.buyer_settings (owner_id, last_search_state, last_search_at)
  values (v_uid, p_state, now())
  on conflict (owner_id) do update
    set last_search_state = excluded.last_search_state,
        last_search_at    = excluded.last_search_at;
end;
$$;

revoke all     on function public.buyer_last_search_set(jsonb) from public, anon;
grant  execute on function public.buyer_last_search_set(jsonb) to authenticated;

-- {state, searched_at, saved}: saved is true when one of the caller's saved
-- searches holds the same state, so the card can stay away.
create or replace function public.buyer_last_search()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case when bs.last_search_state is null then null
              else jsonb_build_object(
                'state',       bs.last_search_state,
                'searched_at', bs.last_search_at,
                'saved',       exists (select 1 from public.saved_searches s
                                        where s.owner_id = bs.owner_id
                                          and s.query_state = bs.last_search_state))
         end
    from public.buyer_settings bs
   where bs.owner_id = auth.uid();
$$;

revoke all     on function public.buyer_last_search() from public, anon;
grant  execute on function public.buyer_last_search() to authenticated;
