-- 0089_sanctions_screening_unique_active.sql
-- REZ-32: give `on conflict do nothing` something to conflict on.
--
-- Both screening directions (entry-side at list ingest, supplier-side at
-- supplier upsert) insert active sanctions_screening rows with
-- `on conflict do nothing`, but the table has never had a unique constraint
-- over the match identity — the clause could never conflict, so re-ingesting
-- a list (or re-screening a supplier) would mint duplicate active rows per
-- match, each re-firing trg_sanc_propagate. The invariant is one active row
-- per (supplier, list, entry); rows cleared to active = false are history
-- and may repeat. list_entry_ref is nullable, so it is coalesced into the
-- index key.
--
-- NOT applied to production in this session — that is Session 2, alongside
-- the backfill sweep over existing suppliers.

create unique index if not exists idx_sanc_screening_unique_active
  on public.sanctions_screening (supplier_id, list, (coalesce(list_entry_ref, '')))
  where active;
