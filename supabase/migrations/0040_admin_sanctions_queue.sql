-- 0040_admin_sanctions_queue.sql
--
-- Spec A4 — Sanctions queue.
-- Fourth Phase-4 admin spec. Admin reviews supplier rows auto-flagged
-- against the sanctions lists (uflpa / us_wro / ofac_sdn / uk_ofsi /
-- eu_sanctions / ilab_tvpra), each surfaced as a row in
-- public.verification_queue with queue_type='sanctions_hit' and a
-- matched sanctions_list_entries reference carried in source_data.
-- Admin either *confirms* the hit (flips suppliers.is_sanctioned=true
-- + records the reason and resets the cleared state) or *clears* it
-- (flips is_sanctioned=false + sets sanctions_cleared=true with a
-- reason). Every decision closes the queue row and writes one
-- admin_audit_log entry inside the same transaction.
--
-- Down (manual):
--   drop function public.admin_sanctions_decide(uuid, text, text);
--   drop function public.admin_sanctions_queue_list(text, text, int, int);
--   alter table public.suppliers
--     drop column sanctions_cleared_reason,
--     drop column sanctions_cleared,
--     drop column sanctions_reviewed_by,
--     drop column sanctions_reviewed_at;
--   -- queue_action enum extensions are NOT reversible (Postgres limitation).

-- ---------- 1. queue_action enum extensions -------------------------------
-- The A1-era enum was 'merge|new_record|reject|escalate|approve'. A4 adds
-- 'confirm' and 'clear' as the two sanctions-decision verbs. Enum values
-- are added top-of-migration so the RPC body (parsed lazily at first
-- call) can cast text → queue_action without ordering grief.

alter type public.queue_action add value if not exists 'confirm';
alter type public.queue_action add value if not exists 'clear';

-- ---------- 2. suppliers columns ------------------------------------------

alter table public.suppliers
  add column if not exists sanctions_reviewed_at    timestamptz,
  add column if not exists sanctions_reviewed_by    uuid references auth.users(id) on delete set null,
  add column if not exists sanctions_cleared        boolean not null default false,
  add column if not exists sanctions_cleared_reason text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'suppliers_sanctions_cleared_reason_len') then
    alter table public.suppliers
      add constraint suppliers_sanctions_cleared_reason_len
      check (sanctions_cleared_reason is null or length(sanctions_cleared_reason) <= 2000);
  end if;
end $$;

-- ---------- 3. RPCs --------------------------------------------------------

-- admin_sanctions_queue_list — paginated sanctions-hit queue.
-- Returns jsonb { total, rows: [...] }. Admin-only; in-body role check.
create or replace function public.admin_sanctions_queue_list(
  p_status text default 'open',
  p_list   text default null,
  p_limit  int  default 50,
  p_offset int  default 0
) returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_uid    uuid := auth.uid();
  v_role   text;
  v_status text := lower(coalesce(p_status, 'open'));
  v_limit  int  := greatest(1, least(coalesce(p_limit, 50), 200));
  v_offset int  := greatest(0, coalesce(p_offset, 0));
  v_out    jsonb;
begin
  if v_uid is null then
    raise insufficient_privilege using message = 'admin only';
  end if;
  select role::text into v_role from public.profiles where id = v_uid;
  if v_role is null or v_role <> 'admin' then
    raise insufficient_privilege using message = 'admin only';
  end if;
  if v_status not in ('open','reviewed','all') then
    raise exception 'status must be open|reviewed|all' using errcode = '22023';
  end if;

  with filtered as (
    select
      q.id                                                  as queue_id,
      q.created_at                                          as queue_created_at,
      q.reviewed_at                                         as reviewed_at,
      q.admin_action                                        as admin_action,
      q.supplier_a_id                                       as supplier_id,
      q.source_data                                         as source_data
      from public.verification_queue q
     where q.queue_type = 'sanctions_hit'
       and (v_status = 'all'
            or (v_status = 'open'     and q.reviewed_at is null)
            or (v_status = 'reviewed' and q.reviewed_at is not null))
       and (p_list is null or q.source_data->>'list' = p_list)
  ),
  joined as (
    select f.*,
           s.slug                       as supplier_slug,
           s.company_name               as supplier_company_name,
           s.entity_type::text          as supplier_entity_type,
           s.is_sanctioned              as supplier_sanctioned_flag,
           s.sanctioned_reason          as supplier_sanctioned_reason,
           s.sanctions_cleared          as supplier_sanctions_cleared,
           (f.source_data->>'list')                          as hit_list,
           (f.source_data->>'matched_name')                  as hit_matched_name,
           nullif(f.source_data->>'match_score','')::numeric as hit_match_score,
           nullif(f.source_data->>'entry_id','')::uuid       as hit_entry_id,
           e.entity_name                                     as hit_entity_name,
           e.source_url                                      as hit_source_url,
           e.listed_date                                     as hit_listed_date
      from filtered f
      join public.suppliers s
        on s.id = f.supplier_id
      left join public.sanctions_list_entries e
        on e.id = nullif(f.source_data->>'entry_id','')::uuid
  ),
  page as (
    select * from joined
     order by queue_created_at desc
     limit v_limit offset v_offset
  )
  select jsonb_build_object(
    'total', (select count(*) from joined),
    'rows',  coalesce((
      select jsonb_agg(jsonb_build_object(
        'queue_id',          p.queue_id,
        'queue_created_at',  p.queue_created_at,
        'reviewed_at',       p.reviewed_at,
        'admin_action',      p.admin_action,
        'supplier', jsonb_build_object(
          'id',                  p.supplier_id,
          'slug',                p.supplier_slug,
          'company_name',        p.supplier_company_name,
          'entity_type',         p.supplier_entity_type,
          'sanctioned_flag',     p.supplier_sanctioned_flag,
          'sanctioned_reason',   p.supplier_sanctioned_reason,
          'sanctions_cleared',   p.supplier_sanctions_cleared
        ),
        'hit', jsonb_build_object(
          'list',          p.hit_list,
          'matched_name',  p.hit_matched_name,
          'match_score',   p.hit_match_score,
          'entry_id',      p.hit_entry_id,
          'entity_name',   p.hit_entity_name,
          'source_url',    p.hit_source_url,
          'listed_date',   p.hit_listed_date
        )
      ) order by p.queue_created_at desc)
      from page p
    ), '[]'::jsonb)
  ) into v_out;

  return v_out;
