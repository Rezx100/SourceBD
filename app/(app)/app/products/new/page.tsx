// /app/products/new on the v4 frame (B7a-2, Paper `10 · Product editor · New product`): the editor, empty,
// straight away. Only the name is required; the other sections are "Add" until the buyer opens them.
// Nothing is read here. The old "How do you want to start?" step is gone: its only other choice, a draft
// from a description, has no endpoint behind it, and Paper's board opens on the form.

import { ProductForm } from "@/components/products/form";
import { emptyProduct } from "@/components/product-form-model";

export const dynamic = "force-dynamic";

export const metadata = { title: "New product · SourceBD" };

export default function NewProductPage() {
  return <ProductForm initial={emptyProduct()} />;
}
