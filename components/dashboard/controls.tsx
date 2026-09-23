// Controls of the dashboard kit (REZ-A): buttons, the segmented toggle, the
// checkbox, the V2 tag, meters and the live dot. Tailwind classes only; every
// colour is a token role (`lib/design/tokens.ts`).

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Icon, type IconName } from "./icons";

export type ButtonVariant = "default" | "primary" | "ghost";

/**
 * `.btn`: 32px, 13px medium, `line-strong` outline on `surface`. `primary` is
 * the one brand-filled control on a screen; `ghost` has no outline; `icon`
 * makes it square; `lg` is the 40px action-bar size.
 */
export function Button({
  variant = "default",
  icon = false,
  lg = false,
  className,
  children,
  type = "button",
  href,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  icon?: boolean;
  lg?: boolean;
  /** When set, renders as a link with the same styles. */
  href?: string;
}) {
  const classes = cn(
    "inline-flex items-center gap-1.5 whitespace-nowrap rounded-sm border text-sm font-medium transition-colors duration-fast",
    lg ? "h-control-lg px-4" : "h-control px-3",
    icon && (lg ? "w-control-lg px-0" : "w-control px-0"),
    icon && "justify-center",
    variant === "default" && "border-line-strong bg-surface text-ink hover:bg-surface-sunken",
    variant === "primary" &&
      "border-brand bg-brand text-brand-on hover:border-brand-hover hover:bg-brand-hover active:bg-brand-active disabled:cursor-not-allowed disabled:border-line disabled:bg-surface-sunken disabled:text-ink-disabled",
    variant === "ghost" && "border-transparent bg-transparent text-ink-muted hover:bg-surface-sunken",
    className,
  );
  if (href && !rest.disabled) {
    return (
      <a href={href} className={classes} aria-label={rest["aria-label"]}>
        {children}
      </a>
    );
  }
  return (
    <button type={type} className={classes} {...rest}>
      {children}
    </button>
  );
}

/** `.seg`: the card / table toggle. */
export function Seg({
  options,
  value,
  className,
  hrefFor,
}: {
  options: readonly { value: string; label: string; icon: IconName }[];
  value: string;
  className?: string;
  hrefFor?: (value: string) => string;
}) {
  const itemClass = (o: { value: string }, i: number) =>
    cn(
      "grid w-9 place-items-center text-ink-muted",
      "focus-visible:outline-offset-[-2px]",
      i > 0 && "border-l border-line-strong",
      o.value === value && "bg-brand-tint text-brand-ink shadow-[inset_0_-2px_0_rgb(var(--ds-brand))]",
    );
  return (
    <span
      role="group"
      className={cn("inline-flex h-control overflow-hidden rounded-sm border border-line-strong", className)}
    >
      {options.map((o, i) =>
        hrefFor ? (
          <a
            key={o.value}
            href={hrefFor(o.value)}
            aria-label={o.label}
            // "true", not "page": this is a view switch, and both views are the
            // same page. `aria-current="page"` on the Cards button announced a
            // navigation that does not happen.
            aria-current={o.value === value ? "true" : undefined}
            className={itemClass(o, i)}
          >
            <Icon name={o.icon} />
          </a>
        ) : (
          <button
            key={o.value}
            type="button"
            aria-label={o.label}
            aria-pressed={o.value === value}
            className={itemClass(o, i)}
          >
            <Icon name={o.icon} />
          </button>
        ),
      )}
    </span>
  );
}

/**
 * `.cb`: a 16px checkbox drawn as a box; `on` fills it brand with a check.
 *
 * Presentational everywhere but the results work (REZ-B), which passes
 * `onToggle` to make it real. It used to carry `tabIndex={0}` unconditionally,
 * which put 34 of these in the tab order across the six screens, announced
 * each as an operable checkbox, and then did nothing: Space scrolled the page
 * instead of toggling. On the RFQ composer the five required questions are
 * still these. A control with no `onToggle` keeps the kit's shape for inert
 * controls — `aria-disabled` and a title that says why — rather than a dead
 * tab stop (WCAG 2.1.1, 4.1.2). One with `onToggle` is a real checkbox: no
 * `aria-disabled`, in the tab order, and Space/Enter toggle it exactly like a
 * native input would.
 */
export function Checkbox({
  on = false,
  label,
  className,
  onToggle,
}: {
  on?: boolean;
  label?: string;
  className?: string;
  onToggle?: () => void;
}) {
  const interactive = Boolean(onToggle);
  return (
    <span
      role="checkbox"
      aria-checked={on}
      aria-disabled={interactive ? undefined : "true"}
      title={interactive ? undefined : "Selection arrives with the results work"}
      aria-label={label}
      tabIndex={interactive ? 0 : undefined}
      onClick={interactive ? onToggle : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === " " || e.key === "Enter") {
                e.preventDefault();
                onToggle!();
              }
            }
          : undefined
      }
      className={cn(
        "inline-grid size-4 shrink-0 place-items-center rounded-xs border border-line-strong bg-surface",
        interactive && "cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--ds-brand))]",
        on && "border-brand bg-brand text-brand-on",
        className,
      )}
    >
      {on ? <Icon name="check" small className="[&>*]:stroke-[2.25]" /> : null}
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
