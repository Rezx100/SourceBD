-- 0028 — RFQs (Spec B7, Phase 2).
--
-- Buyer composes an RFQ targeting one or more claimed factories, each
-- targeted supplier may submit a single quote, and the buyer accepts
-- exactly one quote which closes the RFQ. The RFQ becomes the parent of
-- a per-supplier `message_threads` row keyed by `rfq_id` (the column
-- already exists on `message_threads` from B6, nullable, reserved for
-- this spec). Every write goes through a `security definer` RPC; RLS
-- SELECT policies mirror the visibility rules so direct PostgREST reads
-- give the same answers as the RPCs.
--
-- Hard invariants:
--   * Buyer A cannot see buyer B's RFQs or quotes.
--   * Supplier S only sees RFQs whose `target_supplier_ids` contains a
--     supplier row that S has claimed (`suppliers.claimed_by = auth.uid()`).
--   * Suppliers see only their own quotes; the buyer sees every quote
--     on their own RFQ.
--   * No SBI or contact-PII columns are returned by any of these RPCs.
--   * The schema does NOT add a FK from message_threads.rfq_id to
--     rfqs(id). The column was created in B6 ahead of this spec and is
--     reserved by convention; adding a FK now would not change behaviour
--     (the column is only ever written from `rfq_create` below).
--
-- Reversible:
--   drop function public.rfq_quote_accept(uuid);
--   drop function public.rfq_quote_submit(uuid, uuid, numeric, text, int, numeric, date, text);
--   drop function public.rfq_get(uuid);
--   drop function public.rfq_list(text);
--   drop function public.rfq_create(jsonb);
--   drop table public.rfq_quotes;
--   drop table public.rfqs;
--   drop type public.rfq_quote_status;
--   drop type public.rfq_status;

-- ----------------------------------------------------------------------
-- Enums
-- ----------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'rfq_status') then
    create type public.rfq_status as enum ('open', 'accepted', 'closed', 'cancelled');
  end if;
end$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'rfq_quote_status') then
    create type public.rfq_quote_status as enum ('submitted', 'accepted', 'rejected', 'withdrawn');
  end if;
end$$;

-- ----------------------------------------------------------------------
-- Tables
-- ----------------------------------------------------------------------

create table if not exists public.rfqs (
  id                   uuid             primary key default gen_random_uuid(),
  buyer_id             uuid             not null references auth.users(id) on delete cascade,
  target_supplier_ids  uuid[]           not null,
  product_title        text             not null check (length(trim(product_title)) > 0),
  product_description  text             null,
  quantity             numeric          not null check (quantity > 0),
  quantity_unit        text             not null check (length(trim(quantity_unit)) > 0),
  target_unit_price    numeric          null check (target_unit_price is null or target_unit_price > 0),
  currency             text             not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  ship_to_country      text             null,
  ship_by              date             null,
  status               public.rfq_status not null default 'open',
  accepted_quote_id    uuid             null,
  created_at           timestamptz      not null default now(),
  updated_at           timestamptz      not null default now(),
  check (array_length(target_supplier_ids, 1) between 1 and 50)
);

create index if not exists idx_rfqs_buyer_created
  on public.rfqs (buyer_id, created_at desc);
create index if not exists idx_rfqs_targets_gin
  on public.rfqs using gin (target_supplier_ids);
create index if not exists idx_rfqs_status
  on public.rfqs (status);

create table if not exists public.rfq_quotes (
  id              uuid                     primary key default gen_random_uuid(),
  rfq_id          uuid                     not null references public.rfqs(id)       on delete cascade,
  supplier_id     uuid                     not null references public.suppliers(id)  on delete cascade,
  submitted_by    uuid                     not null references auth.users(id)        on delete cascade,
  unit_price      numeric                  not null check (unit_price > 0),
  currency        text                     not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  lead_time_days  int                      null check (lead_time_days is null or lead_time_days >= 0),
  moq             numeric                  null check (moq is null or moq >= 0),
  valid_until     date                     null,
  notes           text                     null,
  status          public.rfq_quote_status  not null default 'submitted',
  created_at      timestamptz              not null default now(),
  updated_at      timestamptz              not null default now(),
  unique (rfq_id, supplier_id)
);

