-- 0062 — Admin unified verification queue hub.
--
-- Adds read and generic-decision RPCs for /admin/queue. Specialized queues
-- keep their existing decision RPCs:
--   - cert_doc_review    -> admin_cert_decide
--   - sanctions_hit      -> admin_sanctions_decide
--
-- Generic decisions only close the verification_queue row and audit the
-- action; they do not mutate suppliers or source records.

create or replace function public.admin_queue_list(
  p_type   text default null,
  p_status text default 'open',
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
  v_type   text := nullif(btrim(coalesce(p_type, '')), '');
  v_status text := lower(coalesce(nullif(btrim(p_status), ''), 'open'));
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
  if v_status not in ('open', 'reviewed', 'all') then
    raise exception 'status must be open|reviewed|all' using errcode = '22023';
  end if;
  if v_type is not null and not exists (
    select 1
      from pg_type t
      join pg_enum e on e.enumtypid = t.oid
     where t.typnamespace = 'public'::regnamespace
       and t.typname = 'queue_type'
       and e.enumlabel = v_type
  ) then
    raise exception 'unknown queue_type %', v_type using errcode = '22023';
  end if;

  with open_by_type as (
    select q.queue_type::text as queue_type, count(*)::bigint as n
      from public.verification_queue q
     where q.reviewed_at is null
     group by q.queue_type
  ),
  filtered as (
    select
      q.id,
      q.queue_type::text as queue_type,
      q.supplier_a_id,
      q.supplier_b_name,
      q.confidence,
      q.source_data,
      q.admin_action::text as admin_action,
      q.reviewed_at,
      q.reviewed_by,
      q.created_at,
      s.slug,
      s.company_name,
      s.name_display,
      s.entity_type::text as entity_type,
      s.city,
      s.district,
      s.is_published as published,
      (
        select count(distinct sr.source_id)::int
          from public.source_records sr
         where sr.supplier_id = s.id
           and sr.source_tier in ('tier1_gov', 'tier2_industry', 'tier3_cert')
           and sr.status = 'active'
      ) as tier_coverage
    from public.verification_queue q
    left join public.suppliers s on s.id = q.supplier_a_id
   where (v_type is null or q.queue_type::text = v_type)
     and (
       v_status = 'all'
       or (v_status = 'open' and q.reviewed_at is null)
       or (v_status = 'reviewed' and q.reviewed_at is not null)
     )
  ),
  page as (
    select *
      from filtered
     order by created_at desc
     limit v_limit offset v_offset
  )
  select jsonb_build_object(
    'total', (select count(*) from filtered),
    'by_type', coalesce((
      select jsonb_object_agg(queue_type, n order by queue_type)
        from open_by_type
    ), '{}'::jsonb),
    'rows', coalesce((
      select jsonb_agg(jsonb_build_object(
        'queue_id',        p.id,
        'queue_type',      p.queue_type,
        'supplier_b_name', p.supplier_b_name,
        'confidence',      p.confidence,
        'source_data',     p.source_data,
        'admin_action',    p.admin_action,
        'reviewed_at',     p.reviewed_at,
        'reviewed_by',     p.reviewed_by,
        'created_at',      p.created_at,
        'supplier', case when p.supplier_a_id is null then null else jsonb_build_object(
          'id',            p.supplier_a_id,
          'slug',          p.slug,
          'company_name',  p.company_name,
          'name_display',  p.name_display,
          'entity_type',   p.entity_type,
          'city',          p.city,
          'district',      p.district,
          'published',     p.published,
          'tier_coverage', p.tier_coverage
        ) end
      ) order by p.created_at desc)
      from page p
    ), '[]'::jsonb)
  ) into v_out;

  return v_out;
end;
$$;

comment on function public.admin_queue_list(text, text, int, int) is
  'Admin-only unified verification queue listing for /admin/queue. Excludes '
  'contact PII and exposes only queue metadata plus supplier triage fields.';

revoke all on function public.admin_queue_list(text, text, int, int) from public;
grant execute on function public.admin_queue_list(text, text, int, int) to authenticated;

create or replace function public.admin_queue_decide(
  p_queue_id uuid,
  p_decision text,
  p_note     text default null
) returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid      uuid := auth.uid();
  v_role     text;
  v_decision text := lower(coalesce(nullif(btrim(p_decision), ''), ''));
  v_note     text := nullif(btrim(coalesce(p_note, '')), '');
  v_queue    public.verification_queue%rowtype;
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
  if v_decision not in ('approve', 'reject', 'escalate') then
    raise exception 'decision must be approve|reject|escalate' using errcode = '22023';
  end if;

  select *
    into v_queue
    from public.verification_queue
   where id = p_queue_id
   for update;

  if v_queue.id is null then
    raise exception 'queue row not found' using errcode = 'P0002';
  end if;
  if v_queue.reviewed_at is not null then
    raise exception 'queue row already decided' using errcode = 'P0002';
  end if;
  if v_queue.queue_type::text in ('cert_doc_review', 'sanctions_hit') then
    raise exception 'use the dedicated % decision flow', v_queue.queue_type::text
      using errcode = '22023';
  end if;

  update public.verification_queue
     set reviewed_at  = now(),
         reviewed_by  = v_uid,
         admin_action = v_decision::public.queue_action
   where id = p_queue_id;

  insert into public.admin_audit_log (actor_id, action, target_table, target_id, patch, metadata)
  values (
    v_uid,
    'admin_queue_decide',
    'verification_queue',
    p_queue_id,
    jsonb_build_object('decision', v_decision, 'note', v_note),
    jsonb_build_object(
      'queue_type', v_queue.queue_type::text,
      'supplier_id', v_queue.supplier_a_id,
      'supplier_b_name', v_queue.supplier_b_name
    )
  );

  return jsonb_build_object(
    'ok', true,
    'queue_id', p_queue_id,
    'queue_type', v_queue.queue_type::text,
    'decision', v_decision
  );
end;
$$;

comment on function public.admin_queue_decide(uuid, text, text) is
  'Admin-only generic verification queue decision. Closes non-specialized '
  'verification_queue rows and writes admin_audit_log; does not mutate '
  'suppliers or source records.';

revoke all on function public.admin_queue_decide(uuid, text, text) from public;
grant execute on function public.admin_queue_decide(uuid, text, text) to authenticated;
