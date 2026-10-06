"""Time the review queue's "All open" read on production, READ-ONLY (moderation plan item 0d).

Prints (or runs) one `do` block that, as the first active admin:

  1. times `admin_queue_list(null, 'open', 50, 0)` exactly as /admin/queue calls it;
  2. times `admin_queue_release_plan(id)` for each of the newest 50 open rows on its own;
  3. raises `TIMING_RESULT {...}`: open rows, the list's ms, the plans' total, the ten slowest
     plans and the totals by queue type. Everything rolls back; nothing is written, and the
     functions themselves read only (0102; after 0128 the list keeps the plan it worked out,
     and that write rolls back here too).

Run it BEFORE 0128 is applied for the numbers the founder asked for, and again AFTER, when
the list should cost at most ten plans on the first load and none on the second.

    python ops/time_admin_queue_list.py           # runs it (SUPABASE_DB_URL in .env)
    python ops/time_admin_queue_list.py --print   # prints the SQL, for the SQL editor or the Supabase MCP

If the list itself hits the statement timeout, that IS the finding: the editor reports
"canceling statement due to statement timeout" and the per-row figures still print when run as
the second half alone (copy the `for r in ...` loop into its own block).
"""
import sys

SQL = """do $t$
declare
  v_admin   uuid;
  t0        timestamptz;
  v_list_ms numeric;
  v_list_err text;
  v_plans   jsonb := '[]'::jsonb;
  v_ms      numeric;
  v_n       int;
  r         record;
begin
  select p.id into v_admin
    from public.profiles p
   where p.role = 'admin' and coalesce(p.is_suspended, false) = false
   order by p.created_at
   limit 1;
  if v_admin is null then
    raise exception 'no active admin to read as';
  end if;
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_admin, 'role', 'authenticated')::text, true);

  -- 1. The list as the page calls it.
  t0 := clock_timestamp();
  begin
    perform public.admin_queue_list(null, 'open', 50, 0);
    v_list_ms := extract(epoch from clock_timestamp() - t0) * 1000;
  exception when others then
    v_list_ms := extract(epoch from clock_timestamp() - t0) * 1000;
    v_list_err := sqlerrm;
  end;

  -- 2. Each open row's plan on its own, newest 50.
  for r in
    select q.id, q.queue_type::text as queue_type, q.source_data->>'rule' as rule
      from public.verification_queue q
     where q.reviewed_at is null
     order by q.created_at desc
     limit 50
  loop
    t0 := clock_timestamp();
    perform public.admin_queue_release_plan(r.id);
    v_ms := extract(epoch from clock_timestamp() - t0) * 1000;
    v_plans := v_plans || jsonb_build_object('queue_id', left(r.id::text, 8), 'queue_type', r.queue_type, 'rule', r.rule, 'ms', round(v_ms));
  end loop;

  select count(*) into v_n from public.verification_queue where reviewed_at is null;

  raise exception 'TIMING_RESULT %', jsonb_pretty(jsonb_build_object(
    'open_rows',                  v_n,
    'admin_queue_list_open_50_ms', round(v_list_ms),
    'admin_queue_list_error',     v_list_err,
    'plan_total_ms_newest_50',    (select round(coalesce(sum((e->>'ms')::numeric), 0)) from jsonb_array_elements(v_plans) e),
    'plan_slowest_10',            (select coalesce(jsonb_agg(e), '[]'::jsonb) from (
                                     select e from jsonb_array_elements(v_plans) e
                                     order by (e->>'ms')::numeric desc limit 10) x),
    'plan_by_type',               (select coalesce(jsonb_object_agg(k, v), '{}'::jsonb) from (
                                     select e->>'queue_type' as k,
                                            jsonb_build_object('rows', count(*),
                                                               'total_ms', round(sum((e->>'ms')::numeric)),
                                                               'max_ms', round(max((e->>'ms')::numeric))) as v
                                       from jsonb_array_elements(v_plans) e
                                      group by 1) y)));
end
$t$;
"""

if "--print" in sys.argv:
    sys.stdout.reconfigure(encoding="utf-8", newline="\n")
    print(SQL)
    sys.exit(0)

import pathlib  # noqa: E402

import psycopg  # noqa: E402

REPO = pathlib.Path(__file__).resolve().parents[1]
env = (REPO / ".env").read_text(encoding="utf-8", errors="replace")
dsn = next(line.split("=", 1)[1].strip().strip('"').strip("'") for line in env.splitlines() if line.startswith("SUPABASE_DB_URL="))
with psycopg.connect(dsn, connect_timeout=20) as conn:
    try:
        conn.execute(SQL)
    except psycopg.errors.RaiseException as e:
        msg = str(e)
        if "TIMING_RESULT" not in msg:
            raise
        print(msg.split("TIMING_RESULT", 1)[1].split("CONTEXT:", 1)[0].strip())
        print("rolled back: nothing written")
