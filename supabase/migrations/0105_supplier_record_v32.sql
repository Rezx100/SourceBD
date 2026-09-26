-- 0105 — supplier record v3.2 (REZ-C, handoff §4.3).
--
-- The record sheet's locked contact card must say HOW MUCH contact detail the
-- record holds without ever carrying a value to the browser. 0083 revoked the
-- contact columns from `authenticated`, so the count has to be taken inside a
-- security-definer function. That is the whole of this migration.
--
-- Five things §4.3 asks for are NOT here, each for a reason checked against
-- production on 25 Sep 2026:
--
--   * `contact_counts` is NOT added to `buyer_supplier_profile`. The live
--     definition of that function is AHEAD of this repo: it carries
--     'fetched_at', rr.fetched_at on every rsc_remediation row, which no
--     migration in supabase/migrations/ adds (0099 is the last one to
--     redefine it). A CREATE OR REPLACE built from the repo would therefore
--     silently DELETE that key, and lib/dashboard/build-models.ts reads it for
--     the Safety section's read date. A separate function adds the counts with
--     no risk to the 16 KB function every profile page depends on.
--
--   * `read_at` is not added: `buyer_supplier_profile` already returns
--     `provenance[].last_seen_at`, which is `source_records.fetched_at`, and
--     `buildSheet` already reduces it to the record's read date.
--
--   * `pages_changed_since_read` is not added: it needs the hash a page had at
--     `fetched_at` compared with a LATER hash. `source_records` holds one
--     `raw_hash` per row, updated in place alongside `fetched_at`, and there is
--     no history table in this database. The comparison has no second operand,
--     so the column could only ever be null — which §4.3 itself says means the
--     caption reads "read <date>" only, exactly what the sheet renders today.
--
--   * `rfq_count` is not added: the calling buyer can count its own RFQs to a
--     supplier through PostgREST. NOTE the caveat, because the first version of
--     this note got it wrong: `public.rfqs` carries TWO permissive SELECT
--     policies — `pol_rfqs_select_buyer (buyer_id = auth.uid())` and
--     `pol_rfqs_select_supplier`, which lets a caller who has CLAIMED the
--     supplier read every RFQ sent to it. RLS alone is therefore not the
--     scoping; `lib/dashboard/load-record.ts` filters on `buyer_id` in the
--     query, and `app/(app)/app/record-routes.test.ts` asserts that it does.
--
--   * `contact_counts.registers` is not returned. §4.3's example shape ends
--     `"registers":["BGMEA","BKMEA","BGAPMEA"]` — which register filed each
--     contact detail. That attribution does not exist anywhere in this
--     database: no row of `source_records.fields` carries a contact key (0 of
--     22,190 active rows, across all 14 registers that have ever filed one),
--     and `v_supplier_addresses.phone` / `.email` are empty on every one of its
--     rows. Printing register names beside the counts would be an invented
--     receipt, which is the one thing this product may not do, so the card
--     says the counts alone.
--
-- §4.5 ("rfq_create gains and s.is_sanctioned = false") is already true in
-- production: the live rfq_create validates targets with
-- `s.is_published = true and s.is_sanctioned = false`. No change is needed for
-- REZ-C. The named error message §4.5 also asks for belongs to REZ-D, which
-- rewrites that function's inputs.
--
-- Additive. Do not --apply to production from this PR (AGENTS.md rule 15).

set search_path = public;

-- ---------------------------------------------------------------------------
-- supplier_contact_counts — how much contact detail a published record holds.
-- Counts and booleans only; no value of any contact field is returned, and the
-- function selects no column it does not count.
-- ---------------------------------------------------------------------------

create or replace function public.supplier_contact_counts(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $function$
  -- A field counts only when it holds the thing it is named for. On 25 Sep 2026
  -- 111 published rows held a website of exactly 'https://' and a few more
  -- 'http://Nil', a product list or an e-mail address; counting those put "a
  -- website" on a card whose record holds none. `email_primary` often holds
  -- two or three addresses in one string, and seven hold none (no '@').
  -- Known undercount: 64 `phones` entries run two or three numbers together
  -- with no separator at all (18–27 digits); they count as one, because no
  -- rule can tell where one number ends and the next begins.
  select jsonb_build_object(
    'emails',          (select count(*)
                          from regexp_matches(coalesce(s.email_primary, ''),
                                              '[^@[:space:],;/]+[[:space:]]*@[[:space:]]*[^@[:space:],;/.]+[.][^@[:space:],;/]+', 'g'))::int,
    -- `phones` is text[]: a phone is six or more digits, and one number filed
    -- twice is one phone — however it is punctuated, and with or without the
    -- country code: "+880 1754392350", "01754392350" and "1754392350" are one
    -- (4 published records filed one number both ways, 26 Sep 2026). Each is
    -- written in its local form before counting: "880…" → "0…", and a bare
    -- ten-digit mobile "1[3-9]…" gains its trunk 0.
    'phones',          coalesce((
                         select count(distinct case
                                  when d ~ '^880' then substr(d, 3)
                                  when d ~ '^1[3-9][0-9]{8}$' then '0' || d
                                  else d
                                end)
                           from (select regexp_replace(ph, '[^0-9]', '', 'g') as d
                                   from unnest(coalesce(s.phones, '{}'::text[])) as ph) as n
                          where length(d) >= 6
                       ), 0)::int,
    -- A site, once any e-mail address in the same field is set aside: one
    -- record files "http://site.com, name@site.com" and holds a website.
    'website',         coalesce(regexp_replace(s.website, '[^[:space:],;/]+@[^[:space:],;]+', '', 'g') ~* '[a-z0-9-]+[.][a-z]{2,}', false),
    -- A name, not a bare title, a year or initials: 192 published rows hold
    -- only "Mr." / "MR." / "Md.", and nine more "1965", "M", "A.B.", "P.V.V."
    -- and the like (25 Sep 2026).
    'representatives', case when s.contact_name ~ '[[:alpha:]]{3}' then 1 else 0 end
  )
  from public.suppliers s
  where s.slug = p_slug
    and s.is_published = true
  limit 1
$function$;

comment on function public.supplier_contact_counts(text) is
  'REZ-C §4.3: counts of the contact details a published record holds, never their values. Returns null for an unknown or unpublished slug.';

-- `revoke ... from public` is not enough on this database: Supabase's default
-- privileges grant EXECUTE on new functions to `anon` and `authenticated`
-- BY NAME, and a revoke from PUBLIC does not touch a grant made to a named
-- role. The first dry run of this file (25 Sep 2026) showed `anon` holding
-- EXECUTE. The founder's rule of 23 Sep is that contact details are sign-in
-- gated, and how many a record holds is part of that same locked card, so
-- `anon` is revoked explicitly and by name.
revoke all on function public.supplier_contact_counts(text) from public;
revoke all on function public.supplier_contact_counts(text) from anon;
grant execute on function public.supplier_contact_counts(text) to authenticated, service_role;
