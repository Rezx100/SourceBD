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

-- Enough published rows, with DIFFERING sort keys, that an ordering assertion
-- can actually fail. Three seeded suppliers — two of them filtered out by
-- default — left a one-row result set, and any two orderings of one row are
-- equal, so the anon-downgrade assertion below passed with the whole feature
-- deleted. Neither did any fixture carry an EPB record or a certificate, so
-- both sort keys were constant across every row and the ORDER BY collapsed to
-- the id tiebreaker in every branch.
insert into public.suppliers (slug, company_name, company_name_norm, city, district, is_published, is_sanctioned)
select 'ci-sort-' || i, 'CI Sort ' || i, 'ci sort ' || i, 'Dhaka', 'Dhaka', false, false
  from generate_series(1, 6) i
on conflict (slug) do nothing;

insert into public.source_records (supplier_id, source_id, source_tier, source_ref, fields, status)
select s.id, src.id, src.tier, 'ci-bgmea-' || s.slug, '{}'::jsonb, 'active'
  from public.suppliers s
  cross join (select id, tier from public.sources where code = 'BGMEA') src
 where s.slug like 'ci-sort-%'
on conflict do nothing;

-- Each gets a different number of EPB HS headings (1..6) and a different
-- next certificate expiry, so `hs_lines` and `cert_expiry` each produce an
-- order distinct from the default and from one another.
--
-- The three orders have to be genuinely different, which took a second try:
-- with `expires_on = current_date + i * 30` the cert_expiry ascending order
-- was 1..6, identical to the default (every fixture row has the same source
-- count, so the default falls through to company_name ascending), and the
-- assertion below correctly reported the sort as missing. The expiry offsets
-- are a permutation now, so:
--   default      1 2 3 4 5 6   (company_name)
--   hs_lines     6 5 4 3 2 1   (heading count, descending)
--   cert_expiry  2 4 6 1 3 5   (soonest expiry first)
insert into public.source_records (supplier_id, source_id, source_tier, source_ref, fields, status)
select s.id,
       src.id,
       src.tier,
       (1000 + i)::text,
       jsonb_build_object(
         'epb_hscodes',
         (select jsonb_agg(jsonb_build_object('code', lpad((6100 + j)::text, 4, '0')))
            from generate_series(1, i) j)
       ),
       'active'
  from generate_series(1, 6) i
  join public.suppliers s on s.slug = 'ci-sort-' || i
  cross join (select id, tier from public.sources where code = 'EPB') src
on conflict do nothing;

insert into public.certifications (supplier_id, kind, expires_on)
select s.id, 'gots', (current_date + (array[50, 10, 60, 20, 70, 30])[i])
  from generate_series(1, 6) i
  join public.suppliers s on s.slug = 'ci-sort-' || i
on conflict do nothing;

update public.suppliers set is_published = true where slug like 'ci-sort-%';

do $$
declare
  n int;
begin
  select count(*) into n from public.discover_suppliers(p_limit => 100);
  -- The assertions below compare orderings. With fewer than two rows, or with
  -- a constant sort key, they are identities that hold whatever the code does.
  if n < 6 then
    raise exception 'the fixture yields only % rows; ordering assertions would be vacuous', n;
  end if;
  if (select count(distinct cardinality(public.discover_v32_hs_codes(d.id)))
        from public.discover_suppliers(p_limit => 100) d) < 3 then
    raise exception 'hs heading counts do not vary across the fixture; the hs_lines ordering cannot differ';
  end if;
  if (select count(distinct public.discover_v32_next_cert_expiry(d.id))
        from public.discover_suppliers(p_limit => 100) d) < 3 then
    raise exception 'cert expiries do not vary across the fixture; the cert_expiry ordering cannot differ';
  end if;
end
$$;

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

