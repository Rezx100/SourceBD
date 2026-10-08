import { cn } from "@/lib/utils";
// SourceBD v4 kit (B1): the few class strings every primitive shares. Values are
// Paper's (`02 Components`), through the token classes in `tailwind.config.ts`.

/** Focus-visible, drawn once on the Buttons board: a 2px brand ring, 2px off the control. Keyboard only. */
export const ring =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

/** The same ring drawn inside a row that fills its box (menu items, tabs), so a neighbour never clips it. */
export const ringInset =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus";

/** A field's focus and error are a 2px edge: the 1px border plus a 1px inner line, so nothing shifts. */
export const fieldEdge =
  "outline-none focus:border-brand-ink focus:[box-shadow:inset_0_0_0_1px_theme(colors.brand-ink)] aria-[invalid=true]:border-danger aria-[invalid=true]:[box-shadow:inset_0_0_0_1px_theme(colors.danger)]";

/** A control's resting edge, hover edge and disabled fill (inputs, selects). */
export const fieldBox =
  "w-full rounded-sm border border-line-strong bg-surface text-ink placeholder:text-ink-3 hover:border-ink-3 disabled:border-sunken disabled:bg-sunken disabled:text-disabled disabled:placeholder:text-disabled";

/** A link in text and rows: brand, underlined 1px, 2px on hover (Buttons board, "Link"). */
export const linkClass =
  "rounded-sm font-medium text-brand-ink underline decoration-1 [text-underline-position:from-font] hover:decoration-2 aria-disabled:pointer-events-none aria-disabled:text-disabled " +
  ring;

// Shared by client and server files: a class string exported from a "use client" file reaches a server file as a reference, not a string.
/** The menu box and its rows, shared with `Select`'s list and drawn static in the gallery. */
export const menuClass = "z-toast flex min-w-[180px] flex-col rounded-lg border border-line bg-surface p-1 shadow-menu outline-none";
export const menuItemClass =
  "flex h-8 cursor-default select-none items-center justify-between gap-2 rounded-sm px-2 text-base text-ink outline-none data-[highlighted]:bg-sunken data-[disabled]:text-disabled " +
  ringInset;

export const popoverClass = "z-toast w-80 max-w-[calc(100vw-2rem)] rounded-lg border border-line bg-surface p-4 shadow-menu outline-none";
export const tooltipClass = "z-toast max-w-60 rounded-sm bg-ink px-2 py-1.5 text-xs text-surface";

/** Undo, in a toast: semibold, underlined, 32 tall. */
export const toastActionClass =
  "flex h-8 items-center rounded-sm px-3 font-semibold underline decoration-1 [text-underline-position:from-font] outline-none hover:decoration-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-surface";

/** A row of the open list: the chosen one brand-tint with a check, the one under the pointer or arrows sunken. */
export const selectItemClass = cn(
  "flex h-8 cursor-default select-none items-center justify-between rounded-sm px-2 text-base text-ink outline-none",
  "data-[highlighted]:bg-sunken data-[state=checked]:bg-brand-tint data-[state=checked]:font-medium data-[disabled]:text-disabled",
  ring,
);
