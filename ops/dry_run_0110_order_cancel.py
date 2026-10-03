"""Dry run of migration 0110 in ONE transaction that is always rolled back.

Applies `0110_order_cancel_before_shipping.sql` inside a `do` block, then proves:

  * the text that ran is the file's (md5 of the literal);
  * the live order_cancel was 0029's text before it (md5 fe955411…, 4 Oct);
  * after it: still SECURITY DEFINER with `search_path = public`, executable
    by `authenticated` and NOT by `anon`;
  * for every live order, as its own buyer: shipped, in-transit, delivered and
    cancelled ones are refused with their status unchanged, drafts and
    in-production ones cancel (inside the rolled-back transaction only).

The block ends by raising `DRYRUN_RESULT {...}`, which rolls everything back.
Nothing is committed, and nothing here is `--apply` (AGENTS rule 15).

    python ops/dry_run_0110_order_cancel.py           # runs it (SUPABASE_DB_URL in .env)
    python ops/dry_run_0110_order_cancel.py --print   # prints the SQL, for the SQL editor or the Supabase MCP

Output of the 4 Oct 2026 run: `ops/plans/0110-dry-run.md`.
"""
import hashlib
import pathlib
import sys

REPO = pathlib.Path(__file__).resolve().parents[1]
MIG = REPO / "supabase" / "migrations" / "0110_order_cancel_before_shipping.sql"
LIVE_BEFORE = "fe955411148cbc17ee336461aa328fcd"

text = MIG.read_text(encoding="utf-8")
assert "$mig$" not in text and "$dry$" not in text

SQL = f"""do $dry$
declare
  v_mig    text := $mig${text}$mig$;
  v_fn     regprocedure := 'public.order_cancel(uuid)'::regprocedure;
  v_before text;
  r        record;
  v_hit    text;
  v_after  text;
  v_rows   jsonb := '[]'::jsonb;
begin
  if md5(v_mig) <> '{hashlib.md5(text.encode("utf-8")).hexdigest()}' then
    raise exception 'the literal is not the file';
  end if;
  v_before := md5(pg_get_functiondef(v_fn));

  execute v_mig;

  for r in select id, buyer_id, status::text as status from public.orders order by created_at loop
    perform set_config('request.jwt.claims', jsonb_build_object('sub', r.buyer_id, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', r.buyer_id::text, true);
    v_hit := null;
    begin
      perform public.order_cancel(r.id);
    exception when raise_exception then
      v_hit := sqlerrm;
    end;
    select status::text into v_after from public.orders where id = r.id;
    v_rows := v_rows || jsonb_build_object(
      'order', left(r.id::text, 8), 'was', r.status, 'now', v_after, 'refused', v_hit,
      'as_expected', case when r.status in ('draft', 'in_production')
                          then v_hit is null and v_after = 'cancelled'
                          else v_hit is not null and v_after = r.status end);
  end loop;

  raise exception 'DRYRUN_RESULT %', jsonb_pretty(jsonb_build_object(
    'live_was_0029',             v_before = '{LIVE_BEFORE}',
    'security_definer',          (select prosecdef from pg_proc where oid = v_fn),
    'search_path',               (select proconfig from pg_proc where oid = v_fn),
    'anon_can_execute',          has_function_privilege('anon', v_fn, 'execute'),
    'authenticated_can_execute', has_function_privilege('authenticated', v_fn, 'execute'),
    'orders',                    jsonb_array_length(v_rows),
    'all_as_expected',           not exists (select 1 from jsonb_array_elements(v_rows) e where not (e->>'as_expected')::boolean),
    'rows',                      v_rows));
end
$dry$;
"""

if "--print" in sys.argv:
    # UTF-8 and LF whatever the console: the md5 check is over the file's bytes.
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
