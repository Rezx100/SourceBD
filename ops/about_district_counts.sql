-- The About page's district counts (components/site/trust.tsx, DISTRICTS): published suppliers by district, read once
-- and committed with the day of the read (the page never reads them live). Read-only. Run through the Supabase MCP
-- `execute_sql` on project stnrfxrxfonwexzcvvpv; the result and its date go in ops/plans/about-district-counts.md.
--
-- The district column mixes spellings and sub-districts, so the read folds them: the approved place lexicon's
-- spellings (lib/bd-place-lexicon.ts: Chittagong and CTG to Chattogram, Dacca to Dhaka, every "-gonj" to "-ganj",
-- Mymensing and its variants to Mymensingh, B.Baria to Brahmanbaria, Chapai Nawabganj, Cox's Bazar), Savar and
-- Ashulia (upazilas of Dhaka district) into Dhaka, and the districts' official new spellings (Comilla to Cumilla,
-- Jessore to Jashore, Bogra to Bogura, Barisal to Barishal, Narshingdi to Narsingdi). An empty value or a stray one
-- ("N/A", "-") is "not on file". Any other value, a sub-district such as Tongi or Rupganj included, counts under its
-- own name: the report lists every one, so a reader sees when that happens (the 21 Oct read had none).

with d as (
  select
    case
      when k is null or k in ('n/a', 'na', '-', '--', 'none', 'null') then null
      when k in ('chittagong', 'chattogram', 'ctg') then 'Chattogram'
      when k in ('narayanganj', 'n.ganj', 'n ganj', 'nganj') then 'Narayanganj'
      when k in ('dhaka', 'dacca', 'savar', 'ashulia') then 'Dhaka'
      when k in ('mymensingh', 'mymensing', 'maymanshingh', 'maymashingo') then 'Mymensingh'
      when k in ('b.baria', 'b. baria', 'b baria', 'brahmanbaria') then 'Brahmanbaria'
      when k in ('chapai nawabganj', 'chapainawabganj') then 'Chapainawabganj'
      when k in ('cox''s bazar', 'coxs bazar', 'cox bazar') then 'Cox''s Bazar'
      when k in ('comilla', 'cumilla') then 'Cumilla'
      when k in ('jessore', 'jashore') then 'Jashore'
      when k in ('bogra', 'bogura') then 'Bogura'
      when k in ('barisal', 'barishal') then 'Barishal'
      when k in ('narsingdi', 'narshingdi') then 'Narsingdi'
      else initcap(k)
    end as district,
    address_raw
  from (
    -- The key: trimmed, lowercased, every "-gonj" spelled "-ganj" (the lexicon's rule for Narayangonj, Manikgonj and the rest).
    select regexp_replace(lower(nullif(trim(s.district), '')), 'gonj$', 'ganj') as k, s.address_raw
    from public.suppliers s
    where s.is_published
  ) raw
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
