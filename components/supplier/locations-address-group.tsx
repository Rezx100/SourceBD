"use client";

import { useState } from "react";
import type { ReactNode } from "react";

const VISIBLE_LIMIT = 5;

export function LocationsAddressGroup({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  /** One `<AddressRow>`-shaped element per address — this component only
   *  controls how many are visible. */
  children: ReactNode[];
}) {
  const [expanded, setExpanded] = useState(false);
  if (children.length === 0) return null;
  const visible = expanded ? children : children.slice(0, VISIBLE_LIMIT);
  const remaining = children.length - VISIBLE_LIMIT;

  return (
    <div>
      <div className="flex items-center gap-2">
        <span className="text-[12.5px] font-semibold text-neutral-500">
          {title}
        </span>
        <span className="rounded-full bg-neutral-100 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-neutral-600">
          {count}
        </span>
      </div>
      <div className="mt-1.5 divide-y divide-neutral-100">{visible}</div>
      {!expanded && remaining > 0 ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-1.5 rounded-md px-2 py-1.5 text-[13.5px] font-semibold text-brand-forest transition-colors duration-150 hover:bg-brand-forest-soft"
        >
          Show all {children.length} →
        </button>
      ) : null}
    </div>
  );
}
