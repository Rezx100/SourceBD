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
  select jsonb_build_object(
    'emails',          case when nullif(btrim(s.email_primary), '') is null then 0 else 1 end,
    -- `phones` is text[]; a row of empty strings is not a phone number.
    'phones',          coalesce((
                         select count(*)
                           from unnest(coalesce(s.phones, '{}'::text[])) as ph
                          where nullif(btrim(ph), '') is not null
                       ), 0)::int,
    'website',         nullif(btrim(s.website), '') is not null,
    'representatives', case when nullif(btrim(s.contact_name), '') is null then 0 else 1 end
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
