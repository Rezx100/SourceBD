// Spec H4 — Cert-expiry digest job (callable, not an HTTP route).
//
// Run once per day to send each buyer one digest summarising certifications
// on their saved suppliers that expire in the next 30 days. Wiring the
// trigger onto a real cron primitive (Inngest / pg_cron / Coolify cron)
// is a follow-up — keeping this as a plain function means the route count
// stays stable at the H3 baseline (64).
//
// Usage from a future cron handler:
//   import { runCertExpiryDigest } from "@/lib/email/jobs/cert-expiry";
//   const result = await runCertExpiryDigest();

import "server-only";

import { createClient } from "@supabase/supabase-js";

import { sendEmail, EmailError } from "@/lib/email/send";
import type { CertExpiryItem } from "@/lib/email/templates/cert-expiry";

export type CertExpiryRunResult = {
  buyersConsidered: number;
  emailsSent: number;
  emailsFailed: number;
};

type Row = {
  buyer_email: string | null;
  supplier_name: string | null;
  supplier_slug: string | null;
  cert_code: string | null;
  expires_on: string | null;
};

export async function runCertExpiryDigest(): Promise<CertExpiryRunResult> {
  const url =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return { buyersConsidered: 0, emailsSent: 0, emailsFailed: 0 };
  }
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://sourcebd.net";

  const { data, error } = await supabase.rpc("buyer_cert_expiry_digest", {
    p_days: 30,
  });
  if (error) {
    console.warn(`[cert-expiry] rpc failed: ${error.message}`);
    return { buyersConsidered: 0, emailsSent: 0, emailsFailed: 0 };
  }

  const rows = (data ?? []) as Row[];
  const byBuyer = new Map<string, CertExpiryItem[]>();
  for (const r of rows) {
    if (!r.buyer_email || !r.supplier_name || !r.supplier_slug || !r.cert_code || !r.expires_on) {
      continue;
    }
    const list = byBuyer.get(r.buyer_email) ?? [];
    list.push({
      supplierName: r.supplier_name,
      supplierSlug: r.supplier_slug,
      certCode: r.cert_code,
      expiresOn: r.expires_on,
    });
    byBuyer.set(r.buyer_email, list);
  }

  let sent = 0;
  let failed = 0;
  for (const [buyerEmail, items] of byBuyer) {
    try {
      await sendEmail({
        to: buyerEmail,
        template: "cert_expiry",
        data: { appUrl, items },
      });
      sent += 1;
    } catch (err) {
      failed += 1;
      const msg = err instanceof EmailError ? err.message : String(err);
      console.warn(`[cert-expiry] send failed for buyer: ${msg}`);
    }
  }

  return { buyersConsidered: byBuyer.size, emailsSent: sent, emailsFailed: failed };
}
