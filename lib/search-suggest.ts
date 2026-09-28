// What the buyer app's search field suggests as the buyer types (founder,
// 28 Sep 2026: "Google level of high quality — the search is everything for
// this website").
//
// The first version listed companies first, found by the full-text search
// over their product lists, so "shirt" opened on "Agami Fashions Limited":
// a company whose name says nothing about shirts, above the shirt headings a
// buyer actually sources against. The order a buyer reads now is:
//
//   1. the words typed, as a search (the client draws that row, instantly);
//   2. product categories: the HS headings whose names match, including the
//      words buyers use for them ("tee", "hoodie", "jeans");
//   3. certificates and places;
//   4. suppliers whose NAME matches what was typed — a company is suggested
//      because the buyer is typing its name, never because its product list
//      happens to contain the word.
//
// Pure: no I/O, so the order and the matching are tested without a network
// (`lib/search-suggest.test.ts`). The route feeds it the live rows.

import { HS_CATALOGUE } from "@/lib/hs-catalogue";
import { hsBuyerLabel } from "@/lib/epb-hscode-labels";

export type AppSuggestion =
  | { type: "heading"; label: string; hs: string; detail: string }
  | { type: "product"; label: string; value: string }
  | { type: "cert"; label: string; value: string; param: [key: string, value: string] }
  | { type: "location"; label: string; value: string; param: [key: string, value: string] }
  | { type: "company"; label: string; sublabel: string | null; slug: string };

/**
 * Lower-case words, apostrophes dropped: "Men's T-shirts" → ["mens", "t",
 * "shirts"]. With `compounds`, a hyphenated word is also kept whole
 * ("tshirts"), so a buyer typing "tshirt" or "t-shirt" finds it either way.
 */
