// What the Compliance pages read: the same four RPCs as before (`compliance_expired_certs`,
// `compliance_expiring_certs(90)`, `compliance_uflpa_tracker`, `compliance_msa_inputs`), each on its own
// so one that failed cannot hide another that worked: a failed read is `null`, and nothing here turns
// null into 0 ("nothing needs attention" is a claim an unread list cannot make). The phone's ledgers
// also read `sanctions_lists_read()` (0120, the record's own read dates). No new RPC, policy or migration.

import type { CertList, ListRead, MsaSummary, UflpaPayload } from "./words";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the Supabase server client, as the other loaders take it.
type Client = any;

async function read<T>(supabase: Client, fn: string, args: Record<string, unknown> | undefined, ok: (d: unknown) => d is T): Promise<T | null> {
  try {
    const r = await supabase.rpc(fn, args);
    return r.error || !ok(r.data) ? null : r.data;
  } catch {
    return null;
  }
}

const isObject = (d: unknown): d is Record<string, unknown> => Boolean(d) && typeof d === "object" && !Array.isArray(d);
const certList = (d: unknown): d is CertList => isObject(d) && Array.isArray(d.rows) && typeof d.total === "number";
const uflpa = (d: unknown): d is UflpaPayload => isObject(d) && Array.isArray(d.rows) && typeof d.total === "number" && typeof d.hits === "number" && typeof d.flags === "number" && typeof d.clear === "number";
const msa = (d: unknown): d is MsaSummary => isObject(d) && typeof d.total_saved === "number";
const lists = (d: unknown): d is ListRead[] => Array.isArray(d) && d.every((r) => isObject(r) && typeof r.list === "string");

export type ComplianceData = {
  expired: CertList | null;
  expiring: CertList | null;
  uflpa: UflpaPayload | null;
  msa: MsaSummary | null;
  /** `sanctions_lists_read()` (0120): when each list was last read in full. */
  lists: ListRead[] | null;
};

export type Wants = { certs?: boolean; uflpa?: boolean; msa?: boolean; lists?: boolean };

/** Only the reads a page draws, in one wave. */
export async function loadCompliance(supabase: Client, wants: Wants): Promise<ComplianceData> {
  const [expired, expiring, u, m, l] = await Promise.all([
    wants.certs ? read(supabase, "compliance_expired_certs", undefined, certList) : null,
    wants.certs ? read(supabase, "compliance_expiring_certs", { p_window_days: 90 }, certList) : null,
    wants.uflpa ? read(supabase, "compliance_uflpa_tracker", undefined, uflpa) : null,
    wants.msa ? read(supabase, "compliance_msa_inputs", undefined, msa) : null,
    wants.lists ? read(supabase, "sanctions_lists_read", {}, lists) : null,
  ]);
  return { expired, expiring, uflpa: u, msa: m, lists: l };
}
