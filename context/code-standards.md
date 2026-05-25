# SourceBD — Code Standards

## TypeScript
- `"strict": true`. No `any`. No untyped exports.
- Prefer `type` for unions, `interface` for object shapes that may be extended.
- All API route inputs validated with `zod`. Infer types from schemas (`z.infer<…>`).
- No `as` casts except at the very edge (parsing JSON, third-party untyped libs). Comment why.
- Errors are typed (`Result<T, E>` pattern OR thrown `Error` subclasses) — never swallowed.

## Python (ETL)
- Python 3.12, `pyproject.toml` with `ruff` + `mypy --strict`.
- Type hints on every function. No `Any`.
- Use `pydantic` v2 models for parsed records.
- One source per file in `etl/parsers/`. Pure functions where possible.
- Logging via `structlog` (JSON in production, pretty in dev).

## File & symbol naming
- Files: `kebab-case.ts` / `kebab-case.tsx` / `snake_case.py`.
- React components: `PascalCase`. Hooks: `useCamelCase`. Variables/functions: `camelCase` (TS) / `snake_case` (Py).
- DB tables: `snake_case` plural (`suppliers`, `source_records`). Columns: `snake_case`.
- Env vars: `SCREAMING_SNAKE_CASE`. Server-only vars MUST NOT be prefixed `NEXT_PUBLIC_`.

## Imports
Order: std lib → third-party → workspace alias (`@/…`) → relative. Auto-sorted by ESLint / ruff.

## Styling
- Tailwind utility classes only. No raw CSS files except `globals.css` (resets + tokens).
- Use design tokens from `frontend-design-spec.md` — never hex colors inline (`bg-bg`, `text-tx`, etc., mapped in `tailwind.config.ts`).
- Class composition via `cn()` helper (`clsx` + `tailwind-merge`).

## React / Next.js
- Default to **Server Components**. Mark `'use client'` only when interactivity demands it.
- Data fetching in Server Components or Server Actions. No `useEffect` for fetching.
- Route handlers (`app/api/**/route.ts`): one resource per file, named exports for HTTP verbs.
- No `getServerSideProps` (App Router only).

## Database
- All schema changes via numbered SQL migrations in `supabase/migrations/NNNN_name.sql`.
- Every table has `id uuid primary key default gen_random_uuid()`, `created_at`, `updated_at`.
- RLS enabled on every table. Default policy = deny. Explicit allow per role.
- Foreign keys named `<column>_fkey`. Indexes named `idx_<table>_<columns>`.
- All user input goes through parameterised queries (Supabase JS does this automatically — never use `rpc` with string concatenation).

## Security (also see ai-workflow-rules.md & architecture.md)
- No secrets in code, ever. `.env.local` only; mirror keys (no values) into `.env.example`.
- Server-only env vars never imported in client components.
- Authn + authz checked server-side on every protected route.
- Storage buckets default private; flip with deliberate intent in a spec.
- **`public.sbi_scores` is admin-only.** RLS denies `anon` and `authenticated` SELECT. Any API route, Server Component, Server Action, RPC, or background job that returns supplier data to a non-admin client MUST NOT include `sbi_scores.total` or any `pillar_*` column in its response shape. Reviewers will reject PRs that select these columns outside an `admin`-gated route. Server-side ordering by `sbi_scores.total` is allowed (the value is consumed in the query and never serialised). See `ai-workflow-rules.md` Hard Prohibitions for rationale.
- Rate-limit every public route that hits expensive resources (Supabase queries, Resend, Stripe webhooks). Use `@upstash/ratelimit` if added in a future spec; until then, in-memory token bucket per route is acceptable for low-traffic admin endpoints.
- Sanitize any user-rendered HTML with `isomorphic-dompurify`.
- Stripe webhook endpoints verify signatures.

## Testing
- `vitest` for unit tests on scoring + matching + dedup logic. **These are mandatory** — they encode business rules.
- `playwright` for one happy-path E2E per major flow (signup → search → save supplier → send RFQ).
- ETL: `pytest` for parsers (snapshot tests on small fixture PDFs/HTML).

## Comments / docs
- Public functions and API endpoints have a one-block doc comment: purpose, inputs, outputs, errors.
- No comments restating what the code does. Comment **why**, not what.
- Update relevant `/context/` files when an architectural decision changes.

## Commits
- Conventional Commits: `feat(scope): …`, `fix(scope): …`, `chore: …`, `refactor(scope): …`, `data(source): …`.
- One spec = one PR (squash-merged).
