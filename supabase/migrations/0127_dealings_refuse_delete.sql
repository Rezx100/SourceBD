-- 0127 — Nothing is ever lost: the dealing tables refuse the delete of a person or a company (6 Oct 2026).
--
-- Plan: .impeccable/handoff-admin-moderation.md, section 4.2 "Nothing is ever lost" and build item 0b.
--
-- WHY
-- ---
-- Every table that records a dealing between a buyer and a supplier was created with
-- `on delete cascade` back to auth.users and public.suppliers (0027, 0028, 0029, 0032, 0112,
-- 0114). There is no delete button in the app, but one click in the Supabase dashboard on a
-- user or a supplier row erased their conversations, messages, files, RFQs, quotes, orders,
-- claims and export records with it, with no trace. Evidence destroyed is the one thing a
-- record for a court cannot survive.
--
-- WHAT
-- ----
-- Every foreign key below is recreated as `on delete restrict`: the delete of a person or a
-- company that has any dealing is refused by the database with a foreign-key error, whoever
-- asks (the dashboard, a script, a SECURITY DEFINER function). An account with history is
-- closed, never deleted. A person with NO dealings (a spam sign-up) can still be deleted:
-- public.profiles keeps its cascade on purpose.
--
-- The constraint names are not hard-coded: each is looked up by table and column in
-- pg_constraint and recreated under its own name, so production (which created them with the
-- same migrations) and the CI replay take the same path. A key that is already `restrict` is
-- left alone, so the file can run twice.
--
-- CHECKED, NOT CHANGED
-- --------------------
-- The review queue's supplier merge (_queue_absorb_supplier, 0102) does not delete the loser:
-- it moves source records, certificates, evidence and documents to the winner and unpublishes
-- the loser. Conversations, RFQs, quotes, orders and claims stay on the (now hidden) duplicate
-- and are not moved. supabase/ci/assert-0127.sql proves that. ops/merge_duplicate_suppliers.py
-- DOES delete the loser row (line 673), but it refuses while anything still references it, and
-- after this migration a dealing is such a reference.
--
-- Deploy order: safe before or after the code; no code reads these constraints.
--
-- Dry run and the founder's command: ops/plans/0127-dry-run.md (ops/dry_run_0127_dealings_refuse_delete.py).
--
-- REVERSE
-- -------
-- Re-run the same loop with `on delete cascade` (`on delete set null` for admin_audit_log.actor_id).

set search_path = public;

do $$
declare
  v_pair    text[];
  r         record;
  v_refcols text;
begin
  foreach v_pair slice 1 in array array[
    -- conversations and messages (0027, 0112)
    ['message_threads',        'buyer_id'],
    ['message_threads',        'supplier_id'],
    ['thread_participants',    'thread_id'],
    ['thread_participants',    'user_id'],
    ['messages',               'thread_id'],
    ['messages',               'sender_id'],
    ['message_attachments',    'message_id'],
    ['message_attachments',    'thread_id'],
    -- RFQs and quotes (0028)
    ['rfqs',                   'buyer_id'],
    ['rfq_quotes',             'rfq_id'],
    ['rfq_quotes',             'supplier_id'],
    ['rfq_quotes',             'submitted_by'],
    -- orders (0029)
    ['orders',                 'buyer_id'],
    ['orders',                 'supplier_id'],
    ['order_milestones',       'order_id'],
    -- claims (0032)
    ['claim_requests',         'supplier_id'],
    ['claim_requests',         'claimant_user_id'],
    -- the record of each export (0114) and of each admin action (0038)
    ['evidence_pack_downloads', 'owner_id'],
    ['admin_audit_log',        'actor_id']
  ] loop
    select c.oid, c.conname, c.confrelid, c.confkey, c.confdeltype
      into r
      from pg_constraint c
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
     where c.conrelid = format('public.%I', v_pair[1])::regclass
       and c.contype = 'f'
       and array_length(c.conkey, 1) = 1
       and a.attname = v_pair[2];
    if not found then
      raise exception '0127: no single-column foreign key on public.%.%', v_pair[1], v_pair[2];
    end if;
    if r.confdeltype = 'r' then
      continue;
    end if;
    select string_agg(quote_ident(a.attname), ', ' order by k.ord)
      into v_refcols
      from unnest(r.confkey) with ordinality as k(attnum, ord)
      join pg_attribute a on a.attrelid = r.confrelid and a.attnum = k.attnum;
    execute format('alter table public.%I drop constraint %I', v_pair[1], r.conname);
    execute format(
      'alter table public.%I add constraint %I foreign key (%I) references %s (%s) on delete restrict',
      v_pair[1], r.conname, v_pair[2], r.confrelid::regclass, v_refcols
    );
  end loop;
end
$$;

comment on table public.message_threads is
  '0127: a person or a company with a conversation cannot be deleted (on delete restrict); the account is closed instead.';
comment on table public.rfqs is
  '0127: a buyer with an RFQ cannot be deleted (on delete restrict); the account is closed instead.';
comment on table public.orders is
  '0127: a buyer or a supplier with an order cannot be deleted (on delete restrict); the account is closed instead.';
comment on table public.claim_requests is
  '0127: a claimant or a supplier with a claim cannot be deleted (on delete restrict).';
