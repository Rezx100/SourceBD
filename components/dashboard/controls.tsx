// Controls of the dashboard kit: buttons, the segmented toggle, the checkbox,
// the V2 tag, meters and the live dot. Tailwind classes only; every colour is
// a token role (`lib/design/tokens.ts`).
//
// The button system (enterprise pass, 27 Sep 2026, direction B1 "Quiet"):
// three tiers drawn by tone, not outline. `primary` is the one brand fill on a
// screen; `default` (secondary) is a sunken tone with a soft edge; `ghost`
// (tertiary) is text that gains a fill on hover; `danger` is the destructive
// tier. Three sizes — 28 / 32 / 36 — and six states on every tier: rest,
// hover, pressed (2 % smaller, 120 ms), focus (the global ring), disabled and
// loading. Icons sit only on a verb that has one (send, save, create); an
// icon-only button carries its accessible name.

import Link from "next/link";
import type { ButtonHTMLAttributes, MouseEventHandler, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Icon, type IconName } from "./icons";
import { LinkPending } from "./link-pending";

export type ButtonVariant = "default" | "primary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const SIZE: Record<ButtonSize, string> = {
  sm: "h-7 px-2 text-xs",
  md: "h-control px-3 text-sm",
  lg: "h-9 px-3.5 text-sm",
};
const SQUARE: Record<ButtonSize, string> = { sm: "w-7 px-0", md: "w-control px-0", lg: "w-9 px-0" };

const TONE: Record<ButtonVariant, string> = {
  primary:
    "bg-brand text-brand-on hover:bg-brand-hover active:bg-brand-active disabled:bg-surface-sunken disabled:text-ink-disabled disabled:hover:bg-surface-sunken aria-disabled:bg-surface-sunken aria-disabled:text-ink-disabled",
  default:
    "bg-surface-sunken text-ink shadow-edge hover:bg-line hover:text-ink-strong active:bg-line disabled:text-ink-disabled disabled:shadow-none disabled:hover:bg-surface-sunken aria-disabled:text-ink-disabled aria-disabled:shadow-none",
  ghost:
    "bg-transparent text-ink-muted hover:bg-surface-sunken hover:text-ink-strong active:bg-line disabled:text-ink-disabled disabled:hover:bg-transparent aria-disabled:text-ink-disabled aria-disabled:hover:bg-transparent",
  danger:
    "bg-danger-tint text-danger-ink hover:bg-danger hover:text-danger-on active:bg-danger disabled:bg-surface-sunken disabled:text-ink-disabled disabled:hover:bg-surface-sunken aria-disabled:bg-surface-sunken aria-disabled:text-ink-disabled",
};

/** The class list a control shares, exported so a link that must look like a button (a row action drawn by `next/link`) draws the same. */
export function buttonClass({
  variant = "default",
  size = "md",
  icon = false,
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: boolean;
  className?: string;
}): string {
  return cn(
    // A press is felt as well as seen: the control settles 2 % smaller for as
    // long as it is held (120 ms in and out), the way a native control does;
    // colour and shadow move on the same clock. A disabled control takes no
    // press, and `motion-reduce` keeps it still.
    "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-sm border border-transparent font-medium transition-[color,background-color,border-color,box-shadow,transform] duration-fast active:scale-[0.98] motion-reduce:active:scale-100 disabled:cursor-not-allowed disabled:active:scale-100 aria-disabled:cursor-not-allowed aria-disabled:active:scale-100",
    SIZE[size],
    icon && SQUARE[size],
    TONE[variant],
    className,
  );
}

/**
 * `.btn`. `variant` is the tier; `size` the density stop (`lg` is kept as a
 * boolean alias for `size="lg"`); `icon` makes it square; `loading` swaps the
 * leading icon for a spinner, says so to a screen reader and disables it,
 * keeping the width so the bar does not jump.
 */
