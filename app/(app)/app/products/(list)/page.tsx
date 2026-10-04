// /app/products: the buyer's product base on the v4 frame (B7a, Paper `10 · Products`, `· empty`,
// `· loading and error`, `11 · Products`). A table of Product, Target price, MOQ, Status and
// Updated with a menu per row (Open, Send an RFQ, Archive or Restore, Delete); `?status=` picks
// the tab and `?saved=` says which product the form just saved. Reads `buyer_product_list()` under
// the buyer's session once, unfiltered, so every tab counts every row.
//
// A failed read is an error where the list was: "Keep your products here" is a claim about the
// account that a failed read cannot make. Paper's HS code and RFQs columns are not here: the list
// returns neither, so the category stands where the HS code would.
//
// In the `(list)` route group so its `loading.tsx` wraps this list only: the edit page (`../[id]`)
// answers an unknown id with a real 404, which a Suspense boundary above it would turn into a
// streamed 200.

import { ProductActionsProvider } from "@/components/products/actions";
import { ProductsEmpty, ProductsError, ProductsHead, ProductsTabEmpty, PhoneProductsHead } from "@/components/products/list";
import { loadProducts } from "@/components/products/load";
import { SavedNote } from "@/components/products/saved-note";
import { ProductPhoneList, ProductTable } from "@/components/products/table";
import { filterRows, parseTab, tabHref, type ProductStatus } from "@/components/products/words";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata = { title: "Products · SourceBD" };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ status?: string | string[]; saved?: string | string[] }> }) {
  const sp = await searchParams;
  const tab = parseTab(sp.status);
  const supabase = await createSupabaseServerClient();
  const rows = await loadProducts(supabase);
  const saved = typeof sp.saved === "string" && UUID_RE.test(sp.saved) ? sp.saved : null;
  const shown = rows ? filterRows(rows, tab) : [];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ProductsHead rows={rows} tab={tab} />
      <PhoneProductsHead rows={rows} tab={tab} />
      {rows === null ? (
        <ProductsError retryHref={tabHref(tab)} />
      ) : rows.length === 0 ? (
        <ProductsEmpty />
      ) : shown.length === 0 ? (
        <ProductsTabEmpty tab={tab as ProductStatus} />
      ) : (
        <ProductActionsProvider>
          <div className="max-md:hidden">
            <ProductTable rows={shown} />
          </div>
          <ProductPhoneList rows={shown} />
        </ProductActionsProvider>
      )}
      {saved ? <SavedNote id={saved} /> : null}
    </div>
  );
}
