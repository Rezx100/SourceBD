"use client";

// Recent searches on the landing (Paper `10 · Search landing`): the last three the buyer ran,
// remembered in this browser only (`record-recent-search.tsx` writes them from the results).
// Nothing is drawn until the browser has been asked: the server cannot know, and an empty
// heading would flash. No searches yet draws nothing at all.

import { useEffect, useState } from "react";
import { readRecentSearches, type RecentSearch } from "./record-recent-search";
import { Count, LinkRow, LinkRows, h2, supplierCount } from "./rows";

export function RecentSearches() {
  const [items, setItems] = useState<readonly RecentSearch[]>([]);
  useEffect(() => setItems(readRecentSearches()), []);
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="recent-searches" className="flex flex-col gap-2">
      <h2 id="recent-searches" className={h2}>
        Recent searches
      </h2>
      <LinkRows>
        {items.map((r) => (
          <LinkRow key={r.href} href={r.href} label={r.label} count={r.count === null ? null : <Count>{supplierCount(r.count)}</Count>} />
        ))}
      </LinkRows>
    </section>
  );
}
