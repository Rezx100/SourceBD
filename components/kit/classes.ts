// SourceBD v4 kit (B1): the few class strings every primitive shares. Values are
// Paper's (`02 Components`), through the token classes in `tailwind.config.ts`.

/** Focus-visible, drawn once on the Buttons board: a 2px brand ring, 2px off the control. Keyboard only. */
export const ring =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

/** The same ring drawn inside a row that fills its box (menu items, tabs), so a neighbour never clips it. */
export const ringInset =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand";

/** A field's focus and error are a 2px edge: the 1px border plus a 1px inner line, so nothing shifts. */
export const fieldEdge =
  "outline-none focus:border-brand focus:[box-shadow:inset_0_0_0_1px_theme(colors.brand)] aria-[invalid=true]:border-danger aria-[invalid=true]:[box-shadow:inset_0_0_0_1px_theme(colors.danger)]";

/** A control's resting edge, hover edge and disabled fill (inputs, selects). */
export const fieldBox =
  "w-full rounded-sm border border-line-strong bg-surface text-ink placeholder:text-ink-3 hover:border-ink-3 disabled:border-sunken disabled:bg-sunken disabled:text-disabled disabled:placeholder:text-disabled";

/** A link in text and rows: brand, underlined 1px, 2px on hover (Buttons board, "Link"). */
export const linkClass =
  "rounded-sm font-medium text-brand underline decoration-1 [text-underline-position:from-font] hover:text-brand-hover hover:decoration-2 active:text-brand-active aria-disabled:pointer-events-none aria-disabled:text-disabled " +
  ring;
