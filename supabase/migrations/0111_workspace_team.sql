-- 0111 — Team and roles: members, invites and last active (5 Oct 2026).
--
-- Spec: context/feature-specs/gap-04-team-and-roles.md (gap list row 4).
--
-- A workspace is a buyer's account. Its id is the owner's user id: there is
-- one owner per workspace and no way to hand one over, so a `workspaces`
-- table would hold nothing but that id.
--
--   1. workspace_members: who else is in an owner's workspace, as Approver,
--      Editor or Viewer. A person is in at most one other workspace.
--   2. workspace_invites: an emailed invite, stored by the hash of its token,
--      valid 7 days, resendable five times, kept (not deleted) when cancelled
--      or accepted so the daily cap below counts them.
--   3. profiles.last_active_at, stamped at most every 10 minutes by
--      profile_touch(), for "Last active" / "Active now".
--   4. The RPCs: workspace_team() reads the team; workspace_invite,
--      workspace_invite_resend, workspace_invite_cancel, workspace_member_set_role
--      and workspace_member_remove are the owner's; workspace_invite_accept is
--      the invited person's; a member may also remove themselves (leave).
--
-- Not here, on purpose (spec section "Next"): what a member can SEE of the
-- owner's saved suppliers, RFQs, orders and the rest. Every buyer table and
-- RPC is keyed by auth.uid() today; reading by workspace is gap 4b, one table
-- group per migration. Until then a member is listed in the team and nothing
-- else changes for anyone.
--
-- Hard invariants honoured:
--   * Server enforces auth + ownership: both tables have RLS on, no policy and
--     no table grant for anon or authenticated; every RPC is SECURITY DEFINER
--     with `set search_path = public`, checks auth.uid() itself and revokes
--     `anon` by name (0105's finding).
--   * A raw invite token is returned once, to the owner who made it, for the
--     email; only its sha256 is stored (0032's pattern).
--   * Accepting needs the signed-in user's own email to be the invited one,
--     a buyer account, and no team of their own.
--   * Caps: 20 emails per call, 50 people (members plus open invites) per
--     workspace, 50 invites made per workspace per day, 5 sends per invite,
--     one resend per 10 minutes.
--
-- Idempotent: `if not exists`, `create or replace`, constraints and indexes
-- dropped or guarded before they are added. Additive: no existing row changes.
--
-- Do not apply to production from this PR (AGENTS rule 15); the founder
-- applies it after the dry run in ops/plans/0111-dry-run.md.
--
-- Reversible:
--   drop function public.workspace_member_remove(uuid);
--   drop function public.workspace_member_set_role(uuid, text);
--   drop function public.workspace_invite_accept(text);
--   drop function public.workspace_invite_cancel(uuid);
--   drop function public.workspace_invite_resend(uuid);
--   drop function public.workspace_invite(text[], text);
--   drop function public.workspace_team();
--   drop function public.profile_touch();
--   drop table public.workspace_invites;
--   drop table public.workspace_members;
--   alter table public.profiles drop column last_active_at;

set search_path = public;

-- ----------------------------------------------------------------------
-- 1. Tables
-- ----------------------------------------------------------------------

create table if not exists public.workspace_members (
  owner_id   uuid        not null references auth.users(id) on delete cascade,
  member_id  uuid        not null references auth.users(id) on delete cascade,
  role       text        not null,
  invited_by uuid        references auth.users(id) on delete set null,
  joined_at  timestamptz not null default now(),
  primary key (owner_id, member_id),
  constraint workspace_members_role_check check (role in ('approver', 'editor', 'viewer')),
  constraint workspace_members_not_self check (owner_id <> member_id)
);

-- One other workspace per person, so "whose workspace am I in" has one answer.
create unique index if not exists uq_workspace_members_member on public.workspace_members (member_id);

create table if not exists public.workspace_invites (
  id           uuid        primary key default gen_random_uuid(),
  owner_id     uuid        not null references auth.users(id) on delete cascade,
  email        text        not null,
  role         text        not null,
  token_hash   text        not null,
  invited_by   uuid        references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  sent_at      timestamptz not null default now(),
  send_count   int         not null default 1,
  expires_at   timestamptz not null,
  accepted_at  timestamptz,
  accepted_by  uuid        references auth.users(id) on delete set null,
  cancelled_at timestamptz,
  constraint workspace_invites_role_check check (role in ('approver', 'editor', 'viewer')),
  constraint workspace_invites_email_check
    check (email = lower(email) and char_length(email) between 3 and 254 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  constraint workspace_invites_token_hash_check check (token_hash ~ '^[0-9a-f]{64}$'),
  constraint workspace_invites_send_count_check check (send_count between 1 and 5),
  constraint workspace_invites_closed_once check (accepted_at is null or cancelled_at is null)
);

create unique index if not exists uq_workspace_invites_token on public.workspace_invites (token_hash);
-- One open invite per email per workspace; closed ones stay for the cap.
create unique index if not exists uq_workspace_invites_open
  on public.workspace_invites (owner_id, email)
  where accepted_at is null and cancelled_at is null;
create index if not exists idx_workspace_invites_owner_created
  on public.workspace_invites (owner_id, created_at desc);

alter table public.workspace_members enable row level security;
alter table public.workspace_invites enable row level security;
-- No policies: the RPCs below are the only way in or out.
revoke all on table public.workspace_members from anon, authenticated;
revoke all on table public.workspace_invites from anon, authenticated;

alter table public.profiles add column if not exists last_active_at timestamptz;

-- ----------------------------------------------------------------------
-- 2. profile_touch(): "Last active". Writes only when the stamp is older
--    than 10 minutes, so calling it on every page is one cheap no-op.
-- ----------------------------------------------------------------------

create or replace function public.profile_touch()
returns void
language sql
volatile
security definer
set search_path = public
as $$
  update public.profiles
     set last_active_at = now()
   where id = auth.uid()
     and (last_active_at is null or last_active_at < now() - interval '10 minutes');
$$;

revoke all     on function public.profile_touch() from public, anon;
grant  execute on function public.profile_touch() to authenticated;

-- ----------------------------------------------------------------------
-- 3. workspace_team(): the caller's workspace as the Team page draws it.
--    {owner_id, my_role, members: [...], invites: [...]}. The owner comes
--    first; invites are the owner's to see (empty for everyone else).
-- ----------------------------------------------------------------------

create or replace function public.workspace_team()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_owner uuid;
  v_role  text;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select m.owner_id, m.role into v_owner, v_role
    from public.workspace_members m where m.member_id = v_uid;
  if v_owner is null then
    v_owner := v_uid;
    v_role  := 'owner';
  end if;

  return jsonb_build_object(
    'owner_id', v_owner,
    'my_role',  v_role,
    'members', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'user_id',        t.id,
               'name',           p.display_name,
               'email',          u.email,
               'role',           t.role,
               'joined_at',      t.joined_at,
               'last_active_at', p.last_active_at,
               'is_you',         t.id = v_uid)
             order by t.ord, t.joined_at, u.email), '[]'::jsonb)
        from (select v_owner as id, 'owner'::text as role, null::timestamptz as joined_at, 0 as ord
              union all
              select m.member_id, m.role, m.joined_at, 1
                from public.workspace_members m where m.owner_id = v_owner) t
        join auth.users u on u.id = t.id
        left join public.profiles p on p.id = t.id),
    'invites', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id',         i.id,
               'email',      i.email,
               'role',       i.role,
               'sent_at',    i.sent_at,
               'expires_at', i.expires_at,
               'expired',    i.expires_at <= now(),
               'can_resend', i.send_count < 5)
             order by i.sent_at desc), '[]'::jsonb)
        from public.workspace_invites i
       where v_role = 'owner'
         and i.owner_id = v_owner
         and i.accepted_at is null and i.cancelled_at is null));
