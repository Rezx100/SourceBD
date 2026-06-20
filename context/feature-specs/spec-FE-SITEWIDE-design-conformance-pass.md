# Spec FE-SITEWIDE — Sitewide Design Conformance Pass

> Status: Draft created 19 Jun 2026. Ready for implementation after the user says to start.
> Scope: one visual system across marketing, public data surfaces, and the logged-in portal. No database changes. No new product features. No manual-review backlog implementation in this spec.

## 0. Why This Spec Exists

The current screenshots show SourceBD has strong product material, but the UI reads like multiple related products:

- Marketing home, pricing, and compliance pages use a public-site treatment.
- Public Discover and public supplier profiles are closer to the portal, but still differ in spacing, card rhythm, and navigation.
- Buyer, supplier, and admin portal screens have role-shell inconsistencies and uneven operational polish.
- Admin screens expose too much database vocabulary and are difficult to operate, but the deeper manual-review workflow is a follow-up after the design pass.

The user has approved this implementation order:

1. Design System Lock.
2. Shell Consistency.
3. Marketing Alignment.
4. Portal Polish.
5. Admin Usability, later.

This spec covers steps 1 through 4 only. Step 5 is explicitly parked for a follow-up spec after the platform looks and feels like one company SaaS.

## 1. Hard Rules

These inherit from [AGENTS.md](../../AGENTS.md), [architecture.md](../architecture.md), [ai-workflow-rules.md](../ai-workflow-rules.md), [frontend-design-spec.md](../frontend-design-spec.md), and `.github/copilot-instructions.md`.

1. **No SBI leakage.** No public, buyer, supplier, marketing, email, SEO, or public API surface may render SBI totals, pillar values, internal scores, grades, ratings, or score-like SourceBD opinions. Admin-only remains the exception.
2. **Receipts-first copy.** Use source-backed words: receipts, registers, certifications, RSC remediation, source records, provenance. Avoid internal phrases like data moat in user-facing UI.
3. **Source hierarchy is law.** Tier 6 never appears as primary UI evidence. Brand attributions follow the per-factory authenticity rule in [logos.lock.md](../logos.lock.md).
4. **Server-side security stays untouched.** Do not weaken auth, ownership checks, PII gating, RLS, middleware, suspension, or admin role gates.
5. **No DB changes.** No Supabase migrations, no new RPCs, no table/view/function edits, no ETL work.
6. **No new features.** Do not implement the manual-review backlog, new admin queue actions, new filters, new pricing, billing, SSO, upload flows, or analytics events.
7. **No new packages or tools.** Use the existing Next.js, Tailwind, Magic UI components in `components/ui/`, shadcn-style primitives, Phosphor icons, and Supabase helpers already in the repo.
8. **Magic UI first for new UI.** New layout/card/animation/decorative work must use the installed Magic UI components when a local component fits. Use shadcn primitives for form controls and dialogs. Keep the UI light mode only.
9. **Light neutral system.** Use `bg-white`, `bg-neutral-50`, `border-neutral-200`, and `text-neutral-900/800/700/500` as the default palette. Avoid expanding the legacy forest-green/indigo prototype token system for new surfaces.
10. **Tailwind utilities only.** No custom CSS unless necessary for shared low-level tokens or bug fixes that cannot be expressed in Tailwind. No inline hex colours.
11. **No route count change.** This is a restyle and shell fix pass. Existing routes stay existing routes.
12. **No behaviour rewrite.** Existing forms, route handlers, server actions, API payloads, realtime islands, and saved/RFQ/message flows keep their current contracts.

## 2. Design Source Of Truth

### 2.1 Canonical Feel

The logged-in portal is the canonical product experience: quiet, dense, operational, and evidence-first. Marketing should look like the public face of the same portal, not a separate campaign site.

Target feel:

- Light, neutral, calm SaaS surface.
- Data-dense but readable.
- Card and table systems consistent across marketing and portal.
- Same typography scale, chip language, button language, search inputs, source marks, and footer rhythm.
- No one-off landing-page ornament that cannot appear naturally inside the product.

### 2.2 Surface Tokens

Use one light surface system everywhere touched by this spec:

| Element | Treatment |
| --- | --- |
| Page background | `bg-neutral-50` |
| Main content cards | `bg-white border border-neutral-200 rounded-lg` |
| Secondary panels | `bg-white/80 border border-neutral-200 rounded-lg` |
| Muted bands | `bg-neutral-100` or `bg-neutral-50` only |
| Primary text | `text-neutral-900` |
| Secondary text | `text-neutral-700` |
| Muted text | `text-neutral-500` |
| Hairlines | `border-neutral-200` |
| Dangerous state | existing semantic red treatment, not brand green |
| Success/clear state | existing semantic green treatment, not brand identity |

