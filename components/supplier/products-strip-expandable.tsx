"use client";

import { useState } from "react";

// I-011 / elegance pass — dedup + clean text chips (no per-product icons).
// `principal_products` is the union of BGMEA ∪ EPB ∪ BKMEA raw vendor strings
// (migration 0006). The same garment surfaces as Shirt/Shirts, Pyjamas/Pajamas,
// etc. Collapse at the render layer; keep the longest original as the display.

function stripMarker(raw: string): string {
  // Source data sometimes tags products with trailing badges like
  // "Cardigan (A)", "Polo Shirt (B)", "Knit Top (I)" — internal BGMEA /
  // EPB sub-classification codes. They mean nothing to a buyer, so peel
  // any trailing parenthesised 1–3 alphanumeric token before display +
  // dedup. Repeat once in case two markers stack (e.g. "Shirt (A) (B)").
  let s = raw.trim();
  for (let i = 0; i < 2; i++) {
    s = s
      .replace(/^\(\s*[A-Za-z0-9]{1,3}\s*\)\s*/, "")
      .replace(/\s*\(\s*[A-Za-z0-9]{1,3}\s*\)\s*$/, "")
      .trim();
  }
  return s;
}

function canonicalKey(raw: string): string {
  let s = stripMarker(raw).toLowerCase().trim();
  s = s.replace(/[`'\u2018\u2019\u02bc]/g, "'");
  s = s.replace(/^all\s+kinds?\s+of\s+/, "");
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
  if (s.endsWith("ies") && s.length > 4) {
    s = s.slice(0, -3) + "y";
  } else if (s.endsWith("es") && s.length > 3 && !s.endsWith("ses")) {
    s = s.slice(0, -2);
  } else if (s.endsWith("s") && s.length > 2 && !s.endsWith("ss")) {
    s = s.slice(0, -1);
  }
  return s;
}

function dedupProducts(products: readonly string[]): string[] {
  const groups = new Map<string, string>();
  for (const raw of products) {
    if (!raw) continue;
    const trimmed = stripMarker(raw);
    if (!trimmed) continue;
    const key = canonicalKey(trimmed);
    if (!key) continue;
    const existing = groups.get(key);
    if (!existing || trimmed.length > existing.length) {
      groups.set(key, trimmed);
    }
  }
  return Array.from(groups.values());
}

export function ProductsStripExpandable({ products }: { products: string[] }) {
  const unique = dedupProducts(products);
  const [expanded, setExpanded] = useState(false);
  const limit = 6;
  const overflow = Math.max(0, unique.length - limit);
  const shown = expanded || overflow === 0 ? unique : unique.slice(0, limit);
  return (
    <div className="products-strip">
      <span className="products-label">Principal products</span>
      <div className="product-list">
        {shown.map((p) => (
          <ProductChip key={p} product={p} />
        ))}
        {overflow > 0 && !expanded ? (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="product product-toggle"
          >
            + {overflow} more
          </button>
        ) : null}
        {expanded && unique.length > limit ? (
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="product product-toggle muted"
          >
            Show less
          </button>
        ) : null}
      </div>
    </div>
  );
}

// Generic RMG fallback: clothes-hanger glyph. Vendor-neutral; used when
// `apparelIconUrl()` returns null so a chip never renders without an icon.
function ProductChip({ product }: { product: string }) {
  return (
    <span className="product">
      <span className="product-label">{product}</span>
    </span>
  );
}
