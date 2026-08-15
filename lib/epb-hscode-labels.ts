import type { ProfileEpbHscode } from "@/lib/epb-hscodes";

/** Four-digit HS headings a Bangladesh RMG buyer actually sources against. */
const BUYER_LABELS: Record<string, string> = {
  "6101": "Men's knit coats",
  "6102": "Women's knit coats",
  "6103": "Men's knit suits & trousers",
  "6104": "Women's knit suits, dresses & skirts",
  "6105": "Men's knit shirts",
  "6106": "Women's knit blouses",
  "6107": "Men's knit underwear",
  "6108": "Women's knit underwear",
  "6109": "T-shirts",
  "6110": "Jerseys, pullovers & cardigans",
  "6111": "Babies' knitwear",
  "6112": "Knit tracksuits & swimwear",
  "6113": "Knit coated garments",
  "6114": "Other knit garments",
  "6115": "Hosiery",
  "6116": "Knit gloves",
  "6117": "Knit clothing accessories",
  "6201": "Men's woven coats",
  "6202": "Women's woven coats",
  "6203": "Men's woven suits & trousers",
  "6204": "Women's woven suits, dresses & skirts",
  "6205": "Men's woven shirts",
  "6206": "Women's woven blouses",
  "6207": "Men's woven underwear",
  "6208": "Women's woven underwear",
  "6209": "Babies' woven garments",
  "6210": "Garments of coated fabrics",
  "6211": "Woven tracksuits & swimwear",
  "6212": "Bras & shapewear",
  "6213": "Handkerchiefs",
  "6214": "Shawls & scarves",
  "6215": "Ties",
  "6216": "Woven gloves",
  "6217": "Other clothing accessories",
  "6504": "Hats of plaited or assembled strips",
  "6505": "Hats & knitted headgear",
  "6506": "Other headgear",
};

const CHAPTER_LABELS: Record<string, string> = {
  "61": "Knit apparel",
  "62": "Woven apparel",
  "63": "Made-up textiles",
  "65": "Headgear",
};

export type HsChapterGroup = {
  chapter: string;
  label: string;
  items: { code: string; label: string }[];
};

export function hsBuyerLabel(code: string, description: string | null): string {
  const mapped = BUYER_LABELS[code];
  if (mapped) return mapped;
  if (description) {
    const cut = description.split(",")[0]?.trim() ?? "";
    if (cut.length >= 4) return cut;
  }
  return `HS ${code}`;
}

export function groupEpbHscodes(
  rows: readonly ProfileEpbHscode[],
): HsChapterGroup[] {
  const byChapter = new Map<string, HsChapterGroup>();
  const order: string[] = [];
  for (const row of rows) {
    const chapter = row.code.slice(0, 2);
    let group = byChapter.get(chapter);
    if (!group) {
      group = {
        chapter,
        label: CHAPTER_LABELS[chapter] ?? "Other export lines",
        items: [],
      };
      byChapter.set(chapter, group);
      order.push(chapter);
    }
    group.items.push({
      code: row.code,
      label: hsBuyerLabel(row.code, row.description),
    });
  }
  const known = ["61", "62", "63", "65"];
  return order
    .sort((a, b) => {
      const ia = known.indexOf(a);
      const ib = known.indexOf(b);
      if (ia === -1 && ib === -1) return a.localeCompare(b);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    })
    .map((ch) => byChapter.get(ch)!);
}

function joinBuyerList(items: readonly string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0]!;
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

/** One-line read for a buyer: what EPB says this company exports. */
export function hsOverviewLede(groups: readonly HsChapterGroup[]): string {
  const chapters = new Set(groups.map((g) => g.chapter));
  const parts: string[] = [];
  if (chapters.has("61") && chapters.has("62")) parts.push("knit and woven apparel");
  else if (chapters.has("61")) parts.push("knit apparel");
  else if (chapters.has("62")) parts.push("woven apparel");
  if (chapters.has("63")) parts.push("made-up textiles");
  if (chapters.has("65")) parts.push("headgear");
  const other = groups.some((g) => !["61", "62", "63", "65"].includes(g.chapter));
  if (other) parts.push("other export lines");
  if (parts.length === 0) {
    const n = groups.reduce((sum, g) => sum + g.items.length, 0);
    return `EPB lists this company against ${n} Harmonised System ${n === 1 ? "code" : "codes"}.`;
  }
  return `EPB lists this company as a ${joinBuyerList(parts)} exporter.`;
}
