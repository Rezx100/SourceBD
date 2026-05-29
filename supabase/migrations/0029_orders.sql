-- 0029 — Orders (Spec B8, Phase 2).
--
-- Manual-entry order tracking. A buyer creates an order (optionally
-- seeded from an accepted RFQ quote), the buyer + the claimed supplier
-- both see it via RLS, and both can append milestones. The buyer is the
-- sole owner of the order metadata (status, dates, carrier, tracking,
-- incoterm, notes) and the sole party that can cancel.
--
-- v1 is strictly manual — no Maersk / MSC API integration yet (deferred
-- to v2 per `context/phases.md` line 66). The schema is forward-compatible:
-- `carrier_name` + `tracking_number` are free-text so a future integration
-- can read them, and `actual_ship_date` / `actual_delivery_date` can be
-- bulk-updated from a freight feed without further DDL.
--
-- Hard invariants:
--   * Buyer A cannot see buyer B's orders or milestones.
--   * Supplier S only sees orders whose supplier_id is one S has claimed
--     (`suppliers.claimed_by = auth.uid()`).
--   * No SBI or contact-PII columns are returned by any of these RPCs.
--
-- Reversible:
--   drop function public.order_cancel(uuid);
--   drop function public.order_milestone_add(uuid, jsonb);
--   drop function public.order_update(uuid, jsonb);
--   drop function public.order_get(uuid);
--   drop function public.order_list(text);
--   drop function public.order_create(jsonb);
--   drop table public.order_milestones;
--   drop table public.orders;
--   drop type public.order_milestone_kind;
--   drop type public.order_status;

-- ----------------------------------------------------------------------
-- Enums
-- ----------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'order_status') then
    create type public.order_status as enum
      ('draft', 'in_production', 'shipped', 'in_transit', 'delivered', 'cancelled');
  end if;
end$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'order_milestone_kind') then
    create type public.order_milestone_kind as enum
      ('po_issued', 'materials_sourced', 'production_started',
       'qc_passed', 'shipped', 'customs_cleared', 'delivered', 'custom');
  end if;
end$$;

-- ----------------------------------------------------------------------
-- Tables
-- ----------------------------------------------------------------------

create table if not exists public.orders (
  id                     uuid               primary key default gen_random_uuid(),
  buyer_id               uuid               not null references auth.users(id)  on delete cascade,
  supplier_id            uuid               not null references public.suppliers(id) on delete cascade,
  rfq_id                 uuid               null,
  accepted_quote_id      uuid               null,
  po_number              text               null,
  product_title          text               not null check (length(trim(product_title)) > 0),
  quantity               numeric            not null check (quantity > 0),
  quantity_unit          text               not null check (length(trim(quantity_unit)) > 0),
  unit_price             numeric            null check (unit_price is null or unit_price > 0),
  currency               text               not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  total_value            numeric            generated always as (
                           case when unit_price is not null then quantity * unit_price end
                         ) stored,
  incoterm               text               null check (
                           incoterm is null or incoterm in ('FOB','CIF','EXW','DDP','DAP')
                         ),
  origin_port            text               null,
  destination_port       text               null,
  ship_to_country        text               null,
  target_ship_date       date               null,
  target_delivery_date   date               null,
  actual_ship_date       date               null,
  actual_delivery_date   date               null,
  carrier_name           text               null,
  tracking_number        text               null,
  status                 public.order_status not null default 'draft',
  notes                  text               null,
  created_at             timestamptz        not null default now(),
  updated_at             timestamptz        not null default now()
);

create index if not exists idx_orders_buyer_created
  on public.orders (buyer_id, created_at desc);
create index if not exists idx_orders_supplier_created
  on public.orders (supplier_id, created_at desc);
create index if not exists idx_orders_status
  on public.orders (status);
create index if not exists idx_orders_rfq
  on public.orders (rfq_id) where rfq_id is not null;