end;
$$;

comment on function public.admin_sanctions_queue_list(text, text, int, int) is
  'Spec A4 — admin-only sanctions verification queue listing. Joins '
  'verification_queue (sanctions_hit) → suppliers → sanctions_list_entries. '
  'No contact PII keys. Exposes supplier.sanctioned_flag (admin context).';

revoke all     on function public.admin_sanctions_queue_list(text, text, int, int) from public;
grant  execute on function public.admin_sanctions_queue_list(text, text, int, int) to authenticated;

-- admin_sanctions_decide — confirm or clear a queued sanctions hit. Single
-- transaction: mutates the supplier, closes the queue row, writes one
-- admin_audit_log row. Both decisions require a non-blank reason.
create or replace function public.admin_sanctions_decide(
  p_queue_id uuid,
  p_decision text,
  p_reason   text default null
) returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid       uuid := auth.uid();
  v_role      text;
  v_decision  text := lower(coalesce(p_decision, ''));
  v_reason    text := nullif(btrim(coalesce(p_reason, '')), '');
  v_supp_id   uuid;
  v_list      text;
  v_entry_id  uuid;
  v_reviewed  timestamptz;
begin
  if v_uid is null then
    raise insufficient_privilege using message = 'admin only';
  end if;
  select role::text into v_role from public.profiles where id = v_uid;
  if v_role is null or v_role <> 'admin' then
    raise insufficient_privilege using message = 'admin only';
  end if;
  if p_queue_id is null then
    raise exception 'queue_id required' using errcode = '22023';
  end if;
  if v_decision not in ('confirm','clear') then
    raise exception 'decision must be confirm|clear' using errcode = '22023';
  end if;
  if v_reason is null then
    raise exception 'reason required' using errcode = '22023';
  end if;

  select q.supplier_a_id,
         q.source_data->>'list',
         nullif(q.source_data->>'entry_id','')::uuid,
         q.reviewed_at
    into v_supp_id, v_list, v_entry_id, v_reviewed
    from public.verification_queue q
   where q.id = p_queue_id
     and q.queue_type = 'sanctions_hit'
   for update;

  if v_supp_id is null then
    raise exception 'queue row not found' using errcode = 'P0002';
  end if;
  if v_reviewed is not null then
    raise exception 'queue row already decided' using errcode = 'P0002';
  end if;

  if v_decision = 'confirm' then
    update public.suppliers
       set is_sanctioned            = true,
           sanctioned_reason        = v_reason,
           sanctions_cleared        = false,
           sanctions_cleared_reason = null,
           sanctions_reviewed_at    = now(),
           sanctions_reviewed_by    = v_uid
     where id = v_supp_id;
  else
    update public.suppliers
       set is_sanctioned            = false,
           sanctions_cleared        = true,
           sanctions_cleared_reason = v_reason,
           sanctions_reviewed_at    = now(),
           sanctions_reviewed_by    = v_uid
     where id = v_supp_id;
  end if;

  update public.verification_queue
     set reviewed_at  = now(),
         reviewed_by  = v_uid,
         admin_action = v_decision::queue_action
   where id = p_queue_id;

  insert into public.admin_audit_log (actor_id, action, target_table, target_id, patch, metadata)
  values (
    v_uid,
    'admin_sanctions_decide',
    'suppliers',
    v_supp_id,
    jsonb_build_object('decision', v_decision, 'reason', v_reason),
    jsonb_build_object('queue_id', p_queue_id, 'list', v_list, 'entry_id', v_entry_id)
  );

  return jsonb_build_object(
    'ok',           true,
    'queue_id',     p_queue_id,
    'supplier_id',  v_supp_id,
    'decision',     v_decision
  );
end;
$$;

comment on function public.admin_sanctions_decide(uuid, text, text) is
  'Spec A4 — admin-only sanctions decision. confirm sets '
  'suppliers.is_sanctioned=true + sanctioned_reason and resets '
  'sanctions_cleared=false / sanctions_cleared_reason=null. clear sets '
  'is_sanctioned=false + sanctions_cleared=true + sanctions_cleared_reason. '
  'Both require a non-blank reason. Closes the queue row and writes one '
  'admin_audit_log entry inside the same transaction.';

revoke all     on function public.admin_sanctions_decide(uuid, text, text) from public;
grant  execute on function public.admin_sanctions_decide(uuid, text, text) to authenticated;
