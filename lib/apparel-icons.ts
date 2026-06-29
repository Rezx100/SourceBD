// Apparel icon lookup — local Principal products icon set at /icons/products/.
// Each supplier's principal_products row (free-text) is normalised then matched
// against the patterns below; returns the local icon URL or null if no icon fits.
//
// Coverage tuned to the actual histogram of `principal_products` values
// observed in production (top ~200 distinct values). Non-apparel items
// (packaging, labels, paperboard, etc.) intentionally return null and fall
// back to the generic diamond bullet.

import { productIconPath, type ProductIconSlug } from "@/lib/product-icons";

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

/** Maps legacy apparel keys to Principal products icon slugs. */
const KEY_TO_SLUG: Record<ApparelIconKey, ProductIconSlug> = {
  "athletic-wear": "jogger",
  blazer: "jacket",
  boxer: "boxers",
  cardigan: "cardigan",
  "childrens-denim": "children-clothes",
  dress: "dress",
  embroidery: "shirt",
  fabric: "shirt",
  "home-textile": "scarf",
  hoodie: "hoodie",
  "knit-and-woven": "shirt",
  knit: "jumper",
  "knitted-shirt": "jumper",
  "lab-coat": "coat",
  lingerie: "bikini",
  "mens-denim": "jeans",
  polo: "polo",
  skirt: "skirt",
  sportswear: "jogger",
  sweater: "sweater",
  tshirt: "t-shirt",
  "unisex-apparel": "t-shirt",
  "womens-apparel": "dress",
  "womens-denim": "jeans",
  yarn: "sweater",
  zipper: "zipper",
};

function normalise(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[`'\u2018\u2019\u02bc]/g, "'")
    .replace(/[-_/+&]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const RULES: ReadonlyArray<readonly [RegExp, ApparelIconKey]> = [
  [/\b(men's|mens|gent's|gents)\s+(denim|jeans)/, "mens-denim"],
  [/\b(women's|womens|ladies)\s+(denim|jeans)/, "womens-denim"],
  [
    /\b(children's|childrens|kids|boy's|girl's|baby's|babies')\s+(denim|jeans)/,
    "childrens-denim",
  ],
  [/\b(denim|jeans)\b/, "mens-denim"],
  [/\bt[\s-]?shirt(s)?\b/, "tshirt"],
  [/\btee(s)?\b/, "tshirt"],
  [/\b(polo|tennis)\b/, "polo"],
  [/\bknitted shirts?\b/, "knitted-shirt"],
  [/\bknit and woven\b/, "knit-and-woven"],
  [/\bknitwear|knit items?|knit garment|knitted garment|all kind of knit/, "knit"],
  [/\bknit\b/, "knit"],
  [/\bwoven (shirts?|tops?|bottoms?)\b/, "knit-and-woven"],
  [/\bwoven\b/, "knit-and-woven"],
  [/\b(hoody|hoodies|hoodie|hooded)\b/, "hoodie"],
  [/\bblazer(s)?\b/, "blazer"],
  [/\bcardigan(s)?\b/, "cardigan"],
  [/\b(sweater|pullover|jumper|sweatshirt|sweat shirt)(s)?\b/, "sweater"],
  [/\b(jacket|fleece)(s)?\b/, "blazer"],
  [/\b(lab coat|uniform|workwear|scrub)(s)?\b/, "lab-coat"],
  [/\b(skirt)(s)?\b/, "skirt"],
  [/\b(dress|gown|frock|blouse)(es|s)?\b/, "dress"],
  [/\b(lingerie|panty|panties|bra|bras|brief|briefs|underwear|underwears|bikini)\b/, "lingerie"],
  [/\b(boxer|boxers|boxer short|boxer shorts)\b/, "boxer"],
  [/\b(athletic wear|athleisure|active ?wear)\b/, "athletic-wear"],
  [/\b(sport ?wear|sportswear|swim ?wear|swim ?shorts|jogging|jogger|tracksuit)(s)?\b/, "sportswear"],
  [/\b(women's|womens|ladies)\s+(apparel|wear|clothing|garment|garments)\b/, "womens-apparel"],
  [/\b(unisex|gender ?neutral)\s+(apparel|wear|clothing|garment|garments)?\b/, "unisex-apparel"],
  [/\b(yarn|greige yarn|dyed yarn)(s)?\b/, "yarn"],
  [/\b(fabric|dyed fabric|printed fabric|greige fabric|undyed fabric|textile)(s)?\b/, "fabric"],
  [/\bhome textile(s)?|bed linen|towel|curtain/, "home-textile"],
  [/\b(embroidery|embroidered|applique)\b/, "embroidery"],
  [/\b(zipper|zip|fastener)(s)?\b/, "zipper"],
];

export function apparelIconUrl(product: string): string | null {
  const key = apparelIconKey(product);
  return key ? productIconPath(KEY_TO_SLUG[key]) : null;
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