create table if not exists public.order_milestones (
  id          uuid                         primary key default gen_random_uuid(),
  order_id    uuid                         not null references public.orders(id) on delete cascade,
  kind        public.order_milestone_kind  not null,
  label       text                         null,
  occurred_on date                         not null,
  notes       text                         null,
  created_by  uuid                         null references auth.users(id) on delete set null,
  created_at  timestamptz                  not null default now()
);

create index if not exists idx_order_milestones_order
  on public.order_milestones (order_id, occurred_on desc);

-- ----------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------

alter table public.orders            enable row level security;
alter table public.order_milestones  enable row level security;

drop policy if exists pol_orders_select_buyer    on public.orders;
drop policy if exists pol_orders_select_supplier on public.orders;
create policy pol_orders_select_buyer
  on public.orders
  for select
  to authenticated
  using (buyer_id = auth.uid());
create policy pol_orders_select_supplier
  on public.orders
  for select
  to authenticated
  using (
    exists (
      select 1 from public.suppliers s
       where s.claimed_by = auth.uid()
         and s.id = orders.supplier_id
    )
  );

drop policy if exists pol_order_milestones_select_buyer    on public.order_milestones;
drop policy if exists pol_order_milestones_select_supplier on public.order_milestones;
create policy pol_order_milestones_select_buyer
  on public.order_milestones
  for select
  to authenticated
  using (
    exists (
      select 1 from public.orders o
       where o.id = order_milestones.order_id
         and o.buyer_id = auth.uid()
    )
  );
create policy pol_order_milestones_select_supplier
  on public.order_milestones
  for select
  to authenticated
  using (
    exists (
      select 1 from public.orders o
       join public.suppliers s on s.id = o.supplier_id
       where o.id = order_milestones.order_id
         and s.claimed_by = auth.uid()
    )
  );

-- No INSERT/UPDATE/DELETE policies — all writes go through the
-- security-definer RPCs below.
revoke all on public.orders           from anon, authenticated;
revoke all on public.order_milestones from anon, authenticated;
grant  select on public.orders           to authenticated;
grant  select on public.order_milestones to authenticated;

-- ----------------------------------------------------------------------
-- order_create(p_input jsonb) → uuid
-- ----------------------------------------------------------------------

