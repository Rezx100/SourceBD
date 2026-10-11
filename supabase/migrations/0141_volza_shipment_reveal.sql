-- 0141 — On-demand shipment reveal: a supplier's latest 25 Volza shipments, saved once, shown to paying buyers
-- (11 Oct 2026). Handoff: .impeccable/handoff-volza-reveal.md.
--
-- A Growth buyer sees the 15 latest shipments, Enterprise (and an admin) the 25 latest, all cut from one saved
-- fetch of 25 per supplier. Offered only where the Volza name check is 'exact' and unexpired (0137), searched by
-- the Volza spelling that check passed, never by our profile name. Starter, suspended and signed-out accounts
-- get nothing from any function here.
--
-- Volza bills $0.10 a search plus $0.05 a record, so one fetch costs at most $1.35. The server route
-- (app/api/v1/suppliers/[slug]/shipments) is the only caller of Volza and runs:
--   1. volza_reveal_begin(slug), as the buyer: plan gate, allowance, then either the saved copy (no Volza call)
--      or a claim on the supplier. The claim is the lock: a second buyer clicking meanwhile is told 'busy' (or
--      served the older copy), so two clicks make one call. Off switch, Volza credit floor and the monthly cap
--      are checked before a claim is handed out; pending claims count at the worst case.
--   2. the Volza call (server only; VOLZA_API_KEY never reaches the browser);
--   3. volza_reveal_finish(claim, ...) on success or volza_reveal_abort(claim, cost) on failure, as the service
--      role: a buyer can never write records into the saved copy. A failure saves nothing and uses no allowance.
--   4. supplier_shipment_reveal(slug), as the buyer: the read, cut to 15 or 25 in SQL.
--
-- Allowance: distinct suppliers per buyer per calendar month (UTC); opening one again that month is free.
-- Numbers, cap and switch live in the one row of volza_reveal_settings, so the founder changes them with an
-- update, not a deploy. Defaults are the handoff's proposals (Growth 30, Enterprise 100, 20 a day, $100 a
-- month, stop below $100 of Volza credit), pending the founder's confirmation.
--
-- Saved copies live one year (Volza licence, 8 Oct 2026) and are refetched when older than 30 days. Every
-- reveal is written to the activity record (0131) as shipments.revealed. Unit prices are stored (whole record)
-- but not returned: no checked price key exists yet.
--
-- Also: rl_check accepts the route's own bucket, api_reveal (0119's live-definition patch).
--
-- Rollback:
--   drop function public.shipment_reveal_allowance();
--   drop function public.volza_reveal_abort(uuid, numeric);
--   drop function public.volza_reveal_finish(uuid, jsonb, numeric, numeric);
--   drop function public.volza_reveal_begin(text);
--   drop function public.supplier_shipment_reveal(text);
--   drop function public._volza_reveal_spend(numeric, numeric);
--   drop table public.volza_reveal_uses, public.volza_shipment_reveals, public.volza_reveal_settings;
--   re-run 0119's patch with 'api_reveal' removed (or leave it: an unused bucket name is harmless).

create table public.volza_shipment_reveals (
  supplier_id uuid primary key references public.suppliers (id) on delete cascade,
  records     jsonb not null default '[]'::jsonb
              check (jsonb_typeof(records) = 'array' and jsonb_array_length(records) <= 25),
  fetched_at  timestamptz,
  expires_at  timestamptz,
  cost_usd    numeric(8, 2) not null default 0 check (cost_usd >= 0),
  -- A fetch in flight. Older than two minutes, it is abandoned and the next click may take it over.
  claim_id    uuid unique,
  claimed_at  timestamptz,
  claimed_by  uuid references auth.users (id) on delete set null,
  check ((fetched_at is null) = (expires_at is null)),
  check (expires_at is null or (expires_at > fetched_at and expires_at <= fetched_at + interval '1 year')),
  check ((claim_id is null) = (claimed_at is null)),
  check (fetched_at is not null or claim_id is not null)
);

comment on table public.volza_shipment_reveals is
  'Saved Volza shipment records per supplier (up to 25, newest first), for the on-demand reveal. Tier 6; kept '
  'at most one year. No direct access: read through supplier_shipment_reveal(), written by the reveal route. 0141.';

