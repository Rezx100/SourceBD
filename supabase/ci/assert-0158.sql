-- 0158 asserted: asking the register-address view for one supplier reads that supplier's records only.
-- A materialised CTE in the plan means every active source record is read again on each profile open.
\set ON_ERROR_STOP on

do $$
declare
  line text;
  plan text := '';
begin
  for line in execute 'explain select * from public.v_supplier_addresses where supplier_id = ''00000000-0000-4000-8000-000000000158''::uuid' loop
    plan := plan || line || E'\n';
  end loop;
  if plan ilike '%CTE Scan%' then
    raise exception '0158: v_supplier_addresses builds every supplier''s addresses for one supplier:%', E'\n' || plan;
  end if;
  if pg_get_viewdef('public.v_supplier_addresses_filed'::regclass) not ilike '%NOT MATERIALIZED%' then
    raise exception '0158: v_supplier_addresses_filed lost NOT MATERIALIZED';
  end if;
end $$;
