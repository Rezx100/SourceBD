-- 0136: "as found" record entries for the RFQs and quotes that existed before the record (0131) went live
-- (moderation plan 1f, the RFQ half).
--
-- 0131's triggers only see writes made after 6 Oct 2026, so the seven RFQs sent before then have no
-- timeline. This writes one 'rfq.sent' per RFQ and one 'quote.submitted' per quote that has no entry of
-- its own, with the row as it stands today under content.after and content.as_found = true. The entry's
-- time is when it was written (the record never back-dates); the row's own created_at says when it was sent.
--
-- Idempotent: a row that already has any entry (from a trigger or an earlier run) is skipped, so running
-- the function again writes nothing. Kept as a function so the CI replay can assert exactly that.

create or replace function public._ledger_as_found_rfqs()
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  r record;
  n integer := 0;
begin
  for r in
    select x.* from public.rfqs x
     where not exists (select 1 from public.activity_ledger l where l.target_table = 'rfqs' and l.target_id = x.id)
     order by x.created_at, x.id
  loop
    perform public._ledger_write(
      'rfq.sent', 'rfqs', r.id,
      jsonb_build_object('as_found', true, 'after', to_jsonb(r)),
      r.buyer_id, null, null, null, r.id, null, null, null);
    n := n + 1;
  end loop;

  for r in
    select q.*, x.buyer_id from public.rfq_quotes q
      join public.rfqs x on x.id = q.rfq_id
     where not exists (select 1 from public.activity_ledger l where l.target_table = 'rfq_quotes' and l.target_id = q.id)
     order by q.created_at, q.id
  loop
    perform public._ledger_write(
      'quote.submitted', 'rfq_quotes', r.id,
      jsonb_build_object('as_found', true, 'after', to_jsonb(r) - 'buyer_id'),
      r.submitted_by, r.buyer_id, r.supplier_id, null, r.rfq_id, null, null, null);
    n := n + 1;
  end loop;

  return n;
end;
$$;

revoke all on function public._ledger_as_found_rfqs() from public, anon, authenticated, service_role;

select public._ledger_as_found_rfqs();