create table public.volza_reveal_uses (
  user_id     uuid not null references auth.users (id) on delete cascade,
  supplier_id uuid not null references public.suppliers (id) on delete cascade,
  month       date not null,
  first_at    timestamptz not null default now(),
  primary key (user_id, supplier_id, month)
);

create index volza_reveal_uses_user_month_idx on public.volza_reveal_uses (user_id, month);

comment on table public.volza_reveal_uses is
  'One row per buyer, supplier and calendar month (UTC) revealed: the allowance count. 0141.';

create table public.volza_reveal_settings (
  id                   boolean primary key default true check (id),
  live                 boolean not null default true,
  monthly_cap_usd      numeric(8, 2) not null default 100 check (monthly_cap_usd >= 0),
  growth_per_month     integer not null default 30 check (growth_per_month >= 0),
  enterprise_per_month integer not null default 100 check (enterprise_per_month >= 0),
  daily_max            integer not null default 20 check (daily_max >= 0),
  credit_floor_usd     numeric(10, 2) not null default 100 check (credit_floor_usd >= 0),
  spent_month          date not null default (date_trunc('month', now() at time zone 'utc'))::date,
  spent_usd            numeric(10, 2) not null default 0 check (spent_usd >= 0),
  credit_remaining_usd numeric(10, 2),
  updated_at           timestamptz not null default now()
);

insert into public.volza_reveal_settings default values;

comment on table public.volza_reveal_settings is
  'The reveal''s one settings row: live (the off switch), the monthly Volza budget and spend so far, the '
  'allowances, and the last credit Volza reported with the floor below which live calls stop. 0141.';

alter table public.volza_shipment_reveals enable row level security;
alter table public.volza_reveal_uses enable row level security;
alter table public.volza_reveal_settings enable row level security;
revoke all on table public.volza_shipment_reveals, public.volza_reveal_uses, public.volza_reveal_settings
  from public, anon, authenticated;
grant select, insert, update, delete on table
  public.volza_shipment_reveals, public.volza_reveal_uses, public.volza_reveal_settings to service_role;

-- Spend into the settings row, starting the month's count afresh when the month has turned.
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
         updated_at = now();
$$;

revoke all on function public._volza_reveal_spend(numeric, numeric) from public, anon, authenticated, service_role;

-- The read. Same gate as supplier_volza_exports, plus: this buyer revealed this supplier this month (an admin
-- always may). Cut to 15 for Growth, 25 for Enterprise and admins, newest first. Null when nothing is allowed
-- or saved.
create or replace function public.supplier_shipment_reveal(p_slug text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid      uuid := auth.uid();
  v_admin    boolean;
  v_tier     text;
  v_n        integer;
  v_supplier uuid;
  r          record;
begin
  select coalesce(p.role = 'admin', false), p.plan_tier
    into v_admin, v_tier
    from public.profiles p
   where p.id = v_uid
     and not coalesce(p.is_suspended, false);
  if not found or not (v_admin or v_tier in ('growth', 'enterprise')) then
    return null;
  end if;
  v_n := case when v_admin or v_tier = 'enterprise' then 25 else 15 end;

  delete from public.volza_shipment_reveals where expires_at <= now();

  select s.id into v_supplier
    from public.suppliers s
    join public.volza_export_checks v on v.supplier_id = s.id
   where s.slug = p_slug
     and s.is_published = true
     and v.match_class = 'exact'
     and v.expires_at > now();
  if v_supplier is null then
    return null;
  end if;

  if not v_admin and not exists (
       select 1 from public.volza_reveal_uses u
        where u.user_id = v_uid and u.supplier_id = v_supplier
          and u.month = (date_trunc('month', now() at time zone 'utc'))::date) then
    return null;
  end if;

  select * into r from public.volza_shipment_reveals where supplier_id = v_supplier and fetched_at is not null;
  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'fetched_at', r.fetched_at,
    'limit',      v_n,
    'records',    coalesce((
      select jsonb_agg(jsonb_build_object(
               'date',          left(x.e ->> 'shipment_date', 10),
               'product',       x.e ->> 'product_description',
               'hs_code',       x.e ->> 'hsn_code',
               'buyer',         x.e ->> 'buyer_name',
               'buyer_country', x.e ->> 'buyer_country',
               'destination',   x.e ->> 'destination_country',
               'unit',          x.e ->> 'unit',
               'value_usd',     x.e -> 'trade_value_usd',
               'weight_kg',     x.e -> 'gross_weight_kg')
             order by x.d desc nulls last, x.ord)
        from (select e, ord, e ->> 'shipment_date' as d
                from jsonb_array_elements(r.records) with ordinality as t(e, ord)
               order by d desc nulls last, ord
               limit v_n) x), '[]'::jsonb));
