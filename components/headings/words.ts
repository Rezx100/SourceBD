// The words of HS codes (Paper `10 · HS codes by chapter`, `11 · HS codes by chapter`), out of React
// so a test reads them. The catalogue is `hs_catalogue()`: a four-digit heading, its heading text and
// how many suppliers export it (sanctioned suppliers left out, as the search leaves them out). The
// chapter is the first two digits; Paper names the eleven that matter to a garment buyer and folds the
// rest into "N more chapters". Paper's "from the export records of 2,456 suppliers · checked 14 Aug
// 2026" is not here: the read carries neither figure.

import { formatCount } from "@/lib/dashboard/facts";

export type Heading = { hs: string; label: string | null; exporters: number };
export type Chapter = { code: string; name: string; headings: Heading[] };

/** The chapters Paper lists first, in its order. */
export const PRIMARY = ["61", "62", "63", "60", "65", "64", "42", "52", "54", "55", "58"] as const;

export const CHAPTER_NAMES: Record<string, string> = {
  "61": "Knitted clothing",
  "62": "Woven clothing",
  "63": "Home textiles",
  "60": "Knitted fabrics",
  "65": "Hats",
  "64": "Footwear",
  "42": "Bags and leather goods",
  "52": "Cotton, yarn and fabric",
  "54": "Man-made filaments",
  "55": "Man-made staple fibres",
  "58": "Labels, lace, trims",
};

/**
 * The chapters Paper does not list, named in plain words so no card says only "Chapter 49". Chapter 77
 * is reserved in the HS and 98 and 99 are each country's own, so those keep their number.
 */
const OTHER_CHAPTER_NAMES: Record<string, string> = {
  "01": "Live animals",
  "02": "Meat",
  "03": "Fish and seafood",
  "04": "Dairy, eggs and honey",
  "05": "Other animal products",
  "06": "Live plants and flowers",
  "07": "Vegetables",
  "08": "Fruit and nuts",
  "09": "Coffee, tea and spices",
  "10": "Cereals",
  "11": "Flour, malt and starch",
  "12": "Oil seeds and grains",
  "13": "Lac, gums and resins",
  "14": "Plaiting materials",
  "15": "Animal and vegetable fats",
  "16": "Meat and fish preparations",
  "17": "Sugars and sweets",
  "18": "Cocoa and chocolate",
  "19": "Bakery and cereal goods",
  "20": "Fruit and vegetable preparations",
  "21": "Other food preparations",
  "22": "Beverages and spirits",
  "23": "Animal feed and food waste",
  "24": "Tobacco",
  "25": "Salt, stone, plaster and cement",
  "26": "Ores, slag and ash",
  "27": "Mineral fuels and oils",
  "28": "Inorganic chemicals",
  "29": "Organic chemicals",
  "30": "Pharmaceuticals",
  "31": "Fertilisers",
  "32": "Dyes, paints and inks",
  "33": "Perfumery and cosmetics",
  "34": "Soap, waxes and polishes",
  "35": "Glues and enzymes",
  "36": "Explosives and matches",
  "37": "Photographic goods",
  "38": "Other chemical products",
  "39": "Plastics",
  "40": "Rubber",
  "41": "Raw hides and leather",
  "43": "Furskins and artificial fur",
  "44": "Wood",
  "45": "Cork",
  "46": "Straw and basketware",
  "47": "Pulp for paper",
  "48": "Paper and paperboard",
  "49": "Books and printed matter",
  "50": "Silk",
  "51": "Wool and animal hair",
  "53": "Jute and other plant fibres",
  "56": "Wadding, felt, nonwovens and cord",
  "57": "Carpets and floor coverings",
  "59": "Coated and technical fabrics",
  "66": "Umbrellas and walking sticks",
  "67": "Feathers, artificial flowers and wigs",
  "68": "Stone, plaster and cement articles",
  "69": "Ceramics",
  "70": "Glass",
  "71": "Pearls, gems and jewellery",
  "72": "Iron and steel",
  "73": "Iron and steel articles",
  "74": "Copper",
  "75": "Nickel",
  "76": "Aluminium",
  "78": "Lead",
  "79": "Zinc",
  "80": "Tin",
  "81": "Other base metals",
  "82": "Tools and cutlery",
  "83": "Other metal goods",
  "84": "Machinery",
  "85": "Electrical equipment",
  "86": "Railway equipment",
  "87": "Vehicles",
  "88": "Aircraft",
  "89": "Ships and boats",
  "90": "Optical, medical and measuring instruments",
  "91": "Clocks and watches",
  "92": "Musical instruments",
  "93": "Arms and ammunition",
  "94": "Furniture, bedding and lamps",
  "95": "Toys, games and sports goods",
  "96": "Other manufactured articles",
  "97": "Art, collectibles and antiques",
};

