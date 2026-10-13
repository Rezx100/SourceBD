-- 0149 asserted by running it. facility_parent_slug: a merged duplicate's old address answers the kept
-- profile's slug; a linked building still answers its company (0096 unchanged); an old address whose kept
-- row has become a building answers that building's company in one hop; an old address whose kept row is
-- unpublished and no building, and a slug nobody knows, answer null. Deleting the kept row deletes its
-- redirects. The table is closed to anon and authenticated; the function is not.
\set ON_ERROR_STOP on

begin;

insert into public.suppliers (slug, company_name, company_name_norm, city, district, is_published, is_sanctioned)
values
  ('ci-0149-kept',     'CI 0149 Kept Ltd',     'ci 0149 kept ltd',     'Dhaka', 'Dhaka', false, false),
  ('ci-0149-mother',   'CI 0149 Mother Ltd',   'ci 0149 mother ltd',   'Dhaka', 'Dhaka', false, false),
  ('ci-0149-unlisted', 'CI 0149 Unlisted Ltd', 'ci 0149 unlisted ltd', 'Dhaka', 'Dhaka', false, false);

-- Published only once each holds a Tier 1 source (enforce_publish_tier). The unlisted row stays unpublished.
insert into public.source_records (supplier_id, source_id, source_tier, source_ref)
select sp.id, s.id, s.tier, 'CI-0149-' || sp.slug from public.suppliers sp, public.sources s
 where sp.slug in ('ci-0149-kept', 'ci-0149-mother') and s.code = 'RSC';
update public.suppliers set is_published = true where slug in ('ci-0149-kept', 'ci-0149-mother');

insert into public.suppliers (slug, company_name, company_name_norm, city, district, is_published, is_sanctioned, facility_of)
select 'ci-0149-shed', 'CI 0149 Shed', 'ci 0149 shed', 'Dhaka', 'Dhaka', false, false, p.id
  from public.suppliers p where p.slug = 'ci-0149-mother';

insert into public.supplier_slug_redirects (old_slug, supplier_id)
select v.old_slug, s.id
  from (values ('ci-0149-old',          'ci-0149-kept'),
               ('ci-0149-old-shed',     'ci-0149-shed'),
               ('ci-0149-old-unlisted', 'ci-0149-unlisted')) v(old_slug, kept)
  join public.suppliers s on s.slug = v.kept;

do $$
declare
  got text;
  r   record;
begin
  if has_table_privilege('anon', 'public.supplier_slug_redirects', 'select')
     or has_table_privilege('authenticated', 'public.supplier_slug_redirects', 'select')
     or not (select relrowsecurity from pg_class where oid = 'public.supplier_slug_redirects'::regclass) then
    raise exception '0149: the redirect table can be read with the public key';
  end if;
  if not has_function_privilege('anon', 'public.facility_parent_slug(text)', 'execute')
     or not has_function_privilege('authenticated', 'public.facility_parent_slug(text)', 'execute') then
    raise exception '0149: the pages can no longer call facility_parent_slug';
  end if;

  for r in select * from (values
      ('ci-0149-old',          'ci-0149-kept',   'a merged old address goes to the kept profile'),
      ('ci-0149-shed',         'ci-0149-mother', 'a linked building still goes to its company'),
      ('ci-0149-old-shed',     'ci-0149-mother', 'an old address whose kept row is now a building goes to the company'),
      ('ci-0149-old-unlisted', null,             'an old address whose kept row is unpublished stays a 404'),
      ('ci-0149-kept',         null,             'a published profile has nowhere to go'),
      ('ci-0149-nobody',       null,             'an unknown slug stays a 404')
    ) v(asked, want, why)
  loop
    got := public.facility_parent_slug(r.asked);
    if got is distinct from r.want then
      raise exception '0149: % — asked %, wanted %, got %', r.why, r.asked, r.want, got;
    end if;
  end loop;

  -- The pages call it signed out.
  set local role anon;
  got := public.facility_parent_slug('ci-0149-old');
  reset role;
  if got is distinct from 'ci-0149-kept' then
    raise exception '0149: signed out, the old address answered %', got;
  end if;

  delete from public.suppliers where slug = 'ci-0149-kept';
  if exists (select 1 from public.supplier_slug_redirects where old_slug = 'ci-0149-old')
     or public.facility_parent_slug('ci-0149-old') is not null then
    raise exception '0149: a redirect outlived the row it points at';
  end if;
end
$$;

rollback;
