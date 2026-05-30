# Spec A3 — Certification verification queue

Third Phase-4 admin spec (A1 ✅ → A2 ✅ → **A3** → A4 → A5 → A6). Admin
reviews supplier-uploaded certifications that are queued in
`public.verification_queue` with `queue_type = 'cert_doc_review'` and
either approves (flips `certifications.verified = true`) or rejects
(soft-deletes the cert with a reason). Every decision writes one
`admin_audit_log` row and closes the queue row.

## DB — `supabase/migrations/0039_admin_cert_verification.sql`

1. Additive nullable columns on `public.certifications`:
   - `verified boolean not null default false`
   - `rejected_at timestamptz` (nullable)
   - `rejected_reason text` (nullable, ≤2000)
   - `uploaded_by uuid` (nullable, FK `auth.users(id) on delete set null`)
     — set when supplier-portal upload lands a cert; existing
     ETL-sourced rows leave this NULL. Allows the queue list to surface
     who submitted the doc.
   - All `add column if not exists`. Length check on `rejected_reason`.

2. Two SECURITY DEFINER plpgsql RPCs, both `set search_path = public, auth`,
   in-body role check raising `insufficient_privilege` (sqlstate 42501)
   for non-admin / anon:

   - `admin_cert_queue_list(p_status text default 'open',
                            p_kind text default null,
                            p_limit int default 50,
                            p_offset int default 0) returns jsonb`
     Joins `verification_queue` (queue_type='cert_doc_review') →
     `certifications` (id read from `source_data->>'certification_id'`)
     → `suppliers` → `auth.users` (uploaded_by). `p_status ∈
     ('open','reviewed','all')`: open = `reviewed_at is null`,
     reviewed = `reviewed_at is not null`, all = no filter. `p_kind`
     filters by `certifications.kind::text`. Returns
     `{total, rows: [{queue_id, queue_created_at, reviewed_at,
                      admin_action, cert:{id, kind, certificate_no,
                      issuer, issued_on, expires_on, scope,
                      document_url, verified, rejected_at,
                      rejected_reason}, supplier:{id, slug,
                      company_name, entity_type}, uploaded_by_email}]}`.
     NO PII keys (no email_primary / phones / contact_*).
     `uploaded_by_email` is from `auth.users.email` of the uploader (the
     supplier-portal user who uploaded the cert) — admin-only context.

   - `admin_cert_decide(p_queue_id uuid,
                        p_decision text,
                        p_reason text default null) returns jsonb`
     `p_decision ∈ ('approve','reject')`. Loads the queue row,
     resolves the cert by `source_data->>'certification_id'`. Approve:
     `certifications.verified = true`, `rejected_at = null`,
     `rejected_reason = null`, queue row gets `reviewed_at = now()`,
     `reviewed_by = auth.uid()`, `admin_action = 'approve'`. Reject:
     `certifications.verified = false`, `rejected_at = now()`,
     `rejected_reason = btrim(p_reason)` (required, raises 22023 if
     blank), queue row gets `reviewed_at = now()`, `reviewed_by`,
     `admin_action = 'reject'`. Re-decide on an already-reviewed queue
     row raises `P0002` ("queue row already decided"). Both branches
     write one `admin_audit_log` row inside the same transaction:
     `actor_id=auth.uid()`, `action='admin_cert_decide'`,
     `target_table='certifications'`, `target_id=<cert id>`,
     `patch=jsonb{decision, reason}`, `metadata=jsonb{queue_id,
     supplier_id}`. Returns `{ok:true, queue_id, certification_id,
     decision}`.

3. `revoke all on function … from public; grant execute to authenticated`
   on both RPCs.

## App surfaces

- `app/api/v1/admin/certifications/decide/route.ts` — POST
  `{queue_id, decision, reason?}`; `getServerRole()==='admin'` gate
  (403 otherwise); dispatches `admin_cert_decide`; maps RPC errors to
  400/403/404/409.
- `app/(app)/admin/certifications/page.tsx` — server component,
  `dynamic='force-dynamic'`, filter chips `status ∈ (open|reviewed|all)`
  and `kind` (dropdown of `cert_kind` enum values), paginated 50/page,
  calls `admin_cert_queue_list`. Per-row card shows cert kind + cert
  number + issuer + expires + document link + supplier name/slug +
  uploaded-by email + queue created_at. `<AdminCertDecideButton/>` on
  open rows.
- `components/admin-cert-decide-button.tsx` — client island. Approve
  fires immediately. Reject reveals a required reason input then
  confirms.
- `components/shell/sidebar.tsx` — add `{label:"Certification queue",
  href:"/admin/certifications", Icon: ShieldCheck}` slot. Keep
  existing 6 admin slots; reuse the `ShieldCheck` icon already
  imported (the existing "Scoring" slot uses the same icon — fine,
  the path-based active-state is the only thing that matters).

## Smoke — `ops/_a3_smoke.py`

Mirrors `ops/_a2_smoke.py` harness (psycopg autocommit, `as_user`,
`make_user`, `collect_keys`, recursive FORBIDDEN diff, audit-then-users
cleanup ordering).

Checks:
1. As admin: pick a real published factory, materialise one test cert
   (`kind='other'`, certificate_no=`a3-smoke-<uuid>`, uploaded_by=
   supplier_user, verified=false) and one `cert_doc_review`
   `verification_queue` row carrying `source_data={'certification_id':
   <cert.id>}`.
2. `admin_cert_queue_list(p_status='open')` returns the queue row;
   `total ≥ 1`; cert / supplier / uploaded_by_email shape correct;
   `kind` filter narrows to `'other'`; `p_status='reviewed'` excludes it.
3. `admin_cert_decide(queue_id, 'reject', 'doc unreadable')` →
   `certifications.verified=false`, `rejected_at` set, `rejected_reason`
   set; queue row `reviewed_at` set, `admin_action='reject'`; one
   `admin_audit_log` row written with the right actor + patch +
   metadata. Re-decide raises P0002.
4. Insert a second queue row for the same cert; call
   `admin_cert_decide(.., 'approve')` → `verified=true`, `rejected_at`
   cleared, `rejected_reason` cleared; queue closed; audit row written.
5. Reject with blank reason raises 22023.
6. `admin_cert_decide` with unknown queue_id raises P0002.
7. buyer / supplier / anon raise InsufficientPrivilege on both RPCs
   (6 assertions).
8. Recursive PII / body_ciphertext leak diff over every admin payload
   collected = `[]`. (`uploaded_by_email` is admin-only context, OK by
   spec — same exception pattern as A2's `sbi_total`.)
9. Cleanup ordering: delete admin_audit_log rows first, then queue
   rows, then cert row, then revert any column on suppliers, then
   `auth.users` (FK on delete set null on actor_id but
   `actor_id NOT NULL` → audit must go first).

## Closing

- Update `context/progress-tracker.md`: mark in-progress at spec
  start; on close mark complete, add Spec A3 entry to "Recently
  shipped (Phase 4 — Admin Tools)" with architectural decisions log,
  bump migrations count → 39, route count.
- Commit on `development` branch (Conventional Commits), push, open PR.
