"use client";

// The list and the docked pane (Paper `03 Patterns` · App shell desktop 1440:
// list 576 + pane 640, each scrolling inside). From 1280 the pane docks beside the
// list and never covers it; under 1280 it opens as the kit's drawer, over a scrim.
// The page owns what is open: the pane is in the URL (`?record=`), so closing it
// is a navigation to `closeHref`, and Escape inside the docked pane does the same.

import { useRouter } from "next/navigation";
import { useSyncExternalStore, type ReactNode } from "react";
import { Drawer } from "@/components/kit/overlay";

const WIDE = "(min-width: 1280px)";

function subscribe(onChange: () => void) {
  const mq = window.matchMedia(WIDE);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

/** True from 1280. The server draws the docked pane, which CSS hides under 1280 until this answers. */
function useWide(): boolean {
  return useSyncExternalStore(subscribe, () => window.matchMedia(WIDE).matches, () => true);
}

export function ListPane({
  list,
  listLabel,
  pane,
  paneTitle,
  closeHref,
}: {
  list: ReactNode;
  /** The list's region name: "Results", "Saved suppliers". */
  listLabel: string;
  /** The open pane's body; null or absent, the list fills the width. */
  pane?: ReactNode;
  /** The pane's region name and, under 1280, the drawer's title: the supplier's name. */
  paneTitle?: string;
  /** Where Close and Escape go: the same list without the pane. */
  closeHref: string;
}) {
  const wide = useWide();
  const router = useRouter();
  const open = pane !== null && pane !== undefined;
  const close = () => router.push(closeHref, { scroll: false });
  return (
    <div className="flex min-h-0 flex-1">
      <section aria-label={listLabel} className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">
        {list}
      </section>
      {open && wide ? (
        <section
          aria-label={paneTitle}
          onKeyDown={(e) => {
            if (e.key === "Escape" && !e.defaultPrevented) close();
          }}
          className="hidden min-h-0 w-pane shrink-0 flex-col overflow-y-auto border-l border-line xl:flex"
        >
          {pane}
        </section>
      ) : null}
      {open && !wide ? (
        <Drawer open onOpenChange={(next) => (next ? null : close())} title={paneTitle ?? ""}>
          {pane}
        </Drawer>
      ) : null}
    </div>
  );
}