export const chapterName = (code: string): string => CHAPTER_NAMES[code] ?? OTHER_CHAPTER_NAMES[code] ?? `Chapter ${code}`;

export const HEADINGS_TITLE = "HS codes";
export const SANCTION_NOTE = "exporter counts leave out sanctioned suppliers, as the search does";
export const SEARCH_PLACEHOLDER = "Search headings";
export const CATALOGUE_ERROR_TITLE = "We couldn't load the HS codes.";
export const CATALOGUE_ERROR_BODY = "Exporter counts could not be read. Nothing is lost; try again in a moment.";

export type SortKey = "code" | "suppliers";
export const parseSort = (v: unknown): SortKey => ((Array.isArray(v) ? v[0] : v) === "suppliers" ? "suppliers" : "code");

/** The headings grouped into chapters, chapters by code, each chapter's headings by code. */
export function buildChapters(rows: readonly Heading[]): Chapter[] {
  const by = new Map<string, Heading[]>();
  for (const r of rows) {
    const c = r.hs.slice(0, 2);
    by.set(c, [...(by.get(c) ?? []), r]);
  }
  return [...by.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([code, headings]) => ({ code, name: chapterName(code), headings: sortHeadings(headings, "code") }));
}

export function sortHeadings(h: readonly Heading[], sort: SortKey): Heading[] {
  return [...h].sort((a, b) => (sort === "suppliers" ? b.exporters - a.exporters || a.hs.localeCompare(b.hs) : a.hs.localeCompare(b.hs)));
}

/** Paper's listed chapters (those the catalogue has) in Paper's order, and every other chapter by code. */
export function splitChapters(chapters: readonly Chapter[]): { primary: Chapter[]; more: Chapter[] } {
  const has = new Map(chapters.map((c) => [c.code, c]));
  const primary = PRIMARY.map((c) => has.get(c)).filter((c): c is Chapter => Boolean(c));
  const named = new Set<string>(primary.map((c) => c.code));
  return { primary, more: chapters.filter((c) => !named.has(c.code)) };
}

/** The chapter the page opens: the one asked for, if it exists; else the first of Paper's list; else the first there is. */
export function openChapter(chapters: readonly Chapter[], asked: unknown): string | null {
  const want = String(Array.isArray(asked) ? asked[0] : (asked ?? "")).trim();
  if (chapters.some((c) => c.code === want)) return want;
  const { primary } = splitChapters(chapters);
  return primary[0]?.code ?? chapters[0]?.code ?? null;
}

export const headingsWord = (n: number) => `${formatCount(n)} ${n === 1 ? "heading" : "headings"}`;
export const suppliersWord = (n: number) => `${formatCount(n)} ${n === 1 ? "supplier" : "suppliers"}`;

export const groupTitle = (n: number) => `Clothing and textiles · ${n} ${n === 1 ? "chapter" : "chapters"}`;
export const moreLine = (n: number) => `${n} more ${n === 1 ? "chapter" : "chapters"}`;

export function caption(opts: { headings: number; chapters: number }): string {
  return `${headingsWord(opts.headings)} in ${opts.chapters} ${opts.chapters === 1 ? "chapter" : "chapters"} · ${SANCTION_NOTE}`;
}

export function searchCaption(matches: number): string {
  return `${headingsWord(matches)} match · ${SANCTION_NOTE}`;
}

export const searchHref = (hs: string) => `/app/discover?hs=${encodeURIComponent(hs)}`;

export function headingsHref(o: { chapter?: string | null; sort?: SortKey; more?: boolean }): string {
  const p = new URLSearchParams();
  if (o.chapter) p.set("chapter", o.chapter);
  if (o.sort && o.sort !== "code") p.set("sort", o.sort);
  if (o.more) p.set("more", "1");
  const q = p.toString();
  return q ? `/app/headings?${q}` : "/app/headings";
}
