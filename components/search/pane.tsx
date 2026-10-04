// What fills `ListPane`'s pane: a column that scrolls in its own box, focus moved into it
// when it opens or changes (a record to one of its lines, a notice to its record), and focus
// handed back to the row that opened it when it closes. Escape is `ListPane`'s: from inside
// the pane only, never from the topbar's field.

import { Fragment, type ReactNode } from "react";
import { PaneFocus } from "./pane-focus";

export function PaneFrame({ openKey, children }: { /** What the pane shows; focus moves whenever it changes. */ openKey: string; children: ReactNode }) {
  return (
    <div data-pane-frame="" data-open-key={openKey} tabIndex={-1} className="flex min-h-0 min-w-0 flex-1 flex-col outline-none">
      <PaneFocus openKey={openKey} />
      {/* Keyed by what it shows: opening another record beside the list is a client navigation into the same tree, and a form inside would keep the previous one's state. */}
      <Fragment key={openKey}>{children}</Fragment>
    </div>
  );
}
