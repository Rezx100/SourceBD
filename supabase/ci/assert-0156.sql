-- 0156 asserted by running it: a saved Volza result cannot be deleted, changed or truncated before its year
-- is up; an expired one can be deleted; buyers cannot read the table.
\set ON_ERROR_STOP on

begin;

insert into public.volza_raw_results (results_file, supplier_id, fetched_at, expires_at, record)
values
  ('launch_ci.jsonl', '00000000-0000-0000-0000-000000000156', now(), now() + interval '1 year', '{"id": "a"}'),
  ('launch_ci.jsonl', '00000000-0000-0000-0000-000000000157', now() - interval '2 years',
   now() - interval '1 year', '{"id": "b"}');

do $$
begin
  begin
    delete from public.volza_raw_results where supplier_id = '00000000-0000-0000-0000-000000000156';
    raise exception 'CI: an unexpired row was deleted';
  exception when raise_exception then
    if sqlerrm like 'CI:%' then raise; end if;
  end;
  begin
    update public.volza_raw_results set record = '{}' where supplier_id = '00000000-0000-0000-0000-000000000156';
    raise exception 'CI: a row was changed';
  exception when raise_exception then
    if sqlerrm like 'CI:%' then raise; end if;
  end;
  begin
    truncate public.volza_raw_results;
    raise exception 'CI: the table was truncated';
  exception when raise_exception then
    if sqlerrm like 'CI:%' then raise; end if;
  end;

  delete from public.volza_raw_results where supplier_id = '00000000-0000-0000-0000-000000000157';
  if (select count(*) from public.volza_raw_results where results_file = 'launch_ci.jsonl') <> 1 then
    raise exception 'the expired row should go and the unexpired one stay';
  end if;

  if has_table_privilege('anon', 'public.volza_raw_results', 'select')
     or has_table_privilege('authenticated', 'public.volza_raw_results', 'select') then
    raise exception 'buyers can read the raw Volza results';
  end if;
end
$$;

rollback;
