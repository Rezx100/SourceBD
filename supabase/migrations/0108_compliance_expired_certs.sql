-- 0108 — Expired certificates on the buyer's saved suppliers.
--
-- `compliance_expiring_certs` (0030) reads `expires_on >= current_date`, so the
-- day a saved supplier's certificate lapses it leaves the Compliance hub, the
-- one screen built to warn about it; `buyer_dashboard`'s alerts (0026, the
-- Saved page) cut at the same line. This adds ONE sibling function that lists
-- what those two drop. Neither existing function is rewritten: the pages call
-- this one beside them, so nothing already live changes shape.
--
--   * `compliance_expired_certs()` — every certificate on the caller's saved
--     suppliers that has expired and has no renewal on file, most recently
--     lapsed first. "A renewal on file" is another certificate of the same
--     scheme on the same supplier with a later expiry date. So of a run of
--     lapsed GOTS certificates only the latest is listed, and a certificate
--     replaced by a newer one is not listed at all. On 3 Oct 2026, 503
--     certificates on published suppliers had expired; 30 had a later one on
--     file, so 473 qualified (262 GOTS, 207 WRAP, 4 SA8000). None had only an
--     undated certificate of its scheme beside it, so an undated one is not
--     counted as a renewal.
--
-- Same rules as 0030: ownership is `saved_suppliers.owner_id = auth.uid()`
-- (no rows for a signed-out caller); published, unsanctioned suppliers only;
-- the row shape is 0030's `rows[]` (kind, certificate_no, issuer, expires_on,
-- document_url, days_remaining — negative here — and supplier{id, slug,
-- company_name, entity_type, city, district}); no contact PII, no SBI. Unlike
-- 0030 it skips a certificate an admin rejected (`rejected_at`), as the search
-- does (0104).
--
-- Reversible:
--   drop function public.compliance_expired_certs();

create or replace function public.compliance_expired_certs()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with lapsed as (
    select
      c.kind::text                    as kind,
      c.certificate_no,
      c.issuer,
      c.expires_on,
      c.document_url,
      (c.expires_on - current_date)   as days_remaining,
      s.company_name,
      jsonb_build_object(
        'id',           s.id,
        'slug',         s.slug,
        'company_name', s.company_name,
        'entity_type',  s.entity_type::text,
        'city',         s.city,
        'district',     s.district
      )                               as supplier
    from public.saved_suppliers ss
    join public.suppliers s
      on s.id = ss.supplier_id
    join public.certifications c
      on c.supplier_id = s.id
    where ss.owner_id     = auth.uid()
      and s.is_published  = true
      and s.is_sanctioned = false
      and c.rejected_at is null
      and c.expires_on    < current_date
      and not exists (
        select 1
          from public.certifications r
         where r.supplier_id = c.supplier_id
           and r.kind        = c.kind
           and r.rejected_at is null
           and r.expires_on  > c.expires_on
      )
  )
  select jsonb_build_object(
    'total', count(*)::int,
    'rows',  coalesce(jsonb_agg(
      jsonb_build_object(
        'kind',           kind,
        'certificate_no', certificate_no,
        'issuer',         issuer,
        'expires_on',     expires_on,
        'document_url',   document_url,
        'days_remaining', days_remaining,
        'supplier',       supplier
      )
      order by expires_on desc, company_name, kind
    ), '[]'::jsonb)
  )
  from lapsed;
$$;

comment on function public.compliance_expired_certs() is
  'Compliance hub: certificates on the caller''s saved suppliers that have '
  'expired with no later certificate of the same scheme on file, most '
  'recently lapsed first. Scoped by auth.uid() via saved_suppliers; same row '
  'shape as compliance_expiring_certs. Excludes contact PII + SBI.';

-- `revoke ... from public` does not touch Supabase's default grant to `anon`
-- by name (see 0105), so `anon` is revoked by name too.
revoke all     on function public.compliance_expired_certs() from public;
revoke all     on function public.compliance_expired_certs() from anon;
grant  execute on function public.compliance_expired_certs() to authenticated, service_role;