create index if not exists idx_rfq_quotes_rfq
  on public.rfq_quotes (rfq_id);
create index if not exists idx_rfq_quotes_supplier
  on public.rfq_quotes (supplier_id);

-- ----------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------

alter table public.rfqs       enable row level security;
alter table public.rfq_quotes enable row level security;

drop policy if exists pol_rfqs_select_buyer    on public.rfqs;
drop policy if exists pol_rfqs_select_supplier on public.rfqs;
create policy pol_rfqs_select_buyer
  on public.rfqs
  for select
  to authenticated
  using (buyer_id = auth.uid());
create policy pol_rfqs_select_supplier
  on public.rfqs
  for select
  to authenticated
  using (
    exists (
      select 1 from public.suppliers s
       where s.claimed_by = auth.uid()
         and s.id = any (rfqs.target_supplier_ids)
    )
  );

drop policy if exists pol_rfq_quotes_select_buyer    on public.rfq_quotes;
drop policy if exists pol_rfq_quotes_select_supplier on public.rfq_quotes;
create policy pol_rfq_quotes_select_buyer
  on public.rfq_quotes
  for select
  to authenticated
  using (
    exists (
      select 1 from public.rfqs r
       where r.id = rfq_quotes.rfq_id and r.buyer_id = auth.uid()
    )
  );
create policy pol_rfq_quotes_select_supplier
  on public.rfq_quotes
  for select
  to authenticated
  using (
    exists (
      select 1 from public.suppliers s
       where s.claimed_by = auth.uid() and s.id = rfq_quotes.supplier_id
    )
  );

-- No INSERT/UPDATE/DELETE policies — all writes go through the
-- security-definer RPCs below.
revoke all on public.rfqs       from anon, authenticated;
revoke all on public.rfq_quotes from anon, authenticated;
grant  select on public.rfqs       to authenticated;
grant  select on public.rfq_quotes to authenticated;

-- ----------------------------------------------------------------------
-- rfq_create(p_input jsonb) → uuid
-- ----------------------------------------------------------------------

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
    quantity, quantity_unit, target_unit_price, currency, ship_to_country, ship_by
  )
  values (
    v_uid, v_target_ids, v_product_title, v_product_desc,
    v_quantity, v_quantity_unit, v_target_unit_price, v_currency, v_ship_to_country, v_ship_by
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

-- ----------------------------------------------------------------------
-- rfq_list(p_status text) → jsonb
--   Returns RFQs the caller can see (as buyer and/or as the supplier
--   user behind one of the targeted suppliers), newest first, each with
--   a `quote_count` and a `viewer_role` discriminator. No PII or SBI.
-- ----------------------------------------------------------------------

create or replace function public.rfq_list(p_status text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_status public.rfq_status;
  v_out    jsonb;
begin
  if v_uid is null then
    return '[]'::jsonb;
  end if;

  if p_status is not null and length(trim(p_status)) > 0 then
    begin
      v_status := p_status::public.rfq_status;
    exception when others then
      raise exception 'invalid status filter';
    end;
  end if;

  with my_suppliers as (
    select s.id from public.suppliers s where s.claimed_by = v_uid
  ),
  visible as (
    select r.*,
           (r.buyer_id = v_uid) as is_buyer,
           exists (
             select 1 from my_suppliers ms
              where ms.id = any (r.target_supplier_ids)
           ) as is_supplier
      from public.rfqs r
     where (r.buyer_id = v_uid)
        or exists (
             select 1 from my_suppliers ms
              where ms.id = any (r.target_supplier_ids)
           )
  ),
  filtered as (
    select * from visible
     where v_status is null or status = v_status
  ),
  enriched as (
    select
      v.id, v.buyer_id, v.product_title, v.product_description,
      v.quantity, v.quantity_unit, v.target_unit_price, v.currency,
      v.ship_to_country, v.ship_by, v.status::text as status,
      v.accepted_quote_id, v.created_at, v.updated_at,
      v.is_buyer, v.is_supplier,
      coalesce(array_length(v.target_supplier_ids, 1), 0) as target_supplier_count,
      (select count(*) from public.rfq_quotes q where q.rfq_id = v.id) as quote_count
    from filtered v
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id',                    id,
        'product_title',         product_title,
        'product_description',   product_description,
        'quantity',              quantity,
        'quantity_unit',         quantity_unit,
        'target_unit_price',     target_unit_price,
        'currency',              currency,
        'ship_to_country',       ship_to_country,
        'ship_by',               ship_by,
        'status',                status,
        'accepted_quote_id',     accepted_quote_id,
        'target_supplier_count', target_supplier_count,
        'quote_count',           quote_count,
        'viewer_role',           case
                                   when is_buyer and is_supplier then 'both'
                                   when is_buyer                 then 'buyer'
                                   else                              'supplier'
                                 end,
        'created_at',            created_at,
        'updated_at',            updated_at
      )
      order by created_at desc
    ),
    '[]'::jsonb
  )
  into v_out
  from enriched;

  return v_out;