end;
$$;

comment on function public.supplier_shipment_reveal(text) is
  'Saved latest shipments for a supplier the caller revealed this month: 15 for Growth, 25 for Enterprise and '
  'admins, newest first, no unit prices. Null for anyone else, a non-exact or expired match, or nothing saved. '
  'Deletes expired saved copies. 0141.';

revoke all on function public.supplier_shipment_reveal(text) from public, anon;
grant execute on function public.supplier_shipment_reveal(text) to authenticated, service_role;

-- Step 1 of a reveal, as the buyer. Returns {status}:
--   forbidden | unavailable | allowance_used (+limit) | daily_limit (+limit)
--   ready (+reveal: the read above)           — served from the saved copy, allowance recorded, no Volza call
--   busy | paused | budget                    — no saved copy to fall back on; nothing recorded
--   fetch (+claim, name, window_start, window_end) — the caller must call Volza, then finish or abort
create or replace function public.volza_reveal_begin(p_slug text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_month   date := (date_trunc('month', now() at time zone 'utc'))::date;
  v_day     timestamptz := date_trunc('day', now() at time zone 'utc') at time zone 'utc';
  v_admin   boolean;
  v_tier    text;
  c         record;
  cfg       record;
  r         record;
  v_saved   boolean;
  v_block   text;
  v_limit   integer;
  v_count   integer;
  v_pending integer;
  v_claim   uuid;
begin
  select coalesce(p.role = 'admin', false), p.plan_tier
    into v_admin, v_tier
    from public.profiles p
   where p.id = v_uid
     and not coalesce(p.is_suspended, false);
  if not found or not (v_admin or v_tier in ('growth', 'enterprise')) then
    return jsonb_build_object('status', 'forbidden');
  end if;

  select s.id, v.volza_supplier_name, v.window_start, v.window_end into c
    from public.suppliers s
    join public.volza_export_checks v on v.supplier_id = s.id
   where s.slug = p_slug
     and s.is_published = true
     and v.match_class = 'exact'
     and v.expires_at > now()
     and nullif(btrim(v.volza_supplier_name), '') is not null;
  if not found then
    return jsonb_build_object('status', 'unavailable');
  end if;

  -- ponytail: one lock for every reveal start; each holds it for a few row reads. Per-supplier locks if
  -- reveals ever queue behind each other.
  perform pg_advisory_xact_lock(hashtext('volza_shipment_reveal'));

  delete from public.volza_shipment_reveals where expires_at <= now();
  select * into cfg from public.volza_reveal_settings;

  -- The allowance: distinct suppliers this month and today, a fetch this buyer has in flight counting too.
  if not v_admin and not exists (
       select 1 from public.volza_reveal_uses
        where user_id = v_uid and supplier_id = c.id and month = v_month) then
    v_limit := case when v_tier = 'enterprise' then cfg.enterprise_per_month else cfg.growth_per_month end;
    select count(*) into v_count from (
      select supplier_id from public.volza_reveal_uses where user_id = v_uid and month = v_month
      union
      select supplier_id from public.volza_shipment_reveals
       where claimed_by = v_uid and claimed_at > now() - interval '2 minutes') x;
    if v_count >= v_limit then
      return jsonb_build_object('status', 'allowance_used', 'limit', v_limit);
    end if;
    select count(*) into v_count from (
      select supplier_id from public.volza_reveal_uses where user_id = v_uid and first_at >= v_day
      union
      select supplier_id from public.volza_shipment_reveals
       where claimed_by = v_uid and claimed_at > now() - interval '2 minutes') x;
    if v_count >= cfg.daily_max then
      return jsonb_build_object('status', 'daily_limit', 'limit', cfg.daily_max);
    end if;
  end if;

  select * into r from public.volza_shipment_reveals where supplier_id = c.id;
  v_saved := found and r.fetched_at is not null;

  if not (v_saved and r.fetched_at > now() - interval '30 days') then
    select count(*) into v_pending
      from public.volza_shipment_reveals where claim_id is not null and claimed_at > now() - interval '2 minutes';
    v_block := case
      when r.claim_id is not null and r.claimed_at > now() - interval '2 minutes' then 'busy'
      when not cfg.live or cfg.credit_remaining_usd < cfg.credit_floor_usd then 'paused'
      when (case when cfg.spent_month = v_month then cfg.spent_usd else 0 end) + (v_pending + 1) * 1.35
           > cfg.monthly_cap_usd then 'budget'
    end;
    if v_block is null then
      v_claim := gen_random_uuid();
      insert into public.volza_shipment_reveals (supplier_id, claim_id, claimed_at, claimed_by)
      values (c.id, v_claim, now(), v_uid)
      on conflict (supplier_id) do update
        set claim_id = excluded.claim_id, claimed_at = excluded.claimed_at, claimed_by = excluded.claimed_by;
      return jsonb_build_object('status', 'fetch', 'claim', v_claim, 'name', c.volza_supplier_name,
                                'window_start', c.window_start, 'window_end', c.window_end);
    end if;
    if not v_saved then
      return jsonb_build_object('status', v_block);
    end if;
    -- An older copy still serves while a fetch runs, the switch is off or the budget is spent.
  end if;

  insert into public.volza_reveal_uses (user_id, supplier_id, month)
  values (v_uid, c.id, v_month) on conflict do nothing;
  perform public._ledger_write('shipments.revealed', 'volza_shipment_reveals', c.id,
    jsonb_build_object('fetched', false, 'records', jsonb_array_length(r.records), 'fetched_at', r.fetched_at),
    null, null, c.id);
  return jsonb_build_object('status', 'ready', 'reveal', public.supplier_shipment_reveal(p_slug));
end;
$$;

comment on function public.volza_reveal_begin(text) is
  'Starts a shipment reveal for the caller: gate, allowance, saved copy or a claim to fetch from Volza (the '
  'per-supplier lock), behind the off switch, credit floor and monthly cap. 0141.';

revoke all on function public.volza_reveal_begin(text) from public, anon;
grant execute on function public.volza_reveal_begin(text) to authenticated;

-- Step 3, success, service role only (true when saved): save what Volza returned (zero records too, so nobody pays for it again
-- within 30 days), log the spend, record the buyer's allowance and the reveal.
create or replace function public.volza_reveal_finish(
  p_claim uuid, p_records jsonb, p_cost_usd numeric, p_credit_remaining_usd numeric)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  r record;
begin
  if p_records is null or jsonb_typeof(p_records) <> 'array' or jsonb_array_length(p_records) > 25 then
    raise exception 'records must be an array of at most 25' using errcode = '22023';
  end if;
  if p_cost_usd is null or p_cost_usd < 0 or p_cost_usd > 1.35 then
    raise exception 'cost % is outside 0 to 1.35', p_cost_usd using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext('volza_shipment_reveal'));
  perform public._volza_reveal_spend(p_cost_usd, p_credit_remaining_usd);

  select * into r from public.volza_shipment_reveals where claim_id = p_claim;
  if not found then
    return false;   -- the claim lapsed and another fetch took it over; the spend above still stands
  end if;

  update public.volza_shipment_reveals
     set records = p_records, fetched_at = now(), expires_at = now() + interval '1 year',
         cost_usd = p_cost_usd, claim_id = null, claimed_at = null, claimed_by = null
   where supplier_id = r.supplier_id;

  if r.claimed_by is not null then
    insert into public.volza_reveal_uses (user_id, supplier_id, month)
    values (r.claimed_by, r.supplier_id, (date_trunc('month', now() at time zone 'utc'))::date)
    on conflict do nothing;
  end if;
  perform public._ledger_write('shipments.revealed', 'volza_shipment_reveals', r.supplier_id,
    jsonb_build_object('fetched', true, 'records', jsonb_array_length(p_records), 'cost_usd', p_cost_usd),
    r.claimed_by, null, r.supplier_id);
  return true;
