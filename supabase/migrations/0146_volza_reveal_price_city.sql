-- 0146: the shipment reveal returns the buyer's city and, when it passes a check, the price a piece.
--
-- 0141 kept unit prices back "until a checked price key exists" (handoff-volza-reveal.md). The founder asked
-- for price and quantity on each row on 12 Oct 2026, so this is that check. Measured the same day on the 957
-- shipment records held in production: 956 counted in pieces, price a piece 5th percentile US$1.11, median
-- US$4.31, 95th US$15.38, and a top of US$41,608.22; gross weight a piece 0.12 kg to 1.0 kg (5th to 95th).
-- A price is returned only when:
--   - the shipment is counted in pieces (a price a kilo is not a garment's price);
--   - it is between US$0.10 and US$60 a piece (socks are filed at US$0.21; one record says US$41,608.22);
--   - the value is positive, so value over price is a quantity;
--   - where a weight was declared, the weight a piece is between 0.01 kg and 3 kg (briefs weigh 0.024 kg).
-- Dry run on production, 12 Oct 2026: 954 of the 957 records keep a price, all 87 reveal records among them.
-- Anything else answers null and the row prints no price and no quantity. The raw unit_rate_usd never leaves
-- the database. Nothing else in the read changes: the same gate, the same cut to 15 or 25, newest first.

create or replace function public._volza_checked_price(e jsonb)
returns numeric
language sql
immutable
set search_path = public
as $$
  select case
           when e ->> 'unit' = 'PCS'
            and jsonb_typeof(e -> 'unit_rate_usd') = 'number'
            and jsonb_typeof(e -> 'trade_value_usd') = 'number'
            and (e ->> 'unit_rate_usd')::numeric between 0.10 and 60
            and (e ->> 'trade_value_usd')::numeric > 0
            and (jsonb_typeof(e -> 'gross_weight_kg') is distinct from 'number'
                 or (e ->> 'gross_weight_kg')::numeric <= 0
                 or (e ->> 'gross_weight_kg')::numeric * (e ->> 'unit_rate_usd')::numeric
                      / (e ->> 'trade_value_usd')::numeric between 0.01 and 3)
           then (e ->> 'unit_rate_usd')::numeric
         end;
$$;

comment on function public._volza_checked_price(jsonb) is
  'A shipment record''s price a piece, or null when it is not counted in pieces, is outside US$0.10 to US$60, '
  'or implies a piece lighter than 0.01 kg or heavier than 3 kg. 0146.';

revoke all on function public._volza_checked_price(jsonb) from public, anon, authenticated, service_role;

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
               'date',           left(x.e ->> 'shipment_date', 10),
               'product',        x.e ->> 'product_description',
               'hs_code',        x.e ->> 'hsn_code',
               'buyer',          x.e ->> 'buyer_name',
               'buyer_city',     x.e ->> 'buyer_city',
               'buyer_country',  x.e ->> 'buyer_country',
               'destination',    x.e ->> 'destination_country',
               'unit',           x.e ->> 'unit',
               'value_usd',      x.e -> 'trade_value_usd',
               'weight_kg',      x.e -> 'gross_weight_kg',
               'unit_price_usd', public._volza_checked_price(x.e))
             order by x.d desc nulls last, x.ord)
        from (select e, ord, e ->> 'shipment_date' as d
                from jsonb_array_elements(r.records) with ordinality as t(e, ord)
               order by d desc nulls last, ord
               limit v_n) x), '[]'::jsonb));
end;
$$;

comment on function public.supplier_shipment_reveal(text) is
  'Saved latest shipments for a supplier the caller revealed this month: 15 for Growth, 25 for Enterprise and '
  'admins, newest first, with the buyer''s city and a price a piece only where it passes _volza_checked_price. '
  'Null for anyone else, a non-exact or expired match, or nothing saved. Deletes expired saved copies. 0141, 0146.';

revoke all on function public.supplier_shipment_reveal(text) from public, anon;
grant execute on function public.supplier_shipment_reveal(text) to authenticated, service_role;
