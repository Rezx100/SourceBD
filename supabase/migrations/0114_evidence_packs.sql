-- 0114 — Evidence packs: the rows of a pack and a record of each download (5 Oct 2026).
--
-- Spec: context/feature-specs/gap-08-evidence-packs.md (gap list row 8).
--
--   1. evidence_pack(sections, format) returns the pack for the caller's
--      saved suppliers, one uniform row shape for every section:
--        {section, supplier, supplier_slug, item, state, date, source,
--         checked_on, address}
--      sections: cert_expiry (every certificate on file, its state and
--      date), uflpa (on the list, possible Xinjiang link, or no link found;
--      the same rule as compliance_uflpa_tracker), sources (every active
--      source record and the address it holds). Every row names its source
--      and the date we checked it.
--   2. Calling it is the download: it writes one evidence_pack_downloads
--      row (sections, format, how many suppliers and rows), which "Evidence
--      packs downloaded" this month and the audit log will read.
--
-- Hard invariants honoured:
--   * Server enforces auth + ownership: SECURITY DEFINER on auth.uid()'s
--     saved suppliers only; published suppliers only; rejected certificates
--     left out (as the hub does); anon revoked by name.
--   * The download log has RLS: an owner reads their own rows; nobody writes
--     them except through evidence_pack().
--   * At most 50 packs a day per buyer (each one reads every saved supplier).
--
-- Idempotent and additive: `if not exists`, `create or replace`. No existing
-- row changes.
--
-- Do not apply to production from this PR (AGENTS rule 15); the founder
-- applies it after the dry run in ops/plans/0114-dry-run.md.
--
-- Reversible:
--   drop function public.evidence_pack(text[], text);
--   drop table public.evidence_pack_downloads;

set search_path = public;

create table if not exists public.evidence_pack_downloads (
  id             uuid        primary key default gen_random_uuid(),
  owner_id       uuid        not null references auth.users(id) on delete cascade,
  sections       text[]      not null,
  format         text        not null,
  supplier_count int         not null,
  row_count      int         not null,
  created_at     timestamptz not null default now(),
  constraint evidence_pack_downloads_format_check check (format in ('csv', 'pdf')),
  constraint evidence_pack_downloads_sections_check
    check (cardinality(sections) between 1 and 3 and sections <@ array['cert_expiry', 'uflpa', 'sources'])
);

create index if not exists idx_evidence_pack_downloads_owner_created
  on public.evidence_pack_downloads (owner_id, created_at desc);

alter table public.evidence_pack_downloads enable row level security;
revoke all on table public.evidence_pack_downloads from anon, authenticated;
grant select on table public.evidence_pack_downloads to authenticated;

drop policy if exists pol_evidence_pack_downloads_select_self on public.evidence_pack_downloads;
create policy pol_evidence_pack_downloads_select_self
  on public.evidence_pack_downloads
  for select
  to authenticated
  using (owner_id = auth.uid());

