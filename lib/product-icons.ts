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

export function productCanonicalKey(raw: string): string {
  let s = stripProductMarker(raw).toLowerCase().trim();
  s = s.replace(/[`'\u2018\u2019\u02bc]/g, "'");
  s = s.replace(/^all\s+kinds?\s+of\s+/, "");
  s = s.replace(/^all\s+types?\s+of\s+/, "");
  s = s.replace(/\bpayjama\b/g, "pajamas");
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
  s = s.replace(/[-_/+&]/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  // Normalise common RMG plurals before naive trailing-s stripping.
  s = s.replace(/\btextiles\b/g, "textile");
  s = s.replace(/\bfabrics\b/g, "fabric");
  s = s.replace(/\baccessories\b/g, "accessory");
  s = s.replace(/\bgarments\b/g, "garment");
  if (s.endsWith("ies") && s.length > 4) {
    s = s.slice(0, -3) + "y";
  } else if (s.endsWith("es") && s.length > 3 && !s.endsWith("ses")) {
    s = s.slice(0, -2);
  } else if (s.endsWith("s") && s.length > 2 && !s.endsWith("ss")) {
    s = s.slice(0, -1);
  }
  return s;
}

export function dedupProducts(products: readonly string[]): string[] {
  const groups = new Map<string, string>();
  for (const raw of products) {
    if (!raw) continue;
    const trimmed = stripProductMarker(raw);
    if (!trimmed) continue;
    const key = productCanonicalKey(trimmed);
    if (!key) continue;
    const existing = groups.get(key);
    if (!existing || trimmed.length > existing.length) {
      groups.set(key, trimmed);
    }
  }
  return Array.from(groups.values());
}

/** Principal-product icons — Noun Project "Principal products" set (Fahrul Oktaviana). */
const ICON_BASE = "/icons/products";

export const PRODUCT_ICON_SLUGS = [
  "bag",
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
  "hat",
  "hoodie",
  "infant-clothes",
  "jacket",
  "jeans",
  "jogger",
  "jumper",
  "overalls",
  "pajamas",
  "pants",
  "polo",
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
  "tee",
  "tie",
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
  if (/\b(carton|corrugated)\b/.test(key)) return productIconPath("carton");
  if (/\b(poly bag|polybag)\b/.test(key)) return productIconPath("bag");
  if (
    /\b(back board|neck board|black board|photo card|paper board|paperboard|cardboard|tissue paper|tissue)\b/.test(
      key,
    )
  ) {
    return productIconPath("cardboard");
  }
  if (/\b(carton box|pvc box|\bbox\b|packaging|packing material)\b/.test(key)) {
    return productIconPath("carton");
  }
  if (/\b(ldpe|hdpe|pp\b|pvc\b)\b/.test(key)) return productIconPath("bag");

  // Trims & notions.
  if (/\b(care label|wash label|clothing label|brand label)\b/.test(key)) {
    return productIconPath("care-label");
  }
  if (/\blabel\b/.test(key)) return productIconPath("care-label");
  if (/\b(elastic|non elastic|drawcord|ribbon)\b/.test(key)) return productIconPath("elastic");
  if (/\b(gum tape|adhesive tape|sealing tape|\btape\b)\b/.test(key)) return productIconPath("tape");
  if (/\b(sewing thread|thread)\b/.test(key)) return productIconPath("thread");
  if (/\b(lace|trim)\b/.test(key)) return productIconPath("thread");
  if (/\b(zipper|zip|fastener)\b/.test(key)) return productIconPath("zipper");
  if (/\b(button|rivet|snap)\b/.test(key)) return productIconPath("zipper");

  // Raw materials — home textile before generic textile/fabric.
  if (/\b(home textile|bed linen|towel|curtain)\b/.test(key)) return productIconPath("scarf");
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
  if (/\b(legging|leggings)\b/.test(key)) return productIconPath("jogger");
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
  if (/\bt[\s-]?shirt|tee\b/.test(key)) return productIconPath("shirt");
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
  if (/\b(athletic|sport|sportswear|activewear|athleisure|swimwear|swim)\b/.test(key)) {
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
  if (/\b(hanger|coat hanger)\b/.test(key)) return productIconPath("shirt");
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
