"use client";

import { useEffect } from "react";

/**
 * The topbar has advertised `⌘K` beside the search field since the kit landed,
 * and no such shortcut existed — the badge was decoration that told a buyer
 * something untrue about their own keyboard. The sidebar's Search row prints
 * the same hint.
 *
 * Pure so it can be tested without a DOM: the suite is `node --test` with
 * `renderToStaticMarkup` and no jsdom, so the handler's decision has to be a
 * value, not a side effect.
 */
export function isSearchShortcut(e: {
  key: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
}): boolean {
  if (e.altKey || e.shiftKey) return false;
  // Exactly one of the two, so ⌘⌃K — which macOS and Windows both hand to other
  // things — is left alone.
  if (Boolean(e.metaKey) === Boolean(e.ctrlKey)) return false;
  return e.key === "k" || e.key === "K";
}

/**
 * Mounted by the topbar only when there is a real search form to focus. It
 * finds the field by structure rather than by id: six AppShells share one
 * document in the `/dev/ds` gallery, and an id would collide across them the
 * way `ds-main` already did.
 */
export function SearchShortcut() {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!isSearchShortcut(e)) return;
      const input = document.querySelector<HTMLInputElement>('form[role="search"] input[name="q"]');
      if (!input) return;
      e.preventDefault();
      input.focus();
      input.select();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
  return null;
}