create or replace function public.order_create(p_input jsonb)
returns uuid
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid                 uuid := auth.uid();
  v_role                text;
  v_supplier_id         uuid;
  v_rfq_id              uuid;
  v_quote_id            uuid;
  v_quote               record;
  v_rfq                 record;
  v_supplier            record;
  v_product_title       text;
  v_po_number           text;
  v_quantity            numeric;
  v_quantity_unit       text;
  v_unit_price          numeric;
  v_currency            text;
  v_incoterm            text;
  v_origin_port         text;
  v_destination_port    text;
  v_ship_to_country     text;
  v_target_ship_date    date;
  v_target_delivery     date;
  v_notes               text;
  v_order_id            uuid;
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

  -- Optional seed from an accepted RFQ quote.
  if (p_input ? 'accepted_quote_id') and (p_input->>'accepted_quote_id') is not null
     and length(trim(p_input->>'accepted_quote_id')) > 0 then
    v_quote_id := (p_input->>'accepted_quote_id')::uuid;
    select q.* into v_quote from public.rfq_quotes q where q.id = v_quote_id;
    if not found then
      raise exception 'accepted_quote_id not found';
    end if;
    if v_quote.status <> 'accepted' then
      raise exception 'quote is not accepted';
    end if;
    select r.* into v_rfq from public.rfqs r where r.id = v_quote.rfq_id;
    if not found or v_rfq.buyer_id <> v_uid then
      raise exception 'caller does not own the source RFQ' using errcode = '42501';
    end if;
    v_supplier_id    := v_quote.supplier_id;
    v_rfq_id         := v_quote.rfq_id;
    v_product_title  := nullif(trim(coalesce(p_input->>'product_title', '')), '');
    if v_product_title is null then v_product_title := v_rfq.product_title; end if;
    v_quantity       := coalesce(nullif(p_input->>'quantity', '')::numeric, v_rfq.quantity);
    v_quantity_unit  := coalesce(nullif(trim(coalesce(p_input->>'quantity_unit', '')), ''), v_rfq.quantity_unit);
    v_unit_price     := coalesce(nullif(p_input->>'unit_price', '')::numeric, v_quote.unit_price);
    v_currency       := upper(coalesce(nullif(trim(coalesce(p_input->>'currency', '')), ''), v_quote.currency));
    v_ship_to_country:= coalesce(nullif(trim(coalesce(p_input->>'ship_to_country', '')), ''), v_rfq.ship_to_country);
    v_target_ship_date := coalesce(
      nullif(trim(coalesce(p_input->>'target_ship_date', '')), '')::date,
      v_rfq.ship_by
    );
  else
    -- Manual entry path — supplier_id is required.
    if not (p_input ? 'supplier_id') or (p_input->>'supplier_id') is null then
      raise exception 'supplier_id is required';
    end if;
    v_supplier_id    := (p_input->>'supplier_id')::uuid;
    v_product_title  := nullif(trim(coalesce(p_input->>'product_title', '')), '');
    if v_product_title is null then
      raise exception 'product_title is required';
    end if;
    if length(v_product_title) > 200 then
      raise exception 'product_title exceeds 200 characters';
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
    if (p_input ? 'unit_price') and (p_input->>'unit_price') is not null
       and length(trim(p_input->>'unit_price')) > 0 then
      begin
        v_unit_price := (p_input->>'unit_price')::numeric;
      exception when others then
        raise exception 'unit_price must be numeric';
      end;
      if v_unit_price is not null and v_unit_price <= 0 then
        raise exception 'unit_price must be > 0';
      end if;
    end if;
    v_currency := upper(coalesce(nullif(trim(coalesce(p_input->>'currency', '')), ''), 'USD'));
    v_ship_to_country := nullif(trim(coalesce(p_input->>'ship_to_country', '')), '');
    if (p_input ? 'target_ship_date') and length(trim(coalesce(p_input->>'target_ship_date', ''))) > 0 then
      begin
        v_target_ship_date := (p_input->>'target_ship_date')::date;
      exception when others then
        raise exception 'target_ship_date must be a date';
      end;
    end if;
  end if;

  if v_currency !~ '^[A-Z]{3}$' then
    raise exception 'currency must be a 3-letter code';
  end if;

  -- Optional fields valid for both paths.
  v_po_number := nullif(trim(coalesce(p_input->>'po_number', '')), '');
  if v_po_number is not null and length(v_po_number) > 64 then
    raise exception 'po_number exceeds 64 characters';
  end if;
  v_origin_port      := nullif(trim(coalesce(p_input->>'origin_port', '')), '');
  v_destination_port := nullif(trim(coalesce(p_input->>'destination_port', '')), '');
  if v_ship_to_country is not null and length(v_ship_to_country) > 64 then
    raise exception 'ship_to_country exceeds 64 characters';
  end if;
  if (p_input ? 'target_delivery_date') and length(trim(coalesce(p_input->>'target_delivery_date', ''))) > 0 then
    begin
      v_target_delivery := (p_input->>'target_delivery_date')::date;
    exception when others then
      raise exception 'target_delivery_date must be a date';
    end;
  end if;
  if (p_input ? 'incoterm') and length(trim(coalesce(p_input->>'incoterm', ''))) > 0 then
    v_incoterm := upper(trim(p_input->>'incoterm'));
    if v_incoterm not in ('FOB','CIF','EXW','DDP','DAP') then
      raise exception 'incoterm must be one of FOB / CIF / EXW / DDP / DAP';
    end if;
  end if;
  v_notes := nullif(trim(coalesce(p_input->>'notes', '')), '');
  if v_notes is not null and length(v_notes) > 4000 then
    raise exception 'notes exceeds 4000 characters';
  end if;

  -- Supplier must be published, non-sanctioned.
  select s.* into v_supplier from public.suppliers s where s.id = v_supplier_id;
  if not found then
    raise exception 'supplier not found';
  end if;
  if not (v_supplier.is_published and not v_supplier.is_sanctioned) then
    raise exception 'supplier is not available for ordering';
  end if;

  insert into public.orders (
    buyer_id, supplier_id, rfq_id, accepted_quote_id, po_number,
    product_title, quantity, quantity_unit, unit_price, currency,
    incoterm, origin_port, destination_port, ship_to_country,
    target_ship_date, target_delivery_date, notes, status
  )
  values (
    v_uid, v_supplier_id, v_rfq_id, v_quote_id, v_po_number,
    v_product_title, v_quantity, v_quantity_unit, v_unit_price, v_currency,
    v_incoterm, v_origin_port, v_destination_port, v_ship_to_country,
    v_target_ship_date, v_target_delivery, v_notes, 'draft'
  )
  returning id into v_order_id;

  -- Seed the first milestone: a PO-issued event so the timeline is non-empty.
  insert into public.order_milestones (order_id, kind, label, occurred_on, notes, created_by)
  values (v_order_id, 'po_issued', 'Order created', current_date,
          case when v_po_number is not null then 'PO ' || v_po_number end, v_uid);

  return v_order_id;