export function Button({
  variant = "default",
  icon = false,
  lg = false,
  size,
  loading = false,
  className,
  children,
  type = "button",
  href,
  clientNav = false,
  scroll,
  prefetch = false,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  icon?: boolean;
  /** Alias for `size="lg"`. */
  lg?: boolean;
  size?: ButtonSize;
  loading?: boolean;
  /** When set, renders as a link with the same styles. */
  href?: string;
  /**
   * Route this link through `next/link` instead of a plain anchor.
   *
   * Opt-in, because some of the kit's links must stay document navigations:
   * the CSV export is an API route that must download rather than transition,
   * and a register page is off-site entirely. Every navigation inside the
   * shell wants it — a full load re-runs the search and drops the bulk
   * selection, which is exactly what §3.3 says must not happen.
   */
  clientNav?: boolean;
  /** `next/link` only. `false` keeps the reader where they were — the record opens beside the results (§3.3's `{ scroll: false }`). */
  scroll?: boolean;
  /**
   * `next/link` only. It prefetches by default; a results page draws up to 100
   * of these and each record sheet costs six RPC round trips, so prefetching
   * them all would fire hundreds of profile reads nobody asked for.
   */
  prefetch?: boolean;
}) {
  const classes = buttonClass({ variant, size: size ?? (lg ? "lg" : "md"), icon, className });
  const disabled = rest.disabled || loading;
  const body = loading ? (
    <>
      <Icon name="spinner" className="animate-spin motion-reduce:animate-none" />
      {children}
    </>
  ) : (
    children
  );
  if (href && !disabled) {
    // `href` first: React emits attributes in prop order, and the kit's
    // long-name guard matches on the element that directly holds the text
    // (`class="…[overflow-wrap:anywhere]…">Name<`). Putting className first
    // silently moved `href` between them.
    const linkProps = {
      className: classes,
      "aria-label": rest["aria-label"],
      "aria-busy": rest["aria-busy"],
      "aria-describedby": rest["aria-describedby"],
      "aria-current": rest["aria-current"],
      title: rest.title,
      tabIndex: rest.tabIndex,
      onClick: rest.onClick as unknown as MouseEventHandler<HTMLAnchorElement> | undefined,
      // `data-*` hooks (the ledger's `r` and ↵ keys find `a[data-action]`).
      ...Object.fromEntries(Object.entries(rest).filter(([k]) => k.startsWith("data-"))),
    };
    // `next/link` only where the caller asked for it: a client navigation keeps
    // the page's React state, which is what the record links need and what a
    // CSV download must not have.
    return clientNav ? (
      <Link href={href} prefetch={prefetch} scroll={scroll} {...linkProps}>
        {body}
        {icon ? null : <LinkPending />}
      </Link>
    ) : (
      <a href={href} {...linkProps}>
        {body}
      </a>
    );
  }
  return (
    <button type={type} className={classes} {...rest} disabled={disabled} aria-busy={loading || rest["aria-busy"] || undefined}>
      {body}
    </button>
  );
}

/**
 * `.seg`: the segmented toggle — the card / table switch, the template
 * switch, the density stops. One component for every pair or trio of
 * mutually exclusive stops in the app, so they cannot drift apart. Cells
 * carry an icon, a label, or both; the active cell fills `brand-tint` with a
 * 2px inset `brand` rule along its bottom.
 */
export function Seg({
  options,
  value,
  className,
  hrefFor,
  onChange,
  label,
}: {
  options: readonly { value: string; label: string; icon?: IconName }[];
  value: string;
  className?: string;
  /** Links (a view switch is a URL); without it, buttons. */
  hrefFor?: (value: string) => string;
  onChange?: (value: string) => void;
  /** The group's accessible name. */
  label?: string;
}) {
  const itemClass = (o: { value: string; icon?: IconName }, i: number) =>
    cn(
      "inline-flex h-full items-center justify-center gap-1.5 text-sm font-medium text-ink-muted transition-colors duration-fast hover:text-ink-strong",
      o.icon ? "w-9" : "px-2.5",
      "focus-visible:outline-offset-[-2px]",
      i > 0 && "border-l border-line",
      o.value === value && "bg-brand-tint text-brand-ink shadow-[inset_0_-2px_0_rgb(var(--ds-brand))]",
    );
  return (
    <span role="group" aria-label={label} className={cn("inline-flex h-control overflow-hidden rounded-sm bg-surface shadow-edge", className)}>
      {options.map((o, i) =>
        hrefFor ? (
          <a
            key={o.value}
            href={hrefFor(o.value)}
            aria-label={o.icon ? o.label : undefined}
            // "true", not "page": this is a view switch, and both views are the
            // same page. `aria-current="page"` on the Cards button announced a
            // navigation that does not happen.
            aria-current={o.value === value ? "true" : undefined}
            className={itemClass(o, i)}
          >
            {o.icon ? <Icon name={o.icon} /> : o.label}
          </a>
        ) : (
          <button
            key={o.value}
            type="button"
            aria-label={o.icon ? o.label : undefined}
            aria-pressed={o.value === value}
            onClick={onChange ? () => onChange(o.value) : undefined}
            className={itemClass(o, i)}
          >
            {o.icon ? <Icon name={o.icon} /> : o.label}
          </button>
        ),
      )}
    </span>
  );
}