Cards should use 8 px radius or less unless an existing primitive requires otherwise. Avoid cards inside cards except repeated item cards inside a framed tool surface.

### 2.3 Typography

Make the type scale consistent across marketing and portal pages touched in this spec.

- Page title: large but not hero-sized inside portal surfaces.
- Section headings: compact, clear, not oversized.
- Card titles: smaller than page titles, never landing-page scale.
- Data labels: mono only where it improves scanability, not as a decorative all-caps habit.
- Buttons and chips: text must fit on mobile and desktop without truncation.

Use the repo-approved typography stack from the current design instructions for newly touched marketing UI: Archivo for display, Hanken Grotesk for body, IBM Plex Mono for data labels. Do not create a new font split.

### 2.4 Components

Prefer these local sources:

- Magic UI components in `components/ui/` for cards, bento/grid layouts, subtle reveal, animated backgrounds, and button treatments when appropriate.
- Existing shadcn-style primitives for form controls, tabs, dialogs, dropdowns, and skeletons.
- Existing Phosphor icons because the app already standardised on Phosphor in [architecture.md](../architecture.md).
- Existing source/receipt components where they already enforce the no-SBI contract.

Do not introduce another icon family, animation library, table library, CSS framework, or visual token package.

## 3. Screenshot Audit Findings To Fix

### 3.1 Global Issues

1. **Background drift.** Marketing uses warmer cream/off-white while the portal uses cooler grey/neutral surfaces. Standardise touched surfaces to the same neutral background.
2. **Card drift.** Marketing cards, profile cards, Discover cards, admin cards, and settings cards differ in padding, border, radius, and shadow.
3. **Typography drift.** Marketing headings feel like a different product from portal headings. Admin labels are sometimes database-like and too terse.
4. **Navigation drift.** Marketing nav, buyer shell, supplier shell, and admin shell do not feel like one system.
5. **Role shell mismatch.** Screens show supplier/admin contexts with the wrong topbar/sidebar/account treatment.
6. **Identity bug.** Screens show `Guest` / `Your account` while a signed-in user context exists.
7. **Pricing strategy mismatch.** Pricing currently shows paid plans and trial language, while SourceBD is in a free public beta with billing deferred.
8. **Admin usability issue.** Admin screens are hard to understand and operate. This spec improves visual clarity only; queue workflow comes next.

### 3.2 Marketing Home

Observed issues:

- Large abstract sphere feels disconnected from the portal.
- Source logo strip is visually different from source marks in profile/portal.
- Section spacing and landing-page composition do not match the application shell.

Required fix:

- Replace or reduce decorative hero treatment in favour of a portal-style evidence/dossier preview or product-derived proof surface.
- Match portal cards, buttons, search input, source chips, and footer rhythm.
- Preserve receipts-first methodology and affiliation disclaimer.

### 3.3 Public Discover

Observed issues:

- Closer to the portal than the home page, but background, card spacing, and filter density still differ.
- Filters are cramped and active state is subtle.
- Public result cards should feel like authenticated cards with missing authenticated actions, not a separate implementation.

Required fix:

- Align card and filter styling with authenticated Discover.
- Keep public-only restrictions: no SaveButton, no RFQ, no claim action.
- Keep all public contact suppression intact.

### 3.4 Public Supplier Profile

Observed issues:

- Strong dossier direction, but cards, tab labels, count labels, rows, and document tables need the same density and visual rules as portal.
- Source identity, registry rows, certificates, sanctions screening, documents, and provenance have inconsistent row density.

Required fix:

- Standardise the profile card system and row components.
- Keep provenance/source lock visible.
- Keep contact PII suppressed server-side and/or render-stripped for public mode.

### 3.5 Pricing

Observed issues:

- Paid Growth/Enterprise pricing and trial copy contradict the free-beta/post-beta monetisation decision in [phases.md](../phases.md).
- Page style is close to the public site, not portal-like.

Required fix:

- Replace paid conversion language with free public beta messaging unless the user explicitly changes the business decision.
- Keep any plan comparison clearly labelled as future/post-beta or remove paid-price details.
- Restyle cards, table, FAQ, and CTA to match the portal card system.

### 3.6 Compliance Marketing

Observed issues:

- Clean but sparse. It should inherit the same cards, typography, CTA, and footer style as the portal-aligned marketing pages.

Required fix:

- Restyle without changing legal/regulatory copy or citations.
- Preserve educational disclaimer and last-reviewed dates.

### 3.7 Buyer Portal

Observed issues:

