"use client";

import { useState } from "react";

import { correctProductSpelling } from "@/lib/product-icons";

const VISIBLE_LIMIT = 16;

/** Plain-text chip list for the "Also produces" overflow — no icons, capped
 *  at 16 chips with a "+N more" chip that expands the rest in place. */
export function AlsoProducesChips({ products }: { products: string[] }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? products : products.slice(0, VISIBLE_LIMIT);
  const remaining = products.length - VISIBLE_LIMIT;

  return (
    <div className="flex flex-wrap gap-1.5 sm:gap-1.5">
      {visible.map((product) => (
        <span
          key={product}
          className="rounded-pill bg-neutral-100 px-2 py-[3px] text-[12.5px] leading-5 text-neutral-700 sm:px-2.5 sm:py-1 sm:text-[13.5px]"
        >
          {correctProductSpelling(product)}
        </span>
      ))}
      {!expanded && remaining > 0 ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="rounded-pill bg-neutral-100 px-2 py-[3px] text-[12.5px] font-semibold leading-5 text-brand-forest transition-colors duration-150 hover:bg-brand-forest-soft sm:px-2.5 sm:py-1 sm:text-[13.5px]"
        >
          +{remaining} more
        </button>
      ) : null}
    </div>
  );
}
