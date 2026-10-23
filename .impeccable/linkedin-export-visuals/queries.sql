-- The queries behind every figure on the LinkedIn export visuals (src/data.js holds the results).
-- Production, read only, run 23 Oct 2026. Window on every row: 2024-09-01 to 2026-08-31 (HS 61, 62).
-- Only matches classed 'exact' are used: 496 of the 835 suppliers checked.

-- Q1. Totals: 496 exporters, 939,354 shipment records, 15,502,658,942.91 USD FOB; median 30 buyers, 11 countries.
select count(*) n, sum(shipments) ships, sum(fob_usd) fob,
       percentile_cont(0.5) within group (order by buyers) med_buyers,
       percentile_cont(0.5) within group (order by (summary->>'count_of_unique_destination_countries')::int) med_countries
from volza_export_checks where match_class = 'exact';

-- Q2. Market reach: exporters with at least one shipment to each market; all four.
--     EU 456, US 352, UK 322, Canada 292, all four 222.
with e as (select * from volza_export_checks where match_class = 'exact')
select count(*) filter (where (markets->'EU'->>'shipments')::int > 0) eu,
       count(*) filter (where (markets->'United States'->>'shipments')::int > 0) us,
       count(*) filter (where (markets->'United Kingdom'->>'shipments')::int > 0) uk,
       count(*) filter (where (markets->'Canada'->>'shipments')::int > 0) ca,
       count(*) filter (where (markets->'United Kingdom'->>'shipments')::int > 0 and (markets->'United States'->>'shipments')::int > 0
                          and (markets->'EU'->>'shipments')::int > 0 and (markets->'Canada'->>'shipments')::int > 0) all4
from e;

-- Q3. Value by market (rest of the world = total minus the four).
--     EU 49.4%, US 20.1%, UK 14.0%, rest 13.7%, Canada 2.9%.
with e as (select fob_usd,
  coalesce((markets->'United Kingdom'->>'fob_usd')::numeric, 0) uk, coalesce((markets->'United States'->>'fob_usd')::numeric, 0) us,
  coalesce((markets->'EU'->>'fob_usd')::numeric, 0) eu, coalesce((markets->'Canada'->>'fob_usd')::numeric, 0) ca
  from volza_export_checks where match_class = 'exact')
select sum(eu) eu, sum(us) us, sum(uk) uk, sum(ca) ca, sum(fob_usd - uk - us - eu - ca) rest,
       round(100 * sum(eu) / sum(fob_usd), 1) eu_pct, round(100 * sum(us) / sum(fob_usd), 1) us_pct,
       round(100 * sum(uk) / sum(fob_usd), 1) uk_pct, round(100 * sum(ca) / sum(fob_usd), 1) ca_pct,
       round(100 * sum(fob_usd - uk - us - eu - ca) / sum(fob_usd), 1) rest_pct
from e;

-- Q4. Small orders: shipment records with a filed quantity under 1,000 (338 exporters carry this check).
--     197,349 of 411,623 records (48%); 310 of 338 exporters shipped at least one; median share 13.2%.
with e as (select * from volza_export_checks where match_class = 'exact' and small_orders is not null)
select count(*) n, count(*) filter (where (small_orders->>'shipments')::int > 0) any_small,
       sum((small_orders->>'shipments')::bigint) small_ships, sum((small_orders->>'of')::bigint) of_ships,
       percentile_cont(0.5) within group (order by (small_orders->>'shipments')::numeric / nullif((small_orders->>'of')::numeric, 0)) med_share
from e;

-- Q5. FOB per piece by product (HS4): every distinct shipment record we hold for the 496 (each market's latest record,
--     the latest record overall, and the raw fetch records), unit PCS, quartiles. 2,016 piece-priced records.
with recs as (
  select v.supplier_id, m.value->'top' r from volza_export_checks v, jsonb_each(v.markets) m
   where v.match_class = 'exact' and m.value->'top' is not null and m.value->'top' <> '{}'::jsonb
  union all
  select v.supplier_id, v.top_record from volza_export_checks v where v.match_class = 'exact' and v.top_record is not null
  union all
  select r.supplier_id, x from volza_raw_results r
    join volza_export_checks v on v.supplier_id = r.supplier_id and v.match_class = 'exact',
    jsonb_array_elements(r.record->'calls') c, jsonb_array_elements(coalesce(c->'response'->'api_records', '[]'::jsonb)) x
), d as (select distinct on (r->>'shipment_id') supplier_id, r from recs where r->>'shipment_id' is not null)
select left(r->>'hsn_code', 4) hs4, count(*) n, count(distinct supplier_id) exporters,
       percentile_cont(array[0.25, 0.5, 0.75]) within group (order by (r->>'unit_rate_usd')::numeric) q
from d where r->>'unit' = 'PCS' and (r->>'unit_rate_usd')::numeric > 0
group by 1 having count(*) >= 25 order by 2 desc;

-- Q6. Concentration: share of value by tenth of exporters ranked by value; buyers for the top 50 and the rest.
--     51.6 / 20.1 / 11.7 / 7.5 / 4.5 / 2.4 / 1.2 / 0.6 / 0.2 / 0.03 %; median buyers 159 (top 50), 26 in 10 countries (other 446).
with e as (select *, ntile(10) over (order by fob_usd desc) dec, row_number() over (order by fob_usd desc) rk
             from volza_export_checks where match_class = 'exact')
select dec, count(*), round(100 * sum(fob_usd) / (select sum(fob_usd) from e), 2) pct from e group by dec order by dec;
with e as (select *, row_number() over (order by fob_usd desc) rk from volza_export_checks where match_class = 'exact')
select percentile_cont(0.5) within group (order by buyers) filter (where rk <= 50) top50_buyers,
       percentile_cont(0.5) within group (order by buyers) filter (where rk > 50) rest_buyers,
       percentile_cont(0.5) within group (order by (summary->>'count_of_unique_destination_countries')::int) filter (where rk > 50) rest_countries
from e;

-- Q7. Certificates: a current (not rejected, not expired) certificate of any kind on the SourceBD record vs none.
--     With (288): median 59 buyers, 59% all four markets, median FOB 28.1 m. None (208): 11, 25%, 1.9 m.
with e as (select * from volza_export_checks where match_class = 'exact'),
c as (select supplier_id, array_agg(distinct kind::text) kinds from certifications
       where rejected_at is null and (expires_on is null or expires_on >= current_date) group by 1)
select case when c.kinds is null then 'none' else 'any' end grp, count(*) n,
       percentile_cont(0.5) within group (order by e.buyers) med_buyers,
       percentile_cont(0.5) within group (order by e.fob_usd) med_fob,
       round(100.0 * avg(((e.markets->'United Kingdom'->>'shipments')::int > 0 and (e.markets->'United States'->>'shipments')::int > 0
                     and (e.markets->'EU'->>'shipments')::int > 0 and (e.markets->'Canada'->>'shipments')::int > 0)::int), 0) all4_pct
from e left join c on c.supplier_id = e.supplier_id group by 1;

-- Q8. Shipments per exporter, ranked (the cover's unlabelled skyline).
select string_agg(shipments::text, ',' order by shipments desc) from volza_export_checks where match_class = 'exact';

-- Q9 (in the note, not on a visual). Registered district: Dhaka 224, Gazipur 132, Narayanganj 72, Chattogram 52, others 16.
select coalesce(nullif(trim(s.district), ''), '(none)') d, count(*) from volza_export_checks v
  join suppliers s on s.id = v.supplier_id where v.match_class = 'exact' group by 1 order by 2 desc;
