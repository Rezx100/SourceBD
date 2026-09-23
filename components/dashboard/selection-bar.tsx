"use client";

// The sticky bulk-action bar (REZ-B, handoff §7.5 / spec §3.1 "Selection"):
// "N selected · Send RFQ · Save · Compare · Export". Renders nothing with an
// empty selection.
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
  SEND_RFQ_MAX,
} from "@/lib/dashboard/selection";
import { Button } from "./controls";
import { ExportLink } from "./export-link";
import { Icon } from "./icons";
import { SELECT_ALL_ID, useSelection } from "./selection";

const NOT_BUILT = `Send RFQ and Compare for several suppliers at once are not built yet. Open a supplier's record to send one an RFQ.`;
const SEND_RFQ_SOON = `Sending an RFQ to more than one supplier at once is not built yet — open a supplier's record to send one, or select ${SEND_RFQ_MAX} or fewer once it ships.`;
const COMPARE_SOON = "Comparing selected suppliers side by side is not built yet.";

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

  // A message about the last save describes THAT selection; once the
  // selection changes (or empties and the bar hides) it is stale.
  useEffect(() => {
    generation.current += 1;
    setStatus("");
  }, [sel.selected]);

  // WCAG 2.4.11 — see reserveBarSpace.
  useEffect(() => {
    const bar = barRef.current;
    if (!visible || !bar) return;
    const observe = typeof ResizeObserver === "undefined" ? null : (fit: () => void) => new ResizeObserver(fit);
    return reserveBarSpace(document.documentElement, bar, document.activeElement as HTMLElement | null, observe);
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
    setBusy(false);
    if (generation.current !== asked) return;
    setStatus(message);
  }

  return (
    <>
      {announcer}
      <div
        ref={barRef}
        role="group"
        aria-label="Bulk actions"
        className="sticky bottom-0 z-20 flex flex-wrap items-center gap-3 border-t border-line-strong bg-surface px-4 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.08)] sm:px-5"
      >
        <span className="text-sm font-medium text-ink-strong">{count} selected</span>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary" disabled title={SEND_RFQ_SOON} aria-describedby={noteId}>
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
            title={COMPARE_SOON}
            aria-describedby={noteId}
            className="disabled:cursor-not-allowed disabled:border-line disabled:text-ink-disabled"
          >
            <Icon name="compare" /> Compare
          </Button>
          <ExportLink href={bulkExportHref(exportHref, ids)} label="Export" requested={count} />
        </div>
        <span role="status" aria-live="polite" className="text-xs text-ink-subtle">
          {status}
        </span>
        <Button type="button" variant="ghost" className="ml-auto" onClick={() => clearKeepingFocus(document.getElementById(SELECT_ALL_ID), sel.clear)}>
          Clear
        </Button>
        <p id={noteId} className="basis-full text-xs text-ink-subtle">
          {NOT_BUILT}
        </p>
      </div>
    </>
  );
}
