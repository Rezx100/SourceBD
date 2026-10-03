"use client";

// Buttons (`02 Components · 1`). `loading` is a state of its own: the spinner and a
// present-tense word ("Sending") replace the label, the button stays the same size and
// is announced busy. It is not `disabled`, so keyboard focus is not lost mid-send; clicks
// are dropped instead.

import { SpinnerGap, type Icon } from "@phosphor-icons/react";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { buttonClass, ICON_PX, type ButtonKind, type ButtonSize } from "./button-class";

type Shared = {
  kind?: ButtonKind;
  size?: Exclude<ButtonSize, `icon-${string}`>;
  /** A glyph left of the label (16 at 32 tall, 20 at 40 and 48). */
  icon?: Icon;
  /** A glyph right of the label, tighter (the caret on a filter or sort button). */
  iconRight?: Icon;
  full?: boolean;
};

function Spinner({ px, className }: { px: number; className?: string }) {
  return <SpinnerGap size={px} className={cn("shrink-0 animate-spin motion-reduce:animate-none", className)} aria-hidden />;
}

export function Button({
  kind = "secondary",
  size = "md",
  icon: Lead,
  iconRight: Trail,
  full,
  loading = false,
  loadingLabel,
  type = "button",
  className,
  children,
  onClick,
  ...rest
}: Shared &
  Omit<ComponentProps<"button">, "children"> & {
    loading?: boolean;
    /** What the label says while loading: "Sending", "Saving". */
    loadingLabel?: string;
    children: ReactNode;
  }) {
  const px = ICON_PX[size];
  const pad = Lead ? (size === "md" ? "pl-2.5 pr-3" : size === "lg" ? "pl-3.5 pr-4" : "") : Trail ? "pl-3 pr-2 gap-1" : "";
  return (
    <button
      type={type}
      aria-busy={loading || undefined}
      onClick={(e) => {
        if (loading) return e.preventDefault();
        onClick?.(e);
      }}
      className={buttonClass({ kind, size, full, className: cn(pad, className) })}
      {...rest}
    >
      {loading ? <Spinner px={px} className={kind === "secondary" || kind === "quiet" ? "text-ink-2" : undefined} /> : Lead ? <Lead size={px} className="shrink-0" aria-hidden /> : null}
      {loading && loadingLabel ? loadingLabel : children}
      {Trail && !loading ? <Trail size={px} className="shrink-0" aria-hidden /> : null}
    </button>
  );
}

/** An icon-only button. `label` is its name for a screen reader and its tooltip ("More actions", "Columns"). */
export function IconButton({
  icon: Glyph,
  label,
  kind = "secondary",
  size = 32,
  type = "button",
  className,
  ...rest
}: { icon: Icon; label: string; kind?: Exclude<ButtonKind, "link">; size?: 24 | 32 | 44 | 48 } & Omit<ComponentProps<"button">, "children" | "aria-label">) {
  const s = `icon-${size}` as const;
  return (
    <button type={type} aria-label={label} title={label} className={buttonClass({ kind, size: s, className })} {...rest}>
      <Glyph size={ICON_PX[s]} className="shrink-0" aria-hidden />
    </button>
  );
}

/** A link that looks like a button, so the page uses a real `<a>` where Paper has a box. */
export function ButtonLink({
  kind = "secondary",
  size = "md",
  icon: Lead,
  full,
  className,
  children,
  ...rest
}: Shared & Omit<ComponentProps<typeof Link>, "children"> & { children: ReactNode }) {
  const px = ICON_PX[size];
  const pad = Lead ? (size === "md" ? "pl-2.5 pr-3" : size === "lg" ? "pl-3.5 pr-4" : "") : "";
  return (
    <Link className={buttonClass({ kind, size, full, className: cn(pad, className) })} {...rest}>
      {Lead ? <Lead size={px} className="shrink-0" aria-hidden /> : null}
      {children}
    </Link>
  );
}
