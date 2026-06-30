export function stripProductMarker(raw: string): string {
  let s = raw.trim();
  for (let i = 0; i < 2; i++) {
    s = s
      .replace(/^\(\s*[A-Za-z0-9]{1,3}\s*\)\s*/, "")
      .replace(/\s*\(\s*[A-Za-z0-9]{1,3}\s*\)\s*$/, "")
      .trim();
  }
  return s;
}

/** Common BGMEA harvest typos — display + canonical normalisation (DB untouched). */
const PRODUCT_WORD_SPELLING: Record<string, string> = {
  jens: "Jeans",
  juns: "Jeans",
  jean: "Jeans",
  payjama: "Pajama",
  payjamas: "Pajamas",
  bouses: "Blouse",
  knitware: "Knitwear",
  knitwares: "Knitwear",
  garmet: "Garment",
  garmets: "Garments",
  underware: "Underwear",
  jaket: "Jacket",
  jacet: "Jacket",
  jackt: "Jacket",
  shrit: "Shirt",
  shiirt: "Shirt",
  trouse: "Trouser",
  childrean: "Children",
  ladis: "Ladies",
  colar: "Collar",
  coller: "Collar",
  lable: "Label",
  lables: "Labels",
  ziper: "Zipper",
  zippe: "Zipper",
  elasic: "Elastic",
  cartn: "Carton",
  hager: "Hanger",
  hangar: "Hanger",
};

const PRODUCT_PHRASE_SPELLING: Record<string, string> = {
  "denim jens": "Denim Jeans",
  "denim jean": "Denim Jeans",
  "knit shrit": "Knit Shirt",
  "knit shrits": "Knit Shirts",
  "woven shrit": "Woven Shirt",
  "polo shrit": "Polo Shirt",
  "t shrt": "T-Shirt",
  "t shrit": "T-Shirt",
};

/** Split BGMEA compound labels (Sweater/Jacket, T-Shirt/Polo Shirt) into separate products. */
function splitCompoundProduct(raw: string): string[] {
  const trimmed = stripProductMarker(raw);
  if (!trimmed) return [];

  const parts = trimmed.split(/\s*[\/&+]\s*/);
  if (parts.length <= 1) return [correctProductSpelling(trimmed)];

  return parts
    .map((part) => correctProductSpelling(part.trim()))
    .filter(Boolean);
}

/** Correct known principal-product typos for frontend display (DB unchanged). */
export function correctProductSpelling(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;

  const phraseKey = trimmed.toLowerCase().replace(/\s+/g, " ");
  const phraseHit = PRODUCT_PHRASE_SPELLING[phraseKey];
  if (phraseHit) return phraseHit;

  return trimmed
    .split(/\s+/)
    .map((word) => {
      const hit = PRODUCT_WORD_SPELLING[word.toLowerCase()];
      return hit ?? word;
    })
    .join(" ");
}

/** Singularise one product token for dedup (leggings → legging, shirts → shirt). */
const TOKEN_SINGULAR: Record<string, string> = {
  ladies: "lady",
  babies: "baby",
  mens: "men",
  womens: "women",
  jeans: "jean",
  shorts: "short",
  trousers: "trouser",
  pants: "pant",
};

function singularizeToken(token: string): string {
  const mapped = TOKEN_SINGULAR[token];
  if (mapped) return mapped;
  if (token.endsWith("ies") && token.length > 4) {
    return token.slice(0, -3) + "y";
  }
  if (token.endsWith("es") && token.length > 3 && !token.endsWith("ses")) {
    return token.slice(0, -2);
  }
  if (token.endsWith("s") && token.length > 2 && !token.endsWith("ss")) {
    return token.slice(0, -1);
  }
  return token;
}

function singularizePhrase(key: string): string {
  return key
    .split(" ")
    .map(singularizeToken)
    .join(" ")
    .trim();
}

