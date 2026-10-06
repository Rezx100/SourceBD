-- 0119 — rl_check accepts the three newer email buckets (6 Oct 2026).
--
-- sendEmail() limits each recipient through rl_check('email:<template>', ...). rl_check refuses a bucket it does
-- not know ("bucket not allowed"), and the limiter fails OPEN on any error (lib/rate-limit/check.ts), so the three
-- templates added after the allow-list was written were never limited per recipient: team_invite, saved_search_alert
-- and contact_lead. This adds them. (api_export, the class this was first suspected of missing, is already live:
-- 0104 added it.)
--
-- It patches the LIVE definition, not a copy from the repo: production's rl_check is read with
-- pg_get_functiondef, the three names are inserted after 'email:password_reset', and the result is executed.
-- Everything else in the function (the anon guard, the 5-minute purge, the window, the grants) stays as it runs
-- today. `create or replace` keeps the grants and the comment. If the anchor is not there, or a name did not
-- land, the migration stops instead of guessing.
--
-- Idempotent: a name that is already listed is left alone.
--
-- Do not apply to production from this PR (AGENTS rule 15); the founder applies it after the dry run in
-- ops/plans/0118-0119-dry-run.md.
--
-- Reversible: re-run this with the three names removed from the array, or restore the 20260725 body.

set search_path = public;

do $$
declare
  v_def text := pg_get_functiondef('public.rl_check(text, text, integer)'::regprocedure);
  v_new text := v_def;
  v_name text;
begin
  foreach v_name in array array['email:team_invite', 'email:saved_search_alert', 'email:contact_lead']
  loop
    if position(quote_literal(v_name) in v_new) = 0 then
      if position('''email:password_reset''' in v_new) = 0 then
        raise exception 'rl_check has no email:password_reset anchor; patch by hand';
      end if;
      v_new := replace(v_new, '''email:password_reset''', '''email:password_reset'', ' || quote_literal(v_name));
    end if;
    if position(quote_literal(v_name) in v_new) = 0 then
      raise exception 'rl_check patch did not add %', v_name;
    end if;
  end loop;

  if v_new <> v_def then
    execute v_new;
  end if;
end
$$;
