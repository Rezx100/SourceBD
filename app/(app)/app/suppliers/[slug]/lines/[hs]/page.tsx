// REZ-C (handoff §3.4) — one HS export line of one record, as its own page.
// The same `ProductSheet` the /dev/ds gallery renders; the record's Products
// grid links each tile here.
//
// The photo is the shared illustrative catalogue photo for the 4-digit
// heading, never the supplier's own product, and the caption says so. A
// heading with no photo keeps its place and shows its code.

import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/dashboard/app-shell";
import { ProductSheet } from "@/components/dashboard/product-sheet";
import { SheetFrame } from "@/components/dashboard/sheet";
import { loadBuyerShell } from "@/lib/dashboard/load-buyer-shell";
import { heading4 } from "@/lib/dashboard/hs-photos";
import { ProfileReadTimeout, loadRecordLine } from "@/lib/dashboard/load-record";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ProductLinePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; hs: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug, hs } = await params;
  // Opened from the record's expanded grid (`?lines=all`), Back returns to it.
  const linesRaw = (await searchParams).lines;
  const allLines = (Array.isArray(linesRaw) ? linesRaw[0] : linesRaw) === "all";
  const recordHref = allLines ? `/app/suppliers/${slug}?lines=all` : `/app/suppliers/${slug}`;
  // No `decodeURIComponent` here. Next already decodes dynamic segments, so a
  // second pass threw `URIError` on a segment containing a bare `%`
  // (`/lines/%`) — an unhandled throw inside a server component, which is a 500
  // and never reaches the `notFound()` below.
  //
  // The whole segment must be the heading: `heading4` is `slice(0, 4)`, so
  // testing the sliced value let `/lines/61059` through as HS 6105. Only a
  // 4-digit EPB heading is a line; anything else is a URL somebody typed, and
  // rendering a sheet for it would invent a product line.
  if (!/^\d{4}$/.test(hs)) notFound();
  const code = heading4(hs);

  const supabase = await createSupabaseServerClient();
  let shell: Awaited<ReturnType<typeof loadBuyerShell>>;
  let model: Awaited<ReturnType<typeof loadRecordLine>>;
  try {
    [shell, model] = await Promise.all([
      loadBuyerShell(supabase, `/app/suppliers/${slug}`),
      loadRecordLine(supabase, slug, code, new Date(), { backHref: recordHref }),
    ]);
  } catch (err) {
    // A slow read sends the reader to the record, which has its own retry
    // state — never a 404, which would say the line does not exist.
    if (err instanceof ProfileReadTimeout) redirect(`/app/suppliers/${slug}`);
    throw err;
  }
  if (!model) notFound();

  return (
    <AppShell sidebar={shell.sidebar} topbar={shell.topbar} mainId="main-content" screenLabel="Product line">
      <SheetFrame overlay={false}>
        <ProductSheet model={model} dialog={false} />
      </SheetFrame>
    </AppShell>
  );
}
