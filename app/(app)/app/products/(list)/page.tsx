// /app/products — the buyer's own product base (27 Sep 2026). Reads
// `buyer_product_list()` under the caller's session once, unfiltered, so the
// status chips can count every row; `?status=` picks the chip and `?saved=`
// says which product the form just saved. The view is `ProductList`.
//
// In the `(list)` route group so its `loading.tsx` wraps this list only: the
// edit page (`../[id]`) answers an unknown id with a real 404, which a
// Suspense boundary above it would turn into a streamed 200.

import { ProductList, parseProductTab, type ProductRow } from "@/components/dashboard/products";
import { Page } from "@/components/dashboard/page";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Products · SourceBD",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string | string[]; saved?: string | string[] }>;
}) {
  const sp = await searchParams;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("buyer_product_list");
  const rows: ProductRow[] | null = error ? null : ((data as ProductRow[] | null) ?? []);
  const saved = typeof sp.saved === "string" && UUID_RE.test(sp.saved) ? sp.saved : null;
  return (
    <Page>
      <ProductList rows={rows} tab={parseProductTab(sp.status)} savedId={saved} />
    </Page>
  );
}
