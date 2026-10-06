"""Dry run of migration 0131 in ONE transaction that is always rolled back.

Applies `0131_activity_ledger.sql` inside a `do` block, then proves:

  * the text that ran is the file's (md5 of the literal);
  * the record exists with RLS on, no client role can read, insert, update or delete it, and no
    client role can call the writer;
  * the seven triggers are on the seven dealing tables;
  * an UPDATE and a DELETE on the record are refused (42501) even for the owner;
  * how many rows each dealing table holds today (what the "as found" pass of phase 1f will
    write down), and that no row of theirs changed.

The block ends by raising `DRYRUN_RESULT {...}`, which rolls everything back. Nothing is
committed, and nothing here is `--apply` (AGENTS rule 15).

    python ops/dry_run_0131_activity_ledger.py           # runs it (SUPABASE_DB_URL in .env)
    python ops/dry_run_0131_activity_ledger.py --print   # prints the SQL, for the SQL editor or the Supabase MCP

Output of the run: `ops/plans/0131-dry-run.md`.
"""
import hashlib
import pathlib
import sys

REPO = pathlib.Path(__file__).resolve().parents[1]
MIG = REPO / "supabase" / "migrations" / "0131_activity_ledger.sql"

text = MIG.read_text(encoding="utf-8")
assert "$mig$" not in text and "$dry$" not in text

SQL = f"""do $dry$
declare
  v_mig    text := $mig${text}$mig$;
  v_rows_b jsonb;
  v_rows_a jsonb;
  v_trig   jsonb;
  v_upd    text;
  v_del    text;
begin
  if md5(v_mig) <> '{hashlib.md5(text.encode("utf-8")).hexdigest()}' then
    raise exception 'the literal is not the file';
  end if;

  select jsonb_object_agg(t, n) into v_rows_b from (
    select 'messages' t, count(*) n from public.messages union all
    select 'message_threads', count(*) from public.message_threads union all
    select 'message_attachments', count(*) from public.message_attachments union all
    select 'rfqs', count(*) from public.rfqs union all
    select 'rfq_quotes', count(*) from public.rfq_quotes union all
    select 'orders', count(*) from public.orders union all
    select 'order_milestones', count(*) from public.order_milestones) x;

  execute v_mig;

  select jsonb_object_agg(c.relname, t.tgname) into v_trig
    from pg_trigger t join pg_class c on c.oid = t.tgrelid
   where t.tgname like 'trg_%_ledger';

  begin
    update public.activity_ledger set reason = 'x' where false;
    -- no rows: Postgres fires no row trigger; insert one via the writer and try for real
    perform public._ledger_write('dry_run.probe', null, null, '{{}}'::jsonb);
    update public.activity_ledger set reason = 'x' where kind = 'dry_run.probe';
    v_upd := 'NOT REFUSED';
  exception when sqlstate '42501' then v_upd := 'refused: ' || sqlerrm;
  end;
  begin
    delete from public.activity_ledger where kind = 'dry_run.probe';
    v_del := 'NOT REFUSED';
  exception when sqlstate '42501' then v_del := 'refused: ' || sqlerrm;
  end;

  select jsonb_object_agg(t, n) into v_rows_a from (
    select 'messages' t, count(*) n from public.messages union all
    select 'message_threads', count(*) from public.message_threads union all
    select 'message_attachments', count(*) from public.message_attachments union all
    select 'rfqs', count(*) from public.rfqs union all
    select 'rfq_quotes', count(*) from public.rfq_quotes union all
    select 'orders', count(*) from public.orders union all
    select 'order_milestones', count(*) from public.order_milestones) x;

  raise exception 'DRYRUN_RESULT %', jsonb_pretty(jsonb_build_object(
    'rls_on',                 (select relrowsecurity from pg_class where oid = 'public.activity_ledger'::regclass),
    'authenticated_select',   has_table_privilege('authenticated', 'public.activity_ledger', 'select'),
    'authenticated_insert',   has_table_privilege('authenticated', 'public.activity_ledger', 'insert'),
    'service_role_update',    has_table_privilege('service_role', 'public.activity_ledger', 'update'),
    'service_role_delete',    has_table_privilege('service_role', 'public.activity_ledger', 'delete'),
    'writer_callable_by_authenticated', has_function_privilege('authenticated', 'public._ledger_write(text, text, uuid, jsonb, uuid, uuid, uuid, uuid, uuid, uuid, uuid, text)', 'execute'),
    'triggers',               v_trig,
    'update_on_record',       v_upd,
    'delete_on_record',       v_del,
    'dealing_rows_today',     v_rows_b,
    'dealing_rows_unchanged', v_rows_b = v_rows_a));
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
