"use client";

// The edge a buyer drags to resize a docked pane (Paper `02 Components` · 5 Overlays · "Docked
// pane with a resizable divider"): a 1px line at rest; on hover, drag or keyboard focus a 2px
// line and a 9 by 32 grip; the arrows move it 16px; a double-click puts the pane back at its
// own width. One divider for every docked pane: the record beside the results, the preview
// beside the RFQ form. Paper draws the hover in full brand green on a green wash; the founder
// asked for very little green (6 Oct 2026), so the line and the grip are the brand at 40% and
// the wash is left out.

import { DotsSixVertical } from "@phosphor-icons/react";
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

export type PaneLimits = {
  /** Where this browser keeps the buyer's width. */
  key: string;
  /** The pane's own width, and what a double-click returns it to. */
  initial: number;
  /** The narrowest the pane goes. */
  min: number;
  /** What the other side of the divider always keeps. */
  keep: number;
};

/** The record beside the results: 640, at least 480, the list keeping 400. */
export const RECORD_PANE: PaneLimits = { key: "sourcebd.pane-width", initial: 640, min: 480, keep: 400 };

const STEP = 16;

function paneMax(row: number, lim: PaneLimits): number {
  return Math.max(lim.min, Math.floor(row - lim.keep));
}

/** A width the pane may take in a row `row` wide: at least its minimum, and never into what the other side keeps. */
export function clampPaneWidth(width: number, row: number, lim: PaneLimits = RECORD_PANE): number {
  return Math.min(paneMax(row, lim), Math.max(lim.min, Math.round(Number.isFinite(width) ? width : lim.initial)));
}

/**
 * The pane's width: its own until the buyer drags the divider, then theirs, kept in this browser.
 * `rowRef` goes on the row that holds both sides (the row, not the window: the sidebar folding
 * changes it too). `stored` is false until the browser answers, so the server and the first
 * client render agree on the default.
 */
export function usePaneWidth(lim: PaneLimits) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number | null>(null);
  const [row, setRow] = useState(0);
  useEffect(() => {
    try {
      const saved = Number(window.localStorage.getItem(lim.key));
      if (saved > 0) setWidth(saved);
    } catch {
      // Storage blocked (a private window): the default width.
    }
    const el = rowRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setRow(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, [lim.key]);
  // Until the row is measured, room for the default and no more.
  const measured = row || lim.initial + lim.keep;
  const set = (w: number, done: boolean) => {
    const next = clampPaneWidth(w, rowRef.current?.clientWidth || measured, lim);
    setWidth(next);
    if (!done) return;
    try {
      window.localStorage.setItem(lim.key, String(next));
    } catch {
      // Not kept; this visit still has it.
    }
  };
  return { rowRef, stored: width !== null, width: clampPaneWidth(width ?? lim.initial, measured, lim), max: paneMax(measured, lim), set, reset: () => set(lim.initial, true) };
}

const SHOWN = "group-hover:opacity-100 group-focus-visible:opacity-100 group-active:opacity-100";

/**
 * The divider itself, for a pane on its right. It takes 1px of the row; the other 8px a hand
 * grabs lie over the pane's own padding, never over the list's scrollbar.
 */
export function PaneDivider({
  width,
  min,
  max,
  paneId,
  label,
  onWidth,
  onReset,
}: {
  width: number;
  min: number;
  max: number;
  /** The id of the pane this resizes. */
  paneId: string;
  /** "Resize the record pane". */
  label: string;
  onWidth: (w: number, done: boolean) => void;
  onReset: () => void;
}) {
  const drag = useRef<{ x: number; w: number } | null>(null);
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    // The pane is on the right: the left arrow moves the edge left and widens it. Enter is the
    // keyboard's double-click.
    const next = { ArrowLeft: width + STEP, ArrowRight: width - STEP, Home: min, End: max }[e.key];
    if (next === undefined && e.key !== "Enter") return;
    e.preventDefault();
    if (next === undefined) onReset();
    else onWidth(next, true);
  };
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-controls={paneId}
      aria-valuenow={width}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onDoubleClick={onReset}
      onPointerDown={(e: PointerEvent<HTMLDivElement>) => {
        if (e.button !== 0) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        drag.current = { x: e.clientX, w: width };
      }}
      onPointerMove={(e) => {
        if (drag.current) onWidth(drag.current.w + drag.current.x - e.clientX, false);
      }}
      onPointerUp={(e) => {
        if (!drag.current) return;
        // A click that never moved (the two of a double-click) is not a width to keep.
        if (e.clientX !== drag.current.x) onWidth(drag.current.w + drag.current.x - e.clientX, true);
        drag.current = null;
      }}
      onPointerCancel={() => (drag.current = null)}
      className="group relative z-sticky -mr-2 hidden w-[9px] shrink-0 cursor-col-resize touch-none select-none outline-none xl:block"
    >
      <span aria-hidden className="absolute inset-y-0 left-0 w-px bg-line" />
      <span aria-hidden className={`absolute inset-y-0 left-0 w-0.5 bg-brand/40 opacity-0 transition-opacity duration-fast ${SHOWN}`} />
      {/* The focus ring is the grip's: round a strip as tall as the pane it was two green rules. */}
      <span aria-hidden className={`absolute -left-[3px] top-1/2 flex h-8 w-[9px] -translate-y-1/2 items-center justify-center rounded-sm border border-brand/40 bg-surface text-brand/70 opacity-0 transition-opacity duration-fast group-focus-visible:outline group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-brand ${SHOWN}`}>
        <DotsSixVertical size={16} className="shrink-0" />
      </span>
    </div>
  );
}
