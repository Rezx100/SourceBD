-- Spec 09 — Brand supplier-list disclosures (Tier 4).
-- Seeds the 6 brand sources referenced by logos.lock.md §3 and adds a
-- dedicated verification_queue type for brand-only unmatched rows.

-- 1. Extend queue_type enum.
do $$ begin
  if not exists (
    select 1 from pg_type t
      join pg_enum e on t.oid = e.enumtypid
     where t.typname = 'queue_type'
       and e.enumlabel = 'brand_disclosure_match_review'
  ) then
    alter type public.queue_type add value 'brand_disclosure_match_review';
  end if;
end $$;

-- 2. Seed Tier 4 brand sources.
insert into public.sources (code, display_name, tier, base_url) values
  ('BRAND_HM',      'H&M Group supplier list',         'tier4_brand', 'https://hmgroup.com/sustainability/leading-the-change/transparency/supplier-list/'),
  ('BRAND_INDITEX', 'Inditex supplier list',           'tier4_brand', 'https://www.inditex.com/itxcomweb/en/sustainability/our-impact/people-in-our-supply-chain'),
  ('BRAND_PRIMARK', 'Primark supplier list',           'tier4_brand', 'https://www.primark.com/en-gb/our-ethics/our-products/factory-list'),
  ('BRAND_ASOS',    'ASOS supplier list',              'tier4_brand', 'https://www.asosplc.com/sustainability/'),
  ('BRAND_MS',      'Marks & Spencer supplier list',   'tier4_brand', 'https://corporate.marksandspencer.com/sustainability/people/responsible-sourcing'),
  ('BRAND_NEXT',    'Next plc supplier list',          'tier4_brand', 'https://www.nextplc.co.uk/corporate-responsibility/responsible-sourcing/supply-chain-transparency')
on conflict (code) do nothing;
