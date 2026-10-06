"use client";

// A spinner inside a `next/link` while its navigation is in flight. Opening a record from the
// results waits about a second on the server before anything changes (founder's video, 6 Oct
// 2026: "really slow"), so the row says it heard the click the moment it is pressed. Outside a
// Link it never shows.

import { SpinnerGap } from "@phosphor-icons/react";
import { useLinkStatus } from "next/link";
import { cn } from "@/lib/utils";

export function LinkPending({ className }: { className?: string }) {
  const { pending } = useLinkStatus();
  return pending ? <SpinnerGap size={14} aria-hidden className={cn("shrink-0 animate-spin text-ink-3 motion-reduce:animate-none", className)} /> : null;
}
