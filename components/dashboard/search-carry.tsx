"use client";

// The topbar search is the one search field in the app, on the results page
// too (the filter bar carries chips, not a second box). Typing a new query
// there must not throw the buyer's filters away, so on /app/discover the
// current filters ride along as hidden fields; the text, the page and the
// open record do not — a new query starts on page 1 with nothing open.

import { usePathname, useSearchParams } from "next/navigation";

const DROP = new Set(["q", "page", "record", "line", "lines"]);

/** The params the search form carries from `pathname`'s URL; none off the results page. */
export function carriedParams(pathname: string, params: Iterable<[string, string]>): [string, string][] {
  if (pathname !== "/app/discover") return [];
  return [...params].filter(([k]) => !DROP.has(k));
}

export function SearchCarry() {
  const pathname = usePathname() ?? "";
  const params = useSearchParams();
  return (
    <>
      {carriedParams(pathname, params ?? []).map(([k, v], i) => (
        <input key={`${k}-${i}`} type="hidden" name={k} value={v} />
      ))}
    </>
  );
}
