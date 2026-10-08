"use client";

// The keyboard shortcuts, listed once in a sheet from the account menu (critique of 8 Oct 2026, item
// 6: no help layer). The list is the keys the app handles: `components/search/keys.ts` on the rows,
// Escape on the pane, Ctrl K on the search field, Ctrl ↵ in the composer; a test reads keys.ts and
// checks every key it handles is here. Not a help page (founder, 24 Sep 2026).

import { Dialog } from "@/components/kit/overlay";
import { targetIsEditable } from "./search-shortcut";

type HelpEvent = { key: string; metaKey?: boolean; ctrlKey?: boolean; altKey?: boolean; target?: unknown; preventDefault?: () => void };

/** `?` outside a field opens this sheet (round 3, item 5); in a field it is a question mark. */
export const isHelpKey = (e: HelpEvent): boolean => e.key === "?" && !e.metaKey && !e.ctrlKey && !e.altKey && !targetIsEditable(e.target);

type Listenable = { addEventListener: (type: string, fn: (e: never) => void) => void; removeEventListener: (type: string, fn: (e: never) => void) => void };

/** Installs the `?` listener and returns the cleanup; apart from the component so a stub can see it subscribe. */
export function installHelpKey(win: Listenable, open: () => void): () => void {
  const onKeyDown = ((e: HelpEvent) => {
    if (!isHelpKey(e)) return;
    e.preventDefault?.();
    open();
  }) as (e: never) => void;
  win.addEventListener("keydown", onKeyDown);
  return () => win.removeEventListener("keydown", onKeyDown);
}

export type Shortcut = { keys: string[]; does: string };

export const SHORTCUTS: readonly Shortcut[] = [
  { keys: ["?"], does: "Show these shortcuts" },
  { keys: ["↑", "↓"], does: "Move between rows; with a record open beside the list, it changes the record" },
  { keys: ["j", "k"], does: "The same, from the keys under the fingers" },
  { keys: ["↵"], does: "Open the row's record beside the list" },
  { keys: ["Space"], does: "Tick the row for a bulk action" },
  { keys: ["r"], does: "Write an RFQ to the row's supplier" },
  { keys: ["s"], does: "Save the row's supplier" },
  { keys: ["Esc"], does: "Close the pane and return to the list" },
  { keys: ["Ctrl K"], does: "Jump to the search field (⌘K on a Mac)" },
  { keys: ["Ctrl ↵"], does: "Send the RFQ from the composer (⌘↵ on a Mac)" },
];

/** The key a handler names ("ArrowDown", " ") as the sheet writes it. */
export const KEY_WORDS: Readonly<Record<string, string>> = { ArrowDown: "↓", ArrowUp: "↑", Enter: "↵", " ": "Space", Escape: "Esc" };

export function ShortcutList() {
  return (
    <dl className="flex flex-col divide-y divide-line">
      {SHORTCUTS.map((s) => (
        <div key={s.keys.join()} className="flex items-baseline gap-4 py-2.5">
          <dt className="flex w-24 shrink-0 gap-1">
            {s.keys.map((k) => (
              <kbd key={k} className="inline-flex h-6 min-w-6 items-center justify-center rounded-sm border border-line-strong bg-subtle px-1.5 font-mono text-xs text-ink">
                {k}
              </kbd>
            ))}
          </dt>
          <dd className="text-base text-ink-2">{s.does}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ShortcutsSheet({ onClose }: { onClose: () => void }) {
  return (
    <Dialog open kind="form" title="Keyboard shortcuts" description="On the results and Saved lists, and in the RFQ composer." onOpenChange={(open) => (open ? null : onClose())}>
      <ShortcutList />
    </Dialog>
  );
}
