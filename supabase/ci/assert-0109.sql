-- Behaviour of the onboarding answers after 0109, asserted by running it:
-- a buyer saves and reads back their own answers, a step that sends one key
-- leaves the others alone, bad answers are refused, and nobody can write the
-- columns around the RPC.
\set ON_ERROR_STOP on

begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-00000000d109', 'ci-0109@example.invalid', '{"role":"buyer"}'::jsonb)
on conflict do nothing;

do $$
declare
  got  jsonb;
  bad  jsonb;
  hit  boolean;
begin
  if has_function_privilege('anon', 'public.onboarding_save_buyer(jsonb)', 'execute')
     or has_function_privilege('anon', 'public.onboarding_get_buyer()', 'execute') then
    raise exception 'anon can execute an onboarding RPC';
  end if;

  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000d109', true);

  -- The whole first pass: lower-case country, a repeated heading.
  perform public.onboarding_save_buyer(
    '{"job_role":"compliance","terms_version":"2026-10","company_country":"gb",
      "sourcing_hs_headings":["6105","6203","6105"],"required_cert_kinds":["gots","wrap"],
      "sell_markets":["UK","EU"]}'::jsonb);
  got := public.onboarding_get_buyer();
  if got->>'job_role' is distinct from 'compliance' or got->>'company_country' is distinct from 'GB'
     or got->'sourcing_hs_headings' is distinct from '["6105","6203"]'::jsonb
     or got->'required_cert_kinds' @> '["gots","wrap"]'::jsonb is not true
     or got->'sell_markets' is distinct from '["EU","UK"]'::jsonb
     or got->>'terms_version' is distinct from '2026-10' or got->>'terms_accepted_at' is null then
    raise exception 'the saved answers did not read back: %', got;
  end if;

  -- One step sends one key; everything else stays.
  perform public.onboarding_save_buyer('{"sell_markets":["US"]}'::jsonb);
  got := public.onboarding_get_buyer();
  if got->'sell_markets' is distinct from '["US"]'::jsonb or got->>'job_role' is distinct from 'compliance'
     or got->>'company_country' is distinct from 'GB' then
    raise exception 'a one-key save changed other answers: %', got;
  end if;

  -- Each of these must be refused with 22023.
  foreach bad in array array[
    '{"job_role":"ceo"}', '{"company_country":"GBR"}', '{"sourcing_hs_headings":["61"]}',
    '{"sourcing_hs_headings":["61a5"]}', '{"required_cert_kinds":["iso27001"]}',
    '{"sell_markets":["FR"]}', '{"terms_version":null}']::jsonb[]
  loop
    hit := false;
    begin
      perform public.onboarding_save_buyer(bad);
    exception when sqlstate '22023' then
      hit := true;
    end;
    if not hit then
      raise exception 'onboarding_save_buyer accepted %', bad;
    end if;
  end loop;

  -- No way around the RPC: RLS gives the caller no update on either table.
  begin
    update public.profiles set job_role = 'other', terms_accepted_at = null, terms_version = null
     where id = auth.uid();
  exception when insufficient_privilege then null;
  end;
  begin
    update public.buyer_settings set company_country = 'US' where owner_id = auth.uid();
  exception when insufficient_privilege then null;
  end;
  got := public.onboarding_get_buyer();
  if got->>'job_role' is distinct from 'compliance' or got->>'company_country' is distinct from 'GB'
     or got->>'terms_accepted_at' is null then
    raise exception 'a direct update got past the RPC: %', got;
  end if;

  -- Signed out: nothing.
  perform set_config('request.jwt.claim.sub', '', true);
  hit := false;
  begin
    perform public.onboarding_save_buyer('{"job_role":"other"}'::jsonb);
  exception when sqlstate '42501' then
    hit := true;
  end;
  if not hit then
    raise exception 'onboarding_save_buyer ran with no signed-in user';
  end if;
  reset role;
end
$$;

rollback;
