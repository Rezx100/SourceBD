-- 0149 asserted by running it. facility_parent_slug: the retired slug of a merged supplier answers with
-- the kept row's slug, and follows the kept row when it is renamed; it answers nothing when the kept row
-- is unpublished, when a live row holds the slug, for the kept row's own slug and for an unknown slug;
-- when the kept row has become a building it answers with the mother; a building still answers with its
-- mother as in 0096. A signed-out caller can call the function and cannot read the table. The table's
-- supplier column is a foreign key to suppliers, which is what makes both merges carry it along.
\set ON_ERROR_STOP on

begin;

-- 1 kept, 2 kept but unpublished, 3 a mother, 4 a kept row that became a building of 3, 5 a live
-- unpublished row whose slug the table also holds.
insert into public.suppliers (id, slug, company_name, company_name_norm, city, district, is_published, is_sanctioned)
select ('00000000-0000-4000-8000-00000149000' || k)::uuid, 'ci-0149-' || s, 'CI 0149 ' || s || ' Ltd', 'ci 0149 ' || s || ' ltd', 'Dhaka', 'Dhaka', false, false
  from (values (1, 'kept'), (2, 'unpublished'), (3, 'mother'), (4, 'building'), (5, 'live')) v(k, s);

-- Published only once each holds a Tier 1 source (enforce_publish_tier).
insert into public.source_records (supplier_id, source_id, source_tier, source_ref)
select sp.id, s.id, s.tier, 'CI-0149-' || sp.slug from public.suppliers sp, public.sources s
 where sp.slug in ('ci-0149-kept', 'ci-0149-mother') and s.code = 'RSC';
update public.suppliers set is_published = true where slug in ('ci-0149-kept', 'ci-0149-mother');
update public.suppliers set facility_of = '00000000-0000-4000-8000-000001490003' where slug = 'ci-0149-building';

insert into public.supplier_slug_redirects (old_slug, supplier_id) values
  ('ci-0149-old',          '00000000-0000-4000-8000-000001490001'),
  ('ci-0149-old-unpub',    '00000000-0000-4000-8000-000001490002'),
  ('ci-0149-old-building', '00000000-0000-4000-8000-000001490004'),
  ('ci-0149-live',         '00000000-0000-4000-8000-000001490001');

do $$
declare
  got text;
begin
  got := public.facility_parent_slug('ci-0149-old');
  if got is distinct from 'ci-0149-kept' then raise exception 'a merged slug answered %, not the kept profile', got; end if;

  got := public.facility_parent_slug('ci-0149-old-unpub');
  if got is not null then raise exception 'a merged slug answered % though the kept row is unpublished', got; end if;

  got := public.facility_parent_slug('ci-0149-old-building');
  if got is distinct from 'ci-0149-mother' then raise exception 'a merged slug whose kept row is a building answered %, not the mother', got; end if;

  got := public.facility_parent_slug('ci-0149-live');
  if got is not null then raise exception 'a slug a live row holds was redirected to %', got; end if;

  got := public.facility_parent_slug('ci-0149-kept');
  if got is not null then raise exception 'the kept row''s own slug answered %', got; end if;

  got := public.facility_parent_slug('ci-0149-no-such-slug');
  if got is not null then raise exception 'an unknown slug answered %', got; end if;

  -- 0096 still holds.
  got := public.facility_parent_slug('ci-0149-building');
  if got is distinct from 'ci-0149-mother' then raise exception 'a building answered %, not its mother', got; end if;

  -- Signed out: the function answers, the table does not.
  set local role anon;
  got := public.facility_parent_slug('ci-0149-old');
  if got is distinct from 'ci-0149-kept' then raise exception 'signed out, a merged slug answered %', got; end if;
  begin
    perform 1 from public.supplier_slug_redirects limit 1;
    raise exception 'a signed-out caller read supplier_slug_redirects';
  exception when insufficient_privilege then null;
  end;
  reset role;

  -- The table points at the row, not at a slug: a rename is followed.
  update public.suppliers set slug = 'ci-0149-renamed' where slug = 'ci-0149-kept';
  got := public.facility_parent_slug('ci-0149-old');
  if got is distinct from 'ci-0149-renamed' then raise exception 'after a rename a merged slug answered %', got; end if;

  -- Both merges move every foreign key to suppliers.id onto the kept row; this is one.
  if not exists (select 1 from pg_constraint c
                  where c.conrelid = 'public.supplier_slug_redirects'::regclass and c.contype = 'f'
                    and c.confrelid = 'public.suppliers'::regclass and c.confdeltype = 'c') then
    raise exception 'supplier_slug_redirects.supplier_id is not a cascading foreign key to suppliers';
  end if;
end $$;

rollback;
