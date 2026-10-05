// What every Settings page reads: `settings_get()` under the buyer's session. A failed read is null,
// never an empty document: a form drawn over defaults would let a save blank the company, the name or
// the preferences the buyer never had a chance to see.

import type { SettingsDoc } from "./doc";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the Supabase server client, as the other loaders take it.
type Client = any;

/**
 * Evidence packs this buyer has downloaded since the 1st of the month (UTC, as the times everywhere
 * are), from their own rows of `evidence_pack_downloads` (migration 0114). Null when it could not be
 * counted, a database without 0114 included: no number then, never a "0".
 */
export async function loadPackCount(supabase: Client, now: Date): Promise<number | null> {
  try {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth?.user?.id;
    if (!uid) return null;
    const since = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
    const res = await supabase.from("evidence_pack_downloads").select("id", { count: "exact", head: true }).eq("owner_id", uid).gte("created_at", since);
    return res.error || typeof res.count !== "number" ? null : res.count;
  } catch {
    return null;
  }
}

export async function loadSettings(supabase: Client): Promise<SettingsDoc | null> {
  try {
    const { data, error } = await supabase.rpc("settings_get");
    if (error || !data || typeof data !== "object") return null;
    return data as SettingsDoc;
  } catch {
    return null;
  }
}
