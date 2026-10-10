-- 0138 — Keep the whole Volza preview, not only the card's fields (11 Oct 2026).
--
-- Founder, 11 Oct 2026: "we fetch only what preview gives us and we delete nothing and save it".
-- The paid preview (summary + biggest shipment) also returns counts of HS codes, destination
-- countries, ports, shipping modes and notify parties, and the shipment's ports, weight and the
-- buyer's and factory's cities. 0137 dropped them; they are kept from now on, raw, as Volza sent
-- them. Nullable: the 243 rows stored before this have neither until they are fetched again.
-- The one-year life of every row (0137, Volza's email of 8 Oct 2026) is unchanged.
-- Spec: context/feature-specs/spec-volza-reveal.md section 1.
--
-- Rollback:
--   alter table public.volza_export_checks drop column summary, drop column top_record;

alter table public.volza_export_checks
  add column summary    jsonb check (summary is null or jsonb_typeof(summary) = 'object'),
  add column top_record jsonb check (top_record is null or jsonb_typeof(top_record) = 'object');

comment on column public.volza_export_checks.summary is
  'Volza api_summary as returned (counts of shipments, buyers, HS codes, ports, countries, modes). 0138.';
comment on column public.volza_export_checks.top_record is
  'The biggest shipment as returned, every field (ports, weight, cities, notify party). 0138.';
