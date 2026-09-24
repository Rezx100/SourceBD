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

-- The sanctioned supplier exports HS 6101, a heading the ci-sort rows below
-- also carry, so a catalogue count that includes it disagrees with the
-- Discover search for 6101 (asserted at the end of this file).
insert into public.source_records (supplier_id, source_id, source_tier, source_ref, fields, status)
select s.id, src.id, src.tier, '2001',
       jsonb_build_object('epb_hscodes', jsonb_build_array(jsonb_build_object('code', '6101'))),
       'active'
  from public.suppliers s
  cross join (select id, tier from public.sources where code = 'EPB') src
 where s.slug = 'ci-sanctioned'
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
  i int;
begin
  env := public.rl_check('api_export', 'ci-export', 6);
  if (env->>'ok')::boolean is distinct from true then
    raise exception 'rl_check did not admit the first api_export call: %', env;
  end if;
  -- And it LIMITS: the seventh call in the minute at a limit of six is refused.
  for i in 2..6 loop
    env := public.rl_check('api_export', 'ci-export', 6);
  end loop;
  if (env->>'ok')::boolean is distinct from true then
    raise exception 'rl_check refused call 6 of 6: %', env;
  end if;
  env := public.rl_check('api_export', 'ci-export', 6);
  if (env->>'ok')::boolean is distinct from false then
    raise exception 'rl_check admitted call 7 at a limit of 6: %', env;
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
    insert into public.saved_searches (owner_id, name) values
      ('00000000-0000-4000-8000-00000000d001', '');
    raise exception 'an empty saved-search name was accepted';
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
  for i in 1..200 loop
    insert into public.saved_searches (owner_id, name) values ('00000000-0000-4000-8000-00000000d001', 'cap ' || i);
  end loop;
  -- As the owner, through RLS: the cap trigger is SECURITY INVOKER, so its
  -- count is the owner's own RLS-visible rows. Run as the superuser this
  -- would prove nothing about that count.
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000d001', true);
  begin
    insert into public.saved_searches (owner_id, name) values ('00000000-0000-4000-8000-00000000d001', 'cap 201');
    raise exception 'the 201st saved search for one owner was accepted';
  exception when program_limit_exceeded then
    null;
  end;
  -- Someone else inserting under the full owner's id is refused by RLS, not
  -- told "limit reached": a definer count answered that about another
  -- account's rows.
  perform set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000d002', true);
  begin
    insert into public.saved_searches (owner_id, name) values ('00000000-0000-4000-8000-00000000d001', 'not mine');
    raise exception 'a buyer inserted a saved search under another owner';
  exception
    when insufficient_privilege then null;
    when program_limit_exceeded then
      raise exception 'the cap answered about another owner''s rows (54000), leaking their count';
  end;
  reset role;
  perform set_config('request.jwt.claim.sub', '', true);
end
$$;

-- Who may call what, under Supabase's default privileges (emulated in
-- 00-supabase-bootstrap.sql). `revoke ... from public` alone leaves the
-- default anon/authenticated grants in place.
do $$
declare
  r record;
  bad text := '';
