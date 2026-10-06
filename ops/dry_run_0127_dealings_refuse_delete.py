"""Dry run of migration 0127 in ONE transaction that is always rolled back.

Applies `0127_dealings_refuse_delete.sql` inside a `do` block, then proves:

  * the text that ran is the file's (md5 of the literal);
  * before it, which of the nineteen keys still cascaded (or nulled) and how many rows each
    table holds, so the founder sees exactly what would have been erased by a delete;
  * after it, every one of the nineteen keys is `on delete restrict` and no row count changed
    (the migration touches constraints, never rows);
  * a delete of the first user that has a conversation is refused with a foreign-key error
    (inside the rolled-back transaction only).

The block ends by raising `DRYRUN_RESULT {...}`, which rolls everything back. Nothing is
committed, and nothing here is `--apply` (AGENTS rule 15).

    python ops/dry_run_0127_dealings_refuse_delete.py           # runs it (SUPABASE_DB_URL in .env)
    python ops/dry_run_0127_dealings_refuse_delete.py --print   # prints the SQL, for the SQL editor or the Supabase MCP

Output of the run: `ops/plans/0127-dry-run.md`.
"""
import hashlib
import pathlib
import sys

REPO = pathlib.Path(__file__).resolve().parents[1]
MIG = REPO / "supabase" / "migrations" / "0127_dealings_refuse_delete.sql"

text = MIG.read_text(encoding="utf-8")
assert "$mig$" not in text and "$dry$" not in text

KEYS = """
  ('message_threads','buyer_id'), ('message_threads','supplier_id'),
  ('thread_participants','thread_id'), ('thread_participants','user_id'),
  ('messages','thread_id'), ('messages','sender_id'),
  ('message_attachments','message_id'), ('message_attachments','thread_id'),
  ('rfqs','buyer_id'), ('rfq_quotes','rfq_id'), ('rfq_quotes','supplier_id'), ('rfq_quotes','submitted_by'),
  ('orders','buyer_id'), ('orders','supplier_id'), ('order_milestones','order_id'),
  ('claim_requests','supplier_id'), ('claim_requests','claimant_user_id'),
  ('evidence_pack_downloads','owner_id'), ('admin_audit_log','actor_id')
"""

SQL = f"""do $dry$
declare
  v_mig     text := $mig${text}$mig$;
  v_before  jsonb;
  v_after   jsonb;
  v_rows_b  jsonb;
  v_rows_a  jsonb;
  v_uid     uuid;
  v_refused text;
begin
  if md5(v_mig) <> '{hashlib.md5(text.encode("utf-8")).hexdigest()}' then
    raise exception 'the literal is not the file';
  end if;

  select jsonb_object_agg(c.conrelid::regclass::text || '.' || a.attname, c.confdeltype::text) into v_before
    from pg_constraint c join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
   where c.contype = 'f' and (c.conrelid::regclass::text, a.attname) in ({KEYS});
  select jsonb_object_agg(t, n) into v_rows_b from (
    select 'message_threads' t, count(*) n from public.message_threads union all
    select 'messages', count(*) from public.messages union all
    select 'message_attachments', count(*) from public.message_attachments union all
    select 'rfqs', count(*) from public.rfqs union all
    select 'rfq_quotes', count(*) from public.rfq_quotes union all
    select 'orders', count(*) from public.orders union all
    select 'order_milestones', count(*) from public.order_milestones union all
    select 'claim_requests', count(*) from public.claim_requests union all
    select 'evidence_pack_downloads', count(*) from public.evidence_pack_downloads union all
    select 'admin_audit_log', count(*) from public.admin_audit_log) x;

  execute v_mig;

  select jsonb_object_agg(c.conrelid::regclass::text || '.' || a.attname, c.confdeltype::text) into v_after
    from pg_constraint c join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
   where c.contype = 'f' and (c.conrelid::regclass::text, a.attname) in ({KEYS});
  select jsonb_object_agg(t, n) into v_rows_a from (
    select 'message_threads' t, count(*) n from public.message_threads union all
    select 'messages', count(*) from public.messages union all
    select 'message_attachments', count(*) from public.message_attachments union all
    select 'rfqs', count(*) from public.rfqs union all
    select 'rfq_quotes', count(*) from public.rfq_quotes union all
    select 'orders', count(*) from public.orders union all
    select 'order_milestones', count(*) from public.order_milestones union all
    select 'claim_requests', count(*) from public.claim_requests union all
    select 'evidence_pack_downloads', count(*) from public.evidence_pack_downloads union all
    select 'admin_audit_log', count(*) from public.admin_audit_log) x;

  -- The first person with a conversation: a delete must now be refused.
  select buyer_id into v_uid from public.message_threads order by created_at limit 1;
  if v_uid is not null then
    begin
      delete from auth.users where id = v_uid;
      v_refused := 'NOT REFUSED';
    exception when foreign_key_violation then
      v_refused := 'refused: ' || sqlerrm;
    end;
  else
    v_refused := 'no conversation to try';
  end if;

  raise exception 'DRYRUN_RESULT %', jsonb_pretty(jsonb_build_object(
    'keys_before',        v_before,
    'keys_after',         v_after,
    'all_restrict_after', not exists (select 1 from jsonb_each_text(v_after) e where e.value <> 'r'),
    'rows_before',        v_rows_b,
    'rows_after',         v_rows_a,
    'rows_unchanged',     v_rows_b = v_rows_a,
    'delete_of_a_buyer_with_a_conversation', v_refused));
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
