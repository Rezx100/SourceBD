// The suppliers the RFQ templates preview can be written to: the buyer's twelve most recently saved, by
// name, newest first (the first is the one the preview starts with), or none when nothing is saved or the
// read failed (the preview then says "Supplier name"). A plain read of `buyer_saved_list`; nothing here
// is shown as an error, because the preview is not the page.

import { displayName } from "@/lib/dashboard/facts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the Supabase server client, as the other loaders take it.
type Client = any;

export const PREVIEW_SUPPLIERS = 12;

export async function loadPreviewSuppliers(supabase: Client): Promise<string[]> {
  try {
    const { data, error } = await supabase.rpc("buyer_saved_list", { p_sort: "recent", p_limit: PREVIEW_SUPPLIERS, p_offset: 0 });
    if (error || !Array.isArray(data)) return [];
    return data.flatMap((r: { company_name?: unknown }) => (typeof r?.company_name === "string" && r.company_name.trim() ? [displayName(r.company_name)] : []));
  } catch {
    return [];
  }
}
