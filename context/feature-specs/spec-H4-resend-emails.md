# Spec H4 — Resend transactional email templates

> Phase 6 hardening spec #4. Follows H1 (Sentry + PostHog), H2 (rate limiting),
> H3 (Stripe webhook hardening). One spec = one PR on `development`.

## Scope

Ship the five transactional emails listed in `context/phases.md` §H4:

1. **welcome** — sent after a successful signup
2. **rfq_received** — sent to a claimed-supplier owner when a buyer creates
   an RFQ that targets that supplier
3. **cert_expiry** — nightly digest to a buyer summarising certifications on
   their saved suppliers that expire in the next 30 days
4. **sanction_alert** — sent to every buyer who has saved a supplier whose
   queued sanctions hit was just **confirmed** by an admin
5. **password_reset** — handled by Supabase Auth's built-in flow; the
   `password-reset.tsx` template in this spec is the source of truth for the
   HTML body to paste into the Supabase Auth dashboard email-template editor
   (variables `{{ .ConfirmationURL }}` and `{{ .Email }}`)

All five run through one shared sender (`lib/email/send.ts`), rate-limited per
recipient via the H2 `rl_check` RPC (bucket `email:<template>`, 10/min), and
every attempt is journaled in `public.email_log` for audit + de-dup discovery.

## Out of scope

- **Inngest cron wiring.** Inngest is not yet installed (no row in
  `architecture.md` says "ship Inngest in H4"). The cert-expiry digest ships
  as a standalone callable function in `lib/email/jobs/cert-expiry.ts` so a
  future spec can mount it on whichever cron primitive lands first (Inngest,
  `pg_cron`, Coolify cron). The function is not exported through an HTTP
  route — keeping the route count stable at the H3 baseline (64) is a smoke
  invariant.
- **Plan-tier suppression.** The H4 sender does not branch on `plan_tier`;
  notification opt-outs live on `buyer_settings.notify_*` (B10) and the
  cert-expiry job is the only digest-style mail that respects them.
- **Email-deliverability dashboards.** `email_log.status ∈ {sent, failed}`
  is the audit record; SES/Resend bounce + complaint wiring is a later spec.

## Architectural choices

1. **Resend** is the only sender, per `architecture.md`. SDK already
   installed (`resend@6.12.4` from S1).
2. **React Email** templates render to HTML at send time via
   `@react-email/render`. Two new deps land: `@react-email/components`
   (small, peer-reviewed primitives) and `@react-email/render` (renderer).
   Both are sanctioned under "the spec calls for it"; they are non-runtime
   on every other surface (server-only imports, tree-shaken from the client
   bundle by Next).
3. **`email_log` is RLS-on, zero-policy.** Only the SECURITY DEFINER RPC
   `public.email_log_record(...)`, granted to `service_role` only (NOT
   `anon`, NOT `authenticated`), can write to it. The sender uses the
   service-role Supabase client (same pattern as the H3 Stripe webhook
   recorder) to call the RPC.
4. **Idempotency** is best-effort: each `sendEmail` call writes one row per
   attempt. `(to_addr, template, ref_id, status)` is the natural dedup key
   but is NOT enforced as `UNIQUE` because retries (`status='failed'` →
   `status='sent'`) are legitimate. Callers that need strict "once-per-event"
   semantics pass a deterministic `ref_id` and check the log themselves.
5. **Rate-limit per recipient.** Bucket name `email:<template>`, identifier
   = lower-cased recipient address, limit = 10 per minute. The same H2 RPC
   used by middleware (`public.rl_check`). Limit chosen high enough that
   legitimate flows (signup + first welcome, RFQ create against 50 targets)
   never trip it but low enough to bound an abuse scenario where a bug
   loops the sender against the same address.
6. **No new routes.** Trigger points are existing server actions / API
   routes / library functions. Route count stays 64 (the smoke asserts).
7. **PII discipline.** The Sentry scrubber's FORBIDDEN list gains
   `/^resend[-_]?api[-_]?key$/i` and `/^to[-_]?addr$/i` so the Resend key
   and recipient address can never reach a Sentry breadcrumb.

## Deliverables

### Schema

`supabase/migrations/0046_email_log.sql`:

```sql
create table if not exists public.email_log (
  id         uuid primary key default gen_random_uuid(),
  to_addr    text not null,
  template   text not null,
  ref_id     text,
  sent_at    timestamptz not null default now(),
  resend_id  text,
  status     text not null check (status in ('sent','failed')),
  error      text
);

create index if not exists idx_email_log_to_template_sent
  on public.email_log (to_addr, template, sent_at desc);
create index if not exists idx_email_log_ref
  on public.email_log (ref_id) where ref_id is not null;

alter table public.email_log enable row level security;
-- No policies. SECURITY DEFINER email_log_record is the only writer.

create or replace function public.email_log_record(
  p_to_addr   text,
  p_template  text,
  p_ref_id    text,
  p_resend_id text,
  p_status    text,
  p_error     text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_status not in ('sent','failed') then
    raise exception 'status must be sent|failed' using errcode = '22023';
  end if;
  insert into public.email_log (to_addr, template, ref_id, resend_id, status, error)
  values (p_to_addr, p_template, p_ref_id, p_resend_id, p_status, p_error)
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.email_log_record(text, text, text, text, text, text) from public;
grant execute on function public.email_log_record(text, text, text, text, text, text)
  to service_role;
```

### Code

- `lib/email/templates/welcome.tsx`
- `lib/email/templates/rfq-received.tsx`
- `lib/email/templates/cert-expiry.tsx`
- `lib/email/templates/sanction-alert.tsx`
- `lib/email/templates/password-reset.tsx`
- `lib/email/templates/index.ts` — exports template registry `{name → {subject, Component}}`
- `lib/email/send.ts` — exports `sendEmail({to, template, data, refId?})`
- `lib/email/jobs/cert-expiry.ts` — `runCertExpiryDigest()` callable job
- `lib/sentry/pii-scrub.ts` — FORBIDDEN list extended
- `app/(auth)/actions.ts` — `signUp` fires welcome on success (best-effort,
  swallows errors so signup never fails because of mail)
- `app/api/v1/rfqs/route.ts` — after a successful `rfq_create`, fan out
  `rfq_received` to each target's claimed-supplier owner (skipped if
  unclaimed; best-effort)
- `app/api/v1/admin/sanctions/decide/route.ts` — when `decision='confirm'`,
  fan out `sanction_alert` to every buyer who has saved the supplier
- `.env.example` — `# --- Email (Spec H4) ---` block

### Smoke

`ops/_h4_smoke.py` (~6 checks): templates exist · sender exists · migration
on disk with RLS + SECURITY DEFINER + service_role-only grant · env keys in
`.env.example` · PII scrubber extended with the two new regexes · route
count unchanged from H3 baseline (64).

## Validation

```
pnpm typecheck && pnpm lint && pnpm build && python ops/_h4_smoke.py
```

Commit: `feat(notify): ship Spec H4 resend email templates` on `development`.
