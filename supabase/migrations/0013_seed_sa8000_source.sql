-- Seed the SA8000 source row in public.sources so the SA8000 certification
-- harvester (Spec 08e) can land Tier-3 cert evidence via the existing
-- `_TIER_MAP['SA8000'] = 'tier3_cert'` mapping in etl/core/upsert.py.
--
-- The `cert_kind` enum already contains 'sa8000' (migration 0001 line 37) and
-- `_CERT_POINTS['sa8000'] = 5` is already wired in etl/scoring/sbi.py.
-- The only Phase-0 wiring gap was the catalog row itself.

insert into public.sources (code, display_name, tier, base_url) values
  ('SA8000', 'SAAS SA8000 Certified Organisations Directory',
   'tier3_cert', 'https://sa-intl.org/sa8000-search/')
on conflict (code) do nothing;
