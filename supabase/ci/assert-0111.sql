-- Behaviour of Team and roles after 0111, asserted by running it: the owner
-- invites, the invited buyer accepts with the emailed token and joins with
-- the role; a wrong account, a used, cancelled or expired link is refused;
-- members cannot change the team; resend waits 10 minutes and replaces the
-- token; nobody reads the tables around the RPCs; anon calls nothing.
\set ON_ERROR_STOP on

begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-00000000a111', 'Owner-0111@example.invalid', '{"role":"buyer"}'::jsonb),
  ('00000000-0000-4000-8000-00000000b111', 'b-0111@example.invalid', '{"role":"buyer"}'::jsonb),
  ('00000000-0000-4000-8000-00000000c111', 'c-0111@example.invalid', '{"role":"buyer"}'::jsonb),
  ('00000000-0000-4000-8000-00000000d111', 'd-0111@example.invalid', '{"role":"supplier"}'::jsonb)
on conflict do nothing;

do $$
declare
  a     constant uuid := '00000000-0000-4000-8000-00000000a111';
  b     constant uuid := '00000000-0000-4000-8000-00000000b111';
  c     constant uuid := '00000000-0000-4000-8000-00000000c111';
  d     constant uuid := '00000000-0000-4000-8000-00000000d111';
  sent  jsonb;
  team  jsonb;
  tok_b text;
  tok_c text;
  tok_d text;
  id_c  uuid;
  hit   text;
  fn    text;
