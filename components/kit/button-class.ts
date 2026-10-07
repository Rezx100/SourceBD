// The buttons of `02 Components · 1`, as class strings so a `<button>`, a `<Link>`
// and an `<a>` all look the same (a real element where Paper has a box). Server-safe.

import { cn } from "@/lib/utils";
import { linkClass, ring } from "./classes";

export type ButtonKind = "primary" | "secondary" | "quiet" | "danger" | "link";
/** Text sizes 32 / 40 / 48 (phone), icon-only sizes 24 / 32 / 44 / 48. */
export type ButtonSize = "md" | "lg" | "touch" | "icon-24" | "icon-32" | "icon-44" | "icon-48";

// Default, hover, pressed, disabled. Disabled is a colour, not an opacity; `aria-disabled`
// is the same look for links, which cannot be `disabled`.
const KIND: Record<Exclude<ButtonKind, "link">, string> = {
  primary:
    "bg-brand text-brand-on hover:bg-brand-hover active:bg-brand-active disabled:bg-sunken disabled:text-disabled aria-disabled:bg-sunken aria-disabled:text-disabled",
  secondary:
    "border border-line-strong bg-surface text-ink hover:border-ink-3 hover:bg-subtle active:border-ink-3 active:bg-sunken disabled:border-sunken disabled:bg-sunken disabled:text-disabled aria-disabled:border-sunken aria-disabled:bg-sunken aria-disabled:text-disabled",
  quiet:
    "text-ink-2 hover:bg-sunken hover:text-ink active:bg-line active:text-ink disabled:bg-transparent disabled:text-disabled aria-disabled:bg-transparent aria-disabled:text-disabled",
  danger:
    "bg-danger-solid text-surface hover:bg-danger active:bg-danger-active disabled:bg-sunken disabled:text-disabled aria-disabled:bg-sunken aria-disabled:text-disabled",
};

const SIZE: Record<ButtonSize, string> = {
  md: "h-control px-3 gap-2 text-base",
  lg: "h-control-lg px-4 gap-2 text-base",
  touch: "h-input-touch px-4 gap-2 text-md",
  "icon-24": "size-6",
  "icon-32": "size-8",
  "icon-44": "size-11",
  "icon-48": "size-12",
};

/** Pixel size of the glyph a button of this size carries (Buttons board: 16 / 20 / 24). */
export const ICON_PX: Record<ButtonSize, number> = {
  md: 16,
  lg: 20,
  touch: 20,
  "icon-24": 16,
  "icon-32": 20,
  "icon-44": 24,
  "icon-48": 24,
};

const BASE =
  "inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-sm font-medium transition-colors duration-fast select-none disabled:cursor-not-allowed aria-disabled:cursor-not-allowed " +
  ring;

export function buttonClass({
  kind = "secondary",
  size = "md",
  full = false,
  className,
}: { kind?: ButtonKind; size?: ButtonSize; full?: boolean; className?: string } = {}) {
  if (kind === "link") return cn("inline", linkClass, className);
  return cn(BASE, KIND[kind], SIZE[size], full && "w-full", className);
}
