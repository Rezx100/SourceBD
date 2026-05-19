-- Migration 0010 — compliance_documents (Spec 13)
--
-- Mirrors per-factory compliance documents (RSC fire / structural / electrical
-- / boiler inspection reports + CAP) from their origin (currently
-- accord2.fairfactories.org via the RSC Accord JSON API) to Bunny CDN.
--
-- Provenance row per (supplier, doc_type, sha256). Re-running the mirror with
-- an unchanged file is a no-op upsert; an updated origin file (different
-- sha256) appends a new row, preserving history of the prior version.
--
-- Hot-link fallback: when Bunny upload fails, mirror_url stays NULL and the
-- UI falls back to original_url (still attributed to the source).

create table if not exists public.compliance_documents (
  id              uuid primary key default gen_random_uuid(),
  supplier_id     uuid not null references public.suppliers(id) on delete cascade,
  doc_type        text not null check (doc_type in ('fire','structural','electrical','boiler','cap')),
  source          text not null default 'rsc',
  original_url    text not null,
  mirror_url      text,
  sha256          text not null,
  file_size       bigint,
  content_type    text,
  fetched_at      timestamptz not null default now(),
  unique (supplier_id, doc_type, sha256)
);

create index if not exists idx_compliance_docs_supplier
  on public.compliance_documents (supplier_id);

create index if not exists idx_compliance_docs_type
  on public.compliance_documents (doc_type);

-- RLS: public can read documents only for published suppliers.
alter table public.compliance_documents enable row level security;

drop policy if exists pol_compliance_docs_pub_read on public.compliance_documents;
create policy pol_compliance_docs_pub_read on public.compliance_documents
  for select using (
    exists (
      select 1 from public.suppliers s
      where s.id = supplier_id and s.is_published = true
    )
  );

-- Service role bypasses RLS automatically; ETL writes go through service role.
