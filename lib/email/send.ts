// Spec H4 — Shared transactional email sender.
//
// One entry point: sendEmail({to, template, data, refId?}). Renders the
// React Email component to HTML + plain text, rate-limits per recipient
// via the H2 `rl_check` RPC (bucket `email:<template>`, 10/min, ident =
// lower-cased recipient), posts through Resend, journals every attempt to
// `public.email_log` via the SECURITY DEFINER `email_log_record` RPC.
//
// Failure modes:
//   * Rate-limited → throws { code: 'rate_limited', retryAfter }
//   * Missing API key → returns { id: 'dev:<random>', dev: true } and
//     writes a `failed` row with error='no_api_key' (no network call).
//   * Resend error → throws { code: 'send_failed', message }, after
//     writing a `failed` row.
//
// All callers should treat failures as best-effort: log and continue.
// Email failure must never break the surrounding action (signup, RFQ
// create, sanctions decide).

import "server-only";

import { render } from "@react-email/render";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Resend } from "resend";

import { rlCheck } from "@/lib/rate-limit/check";

import { TEMPLATES, type TemplateMap, type TemplateName } from "./templates";

export type SendEmailInput<K extends TemplateName> = {
  to: string;
  template: K;
  data: TemplateMap[K];
  refId?: string | null;
};

export type SendEmailResult =
  | { id: string; dev?: false }
  | { id: string; dev: true };

export class EmailError extends Error {
  readonly code: "rate_limited" | "send_failed";
  readonly retryAfter?: number;
  constructor(
    code: "rate_limited" | "send_failed",
    message: string,
    retryAfter?: number,
  ) {
    super(message);
    this.code = code;
    this.retryAfter = retryAfter;
  }
}

const DEFAULT_FROM =
  process.env.RESEND_FROM || "SourceBD <noreply@sourcebd.com>";
const LIMIT_PER_MIN = 10;

function serviceRoleClient(): SupabaseClient | null {
  const url =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function recordAttempt(
  supabase: SupabaseClient | null,
  to: string,
  template: string,
  refId: string | null,
  resendId: string | null,
  status: "sent" | "failed",
  errorMsg: string | null,
): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.rpc("email_log_record", {
    p_to_addr: to,
    p_template: template,
    p_ref_id: refId,
    p_resend_id: resendId,
    p_status: status,
    p_error: errorMsg,
  });
  if (error) {
    console.warn(`[email] email_log_record failed: ${error.message}`);
  }
}

export async function sendEmail<K extends TemplateName>(
  input: SendEmailInput<K>,
): Promise<SendEmailResult> {
  const to = input.to.trim().toLowerCase();
  if (!to || !to.includes("@")) {
    throw new EmailError("send_failed", "invalid recipient");
  }
  const entry = TEMPLATES[input.template];
  const refId = input.refId ?? null;
  const supabase = serviceRoleClient();

  // Rate limit (fails open on RPC error per H2).
  if (supabase) {
    const rl = await rlCheck(
      supabase,
      `email:${input.template}`,
      to,
      LIMIT_PER_MIN,
    );
    if (!rl.ok) {
      await recordAttempt(
        supabase,
        to,
        input.template,
        refId,
        null,
        "failed",
        "rate_limited",
      );
      throw new EmailError(
        "rate_limited",
        "email rate limit exceeded",
        rl.retryAfter,
      );
    }
  }

  const element = entry.render(input.data);
  const subject = entry.subject(input.data);
  const html = await render(element);
  const text = await render(element, { plainText: true });

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    const devId = `dev:${Math.random().toString(36).slice(2, 10)}`;
    console.warn(
      `[email] RESEND_API_KEY not set — would have sent template=${input.template} subject="${subject}"`,
    );
    await recordAttempt(
      supabase,
      to,
      input.template,
      refId,
      devId,
      "failed",
      "no_api_key",
    );
    return { id: devId, dev: true };
  }

  try {
    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.send({
      from: DEFAULT_FROM,
      to: [to],
      subject,
      html,
      text,
    });
    if (error || !data) {
      const msg = error?.message ?? "unknown resend error";
      await recordAttempt(
        supabase,
        to,
        input.template,
        refId,
        null,
        "failed",
        msg,
      );
      throw new EmailError("send_failed", msg);
    }
    await recordAttempt(
      supabase,
      to,
      input.template,
      refId,
      data.id,
      "sent",
      null,
    );
    return { id: data.id };
  } catch (err) {
    if (err instanceof EmailError) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    await recordAttempt(
      supabase,
      to,
      input.template,
      refId,
      null,
      "failed",
      msg,
    );
    throw new EmailError("send_failed", msg);
  }
}
