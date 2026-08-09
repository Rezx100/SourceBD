-- 20260808_rez73 — buyer_supplier_profile facilities key (REZ-73 /
-- Extensions B3, widened 8 Aug 2026: group roll-up as separate labelled
-- figures).
--
-- NAMING: timestamp-named on purpose. This migration recreates objects also
-- defined by 20260724202039 / 20260725 / 20260805; a numeric name (0097)
-- sorts BEFORE those under version-ordered replay, so a fresh database
-- (preview branch, db reset, disaster recovery) would silently end with the
-- pre-REZ-73 objects. This name sorts after every definer it supersedes.
--
-- WHY
-- ---
-- B1 (REZ-71) attaches extension / new-building rows as unpublished
-- facilities (`facility_of` set, A2 trigger unpublishes). Their data must not
-- vanish with the profile: it moves onto the mother company's profile as a
-- Facilities section — per-building name (suffix preserved), own addresses,
-- own RSC remediation progress, own registry pills — plus the REZ-92 group
-- roll-up rendered as separate labelled figures (mother's own figures are
-- never replaced by a combined total).
--
-- WHAT
-- ----
-- 1. `v_supplier_addresses_direct` is recreated with the REZ-18 predicate
--    relaxed from `is_published = true` to
--    `is_published = true OR facility_of IS NOT NULL`. Attached facilities
--    are unpublished by design; without this their own addresses silently
--    vanish from every read path the moment B1 applies. The view remains
--    SELECT-revoked from anon/authenticated (0082) — the only readers are
--    SECURITY DEFINER RPCs and service_role, and the RPC below only ever
--    reads facility rows of the published mother being viewed. No new
--    addresses enter the geocode walk: the attached population is published
--    today, so its addresses are already in the walk.
-- 2. `v_supplier_registry_ids_direct` is recreated with the same relaxation
--    on every branch (REZ-98's backed-only BGMEA rule carried forward
--    unchanged): an attached facility keeps its own registry pills. The
--    inheriting view needs no change — its inheritance branch already gates
--    donor AND recipient on is_published (20260724 security batch), so a
--    facility can neither donate nor inherit pills, and its direct rows are
--    unreachable to every consumer (all join on published supplier ids).
--    Both registry views are then SELECT-revoked from anon/authenticated
--    (0082 precedent for the address views): they are anonymously readable
--    in production today (verified 8 Aug 2026 — GET as anon returns 200),
--    which would otherwise enumerate UNPUBLISHED facilities' pills the
--    moment B1 attaches. Every app consumer reads them through SECURITY
--    DEFINER RPCs (buyer_supplier_profile, discover_*), which execute as
--    the function owner and are unaffected by the revoke.
-- 3. `v_supplier_addresses` (the INHERITING address view) is recreated with
--    a donor-side gate its 0082 body never needed: the inheritance branch
--    gates only the recipient (`child.is_published = true`) and relied on
--    the direct view excluding unpublished rows. Once (1) relaxes the direct
--    view, an unpublished facility could otherwise DONATE `_inherited`
--    address rows — source_ref suffixed `#inherited:<facility slug>` — onto
--    any published supplier whose extension base name matches the
--    facility's company_name. Adding `and parent.is_published = true` keeps
--    donation published-only, exactly mirroring the registry view's
--    20260724 hardening. Behaviour today is unchanged (donors are all
--    published pre-B1); a facility's addresses surface only through the
--    facilities CTE below, never on a third party's profile.
-- 4. `buyer_supplier_profile` gains a `facilities` key: one object per live
--    child (`f.facility_of = s.id`, partial index idx_suppliers_facility_of
--    — single-mother lookup, no suppliers scan), carrying:
--      name (suffix intact), the four REZ-92 roll-up numerics
--      (employees_total, machines_sewing, production_capacity_pcs_day,
--      production_capacity_dozen_yearly), PII-stripped addresses from
--      v_supplier_addresses_direct (same key shape as the parent's
--      addresses CTE from 0079 — kind/address/source_code/fetched_at, no
--      phone/email), own registry pills from v_supplier_registry_ids_direct
--      (NEVER the inheriting view — a facility must not inherit its
--      mother's pills), its own active rsc_remediation progress, and its
--      is_sanctioned flag (a buyer-protection signal that was public while
--      the building was published — a sanctioned building must not lose its
--      marker at attach; the UI badges it, mirroring the mother's own
--      sanctions treatment).
--    Empty population → '[]'::jsonb; profiles render byte-identical while
--    zero facilities are attached.
--
-- PII / DISCLOSURE
-- ----------------
-- No facility slug, id, contact, completeness, entity_type, source_tags or
-- SBI is emitted — the facility is unpublished for a reason; only its name,
-- addresses, registry pills, RSC progress, is_sanctioned flag (a
-- buyer-protection boolean, public while the building was published) and
-- the four roll-up numerics (the same figures its profile showed while it
-- was published) surface.
-- Unpublished facility rows remain unreadable via PostgREST RLS; only this
-- join surfaces them, and only for the published mother being viewed.
--
-- NON-GOALS
-- ---------
-- No facility attach (B1/REZ-71). No facility profile route. No map pins
-- for facilities — the issue asks for a judgment on doing it later: yes,
-- worth a follow-up issue once B1 lands. A buyer vetting a mother company
-- cares where the extension building physically sits (a different district
-- changes logistics), and the facility addresses are already in the geocode
-- cache from when those rows were published, so the later work is render-
-- only — add the facilities as labelled pins on the mother's existing
-- Locations map, never a separate map. t13_source_count, pills, discover
-- and the parent's own figures are untouched — the roll-up is computed
-- app-side from the raw per-building numerics, never written back. REZ-93's
-- docs/certs inheritance is carried forward unchanged (DISPLAY-ONLY).
--
-- TRUE PRODUCTION PRE-STATE (verified live 8 Aug 2026 via
-- pg_get_functiondef / pg_get_viewdef): the four views match their 0082 /
-- REZ-98 bodies exactly, but buyer_supplier_profile in production is the
-- 20260725_rez_security_hardening_2 catch-up body — migration 0095
-- (REZ-93's certs/docs union) was never applied. This migration therefore
-- does TWO things to the function at apply time: it brings REZ-93's
-- certs/docs union live for the first time AND adds the facilities key.
-- The REZ-93 half is a no-op while zero facilities exist (union branches
-- empty, building_name keys omitted), and the REZ-93 UI half has been
-- deployed since 6 Aug tolerating its absence — but the founder's apply
-- go-ahead must name both halves, and the payload diff below is the proof.
--
-- APPLY-TIME VERIFICATION (run at the founder-gated apply, per AGENTS.md
-- 9a/15; zero facilities exist pre-B1, so every recreated object must be
-- row-identical before and after):
--   1. Before: snapshot row counts and a content hash of
--      v_supplier_addresses_direct, v_supplier_addresses,
--      v_supplier_registry_ids_direct, v_supplier_registry_ids, and the
--      buyer_supplier_profile payload for a sample of published slugs.
--   2. After: the four views must be row-for-row identical (the relaxation
--      adds rows only for facility_of rows, of which there are zero); the
--      profile payloads must differ only by the added 'facilities' key
--      (value '[]') — the REZ-93 union branches emit nothing at zero
--      facilities, so any OTHER payload difference is a stop-and-report;
--      anonymous GET on both registry views must flip from 200 to
--      permission-denied (both address views already 401).
--
-- REVERSE
-- -------
--   Drop trg_suppliers_facility_parent_is_company and
--   enforce_facility_parent_is_company(). Re-apply the
--   20260725_rez_security_hardening_2 function body — that is
--   the actual pre-state in production, NOT 0095 (re-applying 0095 would
--   introduce REZ-93's union while believing it was removed). Re-apply the
--   0082 addresses view bodies (restores the strict is_published predicate
--   and drops the donor gate) and the REZ-98 registry view body; re-grant
--   the registry views if the pre-20260808 exposure is ever wanted back
--   (it should not be).
--
-- Not applied in the authoring session — STOP AND ASK before production.

-- ---------------------------------------------------------------------------
-- 1. v_supplier_addresses_direct — keep attached facilities' addresses
--    visible after B1 unpublishes them. Body identical to 0082 except the
--    src CTE predicate and this comment block.
-- ---------------------------------------------------------------------------
create or replace view public.v_supplier_addresses_direct as
with src as (
  select sr.supplier_id,
         s.code           as source_code,
         s.tier           as source_tier,
         sr.source_ref,
         sr.fields,
         sr.fetched_at,
         sr.status
  from public.source_records sr
  join public.sources s on s.id = sr.source_id
  -- REZ-18: exclude source records belonging to unpublished suppliers.
  -- REZ-73: except attached facilities — unpublished by design (A2 trigger),
  -- their addresses surface on the mother profile via buyer_supplier_profile.
  join public.suppliers sup on sup.id = sr.supplier_id
   and (sup.is_published = true or sup.facility_of is not null)
  where sr.status = 'active'
)
-- BGMEA: factory + mailing (web detail) and raw_address (PDF / fallback)
select supplier_id, source_code, source_tier, source_ref,
       'factory'::text    as address_kind,
       fields->>'factory_address' as address,
       null::text         as phone,   -- REZ-17
       null::text         as email,   -- REZ-17
       fetched_at
  from src
 where source_code = 'BGMEA'
   and coalesce(nullif(fields->>'factory_address',''),'') <> ''
union all
select supplier_id, source_code, source_tier, source_ref,
       'mailing'::text    as address_kind,
       fields->>'mailing_address' as address,
       null::text         as phone,   -- REZ-17
       null::text         as email,   -- REZ-17
       fetched_at
  from src
 where source_code = 'BGMEA'
   and coalesce(nullif(fields->>'mailing_address',''),'') <> ''
union all
select supplier_id, source_code, source_tier, source_ref,
       'registered'::text as address_kind,
       fields->>'raw_address' as address,
       null::text         as phone,   -- REZ-17
       null::text         as email,   -- REZ-17
       fetched_at
  from src
 where source_code = 'BGMEA'
   and coalesce(nullif(fields->>'raw_address',''),'') <> ''
   and coalesce(nullif(fields->>'factory_address',''),'') = ''
   and coalesce(nullif(fields->>'mailing_address',''),'') = ''

union all
select supplier_id, source_code, source_tier, source_ref,
       'factory'::text    as address_kind,
       fields->>'bkmea_factory_address' as address,
       null::text         as phone,   -- REZ-17
       null::text         as email,   -- REZ-17
       fetched_at
  from src
 where source_code = 'BKMEA'
   and coalesce(nullif(fields->>'bkmea_factory_address',''),'') <> ''
union all
select supplier_id, source_code, source_tier, source_ref,
       'mailing'::text    as address_kind,
       fields->>'bkmea_mailing_address' as address,
       null::text         as phone,   -- REZ-17
       null::text         as email,   -- REZ-17
       fetched_at
  from src
 where source_code = 'BKMEA'
   and coalesce(nullif(fields->>'bkmea_mailing_address',''),'') <> ''

union all
select supplier_id, source_code, source_tier, source_ref,
       'factory'::text    as address_kind,
       coalesce(fields->>'rsc_factory_address', fields->>'address', fields->>'raw_address') as address,
       null::text         as phone,
       null::text         as email,
       fetched_at
  from src
 where source_code = 'RSC'
   and coalesce(
         nullif(fields->>'rsc_factory_address',''),
         nullif(fields->>'address',''),
         nullif(fields->>'raw_address','')
       ) is not null

-- BTMA: factory_address (mill site) + mailing_address (head office)
union all
select supplier_id, source_code, source_tier, source_ref,
       'factory'::text    as address_kind,
       fields->>'factory_address' as address,
       null::text         as phone,   -- REZ-17
       null::text         as email,   -- REZ-17
       fetched_at
  from src
 where source_code = 'BTMA'
   and coalesce(nullif(fields->>'factory_address',''),'') <> ''
union all
select supplier_id, source_code, source_tier, source_ref,
       'mailing'::text    as address_kind,
       fields->>'mailing_address' as address,
       null::text         as phone,   -- REZ-17
       null::text         as email,   -- REZ-17
       fetched_at
  from src
 where source_code = 'BTMA'
   and coalesce(nullif(fields->>'mailing_address',''),'') <> ''

-- BGAPMEA: factory site (no phone/email) + registered HQ
union all
select supplier_id, source_code, source_tier, source_ref,
       'factory'::text    as address_kind,
       fields->>'bgapmea_factory_address' as address,
       null::text         as phone,
       null::text         as email,
       fetched_at
  from src
 where source_code = 'BGAPMEA'
   and coalesce(nullif(fields->>'bgapmea_factory_address',''),'') <> ''
union all
select supplier_id, source_code, source_tier, source_ref,
       'registered'::text as address_kind,
       fields->>'bgapmea_company_address' as address,
       null::text         as phone,   -- REZ-17: BGAPMEA phone suppressed
       null::text         as email,   -- REZ-17: BGAPMEA email suppressed
       fetched_at
  from src
 where source_code = 'BGAPMEA'
   and coalesce(nullif(fields->>'bgapmea_company_address',''),'') <> ''

-- EPB (mig 0017): no phone/email in EPB payload
union all
select supplier_id, source_code, source_tier, source_ref,
       'factory'::text    as address_kind,
       fields->>'epb_factory_address' as address,
       null::text         as phone,
       null::text         as email,
       fetched_at
  from src
 where source_code = 'EPB'
   and coalesce(nullif(fields->>'epb_factory_address',''),'') <> ''
union all
select supplier_id, source_code, source_tier, source_ref,
       'registered'::text as address_kind,
       fields->>'epb_office_address' as address,
       null::text         as phone,
       null::text         as email,
       fetched_at
  from src
 where source_code = 'EPB'
   and coalesce(nullif(fields->>'epb_office_address',''),'') <> ''

-- OEKO-TEX (mig 0018): profile page address; phone/email suppressed (REZ-17)
union all
select supplier_id, source_code, source_tier, source_ref,
       'factory'::text    as address_kind,
       fields->>'oeko_profile_address' as address,
       null::text         as phone,   -- REZ-17: OEKO phone suppressed
       null::text         as email,   -- REZ-17: OEKO email suppressed
       fetched_at
  from src
 where source_code = 'OEKO_TEX'
   and coalesce(nullif(fields->>'oeko_profile_address',''),'') <> ''

-- BTMA / BGAPMEA fallback: fires only when structured keys are absent
union all
select supplier_id, source_code, source_tier, source_ref,
       'registered'::text as address_kind,
       coalesce(fields->>'address', fields->>'raw_address') as address,
       null::text         as phone,
       null::text         as email,
       fetched_at
  from src
 where source_code in ('BTMA','BGAPMEA')
   and coalesce(nullif(fields->>'address',''), nullif(fields->>'raw_address','')) is not null
   and coalesce(nullif(fields->>'factory_address',''),'') = ''
   and coalesce(nullif(fields->>'mailing_address',''),'') = ''
   and coalesce(nullif(fields->>'bgapmea_factory_address',''),'') = ''
   and coalesce(nullif(fields->>'bgapmea_company_address',''),'') = ''
;

comment on view public.v_supplier_addresses_direct is
  'Verified addresses per supplier from source records (BGMEA factory/mailing, '
  'BKMEA factory/mailing, RSC factory, BTMA factory/mailing/registered, '
  'BGAPMEA factory/registered, EPB factory/registered, OEKO_TEX factory). '
  'REZ-17: phone and email columns are always null in the public view body. '
  'REZ-18: only rows for is_published=true suppliers are included. '
  'REZ-73: …or attached facilities (facility_of not null), whose addresses '
  'surface on the published mother profile via buyer_supplier_profile. '
  'Subset of v_supplier_addresses; the parent view UNIONs this with inherited '
  'rows for RSC sibling factories.';

-- ---------------------------------------------------------------------------
-- 1b. v_supplier_addresses — donor-side gate on the inheritance branch.
--     Body identical to 0082 except the added `and parent.is_published = true`
--     and this comment block. See header item 3 for the why.
-- ---------------------------------------------------------------------------
create or replace view public.v_supplier_addresses as
select * from public.v_supplier_addresses_direct
union all
select child.id                                       as supplier_id,
       parent_addr.source_code                        as source_code,
       parent_addr.source_tier                        as source_tier,
       (parent_addr.source_ref || '#inherited:' || parent.slug) as source_ref,
       (parent_addr.address_kind || '_inherited')     as address_kind,
       parent_addr.address                            as address,
       null::text                                     as phone,   -- REZ-17
       null::text                                     as email,   -- REZ-17
       parent_addr.fetched_at                         as fetched_at
  from public.suppliers child
  join lateral (
        select public.rsc_extension_base_name(child.company_name) as base
       ) bn on true
  join public.suppliers parent
    on parent.id <> child.id
   and lower(parent.company_name) = lower(bn.base)
   -- REZ-73: donors must be published. The 0082 body relied on the direct
   -- view excluding unpublished rows; the REZ-73 relaxation of that view
   -- (attached facilities) makes the gate explicit here instead, so an
   -- unpublished facility can never donate an inherited address — and its
   -- slug via `#inherited:<slug>` — onto a name-matched stranger's profile.
   and parent.is_published = true
  join public.v_supplier_addresses_direct parent_addr
    on parent_addr.supplier_id = parent.id
 where bn.base is not null
   and child.is_published = true  -- REZ-18: exclude inherited rows for unpublished child suppliers
;

comment on view public.v_supplier_addresses is
  'All verified addresses per supplier (direct source rows + RSC sibling '
  'inheritance). Inherited rows have address_kind suffixed with "_inherited" '
  'and source_ref suffixed with "#inherited:<parent_slug>". '
  'REZ-17: phone and email columns are always null. '
  'REZ-18: only published suppliers appear (both direct and inherited branches). '
  'REZ-73: inheritance donors must additionally be published — attached '
  'facilities (facility_of not null, unpublished) are readable through '
  'v_supplier_addresses_direct for the mother profile but never donate. '
  'UI should label inherited rows as "Address (per parent factory <parent_slug>)".';

-- ---------------------------------------------------------------------------
-- 2. v_supplier_registry_ids_direct — keep attached facilities' own registry
--    pills visible after B1 unpublishes them. Body identical to REZ-98
--    (20260805_rez98_registry_ids_bgmea_backed_only) except each branch's
--    published gate becomes (is_published or attached facility) and this
--    comment block. The inheriting view (20260724 security batch) already
--    gates its inheritance branch on parent.is_published AND
--    child.is_published, so relaxing this view cannot make a facility donate
--    or inherit pills — it only makes the facility's OWN rows readable to
--    the facilities CTE below.
-- ---------------------------------------------------------------------------
create or replace view public.v_supplier_registry_ids_direct as
-- BGMEA (typed text[] column on suppliers; can be multi-value)
-- Backed-only: the supplier must itself hold an ACTIVE BGMEA record for this
-- number. `bgmea_web` keys general members as `general:{reg}`, so the ref is
-- the primary test; the stored payload field covers rows keyed `member:{id}`
-- because the register published no number for them.
select s.id              as supplier_id,
       'BGMEA'::text     as source_code,
       'BGMEA Reg #'     as label,
       n.value           as value,
       coalesce(s.bgmea_verified, false) as verified,
       'https://www.bgmea.com.bd/'::text as source_url
  from public.suppliers s
  cross join lateral unnest(s.bgmea_reg_numbers) as n(value)
 where (s.is_published = true or s.facility_of is not null)
   and array_length(s.bgmea_reg_numbers, 1) > 0
   and exists (
         select 1
           from public.source_records sr
           join public.sources src on src.id = sr.source_id and src.code = 'BGMEA'
          where sr.supplier_id = s.id
            and sr.status = 'active'
            and (
                  sr.source_ref = 'general:' || n.value
               or sr.fields->>'bgmea_reg_number' = n.value
            )
       )

union all
-- BKMEA (typed single-value column on suppliers)
select s.id, 'BKMEA', 'BKMEA #',
       s.bkmea_reg_number,
       coalesce(s.bkmea_verified, false),
       'https://www.bkmea.com/'
  from public.suppliers s
 where (s.is_published = true or s.facility_of is not null)
   and s.bkmea_reg_number is not null
   and btrim(s.bkmea_reg_number) <> ''

union all
-- RSC (sidecar table)
select rr.supplier_id, 'RSC', 'RSC ID',
       rr.rsc_factory_id,
       true,
       'https://www.rsc-bd.org/'
  from public.rsc_remediation rr
  join public.suppliers s
    on s.id = rr.supplier_id
   and (s.is_published = true or s.facility_of is not null)
 where rr.rsc_factory_id is not null
   and btrim(rr.rsc_factory_id) <> ''

union all
-- EPB (Tier 1 government registry; payload-only)
select sr.supplier_id, 'EPB', 'EPB Reg #',
       sr.fields->>'epb_reg_no',
       true,
       'https://epb.gov.bd/'
  from public.source_records sr
  join public.sources src on src.id = sr.source_id
  join public.suppliers s
    on s.id = sr.supplier_id
   and (s.is_published = true or s.facility_of is not null)
 where src.code = 'EPB'
   and sr.status = 'active'
   and sr.supplier_id is not null
   and sr.fields ? 'epb_reg_no'
   and btrim(sr.fields->>'epb_reg_no') <> ''

union all
-- BGAPMEA (Tier 2 association; payload-only)
select sr.supplier_id, 'BGAPMEA', 'BGAPMEA #',
       sr.fields->>'bgapmea_membership_no',
       true,
       'https://bgapmea.org/'
  from public.source_records sr
  join public.sources src on src.id = sr.source_id
  join public.suppliers s
    on s.id = sr.supplier_id
   and (s.is_published = true or s.facility_of is not null)
 where src.code = 'BGAPMEA'
   and sr.status = 'active'
   and sr.supplier_id is not null
   and sr.fields ? 'bgapmea_membership_no'
   and btrim(sr.fields->>'bgapmea_membership_no') <> ''

union all
-- BTMA (Tier 2 association; payload-only — SL # from members list)
select sr.supplier_id, 'BTMA', 'BTMA Member #SL',
       sr.fields->>'btma_sl_no',
       true,
       'https://btmadhaka.com/'
  from public.source_records sr
  join public.sources src on src.id = sr.source_id
  join public.suppliers s
    on s.id = sr.supplier_id
   and (s.is_published = true or s.facility_of is not null)
 where src.code = 'BTMA'
   and sr.status = 'active'
   and sr.supplier_id is not null
   and sr.fields ? 'btma_sl_no'
   and btrim(sr.fields->>'btma_sl_no') <> ''

union all
-- Certifications (typed cert table — GOTS / OEKO-TEX / WRAP / SA8000 / SEDEX / GRS / ...)
select c.supplier_id,
       upper(c.kind::text) as source_code,
       upper(c.kind::text) || ' Cert #' as label,
       c.certificate_no,
       true,
       c.document_url
  from public.certifications c
  join public.suppliers s
    on s.id = c.supplier_id
   and (s.is_published = true or s.facility_of is not null)
 where c.certificate_no is not null
   and btrim(c.certificate_no) <> '';

comment on view public.v_supplier_registry_ids_direct is
  'Raw, source-records / typed-column-driven registry/membership/certificate IDs per supplier. Published suppliers — and, per REZ-73, attached facilities (facility_of not null), whose own pills surface on the published mother profile via buyer_supplier_profile. BGMEA numbers are shown only when the supplier itself holds an active BGMEA source record for that number (REZ-98): the array is append-only and retains registrations whose record has since moved to another supplier. Subset of v_supplier_registry_ids; the parent view UNIONs this with inherited rows for RSC sibling/extension factories and gates both inheritance sides on is_published, so facilities neither donate nor inherit.';

-- 0082 precedent (the address views): these views are defence-in-depth
-- behind SECURITY DEFINER RPCs, not a public API. The REZ-73 relaxation
-- above would otherwise let an anonymous caller enumerate an UNPUBLISHED
-- facility's registry numbers by supplier_id.
revoke select on public.v_supplier_registry_ids_direct from anon, authenticated;
revoke select on public.v_supplier_registry_ids        from anon, authenticated;
revoke select on public.v_supplier_addresses_direct    from anon, authenticated;
revoke select on public.v_supplier_addresses           from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. buyer_supplier_profile — 0095 body + facilities CTE + payload key.
-- ---------------------------------------------------------------------------
create or replace function public.buyer_supplier_profile(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with s as (
    select *
      from public.suppliers
     where slug = p_slug
       and is_published = true
     limit 1
  ),
  ring as (
    select coalesce(count(distinct sr.source_id), 0)::int as t13
      from s
      join public.source_records sr on sr.supplier_id = s.id
     where sr.status      = 'active'
       and sr.source_tier in ('tier1_gov','tier2_industry','tier3_cert')
  ),
  pills as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'source_code',         p.source_code,
          'label',               p.label,
          'value',               p.value,
          'verified',            p.verified,
          'source_url',          p.source_url,
          'inherited_from',      p.inherited_from,
          'inherited_from_name', p.inherited_from_name
        )
        order by (p.inherited_from is not null), p.source_code, p.value nulls last
      ),
      '[]'::jsonb
    ) as items
    from s
    join public.v_supplier_registry_ids p on p.supplier_id = s.id
  ),
  certs as (
    -- REZ-93: union parent + facility_of children; label inherited rows;
    -- DISTINCT ON (id) collapses the same certifications row twice.
    -- DISPLAY-ONLY — pills CTE and discover_suppliers stay on s.id alone.
    select coalesce(
      jsonb_agg(
        (
          jsonb_build_object(
            'kind',           c.kind,
            'certificate_no', c.certificate_no,
            'issuer',         c.issuer,
            'issued_on',      c.issued_on,
            'expires_on',     c.expires_on,
            'scope',          c.scope,
            'document_url',   c.document_url
          )
          || case
               when c.building_name is not null
               then jsonb_build_object('building_name', c.building_name)
               else '{}'::jsonb
             end
        )
        order by (c.building_name is not null), c.building_name nulls first,
                 c.kind, c.expires_on desc nulls last
      ),
      '[]'::jsonb
    ) as items
    from (
      select distinct on (owned.id)
             owned.id,
             owned.kind,
             owned.certificate_no,
             owned.issuer,
             owned.issued_on,
             owned.expires_on,
             owned.scope,
             owned.document_url,
             owned.building_name
        from (
          select c.id,
                 c.kind::text as kind,
                 c.certificate_no,
                 c.issuer,
                 c.issued_on,
                 c.expires_on,
                 c.scope,
                 c.document_url,
                 null::text as building_name
            from s
            join public.certifications c on c.supplier_id = s.id
          union all
          select c.id,
                 c.kind::text as kind,
                 c.certificate_no,
                 c.issuer,
                 c.issued_on,
                 c.expires_on,
                 c.scope,
                 c.document_url,
                 f.company_name as building_name
            from s
            join public.suppliers f
              on f.facility_of = s.id
            join public.certifications c
              on c.supplier_id = f.id
        ) owned
       order by owned.id, owned.building_name nulls last
    ) c
  ),
  rsc as (
    select jsonb_build_object(
      'progress_pct',                rr.progress_pct,
      'workers_count',               rr.workers_count,
      'remediation_status',          rr.remediation_status,
      'training_status',             rr.training_status,
      'parent_group_name',           rr.parent_group_name,
      'parent_group_factory_count',  rr.parent_group_factory_count,
      'fire_inspection_url',         rr.fire_inspection_url,
      'structural_inspection_url',   rr.structural_inspection_url,
      'electrical_inspection_url',   rr.electrical_inspection_url,
      'boiler_inspection_url',       rr.boiler_inspection_url,
      'cap_url',                     rr.cap_url
    ) as obj
    from s
    join public.rsc_remediation rr on rr.supplier_id = s.id and rr.active = true
    limit 1
  ),
  brands as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'source_code',  src.code,
          'display_name', src.display_name,
          'source_url',   coalesce(nullif(sr.fields->>'source_url', ''), src.base_url),
          'last_seen_at', sr.fetched_at
        )
        order by src.code
      ),
      '[]'::jsonb
    ) as items
    from s
    join public.source_records sr on sr.supplier_id = s.id and sr.status = 'active'
    join public.sources src        on src.id = sr.source_id
    where src.code like 'BRAND\_%' escape '\'
  ),
  sanc as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'list',           ss.list::text,
          'matched_name',   ss.matched_name,
          'list_entry_ref', ss.list_entry_ref,
          'screened_at',    ss.screened_at,
          'source_url',     sle.source_url,
          'listed_date',    sle.listed_date
        )
        order by ss.screened_at desc
      ),
      '[]'::jsonb
    ) as items
    from s
    join public.sanctions_screening ss on ss.supplier_id = s.id and ss.active = true
    left join public.sanctions_list_entries sle
      on sle.list = ss.list and sle.entry_ref = ss.list_entry_ref
  ),
  provenance as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'source_code',  src.code,
          'display_name', src.display_name,
          'tier',         sr.source_tier::text,
          'source_ref',   sr.source_ref,
          'source_url',   coalesce(nullif(sr.fields->>'source_url', ''), src.base_url),
          'last_seen_at', sr.fetched_at
        )
        order by sr.source_tier::text, src.code, sr.fetched_at desc
      ),
      '[]'::jsonb
    ) as items
    from s
    join public.source_records sr on sr.supplier_id = s.id and sr.status = 'active'
    join public.sources src        on src.id = sr.source_id
  ),
  addresses as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'kind',         va.address_kind,
          'address',      va.address,
          'source_code',  va.source_code,
          'fetched_at',   va.fetched_at
        )
        order by va.address_kind, va.source_code
      ),
      '[]'::jsonb
    ) as items
    from s
    join public.v_supplier_addresses va on va.supplier_id = s.id
  ),
  -- REZ-93: union parent + facility_of children; label inherited rows;
  -- DISTINCT ON (id) collapses the same compliance_documents row twice.
  -- Index used: idx_suppliers_facility_of (partial) via f.facility_of = s.id
  -- for a single mother — no suppliers scan.
  docs as (
    select coalesce(
      jsonb_agg(
        (
          jsonb_build_object(
            'doc_type',     d.doc_type,
            'mirror_url',   d.mirror_url,
            'original_url', d.original_url,
            'fetched_at',   d.fetched_at,
            'file_size',    d.file_size
          )
          || case
               when d.building_name is not null
               then jsonb_build_object('building_name', d.building_name)
               else '{}'::jsonb
             end
        )
        order by (d.building_name is not null), d.building_name nulls first,
                 d.doc_type, d.fetched_at desc
      ),
      '[]'::jsonb
    ) as items
    from (
      select distinct on (owned.id)
             owned.id,
             owned.doc_type,
             owned.mirror_url,
             owned.original_url,
             owned.fetched_at,
             owned.file_size,
             owned.building_name
        from (
          select cd.id,
                 cd.doc_type,
                 cd.mirror_url,
                 cd.original_url,
                 cd.fetched_at,
                 cd.file_size,
                 null::text as building_name
            from s
            join public.compliance_documents cd on cd.supplier_id = s.id
          union all
          select cd.id,
                 cd.doc_type,
                 cd.mirror_url,
                 cd.original_url,
                 cd.fetched_at,
                 cd.file_size,
                 f.company_name as building_name
            from s
            join public.suppliers f
              on f.facility_of = s.id
            join public.compliance_documents cd
              on cd.supplier_id = f.id
        ) owned
       order by owned.id, owned.building_name nulls last
    ) d
  ),
  -- REZ-73: one object per live facility of the viewed mother. Name keeps
  -- the Extension / Unit-2 suffix — that suffix IS the building id. The
  -- four numerics feed the app-side REZ-92 group roll-up; the mother's own
  -- supplier.* figures are never replaced. Addresses mirror the parent
  -- addresses CTE key shape (0079: no phone/email) and come from the
  -- DIRECT view — a facility never inherits the mother's addresses. Pills
  -- come from v_supplier_registry_ids_direct for the same reason. RSC is
  -- the building's own active remediation row, never merged with the
  -- mother's. No slug / id / contact / completeness / SBI keys.
  facilities as (
    select coalesce(
      -- Tiebreak on id (never emitted): same-named sibling facilities are a
      -- real population (REZ-105), and jsonb_agg ties are otherwise
      -- non-deterministic between runs.
      jsonb_agg(fac.obj order by fac.facility_name, fac.facility_id),
      '[]'::jsonb
    ) as items
    from (
      select f.company_name as facility_name,
             f.id as facility_id,
             jsonb_build_object(
               'name',                            f.company_name,
               'employees_total',                 f.employees_total,
               'machines_sewing',                 f.machines_sewing,
               'production_capacity_pcs_day',     f.production_capacity_pcs_day,
               'production_capacity_dozen_yearly', f.production_capacity_dozen_yearly,
               -- Sanction status is a buyer-protection signal, not identity:
               -- it was public while the building was published, and a
               -- sanctioned building must not lose its marker at attach.
               'is_sanctioned',                   f.is_sanctioned,
               'addresses', coalesce(fa.items, '[]'::jsonb),
               'pills',     coalesce(fp.items, '[]'::jsonb),
               'rsc',       fr.obj
             ) as obj
        from s
        join public.suppliers f on f.facility_of = s.id
        left join lateral (
          select jsonb_agg(
                   jsonb_build_object(
                     'kind',        va.address_kind,
                     'address',     va.address,
                     'source_code', va.source_code,
                     'fetched_at',  va.fetched_at
                   ) order by va.address_kind, va.source_code
                 ) as items
            from public.v_supplier_addresses_direct va
           where va.supplier_id = f.id
        ) fa on true
        left join lateral (
          select jsonb_agg(
                   jsonb_build_object(
                     'source_code', p.source_code,
                     'label',       p.label,
                     'value',       p.value,
                     'verified',    p.verified,
                     'source_url',  p.source_url
                   ) order by p.source_code, p.value nulls last
                 ) as items
            from public.v_supplier_registry_ids_direct p
           where p.supplier_id = f.id
        ) fp on true
        left join lateral (
          select jsonb_build_object(
                   'progress_pct',       rr.progress_pct,
                   'workers_count',      rr.workers_count,
                   'remediation_status', rr.remediation_status,
                   'training_status',    rr.training_status
                 ) as obj
            from public.rsc_remediation rr
           where rr.supplier_id = f.id
             and rr.active = true
           limit 1
        ) fr on true
    ) fac
  ),
  partner_factories as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id',           f.id,
          'slug',         f.slug,
          'company_name', f.company_name,
          'entity_type',  f.entity_type::text,
          'city',         f.city,
          'district',     f.district,
          'decided_at',   sr.decided_at
        )
        order by f.company_name
      ),
      '[]'::jsonb
    ) as items
    from s
    join public.supplier_relationships sr
      on sr.buying_house_id = s.id and sr.status = 'accepted'
    join public.suppliers f
      on f.id = sr.factory_id
     and f.is_published = true
    where s.entity_type::text = 'buying_house'
  ),
  partner_buying_houses as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id',           bh.id,
          'slug',         bh.slug,
          'company_name', bh.company_name,
          'entity_type',  bh.entity_type::text,
          'city',         bh.city,
          'district',     bh.district,
          'decided_at',   sr.decided_at
        )
        order by bh.company_name
      ),
      '[]'::jsonb
    ) as items
    from s
    join public.supplier_relationships sr
      on sr.factory_id = s.id and sr.status = 'accepted'
    join public.suppliers bh
      on bh.id = sr.buying_house_id
     and bh.is_published = true
    where s.entity_type::text = 'factory'
  )
  select jsonb_build_object(
    'supplier', jsonb_build_object(
      'id',                              s.id,
      'slug',                            s.slug,
      'company_name',                    s.company_name,
      'entity_type',                     s.entity_type::text,
      'city',                            s.city,
      'district',                        s.district,
      'country',                         s.country,
      'address_raw',                     s.address_raw,
      'completeness_pct',                s.completeness_pct,
      'is_sanctioned',                   s.is_sanctioned,
      'parent_group_name',               s.parent_group_name,
      'established_date',                s.established_date,
      'bepza_zone',                      s.bepza_zone,
      'factory_types',                   s.factory_types,
      'principal_products',              s.principal_products,
      'employees_total',                 s.employees_total,
      'employees_male',                  s.employees_male,
      'employees_female',                s.employees_female,
      'machines_sewing',                 s.machines_sewing,
      'production_capacity_pcs_day',     s.production_capacity_pcs_day,
      'production_capacity_dozen_yearly',s.production_capacity_dozen_yearly,
      'source_tags',                     s.source_tags,
      'supplier_tagline',                s.supplier_tagline,
      'supplier_about',                  s.supplier_about,
      'supplier_moq',                    s.supplier_moq,
      'supplier_lead_time_days',         s.supplier_lead_time_days,
      'supplier_capabilities',           coalesce(s.supplier_capabilities, '{}'::text[])
    ),
    't13_source_count',     (select t13   from ring),
    'pills',                (select items from pills),
    'certifications',       (select items from certs),
    'rsc_remediation',      (select obj   from rsc),
    'brand_attributions',   (select items from brands),
    'sanctions',            (select items from sanc),
    'provenance',           (select items from provenance),
    'addresses',            (select items from addresses),
    'documents',            (select items from docs),
    'facilities',           (select items from facilities),
    'partner_factories',
      coalesce((select items from partner_factories), '[]'::jsonb),
    'partner_buying_houses',
      coalesce((select items from partner_buying_houses), '[]'::jsonb)
  )
  from s