begin
  for r in
    select p.oid, p.proname
      from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and (p.proname like 'discover\_v32\_%' or p.proname in (
            'discover_suppliers_explain', 'supplier_epb_hscodes_batch', 'hs_catalogue',
            'rl_check', 'saved_searches_owner_cap'))
  loop
    if has_function_privilege('anon', r.oid, 'execute') then
      bad := bad || ' ' || r.proname;
    end if;
  end loop;
  if bad <> '' then
    raise exception 'anon can execute functions 0104 means to keep from it:%', bad;
  end if;
  for r in
    select p.oid, p.proname from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and p.proname like 'discover\_v32\_%'
  loop
    if has_function_privilege('authenticated', r.oid, 'execute') then
      raise exception 'authenticated can execute the internal helper %', r.proname;
    end if;
  end loop;
  if not exists (
    select 1 from pg_proc p
     where p.pronamespace = 'public'::regnamespace and p.proname = 'discover_suppliers_explain'
       and has_function_privilege('authenticated', p.oid, 'execute')
  ) or not exists (
    select 1 from pg_proc p
     where p.pronamespace = 'public'::regnamespace and p.proname = 'discover_suppliers'
       and has_function_privilege('authenticated', p.oid, 'execute')
  ) then
    raise exception 'a signed-in buyer cannot execute discover_suppliers or its explain';
  end if;
  if not has_function_privilege('authenticated', 'public.hs_catalogue()', 'execute')
     or not has_function_privilege('authenticated', 'public.supplier_epb_hscodes_batch(text[])', 'execute')
     or not has_function_privilege('authenticated', 'public.rl_check(text,text,int)', 'execute')
     -- 0104 re-creates it; signed-out and signed-in Discover both call it.
     or not has_function_privilege('anon', 'public.production_workers_display_batch(uuid[])', 'execute')
     or not has_function_privilege('authenticated', 'public.production_workers_display_batch(uuid[])', 'execute') then
    raise exception 'a function the app calls is not executable by the role that calls it';
  end if;
  if not exists (
    select 1 from pg_proc p
     where p.pronamespace = 'public'::regnamespace and p.proname = 'discover_suppliers'
       and has_function_privilege('anon', p.oid, 'execute')
  ) then
    raise exception 'discover_suppliers is no longer executable by anon — the public Discover page needs it';
  end if;
end
$$;

-- And the chains actually RUN under the roles that use them — privilege
-- checks alone say nothing about a definer function reaching helpers the
-- caller itself may not execute.
do $$
declare
  n bigint;
  c record;
begin
  set local role anon;
  perform set_config('request.jwt.claim.role', 'anon', true);
  select count(*) into n from public.discover_suppliers();
  if n = 0 then
    raise exception 'discover_suppliers returned nothing to anon — the public Discover page would be empty';
  end if;
  reset role;
  set local role authenticated;
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000d001', true);
  select count(*) into n from public.discover_suppliers(p_sort => 'hs_lines');
  if n = 0 then
    raise exception 'discover_suppliers returned nothing to a signed-in buyer';
  end if;
  select count(*) into n from public.discover_suppliers_explain(p_q => 'zz-no-match-zz');
  select count(*) into n from public.hs_catalogue();
  if n = 0 then
    raise exception 'hs_catalogue returned nothing to a signed-in buyer over EPB-seeded suppliers';
  end if;
  -- Each Products row links to /app/discover?hs=<heading>; its count must be
  -- that search's total, or the buyer clicks "7 exporters" and finds 6.
  for c in select h.hs, h.exporter_count from public.hs_catalogue() h loop
    select coalesce(max(d.total_count), 0) into n
      from public.discover_suppliers(p_hs_codes => array[c.hs], p_limit => 1) d;
    if n <> c.exporter_count then
      raise exception 'hs_catalogue counts % exporters of %, but the Discover search it links to finds %',
        c.exporter_count, c.hs, n;
    end if;
  end loop;
  -- The loop above proves nothing unless a sanctioned exporter of 6101 is
  -- really there to be left out: with sanctioned suppliers included, the
  -- search for 6101 must find more than the catalogue counts.
  if not exists (select 1 from public.hs_catalogue() h where h.hs = '6101') then
    raise exception 'hs_catalogue has no 6101 row; the reconciliation above never looked at the sanctioned exporter';
  end if;
  select coalesce(max(d.total_count), 0) into n
    from public.discover_suppliers(p_hs_codes => array['6101'], p_exclude_sanctioned => false, p_limit => 1) d;
  if n <= coalesce((select h.exporter_count from public.hs_catalogue() h where h.hs = '6101'), 0) then
    raise exception 'no sanctioned exporter of 6101 in the fixture (% with sanctioned); the reconciliation above checked nothing', n;
  end if;
  reset role;
  perform set_config('request.jwt.claim.role', '', true);
  perform set_config('request.jwt.claim.sub', '', true);
end
$$;

