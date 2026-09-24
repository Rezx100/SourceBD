// REZ-C (handoff §3.4) — one HS export line of one record, as its own page.
// The same `ProductSheet` the /dev/ds gallery renders; the record's Products
// grid links each tile here.
//
// The photo is the shared illustrative catalogue photo for the 4-digit
// heading, never the supplier's own product, and the caption says so. A
// heading with no photo keeps its place and shows its code.

import { notFound } from "next/navigation";

import { AppShell } from "@/components/dashboard/app-shell";
import { ProductSheet } from "@/components/dashboard/product-sheet";
import { SheetFrame } from "@/components/dashboard/sheet";
import { loadBuyerShell } from "@/lib/dashboard/load-buyer-shell";
import { heading4 } from "@/lib/dashboard/hs-photos";
import { loadRecordLine } from "@/lib/dashboard/load-record";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ProductLinePage({ params }: { params: Promise<{ slug: string; hs: string }> }) {
  const { slug, hs } = await params;
  const code = heading4(decodeURIComponent(hs));
  // Only a 4-digit EPB heading is a line. Anything else is a URL somebody
  // typed, and rendering a sheet for it would invent a product line.
  if (!/^\d{4}$/.test(code)) notFound();

  const supabase = await createSupabaseServerClient();
  const [shell, model] = await Promise.all([
    loadBuyerShell(supabase, `/app/suppliers/${slug}`),
    loadRecordLine(supabase, slug, code, new Date()),
  ]);
  if (!model) notFound();

  return (
    <AppShell sidebar={shell.sidebar} topbar={shell.topbar} mainId="main-content" screenLabel="Product line">
      <SheetFrame overlay={false}>
        <ProductSheet model={model} dialog={false} />
      </SheetFrame>
    </AppShell>
  );
}
