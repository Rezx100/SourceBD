-- 0106 — The buyer's workspace: company details and inquiry defaults on
-- buyer_settings, a product base, RFQs that carry a message and questions,
-- and composer drafts (enterprise pass, 27 Sep 2026).
--
--   1. buyer_settings gains the company the buyer works for (name, type,
--      description, website, customer base, headcount, logo) and the defaults
--      the RFQ composer starts from (questions, an email template).
--      settings_get() returns them as "workspace" and "inquiry";
--      settings_update_workspace / settings_update_inquiry write them.
--   2. public.buyer_products — the buyer's own product records (numbers,
--      price, MOQ, media, variants, size chart, bill of materials, tech pack),
--      with five owner-scoped RPCs and a `product-media` storage bucket.
--   3. rfqs gains message, questions and product_id; rfq_create stores them
--      and rfq_get returns them. public.rfq_drafts holds the composer's
--      unsent state, with four owner-scoped RPCs.
--
-- rfq_create, rfq_get and settings_get are REPLACED here, built from their
-- last definitions in this repo (0028, 0028, 0059) with only additions. 0105
-- found production's buyer_supplier_profile AHEAD of the repo; if either of
-- these three has drifted the same way, a replace would silently delete what
-- production has and the repo does not. `ops/dry_run_0106_buyer_workspace.py`
-- compares each live body with the repo's before it applies anything and
-- stops on a difference. Run it first.
--
-- Hard invariants honoured:
--   * Server enforces auth + ownership: every RPC is SECURITY DEFINER with
--     `set search_path = public` and scopes every read and write to
--     auth.uid(). RLS on both new tables is owner-only; anon holds nothing.
--   * No contact field of any supplier is read or returned by anything here.
--   * rfq_create keeps the published + not-sanctioned check on every target,
--     the thread rows and the 50-target cap.
--   * Supabase's default privileges grant EXECUTE on new functions to `anon`
--     by name, so every new function revokes `anon` by name (0105's finding).
--
-- Idempotent: `if not exists`, `create or replace`, `drop policy if exists`,
-- `on conflict`. Re-running the file changes nothing.
--
-- Additive. Do not apply to production from this PR (AGENTS rule 15); the
-- founder applies it after the dry run in ops/plans/0106-dry-run.md.
--
-- Reversible:
--   drop function public.rfq_draft_delete(uuid);
--   drop function public.rfq_draft_get(uuid);
--   drop function public.rfq_draft_list();
--   drop function public.rfq_draft_save(uuid, jsonb);
--   drop table public.rfq_drafts;
--   -- restore rfq_create and rfq_get from 0028, settings_get from 0059
--   alter table public.rfqs drop column product_id, drop column questions, drop column message;
--   drop policy pol_product_media_owner_select on storage.objects;  (and _insert, _update, _delete)
--   delete from storage.buckets where id = 'product-media';
--   drop function public.buyer_product_set_status(uuid, text);
--   drop function public.buyer_product_delete(uuid);
--   drop function public.buyer_product_get(uuid);
--   drop function public.buyer_product_list();
--   drop function public.buyer_product_upsert(jsonb);
--   drop table public.buyer_products;
--   drop function public.settings_update_inquiry(jsonb);
--   drop function public.settings_update_workspace(jsonb);
--   drop function public._input_rows(jsonb, text, int);
--   drop function public._input_strings(jsonb, text, int, int);
--   drop function public._input_number(jsonb, text);
--   drop function public._input_text(jsonb, text, int);
--   alter table public.buyer_settings drop column company_name, … drop column inquiry_email_template;

set search_path = public;

-- ----------------------------------------------------------------------
-- Input helpers — the one place a json field is read, trimmed and checked.
-- Private: called only from the SECURITY DEFINER RPCs below, which run as
-- the owner, so nobody else is granted EXECUTE.
-- ----------------------------------------------------------------------

-- A text field: null when absent, json null or blank; trimmed; raises when
-- it is not a json string or is longer than p_max.
create or replace function public._input_text(p_input jsonb, p_key text, p_max int)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  v_val jsonb := p_input -> p_key;
  v_txt text;
begin
  if v_val is null or jsonb_typeof(v_val) = 'null' then
    return null;
  end if;
  if jsonb_typeof(v_val) <> 'string' then
    raise exception '% must be text', p_key using errcode = '22023';
  end if;
  v_txt := nullif(btrim(v_val #>> '{}'), '');
  if length(v_txt) > p_max then
    raise exception '% exceeds % characters', p_key, p_max using errcode = '22023';
  end if;
  return v_txt;
end;
$$;

-- A number of 0 or more: a json number or a numeric string; null when absent
-- or blank. NaN and infinity are refused (numeric accepts both, and NaN
-- passes a `>= 0` check).
create or replace function public._input_number(p_input jsonb, p_key text)
returns numeric
language plpgsql
immutable
set search_path = public
as $$
declare
  v_val jsonb := p_input -> p_key;
  v_num numeric;
begin
  if v_val is null or jsonb_typeof(v_val) = 'null' then
    return null;
  end if;
  if jsonb_typeof(v_val) not in ('number', 'string') then
    raise exception '% must be a number', p_key using errcode = '22023';
  end if;
  if btrim(v_val #>> '{}') = '' then
    return null;
  end if;
  begin
    v_num := (v_val #>> '{}')::numeric;
  exception when others then
    raise exception '% must be a number', p_key using errcode = '22023';
  end;
  if v_num::text in ('NaN', 'Infinity', '-Infinity') or v_num < 0 then
    raise exception '% must be a number of 0 or more', p_key using errcode = '22023';
  end if;
  return v_num;
end;
$$;

-- A list of text: null when absent; each item trimmed and blanks dropped;
-- raises on a non-string item, more than p_max_items, or an item over
-- p_max_len characters.
create or replace function public._input_strings(p_input jsonb, p_key text, p_max_items int, p_max_len int)
returns jsonb
language plpgsql
immutable
set search_path = public
as $$
declare
  v_val jsonb := p_input -> p_key;
  v_out jsonb;
begin
  if v_val is null or jsonb_typeof(v_val) = 'null' then
    return null;
  end if;
  if jsonb_typeof(v_val) <> 'array' then
    raise exception '% must be a list of text', p_key using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_array_elements(v_val) as e(v) where jsonb_typeof(e.v) <> 'string') then
    raise exception '% must be a list of text', p_key using errcode = '22023';
  end if;
  select coalesce(jsonb_agg(to_jsonb(t.s) order by t.i), '[]'::jsonb)
    into v_out
    from (select btrim(e.v #>> '{}') as s, e.i
            from jsonb_array_elements(v_val) with ordinality as e(v, i)) as t
   where t.s <> '';
  if jsonb_array_length(v_out) > p_max_items then
    raise exception '% holds more than % items', p_key, p_max_items using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_array_elements_text(v_out) as e(s) where length(e.s) > p_max_len) then
    raise exception '% has an item over % characters', p_key, p_max_len using errcode = '22023';
  end if;
  return v_out;
end;
$$;

-- A list of flat rows (size chart, bill of materials, variant rows): '[]'
-- when absent; at most p_max rows, each an object of at most 30 plain values
-- (text, number, true/false, null) of 500 characters or fewer.
create or replace function public._input_rows(p_value jsonb, p_key text, p_max int)
returns jsonb
language plpgsql
immutable
set search_path = public
as $$
begin
  if p_value is null or jsonb_typeof(p_value) = 'null' then
    return '[]'::jsonb;
  end if;
  if jsonb_typeof(p_value) <> 'array' then
    raise exception '% must be a list of rows', p_key using errcode = '22023';
  end if;
  if jsonb_array_length(p_value) > p_max then
    raise exception '% holds more than % rows', p_key, p_max using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_array_elements(p_value) as r(v) where jsonb_typeof(r.v) <> 'object') then
    raise exception '% rows must be objects', p_key using errcode = '22023';
  end if;
  if exists (
       select 1
         from jsonb_array_elements(p_value) as r(v),
              lateral jsonb_each(r.v) as kv(k, v)
        where jsonb_typeof(kv.v) not in ('string', 'number', 'boolean', 'null')
           or length(kv.k) > 64
           or length(kv.v #>> '{}') > 500
     )
     or exists (
       select 1
         from jsonb_array_elements(p_value) as r(v)
        where (select count(*) from jsonb_object_keys(r.v)) > 30
     ) then
    raise exception '% rows hold at most 30 plain values of 500 characters or fewer', p_key using errcode = '22023';
  end if;
  return p_value;
end;
$$;

revoke all on function public._input_text(jsonb, text, int)          from public, anon, authenticated;
revoke all on function public._input_number(jsonb, text)             from public, anon, authenticated;
revoke all on function public._input_strings(jsonb, text, int, int)  from public, anon, authenticated;
revoke all on function public._input_rows(jsonb, text, int)          from public, anon, authenticated;

-- ======================================================================
-- 1. Workspace and inquiry settings
-- ======================================================================

alter table public.buyer_settings
  add column if not exists company_name text
    check (company_name is null or length(company_name) <= 200),
  add column if not exists company_type text
    check (company_type is null or company_type in ('brand', 'retailer', 'importer', 'agent', 'other')),
  add column if not exists business_description text
    check (business_description is null or length(business_description) <= 2000),
  add column if not exists website text
    check (website is null or (length(website) <= 300 and website ~* '^https?://[^[:space:]]+$')),
  add column if not exists customer_base text
    check (customer_base is null or length(customer_base) <= 300),
  add column if not exists employee_count text
    check (employee_count is null or employee_count in ('1-10', '11-50', '51-200', '201-1000', '1000+')),
  add column if not exists company_logo_url text
    check (company_logo_url is null or length(company_logo_url) <= 1000),
  add column if not exists inquiry_questions jsonb not null default '[]'::jsonb
    check (case when jsonb_typeof(inquiry_questions) = 'array'
                then jsonb_array_length(inquiry_questions) <= 20
                else false end),
  add column if not exists inquiry_email_template text
    check (inquiry_email_template is null or length(inquiry_email_template) <= 4000);

-- settings_get — 0059's body, plus "workspace" and "inquiry".
create or replace function public.settings_get()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid          uuid := auth.uid();
  v_email        text;
  v_display_name text;
  v_avatar_url   text;
  v_role         text;
  v_plan_tier    text;
  v_created_at   timestamptz;
  v_bs           public.buyer_settings%rowtype;
begin
  if v_uid is null then
    return null::jsonb;
  end if;

  select u.email
    into v_email
    from auth.users u
   where u.id = v_uid;

  select p.display_name, p.avatar_url, p.role::text, p.plan_tier, p.created_at
    into v_display_name, v_avatar_url, v_role, v_plan_tier, v_created_at
    from public.profiles p
   where p.id = v_uid;

  insert into public.buyer_settings (owner_id)
    values (v_uid)
    on conflict (owner_id) do nothing;

  select bs.*
    into v_bs
    from public.buyer_settings bs
   where bs.owner_id = v_uid;

  return jsonb_build_object(
    'email',        v_email,
    'display_name', v_display_name,
    'avatar_url',   v_avatar_url,
    'role',         v_role,
    'plan_tier',    v_plan_tier,
    'created_at',   v_created_at,
    'notifications', jsonb_build_object(
      'digest',       coalesce(v_bs.notify_digest,       true),
      'rfq_replies',  coalesce(v_bs.notify_rfq_replies,  true),
      'saved_alerts', coalesce(v_bs.notify_saved_alerts, true)
    ),
    'workspace', jsonb_build_object(
      'company_name',         v_bs.company_name,
      'company_type',         v_bs.company_type,
      'business_description', v_bs.business_description,
      'website',              v_bs.website,
      'customer_base',        v_bs.customer_base,
      'employee_count',       v_bs.employee_count,
      'company_logo_url',     v_bs.company_logo_url
    ),
    'inquiry', jsonb_build_object(
      'questions',      coalesce(v_bs.inquiry_questions, '[]'::jsonb),
      'email_template', v_bs.inquiry_email_template
    )
  );
end;
$$;

comment on function public.settings_get() is
  'Spec B10 settings read RPC (0059: + avatar_url; 0106: + workspace, inquiry). Returns the caller''s '
  'email + profile + plan_tier + avatar_url + notification booleans + company details + inquiry defaults.';

revoke all     on function public.settings_get() from public;
grant  execute on function public.settings_get() to authenticated;

-- settings_update_workspace — a partial patch: only keys present in p_input
-- change; a present key holding null or '' clears the field.
create or replace function public.settings_update_workspace(p_input jsonb)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_name text;
  v_type text;
  v_desc text;
  v_site text;
  v_base text;
  v_size text;
  v_logo text;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_input is null or jsonb_typeof(p_input) <> 'object' then
    raise exception 'p_input must be a jsonb object' using errcode = '22023';
  end if;

  v_name := public._input_text(p_input, 'company_name', 200);
  v_type := public._input_text(p_input, 'company_type', 16);
  if v_type is not null and v_type not in ('brand', 'retailer', 'importer', 'agent', 'other') then
    raise exception 'company_type must be one of brand, retailer, importer, agent, other' using errcode = '22023';
  end if;
  v_desc := public._input_text(p_input, 'business_description', 2000);
  v_site := public._input_text(p_input, 'website', 300);
  if v_site is not null and v_site !~* '^https?://[^[:space:]]+$' then
    raise exception 'website must start with http:// or https://' using errcode = '22023';
  end if;
  v_base := public._input_text(p_input, 'customer_base', 300);
  v_size := public._input_text(p_input, 'employee_count', 16);
  if v_size is not null and v_size not in ('1-10', '11-50', '51-200', '201-1000', '1000+') then
    raise exception 'employee_count must be one of 1-10, 11-50, 51-200, 201-1000, 1000+' using errcode = '22023';
  end if;
  v_logo := public._input_text(p_input, 'company_logo_url', 1000);
  if v_logo is not null and v_logo !~* '^https?://[^[:space:]]+$' then
    raise exception 'company_logo_url must start with http:// or https://' using errcode = '22023';
  end if;

  insert into public.buyer_settings (owner_id)
    values (v_uid)
    on conflict (owner_id) do nothing;

  update public.buyer_settings bs
     set company_name         = case when p_input ? 'company_name'         then v_name else bs.company_name         end,
         company_type         = case when p_input ? 'company_type'         then v_type else bs.company_type         end,
         business_description = case when p_input ? 'business_description' then v_desc else bs.business_description end,
         website              = case when p_input ? 'website'              then v_site else bs.website              end,
         customer_base        = case when p_input ? 'customer_base'        then v_base else bs.customer_base        end,
         employee_count       = case when p_input ? 'employee_count'       then v_size else bs.employee_count       end,
         company_logo_url     = case when p_input ? 'company_logo_url'     then v_logo else bs.company_logo_url     end,
         updated_at           = now()
   where bs.owner_id = v_uid;
end;
$$;

comment on function public.settings_update_workspace(jsonb) is
  '0106: partial patch of the caller''s company details on buyer_settings; validates every field and raises on a bad one.';

revoke all     on function public.settings_update_workspace(jsonb) from public, anon;
grant  execute on function public.settings_update_workspace(jsonb) to authenticated;

-- settings_update_inquiry — partial patch of the composer's defaults:
-- `questions` (≤ 20 of ≤ 200 characters) and `email_template` (≤ 4000).
create or replace function public.settings_update_inquiry(p_input jsonb)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_questions jsonb;
  v_template  text;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_input is null or jsonb_typeof(p_input) <> 'object' then
    raise exception 'p_input must be a jsonb object' using errcode = '22023';
  end if;

  v_questions := public._input_strings(p_input, 'questions', 20, 200);
  v_template  := public._input_text(p_input, 'email_template', 4000);

  insert into public.buyer_settings (owner_id)
    values (v_uid)
    on conflict (owner_id) do nothing;

  update public.buyer_settings bs
     set inquiry_questions      = case when p_input ? 'questions'
                                       then coalesce(v_questions, '[]'::jsonb)
                                       else bs.inquiry_questions end,
         inquiry_email_template = case when p_input ? 'email_template'
                                       then v_template
                                       else bs.inquiry_email_template end,
         updated_at             = now()
   where bs.owner_id = v_uid;
end;
$$;

comment on function public.settings_update_inquiry(jsonb) is
  '0106: partial patch of the caller''s RFQ composer defaults (questions, email template) on buyer_settings.';

revoke all     on function public.settings_update_inquiry(jsonb) from public, anon;
grant  execute on function public.settings_update_inquiry(jsonb) to authenticated;

-- ======================================================================
-- 2. The buyer's product base
-- ======================================================================

create table if not exists public.buyer_products (
  id                       uuid        primary key default gen_random_uuid(),
  owner_id                 uuid        not null references auth.users(id) on delete cascade,
  name                     text        not null check (length(trim(name)) between 1 and 200),
  product_number           text        null check (product_number is null or length(product_number) <= 64),
  customer_product_number  text        null check (customer_product_number is null or length(customer_product_number) <= 64),
  description              text        null check (description is null or length(description) <= 8000),
  price_usd                numeric     null check (price_usd >= 0),
  moq                      numeric     null check (moq >= 0),
  main_material            text        null check (main_material is null or length(main_material) <= 200),
  category                 text        null check (category is null or length(category) <= 80),
  tags                     text[]      not null default '{}' check (cardinality(tags) <= 20),
  -- [{url, kind}], kind image | video | model | tech_pack
  media                    jsonb       not null default '[]'::jsonb
                             check (case when jsonb_typeof(media) = 'array'
                                         then jsonb_array_length(media) <= 20 else false end),
  -- {options: [{name, values: [...]}], rows: [{<option>: <value>, ..., sku?}]}
  variants                 jsonb       not null default '{"options":[],"rows":[]}'::jsonb
                             check (jsonb_typeof(variants) = 'object'),
  -- [{code, description, tol_minus, tol_plus, base}]
  size_chart               jsonb       not null default '[]'::jsonb
                             check (case when jsonb_typeof(size_chart) = 'array'
                                         then jsonb_array_length(size_chart) <= 60 else false end),
  -- [{part, material, qty, color, notes}]
  bom                      jsonb       not null default '[]'::jsonb
                             check (case when jsonb_typeof(bom) = 'array'
                                         then jsonb_array_length(bom) <= 100 else false end),
  tech_pack_url            text        null check (tech_pack_url is null or length(tech_pack_url) <= 1000),
  status                   text        not null default 'draft' check (status in ('draft', 'active', 'archived')),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index if not exists idx_buyer_products_owner_updated
  on public.buyer_products (owner_id, updated_at desc);

comment on table public.buyer_products is
  '0106: a buyer''s own product records. RLS owner-only; the RPCs buyer_product_* validate every field.';

alter table public.buyer_products enable row level security;

drop policy if exists pol_buyer_products_owner on public.buyer_products;
create policy pol_buyer_products_owner
  on public.buyer_products
  for all
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- Supabase's default privileges hand anon and authenticated everything on a
-- new table; anon gets nothing, authenticated the four verbs RLS scopes.
revoke all on public.buyer_products from anon, authenticated;
grant select, insert, update, delete on public.buyer_products to authenticated;

-- buyer_product_upsert(p_input) → uuid
--   Without `id`: inserts a product for the caller. With `id`: updates the
--   caller's own row, as a partial patch (keys left out keep their value);
--   another owner's id is 'product not found'. Every field is validated.
create or replace function public.buyer_product_upsert(p_input jsonb)
returns uuid
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_id        uuid;
  v_in        jsonb;
  v_existing  jsonb;
  v_name      text;
  v_tags      jsonb;
  v_media     jsonb;
  v_variants  jsonb;
  v_options   jsonb;
  v_tech_pack text;
  v_status    text;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_input is null or jsonb_typeof(p_input) <> 'object' then
    raise exception 'p_input must be a json object' using errcode = '22023';
  end if;
  if octet_length(p_input::text) > 262144 then
    raise exception 'product exceeds 256 KB' using errcode = '22023';
  end if;

  if nullif(btrim(coalesce(p_input ->> 'id', '')), '') is not null then
    begin
      v_id := (p_input ->> 'id')::uuid;
    exception when others then
      raise exception 'id must be a uuid' using errcode = '22023';
    end;
    select to_jsonb(bp)
      into v_existing
      from public.buyer_products bp
     where bp.id = v_id
       and bp.owner_id = v_uid
       for update;
    if v_existing is null then
      raise exception 'product not found';
    end if;
    v_in := v_existing || p_input;
  else
    v_in := p_input;
  end if;

  v_name := public._input_text(v_in, 'name', 200);
  if v_name is null then
    raise exception 'name is required' using errcode = '22023';
  end if;

  v_tags := coalesce(public._input_strings(v_in, 'tags', 20, 40), '[]'::jsonb);

  -- media: [{url, kind}], at most 20; anything else on an item is dropped.
  v_media := coalesce(nullif(v_in -> 'media', 'null'::jsonb), '[]'::jsonb);
  if jsonb_typeof(v_media) <> 'array' then
    raise exception 'media must be a list' using errcode = '22023';
  end if;
  if jsonb_array_length(v_media) > 20 then
    raise exception 'media holds more than 20 files' using errcode = '22023';
  end if;
  if exists (
    select 1
      from jsonb_array_elements(v_media) as m(v)
     where jsonb_typeof(m.v) <> 'object'
        or jsonb_typeof(m.v -> 'url') is distinct from 'string'
        or length(m.v ->> 'url') > 1000
        or (m.v ->> 'url') !~* '^https?://[^[:space:]]+$'
        or coalesce(m.v ->> 'kind', '') not in ('image', 'video', 'model', 'tech_pack')
  ) then
    raise exception 'each media item needs an http(s) url and a kind of image, video, model or tech_pack'
      using errcode = '22023';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('url', m.v ->> 'url', 'kind', m.v ->> 'kind') order by m.i), '[]'::jsonb)
    into v_media
    from jsonb_array_elements(v_media) with ordinality as m(v, i);

  -- variants: {options: [{name, values}] ≤ 10 × ≤ 100 values, rows ≤ 500}.
  v_variants := coalesce(nullif(v_in -> 'variants', 'null'::jsonb), '{}'::jsonb);
  if jsonb_typeof(v_variants) <> 'object' then
    raise exception 'variants must be an object of options and rows' using errcode = '22023';
  end if;
  v_options := coalesce(nullif(v_variants -> 'options', 'null'::jsonb), '[]'::jsonb);
  if jsonb_typeof(v_options) <> 'array' then
    raise exception 'variants.options must be a list' using errcode = '22023';
  end if;
  if jsonb_array_length(v_options) > 10 then
    raise exception 'variants.options holds more than 10 options' using errcode = '22023';
  end if;
  if exists (
    select 1
      from jsonb_array_elements(v_options) as o(v)
     where jsonb_typeof(o.v) <> 'object'
        or jsonb_typeof(o.v -> 'name') is distinct from 'string'
        or length(btrim(o.v ->> 'name')) not between 1 and 60
        or jsonb_typeof(o.v -> 'values') is distinct from 'array'
  ) then
    raise exception 'each variant option needs a name of 1 to 60 characters and a list of values'
      using errcode = '22023';
  end if;
  if exists (
    select 1
      from jsonb_array_elements(v_options) as o(v),
           lateral jsonb_array_elements(o.v -> 'values') with ordinality as x(v, i)
     where jsonb_typeof(x.v) <> 'string'
        or length(x.v #>> '{}') > 80
        or x.i > 100
  ) then
    raise exception 'each variant option holds at most 100 values of 80 characters or fewer'
      using errcode = '22023';
  end if;
  v_variants := jsonb_build_object(
    'options', v_options,
    'rows',    public._input_rows(v_variants -> 'rows', 'variants.rows', 500)
  );

  v_tech_pack := public._input_text(v_in, 'tech_pack_url', 1000);
  if v_tech_pack is not null and v_tech_pack !~* '^https?://[^[:space:]]+$' then
    raise exception 'tech_pack_url must start with http:// or https://' using errcode = '22023';
  end if;

  v_status := coalesce(public._input_text(v_in, 'status', 16), 'draft');
  if v_status not in ('draft', 'active', 'archived') then
    raise exception 'status must be draft, active or archived' using errcode = '22023';
  end if;

  insert into public.buyer_products as bp (
    id, owner_id, name, product_number, customer_product_number, description,
    price_usd, moq, main_material, category, tags, media, variants,
    size_chart, bom, tech_pack_url, status
  )
  values (
    coalesce(v_id, gen_random_uuid()),
    v_uid,
    v_name,
    public._input_text(v_in, 'product_number', 64),
    public._input_text(v_in, 'customer_product_number', 64),
    public._input_text(v_in, 'description', 8000),
    public._input_number(v_in, 'price_usd'),
    public._input_number(v_in, 'moq'),
    public._input_text(v_in, 'main_material', 200),
    public._input_text(v_in, 'category', 80),
    array(select jsonb_array_elements_text(v_tags)),
    v_media,
    v_variants,
    public._input_rows(v_in -> 'size_chart', 'size_chart', 60),
    public._input_rows(v_in -> 'bom', 'bom', 100),
    v_tech_pack,
    v_status
  )
  on conflict (id) do update
    set name                    = excluded.name,
        product_number          = excluded.product_number,
        customer_product_number = excluded.customer_product_number,
        description             = excluded.description,
        price_usd               = excluded.price_usd,
        moq                     = excluded.moq,
        main_material           = excluded.main_material,
        category                = excluded.category,
        tags                    = excluded.tags,
        media                   = excluded.media,
        variants                = excluded.variants,
        size_chart              = excluded.size_chart,
        bom                     = excluded.bom,
        tech_pack_url           = excluded.tech_pack_url,
        status                  = excluded.status,
        updated_at              = now()
  where bp.owner_id = v_uid
  returning bp.id into v_id;

  if v_id is null then
    raise exception 'product not found';
  end if;
  return v_id;
end;
$$;

revoke all     on function public.buyer_product_upsert(jsonb) from public, anon;
grant  execute on function public.buyer_product_upsert(jsonb) to authenticated;

-- buyer_product_list() → jsonb array, newest updated first. The heavy jsonb
-- columns are left out; media is reduced to a count and the first image.
create or replace function public.buyer_product_list()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id',             bp.id,
        'name',           bp.name,
        'product_number', bp.product_number,
        'category',       bp.category,
        'status',         bp.status,
        'price_usd',      bp.price_usd,
        'moq',            bp.moq,
        'media_count',    jsonb_array_length(bp.media),
        'first_image',    (select m.v ->> 'url'
                             from jsonb_array_elements(bp.media) with ordinality as m(v, i)
                            where m.v ->> 'kind' = 'image'
                            order by m.i
                            limit 1),
        'updated_at',     bp.updated_at
      )
      order by bp.updated_at desc, bp.id
    ),
    '[]'::jsonb
  )
  from public.buyer_products bp
  where bp.owner_id = auth.uid()
$$;

revoke all     on function public.buyer_product_list() from public, anon;
grant  execute on function public.buyer_product_list() to authenticated;

-- buyer_product_get(p_id) → the full row (without owner_id), or null when
-- it is not the caller's.
create or replace function public.buyer_product_get(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select to_jsonb(bp) - 'owner_id'
    from public.buyer_products bp
   where bp.id = p_id
     and bp.owner_id = auth.uid()
$$;

revoke all     on function public.buyer_product_get(uuid) from public, anon;
grant  execute on function public.buyer_product_get(uuid) to authenticated;

create or replace function public.buyer_product_delete(p_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  delete from public.buyer_products
   where id = p_id
     and owner_id = auth.uid();
  if not found then
    raise exception 'product not found';
  end if;
end;
$$;

revoke all     on function public.buyer_product_delete(uuid) from public, anon;
grant  execute on function public.buyer_product_delete(uuid) to authenticated;

create or replace function public.buyer_product_set_status(p_id uuid, p_status text)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_status is null or p_status not in ('draft', 'active', 'archived') then
    raise exception 'status must be draft, active or archived' using errcode = '22023';
  end if;
  update public.buyer_products
     set status     = p_status,
         updated_at = now()
   where id = p_id
     and owner_id = auth.uid();
  if not found then
    raise exception 'product not found';
  end if;
end;
$$;

revoke all     on function public.buyer_product_set_status(uuid, text) from public, anon;
grant  execute on function public.buyer_product_set_status(uuid, text) to authenticated;

-- ----------------------------------------------------------------------
-- product-media storage bucket
--
-- Public READ by URL (the bucket is public, as avatars is), so a product
-- image renders in <img>. Unlike 0059 there is NO public SELECT policy on
-- storage.objects: a public bucket serves its files by URL without one, and
-- 0059's `to public` policy also lets anyone LIST every file in the bucket —
-- here that would list every buyer's folder. SELECT is owner-folder only,
-- which is also what upload (upsert) and remove need.
-- ----------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-media',
  'product-media',
  true,
  10485760, -- 10 MB
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists pol_product_media_owner_select on storage.objects;
create policy pol_product_media_owner_select
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'product-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists pol_product_media_owner_insert on storage.objects;
create policy pol_product_media_owner_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'product-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists pol_product_media_owner_update on storage.objects;
create policy pol_product_media_owner_update
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'product-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'product-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists pol_product_media_owner_delete on storage.objects;
create policy pol_product_media_owner_delete
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'product-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ======================================================================
-- 3. RFQs carry a message and questions; drafts exist
-- ======================================================================

alter table public.rfqs
  add column if not exists message text null
    check (message is null or length(message) <= 8000),
  add column if not exists questions jsonb null
    check (questions is null
           or case when jsonb_typeof(questions) = 'array'
                   then jsonb_array_length(questions) <= 20
                   else false end),
  add column if not exists product_id uuid null
    references public.buyer_products(id) on delete set null;

-- rfq_create — 0028's body, plus message, questions and product_id.
create or replace function public.rfq_create(p_input jsonb)
returns uuid
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid                uuid := auth.uid();
  v_role               text;
  v_target_ids         uuid[];
  v_target_count       int;
  v_valid_count        int;
  v_product_title      text;
  v_product_desc       text;
  v_quantity           numeric;
  v_quantity_unit      text;
  v_target_unit_price  numeric;
  v_currency           text;
  v_ship_to_country    text;
  v_ship_by            date;
  v_message            text;
  v_questions          jsonb;
  v_product_id         uuid;
  v_rfq_id             uuid;
  v_supplier_id        uuid;
  v_thread_id          uuid;
  v_claimed            uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select role::text into v_role
    from public.profiles
   where id = v_uid;
  if v_role is null or v_role not in ('buyer', 'admin') then
    raise exception 'caller is not a buyer' using errcode = '42501';
  end if;

  if p_input is null or jsonb_typeof(p_input) <> 'object' then
    raise exception 'p_input must be a json object';
  end if;

  v_product_title := nullif(trim(coalesce(p_input->>'product_title', '')), '');
  if v_product_title is null then
    raise exception 'product_title is required';
  end if;
  if length(v_product_title) > 200 then
    raise exception 'product_title exceeds 200 characters';
  end if;

  v_product_desc := nullif(trim(coalesce(p_input->>'product_description', '')), '');
  if v_product_desc is not null and length(v_product_desc) > 4000 then
    raise exception 'product_description exceeds 4000 characters';
  end if;

  begin
    v_quantity := (p_input->>'quantity')::numeric;
  exception when others then
    raise exception 'quantity must be numeric';
  end;
  if v_quantity is null or v_quantity <= 0 then
    raise exception 'quantity must be > 0';
  end if;

  v_quantity_unit := nullif(trim(coalesce(p_input->>'quantity_unit', '')), '');
  if v_quantity_unit is null then
    raise exception 'quantity_unit is required';
  end if;
  if length(v_quantity_unit) > 32 then
    raise exception 'quantity_unit exceeds 32 characters';
  end if;

  if (p_input ? 'target_unit_price') and (p_input->>'target_unit_price') is not null then
    begin
      v_target_unit_price := (p_input->>'target_unit_price')::numeric;
    exception when others then
      raise exception 'target_unit_price must be numeric';
    end;
    if v_target_unit_price is not null and v_target_unit_price <= 0 then
      raise exception 'target_unit_price must be > 0';
    end if;
  end if;

  v_currency := upper(coalesce(nullif(trim(coalesce(p_input->>'currency', '')), ''), 'USD'));
  if v_currency !~ '^[A-Z]{3}$' then
    raise exception 'currency must be a 3-letter code';
  end if;

  v_ship_to_country := nullif(trim(coalesce(p_input->>'ship_to_country', '')), '');
  if v_ship_to_country is not null and length(v_ship_to_country) > 64 then
    raise exception 'ship_to_country exceeds 64 characters';
  end if;

  if (p_input ? 'ship_by') and (p_input->>'ship_by') is not null
     and length(trim(p_input->>'ship_by')) > 0 then
    begin
      v_ship_by := (p_input->>'ship_by')::date;
    exception when others then
      raise exception 'ship_by must be a date';
    end;
  end if;

  -- 0106: the message to the suppliers, the questions they are asked, and
  -- the buyer's own product this RFQ is about.
  v_message   := public._input_text(p_input, 'message', 8000);
  v_questions := nullif(public._input_strings(p_input, 'questions', 20, 200), '[]'::jsonb);
  if nullif(btrim(coalesce(p_input->>'product_id', '')), '') is not null then
    begin
      v_product_id := (p_input->>'product_id')::uuid;
    exception when others then
      raise exception 'product_id must be a uuid';
    end;
    if not exists (
      select 1 from public.buyer_products bp
       where bp.id = v_product_id and bp.owner_id = v_uid
    ) then
      raise exception 'product_id is not one of your products';
    end if;
  end if;

  -- target_supplier_ids[]
  if jsonb_typeof(p_input->'target_supplier_ids') <> 'array' then
    raise exception 'target_supplier_ids must be an array';
  end if;
  select array_agg(distinct (elem)::uuid)
    into v_target_ids
    from jsonb_array_elements_text(p_input->'target_supplier_ids') as elem;
  v_target_count := coalesce(array_length(v_target_ids, 1), 0);
  if v_target_count = 0 then
    raise exception 'target_supplier_ids cannot be empty';
  end if;
  if v_target_count > 50 then
    raise exception 'target_supplier_ids exceeds 50';
  end if;

  -- Every target must be a published, non-sanctioned supplier.
  select count(*) into v_valid_count
    from public.suppliers s
   where s.id = any (v_target_ids)
     and s.is_published   = true
     and s.is_sanctioned  = false;
  if v_valid_count <> v_target_count then
    raise exception 'one or more target suppliers are not published';
  end if;

  insert into public.rfqs (
    buyer_id, target_supplier_ids, product_title, product_description,
    quantity, quantity_unit, target_unit_price, currency, ship_to_country, ship_by,
    message, questions, product_id
  )
  values (
    v_uid, v_target_ids, v_product_title, v_product_desc,
    v_quantity, v_quantity_unit, v_target_unit_price, v_currency, v_ship_to_country, v_ship_by,
    v_message, v_questions, v_product_id
  )
  returning id into v_rfq_id;

  -- Materialise one message_threads row per target supplier, keyed by
  -- the new rfq_id. Inline (instead of calling thread_open) to keep the
  -- whole operation atomic and skip the per-supplier published check we
  -- already did above.
  foreach v_supplier_id in array v_target_ids loop
    insert into public.message_threads (buyer_id, supplier_id, rfq_id, subject)
    values (v_uid, v_supplier_id, v_rfq_id, v_product_title)
    on conflict (buyer_id, supplier_id, rfq_id) do nothing
    returning id into v_thread_id;

    if v_thread_id is null then
      select id into v_thread_id
        from public.message_threads
       where buyer_id    = v_uid
         and supplier_id = v_supplier_id
         and rfq_id      = v_rfq_id;
    end if;

    insert into public.thread_participants (thread_id, user_id, role)
    values (v_thread_id, v_uid, 'buyer')
    on conflict (thread_id, user_id) do nothing;

    select s.claimed_by into v_claimed
      from public.suppliers s
     where s.id = v_supplier_id;
    if v_claimed is not null and v_claimed <> v_uid then
      insert into public.thread_participants (thread_id, user_id, role)
      values (v_thread_id, v_claimed, 'supplier')
      on conflict (thread_id, user_id) do nothing;
    end if;
  end loop;

  return v_rfq_id;
end;
$$;

revoke all  on function public.rfq_create(jsonb) from public;
grant execute on function public.rfq_create(jsonb) to authenticated;

-- rfq_get — 0028's body, plus message, questions and product_id. The
-- supplier side sees them too: they are the RFQ.
create or replace function public.rfq_get(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid          uuid := auth.uid();
  v_rfq          record;
  v_is_buyer     boolean := false;
  v_is_supplier  boolean := false;
  v_my_supplier  uuid;
  v_targets      jsonb;
  v_quotes       jsonb;
  v_thread_id    uuid;
begin
  if v_uid is null then
    return null;
  end if;
  if p_id is null then
    return null;
  end if;

  select r.* into v_rfq from public.rfqs r where r.id = p_id;
  if not found then
    return null;
  end if;

  v_is_buyer := (v_rfq.buyer_id = v_uid);

  select s.id into v_my_supplier
    from public.suppliers s
   where s.claimed_by = v_uid
     and s.id = any (v_rfq.target_supplier_ids)
   limit 1;
  v_is_supplier := v_my_supplier is not null;

  if not (v_is_buyer or v_is_supplier) then
    return null;
  end if;

  -- Targeted suppliers — buyer-safe shape (no PII).
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id',           s.id,
        'slug',         s.slug,
        'company_name', s.company_name,
        'entity_type',  s.entity_type::text,
        'city',         s.city,
        'district',     s.district
      )
      order by s.company_name
    ),
    '[]'::jsonb
  )
  into v_targets
  from public.suppliers s
  where s.id = any (v_rfq.target_supplier_ids);

  -- Quotes — buyer sees all; supplier sees only own.
  with q as (
    select
      rq.id, rq.rfq_id, rq.supplier_id, rq.unit_price, rq.currency,
      rq.lead_time_days, rq.moq, rq.valid_until, rq.notes,
      rq.status::text as status, rq.created_at, rq.updated_at,
      s.slug         as supplier_slug,
      s.company_name as supplier_name,
      s.entity_type::text as supplier_entity_type
    from public.rfq_quotes rq
    join public.suppliers s on s.id = rq.supplier_id
    where rq.rfq_id = p_id
      and (v_is_buyer or rq.supplier_id = v_my_supplier)
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id',                  id,
        'supplier_id',         supplier_id,
        'supplier_slug',       supplier_slug,
        'supplier_name',       supplier_name,
        'supplier_entity_type', supplier_entity_type,
        'unit_price',          unit_price,
        'currency',            currency,
        'lead_time_days',      lead_time_days,
        'moq',                 moq,
        'valid_until',         valid_until,
        'notes',               notes,
        'status',              status,
        'created_at',          created_at,
        'updated_at',          updated_at
      )
      order by created_at asc
    ),
    '[]'::jsonb
  )
  into v_quotes
  from q;

  -- Optional thread_id for the caller's perspective (for "Open thread" UX).
  if v_is_buyer then
    select id into v_thread_id
      from public.message_threads
     where buyer_id = v_uid
       and rfq_id   = p_id
     order by created_at asc
     limit 1;
  elsif v_is_supplier then
    select mt.id into v_thread_id
      from public.message_threads mt
      join public.thread_participants tp
        on tp.thread_id = mt.id and tp.user_id = v_uid
     where mt.rfq_id      = p_id
       and mt.supplier_id = v_my_supplier
     limit 1;
  end if;

  return jsonb_build_object(
    'id',                    v_rfq.id,
    'product_title',         v_rfq.product_title,
    'product_description',   v_rfq.product_description,
    'quantity',              v_rfq.quantity,
    'quantity_unit',         v_rfq.quantity_unit,
    'target_unit_price',     v_rfq.target_unit_price,
    'currency',              v_rfq.currency,
    'ship_to_country',       v_rfq.ship_to_country,
    'ship_by',               v_rfq.ship_by,
    'status',                v_rfq.status::text,
    'accepted_quote_id',     v_rfq.accepted_quote_id,
    'message',               v_rfq.message,
    'questions',             v_rfq.questions,
    'product_id',            v_rfq.product_id,
    'created_at',            v_rfq.created_at,
    'updated_at',            v_rfq.updated_at,
    'viewer_role',           case
                               when v_is_buyer and v_is_supplier then 'both'
                               when v_is_buyer                   then 'buyer'
                               else                                  'supplier'
                             end,
    'targets',               v_targets,
    'quotes',                v_quotes,
    'thread_id',             v_thread_id
  );