-- production_workers_display_batch says which sites it summed (0104). The
-- Discover page's words about buildings rest on nothing else: comparing the
-- figure with the record's own called a standalone factory whose RSC
-- headcount differs from its register "this record and its buildings".
insert into public.suppliers (slug, company_name, company_name_norm, city, district, is_published, is_sanctioned, employees_total)
values
  ('ci-w-alone',  'CI W Alone',  'ci w alone',  'Dhaka', 'Dhaka', false, false, 550),
  ('ci-w-parent', 'CI W Parent', 'ci w parent', 'Dhaka', 'Dhaka', false, false, 1200),
  ('ci-w-group',  'CI W Group',  'ci w group',  'Dhaka', 'Dhaka', false, false, 2000),
  ('ci-w-two',    'CI W Two',    'ci w two',    'Dhaka', 'Dhaka', false, false, 1500)
on conflict (slug) do nothing;
insert into public.suppliers (slug, company_name, company_name_norm, city, district, is_published, is_sanctioned, employees_total, facility_of)
select v.slug, v.slug, v.slug, 'Dhaka', 'Dhaka', false, false, v.n, p.id
  from (values ('ci-w-parent-unit', 'ci-w-parent', 300), ('ci-w-group-unit', 'ci-w-group', 1000),
               ('ci-w-two-a', 'ci-w-two', 400), ('ci-w-two-b', 'ci-w-two', 500)) v(slug, parent, n)
  join public.suppliers p on p.slug = v.parent
on conflict (slug) do nothing;
insert into public.rsc_remediation (supplier_id, workers_count, active)
select s.id, v.n, true
  from (values ('ci-w-alone', 500), ('ci-w-parent-unit', 907), ('ci-w-two-a', 410), ('ci-w-two-b', 520)) v(slug, n)
  join public.suppliers s on s.slug = v.slug
on conflict do nothing;

do $$
declare
  b jsonb;
  k text;
  want jsonb := jsonb_build_object(
    'ci-w-alone',  jsonb_build_object('value', 500,  'source', 'RSC',      'sites', 1, 'includes_root', true),
    'ci-w-parent', jsonb_build_object('value', 907,  'source', 'RSC',      'sites', 1, 'includes_root', false),
    'ci-w-group',  jsonb_build_object('value', 3000, 'source', 'registry', 'sites', 2, 'includes_root', true),
    -- Two RSC buildings, and a parent with no RSC row of its own: summed
    -- over two sites, none of them this record.
    'ci-w-two',    jsonb_build_object('value', 930,  'source', 'RSC',      'sites', 2, 'includes_root', false)
  );
  got jsonb;
begin
  select public.production_workers_display_batch(array_agg(id)) into b
    from public.suppliers where slug in ('ci-w-alone', 'ci-w-parent', 'ci-w-group', 'ci-w-two');
  for k in select jsonb_object_keys(want) loop
    select b -> s.id::text into got from public.suppliers s where s.slug = k;
    if got is null
       or got->'value' <> want->k->'value'
       or got->'source' <> want->k->'source'
       or got->'sites' is distinct from want->k->'sites'
       or got->'includes_root' is distinct from want->k->'includes_root' then
      raise exception 'production_workers_display_batch for %: got %, want %', k, got, want->k;
    end if;
  end loop;
end
$$;

-- The Workers sort orders on suppliers.employees_total, the figure the
-- Discover page headlines as the supplier's own. Run, not read: a source-text
-- check of the ORDER BY is satisfied by a comment.
update public.suppliers s
   set employees_total = (array[300, 100, 600, 200, 500, 400])[substring(s.slug from 'ci-sort-([0-9])')::int],
       -- An order of its own, so a key added ahead of the workers key would show.
       completeness_pct = (array[90, 10, 20, 80, 30, 70])[substring(s.slug from 'ci-sort-([0-9])')::int],
       -- The two shared tie-breakers too, each in an order of their own: a key
       -- on either, slipped ahead of the workers key, must change the result
       -- (they tied before, so such a key passed).
       -- Not the rank of employees_total in either direction: [4,6,1,5,2,3]
       -- was, so a source-count key ASCENDING reproduced the workers order.
       t13_source_count = (array[6, 1, 4, 5, 2, 3])[substring(s.slug from 'ci-sort-([0-9])')::int],
       -- And the place columns, which all read Dhaka, so a key on either tied.
       district = (array['Ci D1', 'Ci D2', 'Ci D3', 'Ci D4', 'Ci D5', 'Ci D6'])[substring(s.slug from 'ci-sort-([0-9])')::int],
       city = (array['Ci C6', 'Ci C5', 'Ci C4', 'Ci C3', 'Ci C2', 'Ci C1'])[substring(s.slug from 'ci-sort-([0-9])')::int]
 where s.slug like 'ci-sort-%';
