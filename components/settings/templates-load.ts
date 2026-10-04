// The one supplier the RFQ templates preview is written to: the one saved most recently, by name, or
// null when none is saved or the read failed (the preview then says "Supplier name"). A plain read of
// `buyer_saved_list`, one row; nothing here is shown as an error, because the preview is not the page.

import { displayName } from "@/lib/dashboard/facts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the Supabase server client, as the other loaders take it.
type Client = any;

export async function loadPreviewSupplier(supabase: Client): Promise<string | null> {
  try {
    const { data, error } = await supabase.rpc("buyer_saved_list", { p_sort: "recent", p_limit: 1, p_offset: 0 });
    const first = !error && Array.isArray(data) ? (data[0] as { company_name?: unknown } | undefined) : undefined;
    return typeof first?.company_name === "string" && first.company_name.trim() ? displayName(first.company_name) : null;
  } catch {
    return null;
  }
}