export function productCanonicalKey(raw: string): string {
  let s = correctProductSpelling(stripProductMarker(raw)).toLowerCase().trim();
  s = s.replace(/[`'\u2018\u2019\u02bc]/g, "'");
  s = s.replace(/^all\s+kinds?\s+of\s+/, "");
  s = s.replace(/^all\s+types?\s+of\s+/, "");
  s = s.replace(/\bpayjama\b/g, "pajamas");
  s = s.replace(/\bcollar bone\b/g, "neck board");
  s = s.replace(/\bcollarbone\b/g, "neck board");
  s = s.replace(/\bcollar board\b/g, "neck board");
  s = s.replace(/\bbar code\b/g, "barcode");
  s = s.replace(/\bhang tag\b/g, "price tag");
  s = s.replace(/\bsize tag\b/g, "price tag");
  s = s.replace(/\bswing tag\b/g, "price tag");
  s = s.replace(/\bswingticket\b/g, "price tag");
  s = s.replace(/\bblack board\b/g, "back board");
  s = s.replace(/\bblackboard\b/g, "back board");
  s = s.replace(/\bbackboard\b/g, "back board");
  s = s.replace(/\bpolybag\b/g, "poly bag");
  s = s.replace(/\bjens\b/g, "jeans");
  s = s.replace(/\bbouses\b/g, "blouse");
  s = s.replace(/\bblouses\b/g, "blouse");
  s = s.replace(/\bpyjamas?\b/g, "pajamas");
  s = s.replace(/\bpajama\b/g, "pajamas");
  s = s.replace(/\btee[\s-]?shirts?\b/g, "t-shirts");
  s = s.replace(/\bt[\s-]?shirts?\b/g, "t-shirts");
  s = s.replace(/\bpolo[\s-]?shirts?\b/g, "polo shirts");
  s = s.replace(/\bsweat[\s-]?shirts?\b/g, "sweatshirts");
  s = s.replace(/\bunder[\s-]?wears?\b/g, "underwear");
  s = s.replace(/\bnight[\s-]?wears?\b/g, "nightwear");
  s = s.replace(/\bsports?[\s-]?wears?\b/g, "sportswear");
  // Hyphen/underscore only — slash, ampersand, and plus split in splitCompoundProduct().
  s = s.replace(/[-_]/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  // Normalise common RMG plurals before naive trailing-s stripping.
  s = s.replace(/\btextiles\b/g, "textile");
  s = s.replace(/\bfabrics\b/g, "fabric");
  s = s.replace(/\baccessories\b/g, "accessory");
  s = s.replace(/\bgarments\b/g, "garment");
  s = singularizePhrase(s);
  return s;
}

/** Coarser grouping key for frontend dedup — merges near-duplicates, not DB values. */
const DEDUP_EQUIVALENTS: Record<string, string> = {
  "knit garment": "knitwear",
  "knitted garment": "knitwear",
  "knit item": "knitwear",
  "all kind of knit": "knitwear",
  "all knit item": "knitwear",
  "woven garment": "woven",
  "carton": "carton box",
  tissue: "tissue paper",
  tag: "price tag",
  "bar code": "barcode",
  jean: "jeans",
};

/** Drop generic chip when a more specific sibling exists in the same supplier list. */
const GENERIC_SUPPRESSED_BY: Record<string, readonly string[]> = {
  label: [
    "printed label",
    "care label",
    "wash label",
    "brand label",
    "clothing label",
    "woven label",
  ],
  tag: ["price tag", "hang tag", "size tag", "swing tag"],
  board: ["back board", "neck board", "black board", "paper board"],
  paper: ["tissue paper", "paper board", "photo card"],
  bag: ["poly bag", "polybag"],
  carton: ["carton box"],
  shirt: ["t-shirt", "polo shirt", "knit shirt", "denim shirt", "woven shirt"],
  pant: ["denim pant", "cargo pant", "trouser", "jean", "jeans"],
  jacket: ["denim jacket", "knit jacket", "leather jacket", "fleece jacket", "blazer"],
  denim: ["jean", "jeans", "denim pant", "denim jacket", "denim shirt", "denim bottom"],
  garment: ["knitwear", "woven", "knit garment", "woven garment"],
};

export function productDedupKey(raw: string): string {
  let key = productCanonicalKey(raw);
  for (;;) {
    const next = DEDUP_EQUIVALENTS[key];
    if (next === undefined) break;
    key = next;
  }
  return key;
}

/** Preferred chip label when equivalents collapse to one dedup group. */
const DEDUP_PREFERRED_LABEL: Record<string, string> = {
  "back board": "Back Board",
  "neck board": "Neck Board",
  "price tag": "Hang Tag",
  "poly bag": "Poly Bag",
  "carton box": "Carton Box",
  "tissue paper": "Tissue Paper",
  barcode: "Barcode",
  knitwear: "Knitwear",
  jeans: "Jeans",
};

function pickDisplayLabel(dedupKey: string, candidates: readonly string[]): string {
  const preferred = DEDUP_PREFERRED_LABEL[dedupKey];
  if (preferred) {
    const preferredKey = productCanonicalKey(preferred);
    const exact = candidates.find((c) => c.toLowerCase() === preferred.toLowerCase());
    if (exact) return exact;
    const canonical = candidates.find((c) => productCanonicalKey(c) === preferredKey);
    if (canonical) return canonical;
  }
  // Prefer plural chip label when merging singular/plural variants (Shirt + Shirts → Shirts).
  const plural = candidates.filter((c) => {
    const t = c.trim();
    return /s$/i.test(t) && !/ss$/i.test(t);
  });
  if (plural.length > 0) {
    return plural.reduce((best, cur) => (cur.length > best.length ? cur : best));
  }
  return candidates.reduce((best, cur) => (cur.length > best.length ? cur : best));
}

export function dedupProducts(products: readonly string[]): string[] {
  const entries: { trimmed: string; dedupKey: string }[] = [];
  for (const raw of products) {
    if (!raw) continue;
    for (const trimmed of splitCompoundProduct(raw)) {
      if (!trimmed) continue;
      const dedupKey = productDedupKey(trimmed);
      if (!dedupKey) continue;
      entries.push({ trimmed, dedupKey });
    }
  }

  const keysPresent = new Set(entries.map((e) => e.dedupKey));
  const suppressed = new Set<string>();
  for (const [generic, specifics] of Object.entries(GENERIC_SUPPRESSED_BY)) {
    if (!keysPresent.has(generic)) continue;
    if (specifics.some((s) => keysPresent.has(s))) {
      suppressed.add(generic);
    }
  }

  const buckets = new Map<string, string[]>();
  for (const { trimmed, dedupKey } of entries) {
    if (suppressed.has(dedupKey)) continue;
    const list = buckets.get(dedupKey) ?? [];
    list.push(trimmed);
    buckets.set(dedupKey, list);
  }

  const seen = new Set<string>();
  const result: string[] = [];
  for (const { dedupKey } of entries) {
    if (suppressed.has(dedupKey) || seen.has(dedupKey)) continue;
    seen.add(dedupKey);
    const candidates = buckets.get(dedupKey) ?? [];
    if (candidates.length === 0) continue;
    result.push(pickDisplayLabel(dedupKey, candidates));
  }
  return result;
}

/** Principal-product icons — Noun Project "Principal products" set (Fahrul Oktaviana). */
const ICON_BASE = "/icons/products";

export const PRODUCT_ICON_SLUGS = [
  "athletic-wear",
  "back-board",
  "bag",
  "barcode",
  "belt",
  "bikini",
  "blouse",
  "bowtie",
  "boxers",
  "bras",
  "cap",
  "cardboard",
  "cardigan",
  "cargo-pants",
  "carton",
  "care-label",
  "children-clothes",
  "coat",
  "denim",
  "dress",
  "elastic",
  "fabric-roll",
  "gloves",
  "hanger",
  "hat",
  "home-textile",
  "hoodie",
  "infant-clothes",
  "jacket",
  "jeans",
  "jogger",
  "jumper",
  "lace",
  "leggings",
  "neck-board",
  "overalls",
  "pajamas",
  "pants",
  "poly-bag",
  "polo",
  "price-tag",
  "printed-label",
  "robe",
  "scarf",
  "shirt",
  "shoes",
  "shorts",
  "skirt",
  "sneakers",
  "socks",
  "stockings",
  "suit",
  "sweater",
  "t-shirt",
  "tie",
  "tissue-paper",
  "trousers",
  "tuxedo",
  "tape",
  "thread",
  "vest",
  "waistcoat",
  "yarn",
  "zipper",
] as const;

export type ProductIconSlug = (typeof PRODUCT_ICON_SLUGS)[number];

export function productIconPath(slug: ProductIconSlug): string {
  return `${ICON_BASE}/${slug}.png`;
}

export function productIconUrl(product: string): string {
  const key = productCanonicalKey(product);

  // Packaging & paperboard — dedicated icons (not handbag).
  if (/\b(barcode|bar code)\b/.test(key)) return productIconPath("barcode");
  if (/\b(carton box|carton|corrugated)\b/.test(key)) return productIconPath("carton");
  if (/\b(poly bag|polybag)\b/.test(key)) return productIconPath("poly-bag");
  if (/\b(back board|backboard|black board|blackboard)\b/.test(key)) {
    return productIconPath("back-board");
  }
  if (/\b(neck board|collar bone|collarbone|collar board)\b/.test(key)) {
    return productIconPath("neck-board");
  }
  if (/\b(tissue paper|tissue)\b/.test(key)) return productIconPath("tissue-paper");
  if (/\b(photo card|paper board|paperboard|cardboard)\b/.test(key)) {
    return productIconPath("cardboard");
  }
  if (/\b(pvc box|\bbox\b|packaging|packing material)\b/.test(key)) {
    return productIconPath("carton");
  }
  if (/\b(ldpe|hdpe|pp\b|pvc\b)\b/.test(key)) return productIconPath("bag");

  // Trims & notions.
  if (/\b(price tag|hang tag|size tag|swing tag|swingticket)\b/.test(key)) {
    return productIconPath("price-tag");
  }
  if (/\btag\b/.test(key)) return productIconPath("price-tag");
  if (/\bprinted label\b/.test(key)) return productIconPath("printed-label");
  if (/\b(care label|wash label|clothing label|brand label)\b/.test(key)) {
    return productIconPath("care-label");
  }
  if (/\blabel\b/.test(key)) return productIconPath("care-label");
  if (/\b(elastic|non elastic|drawcord|ribbon)\b/.test(key)) return productIconPath("elastic");
  if (/\b(gum tape|adhesive tape|sealing tape|\btape\b)\b/.test(key)) return productIconPath("tape");
  if (/\b(sewing thread|thread)\b/.test(key)) return productIconPath("thread");
  if (/\b(lace)\b/.test(key)) return productIconPath("lace");
  if (/\b(trim)\b/.test(key)) return productIconPath("thread");
  if (/\b(zipper|zip|fastener)\b/.test(key)) return productIconPath("zipper");
  if (/\b(button|rivet|snap)\b/.test(key)) return productIconPath("zipper");

  // Raw materials — home textile before generic textile/fabric.
  if (/\b(home textile)\b/.test(key)) return productIconPath("home-textile");
  if (/\b(bed linen|towel|curtain)\b/.test(key)) return productIconPath("scarf");
  if (/\b(yarn|greige yarn|dyed yarn)\b/.test(key)) return productIconPath("yarn");
  if (/\b(fabric|textile|greige fabric|dyed fabric|printed fabric|undyed fabric)\b/.test(key)) {
    return productIconPath("fabric-roll");
  }
  if (/\b(greige|dyed)\b/.test(key) && /\b(fabric|textile|yarn)\b/.test(key)) {
    return productIconPath("fabric-roll");
  }

  // Printing.
  if (/\b(printing|screen print|digital print|all over print)\b/.test(key)) {
    return productIconPath("fabric-roll");
  }

  // Outerwear before generic denim (denim jacket ≠ jeans).
  if (/\b(blazer|jacket|fleece)\b/.test(key)) return productIconPath("jacket");
  if (/\bdenim\b.*\b(jacket|coat)\b|\b(jacket|coat)\b.*\bdenim\b/.test(key)) {
    return productIconPath("jacket");
  }
  if (/\bdenim\b.*\b(shirt|top|blouse)\b|\b(shirt|top|blouse)\b.*\bdenim\b/.test(key)) {
    return productIconPath("shirt");
  }

  // Denim bottoms / generic denim.
  if (/\b(men's|mens|gent's|gents)\s+(denim|jean)/.test(key)) {
    return productIconPath("jeans");
  }
  if (/\b(women's|womens|ladies)\s+(denim|jean)/.test(key)) {
    return productIconPath("jeans");
  }
  if (/\b(children's|childrens|kids|boy's|girl's|baby's|babies')\s+(denim|jean)/.test(key)) {
    return productIconPath("children-clothes");
  }
  if (/\b(denim pant|denim trouser|denim bottom)\b/.test(key)) return productIconPath("jeans");
  if (/\b(denim|jean)\b/.test(key)) return productIconPath("jeans");

  // Bottoms before generic woven/knit.
  if (/\b(legging|leggings)\b/.test(key)) return productIconPath("leggings");
  if (/\b(woven\s+bottom|knitted\s+bottom|knit\s+bottom|\bbottoms?\b)/.test(key)) {
    return productIconPath("trousers");
  }
  if (/\bskirt\b/.test(key)) return productIconPath("skirt");
  if (/\boveralls?\b/.test(key)) return productIconPath("overalls");
  if (/\bcargo pant\b/.test(key)) return productIconPath("cargo-pants");
  if (/\b(trouser|pant)\b/.test(key)) return productIconPath("trousers");
  if (/\bshort\b/.test(key)) return productIconPath("shorts");
  if (/\b(jogger|jogging|tracksuit)\b/.test(key)) return productIconPath("jogger");

  // Shirts & tops — specific before generic.
  if (/\bt[\s-]?shirt|tee\b/.test(key)) return productIconPath("t-shirt");
  if (/\bpolo\b/.test(key)) return productIconPath("polo");
  if (/\b(tank top|singlet|camisole)\b/.test(key)) return productIconPath("vest");
  if (/\b(ladies\s+blouse|blouse)\b/.test(key)) return productIconPath("blouse");
  if (/\bknitted shirt\b/.test(key)) return productIconPath("jumper");
  if (/\bknit shirt\b/.test(key)) return productIconPath("shirt");
  if (/\bknit and woven\b/.test(key)) return productIconPath("shirt");
  if (/\bknitwear|knit garment|knitted garment|all kind of knit|all knit item/.test(key)) {
    return productIconPath("jumper");
  }
  if (/\bknit\b/.test(key)) return productIconPath("jumper");
  if (/\bwoven\s+top|\bwoven\b/.test(key)) return productIconPath("shirt");
  if (/\bshirt\b/.test(key)) return productIconPath("shirt");

  // Outerwear & layering (coats etc.).
  if (/\b(hoody|hoodie|hooded|sweatshirt)\b/.test(key)) {
    return productIconPath("hoodie");
  }
  if (/\bcardigan\b/.test(key)) return productIconPath("cardigan");
  if (/\b(sweater|pullover)\b/.test(key)) return productIconPath("sweater");
  if (/\bjumper\b/.test(key)) return productIconPath("jumper");
  if (/\b(tuxedo)\b/.test(key)) return productIconPath("tuxedo");
  if (/\b(waistcoat|vest)\b/.test(key)) return productIconPath("vest");
  if (/\b(lab coat|uniform|workwear|scrub)\b/.test(key)) {
    return productIconPath("coat");
  }
  if (/\b(coat|outerwear|overcoat)\b/.test(key)) return productIconPath("coat");
  if (/\bsuit\b/.test(key)) return productIconPath("suit");

  // Dresses & women's.
  if (/\b(dress|gown|frock)\b/.test(key)) return productIconPath("dress");

  // Intimate / hosiery.
  if (/\b(lingerie|panty|panties|brief|underwear|underpant|bikini)\b/.test(key)) {
    return productIconPath("bikini");
  }
  if (/\b(bra|bras)\b/.test(key)) return productIconPath("bras");
  if (/\b(boxer|boxers)\b/.test(key)) return productIconPath("boxers");
  if (/\b(pajama|nightwear|robe|nightdress)\b/.test(key)) {
    return productIconPath("pajamas");
  }
  if (/\b(sock|hosiery|stocking)\b/.test(key)) return productIconPath("socks");

  // Sport / athletic.
  if (/\b(athletic wear|athleticwear|athleisure)\b/.test(key)) {
    return productIconPath("athletic-wear");
  }
  if (/\b(athletic|sport|sportswear|activewear|swimwear|swim)\b/.test(key)) {
    return productIconPath("jogger");
  }

  // Children & gendered general apparel.
  if (/\b(babies'|baby's|babies|baby|infant|newborn)\s+(apparel|wear|clothing|garment)/.test(key)) {
    return productIconPath("infant-clothes");
  }
  if (/\b(children's|childrens|children|child|kids'|kids|kid)\s+(apparel|wear|clothing|garment)/.test(key)) {
    return productIconPath("children-clothes");
  }
  if (/\b(infant|baby|babies|newborn)\b/.test(key)) {
    return productIconPath("infant-clothes");
  }
  if (/\b(children|child|kid|kids|kids wear|kidswear)\b/.test(key)) {
    return productIconPath("children-clothes");
  }
  if (/\b(women's|womens|ladies|women)\s+(apparel|wear|clothing|garment)/.test(key)) {
    return productIconPath("dress");
  }
  if (/\b(men's|mens|gent's|gents|men)\s+(apparel|wear|clothing|garment)/.test(key)) {
    return productIconPath("shirt");
  }
  if (/\bunisex\b/.test(key) || /\bgender neutral\b/.test(key)) {
    return productIconPath("shirt");
  }

  // Embroidery & accessories.
  if (/\b(embroidery|embroidered|applique)\b/.test(key)) {
    return productIconPath("shirt");
  }
  if (/\b(worn accessory|garment accessory|accessory|accessories)\b/.test(key)) {
    return productIconPath("bag");
  }
  if (/\b(hanger|coat hanger)\b/.test(key)) return productIconPath("hanger");
  if (/\b(bag|purse|wallet|luggage|briefcase)\b/.test(key)) return productIconPath("bag");
  if (/\b(hat)\b/.test(key)) return productIconPath("hat");
  if (/\b(cap|headwear)\b/.test(key)) return productIconPath("cap");
  if (/\b(scarf|shawl)\b/.test(key)) return productIconPath("scarf");
  if (/\b(belt)\b/.test(key)) return productIconPath("belt");
  if (/\b(tie|bowtie|bow tie)\b/.test(key)) return productIconPath("tie");
  if (/\bgloves?\b/.test(key)) return productIconPath("gloves");

  // Footwear.
  if (/\b(sneaker|trainer|running shoe)\b/.test(key)) return productIconPath("sneakers");
  if (/\b(shoe|footwear|boot|sandal|slipper|loafer|heel)\b/.test(key)) {
    return productIconPath("shoes");
  }

  return productIconPath("shirt");
}
