-- The ten working copies after 0118, asserted by running it: two of them are created here (the replay has none),
-- open to `anon` the way production's were, then the migration file runs again over them. After it: row-level
-- security is on, `anon` and `authenticated` hold no right, `service_role` keeps its own. And for the whole schema:
-- no table in `public` is left without row-level security, so a table added by a later migration with RLS off
-- fails here, not in production.
\set ON_ERROR_STOP on

begin;

create table public._snapshot_20260814_queue_release_suppliers (id uuid, note text);
create table public._tmp_20260814_needs_human_hold (id uuid);
insert into public._tmp_20260814_needs_human_hold (id) values ('00000000-0000-4000-8000-0000000c1181');

do $$
begin
  if not has_table_privilege('anon', 'public._tmp_20260814_needs_human_hold', 'select')
     or not has_table_privilege('anon', 'public._snapshot_20260814_queue_release_suppliers', 'truncate') then
    raise exception 'the probe tables did not start open to anon, so the lock proves nothing';
  end if;
end
$$;

\ir ../migrations/0118_lock_working_copies.sql

do $$
declare
  t text;
  p text;
begin
  foreach t in array array['_snapshot_20260814_queue_release_suppliers', '_tmp_20260814_needs_human_hold']
  loop
    if not (select relrowsecurity from pg_class where oid = format('public.%I', t)::regclass) then
      raise exception '% still has row-level security off', t;
    end if;
    foreach p in array array['select', 'insert', 'update', 'delete', 'truncate', 'references', 'trigger']
    loop
      if has_table_privilege('anon', format('public.%I', t), p) or has_table_privilege('authenticated', format('public.%I', t), p) then
        raise exception '% still grants % to anon or authenticated', t, p;
      end if;
    end loop;
    if not has_table_privilege('service_role', format('public.%I', t), 'select') then
      raise exception '% lost the service role''s read', t;
    end if;
  end loop;

  -- Run twice, nothing breaks (idempotent).
  if (select count(*) from public._tmp_20260814_needs_human_hold) <> 1 then
    raise exception 'the lock changed a row';
  end if;

  -- The schema-wide guard.
  if exists (select 1 from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p') and not c.relrowsecurity) then
    raise exception 'public tables with row-level security off: %',
      (select string_agg(c.relname, ', ' order by c.relname) from pg_class c
        where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p') and not c.relrowsecurity);
  end if;
end
$$;

\ir ../migrations/0118_lock_working_copies.sql

rollback;
