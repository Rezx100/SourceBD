-- 0134 — The record covers accounts, claims, team, saves and partners, and what people read (6 Oct 2026).
--
-- Plan: .impeccable/handoff-admin-moderation.md, section 4.1 (Account, Finding, Supplier side) and build item 1d.
--
-- WHAT
-- ----
--   1. A second trigger function, _ledger_row_change_accounts(), for the tables 0131 did not cover:
--        profiles              account.suspended / unsuspended / terms_accepted / role_changed / plan_changed / profile_edited
--        buyer_settings        workspace.settings_created / settings_changed
--        workspace_members     team.member_joined / role_changed / member_removed
--        workspace_invites     team.invited / invite_accepted / invite_cancelled / invite_resent (the token hash never copied)
--        saved_suppliers       supplier.saved / unsaved
--        claim_requests        claim.started / email_verified / approved / rejected / expired / cancelled / link_resent (hash never copied)
--        suppliers             supplier.profile_edited, ONLY when a signed-in person did it (the ETL and the
--                              sanctions trigger run with no caller and are not recorded here)
--        certifications        supplier.certificate_uploaded / changed / removed, only when a person did it
--        thread_participants   conversation.read (last_read_at moved)
--        evidence_pack_downloads  export.evidence_pack
--        rfq_drafts            rfq.drafted / draft_deleted (an autosave is not an event)
--        supplier_relationships   partner.requested / accepted / rejected / revoked
--      The actor is the signed-in caller, else the row's own person. Where a member of staff acted on
--      someone else's account, the other party is that account. A touch of updated_at, last_active_at
--      (profile_touch) or sent_at alone is not an event.
--   2. ledger_note(kind, ...): the one way code records a READ, as the signed-in caller only: a search run,
--      a record or a line opened, contact details shown, an export or a file downloaded, an RFQ or an order
--      viewed. Only those kinds; an object of at most 8 KB; at most 600 notes a minute per account, so a
--      client cannot flood the record. A note that names a supplier by slug gets its id.
--   3. terms_accept(version): any signed-in person records their acceptance of the terms (suppliers had no
--      way to; buyers did it in onboarding). The profiles trigger writes account.terms_accepted.
--
-- Deploy order: safe before the code (the notes are best effort and a missing function is refused, not
-- fatal). The profiles trigger reads terms_version, added by 0109; a database without 0109 records a
-- profile edit under account.profile_edited and terms_accept fails until 0109 is applied.
--
-- Dry run: ops/plans/0134-dry-run.md.
--
-- REVERSE
-- -------
--   drop function public.terms_accept(text);
--   drop function public.ledger_note(text, text, uuid, jsonb, uuid, uuid, uuid, uuid);
--   for each table: drop trigger trg_<table>_ledger on public.<table>;
--   drop function public._ledger_row_change_accounts();

set search_path = public;

create or replace function public._ledger_row_change_accounts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new      jsonb := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  v_old      jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  v_row      jsonb := coalesce(case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end, '{}'::jsonb);
  v_changed  text[] := '{}';
  v_uid      uuid := auth.uid();
  v_kind     text;
  v_target   uuid;
  v_actor    uuid;
  v_other    uuid;
  v_supplier uuid;
  v_thread   uuid;
  v_rfq      uuid;
  v_content  jsonb;
  v_status   text;
  v_prev     text;
  v_person   uuid;
