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
import { announceBulkSaved, bulkExportHref, bulkSaveMessage, SEND_RFQ_MAX } from "@/lib/dashboard/selection";
import { Button } from "./controls";
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

  // A message about the last save describes THAT selection; once the
  // selection changes (or empties and the bar hides) it is stale.
  useEffect(() => {
    setStatus("");
  }, [sel.selected]);

  // WCAG 2.4.11: a sticky bar at the bottom of the window covers whatever the
  // browser scrolls a newly focused row to, because the browser scrolls to
  // the viewport's edge and ignores the bar. Reserve the bar's height —
  // measured, since it wraps onto several lines on a phone — while it shows.
  useEffect(() => {
    const bar = barRef.current;
    if (!visible || !bar) return;
    const root = document.documentElement;
    const before = root.style.scrollPaddingBottom;
    const fit = () => {
      root.style.scrollPaddingBottom = `${bar.offsetHeight + 8}px`;
    };
    fit();
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(fit);
    ro?.observe(bar);
    return () => {
      ro?.disconnect();
      root.style.scrollPaddingBottom = before;
    };
  }, [visible]);

  if (!visible) return null;
  const ids = [...sel.selected];
  const count = ids.length;

  async function bulkSave() {
    if (busy) return;
    setBusy(true);
    setStatus("");
    try {
      // ONE request for the whole selection: one write against the buyer's
      // rate-limit bucket, not one per supplier.
      const res = await fetch("/api/v1/saved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ supplier_ids: ids }),
      });
      setStatus(bulkSaveMessage(res.status, count));
      if (res.ok) {
        announceBulkSaved(window, ids);
        router.refresh();
      }
    } catch {
      setStatus(bulkSaveMessage("network", count));
    } finally {
      setBusy(false);
    }
  }

  function clear() {
    // Clear empties the selection, which unmounts this bar and the focused
    // Clear button with it; without this, focus falls to <body> and the next
    // Tab starts again from the top of the document.
    document.getElementById(SELECT_ALL_ID)?.focus();
    sel.clear();
  }

  return (
    <div
      ref={barRef}
      role="group"
      aria-label="Bulk actions"
      className="sticky bottom-0 z-20 flex flex-wrap items-center gap-3 border-t border-line-strong bg-surface px-4 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.08)] sm:px-5"
    >
      <span aria-live="polite" className="text-sm font-medium text-ink-strong">
        {count} selected
      </span>
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
        <Button href={bulkExportHref(exportHref, ids)}>
          <Icon name="download" /> Export
        </Button>
      </div>
      <span role="status" aria-live="polite" className="text-xs text-ink-subtle">
        {status}
      </span>
      <Button type="button" variant="ghost" className="ml-auto" onClick={clear}>
        Clear
      </Button>
      <p id={noteId} className="basis-full text-xs text-ink-subtle">
        {NOT_BUILT}
      </p>
    </div>
  );
}
