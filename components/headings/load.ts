// What HS codes reads: `hs_catalogue()` once, through `fetchHsCatalogue`. A failed read is null, never
// an empty catalogue: "No HS codes" would be a claim a failed read cannot make. The words after the code
// are the buyer's label, else the catalogue's own heading, else nothing (`hsBuyerLabel` falls back to
// "HS 6302", which printed after the code read "6302 HS 6302").

import { hsCatalogueRow, heading4 } from "@/lib/dashboard/hs-photos";
import { fetchHsCatalogue } from "@/lib/discover-v32-rpc";
import { hsBuyerLabel } from "@/lib/epb-hscode-labels";
import type { Heading } from "./words";

type Client = Parameters<typeof fetchHsCatalogue>[0];

export function headingLabel(hs: string, live: string | null): string | null {
  const label = hsBuyerLabel(hs, live);
  if (label !== `HS ${hs}`) return label;
  return hsCatalogueRow(hs)?.heading ?? null;
}

export async function loadHeadings(supabase: Client): Promise<Heading[] | null> {
  try {
    const live = await fetchHsCatalogue(supabase);
    if (live.error) return null;
    return live.rows.map((r) => ({ hs: heading4(r.hs), label: headingLabel(heading4(r.hs), r.heading), exporters: r.exporter_count }));
  } catch {
    return null;
  }
}
