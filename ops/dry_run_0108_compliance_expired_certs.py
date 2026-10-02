"""Dry run of migration 0108 in ONE transaction that is always rolled back.

Applies `0108_compliance_expired_certs.sql` inside a `do` block, then proves:

  * the text that ran is the file's (md5 of the literal);
  * `compliance_expired_certs()` is STABLE SECURITY DEFINER with
    `search_path = public`, executable by `authenticated` and NOT by `anon`;
  * `compliance_expiring_certs(int)` and `buyer_dashboard()` are byte-identical
    before and after (0108 must not touch what is live);
  * signed out, it returns nothing;
  * for every buyer with saved suppliers, its count equals an independent
    count ("the certificate's expiry is the latest of its scheme on that
    supplier, and that is in the past"), and every row is in the past.

The block ends by raising `DRYRUN_RESULT {...}`, which rolls everything back.
Nothing is committed, and nothing here is `--apply` (AGENTS rule 15).

    python ops/dry_run_0108_compliance_expired_certs.py           # runs it (SUPABASE_DB_URL in .env)
    python ops/dry_run_0108_compliance_expired_certs.py --print   # prints the SQL, for the SQL editor

Output of the 3 Oct 2026 run: `ops/plans/0108-dry-run.md`.
"""
import hashlib
import pathlib
import sys

REPO = pathlib.Path(__file__).resolve().parents[1]
MIG = REPO / "supabase" / "migrations" / "0108_compliance_expired_certs.sql"

text = MIG.read_text(encoding="utf-8")
assert "$mig$" not in text and "$dry$" not in text

SQL = f"""do $dry$
declare
  v_mig    text := $mig${text}$mig$;
  v_before jsonb;
  v_after  jsonb;
  v_owner  uuid;
  v_got    jsonb;
  v_ref    int;
  v_owners jsonb := '[]'::jsonb;
  v_out    jsonb;
  v_t0     timestamptz;
begin
  if md5(v_mig) <> '{hashlib.md5(text.encode("utf-8")).hexdigest()}' then
    raise exception 'the literal is not the file';
  end if;
  if to_regprocedure('public.compliance_expired_certs()') is not null then
    raise exception 'compliance_expired_certs() already exists';
  end if;

  select jsonb_object_agg(p.oid::regprocedure::text, md5(pg_get_functiondef(p.oid)))
    into v_before
    from pg_proc p
   where p.oid in ('public.compliance_expiring_certs(int)'::regprocedure, 'public.buyer_dashboard()'::regprocedure);

  execute v_mig;

  select jsonb_object_agg(p.oid::regprocedure::text, md5(pg_get_functiondef(p.oid)))
    into v_after
    from pg_proc p
   where p.oid in ('public.compliance_expiring_certs(int)'::regprocedure, 'public.buyer_dashboard()'::regprocedure);

  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '', true);
  v_out := jsonb_build_object(
    'existing_functions_unchanged', v_before = v_after,
    'stable',          (select provolatile = 's' from pg_proc where oid = 'public.compliance_expired_certs()'::regprocedure),
    'security_definer', (select prosecdef from pg_proc where oid = 'public.compliance_expired_certs()'::regprocedure),
    'search_path',     (select proconfig from pg_proc where oid = 'public.compliance_expired_certs()'::regprocedure),
    'anon_can_execute', has_function_privilege('anon', 'public.compliance_expired_certs()', 'execute'),
    'authenticated_can_execute', has_function_privilege('authenticated', 'public.compliance_expired_certs()', 'execute'),
    'signed_out', public.compliance_expired_certs()
  );

  for v_owner in select distinct owner_id from public.saved_suppliers order by 1 loop
    perform set_config('request.jwt.claims', jsonb_build_object('sub', v_owner, 'role', 'authenticated')::text, true);
    v_t0 := clock_timestamp();
    v_got := public.compliance_expired_certs();
    select count(*)::int into v_ref
      from public.saved_suppliers ss
      join public.suppliers s on s.id = ss.supplier_id
      join public.certifications c on c.supplier_id = s.id
     where ss.owner_id = v_owner
       and s.is_published and not s.is_sanctioned
       and c.rejected_at is null
       and c.expires_on < current_date
       and c.expires_on = (select max(r.expires_on) from public.certifications r
                            where r.supplier_id = c.supplier_id and r.kind = c.kind and r.rejected_at is null);
    v_owners := v_owners || jsonb_build_object(
      'owner',      left(v_owner::text, 8),
      'saved',      (select count(*) from public.saved_suppliers where owner_id = v_owner),
      'total',      v_got->'total',
      'rows',       jsonb_array_length(v_got->'rows'),
      'reference',  v_ref,
      'agree',      (v_got->>'total')::int = v_ref and jsonb_array_length(v_got->'rows') = v_ref,
      'all_past',   not exists (select 1 from jsonb_array_elements(v_got->'rows') e where (e->>'days_remaining')::int >= 0),
      'ms',         round(extract(epoch from clock_timestamp() - v_t0) * 1000, 1),
      'first',      (select jsonb_build_object('kind', e->'kind', 'issuer', e->'issuer', 'expires_on', e->'expires_on',
                                                'days', e->'days_remaining', 'supplier', e->'supplier'->'slug')
                       from jsonb_array_elements(v_got->'rows') e limit 1)
    );
  end loop;

  raise exception 'DRYRUN_RESULT %', jsonb_pretty(v_out || jsonb_build_object('owners', v_owners));
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
