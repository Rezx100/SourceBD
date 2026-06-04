"use client";

import { useState } from "react";

export function ProductsStripExpandable({ products }: { products: string[] }) {
  const [expanded, setExpanded] = useState(false);
  const limit = 5;
  const overflow = Math.max(0, products.length - limit);
  const shown = expanded || overflow === 0 ? products : products.slice(0, limit);
  return (
    <div className="products-strip">
      <span className="products-label">Principal products</span>
      <div className="product-list">
        {shown.map((p) => (
          <span key={p} className="product">
            <span aria-hidden style={{ color: "var(--ink-tertiary)" }}>
              ◆
            </span>
            {p}
          </span>
        ))}
        {overflow > 0 && !expanded ? (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="product"
            style={{
              color: "var(--brand-forest)",
              fontWeight: 600,
              background: "transparent",
              border: "none",
              padding: 0,
              cursor: "pointer",
            }}
          >
            + {overflow} more
          </button>
        ) : null}
        {expanded && products.length > limit ? (
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="product"
            style={{
              color: "var(--ink-tertiary)",
              fontWeight: 600,
              background: "transparent",
              border: "none",
              padding: 0,
              cursor: "pointer",
            }}
          >
            Show less
          </button>
        ) : null}
      </div>
    </div>
  );
}
