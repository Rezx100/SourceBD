// /app/products/new — "Create a product". First a choice: start by hand (the
// default) or, only when `AI_ENABLED`, from a description; Next is a URL
// (`?start=manual`), and it opens the product form. Nothing is read here.

import { ProductForm } from "@/components/product-form";
import { emptyProduct } from "@/components/product-form-model";
import { StartChoice } from "@/components/dashboard/products";
import { Page, PageHeader } from "@/components/dashboard/page";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Create a product · SourceBD",
};

export default async function NewProductPage({ searchParams }: { searchParams: Promise<{ start?: string | string[] }> }) {
  const sp = await searchParams;
  const ai = process.env.AI_ENABLED === "true";
  // ponytail: "Start with AI" has no drafting endpoint yet, so `?start=ai` opens the same form; wire the draft when V2 lands.
  const started = sp.start === "manual" || (ai && sp.start === "ai");
  return (
    <Page>
      <PageHeader
        title="Create a product"
        caption={started ? "Only the name is required. Add the rest now or later." : "Only you can see your products."}
      />
      {started ? <ProductForm initial={emptyProduct()} /> : <StartChoice ai={ai} />}
    </Page>
  );
}
