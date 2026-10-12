-- 0145 — A supplier's contact details, shown to buyers on Growth and above (12 Oct 2026).
--
-- WHY. Until now no contact VALUE reached a browser: 0083 revoked the contact columns from
-- `authenticated`, and the record's card said only how many are on file (0105). The founder decided
-- on 12 Oct 2026 to show the details as the database stores them, from the Growth plan. The columns
-- stay revoked; this one security-definer function is the only way a value leaves the table.
--
-- WHO. The gate is 0137's (`supplier_volza_exports`): the caller's profile is an admin or on plan
-- Growth or Enterprise, and is not suspended. Everyone else, a signed-out caller included, gets null,
-- and the record keeps today's locked card. Only a published supplier answers, and never a sanctioned
-- one: SourceBD refuses to send an RFQ to a sanctioned supplier, and a mail link would undo that.
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
-- Null for an unknown, unpublished or sanctioned slug.
-- Over the daily limit (below) it returns {"limit": 200} and no contact value at all.
--
-- IT WRITES, SO IT IS VOLATILE. The reveal is written to the activity record (0131) inside this
-- function, the way 0141 writes `shipments.revealed`, so a call made straight to the API is recorded
-- exactly as one made through the app: kind `contact.revealed`, target `suppliers` and the supplier's
-- id, the supplier in `supplier_id`, the mark described below in `reason`, and in the content the slug
-- and how many of each kind were shown (never a value). One entry per account and supplier in any rolling 24 hours: opening the same
-- supplier again inside that window returns the details and writes nothing more. An admin's opens
-- are written the same way.
--
-- ONLY ITS OWN ENTRIES COUNT. `ledger_note` (0134) accepts the kind `contact.revealed` from any
-- signed-in caller, for any supplier they name. If this function trusted every such entry, an
-- account could note every supplier and then read each one as a free "re-open", past the limit; and
-- a note written by the app would use up the allowance. So the function marks what it writes: the
-- entry's `reason` is 'supplier_contact_details' (`c_written_by`). `ledger_note` always passes a
-- null reason to `_ledger_write` and gives its caller no way to set one, and `_ledger_write` (0131)
-- stores the reason as given (trimmed), so no caller can forge the mark. Both lookups below, the
-- re-open check and the count, read only entries carrying it.
--
-- THE DAILY LIMIT. An account that is not an admin may open the contact details of at most 200
-- DIFFERENT suppliers in a rolling 24 hours; one already opened in that window is free and is not
-- counted again. The count is taken from the activity record's `contact.revealed` entries that this
-- function wrote (see the mark below), so there is no second table to keep in step. The number lives in one place, `c_daily_limit` below,
-- and is a starting value: the founder has not chosen one yet. A lock per account makes two opens
-- at the same moment count one after the other, so the limit cannot be passed by racing it.
--
-- Additive: one new function, no table, no column, no change to any existing function.
-- Do not apply to production from this PR (AGENTS.md rule 15).
--
-- REVERSE:
--   drop function public.supplier_contact_details(text);
-- The `contact.revealed` entries already written stay in the activity record, which is append-only.

create or replace function public.supplier_contact_details(p_slug text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  -- The one place the daily limit lives. A starting value: the founder has chosen nothing yet (12 Oct 2026).
  c_daily_limit constant integer := 200;
  -- The mark on the entries this function writes (the ledger's `reason`). Only these are trusted:
  -- `ledger_note` lets any caller write this kind, but never a reason.
  c_written_by  constant text := 'supplier_contact_details';
  v_uid      uuid := auth.uid();
  v_admin    boolean;
  v_allowed  boolean;
  v_supplier uuid;
  v_count    integer;
  v_details  jsonb;
begin
  select coalesce(p.role = 'admin', false),
         (p.role = 'admin' or p.plan_tier in ('growth', 'enterprise'))
         and not coalesce(p.is_suspended, false)
    into v_admin, v_allowed
    from public.profiles p
   where p.id = v_uid;
  if not coalesce(v_allowed, false) then
    return null;
  end if;

  select s.id into v_supplier
    from public.suppliers s
   where s.slug = p_slug
     and s.is_published = true
     and s.is_sanctioned = false;
  if v_supplier is null then
    return null;
  end if;

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
    into v_details
    from public.suppliers s
   cross join lateral (
     select regexp_replace(s.website, '[^[:space:],;/]+@[^[:space:],;]+', '', 'g') as site
   ) as w
   where s.id = v_supplier;

  -- Opened by this account inside the last 24 hours: free, not counted again, nothing more written.
  if exists (
       select 1 from public.activity_ledger l
        where l.actor_id = v_uid and l.kind = 'contact.revealed' and l.supplier_id = v_supplier
          and l.reason = c_written_by
          and l.at > now() - interval '24 hours') then
    return v_details;
  end if;

  if not v_admin then
    -- One account's opens go one at a time, so two at the same moment cannot both be "the 200th".
    perform pg_advisory_xact_lock(hashtext('supplier_contact_details'), hashtext(v_uid::text));
    select count(distinct l.supplier_id) into v_count
      from public.activity_ledger l
     where l.actor_id = v_uid and l.kind = 'contact.revealed'
       and l.reason = c_written_by
       and l.at > now() - interval '24 hours';
    if v_count >= c_daily_limit then
      return jsonb_build_object('limit', c_daily_limit);
    end if;
  end if;

  perform public._ledger_write('contact.revealed', 'suppliers', v_supplier,
    jsonb_build_object(
      'slug',    p_slug,
      'emails',  jsonb_array_length(v_details -> 'emails'),
      'phones',  jsonb_array_length(v_details -> 'phones'),
      'website', jsonb_typeof(v_details -> 'website') = 'string',
      'person',  jsonb_typeof(v_details -> 'person') = 'string'),
    p_supplier => v_supplier, p_reason => c_written_by);
  return v_details;
end;
$$;

comment on function public.supplier_contact_details(text) is
  'The contact details of a published, unsanctioned supplier (emails, phones, website, contact person and role), '
  'cleaned as supplier_contact_counts counts them, for admins and Growth/Enterprise buyers who are not suspended; '
  'null for everyone else. Writes contact.revealed to the activity record once per account and supplier in a '
  'rolling 24 hours, and returns {"limit": n} with no value once a non-admin account has opened that many '
  'different suppliers in the window. 0145.';

-- Supabase grants EXECUTE on new functions to `anon` and `authenticated` BY NAME, and a revoke from
-- PUBLIC does not touch a named grant (0105 found `anon` still holding it). So `anon` by name.
revoke all on function public.supplier_contact_details(text) from public;
revoke all on function public.supplier_contact_details(text) from anon;
grant execute on function public.supplier_contact_details(text) to authenticated, service_role;
