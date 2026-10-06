// The record's jobs with the real service-role client, the real authority and the real sender (moderation
// plan 1e). The logic is in lib/ledger/jobs.ts; cron reaches these through the two webhook routes
// (ops/ledger_cron.sh).

import "server-only";

import { createClient } from "@supabase/supabase-js";

import { EmailError, sendEmail } from "@/lib/email/send";

import { runLedgerSealJob, runLedgerStampJob, type SealRun, type StampRun } from "./jobs";
import { DEFAULT_TSA_URL, requestTimestamp } from "./stamp";

function serviceClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function runHourlySeal(): Promise<SealRun> {
  const supabase = serviceClient();
  if (!supabase) return { copied: null, copy_error: null, sealed: null, sealed_through: null, latest_seal_id: null, error: "service role is not configured" };
  return runLedgerSealJob(supabase);
}

export async function runDailyStamp(): Promise<StampRun> {
  const supabase = serviceClient();
  if (!supabase) {
    return {
      seal: { copied: null, copy_error: null, sealed: null, sealed_through: null, latest_seal_id: null, error: "service role is not configured" },
      latest: null, stamped: false, stamp_error: null, verdict: null, mailed: false, mail_error: null, error: "service role is not configured",
    };
  }
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://sourcebd.net";
  return runLedgerStampJob(supabase, {
    tsaUrl: process.env.LEDGER_TSA_URL || DEFAULT_TSA_URL,
    mailbox: process.env.LEDGER_STAMP_MAILBOX?.trim() || null,
    stamp: (sha256Hex, tsaUrl) => requestTimestamp({ tsaUrl, sha256Hex }),
    send: async (to, mail) => {
      try {
        const sent = await sendEmail({
          to,
          template: "ledger_stamp",
          data: {
            sealId: mail.seal.id,
            sealHash: mail.seal.seal_hash,
            periodStart: mail.seal.period_start,
            periodEnd: mail.seal.period_end,
            entryCount: mail.seal.entry_count,
            tsaUrl: mail.stamp?.tsaUrl ?? null,
            tsaTime: mail.stamp?.tsaTime ?? null,
            stampError: mail.stampError,
            verifyOk: mail.verdict?.ok ?? null,
            verifyWhy: mail.verdict?.why ?? null,
            sealsChecked: mail.verdict?.seals_checked ?? null,
            appUrl,
          },
          refId: `seal:${mail.seal.id}`,
          attachments: mail.attachment ? [mail.attachment] : undefined,
        });
        return sent.dev !== true;
      } catch (err) {
        console.warn(`[ledger-stamp] mail failed: ${err instanceof EmailError ? err.message : String(err)}`);
        return false;
      }
    },
  });
}
