// What a search field does with the suggestions `lib/search-suggest.ts` makes: the rows it draws,
// where each one leads, the arrow keys, the words under a name. Pure, so the order and the links
// are tested without a DOM (`lib/search-suggest-ui.test.ts`); the field itself is
// `components/search/typeahead.tsx`.
//
// Moved here from the old `components/dashboard/search-typeahead.tsx` (which re-exports it until
// that kit is deleted), so the v4 field does not import from a file that is going away. The
// matching and its order stay in `search-suggest.ts`; nothing here ranks anything.

import { formatCount } from "@/lib/dashboard/facts";

export type Suggestion =
  | { type: "query"; label: string }
  | { type: "recent"; label: string; href: string; count: number | null }
  | { type: "heading"; label: string; hs: string; detail?: string }
  | { type: "company"; label: string; sublabel: string | null; slug: string }
  | {
      type: "product" | "location" | "cert";
      label: string;
      value: string;
      /** The search parameter this term sets, when it is not the free-text `q`. */
      param?: [key: string, value: string];
    };

export const SUGGEST_PATH = "/api/discover/suggest";
export const DEBOUNCE_MS = 110;

/** Pane parameters of the results page: a company opened from the field replaces whatever pane was open (and its tab). */
export const PANE_PARAMS = ["record", "tab", "site", "line", "lines", "rfq", "hs_line", "filters", "save", "sent", "saved"];

/**
 * Where choosing a suggestion goes.
 *
 * A company opens its record BESIDE the results, never on a page of its own
 * (it used to go to `/app/suppliers/<slug>`, which threw the search away).
 * On the results page that is the search the buyer is on, with `record=`
 * (the filters and the selection stay); anywhere else it is a search for the
 * company's name with its record open beside it.
 */
export function suggestionHref(s: Suggestion, at: { pathname?: string | null; search?: string | null } = {}): string {
  switch (s.type) {
    case "query":
      return `/app/discover?${new URLSearchParams({ q: s.label }).toString()}`;
    case "recent":
      return s.href;
    case "heading":
      return `/app/discover?${new URLSearchParams({ hs: s.hs }).toString()}`;
    case "company": {
      if (at.pathname === "/app/discover") {
        const params = new URLSearchParams(at.search ?? "");
        for (const k of PANE_PARAMS) params.delete(k);
        params.set("record", s.slug);
        return `/app/discover?${params.toString()}`;
      }
      return `/app/discover?${new URLSearchParams({ q: s.label, record: s.slug }).toString()}`;
    }
    default: {
      const [key, value] = s.param ?? ["q", s.value];
      return `/app/discover?${new URLSearchParams({ [key]: value }).toString()}`;
    }
  }
}

/** The next active row for an arrow key: wraps at both ends; -1 (nothing) steps to the first or last. */
export function stepIndex(current: number, delta: 1 | -1, count: number): number {
  if (count === 0) return -1;
  if (current < 0) return delta === 1 ? 0 : count - 1;
  return (current + delta + count) % count;
}

/**
 * The rows the list draws, in order: the typed words first (so Enter's
 * meaning is always on screen), then the server's rows in the order it sent
 * them. An empty field lists the buyer's recent searches instead.
 */
export function suggestionRows(value: string, fetched: readonly Suggestion[], recent: readonly Suggestion[]): Suggestion[] {
  const q = value.trim();
  if (!q) return [...recent];
  return [{ type: "query", label: q }, ...fetched.filter((s) => s.type !== "query" && s.type !== "recent")];
}

/** The typed words inside a label, split so the matching start of each word can be set apart. */
export function highlightParts(label: string, query: string): { text: string; hit: boolean }[] {
  const terms = query
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter((t) => t.length > 0);
  if (terms.length === 0) return [{ text: label, hit: false }];
  const out: { text: string; hit: boolean }[] = [];
  // A word start in the label that begins with one of the typed terms.
  const re = new RegExp(`(^|[^a-z0-9])(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
  let last = 0;
  for (const m of label.matchAll(re)) {
    const start = (m.index ?? 0) + (m[1]?.length ?? 0);
    const end = start + (m[2]?.length ?? 0);
    if (start > last) out.push({ text: label.slice(last, start), hit: false });
    out.push({ text: label.slice(start, end), hit: true });
    last = end;
  }
  if (last < label.length) out.push({ text: label.slice(last), hit: false });
  return out.length > 0 ? out : [{ text: label, hit: false }];
}

/**
 * What the field shows. The shell is drawn once by the layout and does not
 * know the page's query, so on the results page the field reads it from the
 * URL, and a navigation that changes `q` (choosing a suggestion, a saved
 * search) resets it to what the URL says rather than leaving the half-typed
 * word behind. Anywhere else it shows what the caller started it with.
 */
export function fieldValue(pathname: string | null, q: string | null, defaultValue: string): string {
  return pathname === "/app/discover" ? (q ?? "") : defaultValue;
}

/**
 * A row's two lines, as Paper's combobox draws them (`02 Components` · Inputs): the name, then a
 * 12px line saying what it is. The line names the kind and, for a supplier, the place; a supplier
 * row carries no contact detail and no score.
 */
export function rowWords(s: Suggestion): { name: string; sub: string } {
  switch (s.type) {
    case "query":
      return { name: `Search “${s.label}”`, sub: "Every supplier matching these words" };
    case "recent":
      return { name: s.label, sub: s.count === null ? "Recent search" : `Recent search · ${formatCount(s.count)} ${s.count === 1 ? "supplier" : "suppliers"}` };
    case "heading":
      return { name: s.label, sub: `Product category · HS ${s.hs}` };
    case "product":
      return { name: s.label, sub: "Product as filed" };
    case "cert":
      return { name: s.label, sub: "Certificate" };
    case "location":
      return { name: s.label, sub: s.param?.[0] === "city" ? "Place · City" : "Place · District" };
    case "company":
      return { name: s.label, sub: s.sublabel ? `Supplier · ${s.sublabel}` : "Supplier" };
  }
}
