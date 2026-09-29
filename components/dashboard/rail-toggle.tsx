"use client";

// Collapse the rail to its icons and back (founder's video, 29 Sep 2026).
// The state is a cookie the buyer layout reads, so the server draws the rail
// the way the buyer left it and nothing flashes open on the next load. The
// click flips the shell's `data-rail` itself: the layout is not re-rendered on
// a client navigation, and a refresh would re-run the shell's four reads.

import { useState } from "react";
import { RAIL_COOKIE } from "@/lib/dashboard/nav";
import { Icon } from "./icons";

export function RailToggle({ collapsed: initial }: { collapsed: boolean }) {
  const [collapsed, setCollapsed] = useState(initial);
  return (
    <button
      type="button"
      aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      onClick={(e) => {
        const next = !collapsed;
        const shell = e.currentTarget.closest<HTMLElement>("[data-shell]");
        if (shell) {
          if (next) shell.dataset.rail = "collapsed";
          else delete shell.dataset.rail;
        }
        document.cookie = `${RAIL_COOKIE}=${next ? "collapsed" : "open"}; path=/app; max-age=31536000; samesite=lax`;
        setCollapsed(next);
      }}
      className="hidden size-7 shrink-0 place-items-center rounded-sm text-ink-muted transition-colors duration-fast hover:bg-surface-sunken hover:text-ink-strong md:grid"
    >
      <Icon name="pane" />
    </button>
  );
}
