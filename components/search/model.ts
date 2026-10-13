// What a result row shows, worked out on the server from the search's row model so the client
// table only draws it. The words of the certificate line are `certLine` (patterns/words.ts).

import { certLine, certSummary, type CertBody, type CertLine, type CertSummary } from "@/components/patterns/words";
import type { ExportsCell } from "@/lib/dashboard/customs-search";
import { formatCount, formatUsdShort } from "@/lib/dashboard/facts";
import type { TableRowModel } from "@/lib/dashboard/models";

/**
 * A row's customs figures on a plain search (Paper page 37): the two-year export value and the markets it
 * ships to, biggest share first, for a reader the database entitles; `"locked"` where a record is on file
 * that the reader's plan does not include (no figure and no market reaches them); null where the read
 * found none on file. A row that was never read carries no `exported` at all, and says only that.
 */
export type Exported = { value: string | null; to: string[] } | "locked" | null;

/**
 * A row's customs cell from what `discover_export_cells` answered for the page (0147). `cells` null: the
 * read failed or the function is not there, so the row claims nothing. No entry: none on file. An entry
 * with no figure and no market for a reader the database does not entitle: locked.
 */
export function exportedOf(cells: ReadonlyMap<string, { fob_usd: number | null; markets: string[] | null }> | null, id: string, entitled: boolean): Exported | undefined {
  if (!cells) return undefined;
  const cell = cells.get(id);
  if (!cell) return null;
  if (!entitled) return "locked";
  const to = cell.markets ?? [];
  // A record with neither a value nor a market split has nothing to put in the cell.
  return cell.fob_usd === null && to.length === 0 ? null : { value: cell.fob_usd !== null ? formatUsdShort(cell.fob_usd) : null, to };
}

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
  /** The one figure the record itself shows, which a phone's row says (founder, 13 Oct 2026: Square Apparels reads 4,624 on both). */
  workersRecord?: string | null;
  /** Registers and certifiers, the figure the Sources sort orders by. */
  sources: number;
  cert: CertLine | null;
  /** The same certificates as the phone row's line of words: the bodies and the worst one's state. */
  certCell: CertSummary | null;
  /** Opens the record in the pane beside the results. */
  paneHref: string;
  /** Opens the record as a page (the phone, and "Open full page"). */
  pageHref: string;
  /** Opens the composer in the pane beside this list with the supplier as its target; null for a sanctioned one. */
  rfqHref: string | null;
  sanctioned: boolean;
  /** On the reader's saved list: the phone row's bookmark starts filled. */
  saved: boolean;
  /** The customs figures, in the exports view only (an entitled reader): the figure the list is sorted by. */
  exports?: ExportsCell | null;
  /** What it makes, the search's matches first: two names and how many more. Null when it filed none. */
  products?: { shown: string[]; more: number } | null;
  /** The brands whose own supplier lists name it. */
  brands?: string[];
  /** The bodies of the certificates it holds today, one each: one that has ended is left out, like one never held. */
  held?: CertBody[];
  exported?: Exported;
};

/**
 * Two of the product names it filed, those that answer the search first, and how many more there are.
 * A name answers by holding a word that starts with one of the search's ("denim shirt" finds "Denim
 * shirts" before "Polo shirts" before "Trousers"; "men" does not find "Women's blouses"); among equals
 * the filed order stands. Spellings that differ only in case are one name.
 */
export function matchedProducts(filed: readonly string[], q: string | null | undefined, show = 2): { shown: string[]; more: number } | null {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const raw of filed) {
    const name = raw.replace(/\s+/g, " ").trim();
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    names.push(name);
  }
  if (names.length === 0) return null;
  const words = (q ?? "").toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 1);
  const starts = (p: string) => p.toLowerCase().split(/[^\p{L}\p{N}]+/u);
  const hits = (p: string) => words.filter((w) => starts(p).some((x) => x.startsWith(w))).length;
  // A stable sort: the filed order among names that answer equally.
  const ranked = words.length ? names.map((p, i) => ({ p, i, n: hits(p) })).sort((a, b) => b.n - a.n || a.i - b.i).map((x) => x.p) : names;
  return { shown: ranked.slice(0, show), more: Math.max(0, ranked.length - show) };
}

const count = (n: number | null | undefined) => (n == null ? null : (formatCount(n) ?? String(n)));

export function resultRow(t: TableRowModel, today: Date, pageHref: string, exports: ExportsCell | null = null, more: { q?: string | null; exported?: Exported } = {}): ResultRow {
  // Held today: its date has not passed. A body with one ended and one current certificate keeps its mark.
  const held = certSummary(t.certs.filter((c) => c.state !== "expired"), today);
  return {
    slug: t.slug,
    supplierId: t.supplierId ?? null,
    name: t.name,
    type: t.type,
    place: t.place,
    workers: t.workersRange ?? count(t.workers),
    workersSecond: t.workersSecondShort ? { short: t.workersSecondShort, words: t.workersSecond ?? t.workersSecondShort } : null,
    workersRecord: t.workersRange ?? count(t.workersRecord ?? t.workers),
    sources: t.sourceCount,
    cert: certLine(t.certs, today),
    certCell: certSummary(t.certs, today),
    paneHref: t.recordHref ?? `/app/suppliers/${t.slug}`,
    pageHref,
    rfqHref: t.rfqHref ?? null,
    sanctioned: t.sanctioned,
    saved: t.saved ?? false,
    exports,
    products: matchedProducts(t.products ?? [], more.q),
    brands: t.brands ?? [],
    held: held ? [held.first, ...held.others] : [],
    exported: more.exported,
  };
}
