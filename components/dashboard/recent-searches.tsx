"use client";

import { useEffect, useState } from "react";
import { formatCount } from "@/lib/dashboard/facts";
import { Count } from "./controls";
import { Eyebrow } from "./type";
import { readRecentSearches, type RecentSearch } from "./record-recent-search";

export function RecentSearchesSlot({ items }: { items: readonly RecentSearch[] }) {
  const [live, setLive] = useState<readonly RecentSearch[]>(items);
  useEffect(() => {
    if (items.length > 0) {
      setLive(items);
      return;
    }
    setLive(readRecentSearches());
  }, [items]);
  if (live.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <Eyebrow className="px-2">Recent searches</Eyebrow>
      <div className="flex flex-col">
        {live.map((r) => (
          <a
            key={r.href + r.label}
            href={r.href}
            // The label is ellipsised to one line, so the full query is only
            // available on hover without this.
            title={r.label}
            className="block overflow-hidden text-ellipsis whitespace-nowrap rounded-sm px-2 py-[5px] text-sm text-ink hover:bg-surface-sunken"
          >
            {r.label}
            {r.count !== null ? <Count className="ml-1.5">{formatCount(r.count)}</Count> : null}
          </a>
        ))}
      </div>
    </div>
  );
}
