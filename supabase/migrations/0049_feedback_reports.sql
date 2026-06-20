-- Phase 7 P3 — In-app feedback loop.

create table if not exists public.feedback_reports (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete set null,
  page_path   text not null check (char_length(page_path) between 1 and 500),
  message     text not null check (char_length(message) between 10 and 4000),
  status      text not null default 'open'
                check (status in ('open', 'triaged', 'closed')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_feedback_reports_status_created
  on public.feedback_reports (status, created_at desc);

alter table public.feedback_reports enable row level security;

create or replace function public.feedback_submit(
  p_page_path text,
  p_message text
) returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
begin
  if v_uid is null then
    raise insufficient_privilege using message = 'sign in required';
  end if;

  insert into public.feedback_reports (user_id, page_path, message)
  values (v_uid, trim(p_page_path), trim(p_message))
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.feedback_admin_list(
  p_status text default 'open',
  p_limit int default 50,
  p_offset int default 0
) returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_rows jsonb;
  v_total bigint;
begin
  select p.role::text into v_role from public.profiles p where p.id = v_uid;
  if v_role is distinct from 'admin' then
    raise insufficient_privilege using message = 'admin only';
  end if;

  select count(*) into v_total
    from public.feedback_reports fr
   where p_status is null or fr.status = p_status;

  select coalesce(jsonb_agg(row_to_json(t)::jsonb order by t.created_at desc), '[]'::jsonb)
    into v_rows
    from (
      select
        fr.id,
        fr.user_id,
        fr.page_path,
        fr.message,
        fr.status,
        fr.created_at,
        fr.updated_at,
        u.email as user_email
      from public.feedback_reports fr
      left join auth.users u on u.id = fr.user_id
      where p_status is null or fr.status = p_status
      order by fr.created_at desc
      limit greatest(1, least(p_limit, 100))
      offset greatest(0, p_offset)
    ) t;

  return jsonb_build_object('total', v_total, 'rows', v_rows);
end;
$$;

create or replace function public.feedback_admin_set_status(
  p_id uuid,
  p_status text
) returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
begin
  select p.role::text into v_role from public.profiles p where p.id = v_uid;
  if v_role is distinct from 'admin' then
    raise insufficient_privilege using message = 'admin only';
  end if;

  if p_status not in ('open', 'triaged', 'closed') then
    raise exception 'invalid status' using errcode = '22023';
  end if;

  update public.feedback_reports
     set status = p_status,
         updated_at = now()
   where id = p_id;

  return found;
end;
$$;

revoke all on function public.feedback_submit(text, text) from public;
grant execute on function public.feedback_submit(text, text) to authenticated;

revoke all on function public.feedback_admin_list(text, int, int) from public;
grant execute on function public.feedback_admin_list(text, int, int) to authenticated;

revoke all on function public.feedback_admin_set_status(uuid, text) from public;
grant execute on function public.feedback_admin_set_status(uuid, text) to authenticated;
