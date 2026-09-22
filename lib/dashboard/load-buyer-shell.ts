import "server-only";

import { activeNavKey, type SidebarModel, type TopbarModel } from "@/components/dashboard/app-shell";
import { formatCount, formatDayRange, initials } from "@/lib/dashboard/facts";
import { EMPTY_STATE, discoverRpcArgs } from "@/lib/discover-v32-state";
import { parseTotalCount, type DiscoverV32Row } from "@/lib/discover-v32-rpc";

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
export async function loadBuyerShell(supabase: { rpc: (fn: string, args?: Record<string, unknown>) => any; from: (t: string) => any; auth: { getUser: () => Promise<{ data: { user: { email?: string; user_metadata?: Record<string, unknown> } | null } }> } }, pathname: string): Promise<BuyerShellModels> {
  // Not a NavKey from the caller: see `activeNavKey`.
  const active = activeNavKey(pathname);
  let saved: number | null = null;
  let rfqs: number | null = null;
  let published: number | null = null;
  let initial: string | null = null;
  const planName = "Free";

  try {
    const [{ data: dash }, pub] = await Promise.all([
      supabase.rpc("buyer_dashboard"),
      supabase.rpc("discover_suppliers", discoverRpcArgs(EMPTY_STATE, { limit: 1, offset: 0 })),
    ]);
    if (dash && typeof dash === "object") {
      // `saved_count` is a bigint on the SQL side, which PostgREST may send as
      // a string. Accepting only `number` left a real count reading as
      // "not read" — the same number-or-string trap the export filename fell
      // into. `parseTotalCount` is the house rule for it.
      const savedRaw = (dash as { saved_count?: unknown }).saved_count;
      const n = typeof savedRaw === "number" ? savedRaw : typeof savedRaw === "string" ? Number(savedRaw) : NaN;
      if (Number.isFinite(n)) saved = n;
    }
    const pubRaw = Array.isArray(pub?.data) && !pub?.error ? (pub.data as unknown[]) : null;
    const pubRows = pubRaw ? (pubRaw.map(asRow).filter(Boolean) as DiscoverV32Row[]) : [];
    // `parseTotalCount([])` is 0, which is the right answer for a search that
    // genuinely matched nothing and the wrong one for rows that arrived and
    // failed the shape check — that read "0 published suppliers" over a
    // successful RPC. Rows came back and none survived parsing means the read
    // did not succeed, so the count is unknown.
    published =
      pub?.error || pubRaw === null ? null : pubRaw.length > 0 && pubRows.length === 0 ? null : parseTotalCount(pubRows);
  } catch {
    // fail-soft
  }

  try {
    const listed = await supabase.from("rfqs").select("id", { count: "exact", head: true });
    if (typeof listed?.count === "number") rfqs = listed.count;
  } catch {
    // fail-soft
  }

  try {
    const { data } = await supabase.auth.getUser();
    const email = data.user?.email ?? "";
    const meta = data.user?.user_metadata ?? {};
    // `initials` is built for company names: it strips punctuation and takes
    // a letter from each of the first two words. Handed an email address it
    // reads the domain — zahir@example.invalid came out "ZI", two letters of
    // which one is the TLD. The `email[0]` fallback beside it was already the
    // right answer and was unreachable, because `name` fell back to the email
    // and was therefore never empty.
    const fullName = typeof meta.full_name === "string" ? meta.full_name.trim() : "";
    initial = fullName ? initials(fullName) : (email.trim()[0]?.toUpperCase() ?? null);
  } catch {
    // fail-soft
  }

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
