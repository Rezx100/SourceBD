// Resend transactional-email wrapper.
//
// Spec S1 — Supplier claim flow — is the first surface that needs to send
// email (verification link). Architecture lists Resend as the email
// provider; this helper centralises the SDK so other specs (Phase 4 buyer
// verification, Phase 5 digests) can reuse the same dev-fallback semantics.
//
// Behaviour:
//   * If `RESEND_API_KEY` is unset (or empty), do NOT send. Log the message
//     server-side and return `{ sent: false, dev: true }`. The caller may
//     surface the URL in the JSON response when `NODE_ENV !== 'production'`
//     so local/dev/preview flows still work without a live key.
//   * If `RESEND_API_KEY` is set, fire `resend.emails.send`. Any provider
//     error is returned as `{ sent: false, error }`; we never throw out of
//     this module — the calling API route decides whether to 5xx.

import "server-only";

import { Resend } from "resend";

export const CLAIM_FROM =
  process.env.RESEND_FROM || "SourceBD <noreply@sourcebd.net>";

export type SendEmailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  from?: string;
  replyTo?: string;
};

export type SendEmailResult =
  | { sent: true; id: string }
  | { sent: false; dev: true; reason: "no_api_key" }
  | { sent: false; dev: false; error: string };

export async function sendTransactionalEmail(
  input: SendEmailInput,
): Promise<SendEmailResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn(
      `[resend] RESEND_API_KEY not set — would have sent "${input.subject}" to ${input.to}`,
    );
    console.warn(`[resend] body:\n${input.text}`);
    return { sent: false, dev: true, reason: "no_api_key" };
  }

  try {
    const resend = new Resend(key);
    const { data, error } = await resend.emails.send({
      from: input.from ?? CLAIM_FROM,
      to: [input.to],
      subject: input.subject,
      text: input.text,
      html: input.html,
      replyTo: input.replyTo,
    });
    if (error || !data) {
      return {
        sent: false,
        dev: false,
        error: error?.message ?? "unknown resend error",
      };
    }
    return { sent: true, id: data.id };
  } catch (err) {
    return {
      sent: false,
      dev: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
