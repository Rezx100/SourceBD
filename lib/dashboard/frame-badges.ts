// The counts beside Messages and Compliance in the frame (row 24). The buyer layout starts this and
// does NOT await it: it hands the frame the promise, so the menu is on screen before either read
// answers and the badges fill in after. Each count is read on its own; one that fails or is slow
// draws no badge, never a 0, and never holds the other back. The promise never rejects.

import type { FrameBadges } from "@/components/frame/badges";
import { loadComplianceBadge, BADGE_WAIT_MS } from "@/lib/dashboard/compliance-badge";

type Badge = { text: string; tone?: "ink" | "caution" } | null;

/** "2 new": conversations with something the buyer has not read. Nothing for none, a failed read or no number. */
export function messagesBadge(total: unknown): Badge {
  return typeof total === "number" && Number.isInteger(total) && total > 0 ? { text: `${total > 99 ? "99+" : total} new` } : null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the Supabase server client, as the other loaders take it.
export async function loadMessagesBadge(supabase: any, waitMs: number = BADGE_WAIT_MS): Promise<Badge> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const wait = new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), waitMs);
    });
    // `thread_unread_total` is migration 0112; without it the call errors and no badge is drawn.
    const read = Promise.resolve(supabase.rpc("thread_unread_total")).then((r: { data?: unknown; error?: unknown } | null) => (r && !r.error ? messagesBadge(r.data) : null)).catch(() => null);
    return await Promise.race([read, wait]);
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the Supabase server client, as the other loaders take it.
export async function loadFrameBadges(supabase: any): Promise<FrameBadges> {
  const [messages, compliance] = await Promise.all([loadMessagesBadge(supabase).catch(() => null), loadComplianceBadge(supabase).catch(() => null)]);
  return { messages, compliance };
}
