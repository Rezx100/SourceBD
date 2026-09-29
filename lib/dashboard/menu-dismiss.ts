// Every tray in the buyer app is a native `<details>` (it opens without
// script). On a phone two stayed open at once, the later painting over the
// earlier, and nothing but the tray's own button closed one: not a tap
// outside, not Escape, not choosing another (founder's video, 30 Sep 2026,
// `handoff-dashboard-mobile.md` R3/D2). So:
//
// - every tray carries `name="sb-menu"`: an exclusive group, so opening one
//   closes the other (Chrome/Edge 120, Safari 17.2, Firefox 130); the toggle
//   handler below does the same where the browser ignores the name;
// - a press outside every open tray closes it (`pointerdown`, which a touch
//   sends and `mousedown` may not);
// - Escape closes it, returns focus to its button and marks the key handled,
//   so the record pane's own Escape does not close the record as well;
// - an opening tray is kept on the screen: moved in from the edge, opened
//   upward when there is no room below, or bounded and scrolled inside.
//
// Plain DOM and no imports, installed once by the shell (`MenuDismiss`); the
// preview harness runs the compiled file in a static page as it is.

/** The `name` every tray's `<details>` carries. */
export const MENU_NAME = "sb-menu";

type Box = { top: number; left: number; right: number; bottom: number; width: number; height: number };

/** Whether an event outside React closes an open menu: Escape, or a press that lands outside it. */
export function menuShouldClose(e: { key?: string; target?: unknown }, menu: { open: boolean; contains: (n: never) => boolean }): boolean {
  if (!menu.open) return false;
  return e.key !== undefined ? e.key === "Escape" : !menu.contains(e.target as never);
}

/**
 * Where an opening panel goes so it stays on the screen: `dx`, `dy` move it
 * from where its classes put it; `maxHeight` bounds it (its content scrolls)
 * when it fits neither below its button nor above it.
 */
export function placePanel(panel: Box, button: Box, view: { width: number; height: number }, margin = 8): { dx: number; dy: number; maxHeight: number | null } {
  let dx = 0;
  if (panel.right > view.width - margin) dx = view.width - margin - panel.right;
  if (panel.left + dx < margin) dx = margin - panel.left;
  let dy = 0;
  let maxHeight: number | null = null;
  const below = panel.top >= button.top;
  if (below && panel.bottom > view.height - margin) {
    const roomAbove = button.top - 4 - margin;
    if (panel.height <= roomAbove) dy = button.top - 4 - panel.height - panel.top;
    else maxHeight = Math.max(160, view.height - margin - panel.top);
  } else if (!below && panel.top < margin) {
    const roomBelow = view.height - margin - (button.bottom + 4);
    if (panel.height <= roomBelow) dy = button.bottom + 4 - panel.top;
    else maxHeight = Math.max(160, panel.bottom - margin);
  }
  return { dx, dy, maxHeight };
}

/** Listen on `doc` for the presses, keys and toggles that close and place the trays; returns the cleanup. */
export function installMenuDismiss(doc: Document): () => void {
  const view = doc.defaultView;
  const openMenus = () => Array.from(doc.querySelectorAll<HTMLDetailsElement>(`details[name="${MENU_NAME}"][open]`));
  const onPointer = (e: Event) => {
    for (const d of openMenus()) if (menuShouldClose({ target: e.target }, d)) d.open = false;
  };
  // Choosing an item closes its tray, even when the choice goes nowhere new
  // (Archive, or Settings while on Settings).
  const onClick = (e: Event) => {
    const item = (e.target as Element | null)?.closest?.("[data-menu-item]");
    const d = item?.closest<HTMLDetailsElement>(`details[name="${MENU_NAME}"]`);
    if (d) d.open = false;
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== "Escape") return;
    const open = openMenus();
    if (open.length === 0) return;
    e.preventDefault();
    // Focus goes back to the tray's button only if it was inside the tray.
    const holder = open.find((d) => d.contains(doc.activeElement));
    for (const d of open) d.open = false;
    holder?.querySelector<HTMLElement>("summary")?.focus();
  };
  const place = (d: HTMLDetailsElement) => {
    const panel = d.querySelector<HTMLElement>(":scope > [data-menu-panel]");
    const button = d.querySelector<HTMLElement>(":scope > summary");
    if (!panel || !button || !view) return;
    panel.style.translate = "";
    panel.style.maxHeight = "";
    // A bottom sheet (fixed to the screen's foot on a phone) is already on it.
    if (view.getComputedStyle(panel).position === "fixed") return;
    const { dx, dy, maxHeight } = placePanel(panel.getBoundingClientRect(), button.getBoundingClientRect(), { width: view.innerWidth, height: view.innerHeight });
    if (dx !== 0 || dy !== 0) panel.style.translate = `${Math.round(dx)}px ${Math.round(dy)}px`;
    if (maxHeight !== null) panel.style.maxHeight = `${Math.round(maxHeight)}px`;
  };
  const onToggle = (e: Event) => {
    const d = e.target as HTMLDetailsElement | null;
    if (!d || d.tagName !== "DETAILS" || d.getAttribute("name") !== MENU_NAME || !d.open) return;
    for (const other of openMenus()) if (other !== d && !other.contains(d) && !d.contains(other)) other.open = false;
    place(d);
  };
  // A turned phone or a resized window: place the open tray again. Never
  // close it here: a keyboard opening on Android resizes the window too.
  const onResize = () => openMenus().forEach(place);
  doc.addEventListener("pointerdown", onPointer, true);
  doc.addEventListener("click", onClick, true);
  doc.addEventListener("keydown", onKey, true);
  // `toggle` does not bubble; the capture phase still sees it.
  doc.addEventListener("toggle", onToggle, true);
  view?.addEventListener("resize", onResize);
  return () => {
    doc.removeEventListener("pointerdown", onPointer, true);
    doc.removeEventListener("click", onClick, true);
    doc.removeEventListener("keydown", onKey, true);
    doc.removeEventListener("toggle", onToggle, true);
    view?.removeEventListener("resize", onResize);
  };
}