end;
$$;

comment on function public.volza_reveal_finish(uuid, jsonb, numeric, numeric) is
  'Saves a reveal fetch for the claim holder (service role only), logs its cost and Volza''s remaining credit, '
  'records the allowance and the activity entry. False when the claim had lapsed: the spend is still logged. 0141.';

revoke all on function public.volza_reveal_finish(uuid, jsonb, numeric, numeric) from public, anon, authenticated;
grant execute on function public.volza_reveal_finish(uuid, jsonb, numeric, numeric) to service_role;

-- Step 3, failure, service role only: release the claim, keep any older copy, use no allowance. p_cost_usd is
-- what Volza may have billed (the worst case when it cannot be known).
create or replace function public.volza_reveal_abort(p_claim uuid, p_cost_usd numeric)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if p_cost_usd is null or p_cost_usd < 0 or p_cost_usd > 1.35 then
    raise exception 'cost % is outside 0 to 1.35', p_cost_usd using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtext('volza_shipment_reveal'));
  delete from public.volza_shipment_reveals where claim_id = p_claim and fetched_at is null;
  update public.volza_shipment_reveals
     set claim_id = null, claimed_at = null, claimed_by = null
   where claim_id = p_claim;
  if p_cost_usd > 0 then
    perform public._volza_reveal_spend(p_cost_usd, null);
  end if;
