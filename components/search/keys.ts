// The keyboard on the result rows (DESIGN.md, Ledger Grid: ↑ ↓ or j k move between rows, ↵ opens
// the record, Space selects, r opens the RFQ composer for the row, s saves). With a record open
// beside the list (the body carries `data-follow="record"`), ↑ ↓ and j k change the open record
// the way Mail and Linear do, so Enter is not needed; with none open they only move focus. Only a
// key pressed on the row itself counts, never one inside its checkbox or a link, and it drives the
// row's own controls so the mouse and the keyboard cannot diverge. Pure over a minimal event so the
// suite can run it without a DOM.

type RowEvent = { key: string; target: unknown; metaKey: boolean; ctrlKey: boolean; altKey: boolean; preventDefault(): void };

type RowLike = {
  tagName: string;
  focus(): void;
  parentElement: { querySelectorAll(selector: string): Iterable<RowLike>; getAttribute?(name: string): string | null } | null;
  querySelector(selector: string): { click(): void } | null;
};

export const ROW_SELECTOR = 'tr[data-row="result"]';

/**
 * Set while an arrow key changes the open record, so the pane does not take focus from the row it
 * is following (`PaneFocus` reads it once and clears it). A plain click or Enter leaves it unset,
 * and the pane takes focus as it always has.
 */
export const keyFollow = { pending: false };

/** The row's own action for `r` and `s`: the hidden controls the row keeps for the keyboard. */
export const ACTION_SELECTOR = { rfq: '[data-action="rfq"]', save: '[data-action="save"]' } as const;

export function onRowKey(e: RowEvent): void {
  // A modified key is the browser's or the app's (Ctrl R reloads, Ctrl K searches), never a row action.
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const row = e.target as RowLike;
  if (!row || row.tagName !== "TR") return;
  const follows = row.parentElement?.getAttribute?.("data-follow") === "record";
  const move = (dir: 1 | -1) => {
    const rows = Array.from(row.parentElement?.querySelectorAll(ROW_SELECTOR) ?? []);
    const next = rows[rows.indexOf(row) + dir];
    if (!next) return;
    next.focus();
    if (follows) {
      keyFollow.pending = true;
      next.querySelector('a[data-open="record"]')?.click();
    }
  };
  switch (e.key) {
    case "ArrowDown":
    case "j":
      e.preventDefault();
      move(1);
      return;
    case "ArrowUp":
    case "k":
      e.preventDefault();
      move(-1);
      return;
    case "Enter":
      e.preventDefault();
      row.querySelector('a[data-open="record"]')?.click();
      return;
    case " ":
      e.preventDefault();
      row.querySelector('input[type="checkbox"]:not(:disabled)')?.click();
      return;
    case "r":
      e.preventDefault();
      row.querySelector(ACTION_SELECTOR.rfq)?.click();
      return;
    case "s":
      e.preventDefault();
      row.querySelector(ACTION_SELECTOR.save)?.click();
      return;
    default:
  }
}
