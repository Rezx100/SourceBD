"use client";

// Keyboard and screen-reader behaviour for a sheet opened over the results
// (WCAG 2.4.3, 4.1.3). Opening a record is a client navigation that makes the
// link just clicked inert, so without this focus fell to the page body and a
// screen reader heard nothing — Next's route announcer reads `document.title`,
// which does not change. So:
//
// - on open, focus moves to the dialog, which announces its label — and again
//   whenever the sheet's content changes inside the same frame (a record to
//   one of its lines and back, a building notice to its company's record),
//   because the control just activated was replaced and focus fell with it;
// - Escape closes it, the same as the bar's Close;
// - on close, focus returns to the result that opened it.

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

/** The record link in the results for `slug`: the element focus returns to. */
export function openerFor(slug: string, links: Iterable<HTMLAnchorElement>): HTMLAnchorElement | null {
  for (const a of links) {
    if (a.closest('[role="dialog"]')) continue;
    const params = new URL(a.getAttribute("href") ?? "", "http://x").searchParams;
    if (params.get("record") === slug && !params.has("line")) return a;
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
  const opener = useRef<string | null>(null);
  useEffect(() => {
    opener.current ??= new URLSearchParams(window.location.search).get("record");
    document.querySelector<HTMLElement>('[role="dialog"]')?.focus();
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
      // After the commit that removes the sheet, so the results are no longer inert.
      const slug = opener.current;
      if (slug) setTimeout(() => openerFor(slug, document.querySelectorAll("a[href]"))?.focus({ preventScroll: true }), 0);
    };
  }, [closeHref, router]);
  return null;
}