-- The two expensive sorts must be unavailable to an anonymous caller, and
-- must still work for a signed-in one. Both halves are asserted, because an
-- assertion that only checks the anon half passes when the sorts are deleted
-- outright. `auth.role()` is left UNSET for the anon leg on purpose: that is
-- the NULL case the first version of this predicate got wrong, and the stub
-- now returns NULL there exactly as Supabase does.
do $$
declare
  anon_hs   uuid[];
  anon_cert uuid[];
  anon_def  uuid[];
  auth_hs   uuid[];
  auth_cert uuid[];
begin
  perform set_config('request.jwt.claim.role', '', true);   -- no JWT at all
  select array_agg(d.id order by ord) into anon_hs
    from (select id, row_number() over () as ord
            from public.discover_suppliers(p_sort => 'hs_lines', p_limit => 100)) d;
  select array_agg(d.id order by ord) into anon_cert
    from (select id, row_number() over () as ord
            from public.discover_suppliers(p_sort => 'cert_expiry', p_limit => 100)) d;
  select array_agg(d.id order by ord) into anon_def
    from (select id, row_number() over () as ord
            from public.discover_suppliers(p_limit => 100)) d;

  if anon_hs is distinct from anon_def then
    raise exception 'a caller with no JWT got the hs_lines ordering; the downgrade is NULL-unsafe';
  end if;
  if anon_cert is distinct from anon_def then
    raise exception 'a caller with no JWT got the cert_expiry ordering; the downgrade is NULL-unsafe';
  end if;

  perform set_config('request.jwt.claim.role', 'anon', true);
  select array_agg(d.id order by ord) into anon_hs
    from (select id, row_number() over () as ord
            from public.discover_suppliers(p_sort => 'hs_lines', p_limit => 100)) d;
  if anon_hs is distinct from anon_def then
    raise exception 'an anon caller got the hs_lines ordering; the downgrade does not fire';
  end if;

  perform set_config('request.jwt.claim.role', 'authenticated', true);
  select array_agg(d.id order by ord) into auth_hs
    from (select id, row_number() over () as ord
            from public.discover_suppliers(p_sort => 'hs_lines', p_limit => 100)) d;
  select array_agg(d.id order by ord) into auth_cert
    from (select id, row_number() over () as ord
            from public.discover_suppliers(p_sort => 'cert_expiry', p_limit => 100)) d;

  -- The other half: a signed-in caller must still GET these sorts. Without
  -- this, deleting both sorts entirely would pass everything above.
  if auth_hs is not distinct from anon_def then
    raise exception 'a signed-in caller got the default ordering for hs_lines; the sort is gone';
  end if;
  if auth_cert is not distinct from anon_def then
    raise exception 'a signed-in caller got the default ordering for cert_expiry; the sort is gone';
  end if;
  if auth_hs is not distinct from auth_cert then
    raise exception 'hs_lines and cert_expiry produced the same order; the fixture cannot tell them apart';
  end if;

  perform set_config('request.jwt.claim.role', '', true);
end
$$;

-- Owner isolation on saved_searches, exercised rather than pattern-matched.
-- Checking pg_policies.qual for the text 'auth.uid()' passes a policy reading
-- `auth.uid() is not null`, which shows every buyer every saved search. Run it
-- as each user instead, through the same auth.uid() the policy calls.
do $$
declare
  n int;
begin
  if not exists (
    select 1 from pg_tables
     where schemaname = 'public' and tablename = 'saved_searches' and rowsecurity
  ) then
    raise exception 'row level security is not enabled on saved_searches';
  end if;

  insert into auth.users (id, email, raw_user_meta_data) values
    ('00000000-0000-4000-8000-00000000d002', 'ci-b@example.invalid', '{"role":"buyer"}'::jsonb)
  on conflict do nothing;

  insert into public.saved_searches (owner_id, name, query_state) values
    ('00000000-0000-4000-8000-00000000d001', 'A knit search', '{"search":"q=knit"}'::jsonb);

  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000d002', true);
  select count(*) into n from public.saved_searches;
  if n <> 0 then
    raise exception 'user B can see % of user A''s saved searches', n;
  end if;

  perform set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000d001', true);
  select count(*) into n from public.saved_searches;
  if n <> 1 then
    raise exception 'the owner sees % of their own saved searches, expected 1', n;
  end if;
  reset role;
  perform set_config('request.jwt.claim.sub', '', true);
