"use client";

// A spinner inside a `next/link` while its navigation is in flight. Opening a
// record used to leave the button exactly as it was for seconds, so a buyer
// could not tell the click had landed. Outside a Link it never shows.

import { useLinkStatus } from "next/link";
import { cn } from "@/lib/utils";

export function LinkPending() {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden
      className={cn(
        "size-3 shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none",
        !pending && "hidden",
      )}
    />
  );
}
