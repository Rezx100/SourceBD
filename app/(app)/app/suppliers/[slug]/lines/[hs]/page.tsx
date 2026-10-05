// REZ-C (handoff §3.4) — one HS export line of one record, as its own page.
// The same `LineView` the search draws beside its results; the record's Products
// list links each line here.
//
// The photo is the shared illustrative catalogue photo for the 4-digit
// heading, never the supplier's own product, and the caption says so. A
// heading with no photo keeps its place and shows its code.

import { notFound, redirect } from "next/navigation";

import { LineView } from "@/components/record";
import { heading4 } from "@/lib/dashboard/hs-photos";
import { LinesUnreadable, ProfileReadTimeout, loadRecordLine } from "@/lib/dashboard/load-record";
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
  // A line is opened from the record's Products tab; opened from its expanded list
  // (`?lines=all`), Back returns to that list.
  const linesRaw = (await searchParams).lines;
  const allLines = (Array.isArray(linesRaw) ? linesRaw[0] : linesRaw) === "all";
  const recordHref = `/app/suppliers/${slug}?tab=products${allLines ? "&lines=all" : ""}`;
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
  let model: Awaited<ReturnType<typeof loadRecordLine>>;
  try {
    model = await loadRecordLine(supabase, slug, code, new Date(), { backHref: recordHref });
  } catch (err) {
    // A slow read sends the reader to the record, which has its own retry
    // state — never a 404, which would say the line does not exist.
    if (err instanceof ProfileReadTimeout) redirect(recordHref);
    // The lines could not be read and the heading is not in the catalogue:
    // the record says the lines could not be read; a sheet here would invent one.
    if (err instanceof LinesUnreadable) redirect(recordHref);
    throw err;
  }
  if (!model) notFound();

  return <LineView model={model} mode="page" />;
}