- Discover, settings, and topbar are close, but visual details differ from public pages.
- Settings cards have inconsistent icon/arrow/metadata treatment.

Required fix:

- Normalize card spacing, section headers, inputs, tabs, and action buttons.
- Fix account identity rendering.
- Ensure no role shell confusion when admin/supplier views shared settings.

### 3.8 Supplier Portal

Observed issues:

- Screens show supplier content inside admin-looking top navigation.
- Empty states are too plain for a supplier workflow.

Required fix:

- Ensure supplier pages render supplier nav, supplier account identity, and supplier-appropriate topbar links.
- Improve empty states for claim/profile/documents/RFQs/messages using the shared card system.
- Do not add upload functionality or new supplier workflow in this spec.

### 3.9 Admin Portal

Observed issues:

- Admin supplier editor uses raw database field labels (`company_name`, `entity_type`, `sanctioned_flag`).
- Admin screens are hard to understand and operate.
- Layout shows confusing sticky/overlapping action areas.
- The 1k+ manual-review backlog is not surfaced in the admin dashboard, but that is a functional admin workflow follow-up.

Required fix in this spec:

- Improve visual hierarchy, labels, grouping, spacing, and action placement.
- Rename visible labels to human-readable text while keeping field names internal.
- Make dangerous/internal actions visually clear.
- Do not implement the manual-review backlog list or publish/merge workflow yet.

## 4. Implementation Phases

This spec is intentionally broad, so implementation must be sliced. Do not implement more than one phase in a session unless the user explicitly approves combining them.

### Phase A — Design System Lock

Goal: define the shared visual language used by the rest of this pass.

Allowed scope:

- Shared card/button/input/badge/table/source-mark styling.
- Shared marketing/portal surface classes only if needed.
- Documentation update to [frontend-design-spec.md](../frontend-design-spec.md) recording the single light SourceBD design policy.
- Remove reliance on legacy prototype-only classes from newly touched surfaces where practical.

Expected files:

- `app/globals.css` only for low-level shared utilities or cleanup.
- `components/ui/*` only when improving an existing primitive or adding a small shared primitive used by multiple touched pages.
- `components/discover/*`, `components/supplier/*`, `components/marketing/*`, `components/shell/*` only if extracting shared presentational components.
- [frontend-design-spec.md](../frontend-design-spec.md) for the updated design source of truth.

Acceptance:

- One visual spec for background, cards, buttons, inputs, chips, source marks, tables, nav, and footer.
- No package changes.
- No routes added.
- No migration files added.

### Phase B — Shell Consistency

Goal: fix visible shell and account identity mismatches before page-level polish.

Allowed scope:

- Buyer/supplier/admin sidebar selection.
- Buyer/supplier/admin topbar quick links.
- Account identity display.
- Role-aware nav state.
- Marketing top nav/footer styling alignment with the portal.

Observed bugs to address:

- Supplier page displaying admin-style navigation.
- Settings/account pages displaying `Guest` or wrong role context while signed in.
- Admin and buyer settings shells mixing in a confusing way.

Expected files:

- `app/(app)/layout.tsx`
- `components/shell/sidebar.tsx`
- `components/shell/topbar.tsx`
- `components/marketing/top-nav.tsx`
- `components/marketing/footer.tsx`
- Shared auth/role helper consumers only if existing reads are wrong.

Acceptance:

- Buyer routes show buyer nav.
- Supplier routes show supplier nav.
- Admin routes show admin nav.
- Shared settings route makes the active role/context clear.
- Signed-in users are never labelled `Guest` unless the server truly has no profile/session.
- Auth gates remain server-side.

### Phase C — Marketing Alignment

Goal: make public pages look like the portal's public face.

Routes in scope:

- `/`
- `/pricing`
- `/compliance`
- `/compliance/[slug]`
- `/discover`
- `/suppliers/[slug]`
- `/legal/*` only for chrome/footer consistency, not copy rewrites.

Allowed scope:

- Restyle existing content.
- Replace marketing-only visual treatments with portal-style proof surfaces.
- Align cards, search, filters, source marks, CTA blocks, footer.
- Correct pricing copy to free public beta / post-beta monetisation posture.

Forbidden:

- No new marketing routes.
- No new analytics events.
- No new pricing checkout, Stripe, billing portal, or plan enforcement.
- No new supplier/profile data fields.

Acceptance:

- Marketing and public data surfaces feel like the same SaaS as the logged-in portal.
- `pricing` no longer contradicts the free public beta decision.
- Locked legal/citation/methodology blocks remain intact.
- Public profile still avoids authenticated-only client islands.

### Phase D — Portal Polish

