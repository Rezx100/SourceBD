-- 0109 — Where the v4 buyer onboarding keeps its answers (3 Oct 2026).
--
-- The answers and their columns are listed in
-- context/feature-specs/ds-v4/onboarding-data-map.md ("Migration order", step 1).
--
--   1. profiles gains the buyer's work role (job_role — NOT profiles.role, the
--      buyer/supplier/admin enum) and when they accepted which terms.
--   2. buyer_settings gains the company's country and what the buyer sources:
--      HS headings, required certificate kinds, the markets they sell into.
--      customer_base (0106) stays the free-text Settings field.
--   3. onboarding_save_buyer(jsonb) writes them; onboarding_get_buyer() reads
--      them back so a half-finished onboarding resumes where it stopped.
--
-- Not here, on purpose: claim documents (data map step 2, needs a storage
-- bucket) and workspaces and invites (step 3, its own spec with RLS on every
-- buyer table).
--
-- Hard invariants honoured:
--   * Server enforces auth + ownership: both RPCs are SECURITY DEFINER with
--     `set search_path = public` and touch only auth.uid()'s rows. Neither
--     table gains an insert/update policy; the RPCs stay the only write path
--     (0022, 0031).
--   * terms_accepted_at is stamped by the server; a caller sends only the
--     version it accepted and cannot back-date or clear an acceptance.
--   * Supabase grants EXECUTE on new functions to `anon` by name, so both
--     revoke `anon` by name (0105's finding).
--
-- Idempotent: `if not exists`, `create or replace`, constraints dropped
-- before they are added. Additive and nullable: no existing row changes.
--
-- Do not apply to production from this PR (AGENTS rule 15); the founder
-- applies it after the dry run in ops/plans/0109-dry-run.md.
--
-- Reversible:
--   drop function public.onboarding_get_buyer();
--   drop function public.onboarding_save_buyer(jsonb);
--   alter table public.buyer_settings drop column sell_markets,
--     drop column required_cert_kinds, drop column sourcing_hs_headings,
--     drop column company_country;
--   alter table public.profiles drop column terms_version,
--     drop column terms_accepted_at, drop column job_role;

set search_path = public;

-- ----------------------------------------------------------------------
-- 1. profiles
-- ----------------------------------------------------------------------

alter table public.profiles
  add column if not exists job_role          text,
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists terms_version     text;

alter table public.profiles drop constraint if exists profiles_job_role_check;
alter table public.profiles add constraint profiles_job_role_check
  check (job_role in ('sourcing', 'compliance', 'merchandising', 'founder', 'other'));

-- Both or neither: an acceptance always says which terms it was.
alter table public.profiles drop constraint if exists profiles_terms_check;
alter table public.profiles add constraint profiles_terms_check
  check ((terms_accepted_at is null) = (terms_version is null)
         and (terms_version is null or length(terms_version) between 1 and 32));

-- ----------------------------------------------------------------------
-- 2. buyer_settings
-- ----------------------------------------------------------------------

alter table public.buyer_settings
  add column if not exists company_country      text,
  add column if not exists sourcing_hs_headings text[],
  add column if not exists required_cert_kinds  public.cert_kind[],
  add column if not exists sell_markets         text[];

-- ISO 3166-1 alpha-2, upper case.
alter table public.buyer_settings drop constraint if exists buyer_settings_company_country_check;
alter table public.buyer_settings add constraint buyer_settings_company_country_check
  check (company_country ~ '^[A-Z]{2}$');

-- Four-digit headings ("6105"). The digit check per element lives in the
-- writer; the table caps the size, since a check constraint cannot loop.
alter table public.buyer_settings drop constraint if exists buyer_settings_sourcing_hs_headings_check;
alter table public.buyer_settings add constraint buyer_settings_sourcing_hs_headings_check
  check (cardinality(sourcing_hs_headings) <= 100);

alter table public.buyer_settings drop constraint if exists buyer_settings_required_cert_kinds_check;
alter table public.buyer_settings add constraint buyer_settings_required_cert_kinds_check
  check (cardinality(required_cert_kinds) <= 20);

alter table public.buyer_settings drop constraint if exists buyer_settings_sell_markets_check;
alter table public.buyer_settings add constraint buyer_settings_sell_markets_check
  check (sell_markets <@ array['UK', 'EU', 'US', 'CA']::text[]);

-- ----------------------------------------------------------------------
-- 3. The writer. A key that is present is written (json null clears it);
--    a key that is absent is left alone, so each onboarding step sends only
--    its own answers. terms_version is the exception: it cannot be cleared.
-- ----------------------------------------------------------------------

create or replace function public.onboarding_save_buyer(p_input jsonb)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_role    text;
  v_terms   text;
  v_country text;
  v_hs      text[];
  v_certs   public.cert_kind[];
  v_markets text[];
  v_list    jsonb;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_input is null or jsonb_typeof(p_input) <> 'object' then
    raise exception 'p_input must be a jsonb object' using errcode = '22023';
  end if;

  v_role := public._input_text(p_input, 'job_role', 16);
  if v_role is not null and v_role not in ('sourcing', 'compliance', 'merchandising', 'founder', 'other') then
    raise exception 'job_role must be one of sourcing, compliance, merchandising, founder, other' using errcode = '22023';
  end if;

  v_terms := public._input_text(p_input, 'terms_version', 32);
  if p_input ? 'terms_version' and v_terms is null then
    raise exception 'terms_version cannot be cleared' using errcode = '22023';
  end if;

  v_country := upper(public._input_text(p_input, 'company_country', 2));
  if v_country is not null and v_country !~ '^[A-Z]{2}$' then
    raise exception 'company_country must be a two-letter country code' using errcode = '22023';
  end if;

  v_list := public._input_strings(p_input, 'sourcing_hs_headings', 100, 4);
  if v_list is not null then
    if exists (select 1 from jsonb_array_elements_text(v_list) e(s) where e.s !~ '^[0-9]{4}$') then
      raise exception 'sourcing_hs_headings must be four-digit HS headings' using errcode = '22023';
    end if;
    select coalesce(array_agg(distinct e.s order by e.s), '{}') into v_hs
      from jsonb_array_elements_text(v_list) e(s);
  end if;

  v_list := public._input_strings(p_input, 'required_cert_kinds', 20, 32);
  if v_list is not null then
    if exists (select 1 from jsonb_array_elements_text(v_list) e(s)
                where e.s <> all (enum_range(null::public.cert_kind)::text[])) then
      raise exception 'required_cert_kinds holds an unknown certificate kind' using errcode = '22023';
    end if;
    select coalesce(array_agg(distinct e.s::public.cert_kind), '{}') into v_certs
      from jsonb_array_elements_text(v_list) e(s);
  end if;

  v_list := public._input_strings(p_input, 'sell_markets', 4, 2);
  if v_list is not null then
    if exists (select 1 from jsonb_array_elements_text(v_list) e(s)
                where e.s not in ('UK', 'EU', 'US', 'CA')) then
      raise exception 'sell_markets must be UK, EU, US or CA' using errcode = '22023';
    end if;
    select coalesce(array_agg(distinct e.s order by e.s), '{}') into v_markets
      from jsonb_array_elements_text(v_list) e(s);
  end if;

  update public.profiles p
     set job_role          = case when p_input ? 'job_role' then v_role else p.job_role end,
         terms_version     = case when v_terms is not null then v_terms else p.terms_version end,
         terms_accepted_at = case when v_terms is not null then now() else p.terms_accepted_at end
   where p.id = v_uid;

  if p_input ?| array['company_country', 'sourcing_hs_headings', 'required_cert_kinds', 'sell_markets'] then
    insert into public.buyer_settings (owner_id)
      values (v_uid)
      on conflict (owner_id) do nothing;

    update public.buyer_settings bs
       set company_country      = case when p_input ? 'company_country'      then v_country else bs.company_country      end,
           sourcing_hs_headings = case when p_input ? 'sourcing_hs_headings' then v_hs      else bs.sourcing_hs_headings end,
           required_cert_kinds  = case when p_input ? 'required_cert_kinds'  then v_certs   else bs.required_cert_kinds  end,
           sell_markets         = case when p_input ? 'sell_markets'         then v_markets else bs.sell_markets         end,
           updated_at           = now()
     where bs.owner_id = v_uid;
  end if;
end;
$$;

revoke all     on function public.onboarding_save_buyer(jsonb) from public, anon;
grant  execute on function public.onboarding_save_buyer(jsonb) to authenticated;

-- ----------------------------------------------------------------------
-- 4. The reader: the caller's answers, nulls where none were given.
-- ----------------------------------------------------------------------

create or replace function public.onboarding_get_buyer()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
           'job_role',             p.job_role,
           'terms_version',        p.terms_version,
           'terms_accepted_at',    p.terms_accepted_at,
           'company_country',      bs.company_country,
           'sourcing_hs_headings', to_jsonb(bs.sourcing_hs_headings),
           'required_cert_kinds',  to_jsonb(bs.required_cert_kinds),
           'sell_markets',         to_jsonb(bs.sell_markets))
    from public.profiles p
    left join public.buyer_settings bs on bs.owner_id = p.id
   where p.id = auth.uid();
$$;

revoke all     on function public.onboarding_get_buyer() from public, anon;
grant  execute on function public.onboarding_get_buyer() to authenticated;
