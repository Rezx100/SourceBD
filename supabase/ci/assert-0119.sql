-- rl_check after 0119, asserted by running it: the three newer email buckets are accepted, the five older ones
-- and the app's route classes still are, an unknown bucket is still refused, and the grants are what they were.
\set ON_ERROR_STOP on

begin;

do $$
declare
  b text;
  r jsonb;
begin
  foreach b in array array[
    'email:welcome', 'email:rfq_received', 'email:cert_expiry', 'email:sanction_alert', 'email:password_reset',
    'email:team_invite', 'email:saved_search_alert', 'email:contact_lead',
    'auth', 'api_read', 'api_write', 'api_export', 'public_marketing'
  ]
  loop
    r := public.rl_check(b, 'ci-0119', 2);
    if (r->>'ok')::boolean is not true then
      raise exception 'bucket % was refused or over its limit on the first call: %', b, r;
    end if;
  end loop;

  -- The limit still bites on a new bucket: the third call within the minute is over a limit of 2.
  perform public.rl_check('email:team_invite', 'ci-0119', 2);
  r := public.rl_check('email:team_invite', 'ci-0119', 2);
  if (r->>'ok')::boolean then
    raise exception 'email:team_invite is not limited: %', r;
  end if;

  begin
    perform public.rl_check('email:not_a_template', 'ci-0119', 2);
    raise exception 'an unknown email bucket was accepted';
  exception when sqlstate '22023' then
    null;
  end;
  begin
    perform public.rl_check('not_a_class', 'ci-0119', 2);
    raise exception 'an unknown bucket was accepted';
  exception when sqlstate '22023' then
    null;
  end;

  -- Still a security definer limiter that signed-out callers cannot reach.
  if not (select prosecdef from pg_proc where oid = 'public.rl_check(text, text, integer)'::regprocedure) then
    raise exception 'rl_check is no longer security definer';
  end if;
  if has_function_privilege('anon', 'public.rl_check(text, text, integer)', 'execute') then
    raise exception 'anon can execute rl_check';
  end if;
  if not has_function_privilege('authenticated', 'public.rl_check(text, text, integer)', 'execute') then
    raise exception 'authenticated lost execute on rl_check';
  end if;
end
$$;

rollback;
