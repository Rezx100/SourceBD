# Spec H5 — In-app onboarding tour (5 steps)

> Phase 6 hardening spec #5. Follows H1 (Sentry + PostHog), H2 (rate limiting),
> H3 (Stripe webhook hardening), H4 (Resend email templates). One spec = one
> PR on `development`.

## Scope

Ship a lightweight 5-step product tour shown the first time an authenticated
buyer lands on `/app` and the first time an authenticated supplier lands on
`/supplier`. The tour covers the core happy path:

1. **Dashboard tiles** — Saved suppliers · Active RFQs · Compliance alerts ·
   Recent activity. (Buyer flavour: dashboard tiles; supplier flavour:
   claimed companies + pending claims.)
2. **Discover** — filter rail + receipts on result cards. (Supplier flavour:
   profile editor + cert uploads.)
3. **Saved suppliers** — shortlist + unsave. (Supplier flavour: inquiries
   inbox.)
4. **RFQ create** — compose an RFQ against the shortlist. (Supplier flavour:
   RFQs received + quote submission.)
5. **Messages** — encrypted thread per RFQ. (Same for both flavours.)

Two flavours (buyer / supplier) share one client component. Role is resolved
server-side from `public.profiles.role` and passed in as a prop — anon
visitors never see the tour because the server wrapper short-circuits when
no session is found.

## Out of scope