end;
$$;

revoke all  on function public.rfq_list(text) from public;
grant execute on function public.rfq_list(text) to authenticated;

-- ----------------------------------------------------------------------
-- rfq_get(p_id uuid) → jsonb
--   Returns one RFQ document with the buyer-safe target-supplier
--   summaries and the visible quotes (buyer sees all; supplier sees
--   only their own). NULL when caller has no visibility.
-- ----------------------------------------------------------------------

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

-- ----------------------------------------------------------------------
-- rfq_quote_submit(p_rfq_id, p_input jsonb) → uuid
--   Supplier-side. Resolves the caller's claimed supplier and upserts a
--   single quote for the RFQ. Rejects when the RFQ is not open or the
--   caller has no claimed supplier in the target set.
-- ----------------------------------------------------------------------

create or replace function public.rfq_quote_submit(
  p_rfq_id uuid,
  p_input  jsonb
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid           uuid := auth.uid();
  v_role          text;
  v_rfq           record;
  v_supplier_id   uuid;
  v_unit_price    numeric;
  v_currency      text;
  v_lead_time     int;
  v_moq           numeric;
  v_valid_until   date;
  v_notes         text;
  v_quote_id      uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_rfq_id is null then
    raise exception 'rfq_id is required';
  end if;
  if p_input is null or jsonb_typeof(p_input) <> 'object' then
    raise exception 'p_input must be a json object';
  end if;

  select role::text into v_role
    from public.profiles
   where id = v_uid;
  if v_role is null or v_role not in ('supplier', 'admin') then
    raise exception 'caller is not a supplier' using errcode = '42501';
  end if;

  select r.* into v_rfq from public.rfqs r where r.id = p_rfq_id;
  if not found then
    raise exception 'rfq not found';
  end if;
  if v_rfq.status <> 'open' then
    raise exception 'rfq is not open for quotes';
  end if;

  -- Resolve a claimed supplier the caller controls that is also in the
  -- RFQ's target set. If a caller has claimed multiple targeted suppliers
  -- the first match wins; submit one quote per supplier in separate
  -- calls.
  select s.id into v_supplier_id
    from public.suppliers s
   where s.claimed_by = v_uid
     and s.id = any (v_rfq.target_supplier_ids)
   limit 1;
  if v_supplier_id is null then
    raise exception 'caller has no claimed supplier targeted by this rfq'
      using errcode = '42501';
  end if;

  -- Inputs
  begin
    v_unit_price := (p_input->>'unit_price')::numeric;
  exception when others then
    raise exception 'unit_price must be numeric';
  end;
  if v_unit_price is null or v_unit_price <= 0 then
    raise exception 'unit_price must be > 0';
  end if;

  v_currency := upper(coalesce(nullif(trim(coalesce(p_input->>'currency', '')), ''), v_rfq.currency));
  if v_currency !~ '^[A-Z]{3}$' then
    raise exception 'currency must be a 3-letter code';
  end if;

  if (p_input ? 'lead_time_days') and (p_input->>'lead_time_days') is not null
     and length(trim(p_input->>'lead_time_days')) > 0 then
    begin
      v_lead_time := (p_input->>'lead_time_days')::int;
    exception when others then
      raise exception 'lead_time_days must be an integer';
    end;
    if v_lead_time is not null and v_lead_time < 0 then
      raise exception 'lead_time_days must be >= 0';
    end if;
  end if;

  if (p_input ? 'moq') and (p_input->>'moq') is not null
     and length(trim(p_input->>'moq')) > 0 then
    begin
      v_moq := (p_input->>'moq')::numeric;
    exception when others then
      raise exception 'moq must be numeric';
    end;
    if v_moq is not null and v_moq < 0 then
      raise exception 'moq must be >= 0';
    end if;
  end if;

  if (p_input ? 'valid_until') and (p_input->>'valid_until') is not null
     and length(trim(p_input->>'valid_until')) > 0 then
    begin
      v_valid_until := (p_input->>'valid_until')::date;
    exception when others then
      raise exception 'valid_until must be a date';
    end;
  end if;

  v_notes := nullif(trim(coalesce(p_input->>'notes', '')), '');
  if v_notes is not null and length(v_notes) > 4000 then
    raise exception 'notes exceeds 4000 characters';
  end if;

  insert into public.rfq_quotes (
    rfq_id, supplier_id, submitted_by, unit_price, currency,
    lead_time_days, moq, valid_until, notes
  )
  values (
    p_rfq_id, v_supplier_id, v_uid, v_unit_price, v_currency,
    v_lead_time, v_moq, v_valid_until, v_notes
  )
  on conflict (rfq_id, supplier_id) do update
    set unit_price     = excluded.unit_price,
        currency       = excluded.currency,
        lead_time_days = excluded.lead_time_days,
        moq            = excluded.moq,
        valid_until    = excluded.valid_until,
        notes          = excluded.notes,
        status         = 'submitted',
        submitted_by   = excluded.submitted_by,
        updated_at     = now()
  returning id into v_quote_id;

  return v_quote_id;
end;
$$;

revoke all  on function public.rfq_quote_submit(uuid, jsonb) from public;
grant execute on function public.rfq_quote_submit(uuid, jsonb) to authenticated;

-- ----------------------------------------------------------------------
-- rfq_quote_accept(p_quote_id uuid) → void
--   Buyer-side. Marks the chosen quote `accepted`, sibling quotes
--   `rejected`, the parent RFQ `accepted` + closed for further quotes.
-- ----------------------------------------------------------------------

create or replace function public.rfq_quote_accept(p_quote_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_quote  record;
  v_rfq    record;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_quote_id is null then
    raise exception 'quote_id is required';
  end if;

  select q.* into v_quote from public.rfq_quotes q where q.id = p_quote_id;
  if not found then
    raise exception 'quote not found';
  end if;

  select r.* into v_rfq from public.rfqs r where r.id = v_quote.rfq_id;
  if not found then
    raise exception 'rfq not found';
  end if;
  if v_rfq.buyer_id <> v_uid then
    raise exception 'caller does not own this rfq' using errcode = '42501';
  end if;
  if v_rfq.status <> 'open' then
    raise exception 'rfq is not open';
  end if;

  update public.rfq_quotes
     set status     = 'accepted',
         updated_at = now()
   where id = p_quote_id;

  update public.rfq_quotes
     set status     = 'rejected',
         updated_at = now()
   where rfq_id = v_rfq.id
     and id     <> p_quote_id
     and status =  'submitted';

  update public.rfqs
     set status            = 'accepted',
         accepted_quote_id = p_quote_id,
         updated_at        = now()
   where id = v_rfq.id;
end;
$$;

revoke all  on function public.rfq_quote_accept(uuid) from public;
grant execute on function public.rfq_quote_accept(uuid) to authenticated;
