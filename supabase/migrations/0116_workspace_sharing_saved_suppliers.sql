-- 0116 — Sharing by workspace, part 1: who a person acts for, what each role may do, and the saved suppliers
-- (5 Oct 2026).
--
-- Spec: context/feature-specs/gap-04b-workspace-sharing.md (gap list row 4b). Team and roles (0111) lists the
-- people in a workspace; every buyer table and call is still keyed by auth.uid(). This is the first table group
-- to read and write by workspace.
--
--   1. workspace_owner(): whose data the caller works on. The owner of the workspace they were invited into, or
--      themselves (an owner, or anyone on no team). Reads workspace_members (one other workspace per person).
--   2. workspace_role(): 'owner', 'approver', 'editor' or 'viewer'; null with nobody signed in.
--   3. workspace_can(action): the role matrix, in one place. Roles include the ones below them:
--        read                    every role
--        save, rfq_send, order,  editor and up (editor, approver, owner)
--        message, quote_accept
--        sign_off                approver and up
--        company, team, plan     owner only
--      Only 'read' and 'save' are used by this migration; the others are named so the next groups cannot
--      invent their own words. An action that is not in the list is refused (false), never allowed.
--   4. saved_suppliers: a member reads the OWNER's list (select by workspace_owner()), and an editor, approver
--      or owner saves and unsaves on it; a viewer cannot write. Rows are always the owner's: a member never
--      has rows of their own while on a team, and the ones they had before joining are kept but not shown.
--   5. The reads that total a person's saved suppliers count the workspace's: buyer_saved_list, buyer_dashboard,
--      compliance_expired_certs, compliance_expiring_certs, compliance_msa_inputs, compliance_uflpa_tracker and
--      evidence_pack. Their live definitions are patched in place (below), not rewritten from this repo's
--      copies: production's are ahead of the repo's in places (0105's finding), and a `create or replace` from
--      here would delete what is only live. Only the saved_suppliers filter changes
--      (`ss.owner_id = v_uid` / `= auth.uid()` becomes `= public.workspace_owner()`); each function must change,
--      or the migration stops. Anything those functions key to the caller for another table (RFQs, settings) is
--      the next groups'.
--
-- Not here, on purpose: saved searches, RFQs and quotes, orders, products, messages, settings (spec: one group
-- per migration), and the unsubscribe/alert emails to the person who saved (email_sanction_recipients keeps
-- reading the saver's own rows; a member's rows are gone from it, the owner's are not).
--
-- Hard invariants honoured:
--   * Server enforces auth + ownership: the three policies test workspace_owner() and workspace_can(); the
--     helpers are SECURITY DEFINER with a pinned search_path and revoke anon by name (0105's finding).
--   * A member never reads another workspace's rows: workspace_owner() is a function of auth.uid() only.
--
-- Idempotent: `create or replace`, policies dropped before they are made, the patch finds nothing to change
-- on a second run and says so. No existing row changes.
--
-- Do not apply to production from this PR (AGENTS rule 15); the founder applies it after the dry run in
-- ops/plans/0116-dry-run.md.
--
-- Reversible (policies back to the owner's own rows; the functions patched back by the reverse replace):
--   drop policy pol_saved_suppliers_select_workspace on public.saved_suppliers;
--   drop policy pol_saved_suppliers_insert_workspace on public.saved_suppliers;
--   drop policy pol_saved_suppliers_delete_workspace on public.saved_suppliers;
--   create policy pol_saved_suppliers_select_self on public.saved_suppliers for select to authenticated using (owner_id = auth.uid());
--   create policy pol_saved_suppliers_insert_self on public.saved_suppliers for insert to authenticated with check (owner_id = auth.uid());
--   create policy pol_saved_suppliers_delete_self on public.saved_suppliers for delete to authenticated using (owner_id = auth.uid());
--   -- and re-run the patch below with the two strings swapped (replace workspace_owner() by auth.uid()).
--   drop function public.workspace_can(text);
--   drop function public.workspace_role();
--   drop function public.workspace_owner();

set search_path = public;

-- ----------------------------------------------------------------------
-- 1. Whose data, and what role
-- ----------------------------------------------------------------------

create or replace function public.workspace_owner()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select m.owner_id from public.workspace_members m where m.member_id = auth.uid()), auth.uid());
$$;

create or replace function public.workspace_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
           when auth.uid() is null then null
           else coalesce((select m.role from public.workspace_members m where m.member_id = auth.uid()), 'owner')
         end;
$$;

create or replace function public.workspace_can(p_action text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case p_action
           when 'read'        then r is not null
           when 'save'        then r in ('owner', 'approver', 'editor')
           when 'rfq_send'    then r in ('owner', 'approver', 'editor')
           when 'order'       then r in ('owner', 'approver', 'editor')
           when 'message'     then r in ('owner', 'approver', 'editor')
           when 'quote_accept' then r in ('owner', 'approver', 'editor')
           when 'sign_off'    then r in ('owner', 'approver')
           when 'company'     then r = 'owner'
           when 'team'        then r = 'owner'
           when 'plan'        then r = 'owner'
           else false
         end
    from (select public.workspace_role() as r) x;
$$;

revoke all     on function public.workspace_owner() from public, anon;
revoke all     on function public.workspace_role()  from public, anon;
revoke all     on function public.workspace_can(text) from public, anon;
grant  execute on function public.workspace_owner() to authenticated;
grant  execute on function public.workspace_role()  to authenticated;
grant  execute on function public.workspace_can(text) to authenticated;

-- ----------------------------------------------------------------------
-- 2. saved_suppliers: the owner's list, read by the team, written by editors and up
-- ----------------------------------------------------------------------

drop policy if exists pol_saved_suppliers_select_self      on public.saved_suppliers;
drop policy if exists pol_saved_suppliers_insert_self      on public.saved_suppliers;
drop policy if exists pol_saved_suppliers_delete_self      on public.saved_suppliers;
drop policy if exists pol_saved_suppliers_select_workspace on public.saved_suppliers;
drop policy if exists pol_saved_suppliers_insert_workspace on public.saved_suppliers;
drop policy if exists pol_saved_suppliers_delete_workspace on public.saved_suppliers;

create policy pol_saved_suppliers_select_workspace
  on public.saved_suppliers for select to authenticated
  using (owner_id = public.workspace_owner());

create policy pol_saved_suppliers_insert_workspace
  on public.saved_suppliers for insert to authenticated
  with check (owner_id = public.workspace_owner() and public.workspace_can('save'));

create policy pol_saved_suppliers_delete_workspace
  on public.saved_suppliers for delete to authenticated
  using (owner_id = public.workspace_owner() and public.workspace_can('save'));

-- ----------------------------------------------------------------------
-- 3. The reads that total the saved suppliers count the workspace's
-- ----------------------------------------------------------------------

do $patch$
declare
  fn       text;
  r        record;
  def      text;
  patched  text;
  changed  int := 0;
begin
  foreach fn in array array['buyer_saved_list', 'buyer_dashboard', 'compliance_expired_certs', 'compliance_expiring_certs',
                            'compliance_msa_inputs', 'compliance_uflpa_tracker', 'evidence_pack'] loop
    for r in select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.proname = fn and p.prokind = 'f' loop
      def := pg_get_functiondef(r.oid);
      patched := regexp_replace(def, 'ss\.owner_id\s*=\s*(v_uid|auth\.uid\(\))', 'ss.owner_id = public.workspace_owner()', 'g');
      if patched <> def then
        execute patched;
        changed := changed + 1;
      elsif def !~ 'ss\.owner_id\s*=\s*public\.workspace_owner\(\)' then
        raise exception '% has no saved_suppliers filter to change: stop and look at it', fn;
      end if;
    end loop;
  end loop;
  raise notice '0116: % function(s) patched', changed;
end
$patch$;
