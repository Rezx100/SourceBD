-- 0158 — The register-address view reads one supplier's records when asked for one (28 Oct 2026).
--
-- THE FAULT
--   Opening a record beside the results took ~2 s on the live site (founder, 28 Oct 2026). The largest
--   single wait is buyer_supplier_profile(): 245 ms for one record alone on production that day, 693 ms
--   on average under load (pg_stat_statements, 298 buyer calls; 78,141 public-page calls at 555 ms).
--   196 ms of the 245 is v_supplier_addresses: v_supplier_addresses_filed opens with `WITH src AS (…)`
--   and reads src in 14 UNION ALL branches, so Postgres materialises src once — every active source
--   record of every published supplier (22,913 rows, with their `fields` jsonb, 24 MB spilled to temp) —
--   and only then filters each branch to the one supplier. 0107 made the profile filter on the supplier;
--   the filter could not reach past the materialised CTE (ops/plans/buyer-app-speed-29sep.md, "what is
--   left": "v_supplier_addresses materialises every active source record … on each profile read").
--
-- WHAT THIS DOES
--   `WITH src AS NOT MATERIALIZED (…)`: each branch inlines the join, so a supplier filter becomes an index
--   probe on source_records(supplier_id, source_id, …) in every branch. No other character changes.
--   Read-only trial on production, 28 Oct 2026, against a session-only copy of the view:
--     one supplier (shirt-makers)   196 ms -> 1 ms, same 2 rows
--     the whole view                228 ms -> 170 ms (each branch reads its own register by index)
--     every row                     28,260 = 28,260, md5 of all rows in order identical
--   v_supplier_addresses_direct and v_supplier_addresses select from this view and are not touched.
--
--   The body is production's live definition (pg_get_viewdef, md5 23357003ab184c5b2bb415a99ef93253,
--   7,247 bytes on 28 Oct 2026) with the keyword added and the three tables schema-qualified. Before the
--   apply, production's md5 is read again; a different one means the view changed since, and this file is
--   rebuilt from it rather than applied. CREATE OR REPLACE VIEW keeps the grants, the comment and the
--   dependent views. supabase/ci/assert-0158.sql fails if the filter stops reaching in.
--
-- REVERSE
--   Re-run this file with `AS NOT MATERIALIZED (` changed back to `AS (`.

create or replace view public.v_supplier_addresses_filed as
 WITH src AS NOT MATERIALIZED (
         SELECT sr.supplier_id,
            s.code AS source_code,
            s.tier AS source_tier,
            sr.source_ref,
            sr.fields,
            sr.fetched_at,
            sr.status
           FROM ((public.source_records sr
             JOIN public.sources s ON ((s.id = sr.source_id)))
             JOIN public.suppliers sup ON (((sup.id = sr.supplier_id) AND ((sup.is_published = true) OR (sup.facility_of IS NOT NULL)))))
          WHERE (sr.status = 'active'::evidence_status)
        )
 SELECT src.supplier_id,
    src.source_code,
    src.source_tier,
    src.source_ref,
    'factory'::text AS address_kind,
    (src.fields ->> 'factory_address'::text) AS address,
    NULL::text AS phone,
    NULL::text AS email,
    src.fetched_at
   FROM src
  WHERE ((src.source_code = 'BGMEA'::text) AND (COALESCE(NULLIF((src.fields ->> 'factory_address'::text), ''::text), ''::text) <> ''::text))
UNION ALL
 SELECT src.supplier_id,
    src.source_code,
    src.source_tier,
    src.source_ref,
    'mailing'::text AS address_kind,
    (src.fields ->> 'mailing_address'::text) AS address,
    NULL::text AS phone,
    NULL::text AS email,
    src.fetched_at
   FROM src
  WHERE ((src.source_code = 'BGMEA'::text) AND (COALESCE(NULLIF((src.fields ->> 'mailing_address'::text), ''::text), ''::text) <> ''::text))
UNION ALL
 SELECT src.supplier_id,
    src.source_code,
    src.source_tier,
    src.source_ref,
    'registered'::text AS address_kind,
    (src.fields ->> 'raw_address'::text) AS address,
    NULL::text AS phone,
    NULL::text AS email,
    src.fetched_at
   FROM src
  WHERE ((src.source_code = 'BGMEA'::text) AND (COALESCE(NULLIF((src.fields ->> 'raw_address'::text), ''::text), ''::text) <> ''::text) AND (COALESCE(NULLIF((src.fields ->> 'factory_address'::text), ''::text), ''::text) = ''::text) AND (COALESCE(NULLIF((src.fields ->> 'mailing_address'::text), ''::text), ''::text) = ''::text))
UNION ALL
 SELECT src.supplier_id,
    src.source_code,
    src.source_tier,
    src.source_ref,
    'factory'::text AS address_kind,
    (src.fields ->> 'bkmea_factory_address'::text) AS address,
    NULL::text AS phone,
    NULL::text AS email,
    src.fetched_at
   FROM src
  WHERE ((src.source_code = 'BKMEA'::text) AND (COALESCE(NULLIF((src.fields ->> 'bkmea_factory_address'::text), ''::text), ''::text) <> ''::text))
UNION ALL
 SELECT src.supplier_id,
    src.source_code,
    src.source_tier,
    src.source_ref,
    'mailing'::text AS address_kind,
    (src.fields ->> 'bkmea_mailing_address'::text) AS address,
    NULL::text AS phone,
    NULL::text AS email,
    src.fetched_at
   FROM src
  WHERE ((src.source_code = 'BKMEA'::text) AND (COALESCE(NULLIF((src.fields ->> 'bkmea_mailing_address'::text), ''::text), ''::text) <> ''::text))
