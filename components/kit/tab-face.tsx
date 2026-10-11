"use client";

// The inside of one phone tab. A tap lights the tab at once (`useLinkStatus`), and the tab that was
// current lets go of its mark while the new page loads, so the highlight moves with the finger
// instead of when the server answers (11 Oct 2026, the phone speed pass). Outside a Link it is just
// the current or plain face.

import { useLinkStatus } from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const ON = "font-semibold text-brand-ink [box-shadow:inset_0_2px_0_theme(colors.brand-ink)]";
const OFF = "font-medium text-ink-2";
/** The current tab, while another tab's page is on its way. */
const LETTING_GO = "group-has-[[data-pending]]/tabs:font-medium group-has-[[data-pending]]/tabs:text-ink-2 group-has-[[data-pending]]/tabs:[box-shadow:none]";

export function TabFace({ current, children }: { current?: boolean; children: ReactNode }) {
  const { pending } = useLinkStatus();
  return (
    <span
      data-pending={pending ? "" : undefined}
      className={cn("flex size-full flex-col items-center justify-center gap-0.5", current || pending ? ON : OFF, current && !pending && LETTING_GO)}
    >
      {children}
    </span>
  );
}
