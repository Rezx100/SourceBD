"use client";

import { useEffect } from "react";

const KEY = "sourcebd.recent-searches";
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
      .filter((r): r is RecentSearch => !!r && typeof r === "object" && typeof (r as RecentSearch).href === "string")
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
