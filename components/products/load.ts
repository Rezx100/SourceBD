// What the Products list reads: `buyer_product_list()` under the buyer's session, once and
// unfiltered, so every tab counts every row. A failed read is null, never an empty list: "Keep your
// products here" would be a claim about the account that a failed read cannot make. No new RPC.

import type { ProductRow } from "./words";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the Supabase server client, as the other loaders take it.
type Client = any;

export async function loadProducts(supabase: Client): Promise<ProductRow[] | null> {
  try {
    const { data, error } = await supabase.rpc("buyer_product_list");
    if (error || !Array.isArray(data)) return null;
    return data as ProductRow[];
  } catch {
    return null;
  }
}