end
$$;

-- Every dimension the explain function names has to come back, or the
-- zero-result page offers the buyer nothing. `lib/discover-v32-state.test.ts`
-- holds the TypeScript side to this same list — but it reads the literals out
-- of the migration's source text, so it cannot see a dimension whose `if`
-- guard stopped firing, nor one whose inner call stopped returning a row.
--
-- The old check here was `count(*) >= 1` against a call that set only `p_q`:
-- eleven of the twelve could have been deleted outright and it stayed green.
--
-- One call per dimension, each setting only that dimension's filter. That
-- matters: `discover_suppliers_explain` re-runs the search with the named
-- filter dropped and the rest kept, so a single call carrying all twelve
-- narrows every re-run to nothing and emits nothing at all. Setting one at a
-- time leaves the re-run unfiltered, which the fixture's seven published rows
-- satisfy, and proves each `if` fires on its own.
-- Two assertions, because the labels alone are not the deliverable. Each
-- branch re-runs `discover_suppliers` with its own filter nulled and reports
-- `total_count` as `remaining`; twelve near-identical eight-line blocks is
-- precisely where a copy-paste nulls the wrong parameter, and the label still
-- emits while the buyer is told "Drop HS code · N remain" with N computed from
-- dropping something else.
--
-- The fixture inserts eight published suppliers, one of which is sanctioned,
-- so `discover_suppliers` returns seven under the default
-- `p_exclude_sanctioned`. None of the seven matches any filter used below, so
-- every branch that drops its own filter must report all of them.
do $$
declare
  got  text[];
  want text[] := array[
    'brand', 'cert', 'city', 'district', 'est', 'hs',
    'min_sources', 'q', 'registry', 'rsc', 'type', 'workers'
  ];
begin
  select array_agg(distinct d order by d) into got from (
    select e.dropped as d from public.discover_suppliers_explain(p_q => 'nothing matches this') e
    union all select e.dropped from public.discover_suppliers_explain(p_hs_codes => array['9999']) e
    union all select e.dropped from public.discover_suppliers_explain(p_cert_kinds => array['oeko_tex']) e
    union all select e.dropped from public.discover_suppliers_explain(p_rsc_min => 50) e
    union all select e.dropped from public.discover_suppliers_explain(p_est_from => 1990) e
    union all select e.dropped from public.discover_suppliers_explain(p_workers_min => 100000) e
    union all select e.dropped from public.discover_suppliers_explain(p_district => 'Nowhere') e
    union all select e.dropped from public.discover_suppliers_explain(p_city => 'Nowhere') e
    union all select e.dropped from public.discover_suppliers_explain(p_entity_types => array['factory']) e
    union all select e.dropped from public.discover_suppliers_explain(p_min_sources => 99) e
    union all select e.dropped from public.discover_suppliers_explain(p_brand_codes => array['nope']) e
    union all select e.dropped from public.discover_suppliers_explain(p_registries => array['nope']) e
  ) t;

  if got is distinct from (select array_agg(w order by w) from unnest(want) w) then
    raise exception 'discover_suppliers_explain emits %, expected %',
      coalesce(got::text, 'nothing'), want;
  end if;
end
$$;

do $$
declare
  published bigint;
  seen      int := 0;
  r record;
