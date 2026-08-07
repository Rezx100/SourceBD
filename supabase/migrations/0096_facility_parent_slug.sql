-- 0096 — facility_parent_slug RPC (REZ-72 / Extensions B2).
--
-- WHY
-- ---
-- B1 will attach ~493 extension / new-building rows as unpublished facilities
-- (`facility_of` set). Those slugs are already in Google's index and in our
-- sitemap. Once unpublished, `buyer_supplier_profile` returns nothing and both
-- profile routes 404 — the worst outcome for an indexed company-name URL.
--
-- Anon cannot SELECT unpublished suppliers (`pol_suppliers_pub_read` + migration
-- 0082 column revoke), so the routes cannot join `facility_of` via PostgREST.
-- They need a narrow SECURITY DEFINER lookup that returns only the published
-- mother's slug.
--
-- WHY THIS IS SAFE
-- ----------------
-- The function returns a single `text` slug of an already-published mother.
-- No company name, no PII, no unpublished row fields. The only disclosure is
-- "this unpublished slug maps to that published mother", which is exactly what
-- the permanent redirect discloses to the browser and to Google anyway.
-- Unpublished non-facility rows (sanctions, insufficient evidence) have
-- `facility_of is null`, so the join yields NULL and the 404 stands.
-- If the mother herself is unpublished, return NULL — do not chain-redirect.
--
-- NON-GOALS
-- ---------
-- Do NOT change `buyer_supplier_profile`. Do NOT add middleware or a redirect
-- table. Do NOT expose any column other than the parent slug.
--
-- REVERSE
-- -------
--   drop function if exists public.facility_parent_slug(text);
--
-- Not applied in the authoring session — STOP AND ASK before production.

create or replace function public.facility_parent_slug(p_slug text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.slug
    from public.suppliers c
    join public.suppliers p on p.id = c.facility_of
   where c.slug = p_slug
     and c.facility_of is not null
     and p.is_published = true
   limit 1;
$$;

revoke all on function public.facility_parent_slug(text) from public;
grant execute on function public.facility_parent_slug(text) to anon, authenticated;

comment on function public.facility_parent_slug(text) is
  'REZ-72: returns the published mother slug for an unpublished facility row, or NULL. Used by profile routes to permanentRedirect before notFound(). Returns only a slug — no PII.';
