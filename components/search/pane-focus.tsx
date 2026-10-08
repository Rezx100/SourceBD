"use client";

// Focus for the pane beside the results (WCAG 2.4.3, 4.1.3): opening a record is a client
// navigation, so without this focus stays on the row and a screen reader hears nothing.
// On open and whenever the pane's content changes, focus moves into the pane; on close it
// returns to the row that opened it.

import { useEffect, useRef } from "react";
import { keyFollow } from "./keys";

/** The record link in the results for `slug`: the element focus returns to. */
export function openerFor(slug: string, links: Iterable<HTMLAnchorElement>, key: "record" | "open" = "record"): HTMLAnchorElement | null {
  for (const a of links) {
    if (a.closest("[data-record-pane]")) continue;
    const params = new URL(a.getAttribute("href") ?? "", "http://x").searchParams;
    if (params.get(key) === slug && !params.has("line")) return a;
  }
  return null;
}

export function PaneFocus({ openKey }: { openKey: string }) {
  // The record that OPENED the pane, read once: the row focus returns to.
  const opener = useRef<string | null>(null);
  useEffect(() => {
    if (opener.current === null) opener.current = new URLSearchParams(window.location.search).get("record") ?? "";
    // An arrow key changed the open record: focus stays on the row it moved to, which is now the
    // row focus returns to on Close; the pane is announced by the row's `aria-current`.
    if (keyFollow.pending) {
      keyFollow.pending = false;
      opener.current = new URLSearchParams(window.location.search).get("record") ?? opener.current;
      return;
    }
    const frame = document.querySelector<HTMLElement>("[data-pane-frame]");
    // The pane's own labelled region when its content draws one (it is announced by its name), else the frame.
    (frame?.querySelector<HTMLElement>("[data-record-pane]") ?? frame)?.focus({ preventScroll: true });
  }, [openKey]);
  useEffect(
    () => () => {
      const slug = opener.current;
      if (!slug) return;
      // After the commit that removes the pane, so the results are back on screen.
      setTimeout(() => openerFor(slug, document.querySelectorAll<HTMLAnchorElement>("a[href]"))?.focus({ preventScroll: true }), 0);
    },
    [],
  );
  return null;
}
