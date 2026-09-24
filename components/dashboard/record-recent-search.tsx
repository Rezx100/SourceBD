"use client";

import { useEffect } from "react";

const KEY = "sourcebd.recent-searches";
/**
 * A base no site can be. `new URL(href, SENTINEL_ORIGIN).origin` staying equal
 * to it is the only reliable way to say "this href is a path on this site" —
 * see `readRecentSearches`.
 */
const SENTINEL_ORIGIN = "https://recent-search-sentinel.invalid";
const MAX = 3;

export type RecentSearch = { label: string; href: string; count: number | null };

export function readRecentSearches(): RecentSearch[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((r): r is RecentSearch => {
        if (!r || typeof r !== "object") return false;
        const href = (r as RecentSearch).href;
        // Whatever is in this key is rendered straight into an `<a href>`. It
        // is same-origin storage, so writing it needs an XSS, an extension or
        // the machine — but a hostile href parked here then fires every time
        // the buyer opens the sidebar, which turns a foothold somebody already
        // had into a durable one.
        //
        // `startsWith("/") && !startsWith("//")` was the obvious check and
        // three reviewers walked through it five ways. The URL parser folds a
        // backslash into a slash at the start of a path and strips tab, LF and
        // CR from a URL entirely, so `/\evil.example`, `/<TAB>/evil.example`
        // and `/<LF>//evil.example` are all protocol-relative by the time a
        // browser resolves them. String prefixes cannot see that; only a
        // parser can. Resolve it against a sentinel origin and require that it
        // stayed there.
        if (typeof href !== "string") return false;
        try {
          return new URL(href, SENTINEL_ORIGIN).origin === SENTINEL_ORIGIN;
        } catch {
          return false;
        }
      })
      .slice(0, MAX);
  } catch {
    return [];
  }
}

export function pushRecent(list: RecentSearch[], entry: RecentSearch, max = MAX): RecentSearch[] {
  if (!entry.href) return list.slice(0, max);
  return [entry, ...list.filter((r) => r.href !== entry.href)].slice(0, max);
}

export function RecordRecentSearch({ label, href, count }: RecentSearch) {
  useEffect(() => {
    const next = pushRecent(readRecentSearches(), { label, href, count });
    try {
      window.localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // quota
    }
  }, [label, href, count]);
  return null;
}
