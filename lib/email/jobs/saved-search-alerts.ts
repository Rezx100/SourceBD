// Gap 14 — the Monday "new matches" email for saved searches, with the real service-role client and the
// real sender. The logic is in lib/saved-search-alerts.ts; cron reaches this through
// app/api/v1/webhooks/saved-search-alerts/route.ts (ops/saved_search_alerts_cron.sh).

import "server-only";

import { createClient } from "@supabase/supabase-js";

import { sendEmail } from "@/lib/email/send";
import { runSavedSearchAlerts, type AlertRun } from "@/lib/saved-search-alerts";

export async function runSavedSearchAlertsJob(): Promise<AlertRun> {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return { due: 0, baselined: 0, emailed: 0, unchanged: 0, failed: 0, error: "service role is not configured" };
  }
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return runSavedSearchAlerts({
    supabase,
    appUrl: process.env.NEXT_PUBLIC_APP_URL || "https://sourcebd.net",
    send: async (to, data, refId) => {
      try {
        const sent = await sendEmail({ to, template: "saved_search_alert", data, refId });
        return sent.dev !== true;
      } catch (err) {
        console.warn(`[saved-search-alerts] send failed: ${err instanceof Error ? err.message : String(err)}`);
        return false;
      }
    },
  });
}
