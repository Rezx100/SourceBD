// The v4 app frame (B3, Paper `03 Patterns` · App shell): the buyer layout draws
// it once around every /app page. From 768 it is exactly the viewport: the
// sidebar (224 from 1440, a 64 rail under it) beside the topbar and `<main>`,
// which scrolls itself, or holds a `ListPane` whose list and pane scroll
// themselves. Below 768 the document scrolls as one, under a sticky 56 top bar,
// above the fixed tab bar.
//
// No `data-shell` (B0: `app/ds.css` turns v4's brand tint grey inside it).
// `group/shell` stays for the old pages until B4–B7 rebuild them: their
// `data-detail` bars hide the phone bars through it.

import type { ReactNode } from "react";
import { MenuDismiss } from "@/components/dashboard/menu-dismiss";
import { ring } from "@/components/kit/classes";
import { cn } from "@/lib/utils";
import { PhoneBar, PhoneTabs } from "./phone";
import { FrameSidebar, type FrameBadges } from "./sidebar";
import { FrameTopbar, type FrameAccount } from "./topbar";

export const MAIN_ID = "main-content";

export function AppFrame({ account, badges, children }: { account: FrameAccount | null; badges?: FrameBadges; children: ReactNode }) {
  return (
    <div className="group/shell flex min-h-dvh flex-col bg-surface font-sans text-ink antialiased md:h-dvh md:flex-row md:overflow-clip">
      <a
        href={`#${MAIN_ID}`}
        className={cn("sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-toast focus:rounded-sm focus:bg-surface focus:px-3 focus:py-2 focus:text-base focus:font-medium focus:text-ink", ring)}
      >
        Skip to content
      </a>
      <FrameSidebar badges={badges} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <FrameTopbar account={account} />
        <PhoneBar account={account} />
        <main
          id={MAIN_ID}
          tabIndex={-1}
          className="isolate flex min-h-0 flex-1 flex-col outline-none max-md:overflow-x-clip max-md:pb-[calc(theme(spacing.tabbar)_+_env(safe-area-inset-bottom))] md:overflow-y-auto max-md:group-has-[[data-detail]]/shell:pb-0"
        >
          {children}
        </main>
        {/* The old pages' trays close on Escape and outside presses through this, until B11. */}
        <MenuDismiss />
      </div>
      <PhoneTabs badges={badges} />
    </div>
  );
}
