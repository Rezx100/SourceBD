// Apparel icon lookup. Icons are PNG-quality SVGs hosted on Bunny CDN at
// https://sourcebd-docs.b-cdn.net/apparel-icons/<key>.svg. Each SourceBD
// supplier's principal_products row (free-text) is normalised then matched
// against the patterns below; returns the CDN URL or null if no icon fits.
//
// Coverage tuned to the actual histogram of `principal_products` values
// observed in production (top ~200 distinct values). Non-apparel items
// (packaging, labels, accessories, paperboard, etc.) intentionally return
// null and fall back to the generic diamond bullet.

const CDN = "https://sourcebd-docs.b-cdn.net/apparel-icons";

export const APPAREL_ICON_KEYS = [
  "athletic-wear",
  "blazer",
  "boxer",
  "cardigan",
  "childrens-denim",
  "dress",
  "embroidery",
  "fabric",
  "home-textile",
  "hoodie",
  "knit-and-woven",
  "knit",
  "knitted-shirt",
  "lab-coat",
  "lingerie",
  "mens-denim",
  "polo",
  "skirt",
  "sportswear",
  "sweater",
  "tshirt",
  "unisex-apparel",
  "womens-apparel",
  "womens-denim",
  "yarn",
  "zipper",
] as const;

export type ApparelIconKey = (typeof APPAREL_ICON_KEYS)[number];

function normalise(raw: string): string {
  return raw
    .toLowerCase()
    // unify the three apostrophe variants seen in the data (', `, ’).
    .replace(/[`'\u2018\u2019\u02bc]/g, "'")
    .replace(/[-_/+&]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Ordered list of (regex, icon key). First match wins, so put the more
// specific entries above the generic ones (e.g. "men's denim" before "denim").
const RULES: ReadonlyArray<readonly [RegExp, ApparelIconKey]> = [
  // Denim variants — gendered first.
  [/\b(men's|mens|gent's|gents)\s+(denim|jeans)/, "mens-denim"],
  [/\b(women's|womens|ladies)\s+(denim|jeans)/, "womens-denim"],
  [/\b(children's|childrens|kids|boy's|girl's|baby's|babies')\s+(denim|jeans)/, "childrens-denim"],
  [/\b(denim|jeans)\b/, "mens-denim"],

  // Shirts & tops.
  [/\bt[\s-]?shirt(s)?\b/, "tshirt"],
  [/\btee(s)?\b/, "tshirt"],
  [/\b(polo|tennis)\b/, "polo"],
  [/\bknitted shirts?\b/, "knitted-shirt"],
  [/\bknit and woven\b/, "knit-and-woven"],
  [/\bknitwear|knit items?|knit garment|knitted garment|all kind of knit/, "knit"],
  [/\bknit\b/, "knit"],
  [/\bwoven (shirts?|tops?|bottoms?)\b/, "knit-and-woven"],
  [/\bwoven\b/, "knit-and-woven"],

  // Outerwear & layering.
  [/\b(hoody|hoodies|hoodie|hooded)\b/, "hoodie"],
  [/\bblazer(s)?\b/, "blazer"],
  [/\bcardigan(s)?\b/, "cardigan"],
  [/\b(sweater|pullover|jumper|sweatshirt|sweat shirt)(s)?\b/, "sweater"],
  [/\b(jacket|fleece)(s)?\b/, "blazer"],
  [/\b(lab coat|uniform|workwear|scrub)(s)?\b/, "lab-coat"],

  // Bottoms.
  [/\b(skirt)(s)?\b/, "skirt"],

  // Dresses & women's.
  [/\b(dress|gown|frock|blouse)(es|s)?\b/, "dress"],
  [/\b(lingerie|panty|panties|bra|bras|brief|briefs|underwear|underwears|bikini)\b/, "lingerie"],
  [/\b(boxer|boxers|boxer short|boxer shorts)\b/, "boxer"],

  // Sport / athletic.
  [/\b(athletic wear|athleisure|active ?wear)\b/, "athletic-wear"],
  [/\b(sport ?wear|sportswear|swim ?wear|swim ?shorts|jogging|jogger|tracksuit)(s)?\b/, "sportswear"],

  // Gendered general apparel — must be lower priority than specific items above.
  [/\b(women's|womens|ladies)\s+(apparel|wear|clothing|garment|garments)\b/, "womens-apparel"],
  [/\b(unisex|gender ?neutral)\s+(apparel|wear|clothing|garment|garments)?\b/, "unisex-apparel"],

  // Materials / inputs.
  [/\b(yarn|greige yarn|dyed yarn)(s)?\b/, "yarn"],
  [/\b(fabric|dyed fabric|printed fabric|greige fabric|undyed fabric|textile)(s)?\b/, "fabric"],
  [/\bhome textile(s)?|bed linen|towel|curtain/, "home-textile"],

  // Trims / decoration.
  [/\b(embroidery|embroidered|applique)\b/, "embroidery"],
  [/\b(zipper|zip|fastener)(s)?\b/, "zipper"],
];

export function apparelIconUrl(product: string): string | null {
  const key = apparelIconKey(product);
  return key ? `${CDN}/${key}.svg` : null;
}

export function apparelIconKey(product: string): ApparelIconKey | null {
  if (!product) return null;
  const n = normalise(product);
  if (!n) return null;
  for (const [re, key] of RULES) {
    if (re.test(n)) return key;
  }
  return null;
}