insert into public.sbi_scores (supplier_id, total)
select s.id, (array[60, 40, 10, 50, 20, 30])[substring(s.slug from 'ci-sort-([0-9])')::int]
  from public.suppliers s where s.slug like 'ci-sort-%'
on conflict (supplier_id) do update set total = excluded.total;

-- And a building with a large RSC headcount under ci-sort-2 (own 100), so the
-- profile's figure orders ci-sort-2 first: a sort on that figure instead of
-- the supplier's own could not pass the check below.
insert into public.suppliers (slug, company_name, company_name_norm, city, district, is_published, is_sanctioned, facility_of)
select 'ci-w-sortunit', 'CI W Sortunit', 'ci w sortunit', 'Dhaka', 'Dhaka', false, false, p.id
  from public.suppliers p where p.slug = 'ci-sort-2'
on conflict (slug) do nothing;
insert into public.rsc_remediation (supplier_id, workers_count, active)
select s.id, 5000, true from public.suppliers s where s.slug = 'ci-w-sortunit'
on conflict do nothing;

do $$
declare
  got   text[];
  gotq  text[];
  want  text[];
  disp  text[];
  other text[];
  col   text;
  dir   text;
begin
  select array_agg(s.slug order by (public.production_workers_display_batch(array[s.id]) -> (s.id::text) ->> 'value')::int desc nulls last) into disp
    from public.suppliers s where s.slug like 'ci-sort-%';
  select array_agg(d.slug order by d.ordinality) into got
    from public.discover_suppliers(p_sort => 'workers', p_limit => 100) with ordinality as d
   where d.slug like 'ci-sort-%';
  select array_agg(s.slug order by s.employees_total desc nulls last) into want
    from public.suppliers s where s.slug like 'ci-sort-%';
  if disp is not distinct from want then
    raise exception 'the fixture cannot tell the own figure from the profile figure: both order %', want;
  end if;
  -- Each other column a key could be written on orders the rows differently,
  -- in BOTH directions: a key is as easily written asc as desc, and the
  -- source counts once matched employees_total's rank exactly, so an
  -- ascending source-count key passed while only desc was compared.
  foreach col in array array['s.t13_source_count', 's.completeness_pct', 's.district', 's.city',
                             '(select b.total from public.sbi_scores b where b.supplier_id = s.id)'] loop
    foreach dir in array array['asc', 'desc'] loop
      execute format('select array_agg(s.slug order by %s %s, s.slug) from public.suppliers s where s.slug like %L', col, dir, 'ci-sort-%')
         into other;
      if other is not distinct from want then
        raise exception 'a fixture column (% %) orders the ci-sort rows as employees_total does; a key on it would pass unseen', col, dir;
      end if;
    end loop;
  end loop;
  if (select count(distinct s.t13_source_count) from public.suppliers s where s.slug like 'ci-sort-%') <> 6 then
    raise exception 'the ci-sort source counts tie; a source-count key ahead of workers would pass unseen';
  end if;
  if got is distinct from want then
    raise exception 'the workers sort is not suppliers.employees_total descending: got %, want %', got, want;
  end if;
  -- And the keyword branch, which has its own ORDER BY: every ci-sort name
  -- matches "ci sort", and the sort key precedes relevance.
  select array_agg(d.slug order by d.ordinality) into gotq
    from public.discover_suppliers(p_q => 'ci sort', p_sort => 'workers', p_limit => 100) with ordinality as d
   where d.slug like 'ci-sort-%';
  if coalesce(cardinality(gotq), 0) <> 6 then
    raise exception 'the keyword search found % of the six ci-sort rows; its workers check would be vacuous', coalesce(cardinality(gotq), 0);
  end if;
  if gotq is distinct from want then
    raise exception 'the keyword branch''s workers sort is not suppliers.employees_total descending: got %, want %', gotq, want;
  end if;
