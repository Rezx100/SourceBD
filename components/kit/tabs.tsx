"use client";

// Client: Radix's tab strip needs context. Tabs and the segmented control (`02 Components · 3`). Tabs are 40 tall with a 2px brand
// underline; counts read "Certificates · 4". Selected, hover, default, focus-visible,
// disabled. The selected tab never moves under "More": the page keeps it in `items`.

import { CaretDown } from "@phosphor-icons/react";
import Link from "next/link";
import { Tabs as T } from "radix-ui";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ringInset } from "./classes";
import { Menu, MenuItem } from "./overlay";

const TAB =
  "flex h-10 shrink-0 items-center whitespace-nowrap border-b-2 border-transparent px-3 text-base font-medium text-ink-2 outline-none transition-colors duration-fast hover:border-line-strong hover:text-ink aria-[selected=true]:border-brand aria-[selected=true]:text-ink aria-[current=page]:border-brand aria-[current=page]:text-ink data-[state=active]:border-brand data-[state=active]:text-ink disabled:pointer-events-none disabled:text-disabled aria-disabled:pointer-events-none aria-disabled:text-disabled focus-visible:rounded-sm focus-visible:outline-offset-[-4px] " +
  ringInset;

const label = (children: ReactNode, count?: number) => (count === undefined ? children : <>{children} · {count}</>);

/** A tab strip with its own state (arrow keys move, Home and End jump). Use `TabLink` when each tab is a page. */
export const Tabs = T.Root;
export const TabsContent = T.Content;

export function TabsList({ className, ...rest }: ComponentProps<typeof T.List>) {
  return <T.List className={cn("flex gap-1 border-b border-line", className)} {...rest} />;
}

export function Tab({ count, children, className, ...rest }: ComponentProps<typeof T.Trigger> & { count?: number }) {
  return (
    <T.Trigger className={cn(TAB, className)} {...rest}>
      {label(children, count)}
    </T.Trigger>
  );
}

/** A tab that is a link: the page is the panel, `aria-current` is the selected one. */
export function TabLink({
  current,
  count,
  children,
  className,
  ...rest
}: Omit<ComponentProps<typeof Link>, "children"> & { current?: boolean; count?: number; children: ReactNode }) {
  return (
    <Link aria-current={current ? "page" : undefined} className={cn(TAB, className)} {...rest}>
      {label(children, count)}
    </Link>
  );
}

/** The tabs that do not fit, behind "More". */
export function TabsMore({ items }: { items: { href: string; label: string; count?: number }[] }) {
  return (
    <Menu
      align="end"
      trigger={
        <button type="button" className={cn(TAB, "gap-1 rounded-t-sm bg-sunken pl-3 pr-2")}>
          More
          <CaretDown size={16} aria-hidden />
        </button>
      }
    >
      {items.map((i) => (
        <MenuItem key={i.href} href={i.href}>
          {label(i.label, i.count)}
        </MenuItem>
      ))}
    </Menu>
  );
}

/**
 * Segmented control, 32 tall, two to four options (more go in a select). Radio inputs
 * under it, so it posts with a form and the arrows move the choice. With `href` on the
 * options it is a row of links and `value` marks the current one.
 */
export function Segmented({
  name,
  label: groupLabel,
  value,
  defaultValue,
  options,
  disabled,
  className,
  onValueChange,
}: {
  name: string;
  /** What the choice is about: "View", "Row height". Read aloud, not drawn. */
  label: string;
  value?: string;
  defaultValue?: string;
  /** A page that owns the choice (a draft form): `value` is then the one that is on, and a click reports here. */
  onValueChange?: (value: string) => void;
  options: { value: string; label: ReactNode; href?: string }[];
  disabled?: boolean;
  className?: string;
}) {
  const BOX = "flex h-7 items-center rounded-[3px] px-3 text-base font-medium transition-colors duration-fast";
  const IDLE = "text-ink-2 hover:bg-line hover:text-ink";
  const ON = "border border-line-strong bg-surface text-ink";
  return (
    <div
      role={options.some((o) => o.href) ? "group" : "radiogroup"}
      aria-label={groupLabel}
      aria-disabled={disabled || undefined}
      className={cn(
        "inline-flex w-fit gap-0.5 rounded-sm bg-sunken p-0.5 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand",
        disabled && "pointer-events-none",
        className,
      )}
    >
      {options.map((o) =>
        o.href ? (
          <Link key={o.value} href={o.href} aria-current={o.value === value ? "page" : undefined} className={cn(BOX, o.value === value ? ON : IDLE, disabled && "text-disabled", "outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand")}>
            {o.label}
          </Link>
        ) : (
          <label key={o.value} className="relative">
            <input
              type="radio"
              name={name}
              value={o.value}
              disabled={disabled}
              {...(onValueChange
                ? { checked: o.value === value, onChange: () => onValueChange(o.value) }
                : { defaultChecked: o.value === (defaultValue ?? value) })}
              className="peer absolute inset-0 m-0 cursor-pointer appearance-none rounded-[3px] outline-none disabled:cursor-not-allowed"
            />
            <span className={cn(BOX, IDLE, "peer-checked:border peer-checked:border-line-strong peer-checked:bg-surface peer-checked:text-ink peer-disabled:text-disabled peer-disabled:hover:bg-transparent")}>
              {o.label}
            </span>
          </label>
        ),
      )}
    </div>
  );
}
