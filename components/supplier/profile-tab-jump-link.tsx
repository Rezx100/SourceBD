"use client";

// Generic "jump to another tab" trigger for inline links scattered around
// the profile (e.g. the header's "+N more" corroborating-sources overflow).
// Unlike AddressesJumpLink, this never needs a post-click scroll — every
// target sits at the top of its own tab panel already.

import type { ReactNode } from "react";

export function ProfileTabJumpLink({
  triggerId,
  children,
  className,
}: {
  triggerId: string;
  children: ReactNode;
  className?: string;
}) {
  function jump() {
    // Radix's TabsTrigger activates on mousedown (button 0), not click — a
    // bare `.click()` call never fires that handler, leaving the panel stuck.
    const el = document.getElementById(triggerId);
    if (!el) return;
    el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 }));
  }
  return (
    <button type="button" onClick={jump} className={className}>
      {children}
    </button>
  );
}
