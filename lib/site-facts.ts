// The live figures the public site prints (Paper `30 Marketing`): the supplier count and the latest read
// (`marketing_stats()`, the home page's read) and, from `marketing_facts()` (0117), the sources we list and
// how many hold supplier records, the certificates on file and how many have expired, the RSC records and a row
// per source. Every figure is null until it was read: a page leaves a figure out rather than print a stale or
// invented one, and a database without 0117 simply has fewer figures. Read once and cached ten minutes with
// the anon key; the parsing is pure so a test reads it.

import { unstable_cache } from "next/cache";
import { createClient } from "@supabase/supabase-js";

export type SourceFact = { code: string; tier: string; records: number; suppliers: number; latest: string | null };

export type SiteFacts = {
  suppliers: number | null;
  sourcesListed: number | null;
  sourcesWithRecords: number | null;
  certificatesOnFile: number | null;
  certificatesExpired: number | null;
  rscRecords: number | null;
  /** The day of the latest read, `2026-10-02`, or null. */
  latestRead: string | null;
  sources: SourceFact[] | null;
};

export const NO_FACTS: SiteFacts = { suppliers: null, sourcesListed: null, sourcesWithRecords: null, certificatesOnFile: null, certificatesExpired: null, rscRecords: null, latestRead: null, sources: null };

const count = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : typeof v === "string" && /^\d+$/.test(v) ? Number(v) : null);
const day = (v: unknown): string | null => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v) && !Number.isNaN(Date.parse(v)) ? v.slice(0, 10) : null);

/** `marketing_stats()` and `marketing_facts()` as read; either may be null (a failed read, or no 0117 yet). */
export function parseFacts(stats: unknown, facts: unknown): SiteFacts {
  const s = stats && typeof stats === "object" ? (stats as Record<string, unknown>) : {};
  const f = facts && typeof facts === "object" && !Array.isArray(facts) ? (facts as Record<string, unknown>) : {};
  const rows = Array.isArray(f.sources)
    ? f.sources.flatMap((r): SourceFact[] => {
        if (!r || typeof r !== "object") return [];
        const o = r as Record<string, unknown>;
        const records = count(o.records);
        const suppliers = count(o.suppliers);
        return typeof o.code === "string" && typeof o.tier === "string" && records !== null && suppliers !== null ? [{ code: o.code, tier: o.tier, records, suppliers, latest: day(o.latest) }] : [];
      })
    : null;
  return {
    // The facts function counts the published suppliers too; the stats read is the older, steadier source.
    suppliers: count(s.suppliers_indexed) ?? count(f.suppliers_published),
    sourcesListed: count(f.sources_listed),
    sourcesWithRecords: count(f.sources_with_records),
    certificatesOnFile: count(f.certificates_on_file),
    certificatesExpired: count(f.certificates_expired),
    rscRecords: count(f.rsc_records),
    latestRead: day(f.latest_read) ?? day(s.last_refreshed_at),
    // A list that came back with rows we could not read is not a list.
    sources: rows && rows.length === (f.sources as unknown[]).length ? rows : null,
  };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** `2026-10-03` as "3 Oct 2026". */
export function readDay(iso: string | null): string | null {
  const m = iso ? /^(\d{4})-(\d{2})-(\d{2})/.exec(iso) : null;
  return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}` : null;
}

export const withCommas = (n: number): string => new Intl.NumberFormat("en-GB").format(n);

/** The footer's line: "10,268 suppliers · 25 sources listed · 14 hold supplier records · updated 3 Oct 2026", each part only when read. */
export function factsLine(f: SiteFacts): string | null {
  const parts = [
    f.suppliers !== null ? `${withCommas(f.suppliers)} suppliers` : null,
    f.sourcesListed !== null ? `${f.sourcesListed} sources listed` : null,
    f.sourcesWithRecords !== null ? `${f.sourcesWithRecords} hold supplier records` : null,
    readDay(f.latestRead) ? `updated ${readDay(f.latestRead)}` : null,
  ].filter((p): p is string => p !== null);
  return parts.length ? parts.join(" · ") : null;
}

async function readLive(): Promise<SiteFacts> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return NO_FACTS;
  const sb = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const soft = async (fn: string) => {
    try {
      const { data, error } = await sb.rpc(fn);
      return error ? null : data;
    } catch {
      return null;
    }
  };
  const [stats, facts] = await Promise.all([soft("marketing_stats"), soft("marketing_facts")]);
  return parseFacts(stats, facts);
}

const cached = unstable_cache(readLive, ["site-facts"], { revalidate: 600 });

/** The site's facts, or none: never throws, so no page fails for want of a figure. */
export async function loadSiteFacts(): Promise<SiteFacts> {
  try {
    return await cached();
  } catch {
    return NO_FACTS;
  }
}
