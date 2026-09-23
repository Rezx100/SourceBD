"use client";

// The sticky bulk-action bar (REZ-B, handoff §7.5 / spec §3.1 "Selection"):
// "N selected · Send RFQ · Save · Compare · Export". With an empty selection
// it renders no bar, only its (empty) screen-reader announcer, which must
// already exist when the first box is ticked.
//
// Send RFQ and Compare are disabled here on purpose: their destinations are
// REZ-D (the multi-supplier RFQ composer) and REZ-C (`/app/compare`), which
// this branch is not building — REZ-B is the results page only (§7). A
// native disabled button cannot take focus and a `title` shows only on mouse
// hover, so the reason is also VISIBLE text beside them, tied to each by
// `aria-describedby`.

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import {
  announceBulkSaved,
  bulkExportHref,
  clearKeepingFocus,
  reserveBarSpace,
  runBulkSave,
} from "@/lib/dashboard/selection";
import { Button } from "./controls";
import { ExportLink } from "./export-link";
import { Icon } from "./icons";
import { SELECT_ALL_ID, useSelection } from "./selection";

const NOT_BUILT = `Send RFQ and Compare for several suppliers at once are not built yet. Open a supplier's record to send one an RFQ.`;
// No `title` on the two disabled buttons: with aria-describedby present a
// screen reader never hears it, so mouse users were told something else (a
// 50-supplier cap on a bulk send that is not built yet). Both now get the one
// visible note.

export function SelectionBar({ exportHref }: { exportHref: string }) {
  const sel = useSelection();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const barRef = useRef<HTMLDivElement>(null);
  const noteId = useId();
  const visible = sel.interactive && sel.selected.size > 0;
  // Bumped on every selection change, so a save response that lands after
  // the buyer ticked another box does not report "Saved 3" under "4 selected".
  const generation = useRef(0);

  // A message about the last save describes THAT selection; once the BUYER
  // changes it (or clears it and the bar hides) it is stale. Keyed on their
  // edits, not the Set: the refresh after a partial save prunes the Set, and
  // must not erase "1 is no longer listed" as it arrives.
  useEffect(() => {
    generation.current += 1;
    setStatus("");
    // And free Save for the new selection, or its next click did nothing.
    setBusy(false);
  }, [sel.edits]);

  // WCAG 2.4.11 — see reserveBarSpace.
  useEffect(() => {
    const bar = barRef.current;
    if (!visible || !bar) return;
    const observe = typeof ResizeObserver === "undefined" ? null : (fit: () => void) => new ResizeObserver(fit);
    const sticky = () => getComputedStyle(bar).position === "sticky";
    const onViewportResize = (fit: () => void) => {
      window.addEventListener("resize", fit);
      return () => window.removeEventListener("resize", fit);
    };
    return reserveBarSpace(document.documentElement, bar, document.activeElement as HTMLElement | null, observe, sticky, onViewportResize);
  }, [visible]);

  // Announced from a region that exists BEFORE the first selection: a live
  // region mounted already holding "1 selected" is usually not read at all,
  // so the first tick told a screen-reader user nothing about the bar.
  const count = sel.selected.size;
  const announcer = sel.interactive ? (
    <span role="status" aria-live="polite" className="sr-only">
      {count > 0 ? `${count} selected. Bulk actions are after the results.` : ""}
    </span>
  ) : null;
  if (!visible) return announcer;
  const ids = [...sel.selected];

  async function bulkSave() {
    if (busy) return;
    setBusy(true);
    setStatus("");
    const asked = generation.current;
    const message = await runBulkSave(ids, {
      fetch: (url, init) => fetch(url, init),
      onSaved: (saved) => {
        announceBulkSaved(window, saved);
        router.refresh();
      },
    });
    // After a selection change Save already belongs to the next request.
    if (generation.current !== asked) return;
    setBusy(false);
    setStatus(message);
  }

  return (
    <>
      {announcer}
      <div
        ref={barRef}
        role="group"
        aria-label="Bulk actions"
        // Sticky only on a window at least 32rem tall: at 400% zoom (320x256
        // CSS px) a sticky bar covered 91% of the view, leaving a strip of
        // about 20px for the results (WCAG 1.4.10). Shorter windows get it in flow, after the
        // results, where the announcer says it is.
        className="bottom-0 z-20 flex flex-wrap items-center gap-3 border-t border-line-strong bg-surface px-4 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.08)] sm:px-5 [@media(min-height:32rem)]:sticky"
      >
        <span className="text-sm font-medium text-ink-strong">{count} selected</span>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary" disabled aria-describedby={noteId} className="hidden sm:inline-flex">
            <Icon name="send" /> Send RFQ
          </Button>
          <Button
            type="button"
            aria-busy={busy || undefined}
            aria-disabled={busy || undefined}
            onClick={bulkSave}
            className="aria-disabled:cursor-not-allowed aria-disabled:border-line aria-disabled:text-ink-disabled"
          >
            <Icon name="bookmark" /> Save
          </Button>
          <Button
            disabled
            aria-describedby={noteId}
            className="hidden disabled:cursor-not-allowed disabled:border-line disabled:text-ink-disabled sm:inline-flex"
          >
            <Icon name="compare" /> Compare
          </Button>
          <ExportLink href={bulkExportHref(exportHref, ids)} label="Export" requested={count} resetOn={sel.edits} />
        </div>
        <span role="status" aria-live="polite" className="text-xs text-ink-subtle">
          {status}
        </span>
        <Button type="button" variant="ghost" className="ml-auto" onClick={() => clearKeepingFocus(document.getElementById(SELECT_ALL_ID), sel.clear)}>
          Clear
        </Button>
        <p id={noteId} className="hidden basis-full text-xs text-ink-subtle sm:block">
          {NOT_BUILT}
        </p>
      </div>
    </>
  );
}
