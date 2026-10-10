-- 0128 asserted by running it: with twelve open rows, the first list works out and keeps exactly ten plans
-- and marks the other two pending; the second list fills the two and does not touch the ten it kept; every
-- plan is the right one (held_same for an ETL hold); a decided row's plan is not touched; a buyer and anon
-- are refused.
\set ON_ERROR_STOP on

begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-00000000a128', 'admin-0128@example.invalid', '{"role":"admin"}'::jsonb),
  ('00000000-0000-4000-8000-00000000b128', 'buyer-0128@example.invalid', '{"role":"buyer"}'::jsonb)
on conflict do nothing;

insert into public.suppliers (id, slug, company_name, company_name_norm, city, district, is_published, is_sanctioned)
  -- Not published: the publish trigger wants a Tier 1-3 source record, and the plan does not care.
  values ('00000000-0000-4000-8000-0000000a1128', 'ci-0128-knit', 'CI 0128 Knit Ltd', 'ci 0128 knit ltd', 'Dhaka', 'Dhaka', false, false);

-- Twelve open ETL holds, one a minute apart so the order is fixed, and one already decided.
insert into public.verification_queue (id, queue_type, supplier_a_id, supplier_b_name, confidence, source_data, created_at)
select ('00000000-0000-4000-8000-0000000b1' || lpad(i::text, 3, '0'))::uuid,
       'fuzzy_match_review', '00000000-0000-4000-8000-0000000a1128', 'CI 0128 Knit Limited', 0.9,
       jsonb_build_object('rule', 'etl_hold_v1', 'source_code', 'ci', 'source_ref', 'r' || i),
       now() - (i || ' minutes')::interval
  from generate_series(1, 12) i;
insert into public.verification_queue (id, queue_type, supplier_a_id, supplier_b_name, source_data, created_at, reviewed_at, reviewed_by, admin_action)
  values ('00000000-0000-4000-8000-0000000b1999', 'fuzzy_match_review', '00000000-0000-4000-8000-0000000a1128', 'done',
          jsonb_build_object('rule', 'etl_hold_v1'), now() - interval '2 days', now() - interval '1 day',
          '00000000-0000-4000-8000-00000000a128', 'approve');

do $$
declare
  doc      jsonb;
  n        int;
  kept_min timestamptz;
  hit      text;
begin
  if has_function_privilege('anon', 'public.admin_queue_list(text, text, int, int)', 'execute') then
    raise exception 'anon can execute admin_queue_list';
  end if;
  if (select provolatile from pg_proc where oid = 'public.admin_queue_list(text, text, int, int)'::regprocedure) <> 'v' then
    raise exception 'admin_queue_list is not volatile, so it cannot keep a plan';
  end if;
  -- Ten slow plans overran the 8 s timeout on production (10 Oct 2026); the time budget is the fix.
  if (select prosrc from pg_proc where oid = 'public.admin_queue_list(text, text, int, int)'::regprocedure) !~ 'exit when clock_timestamp\(\) - v_started > v_budget' then
    raise exception 'admin_queue_list lost its time budget for working out plans';
  end if;

  -- A buyer is refused.
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000b128', true);
  hit := null;
  begin
    perform public.admin_queue_list(null, 'open', 50, 0);
  exception when insufficient_privilege then
    hit := 'refused';
  end;
  if hit is null then raise exception 'a buyer read the review queue'; end if;

  -- The admin's first load: twelve rows, ten with a plan, two pending.
  perform set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000a128', true);
  doc := public.admin_queue_list('fuzzy_match_review', 'open', 50, 0);
  if (doc->>'total')::int <> 12 then raise exception 'total was %, expected 12', doc->>'total'; end if;
  select count(*) into n from jsonb_array_elements(doc->'rows') r where (r->>'plan_pending')::boolean;
  if n <> 2 then raise exception '% rows pending after the first load, expected 2', n; end if;
  select count(*) into n from jsonb_array_elements(doc->'rows') r where r->>'release_action' = 'held_same';
  if n <> 10 then raise exception '% rows classified after the first load, expected 10', n; end if;
  -- The newest ten were taken first: the two pending are the two oldest.
  select count(*) into n from jsonb_array_elements(doc->'rows') r
   where (r->>'plan_pending')::boolean
     and (r->>'queue_id')::uuid in ('00000000-0000-4000-8000-0000000b1011', '00000000-0000-4000-8000-0000000b1012');
  if n <> 2 then raise exception 'the pending rows were not the two oldest'; end if;

  reset role;
  select count(*) into n
    from public.verification_queue where release_plan_at is not null and reviewed_at is null;
  if n <> 10 then raise exception '% plans kept after the first load, expected 10', n; end if;
  if (select release_plan from public.verification_queue where id = '00000000-0000-4000-8000-0000000b1999') is not null then
    raise exception 'a decided row had its plan worked out';
  end if;

  -- Mark the ten kept plans so a re-work shows (now() is one value for the whole transaction), and age
  -- one of them past a day with a wrong plan: the second load must re-work only that one and the two pending.
  kept_min := now() - interval '1 hour';
  update public.verification_queue set release_plan_at = kept_min where release_plan_at is not null and reviewed_at is null;
  update public.verification_queue
     set release_plan = '{"action":"stale","buyer_destination":"old"}'::jsonb, release_plan_at = now() - interval '2 days'
   where id = '00000000-0000-4000-8000-0000000b1001';

  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000a128', true);
  doc := public.admin_queue_list('fuzzy_match_review', 'open', 50, 0);
  select count(*) into n from jsonb_array_elements(doc->'rows') r where (r->>'plan_pending')::boolean;
  if n <> 0 then raise exception '% rows still pending after the second load', n; end if;
  select count(*) into n from jsonb_array_elements(doc->'rows') r
   where r->>'release_action' = 'held_same' and r->>'buyer_destination' like 'Release if this is CI 0128 Knit Ltd%';
  if n <> 12 then raise exception '% rows carry the hold plan, expected 12 (the stale one re-worked)', n; end if;
  reset role;
  select count(*) into n from public.verification_queue where reviewed_at is null and release_plan_at = kept_min;
  if n <> 9 then raise exception 'the second load re-worked a fresh kept plan (% untouched, expected 9)', n; end if;
  select count(*) into n from public.verification_queue where reviewed_at is null and release_plan_at = now();
  if n <> 3 then raise exception 'the second load worked out % plans, expected 3 (two pending, one stale)', n; end if;

  -- The unfiltered open list reads the kept plans too, and the decided row keeps none.
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000a128', true);
  doc := public.admin_queue_list(null, 'all', 200, 0);
  if exists (select 1 from jsonb_array_elements(doc->'rows') r
              where (r->>'queue_id')::uuid = '00000000-0000-4000-8000-0000000b1999'
                and (r->>'release_action' is not null or (r->>'plan_pending')::boolean)) then
    raise exception 'a decided row was classified or marked pending';
  end if;
  reset role;
end
$$;

rollback;
