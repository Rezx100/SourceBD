"use client";

import { useState } from "react";

import { apparelIconUrl } from "@/lib/apparel-icons";

// I-011 — dedup, RMG fallback icon, larger icons + text.
// `principal_products` is the union of BGMEA ∪ EPB ∪ BKMEA raw vendor strings
// (migration 0006). The same garment surfaces as Shirt/Shirts, Pyjamas/Pajamas,
// etc. Collapse at the render layer; keep the longest original as the display.

function canonicalKey(raw: string): string {
  let s = raw.toLowerCase().trim();
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
    const trimmed = raw.trim();
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
function HangerIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={22}
      height={22}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="product-icon product-icon-fallback"
    >
      <path d="M12 9.5a2 2 0 1 1 2-2" />
      <path d="M12 9.5L3.4 15.4a1 1 0 0 0 .58 1.82h16.04a1 1 0 0 0 .58-1.82L12 9.5z" />
    </svg>
  );
}

function ProductChip({ product }: { product: string }) {
  const icon = apparelIconUrl(product);
  return (
    <span className="product">
      {icon ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={icon}
          alt=""
          width={22}
          height={22}
          loading="lazy"
          className="product-icon"
        />
      ) : (
        <HangerIcon />
      )}
      <span className="product-label">{product}</span>
    </span>
  );
}
