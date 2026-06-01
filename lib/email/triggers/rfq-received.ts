// Spec H4 — RFQ received fan-out.
//
// Resolves claimed-supplier owner emails via the service-role
// `email_rfq_recipients` RPC and sends one rfq_received per recipient.
// Unclaimed suppliers are silently skipped. Mail failures are logged and
// swallowed — the RFQ create response must never be blocked on email.

import "server-only";

import { createClient } from "@supabase/supabase-js";

import { sendEmail, EmailError } from "@/lib/email/send";

export type NotifyRfqTargetsInput = {
  rfqId: string;
  productTitle: string;
  quantity: number;
  quantityUnit: string;
  shipBy: string | null;
  targetSupplierIds: ReadonlyArray<string>;
};

export async function notifyRfqTargets(
  input: NotifyRfqTargetsInput,
): Promise<void> {
  const url =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://sourcebd.com";

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.rpc("email_rfq_recipients", {
    p_supplier_ids: input.targetSupplierIds,
  });
  if (error) {
    console.warn(`[rfq-received] recipients rpc failed: ${error.message}`);
    return;
  }
  const rows = (data ?? []) as Array<{ supplier_id: string; email: string }>;
  for (const row of rows) {
    try {
      await sendEmail({
        to: row.email,
        template: "rfq_received",
        data: {
          appUrl,
          rfqId: input.rfqId,
          productTitle: input.productTitle,
          quantity: input.quantity,
          quantityUnit: input.quantityUnit,
          shipBy: input.shipBy,
        },
        refId: `rfq:${input.rfqId}:${row.supplier_id}`,
      });
    } catch (err) {
      const msg = err instanceof EmailError ? err.message : String(err);
      console.warn(`[rfq-received] send failed: ${msg}`);
    }
  }
}
