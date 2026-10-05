// /app/products/[id] on the v4 frame (B7a-2, Paper `10 · Product editor`): the editor, prefilled from
// `buyer_product_get(p_id)`, which answers only the owner. An unknown id (or one that is not the
// caller's) is a 404; a failed read says so and is not a 404. No `loading.tsx` above this route: a
// Suspense boundary would stream the shell first and turn `notFound()` into a 200. On a phone a saved
// product opens as a read-only view (`ProductView`); `?edit=full` is the whole editor.

import Link from "next/link";
import { notFound } from "next/navigation";
import { ErrorPanel, buttonClass } from "@/components/kit";
import { ProductForm } from "@/components/products/form";
import { ProductView } from "@/components/products/view";
import { fromProduct } from "@/components/product-form-model";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata = { title: "Product · SourceBD" };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function EditProductPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams?: Promise<{ edit?: string | string[] }> }) {
  const { id } = await params;
  const full = (await searchParams)?.edit === "full";
  if (!UUID_RE.test(id)) notFound();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("buyer_product_get", { p_id: id });
  if (error && /not found/i.test(error.message ?? "")) notFound();
  if (error) {
    return (
      <div className="flex flex-col gap-4 px-8 py-7 max-md:px-4">
        <h1 className="text-xl font-semibold tracking-tight text-ink">Product</h1>
        <ErrorPanel
          title="We couldn't load this product."
          retry={
            <Link href={`/app/products/${id}`} prefetch={false} className={buttonClass({ kind: "primary", className: "max-md:h-input-touch" })}>
              Try again
            </Link>
          }
        >
          This product could not be read just now. Nothing has been lost — try again in a moment.
        </ErrorPanel>
      </div>
    );
  }
  if (!data || typeof data !== "object") notFound();
  const updated = (data as { updated_at?: unknown }).updated_at;
  const initial = { ...fromProduct(data), id };
  const updatedAt = typeof updated === "string" ? updated : null;
  // From 768 the editor is the page. On a phone a saved product opens read-only, with a sheet for the
  // simple fields (gap row 20); `?edit=full` is the way to the whole editor from there.
  if (full) return <ProductForm initial={initial} updatedAt={updatedAt} />;
  return (
    <>
      <ProductView initial={initial} updatedAt={updatedAt} />
      <div className="flex min-h-0 flex-1 flex-col max-md:hidden">
        {/* Keyed by the save time: a save from the phone's sheet remounts it, so a widened window never holds the old values. */}
        <ProductForm key={updatedAt ?? "unsaved"} initial={initial} updatedAt={updatedAt} />
      </div>
    </>
  );
}
