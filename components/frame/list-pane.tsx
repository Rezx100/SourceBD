"use client";

// The list and its pane, each scrolling inside (Paper `03 Patterns` · App shell desktop 1440 drew
// list 576 + pane 640; since the founder's video of 23 Oct 2026 the record is the wider side at
// every desktop width: the list 40% of the row, 400 to 520, the pane the rest). Each side is
// positioned and contains its own overscroll, so nothing in it can scroll the page. A page says how
// its pane is presented:
//
// - `docked` (records, the composer, Save): from 1280 the pane docks beside the list and never
//   covers it; under 1280 it opens as the kit's drawer, over a scrim.
// - `overlay` (filters, `10 · Filters panel open, live count`): from 1280 a 360 panel laid over
//   the right of the list, which keeps its full width and stays live (no scrim, nothing inert,
//   so the panel claims no `aria-modal`); 768 to 1279 the same drawer as `docked` (Paper draws
//   nothing there); under 768 the kit's bottom sheet (`11 · Filters sheet`).
//
// The page owns what is open: the pane is in the URL (`?record=`, `?filters=1`), so closing it
// is a navigation to `closeHref`, and Escape inside the docked or laid-over pane does the same.
// The drawer and the sheet tell their body that they draw its title and close (`usePaneTitled`).

import { useRouter } from "next/navigation";
import { createContext, useContext, useSyncExternalStore, type KeyboardEvent, type ReactNode } from "react";
import { Drawer, Sheet } from "@/components/kit/overlay";
import { PaneDivider, RECORD_PANE, usePaneWidth } from "./pane-divider";

const WIDE = "(min-width: 1280px)";
const PHONE = "(max-width: 767px)";

function subscribe(onChange: () => void) {
  const mqs = [window.matchMedia(WIDE), window.matchMedia(PHONE)];
  for (const mq of mqs) mq.addEventListener("change", onChange);
  return () => {
    for (const mq of mqs) mq.removeEventListener("change", onChange);
  };
}

type Tier = "wide" | "mid" | "phone";

/** Wide from 1280, phone under 768. The server draws the wide pane, which CSS hides under 1280 until this answers. */
function useTier(): Tier {
  return useSyncExternalStore(
    subscribe,
    () => (window.matchMedia(WIDE).matches ? "wide" : window.matchMedia(PHONE).matches ? "phone" : "mid"),
    () => "wide",
  );
}

const Titled = createContext(false);

/** Says the frame draws the title: the drawer and the sheet here, and the gallery and proof shots that draw them by hand. */
export const PaneTitled = Titled.Provider;

/** True when the frame around the pane already draws its title and a close (the drawer, the sheet). */
export function usePaneTitled(): boolean {
  return useContext(Titled);
}

export function ListPane({
  list,
  listLabel,
  pane,
  paneTitle,
  closeHref,
  presentation = "docked",
}: {
  list: ReactNode;
  /** The list's region name: "Results", "Saved suppliers". */
  listLabel: string;
  /** The open pane's body; null or absent, the list fills the width. */
  pane?: ReactNode;
  /** The pane's region name and, under 1280, the drawer's or sheet's title: the supplier's name. */
  paneTitle?: string;
  /** Where Close and Escape go: the same list without the pane. */
  closeHref: string;
  /** Beside the list (640), or laid over it (360) with a bottom sheet on a phone. */
  presentation?: "docked" | "overlay";
}) {
  const tier = useTier();
  const router = useRouter();
  const open = pane !== null && pane !== undefined;
  const close = () => router.push(closeHref, { scroll: false });
  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    // Only Escape pressed in the pane itself: React bubbles a menu's or a select's
    // keydown here through its portal, and that Escape belongs to the menu.
    const t = e.target as HTMLElement;
    if (e.key === "Escape" && !e.defaultPrevented && e.currentTarget.contains(t) && !t.closest("input, textarea, select, [contenteditable=true]")) close();
  };
  const overlay = presentation === "overlay";
  const size = usePaneWidth(RECORD_PANE);
  const docked = open && tier === "wide" && !overlay;
  return (
    <div ref={size.rowRef} className={`flex min-h-0 flex-1${overlay ? " relative" : ""}`}>
      <section aria-label={listLabel} className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overscroll-y-contain">
        {list}
      </section>
      {docked ? <PaneDivider width={size.width} min={size.min} max={size.max} paneId="list-pane" label="Resize the record pane" onWidth={size.set} onReset={size.reset} /> : null}
      {open && tier === "wide" ? (
        <section
          aria-label={paneTitle}
          id={docked ? "list-pane" : undefined}
          onKeyDown={onKeyDown}
          // Its own width is the row less the list's 40% (400 to 520); a dragged width is the buyer's. CSS keeps
          // the pane at least 480 and half the row, and the list 400, when the window narrows.
          style={docked && size.stored ? { width: size.width } : undefined}
          className={
            overlay
              ? "absolute inset-y-0 right-0 z-overlay hidden min-h-0 w-panel flex-col overflow-y-auto overscroll-y-contain border-l border-line bg-surface shadow-dialog xl:flex"
              : "relative hidden min-h-0 w-[calc(100%-clamp(400px,40%,520px))] min-w-[max(480px,50%)] max-w-[calc(100%-400px)] shrink-0 flex-col overflow-y-auto overscroll-y-contain xl:flex"
          }
        >
          {pane}
        </section>
      ) : null}
      {open && tier !== "wide" ? (
        <PaneTitled value>
          {overlay && tier === "phone" ? (
            <Sheet open onOpenChange={(next) => (next ? null : close())} title={paneTitle ?? ""} flush>
              {pane}
            </Sheet>
          ) : (
            <Drawer open onOpenChange={(next) => (next ? null : close())} title={paneTitle ?? ""}>
              {pane}
            </Drawer>
          )}
        </PaneTitled>
      ) : null}
    </div>
  );
}