- **Anchored popovers / spotlight overlays.** A real anchored tour would
  need to detect when the anchor element is visible on the current route
  (Discover anchors don't exist on `/app`, etc.) and recover when the user
  navigates mid-tour. v1 ships a route-independent centered modal (≥640px)
  / bottom sheet (<640px) that describes each step with copy + icon + a
  "Take me there" link. Anchored spotlights are a follow-up spec.
- **Tour analytics events.** The PostHog provider (H1) autocaptures button
  clicks; explicit `tour_step_advanced` events are a follow-up if product
  decides they need the funnel.
- **Re-trigger from settings.** The tour can be restarted via a future
  Settings → "Replay tour" link (deferred). v1 only ships the first-visit
  trigger.

## Architectural choices

1. **No new tools.** Architecture.md rule #4: no driver.js, intro.js,
   react-joyride, shepherd. Tour is built from `'use client'` React +
   Tailwind + the existing `Button` primitive. Keyboard handling, focus
   trap, and Esc-close are ~50 lines of plain React.
2. **Persistence in `public.profiles.onboarding_state jsonb`.** Adding a
   column is cheaper than a new table and the row already exists per
   authenticated user (migration 0022). State shape:
   `{ "tour_completed_at": "<ISO>", "tour_dismissed_at": "<ISO>",
     "tour_last_step": <int> }`. Only `tour_completed_at` /
   `tour_dismissed_at` non-null gates the tour off — `tour_last_step` is a
   cheap nicety for "resume where you left off" if we ever want it.
3. **Client-side localStorage flag is NOT a control.** The server reads
   `onboarding_state` before deciding to render the tour mount. A user who
   clears their localStorage will not re-see the tour because the DB row
   says they completed it. A user who never completes the tour will see
   it every visit until they do.
4. **SECURITY DEFINER RPC, authenticated grant.** The RPC
   `public.profile_onboarding_set(p_key text, p_value jsonb) returns jsonb`
   verifies `auth.uid() = profiles.id` inside its body. This is a
   legitimate user-initiated mutation (they clicked Skip or Done), so
   `grant execute to authenticated` is correct. The H4 pattern
   (`revoke from anon, authenticated; grant to service_role`) does NOT
   apply here — that pattern is for service-only audit-log writers. The
   RPC explicitly `revoke from public, anon` so anonymous callers cannot
   probe it.
5. **No new HTTP route.** Persistence calls go through the supabase-js
   browser client (`lib/supabase/browser.ts`) directly to the RPC. Adding
   `/api/v1/onboarding` would widen the attack surface for no benefit
   (the RPC is the security boundary; an extra HTTP route is one more
   thing to rate-limit and auth-gate). Route count stays at 64 — the
   smoke asserts.
6. **Mounted in two new route-group layouts.** New
   `app/(app)/app/layout.tsx` (buyer) and `app/(app)/supplier/layout.tsx`
   (supplier) wrap their respective subtrees with the tour mount.
   Layouts are not HTTP routes — they do not appear in
   `routes-manifest.json`. The mount itself short-circuits to `null` when
   the tour is already completed/dismissed, so the cost on a returning
   user is one server-side `select onboarding_state, role from profiles
   where id = auth.uid()` and zero client JS.
7. **Reduced-motion respected.** `app/globals.css` already wires
   `@media (prefers-reduced-motion: reduce)` to force animation/transition
   durations to 0ms — the tour's fade-in and step transitions inherit
   automatically.
8. **Keyboard a11y.** Esc closes (recorded as `tour_dismissed_at`). Tab
   cycles inside the active step popover via a focus trap (first/last
   focusable element + a `focusin` listener on `document` that re-targets
   stray focus). Enter on the Next/Done button advances.
9. **Mobile viewport.** `<640px` renders as a bottom sheet pinned to the
   safe-area bottom; `≥640px` renders as a centered card with a backdrop.
   Both are full-width on their respective axis to avoid off-screen
   positioning surprises.

## Deliverables

### Schema

`supabase/migrations/0047_onboarding_state.sql`:

```sql
-- Add onboarding_state column to profiles.
alter table public.profiles
  add column if not exists onboarding_state jsonb not null default '{}'::jsonb;

-- SECURITY DEFINER RPC: set one onboarding_state key.
-- Verifies auth.uid() = profiles.id, refuses anon callers, json-patches the
-- column.
create or replace function public.profile_onboarding_set(
  p_key   text,
  p_value jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_out jsonb;
begin
  if v_uid is null then
    raise exception 'auth required' using errcode = '28000';
  end if;
  if p_key is null or length(p_key) = 0 then
    raise exception 'key required' using errcode = '22023';
  end if;
  if p_key !~ '^[a-z_][a-z0-9_]*$' then
    raise exception 'invalid key' using errcode = '22023';
  end if;
  update public.profiles
     set onboarding_state =
           jsonb_set(coalesce(onboarding_state, '{}'::jsonb),
                     array[p_key], p_value, true)
   where id = v_uid
   returning onboarding_state into v_out;
  if v_out is null then
    raise exception 'profile not found' using errcode = '42704';
  end if;
  return v_out;
end;
$$;

revoke all on function public.profile_onboarding_set(text, jsonb) from public;
revoke execute on function public.profile_onboarding_set(text, jsonb) from anon;
grant  execute on function public.profile_onboarding_set(text, jsonb) to authenticated;
```

### Code

- `components/onboarding/tour-steps.ts` — pure data module exporting
  `BUYER_STEPS` + `SUPPLIER_STEPS` arrays of `{ id, title, body,
  cta_label, cta_href }`. 5 entries each.
- `components/onboarding/tour.tsx` (`'use client'`) — renders the
  step modal/sheet. Props: `flavour: 'buyer'|'supplier'`,
  `initialStep: number`. Manages focus trap, keyboard, RPC calls.
- `components/onboarding/tour-mount.tsx` (server) — fetches the caller's
  `profiles.onboarding_state` + `role`. Renders `<Tour …/>` only when
  the role matches the requested flavour AND `tour_completed_at` +
  `tour_dismissed_at` are both null. Else renders `null`.
- `app/(app)/app/layout.tsx` (new) — passes children through, mounts
  `<TourMount flavour="buyer" />` below the children.
- `app/(app)/supplier/layout.tsx` (new) — same, `flavour="supplier"`.

### Smoke

`ops/_h5_smoke.py` — disk-only, no network. Checks:

1. Migration `0047_onboarding_state.sql` on disk with the column add,
   the RPC create-or-replace, SECURITY DEFINER, `set search_path = public`,
   `revoke … from public`, `revoke execute … from anon`, `grant execute
   … to authenticated`. Negative-regex asserts the RPC is NOT granted to
   `service_role` alone (i.e. authenticated grant is present).
2. `components/onboarding/tour.tsx` exists, starts with `"use client"`,
   imports the steps module, calls `profile_onboarding_set` via
   supabase-js, handles `Escape` key, exposes a focus trap.
3. `components/onboarding/tour-mount.tsx` exists, is a server component
   (no `"use client"`), selects `onboarding_state, role` from `profiles`,
   short-circuits when completed/dismissed/anon.
4. `components/onboarding/tour-steps.ts` exports `BUYER_STEPS` and
   `SUPPLIER_STEPS`, each with exactly 5 entries.
5. `app/(app)/app/layout.tsx` mounts `TourMount` with `flavour="buyer"`.
   `app/(app)/supplier/layout.tsx` mounts `TourMount` with
   `flavour="supplier"`.
6. Forbidden-token scan on the new TS — none of the M5 forbidden tokens
   (`email_primary`, `phones`, `contact_name`, `contact_role`,
   `nid_number`, `password`, `body_ciphertext`, `sbi`, `pillar_`,
   `internal_score`) appear in any new file.
7. `.next/routes-manifest.json` route count = 64 (H3/H4 baseline).

## Validation

```
pnpm typecheck
pnpm lint
pnpm build       # expect route count 64
python ops/_h5_smoke.py
```

Apply migration 0047 to live Supabase via the H4 pattern (scp +
`docker exec sourcebd-etl-run python /tmp/_apply_stdin.py`). Verify
RPC grants resolve to `(postgres, authenticated)` only — explicitly
NOT anon, NOT service_role.

## Commit

`feat(onboarding): ship Spec H5 in-app onboarding tour` on
`development`. Push. Surface the commit ref.