end;
$$;

revoke all  on function public.order_create(jsonb) from public;
grant execute on function public.order_create(jsonb) to authenticated;

-- ----------------------------------------------------------------------
-- order_list(p_status text) → jsonb
-- ----------------------------------------------------------------------

create or replace function public.order_list(p_status text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_status public.order_status;
  v_out    jsonb;
begin
  if v_uid is null then
    return '[]'::jsonb;
  end if;
  if p_status is not null and length(trim(p_status)) > 0 then
    begin
      v_status := p_status::public.order_status;
    exception when others then
      raise exception 'invalid status filter';
    end;
  end if;

  with my_suppliers as (
    select s.id from public.suppliers s where s.claimed_by = v_uid
  ),
  visible as (
    select o.*,
           (o.buyer_id = v_uid) as is_buyer,
           exists (select 1 from my_suppliers ms where ms.id = o.supplier_id) as is_supplier
      from public.orders o
     where o.buyer_id = v_uid
        or exists (select 1 from my_suppliers ms where ms.id = o.supplier_id)
  ),
  filtered as (
    select * from visible where v_status is null or status = v_status
  ),
  enriched as (
    select
      v.id, v.supplier_id, v.rfq_id, v.po_number, v.product_title,
      v.quantity, v.quantity_unit, v.unit_price, v.currency, v.total_value,
      v.incoterm, v.ship_to_country, v.target_ship_date, v.target_delivery_date,
      v.actual_ship_date, v.actual_delivery_date, v.carrier_name, v.tracking_number,
      v.status::text as status, v.created_at, v.updated_at,
      v.is_buyer, v.is_supplier,
      s.slug as supplier_slug, s.company_name as supplier_name,
      (select count(*) from public.order_milestones m where m.order_id = v.id) as milestone_count,
      (select jsonb_build_object(
                'kind',        m.kind::text,
                'label',       m.label,
                'occurred_on', m.occurred_on)
         from public.order_milestones m
        where m.order_id = v.id
        order by m.occurred_on desc, m.created_at desc
        limit 1) as latest_milestone
    from filtered v
    join public.suppliers s on s.id = v.supplier_id
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id',                   id,
        'supplier_id',          supplier_id,
        'supplier_slug',        supplier_slug,
        'supplier_name',        supplier_name,
        'rfq_id',               rfq_id,
        'po_number',            po_number,
        'product_title',        product_title,
        'quantity',             quantity,
        'quantity_unit',        quantity_unit,
        'unit_price',           unit_price,
        'currency',             currency,
        'total_value',          total_value,
        'incoterm',             incoterm,
        'ship_to_country',      ship_to_country,
        'target_ship_date',     target_ship_date,
        'target_delivery_date', target_delivery_date,
        'actual_ship_date',     actual_ship_date,
        'actual_delivery_date', actual_delivery_date,
        'carrier_name',         carrier_name,
        'tracking_number',      tracking_number,
        'status',               status,
        'milestone_count',      milestone_count,
        'latest_milestone',     latest_milestone,
        'viewer_role',          case
                                  when is_buyer and is_supplier then 'both'
                                  when is_buyer                 then 'buyer'
                                  else                              'supplier'
                                end,
        'created_at',           created_at,
        'updated_at',           updated_at
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

revoke all  on function public.order_list(text) from public;
grant execute on function public.order_list(text) to authenticated;

-- ----------------------------------------------------------------------
-- order_get(p_id uuid) → jsonb
-- ----------------------------------------------------------------------

create or replace function public.order_get(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid          uuid := auth.uid();
  v_order        record;
  v_supplier     record;
  v_is_buyer     boolean := false;
  v_is_supplier  boolean := false;
  v_milestones   jsonb;
begin
  if v_uid is null or p_id is null then
    return null;
  end if;
  select o.* into v_order from public.orders o where o.id = p_id;
  if not found then
    return null;
  end if;
  v_is_buyer := (v_order.buyer_id = v_uid);
  if not v_is_buyer then
    select exists (
      select 1 from public.suppliers s
       where s.claimed_by = v_uid and s.id = v_order.supplier_id
    ) into v_is_supplier;
  end if;
  if not (v_is_buyer or v_is_supplier) then
    return null;
  end if;

  select s.* into v_supplier from public.suppliers s where s.id = v_order.supplier_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id',          m.id,
        'kind',        m.kind::text,
        'label',       m.label,
        'occurred_on', m.occurred_on,
        'notes',       m.notes,
        'created_by',  m.created_by,
        'created_at',  m.created_at
      )
      order by m.occurred_on desc, m.created_at desc
    ),
    '[]'::jsonb
  )
  into v_milestones
  from public.order_milestones m
  where m.order_id = p_id;

  return jsonb_build_object(
    'id',                   v_order.id,
    'rfq_id',               v_order.rfq_id,
    'accepted_quote_id',    v_order.accepted_quote_id,
    'po_number',            v_order.po_number,
    'product_title',        v_order.product_title,
    'quantity',             v_order.quantity,
    'quantity_unit',        v_order.quantity_unit,
    'unit_price',           v_order.unit_price,
    'currency',             v_order.currency,
    'total_value',          v_order.total_value,
    'incoterm',             v_order.incoterm,
    'origin_port',          v_order.origin_port,
    'destination_port',     v_order.destination_port,
    'ship_to_country',      v_order.ship_to_country,
    'target_ship_date',     v_order.target_ship_date,
    'target_delivery_date', v_order.target_delivery_date,
    'actual_ship_date',     v_order.actual_ship_date,
    'actual_delivery_date', v_order.actual_delivery_date,
    'carrier_name',         v_order.carrier_name,
    'tracking_number',      v_order.tracking_number,
    'status',               v_order.status::text,
    'notes',                v_order.notes,
    'created_at',           v_order.created_at,
    'updated_at',           v_order.updated_at,
    'supplier', jsonb_build_object(
      'id',           v_supplier.id,
      'slug',         v_supplier.slug,
      'company_name', v_supplier.company_name,
      'entity_type',  v_supplier.entity_type::text,
      'city',         v_supplier.city,
      'district',     v_supplier.district
    ),
    'viewer_role',          case
                              when v_is_buyer and v_is_supplier then 'both'
                              when v_is_buyer                   then 'buyer'
                              else                                  'supplier'
                            end,
    'milestones',           v_milestones
  );
