-- 0093 — resolution_edges sticky always-same / never-same rulings
--       (REZ-63 / REZ-57 A3).
--
-- WHY
-- ---
-- Every merge and split decision a human has made on this database lives in
-- an ops-script run log and nowhere else. The matcher (`_find_existing` in
-- `etl/core/upsert.py`) recomputes identity from scratch on every record, so
-- a future matcher change or normalization tweak can silently redo founder-
-- verified rulings (e.g. sarada-knitwear = sarda-knitwear; sarada-knitwear
-- ≠ sarada-fashions; CORNY vs CRONY is open ownership).
--
-- We need a durable, machine-readable table of pair rulings that A4
-- (`_find_existing`) can read, A5 can backfill, and C3 can use as a group
-- anti-merge signal.
--
-- WHAT
-- ----
-- Schema only. Creates `public.resolution_edges` with order-independent
-- pair identity (CHECK `supplier_a < supplier_b`, CHECK not-self, partial
-- unique index on live pairs), verdict CHECK, read-path partial indexes,
-- RLS enabled with NO anon/authenticated policies (service role only), and
-- a table comment documenting append-only-in-spirit reversals. No rows are
-- inserted. `etl/core/upsert.py`, views, RPCs, and TypeScript types are
-- untouched.
--
-- CALLER CONTRACT
-- ---------------
-- Inserts MUST present the two supplier ids already sorted so that
-- `supplier_a < supplier_b`. There is no silent-swap trigger — a CHECK
-- failure is intentional so callers stay correct.
--
-- REVERSE
-- -------
--   drop index if exists public.idx_resolution_edges_b;
--   drop index if exists public.idx_resolution_edges_a;
--   drop index if exists public.idx_resolution_edges_pair_active;
--   alter table public.resolution_edges
--     drop constraint if exists chk_resolution_edges_verdict;
--   alter table public.resolution_edges
--     drop constraint if exists chk_resolution_edges_not_self;
--   alter table public.resolution_edges
--     drop constraint if exists chk_resolution_edges_canonical_order;
--   drop table if exists public.resolution_edges;
--
-- NOT applied to production in this session — founder applies migrations
-- manually.

-- ---------------------------------------------------------------------------
-- 1. Table
-- ---------------------------------------------------------------------------
create table if not exists public.resolution_edges (
  id              uuid primary key default gen_random_uuid(),
  supplier_a      uuid not null references public.suppliers(id) on delete cascade,
  supplier_b      uuid not null references public.suppliers(id) on delete cascade,
  verdict         text not null,
  decided_by      text not null,
  decided_at      timestamptz not null default now(),
  rationale       text not null,
  evidence_note   text,
  superseded_at   timestamptz,
  superseded_by   uuid references public.resolution_edges(id)
);

-- ---------------------------------------------------------------------------
-- 2. Pair identity + verdict constraints
--    Canonical order: uuid supports `<`. No silent rewrite trigger.
-- ---------------------------------------------------------------------------
alter table public.resolution_edges
  drop constraint if exists chk_resolution_edges_canonical_order;
alter table public.resolution_edges
  add constraint chk_resolution_edges_canonical_order
    check (supplier_a < supplier_b);

alter table public.resolution_edges
  drop constraint if exists chk_resolution_edges_not_self;
alter table public.resolution_edges
  add constraint chk_resolution_edges_not_self
    check (supplier_a <> supplier_b);

alter table public.resolution_edges
  drop constraint if exists chk_resolution_edges_verdict;
alter table public.resolution_edges
  add constraint chk_resolution_edges_verdict
    check (verdict in ('same', 'different'));

-- ---------------------------------------------------------------------------
-- 3. One live ruling per pair; read-path indexes for "edges touching X"
-- ---------------------------------------------------------------------------
create unique index if not exists idx_resolution_edges_pair_active
  on public.resolution_edges (supplier_a, supplier_b)
  where superseded_at is null;

create index if not exists idx_resolution_edges_a
  on public.resolution_edges (supplier_a)
  where superseded_at is null;

create index if not exists idx_resolution_edges_b
  on public.resolution_edges (supplier_b)
  where superseded_at is null;

-- ---------------------------------------------------------------------------
-- 4. RLS — internal decision history; no anon/authenticated policies.
--    Service role bypasses RLS automatically (same pattern as
--    stripe_webhook_events / phase0 internal tables).
-- ---------------------------------------------------------------------------
alter table public.resolution_edges enable row level security;

-- ---------------------------------------------------------------------------
-- 5. Semantics for operators and later issues (A4 / A5 / C3).
-- ---------------------------------------------------------------------------
comment on table public.resolution_edges is
  'Sticky human identity rulings between two suppliers. Pair identity is order-independent: callers MUST insert with supplier_a < supplier_b (CHECK enforced; no silent-swap trigger). Rows are append-only in spirit — reverse a ruling by inserting a new row and setting superseded_at / superseded_by on the old one; never UPDATE verdict. Live rulings have superseded_at IS NULL. Written by ops / admin (service role); never exposed to anon or authenticated clients.';

comment on column public.resolution_edges.verdict is
  'same = always the same company; different = never the same company.';

comment on column public.resolution_edges.decided_by is
  'Who decided: ''founder'', ''admin:<email>'', or ''ops:<script name>''.';

comment on column public.resolution_edges.superseded_at is
  'Non-null means this ruling was reversed; the replacing row is superseded_by.';
