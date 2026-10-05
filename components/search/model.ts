// What a result row shows, worked out on the server from the search's row model so the client
// table only draws it. The words of the certificate line are `certLine` (patterns/words.ts).

import { certLine, type CertLine } from "@/components/patterns/words";
import { formatCount } from "@/lib/dashboard/facts";
import type { TableRowModel } from "@/lib/dashboard/models";

export type ResultRow = {
  slug: string;
  supplierId: string | null;
  name: string;
  type: string;
  place: string | null;
  /** The supplier record's own worker figure, with its thousands separator, or null. */
  workers: string | null;
  /** The second figure where it differs from the record's own ("793 RSC"), and its whole words. */
  workersSecond: { short: string; words: string } | null;
  /** Registers and certifiers, the figure the Sources sort orders by. */
  sources: number;
  cert: CertLine | null;
  /** Opens the record in the pane beside the results. */
  paneHref: string;
  /** Opens the record as a page (the phone, and "Open full page"). */
  pageHref: string;
  sanctioned: boolean;
};

export function resultRow(t: TableRowModel, today: Date, pageHref: string): ResultRow {
  return {
    slug: t.slug,
    supplierId: t.supplierId ?? null,
    name: t.name,
    type: t.type,
    place: t.place,
    workers: t.workers == null ? null : (formatCount(t.workers) ?? String(t.workers)),
    workersSecond: t.workersSecondShort ? { short: t.workersSecondShort, words: t.workersSecond ?? t.workersSecondShort } : null,
    sources: t.sourceCount,
    cert: certLine(t.certs, today),
    paneHref: t.recordHref ?? `/app/suppliers/${t.slug}`,
    pageHref,
    sanctioned: t.sanctioned,
  };
}
