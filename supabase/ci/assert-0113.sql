-- Behaviour of saved-search alerts and the last search after 0113, asserted
-- by running it: a search with the switch on is due; its first check is a
-- baseline (nothing new); the next finds only the new ids; a recorded check
-- is not due again for 6 days; a suspended owner and a switched-off search are
-- never due; the job's calls are service_role's only; the last search reads
-- back and says when it is already saved.
\set ON_ERROR_STOP on

begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-00000000a113', 'a-0113@example.invalid', '{"role":"buyer"}'::jsonb),
  ('00000000-0000-4000-8000-00000000b113', 'b-0113@example.invalid', '{"role":"buyer"}'::jsonb)
on conflict do nothing;

insert into public.saved_searches (id, owner_id, name, query_state, alert_weekly) values
  ('00000000-0000-4000-8000-0000000a1131', '00000000-0000-4000-8000-00000000a113', 'Knit', '{"q":"knit"}', true),
  ('00000000-0000-4000-8000-0000000a1132', '00000000-0000-4000-8000-00000000a113', 'Woven', '{"q":"woven"}', false),
  ('00000000-0000-4000-8000-0000000b1131', '00000000-0000-4000-8000-00000000b113', 'Denim', '{"q":"denim"}', true);
update public.profiles set is_suspended = true where id = '00000000-0000-4000-8000-00000000b113';

do $$
declare
  s1   constant uuid := '00000000-0000-4000-8000-0000000a1131';
  x1   constant uuid := '00000000-0000-4000-8000-000000000001';
  x2   constant uuid := '00000000-0000-4000-8000-000000000002';
  x3   constant uuid := '00000000-0000-4000-8000-000000000003';
  due  uuid[];
  got  uuid[];
  last jsonb;
  fn   text;
begin
  foreach fn in array array['public.saved_search_alerts_due(int)', 'public.saved_search_alert_new(uuid, uuid[])',
                            'public.saved_search_alert_record(uuid, uuid[], boolean)'] loop
    if has_function_privilege('anon', fn, 'execute') or has_function_privilege('authenticated', fn, 'execute')
       or not has_function_privilege('service_role', fn, 'execute') then
      raise exception '% is not service_role only', fn;
    end if;
  end loop;
  if has_function_privilege('anon', 'public.buyer_last_search_set(jsonb)', 'execute')
     or has_function_privilege('anon', 'public.buyer_last_search()', 'execute') then
    raise exception 'anon can execute a last-search call';
  end if;

  select array_agg(search_id) into due from public.saved_search_alerts_due(100)
   where search_id::text like '00000000-0000-4000-8000-0000000%113%';
  if due is distinct from array[s1] then
    raise exception 'due was %', due;
  end if;

  if public.saved_search_alert_new(s1, array[x1, x2]) is not null then
    raise exception 'the first check was not a baseline';
  end if;
  perform public.saved_search_alert_record(s1, array[x1, x2], false);
  if exists (select 1 from public.saved_search_alerts_due(100) where search_id = s1) then
    raise exception 'due again right after a check';
  end if;

  got := public.saved_search_alert_new(s1, array[x1, x2, x3]);
  if got is distinct from array[x3] then
    raise exception 'new matches were %', got;
  end if;
  perform public.saved_search_alert_record(s1, array[x2, x3], true);
  if (select sent_at from public.saved_search_alerts where search_id = s1) is null
     or (select seen_ids from public.saved_search_alerts where search_id = s1) <> array[x2, x3] then
    raise exception 'record did not store the check';
  end if;
  update public.saved_search_alerts set checked_at = now() - interval '7 days' where search_id = s1;
  if not exists (select 1 from public.saved_search_alerts_due(100) where search_id = s1) then
    raise exception 'not due after a week';
  end if;

  -- The buyer cannot touch the job's table.
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000a113', true);
  begin
    update public.saved_search_alerts set seen_ids = '{}';
    raise exception 'authenticated wrote saved_search_alerts';
  exception when insufficient_privilege then null;
  end;

  -- The last search.
  if public.buyer_last_search() is not null then
    raise exception 'a last search before any search';
  end if;
  perform public.buyer_last_search_set('{"q":"polo"}'::jsonb);
  last := public.buyer_last_search();
  if last->'state' <> '{"q":"polo"}'::jsonb or (last->>'saved')::boolean then
    raise exception 'last search %', last;
  end if;
  perform public.buyer_last_search_set('{"q":"knit"}'::jsonb);
  if not (public.buyer_last_search()->>'saved')::boolean then
    raise exception 'a saved last search did not say so';
  end if;
  begin
    perform public.buyer_last_search_set('[1]'::jsonb);
    raise exception 'a non-object last search was stored';
  exception when invalid_parameter_value then null;
  end;
  reset role;
end
$$;

rollback;
