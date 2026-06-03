# Spec FE-SITEWIDE — sitewide redesign to prototype design language

> **Status:** DRAFT, awaiting user approval.
> **Predecessor:** FE-PROTO (shipped 3 Jun 2026 — Naafco profile only).
> **Scope:** Every authenticated and marketing route NOT already touched by FE-PROTO. Plus the two prototype variants we haven't ported yet.
> **AGENTS.md rule 2:** "One spec at a time." This spec will be implemented across **multiple sessions** — each session ships exactly one phase below and updates the tracker.

---

## 1. Why this spec exists

FE-PROTO ported `prototypes/profile-naafco-group.html` 1:1 to the authenticated buyer profile + shell. The user reports the rest of the SaaS still looks like the pre-prototype UI, which is correct — FE-PROTO touched 5 files only. This spec extends the same design language to every other route.

The `prototypes/` folder defines the **vocabulary** (tokens in [_tokens.css](../../prototypes/_tokens.css); component classes already ported into `app/globals.css @layer components` by FE-PROTO). Most pages have no per-page HTML prototype — they must be redesigned **using the established vocabulary**, not invented.

## 2. Hard rules inherited from AGENTS.md + frontend-design-spec.md

These are non-negotiable on every page in scope:

1. **No SBI numeric / pillar / grade / A–D / "Score" / "Rating" string on any non-admin surface.** RLS blocks the value; UI never references it.
2. **Receipts Ring (R1 receipt-stack glyph)** is the centrepiece of every supplier card and profile header. Payload = `t13_source_count`, saturated at 5.
3. **Completeness badge** is the only "quality" indicator visible to buyers.
4. **Contact PII gated server-side.** UI gating is decoration, not control. Email/phone/contact_name/contact_role must come back redacted from the RPC for unauthorised callers — we never trust client hiding.
5. **Sanctions banner overrides chrome** when an active hit exists.
6. **Tier hierarchy is law.** Tier 6 never primary.
7. **No new tools, no new deps.** Existing Tailwind + shadcn/Radix + Phosphor + Bricolage/Plus Jakarta stack only. No motion lib, no animation lib, no headlessui, no driver.js.
8. **`@layer components` block in `app/globals.css` is the single source of design-language CSS.** New shared classes added there; per-page styling stays Tailwind utilities.

## 3. Phases (each is one PR / one session)

Phases run **in this order**. Each is a single-session unit per AGENTS.md rule 2. Each gets its own commit on `development` and its own progress-tracker entry.

### Phase A — Finish the prototype set (highest-fidelity work, lowest invention)

| Step | File | Source prototype | Scope |
| --- | --- | --- | --- |
| A1 | `app/(marketing)/suppliers/[slug]/page.tsx` (public profile) | `profile-thin-supplier.html` + `profile-naafco-group.html` | Apply the same prototype anatomy FE-PROTO put on the authenticated profile, with public-profile gating: Contact tab always gated, Capacity/Brands tabs omitted entirely when empty (not "n/a"), R1 thin variant when `t13_source_count == 1`. Demo-banner from M5 stays. |
| A2 | Sanctions-hit profile render | `profile-with-sanctions.html` | Both authenticated and public profiles: when `payload.sanctions_hits.length > 0`, render the full-width red `.sanctions-banner` above the header, switch Contact tab to disabled state, pin the dedicated Sanctions detail card at top of Compliance tab. Banner does NOT block scrolling. Tier reflects evidence breadth, NOT sanctions status. |
| A3 | Thin-supplier render | `profile-thin-supplier.html` | Both profiles: when `t13_source_count == 1` AND completeness < 50%, render R1 thin variant (`.glyph .line:only-child`), amber completeness chip, omit empty tabs entirely. |

### Phase B — Discover surfaces (authenticated + public)

| Step | File | Scope |
| --- | --- | --- |
| B1 | `app/(app)/app/discover/page.tsx` | Result cards rebuilt with `.proto-card.hoverable` shell, receipt-stack glyph at 32px, header line = company name in `.header-name` weight-300 with chip row underneath, pill row using `.proto-pill` + `.proto-pill.inherited`, completeness chip top-right of card. Filter rail spacing/typography aligned to `.nav-section` + `.proto-nav-item` patterns. |
| B2 | `app/(marketing)/discover/page.tsx` | Same as B1 minus the SaveButton (shared `components/discover/filter-rail.tsx` extracts the bulk of the work). Demo-banner stays. |
| B3 | `components/discover/result-card.tsx` (NEW shared) | Extract the card render so both routes use one component. |

### Phase C — Buyer engagement surfaces