end;
$$;

revoke all  on function public.order_get(uuid) from public;
grant execute on function public.order_get(uuid) to authenticated;

-- ----------------------------------------------------------------------
-- order_update(p_id uuid, p_patch jsonb) → void  (buyer only)
--   Patchable: status, dates, carrier, tracking, incoterm, notes,
--   po_number, ports, ship_to_country.
-- ----------------------------------------------------------------------

create or replace function public.order_update(p_id uuid, p_patch jsonb)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_order  record;
  v_status public.order_status;
  v_incoterm text;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_id is null then
    raise exception 'id is required';
  end if;
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then
    raise exception 'p_patch must be a json object';
  end if;

  select o.* into v_order from public.orders o where o.id = p_id;
  if not found then
    raise exception 'order not found';
  end if;
  if v_order.buyer_id <> v_uid then
    raise exception 'caller does not own this order' using errcode = '42501';
  end if;
  if v_order.status = 'cancelled' then
    raise exception 'cancelled orders cannot be updated';
  end if;

  if p_patch ? 'status' then
    v_status := (p_patch->>'status')::public.order_status;
    if v_status = 'cancelled' then
      raise exception 'use order_cancel to cancel an order';
    end if;
  end if;

  if p_patch ? 'incoterm' and length(trim(coalesce(p_patch->>'incoterm', ''))) > 0 then
    v_incoterm := upper(trim(p_patch->>'incoterm'));
    if v_incoterm not in ('FOB','CIF','EXW','DDP','DAP') then
      raise exception 'incoterm must be one of FOB / CIF / EXW / DDP / DAP';
    end if;
  end if;

  update public.orders
     set status               = coalesce(v_status, status),
         incoterm             = case when p_patch ? 'incoterm'
                                     then nullif(v_incoterm, '')
                                     else incoterm end,
         carrier_name         = case when p_patch ? 'carrier_name'
                                     then nullif(trim(coalesce(p_patch->>'carrier_name', '')), '')
                                     else carrier_name end,
         tracking_number      = case when p_patch ? 'tracking_number'
                                     then nullif(trim(coalesce(p_patch->>'tracking_number', '')), '')
                                     else tracking_number end,
         po_number            = case when p_patch ? 'po_number'
                                     then nullif(trim(coalesce(p_patch->>'po_number', '')), '')
                                     else po_number end,
         origin_port          = case when p_patch ? 'origin_port'
                                     then nullif(trim(coalesce(p_patch->>'origin_port', '')), '')
                                     else origin_port end,
         destination_port     = case when p_patch ? 'destination_port'
                                     then nullif(trim(coalesce(p_patch->>'destination_port', '')), '')
                                     else destination_port end,
         ship_to_country      = case when p_patch ? 'ship_to_country'
                                     then nullif(trim(coalesce(p_patch->>'ship_to_country', '')), '')
                                     else ship_to_country end,
         target_ship_date     = case when p_patch ? 'target_ship_date'
                                     then nullif(trim(coalesce(p_patch->>'target_ship_date', '')), '')::date
                                     else target_ship_date end,
         target_delivery_date = case when p_patch ? 'target_delivery_date'
                                     then nullif(trim(coalesce(p_patch->>'target_delivery_date', '')), '')::date
                                     else target_delivery_date end,
         actual_ship_date     = case when p_patch ? 'actual_ship_date'
                                     then nullif(trim(coalesce(p_patch->>'actual_ship_date', '')), '')::date
                                     else actual_ship_date end,
         actual_delivery_date = case when p_patch ? 'actual_delivery_date'
                                     then nullif(trim(coalesce(p_patch->>'actual_delivery_date', '')), '')::date
                                     else actual_delivery_date end,
         notes                = case when p_patch ? 'notes'
                                     then nullif(trim(coalesce(p_patch->>'notes', '')), '')
                                     else notes end,
         updated_at           = now()
   where id = p_id;
