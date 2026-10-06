// The sidebar's Compliance badge (B6c): "8 to check", read by the layout beside the shell. It is the
// hub's own count: `loadNeedsAttention` is the one function that reads the two certificate lists and
// `attentionOf` the one that totals them, so the badge, the hub's heading and the landing's block
// cannot say 2, 8 and 9 for the same thing. A read that fails or is slow draws no badge, never a 0:
// the frame is on screen with every navigation and must not wait on a list.

import { complianceBadge } from "@/components/compliance/words";
import { loadNeedsAttention } from "@/lib/dashboard/needs-attention";

type Badge = { text: string; tone: "danger" } | null;

/** How long the frame waits for the count before drawing without it. */
export const BADGE_WAIT_MS = 1500;

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the Supabase server client, as the other loaders take it.
export async function loadComplianceBadge(supabase: any, today: Date = new Date(), waitMs: number = BADGE_WAIT_MS): Promise<Badge> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const wait = new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), waitMs);
    });
    const attention = await Promise.race([loadNeedsAttention(supabase, today, 0), wait]);
    return complianceBadge(attention);
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
