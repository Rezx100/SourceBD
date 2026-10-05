import "server-only";

import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";

import { formatDayRange, initials } from "@/lib/dashboard/facts";
import { EMPTY_STATE, discoverRpcArgs } from "@/lib/discover-v32-state";
import { parseTotalCount, type DiscoverV32Row } from "@/lib/discover-v32-rpc";
import { TAG_DISCOVER_SUPPLIERS } from "@/lib/cache/tags";

export type BuyerShellModels = {
  /** Who is signed in, for the account menu; null when the sign-in was not read (the frame then draws "Your account"). */
  account: { initial: string | null; name: string | null; email: string | null; avatarUrl: string | null } | null;
  /** Who is signed in, for analytics; null when the sign-in was not read. */
  userId: string | null;
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
export async function readPublished(client: RpcClient): Promise<number> {
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

/** The published count for a page that prints it (the search landing); null when it could not be read. */
export async function readPublishedCount(): Promise<number | null> {
  try {
    return await cachedPublished();
  } catch {
    return null;
  }
}

/**
 * Who is signed in, for the frame's account menu and for analytics. The three
 * counts the old rail drew (saved, RFQs, published) are not read any more: the
 * v4 frame shows none of them.
 */
export async function loadBuyerShell(
  supabase: RpcClient & { auth: { getUser: () => Promise<{ data: { user: { id?: string; email?: string; user_metadata?: Record<string, unknown> } | null } }> } },
): Promise<BuyerShellModels> {
  const signedIn = await (async () => {
    try {
      // The profile's own name and photo (Settings → Profile writes both),
      // read beside the session: the account menu shows the photo the buyer
      // uploaded, not their initials (founder's video, 29 Sep 2026). A failed
      // settings read keeps the session's name and draws initials.
      const [{ data }, settings] = await Promise.all([
        supabase.auth.getUser(),
        (async () => supabase.rpc("settings_get"))().then(
          (r: { data?: unknown }) => (r?.data && typeof r.data === "object" ? (r.data as { display_name?: unknown; avatar_url?: unknown }) : null),
          () => null,
        ),
      ]);
      const email = data.user?.email ?? "";
      const meta = data.user?.user_metadata ?? {};
      // `initials` is built for company names: handed an email address it
      // reads the domain (zahir@example.invalid came out "ZI"). A name gets
      // two letters; an email gets its first.
      const shown = typeof settings?.display_name === "string" ? settings.display_name.trim() : "";
      const fullName = shown || (typeof meta.full_name === "string" ? meta.full_name.trim() : "");
      const avatarUrl = typeof settings?.avatar_url === "string" && /^https:\/\//.test(settings.avatar_url) ? settings.avatar_url : null;
      return {
        userId: data.user?.id ?? null,
        account: {
          initial: fullName ? initials(fullName) : (email.trim()[0]?.toUpperCase() ?? null),
          name: fullName || null,
          email: email.trim() || null,
          avatarUrl,
        },
      };
    } catch {
      return null; // fail-soft: an unread sign-in draws "Your account", never a stranger's name
    }
  })();
  // An unread account is null: a menu saying "Your account" over a read that
  // failed is the frame's own wording, not a claim about a session it could not see.
  return { account: signedIn?.account ?? null, userId: signedIn?.userId ?? null };
}

export function recordsCaption(shown: number, oldest: string | null, newest: string | null): string {
  const range = formatDayRange(oldest, newest);
  if (!range) return `${shown} ${shown === 1 ? "record" : "records"} on this page`;
  return `${shown} ${shown === 1 ? "record" : "records"} on this page, read ${range}`;
}