UNION ALL
 SELECT src.supplier_id,
    src.source_code,
    src.source_tier,
    src.source_ref,
    'factory'::text AS address_kind,
    COALESCE((src.fields ->> 'rsc_factory_address'::text), (src.fields ->> 'address'::text), (src.fields ->> 'raw_address'::text)) AS address,
    NULL::text AS phone,
    NULL::text AS email,
    src.fetched_at
   FROM src
  WHERE ((src.source_code = 'RSC'::text) AND (COALESCE(NULLIF((src.fields ->> 'rsc_factory_address'::text), ''::text), NULLIF((src.fields ->> 'address'::text), ''::text), NULLIF((src.fields ->> 'raw_address'::text), ''::text)) IS NOT NULL))
UNION ALL
 SELECT src.supplier_id,
    src.source_code,
    src.source_tier,
    src.source_ref,
    'factory'::text AS address_kind,
    (src.fields ->> 'factory_address'::text) AS address,
    NULL::text AS phone,
    NULL::text AS email,
    src.fetched_at
   FROM src
  WHERE ((src.source_code = 'BTMA'::text) AND (COALESCE(NULLIF((src.fields ->> 'factory_address'::text), ''::text), ''::text) <> ''::text))
UNION ALL
 SELECT src.supplier_id,
    src.source_code,
    src.source_tier,
    src.source_ref,
    'mailing'::text AS address_kind,
    (src.fields ->> 'mailing_address'::text) AS address,
    NULL::text AS phone,
    NULL::text AS email,
    src.fetched_at
   FROM src
  WHERE ((src.source_code = 'BTMA'::text) AND (COALESCE(NULLIF((src.fields ->> 'mailing_address'::text), ''::text), ''::text) <> ''::text))
UNION ALL
 SELECT src.supplier_id,
    src.source_code,
    src.source_tier,
    src.source_ref,
    'factory'::text AS address_kind,
    (src.fields ->> 'bgapmea_factory_address'::text) AS address,
    NULL::text AS phone,
    NULL::text AS email,
    src.fetched_at
   FROM src
  WHERE ((src.source_code = 'BGAPMEA'::text) AND (COALESCE(NULLIF((src.fields ->> 'bgapmea_factory_address'::text), ''::text), ''::text) <> ''::text))
UNION ALL
 SELECT src.supplier_id,
    src.source_code,
    src.source_tier,
    src.source_ref,
    'registered'::text AS address_kind,
    (src.fields ->> 'bgapmea_company_address'::text) AS address,
    NULL::text AS phone,
    NULL::text AS email,
    src.fetched_at
   FROM src
  WHERE ((src.source_code = 'BGAPMEA'::text) AND (COALESCE(NULLIF((src.fields ->> 'bgapmea_company_address'::text), ''::text), ''::text) <> ''::text))
UNION ALL
 SELECT src.supplier_id,
    src.source_code,
    src.source_tier,
    src.source_ref,
    'factory'::text AS address_kind,
    (src.fields ->> 'epb_factory_address'::text) AS address,
    NULL::text AS phone,
    NULL::text AS email,
    src.fetched_at
   FROM src
  WHERE ((src.source_code = 'EPB'::text) AND (COALESCE(NULLIF((src.fields ->> 'epb_factory_address'::text), ''::text), ''::text) <> ''::text))
UNION ALL
 SELECT src.supplier_id,
    src.source_code,
    src.source_tier,
    src.source_ref,
    'registered'::text AS address_kind,
    (src.fields ->> 'epb_office_address'::text) AS address,
    NULL::text AS phone,
    NULL::text AS email,
    src.fetched_at
   FROM src
  WHERE ((src.source_code = 'EPB'::text) AND (COALESCE(NULLIF((src.fields ->> 'epb_office_address'::text), ''::text), ''::text) <> ''::text))
UNION ALL
 SELECT src.supplier_id,
    src.source_code,
    src.source_tier,
    src.source_ref,
    'factory'::text AS address_kind,
    (src.fields ->> 'oeko_profile_address'::text) AS address,
    NULL::text AS phone,
    NULL::text AS email,
    src.fetched_at
   FROM src
  WHERE ((src.source_code = 'OEKO_TEX'::text) AND (COALESCE(NULLIF((src.fields ->> 'oeko_profile_address'::text), ''::text), ''::text) <> ''::text))
UNION ALL
 SELECT src.supplier_id,
    src.source_code,
    src.source_tier,
    src.source_ref,
    'registered'::text AS address_kind,
    COALESCE((src.fields ->> 'address'::text), (src.fields ->> 'raw_address'::text)) AS address,
    NULL::text AS phone,
    NULL::text AS email,
    src.fetched_at
   FROM src
  WHERE ((src.source_code = ANY (ARRAY['BTMA'::text, 'BGAPMEA'::text])) AND (COALESCE(NULLIF((src.fields ->> 'address'::text), ''::text), NULLIF((src.fields ->> 'raw_address'::text), ''::text)) IS NOT NULL) AND (COALESCE(NULLIF((src.fields ->> 'factory_address'::text), ''::text), ''::text) = ''::text) AND (COALESCE(NULLIF((src.fields ->> 'mailing_address'::text), ''::text), ''::text) = ''::text) AND (COALESCE(NULLIF((src.fields ->> 'bgapmea_factory_address'::text), ''::text), ''::text) = ''::text) AND (COALESCE(NULLIF((src.fields ->> 'bgapmea_company_address'::text), ''::text), ''::text) = ''::text));
