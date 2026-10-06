"""Dry run of migration 0113 (saved-search alerts and the last search) in ONE
transaction that is always rolled back.

Applies `0113_saved_search_alerts.sql` inside a `do` block, then proves: the text
that ran is the file's; none of its columns, table or functions existed before;
no saved search has the switch on afterwards (so nobody is emailed); the job's
three calls are service_role's only and the buyer's two are not anon's; the new
table has RLS on and no grant; for every buyer with settings, buyer_last_search()
runs and is null.

    python ops/dry_run_0113_saved_search_alerts.py --print   # SQL for the Supabase MCP

Output of the 5 Oct 2026 run: `ops/plans/0113-dry-run.md`. Nothing here is `--apply`.
"""
import hashlib
import pathlib
import sys

REPO = pathlib.Path(__file__).resolve().parents[1]
MIG = REPO / "supabase" / "migrations" / "0113_saved_search_alerts.sql"

text = MIG.read_text(encoding="utf-8").replace("\r\n", "\n")
text = "\n".join(l for l in text.split("\n") if l.strip() and not l.lstrip().startswith("--")) + "\n"
assert "$mig$" not in text and "$dry$" not in text

SQL = f"""do $dry$
declare
  v_mig    text := $mig${text}$mig$;
  v_before jsonb;
  v_ok     boolean := true;
  v_seen   int := 0;
  r        record;
begin
  if md5(v_mig) <> '{hashlib.md5(text.encode("utf-8")).hexdigest()}' then
    raise exception 'the literal is not the file';
  end if;
  v_before := jsonb_build_object(
    'alert_weekly',        exists (select 1 from information_schema.columns where table_schema = 'public'
                                    and table_name = 'saved_searches' and column_name = 'alert_weekly'),
    'last_search_state',   exists (select 1 from information_schema.columns where table_schema = 'public'
                                    and table_name = 'buyer_settings' and column_name = 'last_search_state'),
    'saved_search_alerts', to_regclass('public.saved_search_alerts') is not null,
    'functions',           to_regprocedure('public.saved_search_alerts_due(int)') is not null
                           or to_regprocedure('public.buyer_last_search()') is not null,
    'saved_searches',      (select count(*) from public.saved_searches),
    'buyer_settings',      (select count(*) from public.buyer_settings));
  execute v_mig;
  for r in select bs.owner_id from public.buyer_settings bs loop
    perform set_config('request.jwt.claims', jsonb_build_object('sub', r.owner_id, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', r.owner_id::text, true);
    if public.buyer_last_search() is not null then v_ok := false; end if;
    v_seen := v_seen + 1;
  end loop;
  raise exception 'DRYRUN_RESULT %', jsonb_build_object(
    'existed_before',      v_before,
    'switched_on',         (select count(*) from public.saved_searches where alert_weekly),
    'due',                 (select count(*) from public.saved_search_alerts_due(1000)),
    'alerts_rls_on',       (select relrowsecurity from pg_class where oid = 'public.saved_search_alerts'::regclass),
    'alerts_grants',       (select count(*) from information_schema.role_table_grants where table_schema = 'public'
                             and table_name = 'saved_search_alerts' and grantee in ('anon', 'authenticated')),
    'job_service_only',    not exists (select 1 from unnest(array['public.saved_search_alerts_due(int)',
                             'public.saved_search_alert_new(uuid, uuid[])', 'public.saved_search_alert_record(uuid, uuid[], boolean)']) f
                             where has_function_privilege('anon', f, 'execute')
                                or has_function_privilege('authenticated', f, 'execute')
                                or not has_function_privilege('service_role', f, 'execute')),
    'buyer_calls_not_anon', not has_function_privilege('anon', 'public.buyer_last_search_set(jsonb)', 'execute')
                            and not has_function_privilege('anon', 'public.buyer_last_search()', 'execute')
                            and has_function_privilege('authenticated', 'public.buyer_last_search()', 'execute'),
    'buyers_read',         v_seen,
    'last_search_all_null', v_ok);
end
$dry$;
"""

if "--print" in sys.argv:
    sys.stdout.reconfigure(encoding="utf-8", newline="\n")
    print(SQL)
    sys.exit(0)

import psycopg  # noqa: E402

env = (REPO / ".env").read_text(encoding="utf-8", errors="replace")
dsn = next(line.split("=", 1)[1].strip().strip('"').strip("'") for line in env.splitlines() if line.startswith("SUPABASE_DB_URL="))
with psycopg.connect(dsn, connect_timeout=20) as conn:
    try:
        conn.execute(SQL)
    except psycopg.errors.RaiseException as e:
        msg = str(e)
        if "DRYRUN_RESULT" not in msg:
            raise
        print(msg.split("DRYRUN_RESULT", 1)[1].split("CONTEXT:", 1)[0].strip())
        print("rolled back: nothing committed")