| Step | Routes | Scope |
| --- | --- | --- |
| C1 | `/app` (buyer dashboard) | Replace stat tiles with `.metric-grid`/`.metric`. Saved-supplier rail uses the new B3 result card. Recent activity uses `.prov-list`/`.prov-row` pattern. |
| C2 | `/app/saved` | Use B3 result card grid. Empty state uses `.affiliation-disclaimer` muted-text pattern. |
| C3 | `/app/messages`, `/app/messages/[threadId]` | Two-pane shell: thread list left (`.proto-nav-item`-style rows), conversation right inside `.proto-card`. Compose box bottom-anchored. No new chat lib. |
| C4 | `/app/rfqs` | Table list inside `.proto-card`; row click → drawer using existing Radix Dialog className-overridden. Create-RFQ form gets `.header-card` style page header. |
| C5 | `/app/orders` | Mirror C4 pattern: table inside `.proto-card`, milestone form in drawer. |
| C6 | `/app/match` (Smart Match wizard) | 3-step wizard inside one `.proto-card.span2` per step. Result list uses B3 result card. |
| C7 | `/app/compliance` | Tile grid using `.proto-card.hoverable`, each tile linking to a sub-route. Reports list uses `.docs-list`/`.doc-row`. |

### Phase D — Settings + auth + suspended

| Step | Routes | Scope |
| --- | --- | --- |
| D1 | `/app/settings/{profile,notifications,plan}` | Sectioned `.proto-card` per group; form rows use `.header-meta-row`-style two-col grid (label left, control right). Settings sidebar nav uses `.proto-nav-item` sub-style. |
| D2 | `/login`, `/signup`, `/forgot-password`, `/reset-password` | Centered card on warm off-white L0 background. Card = `.proto-card` width-clamped to 420px. Wordmark above card uses `.proto-wordmark`. Form inputs keep existing primitives, restyled via Tailwind only. |
| D3 | `/suspended` | Single `.proto-card.span2` centered; muted explanation text + Sign-out button. |

### Phase E — Supplier portal

| Step | Routes | Scope |
| --- | --- | --- |
| E1 | `/supplier` (dashboard) | `.metric-grid` of factory stats; claimed-companies list using B3 card; pending-claims list using `.prov-list`/`.prov-row`. |
| E2 | `/supplier/profile`, `/supplier/profile/[id]` | Editor uses the same `.header-card` header + tabbed `.proto-tabs` shell as the buyer profile but with form controls in each section. Save action sticky-bottom. |
| E3 | `/supplier/rfqs`, `/supplier/messages`, `/supplier/partners` | Reuse C3/C4 patterns. |
| E4 | `/supplier/claim`, `/supplier/claim/[id]`, `/supplier/claim/verify` | Wizard pattern from C6; status states use `.tier-badge`-style chips. |

### Phase F — Admin console

| Step | Routes | Scope |
| --- | --- | --- |
| F1 | `/admin` (overview) | `.metric-grid` with internal stats (the only place SBI numeric MAY appear, per IA §2.3); recent moderation activity uses `.prov-list`. |
| F2 | `/admin/suppliers`, `/admin/{claims,certifications,sanctions}` queues, `/admin/audit-log`, `/admin/users` | Table inside `.proto-card`; row → drawer detail. Decide buttons keep existing logic, restyled via `.btn-proto` variants. |
| F3 | Admin editor forms (supplier editor, user edit, etc.) | Same form pattern as D1. |

### Phase G — Marketing site ✅ shipped 4 Jun 2026

| Step | Routes | Scope |
| --- | --- | --- |
| G1 | `/` (home) | Hero with `.proto-wordmark`-tinted headline; "verified suppliers" counter uses `.fresh-count` style; methodology section uses `.proto-card.span2` grid. |
| G2 | `/pricing` | Three plan cards using `.proto-card`; feature rows muted `.affiliation-disclaimer` style. |
| G3 | `/compliance`, `/compliance/[slug]` | Hub tile grid + article body using `.proto-card.span2` for prose. Existing M3 content untouched, only the chrome. |
| G4 | `/legal/{terms,privacy,cookies,data-sources,trademarks}` | Single `.proto-card.span2` centered, prose-styled. H7 content untouched. |
| G5 | `components/marketing/top-nav.tsx` + `footer.tsx` | Top-nav uses `.proto-wordmark` (already done in topbar), footer columns use `.nav-section` headings. |

### Phase R — Responsive pass (added 4 Jun 2026)

| Step | Scope |
| --- | --- |
| R1 | Audit every surface ported in Phases A–H against the 8-width `RESPONSIVE_WIDTHS = [360,414,768,1024,1280,1440,1920,2560]` set (already exported by `lib/responsive/breakpoints.ts` from P1). Use the existing `/responsive-grid` dev page. |
| R2 | Establish breakpoint defaults: (a) `.proto-grid` collapses to single column < 900px (already in CSS), (b) `.header-card` 5-col `<dl>` collapses to 2-col then 1-col, (c) `.metric-grid` 3-col → 2-col < 720px → 1-col < 480px, (d) `.proto-tabs` becomes horizontally scrollable < 720px with `overflow-x-auto`, (e) sidebar becomes off-canvas drawer < 1024px (use existing `<MobileSidebarToggle>` if present, else add minimal toggle in `components/shell/`). |
| R3 | Marketing pages (Phase G output) honour the same set: hero `max-w-5xl` clamps + `text-4xl md:text-5xl` ladder kept, proto-card grids collapse via `md:grid-cols-2 lg:grid-cols-3`. |
| R4 | No new dependencies. All work via Tailwind responsive utilities + the existing `@media (max-width: …)` blocks in `app/globals.css`. |