$$;

revoke all on function public.buyer_supplier_profile(text) from public;
grant execute on function public.buyer_supplier_profile(text) to anon, authenticated;

comment on function public.buyer_supplier_profile(text) is
  'Buyer-facing factory profile (Spec B2; extended by S2 + S5; REZ-7/0079/REZ-24 '
  'removed address contact PII; REZ-93 unions facility_of compliance_documents '
  'and certifications labelled by building_name — display-only, does not feed '
  'discover/pills/t13; REZ-73 adds facilities[] — per-building name, PII-stripped '
  'direct addresses, direct registry pills, own RSC progress, is_sanctioned '
  'flag and the four roll-up numerics for the app-side REZ-92 group total). '
  'partner_factories[] '
  'on buying_house pages and partner_buying_houses[] on factory pages contain '
  'only accepted relationships. Never returns contact PII (no '
  'phone/email/contact_name). Never emits facility slug, id, source_ref '
  'or SBI.';

-- ---------------------------------------------------------------------------
-- Facility→facility chain refusal (audit-cycle-4 MAJOR)
-- ---------------------------------------------------------------------------
-- 0091 only CHECKs facility_of <> id. REZ-92 and the facilities CTE walk
-- only direct children (f.facility_of = s.id), so a building-of-a-building
-- silently drops grandchildren from the group total while the mid-node
-- 404s via facility_parent_slug. The upsert path already refuses
-- facility parents (facility_of is null on both lookups); this trigger
-- closes every other writer — including the REZ-71 backfill UPDATE.
create or replace function public.enforce_facility_parent_is_company()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.facility_of is not null then
    -- Lock the candidate parent so a concurrent UPDATE cannot turn it into
    -- a facility between our EXISTS check and commit (READ COMMITTED race).
    perform 1 from public.suppliers p
     where p.id = new.facility_of
     for update;
    if exists (
      select 1 from public.suppliers p
       where p.id = new.facility_of
         and p.facility_of is not null
    ) then
      raise exception
        'cannot set facility_of to a facility row % — parent must be a company',
        new.facility_of
        using errcode = 'check_violation';
    end if;
  end if;
  -- Becoming a facility while other rows already point here would open the
  -- same silent-undercount window from the other direction. Lock children
  -- first so a concurrent INSERT of a new child cannot sneak past.
  if new.facility_of is not null then
    perform 1 from public.suppliers c
     where c.facility_of = new.id
     for update;
    if exists (
      select 1 from public.suppliers c where c.facility_of = new.id
    ) then
      raise exception
        'cannot mark supplier % as a facility while other rows reference it via facility_of',
        new.id
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_suppliers_facility_parent_is_company
  on public.suppliers;
create trigger trg_suppliers_facility_parent_is_company
  before insert or update of facility_of on public.suppliers
  for each row execute function public.enforce_facility_parent_is_company();

comment on function public.enforce_facility_parent_is_company() is
  'REZ-73 / REZ-92 durable guard: facility_of targets must themselves be '
  'companies (facility_of IS NULL), and a row that already has facility '
  'children cannot become a facility. Complements the upsert pin and the '
  '0091 self-reference CHECK.';

notify pgrst, 'reload schema';
