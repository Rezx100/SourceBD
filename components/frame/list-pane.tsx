"use client";

// The list and its pane (Paper `03 Patterns` · App shell desktop 1440: list 576 + pane 640,
// each scrolling inside). A page says how its pane is presented:
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
      <section aria-label={listLabel} className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">
        {list}
      </section>
      {docked ? <PaneDivider width={size.width} min={RECORD_PANE.min} max={size.max} paneId="list-pane" label="Resize the record pane" onWidth={size.set} onReset={size.reset} /> : null}
      {open && tier === "wide" ? (
        <section
          aria-label={paneTitle}
          id={docked ? "list-pane" : undefined}
          onKeyDown={onKeyDown}
          // The width is the buyer's; CSS keeps the pane at least 480 and the list 400 when the window narrows.
          style={docked && size.stored ? { width: size.width } : undefined}
          className={
            overlay
              ? "absolute inset-y-0 right-0 z-overlay hidden min-h-0 w-panel flex-col overflow-y-auto border-l border-line bg-surface shadow-dialog xl:flex"
              : "hidden min-h-0 w-pane min-w-[480px] max-w-[calc(100%-400px)] shrink-0 flex-col overflow-y-auto xl:flex"
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