begin
  if tg_op = 'UPDATE' then
    select coalesce(array_agg(k order by k), '{}') into v_changed
      from jsonb_object_keys(v_new) k
     where v_new -> k is distinct from v_old -> k;
    v_changed := array_remove(array_remove(array_remove(v_changed, 'updated_at'), 'last_active_at'), 'sent_at');
    if cardinality(v_changed) = 0 then
      return null;
    end if;
  end if;
  v_target := nullif(v_row ->> 'id', '')::uuid;
  v_status := v_row ->> 'status';
  v_prev   := v_old ->> 'status';

  case tg_table_name
    when 'profiles' then
      v_target := nullif(v_row ->> 'id', '')::uuid;
      v_actor  := coalesce(v_uid, v_target);
      if v_actor is distinct from v_target then v_other := v_target; end if;
      if 'is_suspended' = any (v_changed) then
        v_kind := case when coalesce((v_new ->> 'is_suspended')::boolean, false) then 'account.suspended' else 'account.unsuspended' end;
      elsif 'terms_version' = any (v_changed) then v_kind := 'account.terms_accepted';
      elsif 'role' = any (v_changed) then v_kind := 'account.role_changed';
      elsif 'plan_tier' = any (v_changed) then v_kind := 'account.plan_changed';
      else v_kind := 'account.profile_edited';
      end if;

    when 'buyer_settings' then
      v_target := nullif(v_row ->> 'owner_id', '')::uuid;
      v_actor  := coalesce(v_uid, v_target);
      v_kind   := case tg_op when 'INSERT' then 'workspace.settings_created' else 'workspace.settings_changed' end;

    when 'workspace_members' then
      v_target := nullif(v_row ->> 'member_id', '')::uuid;
      v_other  := v_target;
      v_actor  := coalesce(v_uid, nullif(v_row ->> 'invited_by', '')::uuid, nullif(v_row ->> 'owner_id', '')::uuid);
      v_kind   := case tg_op when 'INSERT' then 'team.member_joined' when 'DELETE' then 'team.member_removed' else 'team.role_changed' end;

    when 'workspace_invites' then
      v_actor := coalesce(v_uid, nullif(v_row ->> 'invited_by', '')::uuid, nullif(v_row ->> 'owner_id', '')::uuid);
      v_other := nullif(v_row ->> 'accepted_by', '')::uuid;
      v_new := v_new - 'token_hash';
      v_old := v_old - 'token_hash';
      if tg_op = 'INSERT' then v_kind := 'team.invited';
      elsif 'accepted_at' = any (v_changed) and v_new ->> 'accepted_at' is not null then v_kind := 'team.invite_accepted';
      elsif 'cancelled_at' = any (v_changed) and v_new ->> 'cancelled_at' is not null then v_kind := 'team.invite_cancelled';
      elsif 'send_count' = any (v_changed) then v_kind := 'team.invite_resent';
      else v_kind := 'team.invite_updated';
      end if;

    when 'saved_suppliers' then
      v_actor    := coalesce(v_uid, nullif(v_row ->> 'owner_id', '')::uuid);
      v_supplier := nullif(v_row ->> 'supplier_id', '')::uuid;
      v_kind     := case tg_op when 'INSERT' then 'supplier.saved' when 'DELETE' then 'supplier.unsaved' else 'supplier.save_changed' end;

    when 'claim_requests' then
      v_person   := nullif(v_row ->> 'claimant_user_id', '')::uuid;
      v_actor    := coalesce(v_uid, v_person);
      if v_actor is distinct from v_person then v_other := v_person; end if;
      v_supplier := nullif(v_row ->> 'supplier_id', '')::uuid;
      v_new := v_new - 'verification_token_hash';
      v_old := v_old - 'verification_token_hash';
      if tg_op = 'INSERT' then v_kind := 'claim.started';
      elsif v_status is distinct from v_prev then v_kind := 'claim.' || v_status;
      elsif 'verification_token_hash' = any (v_changed) then v_kind := 'claim.link_resent';
      else v_kind := 'claim.updated';
      end if;

    when 'suppliers' then
      if v_uid is null then return null; end if;
      v_actor    := v_uid;
      v_supplier := v_target;
      v_kind     := case tg_op when 'UPDATE' then 'supplier.profile_edited' when 'INSERT' then 'supplier.created' else 'supplier.deleted' end;

    when 'certifications' then
      if v_uid is null then return null; end if;
      v_actor    := v_uid;
      v_supplier := nullif(v_row ->> 'supplier_id', '')::uuid;
      v_kind     := case tg_op when 'INSERT' then 'supplier.certificate_uploaded' when 'DELETE' then 'supplier.certificate_removed' else 'supplier.certificate_changed' end;

    when 'thread_participants' then
      if tg_op <> 'UPDATE' or not ('last_read_at' = any (v_changed)) then return null; end if;
      v_actor  := coalesce(v_uid, nullif(v_row ->> 'user_id', '')::uuid);
      v_thread := nullif(v_row ->> 'thread_id', '')::uuid;
      select t.supplier_id into v_supplier from public.message_threads t where t.id = v_thread;
      v_kind    := 'conversation.read';
      v_content := jsonb_build_object('read_up_to', v_new ->> 'last_read_at');

    when 'evidence_pack_downloads' then
      v_actor := coalesce(v_uid, nullif(v_row ->> 'owner_id', '')::uuid);
      v_kind  := 'export.evidence_pack';

    when 'rfq_drafts' then
      if tg_op = 'UPDATE' then return null; end if;
      v_actor := coalesce(v_uid, nullif(v_row ->> 'owner_id', '')::uuid);
      v_kind  := case tg_op when 'INSERT' then 'rfq.drafted' else 'rfq.draft_deleted' end;

    when 'supplier_relationships' then
      v_actor    := coalesce(v_uid, nullif(v_row ->> 'initiated_by', '')::uuid);
      v_supplier := nullif(v_row ->> 'factory_id', '')::uuid;
      if tg_op = 'INSERT' then v_kind := 'partner.requested';
      elsif v_status is distinct from v_prev then v_kind := 'partner.' || v_status;
      else v_kind := 'partner.updated';
      end if;

    else
      raise exception '0134: no ledger mapping for %', tg_table_name;
  end case;

  if v_content is null then
    v_content := case tg_op
      when 'INSERT' then jsonb_build_object('after', v_new)
      when 'DELETE' then jsonb_build_object('before', v_old)
      else jsonb_build_object('after', v_new, 'before', v_old, 'changed', to_jsonb(v_changed))
    end;
  end if;

  perform public._ledger_write(
    v_kind, tg_table_name, v_target, v_content,
    v_actor, v_other, v_supplier, v_thread, v_rfq, null, null, null
  );
  return null;