end
$$;

-- Oversized filter lists and values are refused by the function itself:
-- anon reaches discover_suppliers through PostgREST, past the app's caps and
-- its rate limiter, and any signed-in account reaches the explain. Every
-- bound, on both functions: one over the limit is refused (22023), and the
-- limit itself answers — so dropping any one from discover_v32_assert_bounded,
-- or tightening one below what the app sends, fails here.
do $$
declare
  fn  text;
  c   record;
  n   int;
begin
  for fn in select unnest(array['discover_suppliers', 'discover_suppliers_explain']) loop
    if fn = 'discover_suppliers' then
      set local role anon;
      perform set_config('request.jwt.claim.role', 'anon', true);
    else
      set local role authenticated;
      perform set_config('request.jwt.claim.role', 'authenticated', true);
      perform set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000d001', true);
    end if;
    n := 0;
    for c in
      select * from (values
        ('p_entity_types', 'array(select ''x'' || g from generate_series(1, 51) g)', 'array(select ''x'' || g from generate_series(1, 50) g)'),
        ('p_cert_kinds',   'array(select ''x'' || g from generate_series(1, 51) g)', 'array(select ''x'' || g from generate_series(1, 50) g)'),
        ('p_registries',   'array(select ''x'' || g from generate_series(1, 51) g)', 'array(select ''x'' || g from generate_series(1, 50) g)'),
        ('p_factory_types','array(select ''x'' || g from generate_series(1, 51) g)', 'array(select ''x'' || g from generate_series(1, 50) g)'),
        ('p_brand_codes',  'array(select ''x'' || g from generate_series(1, 51) g)', 'array(select ''x'' || g from generate_series(1, 50) g)'),
        ('p_hs_codes',     'array(select lpad(g::text, 4, ''0'') from generate_series(1, 51) g)', 'array(select lpad(g::text, 4, ''0'') from generate_series(1, 50) g)'),
        ('p_districts',    'array(select ''x'' || g from generate_series(1, 51) g)', 'array(select ''x'' || g from generate_series(1, 50) g)'),
        ('p_cities',       'array(select ''x'' || g from generate_series(1, 51) g)', 'array(select ''x'' || g from generate_series(1, 50) g)'),
        ('p_districts',    'array[repeat(''x'', 81)]', 'array[repeat(''x'', 80)]'),
        ('p_cities',       'array[repeat(''x'', 81)]', 'array[repeat(''x'', 80)]'),
        ('p_q',            'repeat(''x'', 201)',       'repeat(''x'', 200)'),
        ('p_city',         'repeat(''x'', 81)',        'repeat(''x'', 80)'),
        ('p_district',     'repeat(''x'', 81)',        'repeat(''x'', 80)'),
        ('p_category',     'repeat(''x'', 81)',        'repeat(''x'', 80)')
      ) as t(param, over_limit, at_limit)
    loop
      n := n + 1;
      begin
        execute format('select count(*) from public.%I(%I => %s)', fn, c.param, c.over_limit);
        raise exception '% accepted % = % from %', fn, c.param, c.over_limit, current_user;
      exception when sqlstate '22023' then null;
      end;
      begin
        execute format('select count(*) from public.%I(%I => %s)', fn, c.param, c.at_limit);
      exception when sqlstate '22023' then
        raise exception '% refused % at its limit (%), which the app may send', fn, c.param, c.at_limit;
      end;
    end loop;
    if n <> 14 then
      raise exception 'the bound checks ran % cases, expected 14', n;
    end if;
    reset role;
  end loop;
  perform set_config('request.jwt.claim.role', '', true);
  perform set_config('request.jwt.claim.sub', '', true);