end;
$$;

revoke all  on function public.rfq_get(uuid) from public;
grant execute on function public.rfq_get(uuid) to authenticated;

-- rfq_drafts — the composer's unsent state. `payload` is the composer's
-- own fields; target_supplier_ids and product_id are lifted out of it so
-- they can be queried and kept honest.
create table if not exists public.rfq_drafts (
  id                   uuid        primary key default gen_random_uuid(),
  owner_id             uuid        not null references auth.users(id) on delete cascade,
  payload              jsonb       not null
                         check (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 32768),
  target_supplier_ids  uuid[]      not null default '{}' check (cardinality(target_supplier_ids) <= 50),
  product_id           uuid        null references public.buyer_products(id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists idx_rfq_drafts_owner_updated
  on public.rfq_drafts (owner_id, updated_at desc);

comment on table public.rfq_drafts is
  '0106: RFQ composer drafts. RLS owner-only; written through rfq_draft_save.';

alter table public.rfq_drafts enable row level security;

drop policy if exists pol_rfq_drafts_owner on public.rfq_drafts;
create policy pol_rfq_drafts_owner
  on public.rfq_drafts
  for all
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

revoke all on public.rfq_drafts from anon, authenticated;
grant select, insert, update, delete on public.rfq_drafts to authenticated;

-- rfq_draft_save(p_id, p_payload) → uuid. A null id inserts; an id updates
-- the caller's own draft ('draft not found' otherwise).
create or replace function public.rfq_draft_save(p_id uuid, p_payload jsonb)
returns uuid
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_targets uuid[] := '{}';
  v_product uuid;
  v_id      uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'payload must be a json object' using errcode = '22023';
  end if;
  if octet_length(p_payload::text) > 32768 then
    raise exception 'payload exceeds 32 KB' using errcode = '22023';
  end if;

  if coalesce(jsonb_typeof(p_payload -> 'target_supplier_ids'), 'null') <> 'null' then
    if jsonb_typeof(p_payload -> 'target_supplier_ids') <> 'array' then
      raise exception 'target_supplier_ids must be a list' using errcode = '22023';
    end if;
    begin
      select coalesce(array_agg(distinct t.e::uuid), '{}')
        into v_targets
        from jsonb_array_elements_text(p_payload -> 'target_supplier_ids') as t(e);
    exception when others then
      raise exception 'target_supplier_ids must hold supplier ids' using errcode = '22023';
    end;
    if cardinality(v_targets) > 50 then
      raise exception 'target_supplier_ids exceeds 50' using errcode = '22023';
    end if;
  end if;

  if nullif(btrim(coalesce(p_payload ->> 'product_id', '')), '') is not null then
    begin
      v_product := (p_payload ->> 'product_id')::uuid;
    exception when others then
      raise exception 'product_id must be a uuid' using errcode = '22023';
    end;
    if not exists (
      select 1 from public.buyer_products bp
       where bp.id = v_product and bp.owner_id = v_uid
    ) then
      raise exception 'product_id is not one of your products' using errcode = '22023';
    end if;
  end if;

  if p_id is null then
    insert into public.rfq_drafts (owner_id, payload, target_supplier_ids, product_id)
    values (v_uid, p_payload, v_targets, v_product)
    returning id into v_id;
  else
    update public.rfq_drafts
       set payload             = p_payload,
           target_supplier_ids = v_targets,
           product_id          = v_product,
           updated_at          = now()
     where id = p_id
       and owner_id = v_uid
    returning id into v_id;
    if v_id is null then
      raise exception 'draft not found';
    end if;
  end if;
  return v_id;
end;
$$;

revoke all     on function public.rfq_draft_save(uuid, jsonb) from public, anon;
grant  execute on function public.rfq_draft_save(uuid, jsonb) to authenticated;

create or replace function public.rfq_draft_list()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id',                  d.id,
        'payload',             d.payload,
        'target_supplier_ids', to_jsonb(d.target_supplier_ids),
        'product_id',          d.product_id,
        'updated_at',          d.updated_at
      )
      order by d.updated_at desc, d.id
    ),
    '[]'::jsonb
  )
  from public.rfq_drafts d
  where d.owner_id = auth.uid()
$$;

revoke all     on function public.rfq_draft_list() from public, anon;
grant  execute on function public.rfq_draft_list() to authenticated;

create or replace function public.rfq_draft_get(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
           'id',                  d.id,
           'payload',             d.payload,
           'target_supplier_ids', to_jsonb(d.target_supplier_ids),
           'product_id',          d.product_id,
           'updated_at',          d.updated_at
         )
    from public.rfq_drafts d
   where d.id = p_id
     and d.owner_id = auth.uid()
$$;

revoke all     on function public.rfq_draft_get(uuid) from public, anon;
grant  execute on function public.rfq_draft_get(uuid) to authenticated;

create or replace function public.rfq_draft_delete(p_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  delete from public.rfq_drafts
   where id = p_id
     and owner_id = auth.uid();
  if not found then
    raise exception 'draft not found';
  end if;
end;
$$;

revoke all     on function public.rfq_draft_delete(uuid) from public, anon;
grant  execute on function public.rfq_draft_delete(uuid) to authenticated;

-- =============================================================================
-- end migration 0106_buyer_products_rfq_message_workspace
-- =============================================================================