/**
 * `.cb`: a 16px checkbox drawn as a box; `on` fills it brand with a check,
 * `"mixed"` with a dash (the select-all box over a partly selected page).
 *
 * Presentational everywhere but the results work (REZ-B), which passes
 * `onToggle` to make it real. It used to carry `tabIndex={0}` unconditionally,
 * which put 34 of these in the tab order across the six screens, announced
 * each as an operable checkbox, and then did nothing: Space scrolled the page
 * instead of toggling. A control with no `onToggle` keeps the kit's shape for
 * inert controls — `aria-disabled` and a title that says why — rather than a
 * dead tab stop (WCAG 2.1.1, 4.1.2).
 *
 * With `onToggle` it is a real checkbox, keyed the way a native one is: Space
 * toggles once, on key UP (keydown only stops the page scrolling), so holding
 * Space does not flip it on every auto-repeat; Enter does nothing, because a
 * native checkbox ignores Enter and the ARIA checkbox pattern names Space only.
 */
/** What an inert checkbox says it is. Exported so a guard can pin the words rather than a copy of them. */
export const INERT_CHECKBOX_TITLE = "Selecting rows is not available on this list";

export function Checkbox({
  on = false,
  label,
  className,
  onToggle,
  id,
}: {
  on?: boolean | "mixed";
  label?: string;
  className?: string;
  onToggle?: () => void;
  id?: string;
}) {
  const interactive = Boolean(onToggle);
  return (
    <span
      id={id}
      role="checkbox"
      aria-checked={on}
      aria-disabled={interactive ? undefined : "true"}
      title={interactive ? undefined : INERT_CHECKBOX_TITLE}
      aria-label={label}
      tabIndex={interactive ? 0 : undefined}
      onClick={interactive ? onToggle : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === " ") e.preventDefault();
            }
          : undefined
      }
      onKeyUp={
        interactive
          ? (e) => {
              if (e.key === " ") {
                e.preventDefault();
                onToggle!();
              }
            }
          : undefined
      }
      className={cn(
        "inline-grid size-4 shrink-0 place-items-center rounded-xs border border-line-strong bg-surface transition-colors duration-fast",
        interactive && "cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--ds-brand))]",
        on && "border-brand bg-brand text-brand-on",
        className,
      )}
    >
      {on === "mixed" ? (
        // forced-colors: a background is repainted as Canvas in High Contrast,
        // which drew the dash white on white — "mixed" looked unticked.
        <span aria-hidden className="block h-0.5 w-2 rounded-full bg-current forced-colors:bg-[CanvasText]" />
      ) : on ? (
        <Icon name="check" small className="[&>*]:stroke-[2.25]" />
      ) : null}
    </span>
  );
}

/** `.tag.v2`: the mono stamp every AI-assisted surface carries. */
export function V2Tag({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "rounded-xs border border-smart-line bg-smart-tint px-[5px] py-px font-mono text-[10px] font-medium leading-[14px] tracking-[0.06em] text-smart",
        className,
      )}
    >
      V2
    </span>
  );
}

