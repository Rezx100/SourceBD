# Spec A4 — Sanctions queue

Fourth Phase-4 admin spec (A1 ✅ → A2 ✅ → A3 ✅ → **A4** → A5 → A6).
Admin reviews supplier rows that the ingest pipeline has auto-flagged
against the sanctions lists (`uflpa`, `us_wro`, `ofac_sdn`, `uk_ofsi`,
`eu_sanctions`, `ilab_tvpra`) — each surfaced as a row in
`public.verification_queue` with `queue_type = 'sanctions_hit'` and a
matched `sanctions_list_entries` reference carried in `source_data`.
Admin either **confirms** the hit (flips
`suppliers.sanctioned_flag = true` + records the reason) or **clears**
it (records that the row was reviewed and judged not a true match,
without touching the published sanction). Every decision closes the
queue row and writes one `admin_audit_log` entry.

## DB — `supabase/migrations/0040_admin_sanctions_queue.sql`

1. **Probe first** (`ops/_a4_probe.py`) — map the live substrate before
   writing the migration: `suppliers.{sanctioned_flag, sanctioned_reason}`
   (A2), the `queue_type='sanctions_hit'` row shape in
   `verification_queue` (queue_type enum from 0001), and what
   `source_data` keys ingestion writes (expect `list`, `matched_name`,
   `match_score`, `entry_id`). Confirm the six `sanctions_list_entries`
   list names: `uflpa / us_wro / ofac_sdn / uk_ofsi / eu_sanctions /
   ilab_tvpra`.

2. Additive nullable columns on `public.suppliers` for admin decision
   state (mirror A3 / A2 pattern — `add column if not exists`, length
   check on the reason text):

   - `sanctions_reviewed_at      timestamptz`
   - `sanctions_reviewed_by      uuid references auth.users(id) on delete set null`
   - `sanctions_cleared          boolean not null default false`
   - `sanctions_cleared_reason   text` (≤2000)

3. Two SECURITY DEFINER plpgsql RPCs, both
   `set search_path = public, auth`, in-body role check raising
   `insufficient_privilege` (sqlstate 42501) for non-admin / anon:

   - `admin_sanctions_queue_list(p_status text default 'open',
                                 p_list   text default null,
                                 p_limit  int  default 50,
                                 p_offset int  default 0) returns jsonb`
     Joins `verification_queue` (queue_type='sanctions_hit') →
     `suppliers` → `sanctions_list_entries` (LEFT JOIN via
     `(q.source_data->>'entry_id')::uuid`). `p_status ∈
     ('open','reviewed','all')`. `p_list` filters by the queue row's
     `source_data->>'list'`. Returns
     `{total, rows: [{queue_id, queue_created_at, reviewed_at,
                      admin_action, supplier:{id, slug, company_name,
                      entity_type, sanctioned_flag, sanctioned_reason},
                      hit:{list, matched_name, match_score, entry_id,
                           entity_name, source_url, listed_date}}]}`.
     No PII keys (no `email_primary` / `phones` / `contact_*`).

   - `admin_sanctions_decide(p_queue_id uuid,
                             p_decision text,
                             p_reason   text default null) returns jsonb`
     `p_decision ∈ ('confirm','clear')`. Loads the queue row
     (`for update`, queue_type='sanctions_hit'), resolves the
     supplier. Both branches require a non-blank `p_reason`
     (`btrim` → `nullif('', '')`); blank → `errcode='22023'`.
     - `confirm`: `suppliers.sanctioned_flag = true`,
       `sanctioned_reason = v_reason`. (Does NOT touch
       `sanctions_cleared` so the operational sanction stays definitive
       in case of later reversal — see decision log.)
     - `clear`: `suppliers.sanctioned_flag = false`,
       `sanctions_cleared = true`, `sanctions_cleared_reason = v_reason`.
     Closes the queue row in the same transaction
     (`reviewed_at = now()`, `reviewed_by = auth.uid()`,
     `admin_action = v_decision::queue_action`). Re-decide on an
     already-reviewed queue row raises `P0002`. Writes one
     `admin_audit_log` row: `actor_id = auth.uid()`,
     `action = 'admin_sanctions_decide'`, `target_table = 'suppliers'`,
     `target_id = <supplier_id>`,
     `patch = jsonb{decision, reason}`,
     `metadata = jsonb{queue_id, list, entry_id}`. Returns
     `{ok:true, queue_id, supplier_id, decision}`.

4. `revoke all on function … from public; grant execute to authenticated`
   on both RPCs.

## App surfaces

