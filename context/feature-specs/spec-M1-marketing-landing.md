# Spec M1 — Marketing landing page

First Phase-5 spec (**M1** → M2 → M3 → M4 → M5; per `context/phases.md`
line 102). Replaces the deprecated F2 placeholder at `/` with the
public landing page: hero, live counter, "How we verify" methodology
(source trust hierarchy + per-factory authenticity rule + receipts-first
posture), trust-sources strip (typography wordmarks only — JC #1),
founder story (placeholder paragraph — JC #8), footer with **only**
the trademarks link (JC #7 override). One new public read-only RPC
(`public.marketing_stats()`) feeds the live counter; no other DB
writes. Aggregate-counts only; no PII, no SBI, no per-supplier rows
ever cross the public boundary.

## Hard constraints (re-read before writing copy)

1. **SBI doctrine — `α now, β later, γ never` (20 May 2026,
   `progress-tracker.md`).** No numeric SBI on any public surface. No
   word "score" in any headline, CTA, or section heading. No
   Score-Ring numeric centre. The marketing surface is
   **receipts-first** (cert counts, source counts, tier coverage) —
   same posture already enforced on B-series buyer surfaces.
2. **Per-factory authenticity rule (`logos.lock.md` §3 Tier 4 header).**
   Methodology copy must reproduce the rule verbatim, not paraphrase.
   A `BRAND_*` source attaches only when the brand's own publication
   names the specific factory (with the narrow OSH extension recorded
   2026-05-19).
3. **Source-trust hierarchy is law (`AGENTS.md` rule #5,
   `logos.lock.md` §3, `phases.md` line 102).** Methodology section
   reproduces Tier 1 → Tier 6 ordering exactly as in `logos.lock.md`.
   **Tier numeric weights are NOT published** anywhere on the page
   (JC #1) — tier *names* and *meanings* are public; the SBI weight
   math stays internal.
4. **Anonymous boundary is a regulatory surface.** The
   `marketing_stats()` RPC payload is checked by the smoke for the
   full FORBIDDEN key set (PII columns, `sbi_total`,
   `pillar1_legal..pillar4_market`, `body_ciphertext`,
   `verification_token_hash`, `proof_email`, `email_primary`,
   `phone_primary`, `phones`, `contact_name`, `contact_role`,
   `email`, `actor_email`) — any leak fails the spec. **No carve-outs**.
5. **No new tools.** Existing Next.js 15 App Router, Tailwind, Phosphor
   SSR icons, hand-rolled shadcn primitives, Supabase server client.
6. **Robots / SEO (Lock #1).** `metadata.robots = { index: true,
   follow: true }`; `metadata.openGraph = { title, description,
   locale: 'en_GB', type: 'website' }`; `metadata.alternates.canonical`
   resolved from an env var (read `next.config.ts` for the
   site-URL var; do NOT hardcode the prod domain). No OG image
   asset in M1 — favicon is the stopgap; OG image lands in M4.
7. **Accessibility (Lock #2).** Exactly one `<h1>` on the page; correct
   heading order (`<h2>` for each section, `<h3>` for methodology
   subsections); each counter tile has an `aria-label="<label>:
   <formatted-number>"`; the page must pass `pnpm build`'s built-in
   a11y warnings.

## Judgement-call ledger (locked)

| JC | Decision |
|---|---|
| 1 | **Option A — typography wordmarks only.** `logos.lock.md` §5 rule #3 stands unchanged. Group wordmarks visually by tier *label* (Tier 1 / Tier 2 / Tier 3 / Tier 4 / Tier 5), **without** publishing tier numeric weights. |
| 2 | **ISR 600s + `export const dynamic = 'force-static'`.** Wire `revalidatePath('/')` into the ETL post-run hook **only if it already exists** — do not author new ETL plumbing in M1. |
| 3 | **Corrected qualifying-sources list.** Locked inside the spec as a TS constant `MARKETING_QUALIFYING_SOURCES` (allow-list = security boundary). Page reads `public.sources` server-side and filters `code in (...)` against the constant (DB row = render gate / operational kill-switch). |
| 4 | **T1-OR-T2 corroboration.** Tile label: **"Suppliers with government or association corroboration"**. RPC key stays `suppliers_with_tier1or2_source` for code clarity; "Tier" vocabulary stays out of the public copy. |
| 5 | **`greatest()` across the three timestamps.** Render as **"Last updated [relative]"** via `formatRelative()`. NULL → omit the freshness line entirely (no em-dash). |
| 6 | **Em-dash placeholders + server-side log line.** Wrap RPC in try/catch; on failure return `{...: null}`; render `—`. Log `[m1] marketing_stats failed: <code>` to container stdout. No error UI. |
| 7 | **Trademarks page only.** Footer ships with **only** `/legal/trademarks`. Privacy + terms are deliberate H7 deliverables (paired with ICO registration + GDPR Rep appointment per `phases.md`); a "Coming soon" placeholder for a legal page is a UK ICO liability, not a courtesy. |
| 8 | **Generic placeholder founder story.** Single `const FOUNDER_STORY` + `<!-- FOUNDER: replace before launch -->` marker. Must not invent biographical facts (no fake city, no fake employer history). |

## DB — `supabase/migrations/0043_marketing_stats_rpc.sql`

Probe first (`ops/_m1_probe.py`):

- Confirm A6 took 0042 → M1 = 0043. (Verified at spec-author time:
  highest migration on disk = `0042_admin_audit_log_explorer.sql`.)
- Confirm `public.sources` has the 21 expected codes (per JC #3
  corrected list). If a code is missing, the spec doesn't add it —
  add a line item under "Pending" in the close-out instead.
- Confirm `public.sources` has an `is_active` column. If absent,
  drop the `and is_active = true` predicate from
  `sanctions_lists_screened`.
- **`EXPLAIN ANALYZE`** each of the five `count(*)` queries; each
  must complete in well under 1 s under ISR cache-miss conditions.
- Inventory today's count values so the spec author can sanity-check
  the rendered tiles match prod.

### RPC

One function, SECURITY DEFINER, `set search_path = public`,
**`revoke ... from public` first, then explicit grants**.

```sql
create or replace function public.marketing_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_suppliers_indexed             int;
  v_suppliers_with_tier1or2       int;
  v_sanctions_lists_screened      int;
  v_compliance_documents_mirrored int;
  v_certifications_verified       int;
  v_last_refreshed_at             timestamptz;
begin
  -- aggregate count(*) only; no row data crosses this boundary
  select count(*) into v_suppliers_indexed
    from public.suppliers where is_published = true;

  select count(distinct s.id) into v_suppliers_with_tier1or2
    from public.suppliers s
    join public.source_records sr on sr.supplier_id = s.id
    join public.sources src on src.code = sr.source_code
    where src.tier in ('tier1_gov','tier2_industry')
      and s.is_published = true;

  select count(*) into v_sanctions_lists_screened
    from public.sources
    where tier = 'tier5_regulatory' and is_active = true;
    -- drop `and is_active = true` if probe shows column absent

  select count(*) into v_compliance_documents_mirrored
    from public.compliance_documents;

  select count(*) into v_certifications_verified
    from public.certifications where verified = true;

  select greatest(
           coalesce((select max(scraped_at) from public.source_records),       '-infinity'::timestamptz),
           coalesce((select max(fetched_at) from public.compliance_documents), '-infinity'::timestamptz),
           coalesce((select max(decided_at) from public.certifications where decided_at is not null), '-infinity'::timestamptz)
         )
    into v_last_refreshed_at;

  if v_last_refreshed_at = '-infinity'::timestamptz then
    v_last_refreshed_at := null;
  end if;

  return jsonb_build_object(
    'suppliers_indexed',              v_suppliers_indexed,
    'suppliers_with_tier1or2_source', v_suppliers_with_tier1or2,
    'sanctions_lists_screened',       v_sanctions_lists_screened,
    'compliance_documents_mirrored',  v_compliance_documents_mirrored,
    'certifications_verified',        v_certifications_verified,
    'last_refreshed_at',              v_last_refreshed_at
  );
end;
$$;

revoke all on function public.marketing_stats() from public;
grant execute on function public.marketing_stats() to anon, authenticated;
```

**No role check.** First RPC in the codebase deliberately callable by
`anon` without an `auth.uid()` gate. All values are aggregate
`count(*)` over already-public substrate.

**Indexes.** No new indexes unless the probe `EXPLAIN ANALYZE` shows
a query above ~500 ms.

## App surfaces

### `app/(marketing)/page.tsx` (rewrite)

Server component. Top of file:

```ts
export const dynamic = 'force-static';
export const revalidate = 600;
export const metadata = {
  title: 'SourceBD — verified Bangladesh garment factories',
  description: '…',
  robots: { index: true, follow: true },
  openGraph: { title: '…', description: '…', locale: 'en_GB', type: 'website' },
  alternates: { canonical: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://sourcebd.net/' },
};
```

(Read `next.config.ts` first to determine the actual canonical-URL
env var; the literal above is a placeholder.)

JC #3 allow-list defined in-file:

```ts
const MARKETING_QUALIFYING_SOURCES = [
  // Tier 1 — Government
  'BEPZA', 'DIFE', 'EPB', 'RJSC', 'RSC',
  // Tier 2 — Trade associations
  'BGMEA', 'BKMEA', 'BTMA', 'BGAPMEA',
  // Tier 3 — Certification bodies
  'WRAP', 'OEKO_TEX', 'GOTS',
  // Tier 4 — Brand disclosures (active only)
  'BRAND_HM', 'BRAND_ASOS', 'BRAND_MS', 'BRAND_NEXT',
  // Tier 5 — Regulatory / sanctions
  'OFAC', 'UFLPA', 'US_WRO', 'UK_OFSI', 'EU_SANC',
] as const;
```

Sections:

1. **Hero** — single `<h1>` (≤8 words, no "score"/"rating"/"ranking");
   one sub-paragraph (≤24 words); primary CTA `<Link href="/signup">`
   ("Start free"); secondary `<Link href="/discover">` ("Browse the
   directory"). No logos. No counter inside the hero.

2. **Live counter strip** — five tiles
   (`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4`), one per
   integer field. `last_refreshed_at` renders below as
   `"Last updated <relative>"` via `formatRelative()`. Tile labels:
   - `suppliers_indexed` → **"Suppliers indexed"**
   - `suppliers_with_tier1or2_source` → **"Suppliers with government or association corroboration"** (JC #4)
   - `sanctions_lists_screened` → **"Sanctions lists screened"**
   - `compliance_documents_mirrored` → **"Compliance documents mirrored"**
   - `certifications_verified` → **"Certifications verified"**

   Numbers formatted with `Intl.NumberFormat('en-GB')`. Each tile
   carries `aria-label="<label>: <formatted-number>"` (Lock #2). On
   RPC failure → all numeric fields = `null` → tile renders `—`,
   freshness line omitted (JC #5/JC #6). Server log line
   `console.error('[m1] marketing_stats failed:', err?.code ?? err?.message)`
   on the catch path.

3. **"How we verify" methodology** — three subsections under one
   `<h2>How we verify</h2>`, no collapse / no tabs:
   - **Source trust hierarchy** (`<h3>`) — verbatim transcription of
     the six tier rows from `logos.lock.md` §1 "Tier ring colour map"
     (DB value → display label → meaning), rendered as a `<dl>`.
     **Tier numeric weights NOT published.** Smoke asserts text equality.
   - **Per-factory authenticity rule** (`<h3>`) — verbatim block-quote
     of `logos.lock.md` §3 Tier 4 header — both the "**Authenticity
     rule (hard):**" paragraph and the "**Narrow OSH extension
     (2026-05-19):**" paragraph. Smoke asserts text equality.
   - **Receipts-first posture** (`<h3>`) — single paragraph re-framed
     from the 20 May 2026 progress-tracker entry. Suggested copy:
     "We publish what issuers have already certified — cert IDs,
     register numbers, remediation percentages, brand-disclosure
     attributions — and never a SourceBD-proprietary supplier score."
     Smoke asserts the word "score" appears at most once and only
     inside the explicit "never a … score" negation.

4. **Trust sources** — typography wordmarks only (JC #1). Read
   `public.sources` where `code = any(MARKETING_QUALIFYING_SOURCES)`
   and (if column exists) `is_active = true`. Group by tier label
   visually with one `<h3>` per tier label ("Government", "Trade
   associations", "Certification bodies", "Brand disclosures",
   "Regulatory / sanctions") — **no tier weight numbers**. Each
   wordmark is `<span class="font-display">DisplayName</span>`. No
   SVG, no image tag.

5. **Founder story** — under `<h2>Why we built this</h2>`. Single
   `const FOUNDER_STORY = "…"` declared at file top with the
   `<!-- FOUNDER: replace before launch -->` HTML comment in the
   rendered output. Generic 3-sentence placeholder, no invented
   biographical specifics.

6. **Footer** — **only one link**: `/legal/trademarks` + "© 2026
   SourceBD" line (JC #7). No privacy / terms links.

### `app/(marketing)/legal/trademarks/page.tsx`

Server component with the verbatim text from `logos.lock.md` §5
rule #5. Same `metadata.robots = { index: true, follow: true }`.

### `app/(marketing)/layout.tsx`

No change. M1 single-pager; M2 introduces the marketing top-nav.

## Smoke — `ops/_m1_smoke.py`

Mirror A-series smoke harness. Run on prod (`109.104.153.228`,
container `sourcebd-etl-run`) **single-SSH-at-a-time**.

Checks:

1. **Anon-callable, no JWT.** Open psycopg connection without
   Supabase JWT, `set role anon`, `select public.marketing_stats()`.
   Returns jsonb with exactly six documented keys; no
   `InsufficientPrivilege`.
2. **Authenticated parity.** Same call under freshly seeded buyer,
   supplier, and admin roles returns identical shape and values.
3. **Shape.** Six keys; five integer counts non-negative `int` or
   `null`; `last_refreshed_at` valid ISO timestamp or `null`.
4. **PII / SBI leak diff = `[]`.** Recursive FORBIDDEN-key walk
   against the full canonical ban list (`sbi_total`, `sbi`,
   `pillar1_legal`, `pillar2_safety`, `pillar3_certs`, `pillar4_market`,
   `body_ciphertext`, `verification_token_hash`, `proof_email`,
   `email_primary`, `phone_primary`, `phones`, `contact_name`,
   `contact_role`, `email`, `actor_email`). No carve-outs.
5. **No row-shaped data.** Walk the payload; any `list` element that
   is a `dict` containing an `id` key → fail.
6. **Canonical-copy verification.** Read `context/logos.lock.md`;
   slice (a) Tier ring colour map rows, (b) Tier 4 "Authenticity
   rule (hard):" paragraph, (c) "Narrow OSH extension (2026-05-19):"
   paragraph, (d) §5 hard rule #5 trademarks paragraph. Read
   `app/(marketing)/page.tsx` + `app/(marketing)/legal/trademarks/page.tsx`
   from disk. Assert each slice appears verbatim
   (whitespace-normalised).
7. **No "score" in headlines.** Parse `app/(marketing)/page.tsx`
   for substrings inside JSX `h1`/`h2`/`h3`/`button` — must not
   contain the case-insensitive substring `score`. Body "never a …
   score" negation is permitted.
8. **No tier weights published.** Regex scan for
   `Tier\s*\d+\s*=\s*\d+\s*points?` or
   `Tier\s*\d+.*\(\s*\d+\s*pts?\s*\)` — zero matches.
9. **Footer guard.** Page source contains `/legal/trademarks`
   exactly once and does NOT contain `/legal/privacy` or
   `/legal/terms`.
10. **Cleanup.** Smoke writes nothing; seeded auth users removed in
    `finally`.

## Workflow

1. **Probe** (`ops/_m1_probe.py`) — confirm 21 source codes present;
   confirm `is_active` column; capture today's counts; run
   `EXPLAIN ANALYZE` on the five `count(*)` queries; confirm no
   migration above 0042 on disk.
2. **Mark M1 in-progress** in `context/progress-tracker.md`
   (`## Current goal` + `## In progress`).
3. **Write `supabase/migrations/0043_marketing_stats_rpc.sql`**;
   apply on prod via
   `docker exec -i sourcebd-etl-run python /tmp/_apply_stdin.py < /tmp/0043_marketing_stats_rpc.sql`.
4. **Re-probe** — `select public.marketing_stats()` under `set role
   anon` returns sane numbers.
5. **Build the page** — rewrite `app/(marketing)/page.tsx`; add
   `app/(marketing)/legal/trademarks/page.tsx`. Read the four
   canonical doc-strings out of `logos.lock.md` and paste verbatim.
   Resolve canonical-URL env var from `next.config.ts`.
6. **Write `ops/_m1_smoke.py`**; run on prod; iterate to PASS.
7. **`pnpm typecheck && pnpm lint && pnpm build`** — expect **+1
   route** (rewritten `/` is already counted at 72; `+1` for
   `/legal/trademarks` brings total to **73**). No new deps.
   Build a11y warnings must be zero.
8. **Close out tracker**:
   - mark M1 complete,
   - add new `## Recently shipped (Phase 5 — Marketing)` heading
     (Phase 4 list closed),
   - architectural decisions block covering 8 acks + 2 locks,
   - bump migrations count → 43,
   - bump route count to the build's reported number,
   - set `In progress` to `(none — Spec M1 closed; awaiting next
     Phase-5 spec assignment — M2 pricing)`.
9. **Commit on `development`**, push.
   `feat(marketing): M1 landing page (migration 0043 marketing_stats RPC, live counter, methodology, trademarks page, ISR 600s)`
10. **Never `main`. Never touch pixelsport VPS (37.49.227.151).**
    SourceBD VPS = `109.104.153.228`, container `sourcebd-etl-run`.

## Closing — architectural decisions to log

1. **`marketing_stats()` is the first anon-callable SECURITY DEFINER
   RPC.** Aggregate `count(*)` over already-public substrate. No
   `auth.uid()` check; rate limiting handled by ISR (≤1 RPC call /
   10 min globally).
2. **ISR 600s + `dynamic = 'force-static'`** (JC #2).
   `revalidatePath('/')` wired into ETL post-run hook only if hook
   already exists.
3. **Trust-sources strip is typography-only** (JC #1 — Option A
   chosen over A/B/C). `logos.lock.md` §5 rule #3 stands unchanged.
   Tier *names* public; tier *weights* internal.
4. **Allow-list constant + DB render gate** (JC #3). TS constant =
   security boundary; live `public.sources` query = operational
   kill-switch.
5. **Counter field T1-or-T2** (JC #4). RPC key
   `suppliers_with_tier1or2_source`; public tile label
   "Suppliers with government or association corroboration" — no
   "Tier" vocabulary in public copy.
6. **Freshness `greatest()` across three timestamps** (JC #5). NULL
   → omit freshness line entirely. Relative time only.
7. **Em-dash + server log on RPC failure** (JC #6).
   `[m1] marketing_stats failed: <code>` to container stdout.
8. **Methodology copy canonical, not paraphrased.** Smoke asserts
   four verbatim slices of `logos.lock.md` appear in the page
   source. No DRY abstraction.
9. **Footer omits privacy/terms until H7** (JC #7 override). UK ICO
   posture: "Coming soon" legal placeholder is a liability, not a
   courtesy.
10. **Founder story is placeholder, no invented bio** (JC #8).
    `<!-- FOUNDER: replace before launch -->` marker in HTML.
11. **Robots / SEO baked into page metadata** (Lock #1). Canonical
    URL from env var; OG image deferred to M4.
12. **A11y enforced at build** (Lock #2). One `<h1>`; correct
    heading order; per-tile `aria-label`. Zero build warnings.
13. **Payload schema final.** Adding keys later is fine; renaming/
    removing requires a new spec.
14. **No marketing-wide nav.** M1 single-page; M2 introduces top-nav.