create or replace function public.evidence_pack(p_sections text[], p_format text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_sections  text[];
  v_suppliers int;
  v_rows      jsonb := '[]'::jsonb;
  v_part      jsonb;
  v_uflpa_on  timestamptz;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_format is null or p_format not in ('csv', 'pdf') then
    raise exception 'format must be csv or pdf' using errcode = '22023';
  end if;
  select coalesce(array_agg(distinct s order by s), '{}') into v_sections
    from unnest(coalesce(p_sections, '{}')) s;
  if cardinality(v_sections) = 0 or not (v_sections <@ array['cert_expiry', 'uflpa', 'sources']) then
    raise exception 'sections must be one or more of cert_expiry, uflpa, sources' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('evidence_pack:' || v_uid::text, 0));
  if (select count(*) from public.evidence_pack_downloads d
       where d.owner_id = v_uid and d.created_at > now() - interval '1 day') >= 50 then
    raise exception 'at most 50 evidence packs a day' using errcode = '54000';
  end if;

  select count(*) into v_suppliers
    from public.saved_suppliers ss
    join public.suppliers s on s.id = ss.supplier_id
   where ss.owner_id = v_uid and s.is_published;

  if 'cert_expiry' = any (v_sections) then
    select coalesce(jsonb_agg(jsonb_build_object(
             'section',       'cert_expiry',
             'supplier',      m.name,
             'supplier_slug', m.slug,
             'item',          upper(replace(c.kind::text, '_', '-')) || coalesce(' ' || c.certificate_no, ''),
             'state',         case when c.expires_on is null then 'no_expiry_date'
                                   when c.expires_on < current_date then 'expired'
                                   when c.expires_on < current_date + 90 then 'expiring'
                                   else 'valid' end,
             'date',          c.expires_on,
             'source',        coalesce(src.display_name, c.issuer, upper(replace(c.kind::text, '_', '-'))),
             'checked_on',    coalesce(sr.fetched_at, c.created_at)::date,
             'address',       null)
           order by m.name, c.kind, c.expires_on nulls last), '[]'::jsonb)
      into v_part
      from (select s.id, s.slug, s.company_name as name
              from public.saved_suppliers ss
              join public.suppliers s on s.id = ss.supplier_id
             where ss.owner_id = v_uid and s.is_published) m
      join public.certifications c on c.supplier_id = m.id and c.rejected_at is null
      left join public.source_records sr on sr.id = c.source_record_id
      left join public.sources src on src.id = sr.source_id;
    v_rows := v_rows || v_part;
  end if;

  if 'uflpa' = any (v_sections) then
    -- A supplier with no screening row was checked against our copy of the list:
    -- its date is when that copy was read.
    select max(e.fetched_at) into v_uflpa_on from public.sanctions_list_entries e where e.list = 'uflpa';
    select coalesce(jsonb_agg(jsonb_build_object(
             'section',       'uflpa',
             'supplier',      m.name,
             'supplier_slug', m.slug,
             'item',          hit.matched_name,
             'state',         case when hit.matched_name is not null then 'on_the_list'
                                   when (coalesce(s.parent_group_name, '') || ' ' || coalesce(s.address_raw, '') || ' '
                                         || coalesce(s.city, '') || ' ' || coalesce(s.district, ''))
                                        ~* '(xinjiang|uyghur|uighur|XUAR)' then 'possible_xinjiang_link'
                                   else 'no_link_found' end,
             'date',          hit.listed_date,
             'source',        'UFLPA Entity List',
             'checked_on',    coalesce(hit.screened_at, v_uflpa_on)::date,
             'address',       null)
           order by (hit.matched_name is null), m.name), '[]'::jsonb)
      into v_part
      from (select s.id, s.slug, s.company_name as name
              from public.saved_suppliers ss
              join public.suppliers s on s.id = ss.supplier_id
             where ss.owner_id = v_uid and s.is_published) m
      join public.suppliers s on s.id = m.id
      left join lateral (
        select x.matched_name, x.screened_at, sle.listed_date
          from public.sanctions_screening x
          left join public.sanctions_list_entries sle on sle.list = x.list and sle.entry_ref = x.list_entry_ref
         where x.supplier_id = m.id and x.list = 'uflpa' and x.active
         order by x.screened_at desc
         limit 1
      ) hit on true;
    v_rows := v_rows || v_part;
  end if;

  if 'sources' = any (v_sections) then
    select coalesce(jsonb_agg(jsonb_build_object(
             'section',       'sources',
             'supplier',      m.name,
             'supplier_slug', m.slug,
             'item',          coalesce(src.display_name, 'Source') || coalesce(' · ' || sr.source_ref, ''),
             'state',         coalesce(sr.source_tier, src.tier)::text,
             'date',          null,
             'source',        src.display_name,
             'checked_on',    sr.fetched_at::date,
             'address',       coalesce(sr.fields->>'factory_address', sr.fields->>'bkmea_factory_address',
                                       sr.fields->>'bgapmea_factory_address', sr.fields->>'epb_factory_address',
                                       sr.fields->>'raw_address', sr.fields->>'oeko_profile_address',
                                       sr.fields->>'address', sr.fields->>'mailing_address'))
           order by m.name, coalesce(sr.source_tier, src.tier), src.display_name, sr.fetched_at desc), '[]'::jsonb)
      into v_part
      from (select s.id, s.slug, s.company_name as name
              from public.saved_suppliers ss
              join public.suppliers s on s.id = ss.supplier_id
             where ss.owner_id = v_uid and s.is_published) m
      join public.source_records sr on sr.supplier_id = m.id and sr.status = 'active'
      left join public.sources src on src.id = sr.source_id;
    v_rows := v_rows || v_part;
  end if;

  insert into public.evidence_pack_downloads (owner_id, sections, format, supplier_count, row_count)
  values (v_uid, v_sections, p_format, v_suppliers, jsonb_array_length(v_rows));

  return jsonb_build_object(
    'generated_at',   now(),
    'sections',       to_jsonb(v_sections),
    'format',         p_format,
    'supplier_count', v_suppliers,
    'row_count',      jsonb_array_length(v_rows),
    'rows',           v_rows);
end;
$$;

revoke all     on function public.evidence_pack(text[], text) from public, anon;
grant  execute on function public.evidence_pack(text[], text) to authenticated;
