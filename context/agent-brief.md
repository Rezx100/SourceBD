# SourceBD - Agent Brief

Read this file first for normal daily work. It is intentionally short so small debugging and frontend edits do not pay the cost of the full project archive.

## Product
SourceBD is a B2B intelligence SaaS for Bangladesh RMG sourcing. Buyers in the UK, US, EU, and Canada discover, vet, save, and message verified Bangladesh factories and buying houses.

## Current Operating Mode
- Current phase: Phase 7, public beta launch prep.
- Phase 0 data moat is complete enough for app work; Phases 1-6 are shipped in the codebase.
- Current goal: launch-readiness closeout, production deploy, required migrations, and 30-day zero P1/P2 incident window.
- Daily frontend polish is allowed when it stays inside the active scope and does not introduce product features, DB changes, new routes, or new dependencies.

## Non-Negotiables
- One spec or task scope at a time.
- No new tools, packages, styling systems, icon sets, or component libraries unless the user explicitly approves an exception.
- Server enforces auth, role, and ownership. Hiding UI is never a security control.
- Contact PII must be gated server-side. Public or unauthorized surfaces must not receive `email_primary`, `phones`, `contact_name`, or `contact_role`.
- No SBI leakage outside admin. Do not render SBI totals, pillar values, internal scores, grades, ratings, or score-like SourceBD opinions.
- Source trust hierarchy is law: Tier 1-3 are primary evidence; Tier 6 is cross-check only and never enters alone.
- Never commit secrets or `context/current-issues.md`.
- Never push to `main` directly.
- Do not touch the pixelsport-backend VPS.
- Work with the existing dirty tree; never revert user changes unless explicitly asked.

## Frontend Defaults
- Next.js App Router with server components by default.
- Tailwind utilities only; avoid custom CSS and inline hex colours.
- Shared light SourceBD SaaS system across marketing, public data pages, buyer app, supplier portal, and admin.
- Use neutral surfaces (`bg-neutral-50`, `bg-white`, `border-neutral-200`, `text-neutral-*`) unless an existing semantic state requires red, amber, or green.
- Magic UI is approved for new visual/layout components when an installed local component fits; shadcn/Radix primitives are for controls, dialogs, and forms.
- Respect `prefers-reduced-motion`; keep motion scoped and purposeful.

## What To Read By Task
Always read:
1. `AGENTS.md`
2. `context/agent-brief.md`
3. `context/current-state.md`
4. `context/feature-specs/active.md`

Then read only the relevant source of truth:
- Frontend or design work: `context/frontend-design-spec.md` and the active FE spec.
- ETL/data work: `context/architecture.md`, `context/code-standards.md`, and the active ETL spec.
- Security/auth/RLS work: `context/architecture.md`, `context/ai-workflow-rules.md`, and the relevant feature spec.
- Logo/source-mark work: `context/logos.lock.md`.
- Historical investigation: open archived progress or old feature specs only after a specific question points there.

## Archive Policy
`context/archive/` contains long historical records. Do not load it during routine work. Search it narrowly when debugging an old architectural decision, migration, smoke test, or production incident.
