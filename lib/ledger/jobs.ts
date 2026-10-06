// The two scheduled jobs of the activity record (moderation plan 1e), as plain functions over a client and
// two callbacks, so they are tested without a network or a database:
//
//   runLedgerSealJob   hourly: copy Auth's log (0132), then seal every finished hour (0135).
//   runLedgerStampJob  daily: seal, then stamp the newest seal with the outside timestamp authority, verify
//                      the whole chain, and email the seal, the verdict and the token to the outside mailbox.
//                      The email goes even when the authority is down: the mailbox then still holds the
//                      day's seal hash, which is the point of a copy outside the company's hands.

import type { Stamp } from "./stamp";

export type JobAnswer = { data: unknown; error: { message: string } | null };
export type JobClient = { rpc(fn: string, args?: Record<string, unknown>): PromiseLike<JobAnswer> };

export type SealRun = {
  copied: number | null;
  copy_error: string | null;
  sealed: number | null;
  sealed_through: string | null;
  latest_seal_id: number | null;
  error: string | null;
};

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const str = (v: unknown): string | null => (typeof v === "string" ? v : null);
const message = (e: unknown): string => (e instanceof Error ? e.message : String(e));

export async function runLedgerSealJob(supabase: JobClient): Promise<SealRun> {
  const run: SealRun = { copied: null, copy_error: null, sealed: null, sealed_through: null, latest_seal_id: null, error: null };
  try {
    const copy = await supabase.rpc("ledger_copy_auth_log", { p_limit: 1000 });
    if (copy.error) run.copy_error = copy.error.message;
    else run.copied = num((copy.data as { copied?: unknown } | null)?.copied);
  } catch (err) {
    run.copy_error = message(err);
  }
  try {
    const seal = await supabase.rpc("ledger_seal", {});
    if (seal.error) {
      run.error = seal.error.message;
      return run;
    }
    const d = (seal.data ?? {}) as { sealed?: unknown; sealed_through?: unknown; latest_seal_id?: unknown };
    run.sealed = num(d.sealed);
    run.sealed_through = str(d.sealed_through);
    run.latest_seal_id = num(d.latest_seal_id);
  } catch (err) {
    run.error = message(err);
  }
  return run;
}

export type LatestSeal = {
  id: number;
  period_start: string;
  period_end: string;
  entry_count: number;
  seal_hash: string;
  stamped: boolean;
  tsa_url: string | null;
  tsa_time: string | null;
  mailed: boolean;
};

export type Verdict = { ok: boolean; seals_checked: number; first_broken_seal: number | null; why: string | null; unsealed_entries: number };

export type StampMail = {
  seal: LatestSeal;
  stamp: { tsaUrl: string; tsaTime: string | null } | null;
  stampError: string | null;
  verdict: Verdict | null;
  attachment: { filename: string; content: Buffer } | null;
};

export type StampRun = {
  seal: SealRun;
  latest: LatestSeal | null;
  stamped: boolean;
  stamp_error: string | null;
  verdict: Verdict | null;
  mailed: boolean;
  mail_error: string | null;
  error: string | null;
};

export async function runLedgerStampJob(
  supabase: JobClient,
  opts: {
    tsaUrl: string;
    mailbox: string | null;
    stamp: (sha256Hex: string, tsaUrl: string) => Promise<Stamp>;
    send: (to: string, mail: StampMail) => Promise<boolean>;
  },
): Promise<StampRun> {
  const run: StampRun = { seal: await runLedgerSealJob(supabase), latest: null, stamped: false, stamp_error: null, verdict: null, mailed: false, mail_error: null, error: null };

  // The newest seal, which chains every seal before it.
  const latestAnswer = await supabase.rpc("ledger_latest_seal", {});
  if (latestAnswer.error) {
    run.error = latestAnswer.error.message;
    return run;
  }
  const latest = latestAnswer.data as LatestSeal | null;
  if (!latest) {
    run.error = "no seal yet";
    return run;
  }
  run.latest = latest;

  // Stamp it, unless it is stamped already.
  let token: Buffer | null = null;
  if (latest.stamped) {
    run.stamped = true;
  } else {
    try {
      const got = await opts.stamp(latest.seal_hash, opts.tsaUrl);
      const stored = await supabase.rpc("ledger_seal_stamp", {
        p_seal_id: latest.id,
        p_tsa_url: got.tsaUrl,
        p_token: "\\x" + got.token.toString("hex"),
        p_tsa_time: (got.genTime ?? new Date()).toISOString(),
      });
      if (stored.error) run.stamp_error = stored.error.message;
      else {
        run.stamped = stored.data === true;
        token = got.token;
        latest.stamped = run.stamped;
        latest.tsa_url = got.tsaUrl;
        latest.tsa_time = (got.genTime ?? new Date()).toISOString();
      }
    } catch (err) {
      run.stamp_error = message(err);
    }
  }

  // The whole chain, checked.
  try {
    const v = await supabase.rpc("ledger_verify", {});
    if (!v.error && v.data && typeof v.data === "object") run.verdict = v.data as Verdict;
  } catch {
    run.verdict = null;
  }

  // The copy outside the company's hands.
  if (opts.mailbox) {
    try {
      const sent = await opts.send(opts.mailbox, {
        seal: latest,
        stamp: latest.stamped ? { tsaUrl: latest.tsa_url ?? opts.tsaUrl, tsaTime: latest.tsa_time } : null,
        stampError: run.stamp_error,
        verdict: run.verdict,
        attachment: token ? { filename: `sourcebd-seal-${latest.id}.tsr`, content: token } : null,
      });
      run.mailed = sent;
      if (sent && token) {
        await supabase.rpc("ledger_seal_mailed", { p_seal_id: latest.id, p_mailbox: opts.mailbox });
      }
    } catch (err) {
      run.mail_error = message(err);
    }
  } else {
    run.mail_error = "LEDGER_STAMP_MAILBOX is not set";
  }
  return run;
}
