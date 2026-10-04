// What every Settings page reads: `settings_get()` under the buyer's session. A failed read is null,
// never an empty document: a form drawn over defaults would let a save blank the company, the name or
// the preferences the buyer never had a chance to see.

import type { SettingsDoc } from "./doc";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the Supabase server client, as the other loaders take it.
type Client = any;

export async function loadSettings(supabase: Client): Promise<SettingsDoc | null> {
  try {
    const { data, error } = await supabase.rpc("settings_get");
    if (error || !data || typeof data !== "object") return null;
    return data as SettingsDoc;
  } catch {
    return null;
  }
}
