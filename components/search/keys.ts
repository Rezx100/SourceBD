// The keyboard on the result rows (hand-off section 6: arrows move the row, Enter opens the
// pane, Space ticks it). Only a key pressed on the row itself counts, never one inside its
// checkbox or a link, and it drives the row's own controls so the mouse and the keyboard
// cannot diverge. Pure over a minimal event so the suite can run it without a DOM.

type RowEvent = { key: string; target: unknown; metaKey: boolean; ctrlKey: boolean; altKey: boolean; preventDefault(): void };

type RowLike = {
  tagName: string;
  focus(): void;
  parentElement: { querySelectorAll(selector: string): Iterable<RowLike> } | null;
  querySelector(selector: string): { click(): void } | null;
};

export const ROW_SELECTOR = 'tr[data-row="result"]';

export function onRowKey(e: RowEvent): void {
  // A modified key is the browser's or the app's (Ctrl R reloads, Ctrl K searches), never a row action.
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const row = e.target as RowLike;
  if (!row || row.tagName !== "TR") return;
  const move = (dir: 1 | -1) => {
    const rows = Array.from(row.parentElement?.querySelectorAll(ROW_SELECTOR) ?? []);
    rows[rows.indexOf(row) + dir]?.focus();
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
    default:
  }
}