end;
$$;

revoke all     on function public.workspace_team() from public, anon;
grant  execute on function public.workspace_team() to authenticated;

-- ----------------------------------------------------------------------
-- 4. The owner's guard: signed in, a buyer, and not a member of someone
--    else's workspace. Returns the owner id (the caller).
-- ----------------------------------------------------------------------

create or replace function public._workspace_require_owner()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles p where p.id = v_uid and p.role = 'buyer') then
    raise exception 'only a buyer account has a team' using errcode = '42501';
  end if;
  if exists (select 1 from public.workspace_members m where m.member_id = v_uid) then
    raise exception 'only the owner can change the team' using errcode = '42501';
  end if;
  return v_uid;
end;
$$;

revoke all on function public._workspace_require_owner() from public, anon, authenticated;

-- ----------------------------------------------------------------------
-- 5. workspace_invite(emails, role): one invite per email. Returns, per
--    email, what happened and (for a sent one) the raw token for the link:
--    [{email, status: sent | already_member | recently_sent | you, id, token}].
--    An open invite to the same email is replaced (new role, new token, new
--    7 days) and counts as a send of that invite.
-- ----------------------------------------------------------------------

create or replace function public.workspace_invite(p_emails text[], p_role text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_owner   uuid := public._workspace_require_owner();
  v_me      text;
  v_emails  text[];
  v_email   text;
  v_raw     text;
  v_id      uuid;
  v_out     jsonb := '[]'::jsonb;
  v_new     int;
begin
  if p_role is null or p_role not in ('approver', 'editor', 'viewer') then
    raise exception 'role must be approver, editor or viewer' using errcode = '22023';
  end if;
  select coalesce(array_agg(distinct lower(btrim(e))), '{}') into v_emails
    from unnest(coalesce(p_emails, '{}')) e
   where btrim(e) <> '';
  if cardinality(v_emails) = 0 then
    raise exception 'give at least one email' using errcode = '22023';
  end if;
  if cardinality(v_emails) > 20 then
    raise exception 'at most 20 emails at a time' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(v_emails) e
              where char_length(e) not between 3 and 254 or e !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') then
    raise exception 'one of the emails is not an email address' using errcode = '22023';
  end if;

  select lower(u.email) into v_me from auth.users u where u.id = v_owner;

  -- Serialise this owner's invites so the caps below cannot be raced.
  perform pg_advisory_xact_lock(hashtextextended('workspace_invite:' || v_owner::text, 0));
  -- Again under the lock: workspace_invite_accept takes the same lock, so the
  -- caller cannot join another team between the guard and the inserts.
  perform public._workspace_require_owner();

  select count(*) into v_new
    from unnest(v_emails) e
   where e is distinct from v_me
     and not exists (select 1 from public.workspace_members m join auth.users u on u.id = m.member_id
                      where m.owner_id = v_owner and lower(u.email) = e)
     and not exists (select 1 from public.workspace_invites i
                      where i.owner_id = v_owner and i.email = e
                        and i.accepted_at is null and i.cancelled_at is null);

  if (select count(*) from public.workspace_members m where m.owner_id = v_owner)
     + (select count(*) from public.workspace_invites i
         where i.owner_id = v_owner and i.accepted_at is null and i.cancelled_at is null)
     + v_new > 50 then
    raise exception 'a team holds at most 50 people, invites included' using errcode = '54000';
  end if;
  if (select count(*) from public.workspace_invites i
       where i.owner_id = v_owner and i.created_at > now() - interval '1 day') + v_new > 50 then
    raise exception 'at most 50 invites a day; try again tomorrow' using errcode = '54000';
  end if;

  foreach v_email in array v_emails loop
    if v_email = v_me then
      v_out := v_out || jsonb_build_object('email', v_email, 'status', 'you');
      continue;
    end if;
    if exists (select 1 from public.workspace_members m join auth.users u on u.id = m.member_id
                where m.owner_id = v_owner and lower(u.email) = v_email) then
      v_out := v_out || jsonb_build_object('email', v_email, 'status', 'already_member');
      continue;
    end if;
    -- Inviting again is a resend, and waits as one does.
    if exists (select 1 from public.workspace_invites i
                where i.owner_id = v_owner and i.email = v_email
                  and i.accepted_at is null and i.cancelled_at is null
                  and i.sent_at > now() - interval '10 minutes') then
      v_out := v_out || jsonb_build_object('email', v_email, 'status', 'recently_sent');
      continue;
    end if;

    v_raw := encode(extensions.gen_random_bytes(32), 'hex');
    v_id  := null;

    update public.workspace_invites i
       set role       = p_role,
           token_hash = encode(extensions.digest(v_raw, 'sha256'), 'hex'),
           invited_by = v_owner,
           sent_at    = now(),
           send_count = i.send_count + 1,
           expires_at = now() + interval '7 days'
     where i.owner_id = v_owner and i.email = v_email
       and i.accepted_at is null and i.cancelled_at is null
       and i.send_count < 5
    returning i.id into v_id;

    if v_id is null then
      if exists (select 1 from public.workspace_invites i
                  where i.owner_id = v_owner and i.email = v_email
                    and i.accepted_at is null and i.cancelled_at is null) then
        raise exception 'the invite to % has been sent five times; cancel it and invite again', v_email
          using errcode = '54000';
      end if;
      insert into public.workspace_invites (owner_id, email, role, token_hash, invited_by, expires_at)
      values (v_owner, v_email, p_role, encode(extensions.digest(v_raw, 'sha256'), 'hex'), v_owner,
              now() + interval '7 days')
      returning id into v_id;
    end if;

    v_out := v_out || jsonb_build_object('email', v_email, 'status', 'sent', 'id', v_id, 'token', v_raw);
  end loop;

  return v_out;
end;
$$;

revoke all     on function public.workspace_invite(text[], text) from public, anon;
grant  execute on function public.workspace_invite(text[], text) to authenticated;

-- ----------------------------------------------------------------------
-- 6. Resend and cancel, the owner's, on an open invite.
-- ----------------------------------------------------------------------

create or replace function public.workspace_invite_resend(p_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_owner uuid := public._workspace_require_owner();
  v_inv   public.workspace_invites;
  v_raw   text := encode(extensions.gen_random_bytes(32), 'hex');
begin
  select * into v_inv from public.workspace_invites i
   where i.id = p_id and i.owner_id = v_owner
     and i.accepted_at is null and i.cancelled_at is null
   for update;
  if not found then
    raise exception 'no open invite with that id' using errcode = 'P0002';
  end if;
  if v_inv.send_count >= 5 then
    raise exception 'this invite has been sent five times; cancel it and invite again' using errcode = '54000';
  end if;
  if v_inv.sent_at > now() - interval '10 minutes' then
    raise exception 'this invite was sent less than 10 minutes ago' using errcode = '54000';
  end if;

  update public.workspace_invites i
     set token_hash = encode(extensions.digest(v_raw, 'sha256'), 'hex'),
         sent_at    = now(),
         send_count = i.send_count + 1,
         expires_at = now() + interval '7 days'
   where i.id = v_inv.id;

  return jsonb_build_object('id', v_inv.id, 'email', v_inv.email, 'role', v_inv.role, 'token', v_raw);
end;
$$;

revoke all     on function public.workspace_invite_resend(uuid) from public, anon;
grant  execute on function public.workspace_invite_resend(uuid) to authenticated;

create or replace function public.workspace_invite_cancel(p_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_owner uuid := public._workspace_require_owner();
begin
  update public.workspace_invites i
     set cancelled_at = now()
   where i.id = p_id and i.owner_id = v_owner
     and i.accepted_at is null and i.cancelled_at is null;
  if not found then
    raise exception 'no open invite with that id' using errcode = 'P0002';
  end if;
end;
$$;

revoke all     on function public.workspace_invite_cancel(uuid) from public, anon;
grant  execute on function public.workspace_invite_cancel(uuid) to authenticated;

-- ----------------------------------------------------------------------
-- 7. workspace_invite_accept(token): the invited person joins.
--    Returns {owner_id, role}. Every refusal is one of four plain reasons so
--    the page can say which: not_found (also a used or cancelled link),
--    expired, wrong_email, has_team (already in a team, or owns one).
-- ----------------------------------------------------------------------

create or replace function public.workspace_invite_accept(p_token text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_inv public.workspace_invites;
  v_me  text;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  select * into v_inv from public.workspace_invites i
   where i.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
     and i.accepted_at is null and i.cancelled_at is null
   for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v_inv.expires_at <= now() then
    raise exception 'expired' using errcode = '22023';
  end if;
  -- The lock workspace_invite holds for this user as an owner, so they
  -- cannot send invites of their own while joining.
  perform pg_advisory_xact_lock(hashtextextended('workspace_invite:' || v_uid::text, 0));

  select lower(u.email) into v_me from auth.users u where u.id = v_uid;
  if v_me is distinct from v_inv.email then
    raise exception 'wrong_email' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles p where p.id = v_uid and p.role = 'buyer') then
    raise exception 'wrong_email' using errcode = '42501';
  end if;
  if v_uid = v_inv.owner_id
     or exists (select 1 from public.workspace_members m where m.member_id = v_uid or m.owner_id = v_uid)
     or exists (select 1 from public.workspace_invites i
                 where i.owner_id = v_uid and i.accepted_at is null and i.cancelled_at is null) then
    raise exception 'has_team' using errcode = '23505';
  end if;

  insert into public.workspace_members (owner_id, member_id, role, invited_by)
  values (v_inv.owner_id, v_uid, v_inv.role, v_inv.invited_by);

  update public.workspace_invites i
     set accepted_at = now(), accepted_by = v_uid
   where i.id = v_inv.id;

  return jsonb_build_object('owner_id', v_inv.owner_id, 'role', v_inv.role);
end;
$$;

revoke all     on function public.workspace_invite_accept(text) from public, anon;
grant  execute on function public.workspace_invite_accept(text) to authenticated;

-- ----------------------------------------------------------------------
-- 8. Change a member's role (owner) and remove a member (owner, or the
--    member themselves: "Leave team").
-- ----------------------------------------------------------------------

create or replace function public.workspace_member_set_role(p_member uuid, p_role text)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_owner uuid := public._workspace_require_owner();
begin
  if p_role is null or p_role not in ('approver', 'editor', 'viewer') then
    raise exception 'role must be approver, editor or viewer' using errcode = '22023';
  end if;
  update public.workspace_members m
     set role = p_role
   where m.owner_id = v_owner and m.member_id = p_member;
  if not found then
    raise exception 'no member with that id' using errcode = 'P0002';
  end if;
end;
$$;

revoke all     on function public.workspace_member_set_role(uuid, text) from public, anon;
grant  execute on function public.workspace_member_set_role(uuid, text) to authenticated;

create or replace function public.workspace_member_remove(p_member uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  delete from public.workspace_members m
   where m.member_id = p_member
     and (m.owner_id = v_uid or m.member_id = v_uid);
  if not found then
    raise exception 'no member with that id' using errcode = 'P0002';
  end if;
end;
$$;

revoke all     on function public.workspace_member_remove(uuid) from public, anon;
grant  execute on function public.workspace_member_remove(uuid) to authenticated;
