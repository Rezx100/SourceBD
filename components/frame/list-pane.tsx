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
import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { Drawer, Sheet } from "@/components/kit/overlay";

/** The docked pane's width: 640 until the buyer drags its edge, then theirs, kept in this browser. */
export const PANE_DEFAULT = 640;
export const PANE_MIN = 400;
const PANE_KEY = "sourcebd.pane-width";
const STEP = 16;

/** A width the docked pane may take in a row `row` wide: at least 400, at most 60% of the row (never under 400). */
export function clampPaneWidth(width: number, row: number): number {
  const max = Math.max(PANE_MIN, Math.floor(row * 0.6));
  return Math.min(max, Math.max(PANE_MIN, Math.round(Number.isFinite(width) ? width : PANE_DEFAULT)));
}

/**
 * The edge between the list and the docked pane, which the buyer drags (or moves with the arrow
 * keys) to give the record more or less room. A 1px line (the background, clipped to the content)
 * with 8px of padding either side to grab, taking 1px of the row.
 */
function PaneDivider({ width, row, paneId, onWidth }: { width: number; row: number; paneId: string; onWidth: (w: number, done: boolean) => void }) {
  const drag = useRef<{ x: number; w: number } | null>(null);
  const max = Math.max(PANE_MIN, Math.floor(row * 0.6));
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const next = { ArrowLeft: width + STEP, ArrowRight: width - STEP, Home: PANE_MIN, End: max }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    onWidth(next, true);
  };
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize the record pane"
      aria-controls={paneId}
      aria-valuenow={width}
      aria-valuemin={PANE_MIN}
      aria-valuemax={max}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onPointerDown={(e: PointerEvent<HTMLDivElement>) => {
        if (e.button !== 0) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        drag.current = { x: e.clientX, w: width };
      }}
      onPointerMove={(e) => {
        // The pane is on the right: dragging the edge left widens it.
        if (drag.current) onWidth(drag.current.w + drag.current.x - e.clientX, false);
      }}
      onPointerUp={(e) => {
        if (!drag.current) return;
        onWidth(drag.current.w + drag.current.x - e.clientX, true);
        drag.current = null;
      }}
      onPointerCancel={() => (drag.current = null)}
      className="relative z-10 -mx-2 hidden w-[17px] shrink-0 cursor-col-resize touch-none select-none bg-line bg-clip-content px-2 outline-none hover:bg-brand focus-visible:bg-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand xl:block"
    />
  );
}

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
  const rowRef = useRef<HTMLDivElement>(null);
  // Null until the browser answers: the server draws the 640 default, so nothing differs at hydration.
  const [width, setWidth] = useState<number | null>(null);
  const [row, setRow] = useState(0);
  useEffect(() => {
    const measure = () => setRow(rowRef.current?.clientWidth ?? 0);
    measure();
    try {
      const saved = Number(window.localStorage.getItem(PANE_KEY));
      if (saved > 0) setWidth(saved);
    } catch {
      // Storage blocked (a private window): the default width.
    }
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);
  const paneWidth = clampPaneWidth(width ?? PANE_DEFAULT, row || PANE_DEFAULT / 0.6);
  const onWidth = (w: number, done: boolean) => {
    const next = clampPaneWidth(w, rowRef.current?.clientWidth ?? row);
    setWidth(next);
    if (!done) return;
    try {
      window.localStorage.setItem(PANE_KEY, String(next));
    } catch {
      // Not kept; this visit still has it.
    }
  };
  const docked = open && tier === "wide" && !overlay;
  return (
    <div ref={rowRef} className={`flex min-h-0 flex-1${overlay ? " relative" : ""}`}>
      <section aria-label={listLabel} className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">
        {list}
      </section>
      {docked ? <PaneDivider width={paneWidth} row={row || PANE_DEFAULT / 0.6} paneId="list-pane" onWidth={onWidth} /> : null}
      {open && tier === "wide" ? (
        <section
          aria-label={paneTitle}
          id={docked ? "list-pane" : undefined}
          onKeyDown={onKeyDown}
          // The width is the buyer's; CSS keeps it between 400 and 60% when the window narrows.
          style={docked && width !== null ? { width: paneWidth } : undefined}
          className={
            overlay
              ? "absolute inset-y-0 right-0 z-overlay hidden min-h-0 w-panel flex-col overflow-y-auto border-l border-line bg-surface shadow-dialog xl:flex"
              : "hidden min-h-0 w-pane min-w-[400px] max-w-[60%] shrink-0 flex-col overflow-y-auto xl:flex"
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
