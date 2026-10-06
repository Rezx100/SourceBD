"""Dry run of migration 0129 in ONE transaction that is always rolled back.

Applies `0129_claims_admin_any_stage.sql` inside a `do` block, then proves:

  * the text that ran is the file's (md5 of the literal);
  * BEFORE it: the claims by status, and how many `pending_email` claims have a link that has
    already expired, which is the likeliest reason the three stuck ones are stuck (the status
    flips to `expired` only when someone clicks after the 24 hours);
  * whether any email_log row references a claim (none expected: the old sender did not journal);
  * AFTER it: the three functions are SECURITY DEFINER, executable by `authenticated` and not by
    `anon`; rl_check knows `email:claim_verify`; the admin list for `open` returns every
    pending_email and email_verified claim with `link_expired` set; no row changed.

The block ends by raising `DRYRUN_RESULT {...}`, which rolls everything back. Nothing is
committed, and nothing here is `--apply` (AGENTS rule 15).

    python ops/dry_run_0129_claims.py           # runs it (SUPABASE_DB_URL in .env)
    python ops/dry_run_0129_claims.py --print   # prints the SQL, for the SQL editor or the Supabase MCP

Output of the run: `ops/plans/0129-dry-run.md`.
"""
import hashlib
import pathlib
import sys

REPO = pathlib.Path(__file__).resolve().parents[1]
MIG = REPO / "supabase" / "migrations" / "0129_claims_admin_any_stage.sql"

text = MIG.read_text(encoding="utf-8")
assert "$mig$" not in text and "$dry$" not in text

SQL = f"""do $dry$
declare
  v_mig      text := $mig${text}$mig$;
  v_admin    uuid;
  v_by_status jsonb;
  v_expired  int;
  v_journal  int;
  v_rows_b   bigint;
  v_rows_a   bigint;
  v_open     jsonb;
  f          text;
  v_fns      jsonb := '{{}}'::jsonb;
begin
  if md5(v_mig) <> '{hashlib.md5(text.encode("utf-8")).hexdigest()}' then
    raise exception 'the literal is not the file';
  end if;

  select jsonb_object_agg(status, n) into v_by_status
    from (select status::text, count(*) n from public.claim_requests group by 1) x;
  select count(*) into v_expired from public.claim_requests
   where status = 'pending_email' and token_expires_at is not null and token_expires_at < now();
  select count(*) into v_journal from public.email_log e
   where exists (select 1 from public.claim_requests c where c.id::text = e.ref_id);
  select count(*) into v_rows_b from public.claim_requests;

  execute v_mig;

  foreach f in array array['public.claim_admin_list(text)', 'public.claim_admin_decide(uuid, boolean, text)', 'public.claim_admin_resend(uuid)'] loop
    v_fns := v_fns || jsonb_build_object(f, jsonb_build_object(
      'security_definer', (select prosecdef from pg_proc where oid = f::regprocedure),
      'search_path',      (select proconfig from pg_proc where oid = f::regprocedure),
      'anon',             has_function_privilege('anon', f::regprocedure, 'execute'),
      'authenticated',    has_function_privilege('authenticated', f::regprocedure, 'execute')));
  end loop;

  select p.id into v_admin from public.profiles p
   where p.role = 'admin' and coalesce(p.is_suspended, false) = false order by p.created_at limit 1;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  select jsonb_build_object(
           'total', d->>'total',
           'link_expired', (select count(*) from jsonb_array_elements(d->'results') r where (r->>'link_expired')::boolean),
           'with_claimant_id', (select count(*) from jsonb_array_elements(d->'results') r where r->>'claimant_user_id' is not null),
           'with_email_journal', (select count(*) from jsonb_array_elements(d->'results') r where r->'email' is not null and r->'email' <> 'null'::jsonb))
    into v_open
    from (select public.claim_admin_list('open') d) x;
  select count(*) into v_rows_a from public.claim_requests;

  raise exception 'DRYRUN_RESULT %', jsonb_pretty(jsonb_build_object(
    'claims_by_status_before',             v_by_status,
    'pending_email_with_expired_link',     v_expired,
    'email_journal_rows_for_any_claim',    v_journal,
    'functions_after',                     v_fns,
    'rl_check_knows_claim_verify',         position('''email:claim_verify''' in pg_get_functiondef('public.rl_check(text, text, integer)'::regprocedure)) > 0,
    'open_list_after',                     v_open,
    'rows_unchanged',                      v_rows_b = v_rows_a));
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
