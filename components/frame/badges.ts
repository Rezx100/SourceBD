// The counts beside the menu items ("2 new", "2 to check") and how the frame receives them.
// The layout does not wait for them (row 24): it hands the frame a promise, the frame draws at
// once without badges, and the sidebar and tab bar fill in when it settles. A count that could not
// be read is null in the object and draws nothing, never a 0.

import { use } from "react";
import type { FrameKey } from "@/lib/frame-nav";

/** "2 new", "2 to check": live words from the layout; null draws nothing, never a 0. */
export type FrameBadges = Partial<Record<FrameKey, { text: string; tone?: "ink" | "caution" } | null>>;

/** What the frame takes: the badges, or a promise of them that never rejects (see `loadFrameBadges`). */
export type BadgesInput = FrameBadges | Promise<FrameBadges> | undefined;

export const NO_BADGES: FrameBadges = {};

function isPromise(b: BadgesInput): b is Promise<FrameBadges> {
  return typeof (b as { then?: unknown } | undefined)?.then === "function";
}

/** Reads the badges, suspending until a promise settles; call it under a `Suspense` that draws the frame without them. */
export function useBadges(input: BadgesInput): FrameBadges {
  if (isPromise(input)) return use(input);
  return input ?? NO_BADGES;
}
