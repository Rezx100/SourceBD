-- Behaviour of `discover_suppliers` after 0104, asserted by running it.
--
-- Everything else guarding this migration reads its source text. That is how
-- a doubled comma reached a commit past a guard written to check exactly that
-- ORDER BY, and how the sanction predicate can have both of its `or`s changed
-- to `and` — which makes the function return zero rows for every buyer — with
-- the whole suite green. Nothing below can pass unless the SQL runs.
\set ON_ERROR_STOP on

begin;

-- 0022's on_auth_user_created trigger reads raw_user_meta_data->>'role' off
-- this row, so give it one rather than relying on the default.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-00000000d001', 'ci@example.invalid', '{"role":"buyer"}'::jsonb)
on conflict do nothing;

-- Seeded unpublished first. 0092's publish guard rejects any supplier with no
-- active Tier1-3 source_record — it fired on the second CI run of this job and
-- was right to, so the fixture now gives each record real evidence rather than
-- working around the invariant.
insert into public.suppliers (slug, company_name, company_name_norm, city, district, is_published, is_sanctioned)
values
  ('ci-clean',      'CI Clean Ltd',      'ci clean ltd',      'Dhaka',   'Dhaka',   false, false),
  ('ci-sanctioned', 'CI Sanctioned Ltd', 'ci sanctioned ltd', 'Dhaka',   'Dhaka',   false, true),
  ('ci-draft',      'CI Draft Ltd',      'ci draft ltd',      'Gazipur', 'Gazipur', false, false)
on conflict (slug) do nothing;

insert into public.source_records (supplier_id, source_id, source_tier, source_ref, status)
select s.id, src.id, src.tier, 'ci-' || s.slug, 'active'
  from public.suppliers s
  cross join (select id, tier from public.sources where code = 'BGMEA') src
 where s.slug in ('ci-clean', 'ci-sanctioned', 'ci-draft')
on conflict do nothing;

update public.suppliers
   set is_published = true
 where slug in ('ci-clean', 'ci-sanctioned');

do $$
declare
  n_default    int;
  n_including  int;
  has_clean    boolean;
  has_sanction boolean;
  has_draft    boolean;
begin
  select count(*) into n_default
    from public.discover_suppliers(p_limit => 100) d
   where d.slug like 'ci-%';

  -- The whole point. If the predicate stops admitting ordinary published
  -- suppliers — the failure mode of changing those two `or`s to `and` — this
  -- is 0 and the migration is caught here rather than by a buyer.
  if n_default < 1 then
    raise exception 'discover_suppliers returned % of the seeded suppliers: the filter predicate admits nobody', n_default;
  end if;

  select bool_or(d.slug = 'ci-clean'),
         bool_or(d.slug = 'ci-sanctioned'),
         bool_or(d.slug = 'ci-draft')
    into has_clean, has_sanction, has_draft
    from public.discover_suppliers(p_limit => 100) d;

  if not coalesce(has_clean, false) then
    raise exception 'a published, unsanctioned supplier is missing from the default result set';
  end if;
  if coalesce(has_sanction, false) then
    raise exception 'a sanctioned supplier reached the default result set';
  end if;
  if coalesce(has_draft, false) then
    raise exception 'an unpublished supplier reached the result set';
  end if;

  -- And the exclusion is a filter, not a hard-coded absence: turning it off
  -- must bring the sanctioned record back, or `?sanctioned=include` is a lie.
  select count(*) into n_including
    from public.discover_suppliers(p_limit => 100, p_exclude_sanctioned => false) d
   where d.slug like 'ci-%';
  if n_including <= n_default then
    raise exception 'p_exclude_sanctioned => false returned % rows, no more than the default %', n_including, n_default;
  end if;

  -- total_count is what every pager and the CSV export read; a null there
  -- shows the buyer "0 results" over a full page of them.
  if exists (select 1 from public.discover_suppliers(p_limit => 100) d where d.total_count is null) then
    raise exception 'discover_suppliers returned a row with a null total_count';
  end if;
end
$$;

-- Every dimension the explain function names has to come back, or the
-- zero-result page offers the buyer nothing. `lib/discover-v32-state.test.ts`
-- holds the TypeScript side to this same list.
do $$
declare
  n int;
begin
  select count(*) into n from public.discover_suppliers_explain(p_q => 'nothing matches this') e;
  if n < 1 then
    raise exception 'discover_suppliers_explain returned no dimensions at all';
  end if;
end
$$;

-- saved_searches: the table 0104 creates, and the ownership its RLS depends on.
do $$
begin
  if not exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'saved_searches'
       and cmd = 'SELECT' and qual like '%auth.uid()%'
  ) then
    raise exception 'saved_searches has no owner-scoped select policy';
  end if;
end
$$;

rollback;