/**
 * `.meter`: a thin positive bar on the sunken ground.
 *
 * `label` is required. `role="meter"` needs an accessible name, and the
 * component used to take none and spread no rest props, so no caller could
 * give it one: two bars on the safety section announced as "100, meter".
 */
export function Meter({ pct, label, thick = false, className }: { pct: number; label: string; thick?: boolean; className?: string }) {
  // An absent percentage is not 0 %: without this guard `aria-valuenow` and the
  // bar width both rendered "NaN".
  const width = Number.isFinite(pct) ? Math.max(0, Math.min(100, pct)) : 0;
  return (
    <span
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={width}
      className={cn("block overflow-hidden rounded-full bg-surface-sunken", thick ? "h-1.5" : "h-1", className)}
    >
      <span className="block h-full bg-positive" style={{ width: `${width}%` }} />
    </span>
  );
}

/** `.live`: the signal dot beside "10,266 published suppliers". */
export function LiveDot({ className }: { className?: string }) {
  return <i aria-hidden className={cn("inline-block size-1.5 rounded-full bg-signal shadow-bloom", className)} />;
}

/** `kbd`: the ⌘K hint. */
export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded-xs border border-line px-[5px] font-mono text-[11px] leading-4 text-ink-subtle">
      {children}
    </kbd>
  );
}

/** A count in mono beside a label (`.cnt`). */
export function Count({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("font-mono text-[11px] text-ink-subtle", className)}>{children}</span>;
}

/**
 * A menu of links or actions behind a small control (sort, density, per
 * page). Native `<details>`: it needs no script to open. A document load
 * closes it; a menu of `clientNav` items must be keyed by its current value so
 * the navigation remounts it closed. The panel escapes its container, so it
 * must never sit inside `overflow-hidden`.
 */
export function Menu({
  summary,
  label,
  align = "right",
  up = false,
  size = "md",
  className,
  children,
}: {
  summary: ReactNode;
  /** The control's accessible name. */
  label: string;
  align?: "left" | "right";
  /** Open upward (a footer menu). */
  up?: boolean;
  size?: ButtonSize;
  className?: string;
  children: ReactNode;
}) {
  return (
    <details className={cn("group/menu relative", className)}>
      <summary
        aria-label={label}
        className={cn(buttonClass({ variant: "ghost", size }), "list-none [&::-webkit-details-marker]:hidden")}
      >
        {summary}
        <Icon name="caret" small className="text-ink-subtle transition-transform duration-fast group-open/menu:rotate-180" />
      </summary>
      <div
        role="menu"
        className={cn(
          "absolute z-20 min-w-[12rem] max-w-[calc(100vw-2rem)] rounded-md border border-line bg-surface py-1 shadow-md",
          // Right-anchored only from sm: on a phone the wrapped summary starts its
          // row, and a right-anchored menu would open off the left edge (1.4.10).
          align === "right" ? "left-0 sm:left-auto sm:right-0" : "left-0",
          up ? "bottom-full mb-1" : "top-full mt-1",
        )}
      >
        {children}
      </div>
    </details>
  );
}

/** One row of a `Menu`: a link (a sort is a URL) or a button, with the active one marked. */
export function MenuItem({
  href,
  active = false,
  clientNav = false,
  onClick,
  children,
}: {
  href?: string;
  active?: boolean;
  /** Navigate without a document load (keeps the page's selection); key the Menu by its value. */
  clientNav?: boolean;
  onClick?: () => void;
  children: ReactNode;
}) {
  const cls = cn(
    "flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-ink transition-colors duration-fast hover:bg-surface-sunken",
    active && "text-ink-strong",
  );
  const mark = <Icon name="check" small className={active ? "text-brand-ink" : "invisible"} />;
  return href && clientNav ? (
    <Link role="menuitem" href={href} prefetch={false} scroll={false} aria-current={active ? "true" : undefined} className={cls}>
      {mark}
      {children}
    </Link>
  ) : href ? (
    <a role="menuitem" href={href} aria-current={active ? "true" : undefined} className={cls}>
      {mark}
      {children}
    </a>
  ) : (
    <button type="button" role="menuitem" onClick={onClick} className={cls}>
      {mark}
      {children}
    </button>
  );
}
