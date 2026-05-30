# Spec A5 — User management

Fifth Phase-4 admin spec (A1 ✅ → A2 ✅ → A3 ✅ → A4 ✅ → **A5** → A6).
Admin manages platform user accounts: change a user's role
(`buyer` / `supplier` / `admin`), suspend / unsuspend an account
(reversible kill-switch), and read a per-user audit drilldown of
every admin action that affected the user OR was performed by the
user (when the user is themself an admin). Every mutation closes
through a SECURITY DEFINER RPC that writes one `admin_audit_log`
row in the same transaction. The sidebar slot already exists from
F2 (`{ label: "Users & access", href: "/admin/users", Icon: Users }`)
— A5 wires the route up, no new slot.

## DB — `supabase/migrations/0041_admin_user_management.sql`

1. **Probe first** (`ops/_a5_probe.py`) — inventory the live substrate
   before writing the migration:

   - `public.profiles` columns + counts by role (`buyer` /
     `supplier` / `admin`).
   - Whether `auth.users.banned_until` is in active use anywhere
     (sanity check; A5 will NOT write to this column).
   - `public.admin_audit_log` column shape (already known from A2,
     re-confirm `actor_id`, `action`, `target_table`, `target_id`,
     `patch`, `metadata`, `created_at`).
   - `public.user_role` enum values (re-confirm `('buyer','supplier','admin')`).
   - Count of distinct admin users (informs the last-admin guard —
     see decision log).

2. Additive nullable columns on `public.profiles` for suspension
   state (mirror A3 / A4 pattern — `add column if not exists`, length
   check on the reason text):

   - `is_suspended       boolean not null default false`
   - `suspended_at       timestamptz`
   - `suspended_by       uuid references auth.users(id) on delete set null`
   - `suspended_reason   text` (≤2000)

   Index: `create index if not exists idx_profiles_is_suspended on
   public.profiles (is_suspended) where is_suspended = true;` —
   keeps the suspended-list filter cheap without bloating the common
   `is_suspended=false` plan.

