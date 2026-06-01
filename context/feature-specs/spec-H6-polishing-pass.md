# Spec H6 — Polishing pass (a11y skip link + loading states)

> Phase 6 hardening spec #6. Follows H1 (Sentry + PostHog), H2 (rate
> limiting), H3 (Stripe webhook hardening), H4 (Resend email templates),
> H5 (in-app onboarding tour). One spec = one PR on `development`.

## Scope

A tight launch-prep polish pass against the two concrete a11y / loading
gaps that exist today across the 64 shipped routes:

1. **Skip-to-content link.** A keyboard-only anchor mounted as the first
   focusable element in the app shell (`app/(app)/layout.tsx`) and the
   marketing shell (`app/(marketing)/layout.tsx`). Visible only when
   focused (Tab from the very top of the page). Targets a new
   `id="main-content"` anchor on each shell's `<main>`.
2. **Route-level loading skeletons.** A root `app/loading.tsx` plus one
   per route group: `app/(app)/loading.tsx`, `app/(marketing)/loading.tsx`,
   `app/(auth)/loading.tsx`. Next.js wraps the matching segment's
   `children` in `<Suspense fallback={<Loading/>}>` automatically. Each
   skeleton uses existing F1 tokens (`bg-surface-l1`, `bg-hairline`) and
   sets `role="status"` + `aria-busy="true"` + an `sr-only` "Loading…"
   label.

## Out of scope

- **Default privacy on storage** (listed in phases.md H6). No app code
  currently uploads to Supabase Storage buckets — there is no surface
  area to harden. Deferred to the spec that introduces the first upload
  flow (supplier doc upload / claim evidence). Hardening abstractions
  for code that doesn't exist would violate AGENTS.md implementation
  discipline.
- **Keyboard / focus-trap audit of every dialog.** H5 shipped the only
  focus-trap surface (the tour modal). Existing dialogs (admin queue
  decisions, claim CTAs) already render as inline cards or use shadcn
  primitives that ship with their own focus handling. A blanket audit
  is a follow-up spec.
- **Empty-state component primitive.** Each surface already renders its
  own empty state with consistent copy + tokens (Discover "No suppliers
  matched", Saved "You haven't saved any suppliers yet", etc.). Adding
  an abstraction for code that already reads cleanly is over-engineering.
- **Reduced-motion changes.** `app/globals.css` already wires
  `@media (prefers-reduced-motion: reduce)` per the H5 decision log.
  Loading skeletons inherit the reduced-motion override automatically
  (`animate-pulse` is disabled when the media query matches).
- **Mobile viewport reflow audit.** No concrete regressions identified.
  The two shells use responsive flex/grid utilities; the supplier and
  buyer dashboards stack at `<768px`. A formal viewport audit is a
  follow-up if QA surfaces specific issues.

## Architectural choices

1. **No new tools.** Architecture.md rule #4: no a11y libraries
   (focus-trap-react, reach-skip-nav, etc.). The skip link is one `<a>`
   tag with `sr-only` focus-visible utilities; loading skeletons are
   plain server components rendering Tailwind divs.
2. **Skip link belongs in the layout, not a `'use client'` island.**
   The link's behaviour is pure CSS (focus-visible reveals it) + HTML
   anchor navigation. No client JS. It must render in the SSR HTML so
   keyboard users hit it on first Tab before hydration.
3. **`id="main-content"` on `<main>` is the universal target.** Auth
   shell, app shell, marketing shell all set the same id on their
   `<main>`. The skip link only renders in shells that actually mount
   it (app + marketing); the auth shell is single-card / single-form
   so the first Tab already lands on the form control — adding a skip
   link would be noise. Auth shell still gets the `id` for consistency
   so any future skip-link placement just works.
4. **Loading states use Suspense fallback semantics, not router
   transitions.** Next.js `loading.tsx` files are matched per-segment
   and wrap the segment's children in `<Suspense fallback={…}>`. They
   show on initial RSC streaming for that segment and on subsequent
   navigations into it. They do NOT consume a route in
   `routes-manifest.json` — the 64-route invariant holds. The H6 smoke
   asserts.
5. **No new client JS.** Both deliverables are server components / pure
   HTML+CSS. Hydration cost on every shell mount is unchanged.
6. **Skeleton density is conservative.** Each route-group loading
   renders three muted bars + one card-shaped block. We don't try to
   mirror the exact final layout — that would couple the skeleton to
   page internals and rot fast. The shape signals "content loading
   here", which is the only contract Suspense fallbacks need to honor.
7. **No DB migration.** This spec is pure FE polish. Migration head
   stays at `0047_onboarding_state.sql`.

## Deliverables

### Code

- `components/ui/skip-link.tsx` — server component. Renders
  `<a href="#main-content" class="…sr-only focus-visible:not-sr-only…">
  Skip to main content</a>`. Uses existing Tailwind tokens
  (`bg-accent-indigo`, `text-ink-on-accent`, `rounded-pill`,
  `focus-visible:outline-2`). ~25 lines.
- `app/(app)/layout.tsx` — mount `<SkipLink />` as the first child of
  the outer wrapper. Add `id="main-content"` and `tabIndex={-1}` to
  the `<main>`.
- `app/(marketing)/layout.tsx` — same treatment.
- `app/(auth)/layout.tsx` — add `id="main-content"` + `tabIndex={-1}`
  to its `<main>` for consistency (no skip link mounted; rationale in
  architectural choice #3).
- `app/loading.tsx` — root fallback. Centered spinner card.
- `app/(app)/loading.tsx` — app-shell-aware skeleton (three muted bars
  + one card block, padded to match the shell's `px-4/md:px-8`).
- `app/(marketing)/loading.tsx` — marketing-shell skeleton (hero-shaped
  block + three short bars, centred to match max-width chrome).
- `app/(auth)/loading.tsx` — auth-shell skeleton (single centred card
  with two bars).

### Smoke

`ops/_h6_smoke.py` — disk-only, no network. Checks:

1. `components/ui/skip-link.tsx` exists, renders `href="#main-content"`,
   contains `sr-only` + `focus-visible:not-sr-only`, is NOT a
   `'use client'` component.
2. `app/(app)/layout.tsx` and `app/(marketing)/layout.tsx` both import
   `SkipLink` and mount it; both set `id="main-content"` on their
   `<main>`.
3. `app/(auth)/layout.tsx` sets `id="main-content"` on its `<main>`.
4. All four `loading.tsx` files exist (`app/loading.tsx`,
   `app/(app)/loading.tsx`, `app/(marketing)/loading.tsx`,
   `app/(auth)/loading.tsx`). Each contains `role="status"` and
   `aria-busy="true"` and an `sr-only` "Loading" label.
5. Forbidden-token scan on every new TS file — none of the M5 forbidden
   tokens (`email_primary`, `phones`, `contact_name`, `contact_role`,
   `nid_number`, `password`, `body_ciphertext`, `sbi`, `pillar_`,
   `internal_score`) appear in any new file.
6. `.next/routes-manifest.json` route count = 64
   (`staticRoutes + dynamicRoutes`).
7. No new dependency added to `package.json` (file hash unchanged via
   a simple content check that no `dependencies` keys were added with
   "skip", "focus-trap", "reach", "loading" prefixes).

## Validation

```
pnpm typecheck
pnpm lint
pnpm build           # expect route count 64
python ops/_h6_smoke.py
```

No DB migration to apply. No live VPS work.

## Commit

`feat(a11y): ship Spec H6 polishing pass (skip link + loading states)`
on `development`. Push. Surface the commit ref.