export function words(text: string, compounds = false): string[] {
  const clean = text.toLowerCase().replace(/['’`]/g, "");
  const parts = clean.split(/[^a-z0-9]+/).filter(Boolean);
  if (!compounds) return parts;
  const joined = (clean.match(/[a-z0-9]+(?:-[a-z0-9]+)+/g) ?? []).map((w) => w.replace(/-/g, ""));
  return [...parts, ...joined];
}

/** Every word typed starts a word of the text: "bas shi" matches "Basic Shirts Ltd."; "irts" does not. */
export function prefixMatch(text: string, query: string): boolean {
  const q = words(query);
  if (q.length === 0) return false;
  const t = words(text, true);
  return q.every((w) => t.some((x) => x.startsWith(w)));
}

/**
 * What buyers type for a heading when the heading's own words differ. The
 * keys are the buyer's word (matched as a prefix), the values the 4-digit
 * headings it means. Only garment words a sourcing desk uses; a word not here
 * still matches the heading names themselves.
 */
const SYNONYMS: Record<string, readonly string[]> = {
  tee: ["6109"],
  tshirt: ["6109"],
  polo: ["6105", "6109"],
  hoodie: ["6110"],
  hoody: ["6110"],
  sweatshirt: ["6110"],
  sweater: ["6110"],
  jumper: ["6110"],
  knitwear: ["6110", "6114"],
  jeans: ["6203", "6204"],
  denim: ["6203", "6204"],
  trouser: ["6203", "6204", "6103", "6104"],
  pants: ["6203", "6204", "6103", "6104"],
  chino: ["6203"],
  shorts: ["6203", "6204", "6103", "6104"],
  jacket: ["6201", "6202", "6203", "6204"],
  parka: ["6201", "6202"],
  outerwear: ["6201", "6202", "6101", "6102"],
  dress: ["6204", "6104"],
  skirt: ["6204", "6104"],
  blouse: ["6206", "6106"],
  lingerie: ["6212", "6208", "6108"],
  bra: ["6212"],
  underwear: ["6107", "6108", "6207", "6208"],
  boxer: ["6107", "6207"],
  brief: ["6107", "6108"],
  nightwear: ["6207", "6208", "6107", "6108"],
  pyjama: ["6207", "6208"],
  pajama: ["6207", "6208"],
  sleepwear: ["6207", "6208"],
  baby: ["6111", "6209"],
  kids: ["6111", "6209"],
  infant: ["6111", "6209"],
  swimwear: ["6112", "6211"],
  activewear: ["6112", "6211"],
  sportswear: ["6112", "6211"],
  tracksuit: ["6112", "6211"],
  sock: ["6115"],
  hosiery: ["6115"],
  tights: ["6115"],
  leggings: ["6104", "6115"],
  glove: ["6116", "6216"],
  scarf: ["6214", "6117"],
  cap: ["6505"],
  hat: ["6505", "6504"],
  beanie: ["6505"],
  bag: ["4202", "6305"],
  towel: ["6302"],
  bedding: ["6302"],
  uniform: ["6203", "6204", "6205", "6206"],
  workwear: ["6203", "6204", "6211"],
  shirt: ["6205", "6105", "6206", "6106", "6109"],
};

const CATALOGUE = new Map(HS_CATALOGUE.map((r) => [r.hs, r]));

/** "Men's woven shirts": the buyer label when the kit has one, else the catalogue's short name. */
export function headingLabel(hs: string): string {
  const row = CATALOGUE.get(hs);
  return hsBuyerLabel(hs, row?.short ?? null);
}

/**
 * The HS headings a query names, best first: a heading whose buyer label
 * matches word for word, then one whose customs heading does, then one a
 * buyer's synonym points at. Ties go to the heading more Bangladeshi
 * exporters file, which is the one a buyer is likelier to mean.
 */
export function headingSuggestions(query: string, max = 4): AppSuggestion[] {
  const q = words(query);
  if (q.length === 0 || q.join("").length < 2) return [];
  // A four-digit code typed as such is that heading.
  const code = /^\s*(\d{4})\d{0,2}\s*$/.exec(query)?.[1];
  const scored: { hs: string; score: number; exporters: number }[] = [];
  for (const row of HS_CATALOGUE) {
    const label = headingLabel(row.hs);
    let score = 0;
    if (code && row.hs === code) score = 100;
    else if (prefixMatch(label, query)) score = 60;
    else if (prefixMatch(`${row.short} ${row.heading}`, query)) score = 40;
    else {
      const hits = q.filter((w) => Object.entries(SYNONYMS).some(([k, codes]) => (k.startsWith(w) || w.startsWith(k)) && w.length >= 3 && codes.includes(row.hs)));
      if (hits.length > 0 && hits.length === q.length) score = 30;
      else if (hits.length > 0) score = 15;
    }
    if (score > 0) scored.push({ hs: row.hs, score, exporters: row.exporters });
  }
  return scored
    .sort((a, b) => b.score - a.score || b.exporters - a.exporters || a.hs.localeCompare(b.hs))
    .slice(0, max)
    .map((s) => ({ type: "heading" as const, label: headingLabel(s.hs), hs: s.hs, detail: CATALOGUE.get(s.hs)?.heading ?? "" }));
}

/**
 * "Gazipur" once, not "Gazipur, Gazipur": a city and a district that are the
 * same word are one place. The raw pair was joined as-is and printed the
 * district twice under most Gazipur, Dhaka and Narayanganj suppliers
 * (founder's walkthrough, 28 Sep 2026).
 */
export function placeWords(city: string | null | undefined, district: string | null | undefined): string | null {
  const c = city?.trim() || null;
  const d = district?.trim() || null;
  if (c && d && c.toLowerCase() !== d.toLowerCase()) return `${c}, ${d}`;
  return c ?? d;
}

/** Suppliers whose name the buyer is typing, in the order the search ranked them. */
export function companySuggestions(
  rows: readonly { slug: string; name: string; city: string | null; district: string | null }[],
  query: string,
  max = 5,
): AppSuggestion[] {
  if (words(query).join("").length < 2) return [];
  const seen = new Set<string>();
  const out: AppSuggestion[] = [];
  for (const r of rows) {
    if (out.length >= max) break;
    if (seen.has(r.slug) || !prefixMatch(r.name, query)) continue;
    seen.add(r.slug);
    out.push({ type: "company", label: r.name, sublabel: placeWords(r.city, r.district), slug: r.slug });
  }
  return out;
}

/** Filed product words that match, minus any a heading above already says. */
export function productSuggestions(products: readonly string[], query: string, headingLabels: readonly string[], max = 3): AppSuggestion[] {
  if (words(query).join("").length < 2) return [];
  const taken = new Set(headingLabels.map((l) => words(l).join(" ")));
  const seen = new Set<string>();
  const out: AppSuggestion[] = [];
  for (const p of products) {
    if (out.length >= max) break;
    const key = words(p).join(" ");
    if (!key || seen.has(key) || taken.has(key) || !prefixMatch(p, query)) continue;
    seen.add(key);
    out.push({ type: "product", label: p.trim(), value: p.trim() });
  }
  return out;
}

export const APP_CERTS = [
  { value: "gots", label: "GOTS", words: "gots global organic textile standard organic" },
  { value: "wrap", label: "WRAP", words: "wrap worldwide responsible accredited production" },
  { value: "oeko_tex", label: "OEKO-TEX", words: "oeko tex oekotex standard 100" },
  { value: "sa8000", label: "SA8000", words: "sa8000 social accountability" },
] as const;

export function certSuggestions(query: string, max = 2): AppSuggestion[] {
  if (words(query).join("").length < 2) return [];
  return APP_CERTS.filter((c) => prefixMatch(`${c.label} ${c.words}`, query))
    .slice(0, max)
    .map((c) => ({ type: "cert" as const, label: `${c.label} certified`, value: c.label, param: ["cert", c.value] as [string, string] }));
}

/** Districts first (the wider search), a city only when no district of that name was offered. */
export function locationSuggestions(districts: readonly string[], cities: readonly string[], query: string, max = 3): AppSuggestion[] {
  if (words(query).join("").length < 2) return [];
  const seen = new Set<string>();
  const out: AppSuggestion[] = [];
  for (const [field, list] of [
    ["district", districts],
    ["city", cities],
  ] as const) {
    for (const place of list) {
      if (out.length >= max) break;
      const key = place.trim().toLowerCase();
      if (!key || seen.has(key) || !prefixMatch(place, query)) continue;
      seen.add(key);
      out.push({ type: "location", label: place.trim(), value: place.trim(), param: [field, place.trim()] });
    }
  }
  return out;
}

/** The whole list in the order the field draws it. */
export function appSuggestions(input: {
  query: string;
  companies: readonly { slug: string; name: string; city: string | null; district: string | null }[];
  products: readonly string[];
  districts: readonly string[];
  cities: readonly string[];
}): AppSuggestion[] {
  const headings = headingSuggestions(input.query);
  return [
    ...headings,
    ...productSuggestions(input.products, input.query, headings.map((h) => h.label)),
    ...certSuggestions(input.query),
    ...locationSuggestions(input.districts, input.cities, input.query),
    ...companySuggestions(input.companies, input.query),
  ];
}