- `app/api/v1/admin/sanctions/decide/route.ts` — POST
  `{queue_id, decision, reason}`; `getServerRole() === 'admin'` gate
  (403 otherwise); validates UUID + decision enum + non-blank reason;
  dispatches `admin_sanctions_decide`; maps RPC errors to 400 / 403 /
  404 / 409 (`already decided` → 409, `not found` → 404).
- `app/(app)/admin/sanctions/page.tsx` — server component,
  `dynamic = 'force-dynamic'`, filter chips `status ∈
  (open|reviewed|all)` + `list ∈ (uflpa|us_wro|ofac_sdn|uk_ofsi|
  eu_sanctions|ilab_tvpra|<any>)`, paginated 50/page, calls
  `admin_sanctions_queue_list`. Per-row card: supplier name /
  slug + entity-type tag + current `sanctioned_flag` badge + matched
  list badge + matched_name + match_score + listed_date + source_url
  link. `<AdminSanctionsDecideButton/>` on open rows.
- `components/admin-sanctions-decide-button.tsx` — client island.
  Mirror of A3's button but **both Confirm and Clear require a reason
  input** (A3's approve fired immediately; A4 makes both paths require
  context because both are admin determinations that need to be
  defensible). First click on Confirm or Clear reveals the input;
  second click submits.
- `components/shell/sidebar.tsx` — insert a new admin slot
  `{ label: "Sanctions queue", href: "/admin/sanctions", Icon:
  Prohibit }` between Certification queue (A3) and Sources &
  ingestion. Admin slot count 7 → 8.

## Smoke — `ops/_a4_smoke.py`

Mirror `ops/_a3_smoke.py` harness (psycopg autocommit, `as_user`,
`make_user`, `collect_keys`, recursive FORBIDDEN diff, audit-then-users
cleanup ordering). Pick a real published, non-sanctioned factory; pick
or seed a real `sanctions_list_entries` row; seed three
`verification_queue` rows (one for confirm, one for clear, one for
blank-reason failure).

Checks:
1. `admin_sanctions_queue_list(status='open')` returns the seeded
   rows; `total ≥ 2`; shape correct (`supplier`, `hit`, queue keys);
   `list` filter narrows; `status='reviewed'` excludes open.
2. `admin_sanctions_decide(q1, 'confirm', 'UFLPA Entity List match')`
   → `suppliers.sanctioned_flag = true`,
   `sanctioned_reason = 'UFLPA Entity List match'`; queue row
   `reviewed_at` set, `admin_action = 'confirm'`; one
   `admin_audit_log` row written with correct actor + patch +
   metadata. Re-decide raises `P0002`.
3. `admin_sanctions_decide(q2, 'clear', 'name collision — same name
   different country')` → `sanctioned_flag = false`,
   `sanctions_cleared = true`, `sanctions_cleared_reason` set; queue
   row closed; audit row written.
4. Blank reason raises `22023` on both `confirm` and `clear` paths.
5. `admin_sanctions_decide` with unknown `queue_id` raises `P0002`.
6. buyer / supplier / anon raise `InsufficientPrivilege` on both RPCs
   (6 assertions total).
7. Recursive PII / `body_ciphertext` / SBI leak diff over every admin
   payload collected = `[]`.
8. Cleanup ordering: delete `admin_audit_log` rows first, then queue
   rows, then revert supplier columns
   (`sanctioned_flag`, `sanctioned_reason`, `sanctions_reviewed_at`,
   `sanctions_reviewed_by`, `sanctions_cleared`,
   `sanctions_cleared_reason`) back to their pre-test values, then
   profiles + `auth.users`. (Don't touch `sanctions_list_entries`
   unless we seeded a fresh row.)

Run on prod (`109.104.153.228`) — one SSH command at a time;
`docker exec -i sourcebd-etl-run python /tmp/_apply_stdin.py <
/tmp/0040_admin_sanctions_queue.sql` (the `-i` flag is mandatory per
the A3 learning).

## Closing

- Update `context/progress-tracker.md`: mark spec in progress at
  start; on close mark complete; add Spec A4 entry to "Recently
  shipped (Phase 4 — Admin Tools)" with an architectural decisions
  block (decisions: probe-first; confirm-and-clear both require a
  reason; clear is reversible-by-design and never blocks a later
  confirm; sanctions_cleared is a separate boolean not a state enum;
  reuse `admin_audit_log` + `verification_queue.admin_action`; sidebar
  grew 7 → 8); bump migrations count → 40; bump route count (expect
  64 routes, was 62); reset In progress.
- Commit on `development` branch (Conventional Commit), push.
