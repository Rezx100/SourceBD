-- 0122 — certificates read daily: last seen, "no longer listed", and the
-- date each certificate was last checked with its body.
-- Spec: context/feature-specs/spec-etl-freshness.md, slice S2 (§3, §4.4).
--
-- WHY
-- ---
-- GOTS, WRAP, OEKO-TEX and SA8000 were read once in May–July. 316 of their
-- certificates have expired since our last read; nothing can say whether the
-- body renewed them, still lists them as expired, or dropped them. A scheduled
-- read needs, per certificate:
--   * `last_seen_at`, `last_seen_run_id`: the read that last saw it listed;
--   * `listing_status`: 'listed' or 'no_longer_listed' (rows are never
--     deleted); `flipped_by_run_id`: the read that last changed it.
-- (etl/core/cert_reconcile.py writes them; the first read of each scheme is
-- held for the founder before anything is marked.)
--
-- Also:
--   * OEKO-TEX source records are re-keyed from `oeko-tex-{customer}` to
--     `oeko-tex-{customer}:{standard}`. One customer with two standards
--     shared one record, so every read overwrote one with the other. Only rows
--     whose new key is free are renamed; the code keeps the old key as an
--     alias, so a row left behind still resolves to the same company.
--   * `supplier_cert_checks(slug)`: per certificate on a published record,
--     its listing status and when it was last checked with the body, plus each
--     scheme's last complete read. The record's certificate rows use it.
--   * `compliance_expired_certs()` (0108, scoped by 0116's workspace_owner())
--     now also lists a certificate the body
--     no longer lists, with `listing_status` and `delisted_on` on each row.
--     The body is production's live one (6 Oct 2026, 0108 as patched by 0116)
--     plus the listing rule; nothing else changes.
--
-- Deploy order: code before migration is safe. The scrapers' reconcile and
-- the record's check line fail soft until the columns exist.
--
-- REVERSE
-- -------
--   drop function if exists public.supplier_cert_checks(text);
--   (0108's body for compliance_expired_certs is in 0108)
--   update public.source_records sr set source_ref = split_part(sr.source_ref, ':', 1)
--     from public.sources s where s.id = sr.source_id and s.code = 'OEKO_TEX'
--      and sr.source_ref like 'oeko-tex-%:%';
--   alter table public.certifications
--     drop column if exists last_seen_at, drop column if exists last_seen_run_id,
--     drop column if exists listing_status, drop column if exists flipped_by_run_id;

-- ---------------------------------------------------------------------------
-- 1. Columns
-- ---------------------------------------------------------------------------
alter table public.certifications
  add column if not exists last_seen_at      timestamptz,
  add column if not exists last_seen_run_id  uuid,
  add column if not exists listing_status    text not null default 'listed',
  add column if not exists flipped_by_run_id uuid;

alter table public.certifications drop constraint if exists chk_certifications_listing_status;
alter table public.certifications
  add constraint chk_certifications_listing_status
    check (listing_status in ('listed', 'no_longer_listed'));

create index if not exists idx_certifications_kind_listing
  on public.certifications (kind, listing_status);

-- ---------------------------------------------------------------------------
-- 2. OEKO-TEX: one source record per customer and standard
-- ---------------------------------------------------------------------------
update public.source_records sr
   set source_ref = sr.source_ref || ':' || (sr.fields ->> 'oeko_standard')
  from public.sources s
 where s.id = sr.source_id
   and s.code = 'OEKO_TEX'
   and sr.source_ref ~ '^oeko-tex-[^:]+$'
   and coalesce(sr.fields ->> 'oeko_standard', '') <> ''
   and not exists (
     select 1 from public.source_records t
      where t.source_id = sr.source_id
        and t.supplier_id = sr.supplier_id
        and t.source_ref = sr.source_ref || ':' || (sr.fields ->> 'oeko_standard')
   );

-- ---------------------------------------------------------------------------
-- 3. The record's certificate check line
-- ---------------------------------------------------------------------------
create or replace function public.supplier_cert_checks(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with s as (
    select id from public.suppliers
     where slug = p_slug and is_published = true
  )
  select case when not exists (select 1 from s) then null else jsonb_build_object(
    'certs', coalesce((
      select jsonb_agg(jsonb_build_object(
               'kind',           c.kind::text,
               'certificate_no', c.certificate_no,
               'expires_on',     c.expires_on,
               'listing_status', c.listing_status,
               'checked_at',     coalesce(c.last_seen_at, sr.fetched_at),
               'delisted_at',    case when c.listing_status = 'no_longer_listed'
                                      then (select r.finished_at from public.etl_runs r
                                             where r.id = c.flipped_by_run_id) end))
        from public.certifications c
        left join public.source_records sr on sr.id = c.source_record_id
       where c.supplier_id = (select id from s)
         and c.rejected_at is null), '[]'::jsonb),
    'reads', coalesce((
      select jsonb_object_agg(k.kind, (
               select max(r.finished_at) from public.etl_runs r
                where r.status = 'success'
                  and r.meta -> 'reconcile' -> k.kind ->> 'action' in ('reconcile', 'held')))
        from (values ('gots'), ('wrap'), ('oeko_tex'), ('sa8000')) as k(kind)), '{}'::jsonb)
  ) end
$$;

comment on function public.supplier_cert_checks(text) is
  'Per certificate on a published record: listing status and when it was last '
  'checked with its body (last read that saw it, else the stored read), plus '
  'each scheme''s last complete read. No PII, no SBI. Spec etl-freshness S2.';

revoke all on function public.supplier_cert_checks(text) from public;
revoke all on function public.supplier_cert_checks(text) from anon;
grant execute on function public.supplier_cert_checks(text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. Compliance hub / Saved: expired OR no longer listed
--    (0108's body, plus the listing rule and two row keys)
-- ---------------------------------------------------------------------------
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
      c.listing_status,
      case when c.listing_status = 'no_longer_listed'
           then (select r.finished_at::date from public.etl_runs r
                  where r.id = c.flipped_by_run_id) end as delisted_on,
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
    where ss.owner_id     = public.workspace_owner()   -- 0116: a member reads the owner's list
      and s.is_published  = true
      and s.is_sanctioned = false
      and c.rejected_at is null
      and (c.expires_on < current_date or c.listing_status = 'no_longer_listed')
      and not exists (
        select 1
          from public.certifications r
         where r.supplier_id = c.supplier_id
           and r.kind        = c.kind
           and r.rejected_at is null
           and r.listing_status = 'listed'
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
        'listing_status', listing_status,
        'delisted_on',    delisted_on,
        'supplier',       supplier
      )
      order by coalesce(delisted_on, expires_on) desc, company_name, kind
    ), '[]'::jsonb)
  )
  from lapsed;
$$;

comment on function public.compliance_expired_certs() is
  'Compliance hub: certificates on the caller''s saved suppliers that have '
  'expired, or that their body no longer lists, with no later listed '
  'certificate of the same scheme on file. Scoped by the caller''s workspace '
  'saved_suppliers via workspace_owner(); 0030''s row shape plus listing_status and delisted_on. '
  'Excludes contact PII + SBI.';

revoke all     on function public.compliance_expired_certs() from public;
revoke all     on function public.compliance_expired_certs() from anon;
grant  execute on function public.compliance_expired_certs() to authenticated, service_role;