end;
$$;

comment on function public.volza_reveal_abort(uuid, numeric) is
  'Releases a failed reveal fetch (service role only): nothing saved, no allowance used, any possible '
  'Volza charge logged. 0141.';

revoke all on function public.volza_reveal_abort(uuid, numeric) from public, anon, authenticated;
grant execute on function public.volza_reveal_abort(uuid, numeric) to service_role;

-- The caller's allowance, for the button's "18 of 30 left this month": null unless Growth or Enterprise and not
-- suspended; an admin has no limit (limit null).
create or replace function public.shipment_reveal_allowance()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_admin boolean;
  v_tier  text;
  v_limit integer;
begin
  select coalesce(p.role = 'admin', false), p.plan_tier
    into v_admin, v_tier
    from public.profiles p
   where p.id = v_uid
     and not coalesce(p.is_suspended, false);
  if not found or not (v_admin or v_tier in ('growth', 'enterprise')) then
    return null;
  end if;
  select case when v_admin then null when v_tier = 'enterprise' then enterprise_per_month else growth_per_month end
    into v_limit from public.volza_reveal_settings;
  return jsonb_build_object(
    'limit', v_limit,
    'used',  (select count(*) from public.volza_reveal_uses
               where user_id = v_uid and month = (date_trunc('month', now() at time zone 'utc'))::date),
    'shown', case when v_admin or v_tier = 'enterprise' then 25 else 15 end);
end;
$$;

comment on function public.shipment_reveal_allowance() is
  'The caller''s shipment reveals this month: limit (null for admins), used, and how many shipments a reveal '
  'shows (15 or 25). Null for anyone not entitled. 0141.';

revoke all on function public.shipment_reveal_allowance() from public, anon;
grant execute on function public.shipment_reveal_allowance() to authenticated;

-- rl_check accepts the reveal route's bucket. 0119's pattern: patch the LIVE definition after 'api_export'.
do $$
declare
  v_def text := pg_get_functiondef('public.rl_check(text, text, integer)'::regprocedure);
  v_new text := v_def;
  v_name text;
begin
  foreach v_name in array array['api_reveal']
  loop
    if position(quote_literal(v_name) in v_new) = 0 then
      if position('''api_export''' in v_new) = 0 then
        raise exception 'rl_check has no api_export anchor; patch by hand';
      end if;
      v_new := replace(v_new, '''api_export''', '''api_export'', ' || quote_literal(v_name));
    end if;
    if position(quote_literal(v_name) in v_new) = 0 then
      raise exception 'rl_check patch did not add %', v_name;
    end if;
  end loop;

  if v_new <> v_def then
    execute v_new;
  end if;
end
$$;
