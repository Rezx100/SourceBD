import "server-only";

import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";

import { activeNavKey, type SidebarModel, type TopbarModel } from "@/components/dashboard/app-shell";
import { formatCount, formatDayRange, initials } from "@/lib/dashboard/facts";
import { EMPTY_STATE, discoverRpcArgs } from "@/lib/discover-v32-state";
import { parseCount, parseTotalCount, type DiscoverV32Row } from "@/lib/discover-v32-rpc";
import { TAG_DISCOVER_SUPPLIERS } from "@/lib/cache/tags";

export type BuyerShellModels = {
  sidebar: SidebarModel;
  topbar: TopbarModel;
};

function asRow(raw: unknown): DiscoverV32Row | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.slug !== "string") return null;
  return r as unknown as DiscoverV32Row;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RpcClient = { rpc: (fn: string, args?: Record<string, unknown>) => any };

/**
 * "Published suppliers": the empty search's total. Throws when the count could
 * not be read, so the cache below never keeps a failure.
 */
async function readPublished(client: RpcClient): Promise<number> {
  const pub = await client.rpc("discover_suppliers", discoverRpcArgs(EMPTY_STATE, { limit: 1, offset: 0 }));
  const pubRaw = Array.isArray(pub?.data) && !pub?.error ? (pub.data as unknown[]) : null;
  if (pubRaw === null) throw new Error("published count not read");
  const pubRows = pubRaw.map(asRow).filter(Boolean) as DiscoverV32Row[];
  // `parseTotalCount([])` is 0, which is the right answer for a search that
  // genuinely matched nothing and the wrong one for rows that arrived and
  // failed the shape check — that read "0 published suppliers" over a
  // successful RPC. Rows came back and none survived parsing means the read
  // did not succeed, so the count is unknown.
  if (pubRaw.length > 0 && pubRows.length === 0) throw new Error("published count not parsed");
  const n = parseTotalCount(pubRows);
  if (n === null) throw new Error("published count not parsed");
  return n;
}

// The same number for every buyer, and a full-corpus `count(*) over ()` to get
// it: this ran on every page view and every click, ahead of the page's own
// reads. `discover_suppliers` is granted to anon, so it is read once per ten
// minutes with the anon key and purged with the public search's tag.
const cachedPublished = unstable_cache(
  async () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) throw new Error("missing-env");
    return readPublished(createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } }));
  },
  ["buyer-shell-published"],
  { revalidate: 600, tags: [TAG_DISCOVER_SUPPLIERS] },
);

export async function loadBuyerShell(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: RpcClient & { from: (t: string) => any; auth: { getUser: () => Promise<{ data: { user: { email?: string; user_metadata?: Record<string, unknown> } | null } }> } },
  pathname: string,
  /** Read the published count from this client, uncached (tests). */
  opts: { publishedFrom?: RpcClient } = {},
): Promise<BuyerShellModels> {
  // Not a NavKey from the caller: see `activeNavKey`.
  const active = activeNavKey(pathname);
  const planName = "Free";
  const soft = async <T,>(read: () => Promise<T>): Promise<T | null> => {
    try {
      return await read();
    } catch {
      return null; // fail-soft: an unread count renders no number, never 0
    }
  };

  // Four independent reads, one wave. They used to run in three.
  const [saved, published, rfqs, initial] = await Promise.all([
    soft(async () => {
      const { data: dash } = await supabase.rpc("buyer_dashboard");
      // `saved_count` is a bigint on the SQL side, which PostgREST may send
      // as a string; the shared parser accepts that and refuses `""`.
      return dash && typeof dash === "object" ? parseCount((dash as { saved_count?: unknown }).saved_count) : null;
    }),
    soft(() => (opts.publishedFrom ? readPublished(opts.publishedFrom) : cachedPublished())),
    soft(async () => {
      const listed = await supabase.from("rfqs").select("id", { count: "exact", head: true });
      return typeof listed?.count === "number" ? listed.count : null;
    }),
    soft(async () => {
      const { data } = await supabase.auth.getUser();
      const email = data.user?.email ?? "";
      const meta = data.user?.user_metadata ?? {};
      // `initials` is built for company names: handed an email address it
      // reads the domain (zahir@example.invalid came out "ZI"). A name gets
      // two letters; an email gets its first.
      const fullName = typeof meta.full_name === "string" ? meta.full_name.trim() : "";
      return fullName ? initials(fullName) : (email.trim()[0]?.toUpperCase() ?? null);
    }),
  ]);

  const captionParts = [
    published === null ? "published count could not be read" : `${formatCount(published)} published suppliers`,
  ];

  return {
    sidebar: {
      active,
      counts: { suppliers: published, rfqs, saved },
      recent: [],
      plan: { name: planName, note: "public beta" },
    },
    topbar: {
      caption: captionParts.join(" · "),
      initial,
      searchAction: "/app/discover",
    },
  };
}

export function recordsCaption(shown: number, oldest: string | null, newest: string | null): string {
  const range = formatDayRange(oldest, newest);
  if (!range) return `${shown} ${shown === 1 ? "record" : "records"} on this page`;
  return `${shown} ${shown === 1 ? "record" : "records"} on this page, read ${range}`;
}
