// Spec H4 — Sanction alert fan-out.
//
// Resolves saved-supplier owner emails via the service-role
// `email_sanction_recipients` RPC and sends one sanction_alert per
// recipient. Used by the admin sanctions decide route after a confirm.

import "server-only";

import { createClient } from "@supabase/supabase-js";

import { sendEmail, EmailError } from "@/lib/email/send";

export type NotifySanctionConfirmedInput = {
  supplierId: string;
  supplierName: string;
  supplierSlug: string;
  listName: string;
  reason: string;
};

export async function notifySanctionConfirmed(
  input: NotifySanctionConfirmedInput,
): Promise<void> {
  const url =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://sourcebd.com";

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.rpc("email_sanction_recipients", {
    p_supplier_id: input.supplierId,
  });
  if (error) {
    console.warn(`[sanction-alert] recipients rpc failed: ${error.message}`);
    return;
  }
  const rows = (data ?? []) as Array<{ email: string }>;
  for (const row of rows) {
    try {
      await sendEmail({
        to: row.email,
        template: "sanction_alert",
        data: {
          appUrl,
          supplierName: input.supplierName,
          supplierSlug: input.supplierSlug,
          listName: input.listName,
          reason: input.reason,
        },
        refId: `sanction:${input.supplierId}:${row.email}`,
      });
    } catch (err) {
      const msg = err instanceof EmailError ? err.message : String(err);
      console.warn(`[sanction-alert] send failed: ${msg}`);
    }
  }
}
