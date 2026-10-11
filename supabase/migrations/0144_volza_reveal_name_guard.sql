-- 0144 — A reveal saves only the searched exporter's shipments (11 Oct 2026).
--
-- The reveal searches Volza for one exporter name with the exact setting (0141), so every record should carry that
-- name. Customs records have no company id, so the name is the only proof a shipment is this supplier's. The
-- founder asked (11 Oct 2026) that the server never rely on Volza honouring the setting: volza_reveal_finish now
-- keeps only records whose supplier_name equals the name the check matched (0137's volza_supplier_name), ignoring
-- case and spacing, and writes how many it dropped to the activity record. A dropped record is never shown to
-- anyone; the cost of the call is logged as before.
--
-- Checked against the two live reveals of 11 Oct (Moon Readywears 25 of 25, NGS Fashion 12 of 12): every record
-- carries exactly the searched name, so nothing saved so far would have been dropped.
--
-- Otherwise unchanged from 0141 (the spend log is 0143's).
--
-- Rollback: re-run 0141's volza_reveal_finish.

create or replace function public.volza_reveal_finish(
  p_claim uuid, p_records jsonb, p_cost_usd numeric, p_credit_remaining_usd numeric)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  r         record;
  v_name    text;
  v_kept    jsonb;
  v_dropped integer;
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

  -- The exporter name the check matched, folded: "NGS FASHION LTD " and "ngs fashion ltd" are one name.
  select regexp_replace(lower(btrim(v.volza_supplier_name)), '\s+', ' ', 'g') into v_name
    from public.volza_export_checks v
   where v.supplier_id = r.supplier_id;

  select coalesce(jsonb_agg(t.e order by t.ord), '[]'::jsonb) into v_kept
    from jsonb_array_elements(p_records) with ordinality as t(e, ord)
   where v_name is not null
     and regexp_replace(lower(btrim(t.e ->> 'supplier_name')), '\s+', ' ', 'g') = v_name;
  v_dropped := jsonb_array_length(p_records) - jsonb_array_length(v_kept);

  update public.volza_shipment_reveals
     set records = v_kept, fetched_at = now(), expires_at = now() + interval '1 year',
         cost_usd = p_cost_usd, claim_id = null, claimed_at = null, claimed_by = null
   where supplier_id = r.supplier_id;

  if r.claimed_by is not null then
    insert into public.volza_reveal_uses (user_id, supplier_id, month)
    values (r.claimed_by, r.supplier_id, (date_trunc('month', now() at time zone 'utc'))::date)
    on conflict do nothing;
  end if;
  perform public._ledger_write('shipments.revealed', 'volza_shipment_reveals', r.supplier_id,
    jsonb_build_object('fetched', true, 'records', jsonb_array_length(v_kept), 'dropped_other_exporter', v_dropped,
                       'cost_usd', p_cost_usd),
    r.claimed_by, null, r.supplier_id);
  return true;
end;
$$;

comment on function public.volza_reveal_finish(uuid, jsonb, numeric, numeric) is
  'Saves a reveal fetch for the claim holder (service role only): only records filed under the exporter name the '
  'check matched (0144), with how many were dropped in the activity record. Logs the cost and Volza''s remaining '
  'credit, records the allowance. False when the claim had lapsed: the spend is still logged. 0141, 0144.';

revoke all on function public.volza_reveal_finish(uuid, jsonb, numeric, numeric) from public, anon, authenticated;
grant execute on function public.volza_reveal_finish(uuid, jsonb, numeric, numeric) to service_role;