end;
$$;

revoke all  on function public.order_update(uuid, jsonb) from public;
grant execute on function public.order_update(uuid, jsonb) to authenticated;

-- ----------------------------------------------------------------------
-- order_milestone_add(p_order_id, p_input jsonb) → uuid
--   Buyer or the claimed supplier may append milestones. Refused on
--   cancelled orders.
-- ----------------------------------------------------------------------

create or replace function public.order_milestone_add(p_order_id uuid, p_input jsonb)
returns uuid
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid          uuid := auth.uid();
  v_order        record;
  v_is_buyer     boolean := false;
  v_is_supplier  boolean := false;
  v_kind         public.order_milestone_kind;
  v_label        text;
  v_occurred_on  date;
  v_notes        text;
  v_id           uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_order_id is null then
    raise exception 'order_id is required';
  end if;
  if p_input is null or jsonb_typeof(p_input) <> 'object' then
    raise exception 'p_input must be a json object';
  end if;

  select o.* into v_order from public.orders o where o.id = p_order_id;
  if not found then
    raise exception 'order not found';
  end if;
  if v_order.status = 'cancelled' then
    raise exception 'cannot add milestones to a cancelled order';
  end if;

  v_is_buyer := (v_order.buyer_id = v_uid);
  if not v_is_buyer then
    select exists (
      select 1 from public.suppliers s
       where s.claimed_by = v_uid and s.id = v_order.supplier_id
    ) into v_is_supplier;
  end if;
  if not (v_is_buyer or v_is_supplier) then
    raise exception 'caller cannot add milestones to this order' using errcode = '42501';
  end if;

  begin
    v_kind := (p_input->>'kind')::public.order_milestone_kind;
  exception when others then
    raise exception 'kind is required and must be a valid order_milestone_kind';
  end;

  v_label := nullif(trim(coalesce(p_input->>'label', '')), '');
  if v_label is not null and length(v_label) > 200 then
    raise exception 'label exceeds 200 characters';
  end if;

  if (p_input ? 'occurred_on') and length(trim(coalesce(p_input->>'occurred_on', ''))) > 0 then
    begin
      v_occurred_on := (p_input->>'occurred_on')::date;
    exception when others then
      raise exception 'occurred_on must be a date';
    end;
  else
    v_occurred_on := current_date;
  end if;

  v_notes := nullif(trim(coalesce(p_input->>'notes', '')), '');
  if v_notes is not null and length(v_notes) > 4000 then
    raise exception 'notes exceeds 4000 characters';
  end if;

  insert into public.order_milestones (order_id, kind, label, occurred_on, notes, created_by)
  values (p_order_id, v_kind, v_label, v_occurred_on, v_notes, v_uid)
  returning id into v_id;

  update public.orders set updated_at = now() where id = p_order_id;

  return v_id;
end;
$$;

revoke all  on function public.order_milestone_add(uuid, jsonb) from public;
grant execute on function public.order_milestone_add(uuid, jsonb) to authenticated;

-- ----------------------------------------------------------------------
-- order_cancel(p_id uuid) → void   (buyer only)
-- ----------------------------------------------------------------------

create or replace function public.order_cancel(p_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_order record;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_id is null then
    raise exception 'id is required';
  end if;
  select o.* into v_order from public.orders o where o.id = p_id;
  if not found then
    raise exception 'order not found';
  end if;
  if v_order.buyer_id <> v_uid then
    raise exception 'caller does not own this order' using errcode = '42501';
  end if;
  if v_order.status in ('delivered', 'cancelled') then
    raise exception 'order cannot be cancelled in its current status';
  end if;

  update public.orders
     set status = 'cancelled',
         updated_at = now()
   where id = p_id;
end;
$$;

revoke all  on function public.order_cancel(uuid) from public;
grant execute on function public.order_cancel(uuid) to authenticated;
