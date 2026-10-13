-- 0150 asserted by running it. Renaming a published supplier leaves its old address answering the new
-- one; a second rename is followed (a -> b -> c: a and b answer c); renaming back leaves the live address
-- answering nothing and the others answering it; an address a second row is later renamed away from goes
-- to that later row; an update that does not change the slug writes nothing; an unpublished renamed row
-- is recorded and answers nothing; a renamed building answers its company; the trigger function runs as
-- its owner and cannot be called by anon or authenticated; deleting the row deletes its old addresses.
\set ON_ERROR_STOP on

begin;

insert into public.suppliers (slug, company_name, company_name_norm, city, district, is_published, is_sanctioned)
values
  ('ci-0150-a',        'CI 0150 A Ltd',        'ci 0150 a ltd',        'Dhaka', 'Dhaka', false, false),
  ('ci-0150-other',    'CI 0150 Other Ltd',    'ci 0150 other ltd',    'Dhaka', 'Dhaka', false, false),
  ('ci-0150-unlisted', 'CI 0150 Unlisted Ltd', 'ci 0150 unlisted ltd', 'Dhaka', 'Dhaka', false, false),
  ('ci-0150-unit',     'CI 0150 Unit Ltd',     'ci 0150 unit ltd',     'Dhaka', 'Dhaka', false, false);

-- Published only once each holds a Tier 1 source (enforce_publish_tier).
insert into public.source_records (supplier_id, source_id, source_tier, source_ref)
select sp.id, s.id, s.tier, 'CI-0150-' || sp.slug from public.suppliers sp, public.sources s
 where sp.slug in ('ci-0150-a', 'ci-0150-other') and s.code = 'RSC';
update public.suppliers set is_published = true where slug in ('ci-0150-a', 'ci-0150-other');
update public.suppliers set facility_of = (select id from public.suppliers where slug = 'ci-0150-other')
 where slug = 'ci-0150-unit';

do $$
declare
  a     constant uuid := (select id from public.suppliers where slug = 'ci-0150-a');
  other constant uuid := (select id from public.suppliers where slug = 'ci-0150-other');
  n     bigint;
  got   text;
begin
  select count(*) into n from public.supplier_slug_redirects where old_slug like 'ci-0150-%';
  if n <> 0 then raise exception 'setup wrote % redirects before any rename', n; end if;

  -- An update that leaves the slug alone, or sets it to itself, writes nothing.
  update public.suppliers set city = 'Gazipur' where id = a;
  update public.suppliers set slug = slug where id = a;
  select count(*) into n from public.supplier_slug_redirects where old_slug like 'ci-0150-%';
  if n <> 0 then raise exception 'an update without a rename wrote % redirects', n; end if;

  -- a -> b: the old address answers the new one.
  update public.suppliers set slug = 'ci-0150-b' where id = a;
  got := public.facility_parent_slug('ci-0150-a');
  if got is distinct from 'ci-0150-b' then raise exception 'after a rename the old address answered %', got; end if;

  -- b -> c: both old addresses follow the row.
  update public.suppliers set slug = 'ci-0150-c' where id = a;
  if public.facility_parent_slug('ci-0150-a') is distinct from 'ci-0150-c'
     or public.facility_parent_slug('ci-0150-b') is distinct from 'ci-0150-c' then
    raise exception 'after a second rename: a -> %, b -> %',
      public.facility_parent_slug('ci-0150-a'), public.facility_parent_slug('ci-0150-b');
  end if;

  -- c -> a (renamed back): the live address answers nothing, the others answer it.
  update public.suppliers set slug = 'ci-0150-a' where id = a;
  if public.facility_parent_slug('ci-0150-a') is not null then
    raise exception 'a live address was redirected to %', public.facility_parent_slug('ci-0150-a');
  end if;
  if public.facility_parent_slug('ci-0150-b') is distinct from 'ci-0150-a'
     or public.facility_parent_slug('ci-0150-c') is distinct from 'ci-0150-a' then
    raise exception 'after renaming back: b -> %, c -> %',
      public.facility_parent_slug('ci-0150-b'), public.facility_parent_slug('ci-0150-c');
  end if;

  -- Another row takes b, then leaves it: the address goes to the later holder.
  update public.suppliers set slug = 'ci-0150-b' where id = other;
  if public.facility_parent_slug('ci-0150-b') is not null then
    raise exception 'an address a live row took was redirected to %', public.facility_parent_slug('ci-0150-b');
  end if;
  update public.suppliers set slug = 'ci-0150-other-2' where id = other;
  got := public.facility_parent_slug('ci-0150-b');
  if got is distinct from 'ci-0150-other-2' then raise exception 'an address two rows held answered %, not its later holder', got; end if;

  -- An unpublished row is recorded and answers nothing.
  update public.suppliers set slug = 'ci-0150-unlisted-2' where slug = 'ci-0150-unlisted';
  if public.facility_parent_slug('ci-0150-unlisted') is not null then
    raise exception 'an unpublished renamed row answered %', public.facility_parent_slug('ci-0150-unlisted');
  end if;
  if not exists (select 1 from public.supplier_slug_redirects where old_slug = 'ci-0150-unlisted') then
    raise exception 'an unpublished row''s rename was not recorded';
  end if;

  -- A renamed building answers its company.
  update public.suppliers set slug = 'ci-0150-unit-2' where slug = 'ci-0150-unit';
  got := public.facility_parent_slug('ci-0150-unit');
  if got is distinct from 'ci-0150-other-2' then raise exception 'a renamed building''s old address answered %', got; end if;

  -- The trigger function runs as its owner and is not callable from outside.
  if not (select prosecdef from pg_proc where oid = 'public.record_supplier_slug_change()'::regprocedure) then
    raise exception 'record_supplier_slug_change is not security definer';
  end if;
  if has_function_privilege('anon', 'public.record_supplier_slug_change()', 'execute')
     or has_function_privilege('authenticated', 'public.record_supplier_slug_change()', 'execute') then
    raise exception 'record_supplier_slug_change is callable by anon or authenticated';
  end if;

  -- Deleting the row deletes its old addresses (0149's foreign key).
  delete from public.suppliers where id = a;
  if public.facility_parent_slug('ci-0150-c') is not null
     or exists (select 1 from public.supplier_slug_redirects where supplier_id = a) then
    raise exception 'a deleted row left an old address behind';
  end if;
end $$;

rollback;