end
$$;

-- The replay is only as strict as production if Supabase's default
-- privileges are emulated: a function created now must be anon-executable
-- until a migration says otherwise. Without this, deleting that bootstrap
-- line would leave every grant check above passing for the wrong reason.
do $$
begin
  create function public.__ci_default_acl_probe() returns int language sql as 'select 1';
  -- Postgres grants EXECUTE to PUBLIC on every new function, and anon is in
  -- PUBLIC — so without this revoke the check passes with or without the
  -- bootstrap's default privileges, and proves nothing.
  revoke execute on function public.__ci_default_acl_probe() from public;
  if not has_function_privilege('anon', 'public.__ci_default_acl_probe()', 'execute') then
    raise exception 'the replay does not emulate Supabase default privileges; the grant checks prove nothing';
  end if;
  drop function public.__ci_default_acl_probe();
  create table public.__ci_default_acl_probe (id int);
  if not has_table_privilege('anon', 'public.__ci_default_acl_probe', 'select') then
    raise exception 'the replay does not emulate Supabase default TABLE privileges';
  end if;
  drop table public.__ci_default_acl_probe;
end
$$;

-- rl_check run as a SIGNED-IN caller, the way middleware calls it. As
-- SECURITY INVOKER it would hit rate_limit_buckets' RLS (no policies) and
-- error — and the app's limiter fails open on any error.
do $$
declare
  env jsonb;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000d001', true);
  env := public.rl_check('api_export', 'ci-signed-in', 6);
  if (env->>'ok')::boolean is distinct from true then
    raise exception 'rl_check did not admit a signed-in first call: %', env;
  end if;
  reset role;
  perform set_config('request.jwt.claim.role', '', true);
  perform set_config('request.jwt.claim.sub', '', true);
end
$$;

-- Founder rule (23 Sep 2026): a signed-out visitor sees every supplier field
-- EXCEPT the company's contact details. discover_suppliers is served to anon
-- by PostgREST directly, so the rule is enforced by what the function RETURNS
-- — checked on its declared result and on a real row fetched as anon.
do $$
declare
  r record;
  keys text[];
  declared int;
begin
  for r in
    select p.oid from pg_proc p
     where p.pronamespace = 'public'::regnamespace and p.proname = 'discover_suppliers'
  loop
    if pg_get_function_result(r.oid) ~* '(email|phone|contact_name|contact_role|whatsapp)' then
      raise exception 'discover_suppliers declares a contact column for anon: %', pg_get_function_result(r.oid);
    end if;
  end loop;
  set local role anon;
  perform set_config('request.jwt.claim.role', 'anon', true);
  -- One ROW first, then its keys: with LIMIT on the set-returning
  -- jsonb_object_keys itself, keys held a single key (the shortest, "id")
  -- and the contact check below ran over the word "id" alone.
  select array_agg(k) into keys
    from (select d from public.discover_suppliers() d limit 1) r
   cross join lateral jsonb_object_keys(to_jsonb(r.d)) as k;
  reset role;
  perform set_config('request.jwt.claim.role', '', true);
  if keys is null then
    raise exception 'anon got no discover_suppliers row to inspect';
  end if;
  -- The whole declared row, or the check is looking at less than anon gets.
  select count(*) into declared
    from pg_proc p, unnest(p.proargmodes) as m(mode)
   where p.pronamespace = 'public'::regnamespace and p.proname = 'discover_suppliers'
     and m.mode = 't';
  if declared < 20 or cardinality(keys) <> declared or 'company_name' <> all(keys) then
    raise exception 'the anon row check saw % of % declared columns: %', cardinality(keys), declared, keys;
  end if;
  if exists (select 1 from unnest(keys) k where k ~* '(email|phone|contact_name|contact_role|whatsapp)') then
    raise exception 'a signed-out caller received a contact field: %', keys;
  end if;
end
$$;

rollback;
