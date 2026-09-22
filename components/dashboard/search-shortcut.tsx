"use client";

import { useEffect } from "react";

/**
 * The topbar has advertised `⌘K` beside the search field since the kit landed
 * and nothing listened for it — the badge told a buyer something untrue about
 * their own keyboard.
 *
 * Everything here is a pure function taking what it needs, because the suite is
 * `node --test` with `renderToStaticMarkup` and no DOM. The first version put
 * the whole thing in a `useEffect` and tested only the modifier predicate, so
 * deleting `<SearchShortcut />` from the topbar — or the `addEventListener`
 * inside it — left every test green and restored the exact defect the component
 * exists to fix.
 */

type ShortcutEvent = {
  key: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  target?: unknown;
};

/** Anything a keystroke belongs to more than it belongs to us. */
export function targetIsEditable(target: unknown): boolean {
  if (!target || typeof target !== "object") return false;
  const el = target as { tagName?: unknown; isContentEditable?: unknown };
  if (el.isContentEditable === true) return true;
  const tag = typeof el.tagName === "string" ? el.tagName.toUpperCase() : "";
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

export function isSearchShortcut(e: ShortcutEvent): boolean {
  if (e.altKey || e.shiftKey) return false;
  // Exactly one of the two, so ⌘⌃K — which macOS and Windows both hand to
  // other things — is left alone.
  if (Boolean(e.metaKey) === Boolean(e.ctrlKey)) return false;
  if (e.key !== "k" && e.key !== "K") return false;
  // On macOS Ctrl+K inside a text field is the native delete-to-end-of-line,
  // and /app/discover carries thirteen filter inputs plus the save-search name
  // box. A window-level listener that swallowed it took a keystroke from a
  // buyer who was using it, with no way to turn the theft off.
  //
  // Except in the field this shortcut exists to reach: pressing ⌘K again to
  // re-select what you typed is the whole idiom, and treating the search input
  // as "somebody is typing" made the badge beside it advertise a key that did
  // nothing precisely where it should do the most.
  if (targetIsSearchField(e.target)) return true;
  return !targetIsEditable(e.target);
}

/** The search field this shortcut acts on, or null when the page has none. */
type FieldDocument = { querySelector: (selector: string) => unknown };

/**
 * The topbar's own field.
 *
 * It used to be `form[role="search"] input[name="q"]`, with a comment saying
 * only the topbar renders such a form. That was not true:
 * `app/(app)/app/products/page.tsx` renders its own `role="search"` form over
 * an `input name="q"`, on a route this same rail links to, so on `/app/products`
 * the selector matched two elements and only DOM order decided which one ⌘K
 * focused. `data-search="topbar"` says which one is meant instead of inferring
 * it, and the gallery's six shells cannot collide on it either.
 */
export const SEARCH_FIELD_SELECTOR = 'input[data-search="topbar"]';

/** True when a keystroke's target IS the field this shortcut focuses. */
export function targetIsSearchField(target: unknown): boolean {
  if (!target || typeof target !== "object") return false;
  const el = target as { dataset?: { search?: unknown }; getAttribute?: (n: string) => unknown };
  if (el.dataset && el.dataset.search === "topbar") return true;
  return typeof el.getAttribute === "function" && el.getAttribute("data-search") === "topbar";
}

/**
 * Finds the field and focuses it. Returns whether it did, so a caller — and a
 * test — can tell "no field here" from "focused it".
 *
 * It queries by structure rather than by id because an id would have to be
 * unique and this component would have to be told which one. `querySelector`
 * takes the first match in the document, which is the right answer on every
 * route: only the topbar renders a `role="search"` form, and only when there
 * is a real search action to submit to.
 */
export function focusSearchField(doc: FieldDocument): boolean {
  const found = doc.querySelector(SEARCH_FIELD_SELECTOR);
  if (!found || typeof found !== "object") return false;
  const input = found as { focus?: () => void; select?: () => void };
  if (typeof input.focus !== "function") return false;
  input.focus();
  if (typeof input.select === "function") input.select();
  return true;
}

/**
 * The listener, as a value. `SearchShortcut` only installs it; this is the part
 * with the behaviour, and it can be called with a stub document.
 */
export function searchShortcutHandler(doc: FieldDocument) {
  return (e: ShortcutEvent & { preventDefault?: () => void }): boolean => {
    if (!isSearchShortcut(e)) return false;
    if (!focusSearchField(doc)) return false;
    e.preventDefault?.();
    return true;
  };
}

type Listenable = {
  addEventListener: (type: string, fn: (e: never) => void) => void;
  removeEventListener: (type: string, fn: (e: never) => void) => void;
};

/**
 * Installs the listener and returns the cleanup.
 *
 * Separate from the component because `useEffect` never runs in this suite, so
 * with the wiring inside it, replacing `window.addEventListener` with
 * `void onKeyDown` left every test green — the mount was proved and the handler
 * was proved and the one line joining them was not. Taking `win`/`doc` as
 * arguments is what lets a stub see the subscription happen.
 */
export function installSearchShortcut(win: Listenable, doc: FieldDocument): () => void {
  const onKeyDown = searchShortcutHandler(doc) as (e: never) => void;
  win.addEventListener("keydown", onKeyDown);
  return () => win.removeEventListener("keydown", onKeyDown);
}

/** Mounted by the topbar, only where there is a real search form to focus. */
export function SearchShortcut() {
  useEffect(() => installSearchShortcut(window as unknown as Listenable, document), []);
  return null;
}
