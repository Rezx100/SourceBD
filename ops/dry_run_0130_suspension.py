"""Dry run of migration 0130 in ONE transaction that is always rolled back.

Applies `0130_suspension_enforced_in_database.sql` inside a `do` block, then proves:

  * the text that ran is the file's (md5 of the literal);
  * BEFORE it: how many accounts are suspended today, and how many live auth.sessions those
    accounts still hold (each one is a session that could call the database directly: the gap);
  * AFTER it: the eight triggers exist, the two helpers are not executable by anon or
    authenticated, and `_account_can_act` raises 42501 for every suspended account and for no
    active one; no row changed.

The suspended accounts' sessions are NOT ended by this dry run (nothing is committed). Applying
the migration does not end them either: the trigger fires on the NEXT suspension. For the
accounts already suspended, `ops/plans/0130-dry-run.md` gives the one statement to run.

    python ops/dry_run_0130_suspension.py           # runs it (SUPABASE_DB_URL in .env)
    python ops/dry_run_0130_suspension.py --print   # prints the SQL, for the SQL editor or the Supabase MCP

Output of the run: `ops/plans/0130-dry-run.md`.
"""
import hashlib
import pathlib
import sys

REPO = pathlib.Path(__file__).resolve().parents[1]
MIG = REPO / "supabase" / "migrations" / "0130_suspension_enforced_in_database.sql"

text = MIG.read_text(encoding="utf-8")
assert "$mig$" not in text and "$dry$" not in text

SQL = f"""do $dry$
declare
  v_mig       text := $mig${text}$mig$;
  v_suspended int;
  v_sessions  int;
  v_rows_b    bigint;
  v_rows_a    bigint;
  v_triggers  jsonb;
  v_refused   int := 0;
  v_allowed   int := 0;
  r           record;
begin
  if md5(v_mig) <> '{hashlib.md5(text.encode("utf-8")).hexdigest()}' then
    raise exception 'the literal is not the file';
  end if;

  select count(*) into v_suspended from public.profiles where coalesce(is_suspended, false);
  select count(*) into v_sessions from auth.sessions s
   where s.user_id in (select id from public.profiles where coalesce(is_suspended, false))
     and (s.not_after is null or s.not_after > now());
  select count(*) into v_rows_b from public.profiles;

  execute v_mig;

  select jsonb_object_agg(c.relname, t.tgname) into v_triggers
    from pg_trigger t join pg_class c on c.oid = t.tgrelid
   where t.tgname like 'trg_%_refuse_suspended' or t.tgname = 'trg_profiles_end_sessions_on_suspend';

  for r in select id, coalesce(is_suspended, false) as suspended from public.profiles loop
    begin
      perform public._account_can_act(r.id);
      if r.suspended then raise exception 'a suspended account passed the check: %', r.id; end if;
      v_allowed := v_allowed + 1;
    exception when sqlstate '42501' then
      if not r.suspended then raise exception 'an active account was refused: %', r.id; end if;
      v_refused := v_refused + 1;
    end;
  end loop;
  select count(*) into v_rows_a from public.profiles;

  raise exception 'DRYRUN_RESULT %', jsonb_pretty(jsonb_build_object(
    'suspended_accounts_today',          v_suspended,
    'live_sessions_of_suspended_today',  v_sessions,
    'triggers_after',                    v_triggers,
    'helper_callable_by_anon',           has_function_privilege('anon', 'public._account_can_act(uuid)', 'execute'),
    'helper_callable_by_authenticated',  has_function_privilege('authenticated', 'public._account_can_act(uuid)', 'execute'),
    'accounts_refused_by_check',         v_refused,
    'accounts_allowed_by_check',         v_allowed,
    'rows_unchanged',                    v_rows_b = v_rows_a));
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
