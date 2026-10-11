// The exports figure on a search row (spec-volza-reveal section 4, item 4; Paper boards E, J1, G):
// line 1 is the figure the list is sorted by, line 2 the shipment count (with the buyers beside it
// where they are not line 1). Only for an entitled reader in the exports view; nobody else gets one.

import { formatUsdShort } from "@/lib/dashboard/facts";
import type { ExportSort } from "@/lib/discover-v32-state";

export type ExportsFigures = { fob_usd: number | null; shipments: number; buyers: number | null };
export type ExportsCell = { key: string; detail: string; shipments: string };

const count = (n: number, one: string) => `${n.toLocaleString("en-GB")} ${n === 1 ? one : `${one}s`}`;

/** US$55,700: an average shipment to three figures, never more precise than the data. */
function avgWords(fob: number, shipments: number): string {
  const avg = fob / shipments;
  const step = avg >= 10_000 ? 100 : avg >= 1_000 ? 10 : 1;
  return `US$${(Math.round(avg / step) * step).toLocaleString("en-GB")} a shipment`;
}

export function exportsCell(f: ExportsFigures, sort: ExportSort | "workers" | "name"): ExportsCell {
  const shipments = count(f.shipments, "shipment");
  const buyers = f.buyers != null ? count(f.buyers, "buyer") : null;
  const value = f.fob_usd != null ? formatUsdShort(f.fob_usd) : null;
  const both = [shipments, buyers].filter(Boolean).join(" · ");
  if (sort === "shipments") return { key: shipments, detail: [buyers, value].filter(Boolean).join(" · ") || shipments, shipments };
  if (sort === "buyers" && buyers) return { key: buyers, detail: shipments, shipments };
  if (sort === "avg_shipment" && f.fob_usd != null && f.shipments > 0) return { key: avgWords(f.fob_usd, f.shipments), detail: shipments, shipments };
  return { key: value ?? shipments, detail: value ? both : buyers ?? shipments, shipments };
}

/** The column's head: what line 1 is. */
export function exportsHead(sort: ExportSort | "workers" | "name"): string {
  return sort === "avg_shipment" ? "Average shipment" : sort === "shipments" ? "Shipments" : sort === "buyers" ? "Buyers" : "Export value";
}