Goal: normalize page-level buyer/supplier/admin UI after the shell is correct.

Buyer routes in scope:

- `/app`
- `/app/discover`
- `/app/saved`
- `/app/settings/*`
- Existing buyer profile/card/list surfaces where inconsistent.

Supplier routes in scope:

- `/supplier`
- `/supplier/profile`
- `/supplier/profile/[id]`
- `/supplier/documents`
- `/supplier/rfqs*`
- `/supplier/messages*`
- `/supplier/partners`

Admin routes in scope for visual polish only:

- `/admin`
- `/admin/suppliers*`
- `/admin/users*`
- `/admin/certifications`
- `/admin/sanctions`
- `/admin/claims`
- `/admin/audit-log*`

Allowed scope:

- Human-readable labels.
- Card/table/form spacing.
- Empty states.
- Section grouping.
- Action placement.
- Responsive/tap-target polish.

Forbidden:

- Do not add the manual-review backlog list.
- Do not add merge/publish/reject workflows for unpublished suppliers.
- Do not change admin RPCs or queue semantics.
- Do not expose hidden data.

Acceptance:

- Portal pages use one card/table/form/input language.
- Admin forms become more understandable without adding new behaviour.
- Supplier empty states guide the next action without inventing features.

### Phase E — Design QA And Closeout

Goal: verify conformance and capture any follow-up issues.

Required checks:

- Desktop and mobile screenshots for representative pages:
  - `/`
  - `/discover`
  - `/suppliers/[slug]`
  - `/pricing`
  - `/compliance`
  - `/app/discover`
  - `/app/settings`
  - `/supplier/profile`
  - `/admin`
  - `/admin/suppliers/[id]`
  - `/admin/users`
- Widths: 360, 414, 768, 1024, 1440, 1920.
- No horizontal overflow at 360.
- Tap targets at least 44 px where touch-visible.
- No card/content overlap.
- Text fits inside buttons, cards, tabs, and chips.
- No user-facing `SBI`, `score`, `rating`, or internal DB field-name leakage outside admin-only technical contexts.

## 5. Admin Usability Follow-up (Explicitly Out Of Scope)

Create the next spec after this design pass:

**Spec A7 — Manual Review Admin Workflow** (working title)

Goals for the follow-up:

1. Surface the 1k+ companies/rows in Supabase that need manual review before publication.
2. Show review queue counts by type on `/admin`.
3. Add actionable review lists for fuzzy match, group parent review, brand disclosure review, certification review, sanctions hit, and unpublished/manual-review suppliers.
4. Provide approve/reject/merge/publish workflows with append-only audit logging.
5. Keep server-side admin gates and RLS boundaries intact.

Do not implement any of that in this spec.

## 6. Validation

Each implementation phase must run:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

If a phase touches only presentation and `pnpm test` is slow but available, still run it unless the user explicitly allows skipping. Document any skipped command in the closeout.

Additional phase smoke should assert:

- No new migration files.
- No `package.json` dependency changes.
- Route count unchanged.
- Forbidden public strings absent from non-admin surfaces: `SBI`, `pillar_`, `internal_score`, `supplier_score_internal`, `score`, `rating`, A-D grade language.
- No public/contact PII keys newly rendered: `email_primary`, `phones`, `contact_name`, `contact_role`, `nid_number`, `proprietor_nid`, `owner_phone`, `trade_license_number`, `body_ciphertext`.

## 7. Progress Tracker Rules

When implementation starts:

1. Update [progress-tracker.md](../progress-tracker.md) and mark this spec in progress.
2. Implement only the active phase.
3. Run validation.
4. Update [progress-tracker.md](../progress-tracker.md) with phase closeout, decisions, and follow-ups.
5. Commit on `development` with a Conventional Commit message.
6. Do not push to `main`.

Suggested commit sequence:

- `style(ui): lock SourceBD sitewide design system`
- `fix(shell): align portal role navigation and identity`
- `style(marketing): align public surfaces with portal design`
- `style(portal): polish buyer supplier admin screens`

## 8. Acceptance Gate For Full Spec

The spec is complete when:

- Marketing, public Discover/profile, buyer portal, supplier portal, and admin portal share the same light SourceBD SaaS design language.
- Role shell mismatches shown in the screenshots are fixed.
- Account identity no longer falls back to `Guest` for signed-in users with profiles.
- Pricing no longer contradicts free public beta / post-beta monetisation.
- No DB migration was added.
- No new feature workflow was added.
- No new dependency was added.
- Route count is unchanged.
- Build, lint, typecheck, tests, and design smoke pass.
- Admin manual-review backlog remains documented as the next spec, not silently implemented here.