begin
  foreach fn in array array[
    'public.profile_touch()', 'public.workspace_team()', 'public.workspace_invite(text[], text)',
    'public.workspace_invite_resend(uuid)', 'public.workspace_invite_cancel(uuid)',
    'public.workspace_invite_accept(text)', 'public.workspace_member_set_role(uuid, text)',
    'public.workspace_member_remove(uuid)'] loop
    if has_function_privilege('anon', fn, 'execute') then
      raise exception 'anon can execute %', fn;
    end if;
  end loop;
  if has_function_privilege('authenticated', 'public._workspace_require_owner()', 'execute') then
    raise exception 'authenticated can execute the owner guard';
  end if;

  set local role authenticated;

  -- Nobody reads or writes the tables directly.
  perform set_config('request.jwt.claim.sub', a::text, true);
  begin
    perform 1 from public.workspace_invites;
    raise exception 'authenticated read workspace_invites';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.workspace_members (owner_id, member_id, role) values (a, b, 'editor');
    raise exception 'authenticated wrote workspace_members';
  exception when insufficient_privilege then null;
  end;

  -- The owner invites; their own address comes back as "you".
  sent := public.workspace_invite(array['B-0111@example.invalid ', 'c-0111@example.invalid', 'owner-0111@example.invalid', 'd-0111@example.invalid'], 'editor');
  if jsonb_array_length(sent) <> 4
     or (select count(*) from jsonb_array_elements(sent) e where e->>'status' = 'sent') <> 3
     or not exists (select 1 from jsonb_array_elements(sent) e where e->>'status' = 'you') then
    raise exception 'invite returned %', sent;
  end if;
  select e->>'token' into tok_b from jsonb_array_elements(sent) e where e->>'email' = 'b-0111@example.invalid';
  select e->>'token', (e->>'id')::uuid into tok_c, id_c from jsonb_array_elements(sent) e where e->>'email' = 'c-0111@example.invalid';
  select e->>'token' into tok_d from jsonb_array_elements(sent) e where e->>'email' = 'd-0111@example.invalid';

  begin
    perform public.workspace_invite(array['x@example.invalid'], 'owner');
    raise exception 'an owner invite was accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.workspace_invite(array(select 'p' || g || '@example.invalid' from generate_series(1, 21) g), 'viewer');
    raise exception '21 emails were accepted';
  exception when invalid_parameter_value then null;
  end;

  team := public.workspace_team();
  if team->>'my_role' <> 'owner' or jsonb_array_length(team->'members') <> 1
     or jsonb_array_length(team->'invites') <> 3 or (team->'members'->0->>'is_you')::boolean is not true then
    raise exception 'owner team read %', team;
  end if;

  -- C cannot use B's link.
  perform set_config('request.jwt.claim.sub', c::text, true);
  begin
    perform public.workspace_invite_accept(tok_b);
    raise exception 'C accepted B''s invite';
  exception when insufficient_privilege then hit := sqlerrm;
  end;
  if hit <> 'wrong_email' then raise exception 'wrong account said %', hit; end if;

  -- A supplier account cannot join.
  perform set_config('request.jwt.claim.sub', d::text, true);
  begin
    perform public.workspace_invite_accept(tok_d);
    raise exception 'a supplier joined a team';
  exception when insufficient_privilege then null;
  end;

  -- B joins as an editor and sees the team, not its invites.
  perform set_config('request.jwt.claim.sub', b::text, true);
  if public.workspace_invite_accept(tok_b)->>'role' <> 'editor' then
    raise exception 'B did not join as an editor';
  end if;
  team := public.workspace_team();
  if team->>'my_role' <> 'editor' or team->>'owner_id' <> a::text
     or jsonb_array_length(team->'members') <> 2 or jsonb_array_length(team->'invites') <> 0 then
    raise exception 'member team read %', team;
  end if;
  begin
    perform public.workspace_invite_accept(tok_b);
    raise exception 'a used link worked twice';
  exception when no_data_found then null;
  end;
  begin
    perform public.workspace_invite(array['z@example.invalid'], 'viewer');
    raise exception 'a member invited';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.workspace_member_set_role(b, 'approver');
    raise exception 'a member changed a role';
  exception when insufficient_privilege then null;
  end;
  perform public.profile_touch();

  -- Resend waits 10 minutes, then replaces the token.
  perform set_config('request.jwt.claim.sub', a::text, true);
  begin
    perform public.workspace_invite_resend(id_c);
    raise exception 'resent inside 10 minutes';
  exception when program_limit_exceeded then null;
  end;
  reset role;
  update public.workspace_invites set sent_at = now() - interval '11 minutes' where id = id_c;
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', a::text, true);
  sent := public.workspace_invite_resend(id_c);
  if sent->>'token' = tok_c then raise exception 'resend kept the old token'; end if;

  perform set_config('request.jwt.claim.sub', c::text, true);
  begin
    perform public.workspace_invite_accept(tok_c);
    raise exception 'the replaced token still worked';
  exception when no_data_found then null;
  end;

  -- Expired.
  reset role;
  update public.workspace_invites set expires_at = now() - interval '1 second' where id = id_c;
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', c::text, true);
  begin
    perform public.workspace_invite_accept(sent->>'token');
    raise exception 'an expired invite worked';
  exception when invalid_parameter_value then hit := sqlerrm;
  end;
  if hit <> 'expired' then raise exception 'expired said %', hit; end if;

  -- Cancelled.
  perform set_config('request.jwt.claim.sub', a::text, true);
  perform public.workspace_invite_cancel(id_c);
  team := public.workspace_team();
  if jsonb_array_length(team->'invites') <> 1 then
    raise exception 'the cancelled invite is still listed: %', team;
  end if;

  -- The owner changes B's role; B leaves.
  perform public.workspace_member_set_role(b, 'approver');
  perform set_config('request.jwt.claim.sub', b::text, true);
  if public.workspace_team()->>'my_role' <> 'approver' then
    raise exception 'the role change did not land';
  end if;
  perform public.workspace_member_remove(b);
  if public.workspace_team()->>'my_role' <> 'owner' then
    raise exception 'B is still in the team after leaving';
  end if;

  reset role;
  if (select last_active_at from public.profiles where id = b) is null then
    raise exception 'profile_touch did not stamp';
  end if;
end
$$;

rollback;
