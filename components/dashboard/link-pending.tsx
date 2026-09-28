"use client";

// A spinner inside a `next/link` while its navigation is in flight. Opening a
// record used to leave the button exactly as it was for seconds, so a buyer
// could not tell the click had landed. Outside a Link it never shows.
//
// The server takes about a second to answer any click on the live site
// (founder's video, 29 Sep 2026), so every link that opens something beside
// the results says it heard the click the moment it is pressed: a text link
// or button grows the spinner, an icon-only one swaps its icon for it.

import { useLinkStatus } from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const SPIN = "size-3 shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none";

export function LinkPending({ className }: { className?: string }) {
  const { pending } = useLinkStatus();
  // `hidden` last, so a caller's display class cannot keep it on screen.
  return <span aria-hidden className={cn(SPIN, className, !pending && "hidden")} />;
}

/** An icon-only link's icon, replaced by the spinner (same box) while its navigation is in flight. */
export function LinkPendingSwap({ children }: { children: ReactNode }) {
  const { pending } = useLinkStatus();
  return pending ? <span aria-hidden className={cn(SPIN, "size-4")} /> : <>{children}</>;
}
