-- 0115 — Where an account is signed in, and ending one of those sessions (5 Oct 2026).
--
-- Spec: context/feature-specs/gap-06-security-settings.md (gap list row 6).
--
-- Supabase Auth keeps every sign-in as a row in auth.sessions, which the API does not expose. Two calls
-- let the buyer's own Settings read and end THEIR sessions (nobody else's):
--
--   1. account_sessions() lists the caller's live sessions: id, when it started, when it was last active,
--      the browser's user agent, and whether it is the one making the call (the JWT's session_id).
--      The address (ip) is not returned: the page names the browser and the time, and an address the
--      buyer cannot verify is a worse claim than none.
--   2. account_session_end(id) ends one other session: the row is deleted, which also removes its
--      refresh tokens, so it cannot renew. Its short-lived access token may work until it expires (up to
--      an hour); that is how Auth works and the page says "signed out" only for sessions that are gone.
--      The current session is refused (that is Sign out). A session that is not the caller's, or does not
--      exist, answers false and changes nothing.
--
-- "Sign out everywhere else" is not here: the Auth API does it (`signOut({ scope: 'others' })`).
-- Two-step sign-in is Auth's too (MFA, TOTP): no table or function of ours.
--
-- Hard invariants honoured:
--   * Server enforces auth + ownership: both calls are SECURITY DEFINER with a pinned search_path and
--     touch only auth.uid()'s rows; both revoke anon (and public) by name (0105's finding).
--   * plpgsql, not sql, so the body is not checked against auth.sessions when the function is created.
--
-- Idempotent and additive: `create or replace`. No existing row changes.
--
-- Do not apply to production from this PR (AGENTS rule 15); the founder applies it after the dry run
-- in ops/plans/0115-dry-run.md.
--
-- Reversible:
--   drop function public.account_session_end(uuid);
--   drop function public.account_sessions();

set search_path = public;

create or replace function public.account_sessions()
returns table (
  id             uuid,
  created_at     timestamptz,
  last_active_at timestamptz,
  user_agent     text,
  is_current     boolean
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_uid     uuid := auth.uid();
  v_current uuid := nullif(auth.jwt() ->> 'session_id', '')::uuid;
begin
  if v_uid is null then
    return;
  end if;
  return query
    select s.id,
           s.created_at,
           coalesce(s.refreshed_at at time zone 'utc', s.updated_at, s.created_at),
           s.user_agent,
           (s.id = v_current)
      from auth.sessions s
     where s.user_id = v_uid
       and (s.not_after is null or s.not_after > now())
     order by coalesce(s.refreshed_at at time zone 'utc', s.updated_at, s.created_at) desc, s.id;
end;
$$;

revoke all     on function public.account_sessions() from public, anon;
grant  execute on function public.account_sessions() to authenticated;

create or replace function public.account_session_end(p_session_id uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, auth
as $$
declare
  v_uid     uuid := auth.uid();
  v_current uuid := nullif(auth.jwt() ->> 'session_id', '')::uuid;
  v_n       int;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_session_id is null or p_session_id = v_current then
    return false;
  end if;
  delete from auth.sessions s where s.id = p_session_id and s.user_id = v_uid;
  get diagnostics v_n = row_count;
  return v_n > 0;
end;
$$;

revoke all     on function public.account_session_end(uuid) from public, anon;
grant  execute on function public.account_session_end(uuid) to authenticated;