end;
$$;

revoke all on function public._ledger_row_change_accounts() from public, anon, authenticated;

do $$
declare
  t   text;
  ops text;
begin
  for t, ops in
    select * from (values
      ('profiles',                'update'),
      ('buyer_settings',          'insert or update'),
      ('workspace_members',       'insert or update or delete'),
      ('workspace_invites',       'insert or update'),
      ('saved_suppliers',         'insert or delete'),
      ('claim_requests',          'insert or update'),
      ('suppliers',               'update'),
      ('certifications',          'insert or update or delete'),
      ('thread_participants',     'update of last_read_at'),
      ('evidence_pack_downloads', 'insert'),
      ('rfq_drafts',              'insert or delete'),
      ('supplier_relationships',  'insert or update')
    ) as v(tbl, o)
  loop
    if to_regclass('public.' || t) is null then
      raise notice '0134: public.% does not exist here; no ledger trigger on it', t;
      continue;
    end if;
    execute format('drop trigger if exists trg_%s_ledger on public.%I', t, t);
    execute format(
      'create trigger trg_%s_ledger after %s on public.%I for each row execute function public._ledger_row_change_accounts()',
      t, ops, t
    );
  end loop;
end
$$;

-- ----------------------------------------------------------------------
-- 2. Reads
-- ----------------------------------------------------------------------

create or replace function public.ledger_note(
  p_kind         text,
  p_target_table text  default null,
  p_target_id    uuid  default null,
  p_content      jsonb default '{}'::jsonb,
  p_supplier     uuid  default null,
  p_thread       uuid  default null,
  p_rfq          uuid  default null,
  p_order        uuid  default null
)
returns bigint
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid      uuid := auth.uid();
  v_supplier uuid := p_supplier;
  v_content  jsonb := coalesce(p_content, '{}'::jsonb);
  v_n        int;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_kind is null or p_kind not in (
    'search.run', 'supplier.viewed', 'supplier.line_viewed', 'contact.revealed',
    'export.downloaded', 'file.downloaded', 'rfq.viewed', 'order.viewed'
  ) then
    raise exception 'ledger_note does not take kind %', coalesce(p_kind, '(null)') using errcode = '22023';
  end if;
  if jsonb_typeof(v_content) <> 'object' or octet_length(v_content::text) > 8192 then
    raise exception 'content must be an object of at most 8 KB' using errcode = '22023';
  end if;
  select count(*) into v_n
    from public.activity_ledger l
   where l.actor_id = v_uid and l.at > now() - interval '1 minute';
  if v_n >= 600 then
    raise exception 'too many notes this minute' using errcode = '54000';
  end if;
  if v_supplier is null and v_content ? 'slug' then
    select s.id into v_supplier from public.suppliers s where s.slug = v_content ->> 'slug';
  end if;
  return public._ledger_write(p_kind, p_target_table, p_target_id, v_content, v_uid, null, v_supplier, p_thread, p_rfq, p_order, null, null);
end;
$$;

comment on function public.ledger_note(text, text, uuid, jsonb, uuid, uuid, uuid, uuid) is
  '0134: a signed-in person''s read (search, record, export, file, RFQ, order) written to the activity record. '
  'Only those kinds, at most 8 KB and 600 a minute per account.';

revoke all     on function public.ledger_note(text, text, uuid, jsonb, uuid, uuid, uuid, uuid) from public, anon;
grant  execute on function public.ledger_note(text, text, uuid, jsonb, uuid, uuid, uuid, uuid) to authenticated;

-- ----------------------------------------------------------------------
-- 3. Terms
-- ----------------------------------------------------------------------

create or replace function public.terms_accept(p_version text)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v     text := nullif(btrim(coalesce(p_version, '')), '');
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if v is null or length(v) > 32 then
    raise exception 'version is required, up to 32 characters' using errcode = '22023';
  end if;
  update public.profiles
     set terms_version     = v,
         terms_accepted_at = now()
   where id = v_uid;
  if not found then
    raise exception 'no profile for this account' using errcode = 'P0002';
  end if;
end;
$$;

comment on function public.terms_accept(text) is
  '0134: the signed-in person accepts the terms (version); the profiles trigger records account.terms_accepted.';

revoke all     on function public.terms_accept(text) from public, anon;
grant  execute on function public.terms_accept(text) to authenticated;
