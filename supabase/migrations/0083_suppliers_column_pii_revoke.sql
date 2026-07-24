-- Migration 0083 — REZ-13 corrective: proper column-level PII protection on suppliers
--
-- Migration 0082 applied REVOKE SELECT (columns) on public.suppliers which is
-- a no-op when a table-level SELECT grant already exists for the role. PostgreSQL
-- column-level REVOKE only removes column-level grants; it cannot override a
-- broader table-level privilege already held by the role.
--
-- The correct pattern:
--   1. REVOKE the table-level SELECT from anon and authenticated.
--   2. GRANT SELECT on only the safe non-PII columns to those roles.
--
-- Columns NOT granted to anon / authenticated:
--   contact_name, contact_role, email_primary, phones, website  (REZ-13)
--   supplier_contact_name, supplier_contact_role,               (supplier self-reported PII)
--   supplier_contact_email, supplier_contact_phone
--   supplier_attested_by                                        (internal UUID)
--   notes_admin, sanctioned_reason                              (admin internal)
--   sanctions_reviewed_at, sanctions_reviewed_by,               (admin internal)
--   sanctions_cleared_reason
--
-- All security-definer RPCs (buyer_supplier_profile, discover_suppliers,
-- buyer_smart_match, supplier_profile_editor, claim_verify_fn, admin_*) run as
-- postgres/owner and are wholly unaffected by column privileges.
-- service_role also bypasses all column privileges automatically.
--
-- Non-SELECT table privileges (INSERT/UPDATE/DELETE/etc.) are unchanged;
-- those are already blocked by RLS with no write policies for anon/buyer roles.
--
-- Verified smokes after apply:
--   • PII columns return 0 rows in information_schema.column_privileges for anon/authenticated SELECT
--   • 13 safe non-PII columns confirmed still readable by anon
--   • buyer_supplier_profile('...') still returns company_name correctly

-- Step 1: revoke the broad table-level SELECT
revoke select on public.suppliers from anon, authenticated;

-- Step 2: grant SELECT on safe non-PII columns only
grant select (
  id,
  slug,
  company_name,
  company_name_norm,
  entity_type,
  bgmea_reg_numbers,
  bgmea_verified,
  bkmea_reg_number,
  bkmea_verified,
  bgapmea_verified,
  btma_verified,
  rjsc_reg_number,
  epb_erc_number,
  bepza_zone,
  address_raw,
  city,
  district,
  country,
  lat,
  lng,
  source_tags,
  is_sanctioned,
  is_published,
  claimed_by,
  completeness_pct,
  created_at,
  updated_at,
  employees_total,
  employees_male,
  employees_female,
  production_capacity_pcs_day,
  machines_sewing,
  established_date,
  principal_products,
  factory_types,
  production_capacity_dozen_yearly,
  parent_group_name,
  supplier_tagline,
  supplier_about,
  supplier_moq,
  supplier_lead_time_days,
  supplier_capabilities,
  name_display,
  description,
  t13_source_count,
  discover_search_tsv,
  supplier_attested_at,
  sanctions_cleared
) on public.suppliers to anon, authenticated;

notify pgrst, 'reload schema';
