"""Dry run of migration 0114 (evidence packs) in ONE transaction that is always rolled back.

Applies `0114_evidence_packs.sql` inside a `do` block, then proves: the text that
ran is the file's; neither the table nor the function existed before; the
function is SECURITY DEFINER, not anon's; the table has RLS on, a select policy and
no write grant; and, for every live buyer with saved suppliers, a full pack builds,
names a source and a check date on every row, and writes exactly one download row
(rolled back with everything else).

    python ops/dry_run_0114_evidence_packs.py --print   # SQL for the Supabase MCP

Output of the 5 Oct 2026 run: `ops/plans/0114-dry-run.md`. Nothing here is `--apply`.
"""
import hashlib
import pathlib
import sys

REPO = pathlib.Path(__file__).resolve().parents[1]
MIG = REPO / "supabase" / "migrations" / "0114_evidence_packs.sql"

text = MIG.read_text(encoding="utf-8").replace("\r\n", "\n")
text = "\n".join(l for l in text.split("\n") if l.strip() and not l.lstrip().startswith("--")) + "\n"
assert "$mig$" not in text and "$dry$" not in text

SQL = f"""do $dry$
declare
  v_mig    text := $mig${text}$mig$;
  v_before jsonb;
  v_ok     boolean := true;
  v_buyers int := 0;
  v_rows   int := 0;
  v_supp   int := 0;
  r        record;
  v_pack   jsonb;
begin
  if md5(v_mig) <> '{hashlib.md5(text.encode("utf-8")).hexdigest()}' then
    raise exception 'the literal is not the file';
  end if;
  v_before := jsonb_build_object(
    'table',    to_regclass('public.evidence_pack_downloads') is not null,
    'function', to_regprocedure('public.evidence_pack(text[], text)') is not null);
  execute v_mig;
  for r in select distinct ss.owner_id from public.saved_suppliers ss loop
    perform set_config('request.jwt.claims', jsonb_build_object('sub', r.owner_id, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', r.owner_id::text, true);
    v_pack := public.evidence_pack(array['cert_expiry', 'uflpa', 'sources'], 'csv');
    if exists (select 1 from jsonb_array_elements(v_pack->'rows') e
                where e->>'source' is null or e->>'checked_on' is null)
       or (select count(*) from public.evidence_pack_downloads d where d.owner_id = r.owner_id) <> 1 then
      v_ok := false;
    end if;
    v_buyers := v_buyers + 1;
    v_rows := v_rows + (v_pack->>'row_count')::int;
    v_supp := v_supp + (v_pack->>'supplier_count')::int;
  end loop;
  raise exception 'DRYRUN_RESULT %', jsonb_build_object(
    'existed_before',   v_before,
    'definer',          (select prosecdef from pg_proc where oid = 'public.evidence_pack(text[], text)'::regprocedure),
    'anon_can_execute', has_function_privilege('anon', 'public.evidence_pack(text[], text)', 'execute'),
    'auth_can_execute', has_function_privilege('authenticated', 'public.evidence_pack(text[], text)', 'execute'),
    'rls_on',           (select relrowsecurity from pg_class where oid = 'public.evidence_pack_downloads'::regclass),
    'write_grants',     (select count(*) from information_schema.role_table_grants where table_schema = 'public'
                          and table_name = 'evidence_pack_downloads' and grantee in ('anon', 'authenticated')
                          and privilege_type <> 'SELECT'),
    'buyers_with_saved', v_buyers,
    'suppliers_in_packs', v_supp,
    'rows_in_packs',     v_rows,
    'every_row_sourced_and_logged_once', v_ok);
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
