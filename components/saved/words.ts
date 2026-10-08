// The words of Saved (B6b, Paper `10 · Saved`, `· saved searches`, `11 · Saved`): the sort, the
// tabs, a saved supplier's row (its type and place, workers, sources, the first certificate to
// check, when it was saved), what the certificate cell may say, and a saved search's line and its
// remembered count. Everything is worked out from what `buyer_saved_list`, the two compliance
// reads and `saved_searches` return, so nothing here says more than they hold. Pure.

import { certLine, certSummary, type CertLine, type CertSummary } from "@/components/patterns/words";
import { discoverWorkers, workersSecondShort } from "@/lib/dashboard/build-discover-row";
import { certScheme, displayName, entityLabel, formatCount, formatDay, formatRelative, placeLabel } from "@/lib/dashboard/facts";
import { SEND_RFQ_MAX } from "@/lib/dashboard/selection";
import { discoverChips, discoverHref, parseDiscoverState, queryTitle } from "@/lib/discover-v32-state";
import type { WorkersBasis } from "@/lib/enrich-discover-workers";
import type { SavedSearchJson } from "@/lib/saved-searches";

export const PAGE_SIZE = 24;

export const SAVED_SORTS = [
  { value: "recent", label: "Recently saved" },
  { value: "receipts", label: "Most evidence" },
  { value: "name", label: "Name (A–Z)" },
] as const;
export type SavedSort = (typeof SAVED_SORTS)[number]["value"];

/** `?sort=` as the page reads it: anything that is not a sort is the default. */
export function parseSort(raw: string | string[] | undefined): SavedSort {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return SAVED_SORTS.find((o) => o.value === v)?.value ?? "recent";
}

/** `?page=` as the page reads it: a whole number from 1. */
export function parsePage(raw: string | string[] | undefined): number {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return Math.max(1, Number.parseInt(v ?? "", 10) || 1);
}

export type SavedView = { sort: SavedSort; page: number; open?: string | null; tab?: string | null };

/** `?sort=…&page=…&open=…`, dropping the defaults so page 1 of "recent" with nothing open is plain `/app/saved`. */
export function savedHref({ sort, page, open, tab }: SavedView): string {
  const u = new URLSearchParams();
  if (sort !== "recent") u.set("sort", sort);
  if (page !== 1) u.set("page", String(page));
  if (open) u.set("open", open);
  if (open && tab && tab !== "overview") u.set("tab", tab);
  const s = u.toString();
  return s ? `/app/saved?${s}` : "/app/saved";
}

export const SEARCHES_HREF = "/app/searches";

/** Download CSV on Saved: the whole list in the page's sort (`/api/v1/export`). */
export const savedExportHref = (sort: SavedSort) => `/api/v1/export?kind=saved&sort=${sort}`;

/** One RFQ to everyone ticked: the composer takes the suppliers as `?supplier=a,b,c`. */
export const rfqHref = (ids: readonly string[]) => `/app/rfqs/new?supplier=${ids.map(encodeURIComponent).join(",")}`;

export const TOO_MANY = `One RFQ goes to up to ${SEND_RFQ_MAX} suppliers. Untick some to send.`;

/** What `buyer_saved_list` returns, with the two worker figures `enrichDiscoverWorkers` adds. */
export type SavedRow = {
  id: string;
  slug: string;
  company_name: string;
  entity_type: string;
  city: string | null;
  district: string | null;
  source_tags: string[] | null;
  t13_source_count: number | null;
  employees_total: number | null;
  saved_at: string;
  total_count?: number | null;
  workers_own?: number | null;
  workers_basis?: WorkersBasis;
  workers_source?: "RSC" | "registry";
};

/** The row both compliance RPCs return (`compliance_expired_certs`, `compliance_expiring_certs`). */
export type CertRead = { kind: string; certificate_no: string | null; expires_on: string; listing_status?: string; delisted_on?: string | null; supplier: { id: string } | null };

/** What the compliance reads say, by supplier: complete only when BOTH reads worked. */
export type CertsBySupplier = { bySupplier: Map<string, { scheme: string; expiresOn: string; markCode?: string; delistedOn?: string | null }[]>; complete: boolean };

/**
 * Group the two reads by supplier. A read that failed is `null`, and then the cells of suppliers
 * not listed say nothing: "nothing to check" is a claim an unread list cannot make.
 */