begin
  -- `total_count`, not `count(*)`: the row count is capped by `p_limit`, so
  -- comparing it against `remaining` (which is the uncapped `total_count`)
  -- would start failing spuriously the day the fixture grows past 100 rows.
  select coalesce(max(d.total_count), 0) into published
    from public.discover_suppliers(p_limit => 100) d;

  for r in
    select 'q'           as dim, e.remaining from public.discover_suppliers_explain(p_q => 'nothing matches this') e
    union all select 'hs',          e.remaining from public.discover_suppliers_explain(p_hs_codes => array['9999']) e
    union all select 'cert',        e.remaining from public.discover_suppliers_explain(p_cert_kinds => array['oeko_tex']) e
    union all select 'rsc',         e.remaining from public.discover_suppliers_explain(p_rsc_min => 50) e
    union all select 'est',         e.remaining from public.discover_suppliers_explain(p_est_from => 1990) e
    union all select 'workers',     e.remaining from public.discover_suppliers_explain(p_workers_min => 100000) e
    union all select 'district',    e.remaining from public.discover_suppliers_explain(p_district => 'Nowhere') e
    union all select 'city',        e.remaining from public.discover_suppliers_explain(p_city => 'Nowhere') e
    union all select 'type',        e.remaining from public.discover_suppliers_explain(p_entity_types => array['factory']) e
    union all select 'min_sources', e.remaining from public.discover_suppliers_explain(p_min_sources => 99) e
    union all select 'brand',       e.remaining from public.discover_suppliers_explain(p_brand_codes => array['nope']) e
    union all select 'registry',    e.remaining from public.discover_suppliers_explain(p_registries => array['nope']) e
  loop
    seen := seen + 1;
    if r.remaining is distinct from published then
      raise exception
        'discover_suppliers_explain says % leaves % suppliers; dropping the only filter set must leave all %',
        r.dim, coalesce(r.remaining::text, 'null'), published;
    end if;
  end loop;

  -- Without this the loop is vacuous on any branch that stops emitting: a
  -- copy-paste that breaks an `if` CONDITION makes its dimension return no
  -- row, `for` simply skips it, and every remaining branch still matches. The
  -- count is the assertion that a missing dimension is a failure.
  if seen <> 12 then
    raise exception 'discover_suppliers_explain answered % of the 12 single-filter calls', seen;
  end if;
end
$$;

-- The export's rate-limit bucket must be one rl_check accepts: it refuses an
-- unlisted bucket and the app's limiter fails OPEN on that error, so a
-- missing entry would silently mean "no limit".
do $$
declare
  env jsonb;
begin
  env := public.rl_check('api_export', 'ci-export', 6);
  if (env->>'ok')::boolean is distinct from true then
    raise exception 'rl_check did not admit the first api_export call: %', env;
  end if;
  begin
    perform public.rl_check('api_bogus', 'ci-export', 6);
    raise exception 'rl_check accepted an unlisted bucket';
  exception when invalid_parameter_value then
    null;
  end;
end
$$;

-- saved_searches bounds, run rather than read.
do $$
declare
  i int;
begin
  begin
    insert into public.saved_searches (owner_id, name) values
      ('00000000-0000-4000-8000-00000000d001', repeat('x', 121));
    raise exception 'a 121-character saved-search name was accepted';
  exception when check_violation then
    null;
  end;
  begin
    insert into public.saved_searches (owner_id, name, query_state) values
      ('00000000-0000-4000-8000-00000000d001', 'huge', jsonb_build_object('search', repeat('q', 9000)));
    raise exception 'a 9 KB saved-search state was accepted';
  exception when check_violation then
    null;
  end;
  delete from public.saved_searches where owner_id = '00000000-0000-4000-8000-00000000d001';
  for i in 1..500 loop
    insert into public.saved_searches (owner_id, name) values ('00000000-0000-4000-8000-00000000d001', 'cap ' || i);
  end loop;
  begin
    insert into public.saved_searches (owner_id, name) values ('00000000-0000-4000-8000-00000000d001', 'cap 501');
    raise exception 'the 501st saved search for one owner was accepted';
  exception when program_limit_exceeded then
    null;
  end;
end
$$;

rollback;
