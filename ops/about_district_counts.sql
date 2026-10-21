-- The About page's district counts (components/site/trust.tsx, DISTRICTS): published suppliers by district, read once
-- and committed with the day of the read (the page never reads them live). Read-only. Run through the Supabase MCP
-- `execute_sql` on project stnrfxrxfonwexzcvvpv; the result and its date go in ops/plans/about-district-counts.md.
--
-- The district column mixes spellings and sub-districts, so the read folds them, and only them: the approved place
-- lexicon's pairs (Chittagong and CTG to Chattogram, Narayangonj and N.ganj to Narayanganj; lib/bd-place-lexicon.ts),
-- Savar and Ashulia (upazilas of Dhaka district) into Dhaka, and the districts' official new spellings (Comilla to
-- Cumilla, Jessore to Jashore, Bogra to Bogura, Barisal to Barishal, Narshingdi to Narsingdi). Any other value counts
-- under its own name. An empty district is "not on file".

with d as (
  select
    case
      when nullif(trim(s.district), '') is null then null
      when lower(trim(s.district)) in ('chittagong', 'chattogram', 'ctg') then 'Chattogram'
      when lower(trim(s.district)) in ('narayanganj', 'narayangonj', 'n.ganj', 'n ganj', 'nganj') then 'Narayanganj'
      when lower(trim(s.district)) in ('dhaka', 'savar', 'ashulia') then 'Dhaka'
      when lower(trim(s.district)) in ('comilla', 'cumilla') then 'Cumilla'
      when lower(trim(s.district)) in ('jessore', 'jashore') then 'Jashore'
      when lower(trim(s.district)) in ('bogra', 'bogura') then 'Bogura'
      when lower(trim(s.district)) in ('barisal', 'barishal') then 'Barishal'
      when lower(trim(s.district)) in ('narsingdi', 'narshingdi') then 'Narsingdi'
      else initcap(lower(trim(s.district)))
    end as district,
    s.address_raw
  from public.suppliers s
  where s.is_published
),
counted as (
  select district, count(*) as n from d where district is not null group by district
),
big as (
  select district, n from counted where district in ('Dhaka', 'Gazipur', 'Narayanganj', 'Chattogram')
),
rest as (
  select district, n, row_number() over (order by n desc, district) as r from counted where district not in ('Dhaka', 'Gazipur', 'Narayanganj', 'Chattogram')
)
select json_build_object(
  'read_on', current_date,
  'published', (select count(*) from d),
  'big', (select json_object_agg(district, n) from big),
  'dhaka_with_savar_in_address', (select count(*) from d where district = 'Dhaka' and address_raw ilike '%savar%'),
  'more_districts', (select count(*) from rest),
  'more_suppliers', (select coalesce(sum(n), 0) from rest),
  'more_top', (select json_agg(json_build_object('district', district, 'n', n) order by r) from rest where r <= 2),
  'not_on_file', (select count(*) from d where district is null)
) as about_district_counts;
