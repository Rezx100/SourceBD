"use client";

import { useState } from "react";

import { ProductIcon } from "@/components/supplier/product-icon";
import { dedupProducts } from "@/lib/product-icons";

// Principal products strip — matches Discover result-card product chips
// (icon inline in pill, no nested icon box).

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

function ProductChip({ product }: { product: string }) {
  return (
    <span className="product product-chip-flat">
      <ProductIcon product={product} className="product-icon preview-product-icon" />
      <span className="product-label">{product}</span>
    </span>
  );
}