export function groupCerts(expired: readonly CertRead[] | null, expiring: readonly CertRead[] | null): CertsBySupplier {
  const bySupplier = new Map<string, { scheme: string; expiresOn: string; markCode?: string; delistedOn?: string | null }[]>();
  // A delisted certificate (0122) can come back in both reads; it counts once.
  const seen = new Set<string>();
  for (const r of [...(expired ?? []), ...(expiring ?? [])]) {
    if (!r.supplier?.id) continue;
    const key = `${r.supplier.id}|${r.kind}|${r.certificate_no ?? r.expires_on}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const list = bySupplier.get(r.supplier.id) ?? [];
    // The kind is the code the body's mark is filed under (`wrap`, `gots`, `oeko_tex`), so the cell draws its logo.
    list.push({ scheme: certScheme(r.kind), expiresOn: r.expires_on, markCode: r.kind.toUpperCase(), delistedOn: r.listing_status === "no_longer_listed" ? (r.delisted_on ?? r.expires_on) : null });
    bySupplier.set(r.supplier.id, list);
  }
  return { bySupplier, complete: expired !== null && expiring !== null };
}

/** The certificates to check: the worst one's words and the compact cell the results draw, "nothing to check", or that it was not read. */
export type CertCell = { kind: "line"; line: CertLine; summary: CertSummary } | { kind: "clear" } | { kind: "unread" };

export function certCell(certs: CertsBySupplier | null, supplierId: string, today: Date): CertCell {
  const own = certs?.bySupplier.get(supplierId);
  const line = own && own.length ? certLine(own, today) : null;
  const summary = own && own.length ? certSummary(own, today) : null;
  if (line && summary) return { kind: "line", line, summary };
  return certs?.complete ? { kind: "clear" } : { kind: "unread" };
}

export type SavedItem = {
  id: string;
  slug: string;
  name: string;
  /** "Factory". */
  type: string;
  place: string | null;
  workers: string | null;
  workersSecond: { short: string; words: string } | null;
  sources: number;
  cert: CertCell;
  /** "1 Oct 2026". */
  savedOn: string | null;
  /** Opens the record in the pane beside the list. */
  paneHref: string;
  /** Opens the record as a page, with the way back to this list. */
  pageHref: string;
};

export function buildSavedItems(rows: readonly SavedRow[], certs: CertsBySupplier | null, today: Date, view: SavedView): SavedItem[] {
  return rows.map((r) => {
    const w = discoverWorkers({ employees_total: r.employees_total, workers_own: r.workers_own, workers_basis: r.workers_basis, workers_source: r.workers_source });
    const second = workersSecondShort(w);
    const back = savedHref({ ...view, open: null });
    return {
      id: r.id,
      slug: r.slug,
      name: displayName(r.company_name),
      type: entityLabel(r.entity_type),
      place: placeLabel(r.city, r.district),
      workers: w.own == null ? null : (formatCount(w.own) ?? String(w.own)),
      workersSecond: second ? { short: second, words: w.second == null ? second : `${formatCount(w.second)} workers${w.secondLabel ? ` · ${w.secondLabel}` : ""}` } : null,
      sources: r.t13_source_count ?? 0,
      cert: certCell(certs, r.id, today),
      savedOn: formatDay(r.saved_at),
      paneHref: savedHref({ ...view, open: r.slug, tab: null }),
      pageHref: `/app/suppliers/${r.slug}?back=${encodeURIComponent(back)}`,
    };
  });
}

/** "Factory · Dhaka" as the table's Type and district column prints it. */
export const typeAndPlace = (i: Pick<SavedItem, "type" | "place">) => [i.type, i.place].filter(Boolean).join(" · ");

/** "11 saved suppliers · only you see this list". */
export function savedCaption(total: number | null): string {
  return total === null ? "Only you see this list" : `${formatCount(total)} saved ${total === 1 ? "supplier" : "suppliers"} · only you see this list`;
}

/** The two tab labels: "Suppliers · 11" and "Saved searches · 2"; a count that could not be read is left off. */
export function tabLabels(suppliers: number | null, searches: number | null): { suppliers: string; searches: string; phoneSearches: string } {
  const n = (label: string, c: number | null) => (c === null ? label : `${label} · ${formatCount(c)}`);
  return { suppliers: n("Suppliers", suppliers), searches: n("Saved searches", searches), phoneSearches: n("Searches", searches) };
}

/** "Removed Aboni Knitwear Ltd. from saved", or "Removed 3 suppliers from saved". */
export function removedWords(names: readonly string[]): string {
  return names.length === 1 ? `Removed ${names[0]} from saved` : `Removed ${formatCount(names.length)} suppliers from saved`;
}

/* ---------------------------------------------------------------- saved searches */

export type SearchItem = {
  id: string;
  name: string;
  /** "Knit · GOTS · Gazipur · hiding sanctioned suppliers": the filters in words. */
  filters: string;
  /** The remembered count: "101"; null when it was never counted. */
  count: string | null;
  /** "suppliers today" for a count taken today, "suppliers · counted 3d ago" for an older one. */
  countWords: string;
  /** Run search: the redirect route that opens it. */
  runHref: string;
  /** "Email me new matches" is on; null when it was not read (0113 not applied), and then no switch is drawn. */
  alert: boolean | null;
};

/**
 * The words of a saved search's filters, from the query it kept: "GOTS, Gazipur", not "knit · Certificate ·
 * GOTS · Gazipur · Sanctioned hidden" (the critique of 7 Oct 2026, item 9). Each filter is its value in
 * words; a family's name and a value that is the default (a valid certificate, sanctioned suppliers
 * hidden) are left out. "All published suppliers" when it kept none.
 */
export function searchFilters(queryState: unknown): string {
  const raw = queryState && typeof queryState === "object" ? (queryState as { search?: unknown }).search : null;
  const params = typeof raw === "string" ? new URLSearchParams(raw) : new URLSearchParams();
  const sp: Record<string, string | string[]> = {};
  for (const k of new Set(params.keys())) {
    const all = params.getAll(k);
    sp[k] = all.length > 1 ? all : (all[0] ?? "");
  }
  const words = discoverChips(parseDiscoverState(sp))
    .map((c) => c.label)
    .filter((l) => l !== "Sanctioned hidden")
    .map((l) => l.replace(/^Certificate · /, "").replace(/, valid$/, "").replace(/ \(any state\)$/, ""));
  return words.length ? words.join(", ") : "All published suppliers";
}

/** The count and when it was taken: most are remembered, not live, and the row says which. */
export function countWords(lastCount: number | null, countedAt: string | null, now: Date): { count: string | null; words: string } {
  if (lastCount === null) return { count: null, words: "not counted yet" };
  const count = formatCount(lastCount);
  const when = formatRelative(countedAt, now);
  // "Today" is the UTC day, as the times everywhere else in the app are.
  const fresh = countedAt !== null && !Number.isNaN(Date.parse(countedAt)) && new Date(countedAt).toISOString().slice(0, 10) === now.toISOString().slice(0, 10);
  return { count, words: fresh ? "suppliers today" : when ? `suppliers · counted ${when}` : "suppliers" };
}

export function buildSearchItems(searches: readonly SavedSearchJson[], now: Date, alerts: Readonly<Record<string, boolean>> | null = null): SearchItem[] {
  return searches.map((s) => {
    const c = countWords(s.last_count, s.last_count === null ? null : s.last_counted_at, now);
    return { id: s.id, name: s.name || "Untitled search", filters: searchFilters(s.query_state), count: c.count, countWords: c.words, runHref: s.href, alert: alerts && typeof alerts[s.id] === "boolean" ? alerts[s.id]! : null };
  });
}

/** The switch's label on a saved search, in Paper's words. */
export const alertWords = (on: boolean) => (on ? "Email me new matches every Monday" : "No email for new matches");

/** How long a last search is still offered for saving. */
export const LAST_SEARCH_DAYS = 7;

export type LastSearchCard = {
  /** The name it would be saved under: the filters' title, cut to the 120 a name may be. */
  name: string;
  filters: string;
  /** "3d ago". */
  when: string;
  /** What to save: the serialized search, as a saved search keeps it. */
  search: string;
  runHref: string;
};

/**
 * "Save your last search?" from `buyer_last_search()`: only when there is one, no saved search holds
 * it already (`saved`), and it was run in the last 7 days. Anything else, a read that failed or a
 * database without 0113 included, is no card: it never invents a search.
 */
export function lastSearchCard(read: unknown, now: Date): LastSearchCard | null {
  if (!read || typeof read !== "object" || Array.isArray(read)) return null;
  const { state, searched_at, saved } = read as { state?: unknown; searched_at?: unknown; saved?: unknown };
  if (saved !== false || typeof searched_at !== "string") return null;
  const at = Date.parse(searched_at);
  if (Number.isNaN(at) || now.getTime() - at > LAST_SEARCH_DAYS * 86_400_000) return null;
  const search = state && typeof state === "object" ? (state as { search?: unknown }).search : null;
  if (typeof search !== "string" || search === "") return null;
  const parsed = parseDiscoverState(new URLSearchParams(search));
  return {
    name: queryTitle(parsed).slice(0, 120),
    filters: searchFilters({ search }),
    when: formatRelative(searched_at, now) ?? "",
    search,
    runHref: discoverHref(parsed),
  };
}

/** "2 saved searches · only you see them", "None saved yet · only you see them". */
export function searchesCaption(n: number | null, capped = false): string {
  if (n === null) return "Only you see them";
  if (n === 0) return "None saved yet · only you see them";
  return `${capped ? "The " : ""}${formatCount(n)}${capped ? " most recent" : ""} saved ${n === 1 ? "search" : "searches"} · only you see ${n === 1 ? "it" : "them"}`;
}
