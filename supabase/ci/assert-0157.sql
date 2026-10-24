-- 0157 asserted by running it: a Growth buyer sees a sister's exports on a member with none, labelled with the
-- group; a member with its own row, a "Not in a Group" placeholder and a Starter buyer get nothing; anon cannot call it.
\set ON_ERROR_STOP on

begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-00000000b157', 'growth-0157@example.invalid',  '{"role":"buyer"}'::jsonb),
  ('00000000-0000-4000-8000-00000000d157', 'starter-0157@example.invalid', '{"role":"buyer"}'::jsonb)
on conflict do nothing;
update public.profiles set plan_tier = 'growth' where id = '00000000-0000-4000-8000-00000000b157';

insert into public.suppliers (id, slug, company_name, company_name_norm, city, district, is_published, is_sanctioned, parent_group_name) values
  ('00000000-0000-4000-8000-0000000a1157', 'ci-0157-member', 'CI 0157 Member Ltd', 'ci 0157 member ltd', 'Dhaka', 'Dhaka', false, false, 'CI Group'),
  ('00000000-0000-4000-8000-0000000a2157', 'ci-0157-sister', 'CI 0157 Sister Ltd', 'ci 0157 sister ltd', 'Dhaka', 'Dhaka', false, false, 'CI Group'),
  ('00000000-0000-4000-8000-0000000a3157', 'ci-0157-own',    'CI 0157 Own Ltd',    'ci 0157 own ltd',    'Dhaka', 'Dhaka', false, false, 'CI Group'),
  ('00000000-0000-4000-8000-0000000a4157', 'ci-0157-alone',  'CI 0157 Alone Ltd',  'ci 0157 alone ltd',  'Dhaka', 'Dhaka', false, false, 'Not in a Group'),
  ('00000000-0000-4000-8000-0000000a5157', 'ci-0157-other',  'CI 0157 Other Ltd',  'ci 0157 other ltd',  'Dhaka', 'Dhaka', false, false, 'Not in a Group');

insert into public.source_records (supplier_id, source_id, source_tier, source_ref)
select sp.id, s.id, s.tier, 'CI-0157-' || sp.slug from public.suppliers sp, public.sources s
 where sp.slug like 'ci-0157-%' and s.code = 'RSC';
update public.suppliers set is_published = true where slug like 'ci-0157-%';

insert into public.volza_export_checks
  (supplier_id, name_searched, window_start, window_end, shipments, exporters_matched, match_class,
   volza_supplier_name, fetched_at, expires_at) values
  ('00000000-0000-4000-8000-0000000a1157', 'CI 0157 Member', '2024-09-01', '2026-08-31', 0,   0, 'none',  null,                 now(), now() + interval '300 days'),
  ('00000000-0000-4000-8000-0000000a2157', 'CI 0157 Sister', '2024-09-01', '2026-08-31', 990, 1, 'exact', 'CI 0157 Sister Ltd', now(), now() + interval '300 days'),
  ('00000000-0000-4000-8000-0000000a3157', 'CI 0157 Own',    '2024-09-01', '2026-08-31', 50,  1, 'exact', 'CI 0157 Own Ltd',    now(), now() + interval '300 days'),
  ('00000000-0000-4000-8000-0000000a5157', 'CI 0157 Other',  '2024-09-01', '2026-08-31', 70,  1, 'exact', 'CI 0157 Other Ltd',  now(), now() + interval '300 days');

do $$
declare
  growth  constant uuid := '00000000-0000-4000-8000-00000000b157';
  starter constant uuid := '00000000-0000-4000-8000-00000000d157';
  j jsonb;
begin
  if has_function_privilege('anon', 'public.supplier_group_exports(text)', 'execute') then
    raise exception 'anon can read group exports';
  end if;

  set local role authenticated;
  perform set_config('request.jwt.claim.sub', starter::text, true);
  if public.supplier_group_exports('ci-0157-member') is not null then
    raise exception 'a Starter buyer sees group exports';
  end if;

  perform set_config('request.jwt.claim.sub', growth::text, true);
  j := public.supplier_group_exports('ci-0157-member');
  if j->>'group' <> 'CI Group' or jsonb_array_length(j->'members') <> 2
     or j->'members'->0->>'slug' <> 'ci-0157-sister' or (j->'members'->0->>'shipments')::int <> 990 then
    raise exception 'the member should see its two sisters, biggest first: %', j;
  end if;
  if public.supplier_group_exports('ci-0157-own') is not null then
    raise exception 'a member with its own customs row was shown the group''s';
  end if;
  if public.supplier_group_exports('ci-0157-alone') is not null then
    raise exception '"Not in a Group" was treated as a group';
  end if;
end
$$;

rollback;
