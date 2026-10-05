"""Dry run of migration 0112 (Messages: unread, read ticks, last line, files) in ONE
transaction that is always rolled back.

Applies `0112_messages_unread_files.sql` inside a `do` block, then proves:

  * the text that ran is the file's (md5 of the literal, comments stripped);
  * none of its column, table, bucket or new functions existed before it;
  * how many thread_participants rows had no read marker (all of them get now());
  * after it: every new or changed RPC is SECURITY DEFINER, not anon, is authenticated;
    message_attachments has RLS on and no grant; the bucket is private;
  * for every live participant: thread_list() and thread_unread_total() run and
    show nothing unread (the history counts as read), and thread_messages()
    returns the same number of messages as before, none of them "read" wrongly
    for a conversation nobody else has opened.

The block ends by raising `DRYRUN_RESULT {...}`, which rolls everything back.
Nothing is committed, and nothing here is `--apply` (AGENTS rule 15).

    python ops/dry_run_0112_messages_unread_files.py --print   # SQL for the Supabase MCP

Output of the 5 Oct 2026 run: `ops/plans/0112-dry-run.md`.
"""
import hashlib
import pathlib
import sys

REPO = pathlib.Path(__file__).resolve().parents[1]
MIG = REPO / "supabase" / "migrations" / "0112_messages_unread_files.sql"

text = MIG.read_text(encoding="utf-8").replace("\r\n", "\n")
text = "\n".join(l for l in text.split("\n") if l.strip() and not l.lstrip().startswith("--")) + "\n"
assert "$mig$" not in text and "$dry$" not in text

FUNCS = [
    "public.thread_mark_read(uuid)",
    "public.thread_unread_total()",
    "public.thread_list()",
    "public.thread_messages(uuid, int, timestamptz)",
    "public.thread_send_message_files(uuid, text, text[])",
]
funcs_sql = "array[" + ", ".join(f"'{f}'" for f in FUNCS) + "]"

SQL = f"""do $dry$
declare
  v_mig    text := $mig${text}$mig$;
  v_fn     text;
  v_before jsonb;
  v_fns    jsonb := '[]'::jsonb;
  v_ok     boolean := true;
  v_seen   int := 0;
  v_counts jsonb := '{{}}'::jsonb;
  r        record;
  v_list   jsonb;
begin
  if md5(v_mig) <> '{hashlib.md5(text.encode("utf-8")).hexdigest()}' then
    raise exception 'the literal is not the file';
  end if;

  for r in select t.id, (select count(*) from public.messages m where m.thread_id = t.id) as n
             from public.message_threads t loop
    v_counts := v_counts || jsonb_build_object(r.id::text, r.n);
  end loop;

  v_before := jsonb_build_object(
    'last_read_at',        exists (select 1 from information_schema.columns
                                    where table_schema = 'public' and table_name = 'thread_participants'
                                      and column_name = 'last_read_at'),
    'message_attachments', to_regclass('public.message_attachments') is not null,
    'bucket',              exists (select 1 from storage.buckets where id = 'message-files'),
    'new_functions',       to_regprocedure('public.thread_mark_read(uuid)') is not null
                           or to_regprocedure('public.thread_unread_total()') is not null
                           or to_regprocedure('public.thread_send_message_files(uuid, text, text[])') is not null,
    'participants',        (select count(*) from public.thread_participants),
    'threads',             (select count(*) from public.message_threads),
    'messages',            (select count(*) from public.messages));

  execute v_mig;

  foreach v_fn in array {funcs_sql} loop
    v_fns := v_fns || jsonb_build_object(
      'fn', v_fn,
      'definer', (select prosecdef from pg_proc where oid = v_fn::regprocedure),
      'anon', has_function_privilege('anon', v_fn, 'execute'),
      'authenticated', has_function_privilege('authenticated', v_fn, 'execute'));
  end loop;

  for r in select tp.user_id, tp.thread_id from public.thread_participants tp loop
    perform set_config('request.jwt.claims', jsonb_build_object('sub', r.user_id, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', r.user_id::text, true);
    v_list := public.thread_list();
    if public.thread_unread_total() <> 0
       or exists (select 1 from jsonb_array_elements(v_list) e where (e->>'unread_count')::int <> 0)
       or jsonb_array_length(public.thread_messages(r.thread_id, 200, null))
          <> least((v_counts->>r.thread_id::text)::int, 200) then
      v_ok := false;
    end if;
    v_seen := v_seen + 1;
  end loop;

  raise exception 'DRYRUN_RESULT %', jsonb_build_object(
    'existed_before',        v_before,
    'participants_stamped',  (select count(*) from public.thread_participants where last_read_at is not null),
    'attachments_rls_on',    (select relrowsecurity from pg_class where oid = 'public.message_attachments'::regclass),
    'attachments_grants',    (select count(*) from information_schema.role_table_grants
                               where table_schema = 'public' and table_name = 'message_attachments'
                                 and grantee in ('anon', 'authenticated')),
    'bucket_public',         (select public from storage.buckets where id = 'message-files'),
    'storage_policies',      (select count(*) from pg_policies where schemaname = 'storage'
                               and policyname like 'pol_message_files_%'),
    'functions_ok',          not exists (select 1 from jsonb_array_elements(v_fns) e
                               where not (e->>'definer')::boolean or (e->>'anon')::boolean
                                  or not (e->>'authenticated')::boolean),
    'participants_read',     v_seen,
    'reads_as_expected',     v_ok);
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
