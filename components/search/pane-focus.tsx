"use client";

// Focus for the pane beside the results (WCAG 2.4.3, 4.1.3): opening a record is a client
// navigation, so without this focus stays on the row and a screen reader hears nothing.
// On open and whenever the pane's content changes, focus moves into the pane; on close it
// returns to the row that opened it.

import { useEffect, useRef } from "react";
import { openerFor } from "@/components/dashboard/dialog-focus";

export function PaneFocus({ openKey }: { openKey: string }) {
  // The record that OPENED the pane, read once: the row focus returns to.
  const opener = useRef<string | null>(null);
  useEffect(() => {
    if (opener.current === null) opener.current = new URLSearchParams(window.location.search).get("record") ?? "";
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
