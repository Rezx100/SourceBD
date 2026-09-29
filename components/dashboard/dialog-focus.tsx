"use client";

// Keyboard and screen-reader behaviour for the record pane opened beside the
// results (WCAG 2.4.3, 4.1.3). Opening a record is a client navigation, so
// without this focus fell to the page body and a screen reader heard nothing
// — Next's route announcer reads `document.title`, which does not change. So:
//
// - on open, focus moves to the pane, which announces its label — and again
//   whenever the pane's content changes inside the same frame (a record to
//   one of its lines and back, a building notice to its company's record),
//   because the control just activated was replaced and focus fell with it;
// - Escape closes it, the same as the bar's Close;
// - on close, focus returns to the result that opened it.
//
// The pane is not a dialog: the results stay live beside it. `data-record-pane`
// is what marks it.
//
// Below `lg` the pane is the whole screen and the window scrolls (the phone
// hand-off's R12): a record opens at its top, not part-way down where the
// list was, and closing brings the row it was opened from back into view.

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

/** Whether the pane is the whole screen (below `lg`), where the window scrolls to the record and back. */
function paneIsScreen(): boolean {
  return typeof window.matchMedia === "function" && !window.matchMedia("(min-width: 1024px)").matches;
}

/** The record link in the results for `slug`: the element focus returns to. */
export function openerFor(slug: string, links: Iterable<HTMLAnchorElement>, key: "record" | "open" = "record"): HTMLAnchorElement | null {
  for (const a of links) {
    if (a.closest("[data-record-pane]")) continue;
    const params = new URL(a.getAttribute("href") ?? "", "http://x").searchParams;
    if (params.get(key) === slug && !params.has("line")) return a;
  }
  return null;
}

/**
 * `openKey` names what the frame is showing — the record, the line, or the
 * notice. React keeps this component mounted while the content under it
 * changes, so the key is what re-runs the move of focus.
 */
export function DialogFocus({ closeHref, openKey }: { closeHref: string; openKey: string }) {
  const router = useRouter();
  // The record that OPENED the sheet: the result focus returns to on close.
  // `record` on the search, the saved list and a thread; `open` on the orders and RFQ lists.
  const opener = useRef<{ key: "record" | "open"; id: string } | null>(null);
  useEffect(() => {
    if (!opener.current) {
      const q = new URLSearchParams(window.location.search);
      const record = q.get("record");
      const open = q.get("open");
      opener.current = record ? { key: "record", id: record } : open ? { key: "open", id: open } : null;
    }
    if (paneIsScreen()) window.scrollTo(0, 0);
    document.querySelector<HTMLElement>("[data-record-pane]")?.focus({ preventScroll: true });
  }, [openKey]);
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      e.preventDefault();
      router.push(closeHref, { scroll: false });
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      // After the commit that removes the pane, so the results are back on screen.
      const o = opener.current;
      if (o) {
        setTimeout(() => {
          const row = openerFor(o.id, document.querySelectorAll("a[href]"), o.key);
          row?.focus({ preventScroll: true });
          if (row && paneIsScreen()) row.scrollIntoView({ block: "center" });
        }, 0);
      }
    };
  }, [closeHref, router]);
  return null;
}
