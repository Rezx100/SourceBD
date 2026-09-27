// /app/products/[id] — "Edit product": the product form, prefilled from
// `buyer_product_get(p_id)`, which answers only the owner. An unknown id (or
// one that is not the caller's) is a 404; a failed read says so and is not a
// 404. No `loading.tsx` above this route: a Suspense boundary would stream
// the shell first and turn `notFound()` into a 200.

import { notFound } from "next/navigation";
import { ProductForm } from "@/components/product-form";
import { fromProduct } from "@/components/product-form-model";
import { Button } from "@/components/dashboard/controls";
import { Icon } from "@/components/dashboard/icons";
import { ErrorNote, Page, PageHeader } from "@/components/dashboard/page";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Edit product · SourceBD",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("buyer_product_get", { p_id: id });
  if (error && /not found/i.test(error.message ?? "")) notFound();
  if (error) {
    return (
      <Page>
        <PageHeader title="Edit product" />
        <ErrorNote>This product could not be read just now. Nothing has been lost — try again in a moment.</ErrorNote>
      </Page>
    );
  }
  if (!data || typeof data !== "object") notFound();
  const initial = fromProduct(data);
  return (
    <Page>
      <PageHeader
        title="Edit product"
        caption={initial.name || undefined}
        actions={
          <Button href={`/app/rfqs/new?product=${encodeURIComponent(id)}`} clientNav>
            <Icon name="send" /> Send RFQ
          </Button>
        }
      />
      <ProductForm initial={{ ...initial, id }} />
    </Page>
  );
}