### Phase H — Shared components sweep

| Step | Scope |
| --- | --- |
| H1 | `components/ui/{button,input,select,checkbox,dialog,tabs,…}` — confirm every primitive renders correctly against the prototype tokens. Add `.btn-proto`/`.btn-proto.primary`/`.btn-proto.icon-only` as the canonical Button variants. Old shadcn variants kept as fallback for one cycle. |
| H2 | Empty states (`empty-connections.svg`, `other-empty.svg` from `public/inapp-logos/`) — standardise a `<EmptyState>` server component used by all "no data" surfaces. |
| H3 | Loading states — convert all `loading.tsx` to skeleton blocks using `.proto-card` + animated hairline. |
| H4 | Error states (`error.tsx`, `global-error.tsx`, `not-found.tsx`) — single shared layout using `.proto-card.span2` with `.proto-wordmark` above. |

## 4. Non-goals (this spec does NOT do)

- **No DB migration.** All redesigns operate against existing RPCs.
- **No RPC change.** If a page needs new data, that's a follow-up spec, not this one.
- **No new dependencies.** Hard rule 4.
- **No mobile-first redesign.** Prototype is desktop-first (per design-brief §9 "mobile frames deferred"). Mobile responsiveness is honoured via existing Tailwind responsive utilities — no per-page mobile mockup work in this spec.
- **No dark mode.** Deferred per prototype README.
- **No new pages.** Only restyles existing routes.
- **No route count change.** `pnpm build` route count must match pre-spec count after every phase (smoke check).
- **No behavioural rewrite.** Forms, mutations, server actions, auth flows, role gating, RLS — all untouched. Pure presentation layer.

## 5. Per-phase validation (must pass before commit)

For every phase:

1. `pnpm typecheck` clean.
2. `pnpm lint` clean (pre-existing warnings allowed; no new ones).
3. `pnpm build` green and route count unchanged from pre-spec baseline (capture once at FE-PROTO close = post-FE-PROTO route count, then assert per phase).
4. `get_errors` on every edited file returns no diagnostics.
5. Grep guard: every edited file scanned for forbidden tokens (`SBI`, `pillar_`, `Score`, `Rating`, A-D grade letters in user-facing strings).
6. Visual spot check against the closest prototype (Phase A only — other phases have no prototype, judged against design language conformance).

## 6. Progress tracking

- Spec entered into `progress-tracker.md` as "in progress" on Phase A start.
- After each phase ships: append `### Phase X shipped — <date>` block with files touched + decisions logged + new route count vs baseline.
- Spec marked "complete" only when all 8 phases (A–H) ship.

## 7. Open questions for user (please answer before Phase A starts)

1. **Phase ordering OK?** A → B → C → D → E → F → G → H. Phase A is highest priority because it's the only one with prototype source-of-truth. Phases C–F could be reordered if a particular surface is more urgent for the beta. Defaults to the listed order if no preference.
2. **Phase A1 (public profile) — should we keep the M5 demo-banner exactly as-shipped, or should Phase A restyle the banner too?** Default: keep as-shipped; restyle in Phase G2 alongside marketing chrome.
3. **Sidebar "Free plan" label** in `.ws-plan` (added by FE-PROTO) — should it read the actual `profiles.plan_tier` (added by B10)? Currently hardcoded "Free plan". One-line fix, included in Phase D1 by default.
4. **Topbar global search bar** (mentioned in frontend-design-spec.md §2.1 "global search bar (centre)") — does NOT currently exist in `components/shell/topbar.tsx`. Adding it is outside FE-SITEWIDE scope (it's a new feature, not a restyle). Confirm we defer to a separate spec, or include the visual shell only (non-functional input) in Phase H1.
5. **Per-page deploys to VPS during the spec, or single deploy at spec close?** Default: commit + push each phase but defer VPS redeploy until all 8 phases are complete (one production rollout, not 8). User can call for an earlier rollout at any phase boundary.

## 8. Acceptance gate (spec marked complete)

- All 8 phases shipped with their own commits on `development`.
- Route count unchanged from FE-PROTO baseline.
- Zero new dependencies in `package.json` diff for the entire spec.
- Zero DB migration files added.
- Forbidden-token grep clean across every edited file.
- VPS redeployed once at spec close; live URL audited against the three prototype HTMLs side-by-side.
- Architectural decisions logged across each phase in `progress-tracker.md`.
