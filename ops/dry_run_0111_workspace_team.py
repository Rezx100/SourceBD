"""Dry run of migration 0111 (Team and roles) in ONE transaction that is always rolled back.

Applies `0111_workspace_team.sql` inside a `do` block, then proves:

  * the text that ran is the file's (md5 of the literal);
  * none of its tables, column or functions existed before it;
  * after it: both tables have RLS on and no grant for anon or authenticated;
    every RPC is SECURITY DEFINER with `search_path = public`, executable by
    `authenticated` and NOT by `anon`; the owner guard by neither;
  * no existing profile changed (last_active_at is null on every row);
  * for up to five live buyers, workspace_team() read as that buyer says
    they own a team of one with no invites.

The block ends by raising `DRYRUN_RESULT {...}`, which rolls everything back.
Nothing is committed, and nothing here is `--apply` (AGENTS rule 15).

    python ops/dry_run_0111_workspace_team.py           # runs it (SUPABASE_DB_URL in .env)
    python ops/dry_run_0111_workspace_team.py --print   # prints the SQL, for the SQL editor or the Supabase MCP

Output of the 5 Oct 2026 run: `ops/plans/0111-dry-run.md`.
"""
import hashlib
import pathlib
import sys

REPO = pathlib.Path(__file__).resolve().parents[1]
MIG = REPO / "supabase" / "migrations" / "0111_workspace_team.sql"

text = MIG.read_text(encoding="utf-8").replace("\r\n", "\n")
# Whole-line comments and blank lines out: the SQL that runs is the same, and
# the literal is short enough to paste into the Supabase MCP. The md5 below is
# over this text.
text = "\n".join(l for l in text.split("\n") if l.strip() and not l.lstrip().startswith("--")) + "\n"
assert "$mig$" not in text and "$dry$" not in text

FUNCS = [
    "public.profile_touch()",
    "public.workspace_team()",
    "public.workspace_invite(text[], text)",
    "public.workspace_invite_resend(uuid)",
    "public.workspace_invite_cancel(uuid)",
    "public.workspace_invite_accept(text)",
    "public.workspace_member_set_role(uuid, text)",
    "public.workspace_member_remove(uuid)",
]
funcs_sql = "array[" + ", ".join(f"'{f}'" for f in FUNCS) + "]"

SQL = f"""do $dry$
declare
  v_mig    text := $mig${text}$mig$;
  v_fn     text;
  v_before jsonb;
  v_fns    jsonb := '[]'::jsonb;
  v_teams  jsonb := '[]'::jsonb;
  r        record;
  v_team   jsonb;
begin
  if md5(v_mig) <> '{hashlib.md5(text.encode("utf-8")).hexdigest()}' then
    raise exception 'the literal is not the file';
  end if;

  v_before := jsonb_build_object(
    'workspace_members', to_regclass('public.workspace_members') is not null,
    'workspace_invites', to_regclass('public.workspace_invites') is not null,
    'last_active_at',    exists (select 1 from information_schema.columns
                                  where table_schema = 'public' and table_name = 'profiles'
                                    and column_name = 'last_active_at'),
    'any_function',      exists (select 1 from unnest({funcs_sql}) f where to_regprocedure(f) is not null));

  execute v_mig;

  foreach v_fn in array {funcs_sql} loop
    v_fns := v_fns || jsonb_build_object(
      'fn', v_fn,
      'definer', (select prosecdef from pg_proc where oid = v_fn::regprocedure),
      'search_path', (select proconfig from pg_proc where oid = v_fn::regprocedure),
      'anon', has_function_privilege('anon', v_fn, 'execute'),
      'authenticated', has_function_privilege('authenticated', v_fn, 'execute'));
  end loop;

  for r in select p.id from public.profiles p where p.role = 'buyer' order by p.created_at limit 5 loop
    perform set_config('request.jwt.claims', jsonb_build_object('sub', r.id, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', r.id::text, true);
    v_team := public.workspace_team();
    v_teams := v_teams || jsonb_build_object(
      'buyer', left(r.id::text, 8),
      'as_expected', v_team->>'my_role' = 'owner'
                     and jsonb_array_length(v_team->'members') = 1
                     and jsonb_array_length(v_team->'invites') = 0);
  end loop;

  raise exception 'DRYRUN_RESULT %', jsonb_pretty(jsonb_build_object(
    'existed_before',            v_before,
    'rls_on',                    (select bool_and(relrowsecurity) from pg_class
                                   where oid in ('public.workspace_members'::regclass, 'public.workspace_invites'::regclass)),
    'table_grants_anon_or_auth', (select count(*) from information_schema.role_table_grants
                                   where table_schema = 'public'
                                     and table_name in ('workspace_members', 'workspace_invites')
                                     and grantee in ('anon', 'authenticated')),
    'functions_ok',              not exists (select 1 from jsonb_array_elements(v_fns) e
                                   where not (e->>'definer')::boolean
                                      or e->'search_path' <> '["search_path=public"]'::jsonb
                                      or (e->>'anon')::boolean
                                      or not (e->>'authenticated')::boolean),
    'guard_callable_by_auth',    has_function_privilege('authenticated', 'public._workspace_require_owner()', 'execute'),
    'profiles',                  (select count(*) from public.profiles),
    'profiles_stamped',          (select count(*) from public.profiles where last_active_at is not null),
    'buyers_read',               jsonb_array_length(v_teams),
    'teams_as_expected',         not exists (select 1 from jsonb_array_elements(v_teams) e where not (e->>'as_expected')::boolean),
    'functions',                 v_fns));
end
$dry$;
"""

if "--print" in sys.argv:
    # UTF-8 and LF whatever the console: the md5 check is over the file's text.
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
