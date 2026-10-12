-- 0145 — A supplier's contact details, shown to buyers on Growth and above (12 Oct 2026).
--
-- WHY. Until now no contact VALUE reached a browser: 0083 revoked the contact columns from
-- `authenticated`, and the record's card said only how many are on file (0105). The founder decided
-- on 12 Oct 2026 to show the details as the database stores them, from the Growth plan. The columns
-- stay revoked; this one security-definer function is the only way a value leaves the table.
--
-- WHO. The gate is 0137's (`supplier_volza_exports`), word for word: the caller's profile is an
-- admin or on plan Growth or Enterprise, and is not suspended. Everyone else, a signed-out caller
-- included, gets null, and the record keeps today's locked card. Only a published supplier answers.
--
-- WHAT IT RETURNS.
--   {"emails": [text], "phones": [text], "website": text|null, "person": text|null, "role": text|null}
-- cleaned by the SAME rules `supplier_contact_counts` (0105) counts by, so the card never shows
-- more or fewer than the count beside it promised:
--   * emails   every address in `email_primary` (the field often holds two or three), in the order
--              filed, with the spaces some registers put around the '@' closed and a full stop after
--              the address dropped. Same pattern as 0105, so the same number of them.
--   * phones   the entries of `phones` holding six or more digits, as filed, one per number: the
--              first spelling of each number in its local form ("+880 1754392350", "01754392350"
--              and "1754392350" are one). Entries that run two numbers together stay one, as counted.
--   * website  the site itself, once any e-mail address in the same field is set aside; null for
--              'https://', 'http://Nil' and the like, exactly when 0105 says no website.
--   * person   `contact_name` when it is a name (three letters in a row), not a bare "Mr." or "1965".
--   * role     `contact_role`, only beside a person: a role with no name is not a contact person.
-- Null for an unknown or unpublished slug, as 0105 answers.
--
-- Additive: one new function, no table, no column, no change to any existing function.
-- Do not apply to production from this PR (AGENTS.md rule 15).
--
-- REVERSE:
--   drop function public.supplier_contact_details(text);

create or replace function public.supplier_contact_details(p_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_allowed boolean;
begin
  select (p.role = 'admin' or p.plan_tier in ('growth', 'enterprise'))
         and not coalesce(p.is_suspended, false)
    into v_allowed
    from public.profiles p
   where p.id = auth.uid();
  if not coalesce(v_allowed, false) then
    return null;
  end if;

  return (
    select jsonb_build_object(
      'emails',  coalesce((
                   select jsonb_agg(rtrim(regexp_replace(m[1], '[[:space:]]', '', 'g'), '.') order by ord)
                     from regexp_matches(coalesce(s.email_primary::text, ''),
                                         '[^@[:space:],;/]+[[:space:]]*@[[:space:]]*[^@[:space:],;/.]+[.][^@[:space:],;/]+', 'g')
                          with ordinality as e(m, ord)
                 ), '[]'::jsonb),
      'phones',  coalesce((
                   select jsonb_agg(shown order by ord)
                     from (select distinct on (local_form) btrim(ph) as shown, ord
                             from (select ph, ord,
                                          case
                                            when d ~ '^880' then substr(d, 3)
                                            when d ~ '^1[3-9][0-9]{8}$' then '0' || d
                                            else d
                                          end as local_form
                                     from (select ph, ord, regexp_replace(ph, '[^0-9]', '', 'g') as d
                                             from unnest(coalesce(s.phones, '{}'::text[])) with ordinality as u(ph, ord)) as n
                                    where length(d) >= 6) as numbered
                            order by local_form, ord) as one_each
                 ), '[]'::jsonb),
      'website', case
                   when coalesce(w.site ~* '[a-z0-9-]+[.][a-z]{2,}', false)
                   then rtrim((regexp_match(w.site, '[^[:space:],;]*[a-z0-9-]+[.][a-z]{2,}[^[:space:],;]*', 'i'))[1], '.')
                 end,
      'person',  case when s.contact_name ~ '[[:alpha:]]{3}' then btrim(s.contact_name) end,
      'role',    case when s.contact_name ~ '[[:alpha:]]{3}' then nullif(btrim(s.contact_role), '') end
    )
      from public.suppliers s
     cross join lateral (
       select regexp_replace(s.website, '[^[:space:],;/]+@[^[:space:],;]+', '', 'g') as site
     ) as w
     where s.slug = p_slug
       and s.is_published = true
     limit 1);
end;
$$;

comment on function public.supplier_contact_details(text) is
  'The contact details of a published supplier (emails, phones, website, contact person and role), cleaned as '
  'supplier_contact_counts counts them, for admins and Growth/Enterprise buyers who are not suspended; null '
  'for everyone else and for an unknown or unpublished slug. 0145.';

-- Supabase grants EXECUTE on new functions to `anon` and `authenticated` BY NAME, and a revoke from
-- PUBLIC does not touch a named grant (0105 found `anon` still holding it). So `anon` by name.
revoke all on function public.supplier_contact_details(text) from public;
revoke all on function public.supplier_contact_details(text) from anon;
grant execute on function public.supplier_contact_details(text) to authenticated, service_role;