3. Three SECURITY DEFINER plpgsql RPCs, all
   `set search_path = public, auth`, in-body role check raising
   `insufficient_privilege` (sqlstate 42501) for non-admin / anon:

   - `admin_user_list(p_search text default null,
                      p_role   text default null,
                      p_status text default 'all',
                      p_limit  int  default 50,
                      p_offset int  default 0) returns jsonb`

     Joins `public.profiles` → `auth.users` (for `email`,
     `created_at`, `last_sign_in_at`). `p_search` matches
     `email ILIKE %q% OR display_name ILIKE %q%`. `p_role ∈
     ('buyer','supplier','admin')` filters by role. `p_status ∈
     ('active','suspended','all')` filters by `is_suspended`.
     Returns
     `{total, rows: [{user_id, email, display_name, role,
                      is_suspended, suspended_at, suspended_reason,
                      created_at, last_sign_in_at, plan_tier,
                      claimed_supplier:{id,slug,company_name}|null,
                      audit_count}]}`.
     `claimed_supplier` is a single supplier object (LEFT JOIN
     `suppliers` where `claimed_by = user_id` LIMIT 1 — claim is
     1-to-1 per S1). `audit_count` is the number of
     `admin_audit_log` rows where the user is either actor or
     target. No PII keys beyond `email` (already admin-only context).

   - `admin_user_update(p_user_id uuid,
                        p_patch   jsonb) returns jsonb`

     Strict 3-key whitelist: `{role, is_suspended, suspended_reason}`.
     Any other key → `errcode='22023' field % is not editable`
     (mirrors A2's loop). Validation rules, in order:

     1. `auth.uid()` is admin (in-body role check, otherwise 42501).
     2. `p_user_id = auth.uid()` → raise `42501` "cannot edit self"
        (no self-demote, no self-suspend → lockout-safe).
     3. Target user exists in `profiles` (else `P0002`).
     4. If patch sets `role` to a non-`admin` value AND the target
        is currently `admin`, run the **last-admin guard**: refuse
        with `errcode='22023'` if removing this admin would drop the
        active (`is_suspended=false`) admin count to 0.
     5. If patch sets `is_suspended=true` AND target is currently
        `admin`, run the same last-admin guard against active-admin
        count.
     6. `is_suspended` change requires a non-blank
        `suspended_reason` on suspend (`btrim`→`nullif('','')`,
        otherwise `errcode='22023'`); on unsuspend the RPC sets
        `is_suspended=false`, clears `suspended_at`,
        `suspended_by`, `suspended_reason` (clean slate, mirrors
        A4's `confirm` resetting `sanctions_cleared`).

     Mutations applied via dynamic-key loop (A2 pattern). Audit
     row(s) written inside the same transaction:

     - role change: `action='admin_user_role_change'`,
       `target_table='profiles'`, `target_id=p_user_id`,
       `patch=jsonb{from, to}`, `metadata=jsonb{}`.
     - suspend: `action='admin_user_suspend'`, patch
       `{reason}`, metadata `{}`.
     - unsuspend: `action='admin_user_unsuspend'`, patch `{}`,
       metadata `{previous_reason}`.

     A single call may produce up to 2 audit rows (role + suspend
     in one PATCH). Returns
     `{ok:true, user_id, role, is_suspended}`.

   - `admin_user_audit(p_user_id uuid,
                       p_direction text default 'both',
                       p_limit     int  default 50,
                       p_offset    int  default 0) returns jsonb`

     Returns audit rows where:

     - `p_direction='target'`: `target_table='profiles' AND
       target_id=p_user_id` (actions performed ON the user)
     - `p_direction='actor'`: `actor_id=p_user_id` (actions taken
       BY this user — only meaningful for admins)
     - `p_direction='both'`: union of the two (deduped by
       `admin_audit_log.id`), tagged with a derived `direction`
       string (`'as_target'` / `'as_actor'` / `'both'` when the
       row qualifies under both, e.g. an admin acting on their own
       row would — but self-edit is refused, so practically never).

     Returns
     `{total, rows: [{id, created_at, actor_id, actor_email,
                      action, target_table, target_id, patch,
                      metadata, direction}]}` ordered by
     `created_at DESC`.

4. `revoke all on function … from public; grant execute to authenticated`
   on all three RPCs.

5. **Middleware integration** — extend `middleware.ts` to read
   `is_suspended` from the same `profiles` SELECT (one extra
   column, no extra round-trip). When `is_suspended=true`, redirect
   to `/suspended` (a new public-route page that explains the
   account is suspended; the user is still logged in for audit
   purposes but cannot reach `/app/*`, `/supplier/*`, `/admin/*`).
   `is_suspended=true` admins are blocked from `/admin/*` too — no
   carve-out (the last-admin guard guarantees at least one active
   admin remains, so the platform stays administrable).

## App surfaces

- `app/api/v1/admin/users/[id]/route.ts` — PATCH `{patch:{...}}`;
  `getServerRole() === 'admin'` gate (403 otherwise); validates
  UUID + patch shape (zod: optional `role` enum, optional
  `is_suspended` bool, optional `suspended_reason` string ≤2000);
  dispatches `admin_user_update`; maps RPC errors to 400 / 403 /
  404 / 409 (`cannot edit self` → 403, `last admin` → 409,
  `not found` → 404, whitelist violation → 400).

- `app/(app)/admin/users/page.tsx` — server component,
  `dynamic = 'force-dynamic'`, filter chips `role ∈
  (buyer|supplier|admin|<any>)` + `status ∈
  (active|suspended|all)` + search input, paginated 50/page,
  calls `admin_user_list`. Per-row card: email + display_name +
  role badge + suspended badge (if any) + claim summary + last
  sign-in (relative) + audit count + link to drilldown.

- `app/(app)/admin/users/[id]/page.tsx` — server component,
  `dynamic = 'force-dynamic'`. Calls `admin_user_list` with a
  single-id filter (or a small helper RPC; in practice the page
  re-uses `admin_user_list` with `p_search=user.email` then picks
  the row — OR a new `admin_user_get(p_user_id)` if cleaner; spec
  decision: use `admin_user_get` as a fourth RPC to avoid the
  search-by-email round-trip and to keep the get-shape stable when
  email changes). Renders profile card + suspension card +
  audit-feed card (calls `admin_user_audit(p_direction='both')`,
  paginated 50). Mounts `<AdminUserEditForm>` for mutations.

  - Add `admin_user_get(p_user_id uuid) returns jsonb` to the
    migration: returns one user object in the same shape as one
    `admin_user_list` row.

- `components/admin-user-edit-form.tsx` — client island.
  Role `<select>` (buyer / supplier / admin) and Suspend / Unsuspend
  button. First click on Suspend reveals the reason input; second
  click submits. Unsuspend is a single-click confirm-then-submit
  (`window.confirm`). Diff-aware: PATCH body carries only changed
  keys (A2 pattern); empty diff disables Save. Server-side errors
  surface inline.

- `app/suspended/page.tsx` — public page (no auth gate) that
  explains the account is suspended and offers a sign-out link.
  Linked from the middleware redirect. Plain server component.

- `components/shell/sidebar.tsx` — **no change**. F2 already
  reserved the `Users & access` slot at `/admin/users`. Admin slot
  count stays at 9.

## Smoke — `ops/_a5_smoke.py`

Mirror `ops/_a4_smoke.py` harness (psycopg autocommit, `as_user`,
`make_user`, `collect_keys`, recursive FORBIDDEN diff with
`email` / `last_sign_in_at` / `audit_count` carved out by name like
A3's `uploaded_by_email`, audit-then-users cleanup ordering). Seed
4 users: 1 buyer, 1 supplier, 1 admin (operator under test), 1
extra admin (so the last-admin guard does NOT trip mid-test).

Checks:
1. `admin_user_list()` returns ≥4 rows; shape correct
   (`user_id`, `email`, `role`, `is_suspended`, `claimed_supplier`
   key present even when null, `audit_count`); `p_role='buyer'`
   narrows correctly; `p_status='suspended'` returns empty before
   any suspension.
2. `admin_user_update(buyer_id, {role:'supplier'})` flips the role;
   one `admin_audit_log` row written with `action='admin_user_role_change'`,
   `patch={from:'buyer', to:'supplier'}`. Re-flip back to buyer
   writes a second row.
3. `admin_user_update(supplier_id, {is_suspended:true,
   suspended_reason:'test'})` flips suspension; audit row written
   with `action='admin_user_suspend'`. Unsuspend writes a third row
   with `action='admin_user_unsuspend'` and clears `suspended_at` /
   `suspended_by` / `suspended_reason`.
4. Blank `suspended_reason` on suspend raises `22023`.
5. Patch with unknown key raises `22023` ("not editable").
6. Self-edit refused: admin operator calling
   `admin_user_update(self_id, {role:'buyer'})` raises `42501`.
7. Last-admin guard: temporarily downgrade the second admin (so
   only the operator remains as active admin), then assert that
   `admin_user_update(self_id, ...)` would still refuse on
   self-edit (42501 fires first), AND that demoting the operator
   from a *different* admin (which we'd have to re-promote one
   first to test) raises `22023` when it would zero out admin
   count. Symmetric assertion for suspending the last admin.
8. buyer / supplier / anon raise `InsufficientPrivilege` on all
   four RPCs (3 RPCs × at least 2 of the 3 roles each — collect 6
   assertions total, matching the A2/A3/A4 pattern).
9. `admin_user_audit(buyer_id, 'both')` returns the role-flip
   rows written in step 2; `direction` tag is `'as_target'`;
   ordering is `created_at DESC`.
10. Recursive PII / `body_ciphertext` / SBI leak diff over every
    admin payload collected = `[]`, with `email` /
    `last_sign_in_at` / `audit_count` / `actor_email` exempted in
    the FORBIDDEN set (admin-only carve-out, A3 precedent).
11. Cleanup ordering: delete `admin_audit_log` rows first (FK
    `on delete set null` would otherwise null `actor_id` and
    cascade noise), then `profiles` rows, then `auth.users`. Do
    NOT touch any non-test admin / user.

Run on prod (`109.104.153.228`) — one SSH command at a time;
`docker exec -i sourcebd-etl-run python /tmp/_apply_stdin.py <
/tmp/0041_admin_user_management.sql` (the `-i` flag is mandatory
per the A3 learning).

## Closing

- Update `context/progress-tracker.md`: mark spec in progress at
  start; on close mark complete; add Spec A5 entry to "Recently
  shipped (Phase 4 — Admin Tools)" with an architectural decisions
  block (decisions: probe-first; profile-flag suspension over
  `auth.users.banned_until` — reversible kill-switch we own;
  self-edit refused at the RPC layer regardless of patch shape;
  last-admin guard prevents zeroing out platform admins; audit
  drilldown is bi-directional via `admin_user_audit`; suspension
  is enforced in middleware as well as the RPC layer to block
  active sessions; reuse `admin_audit_log` table — three new
  `action` strings only; sidebar already had the slot from F2,
  no new slot); bump migrations count → 41; bump route count
  (expect +3 routes: `/admin/users`, `/admin/users/[id]`,
  `/api/v1/admin/users/[id]`, plus the public `/suspended`
  page = +4 total); reset In progress.
- Commit on `development` branch (Conventional Commit), push.
