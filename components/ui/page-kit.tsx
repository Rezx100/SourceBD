// SourceBD app-surface page kit.
//
// A small set of data-dense layout primitives that give every authenticated
// page (buyer / supplier / admin) the same calm, light SourceBD SaaS language
// as the marketing surfaces — without bulky nested cards that eat vertical
// space. Surfaces are white on a neutral canvas with hairline borders.
//
// These are server-safe (no hooks). They compose the client BlurFade /
// NumberTicker primitives, which is allowed inside RSC.

import * as React from "react";

import { BlurFade } from "@/components/ui/blur-fade";
import { NumberTicker } from "@/components/ui/number-ticker";
import { cn } from "@/lib/utils";

/* ───────────────────────── Kicker ───────────────────────── */

export function Kicker({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "mb-2 inline-flex items-center gap-2 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-brand-forest",
        className,
      )}
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-brand-forest" />
      {children}
    </p>
  );
}

/* ─────────────────────── Page header ─────────────────────── */

export function PageHeader({
  kicker,
  title,
  description,
  actions,
  icon,
  className,
  animate = true,
}: {
  kicker?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
  animate?: boolean;
}) {
  const body = (
    <div
      className={cn(
        "flex flex-col gap-4 border-b border-hairline pb-6 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        {kicker ? <Kicker>{kicker}</Kicker> : null}
        <div className="flex items-center gap-3">
          {icon ? (
            <span
              aria-hidden
              className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-brand-forest-soft text-brand-forest"
            >
              {icon}
            </span>
          ) : null}
          <h1 className="min-w-0 font-display text-[26px] font-extrabold leading-[1.05] tracking-[-0.03em] text-ink-primary sm:text-[32px]">
            {title}
          </h1>
        </div>
        {description ? (
          <p className="mt-2.5 max-w-2xl text-[15px] leading-relaxed text-ink-secondary">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );

  if (!animate) return body;
  return <BlurFade delay={0.05}>{body}</BlurFade>;
}

/* ───────────────────────── Section ───────────────────────── */

export function Section({
  title,
  description,
  actions,
  children,
  className,
  contentClassName,
  id,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cn("flex flex-col gap-3", className)}>
      {title || actions ? (
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            {title ? (
              <h2 className="font-display text-base font-semibold tracking-[-0.01em] text-ink-primary">
                {title}
              </h2>
            ) : null}
            {description ? (
              <p className="mt-0.5 text-[13px] text-ink-secondary">{description}</p>
            ) : null}
          </div>
          {actions ? (
            <div className="flex shrink-0 items-center gap-2">{actions}</div>
          ) : null}
        </div>
      ) : null}
      <div className={contentClassName}>{children}</div>
    </section>
  );
}

/* ───────────────────────── Panel ───────────────────────── */

/** A clean bordered white surface. Use sparingly — prefer hairline-separated
 *  rows over nesting many panels (keeps the surface data-dense). */
export function Panel({
  children,
  className,
  as: Tag = "div",
  padded = true,
}: {
  children: React.ReactNode;
  className?: string;
  as?: React.ElementType;
  padded?: boolean;
}) {
  return (
    <Tag
      className={cn(
        "rounded-lg border border-neutral-200 bg-white shadow-sm",
        padded && "p-5 sm:p-6",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

/* ───────────────────────── Toolbar ───────────────────────── */

/** A horizontal control row (search, filters, sort, view toggles). Wraps on
 *  small viewports. Not a card — sits flush on the canvas. */
export function Toolbar({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2.5 shadow-sm",
        className,
      )}
    >
      {children}
    </div>
  );
}

/* ─────────────────────── Stat strip ─────────────────────── */

export type StatItem = {
  label: string;
  value: number | string | null;
  /** Suffix appended after a numeric value, e.g. "%" or " yrs". */
  suffix?: string;
  /** Render the numeric value with an animated NumberTicker. */
  animateValue?: boolean;
  icon?: React.ReactNode;
  hint?: string;
  href?: string;
};

/** Homepage-style divided stat band. Forest icon chip + big tabular number.
 *  2-up on mobile, N-up + hairline dividers on desktop. */
export function StatStrip({
  items,
  className,
  columns = 4,
}: {
  items: StatItem[];
  className?: string;
  columns?: 2 | 3 | 4;
}) {
  const colClass =
    columns === 2
      ? "lg:grid-cols-2"
      : columns === 3
        ? "lg:grid-cols-3"
        : "lg:grid-cols-4";
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-x-4 gap-y-7 rounded-lg border border-neutral-200 bg-white p-5 shadow-sm sm:p-6",
        colClass,
        "lg:gap-0 lg:divide-x lg:divide-hairline",
        className,
      )}
    >
      {items.map((s, i) => (
        <BlurFade key={s.label} delay={0.06 + i * 0.05}>
          <div className="flex flex-col lg:px-7 lg:first:pl-0">
            {s.icon ? (
              <span className="mb-3 inline-flex size-10 items-center justify-center rounded-xl bg-brand-forest-soft text-brand-forest">
                {s.icon}
              </span>
            ) : null}
            <span className="flex items-baseline gap-0.5 font-display text-[28px] font-extrabold tabular-nums leading-none tracking-[-0.02em] text-ink-primary sm:text-[34px]">
              {typeof s.value === "number" ? (
                s.animateValue ? (
                  <NumberTicker value={s.value} className="text-ink-primary" />
                ) : (
                  s.value.toLocaleString("en-US")
                )
              ) : (
                (s.value ?? "—")
              )}
              {s.suffix ? (
                <span className="text-lg font-bold text-ink-tertiary">
                  {s.suffix}
                </span>
              ) : null}
            </span>
            <span className="mt-2 text-[13px] font-medium text-ink-secondary">
              {s.label}
            </span>
            {s.hint ? (
              <span className="mt-0.5 text-xs text-ink-tertiary">{s.hint}</span>
            ) : null}
          </div>
        </BlurFade>
      ))}
    </div>
  );
}

/* ─────────────────────── Empty state ─────────────────────── */

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-neutral-300 bg-white px-6 py-14 text-center shadow-sm",
        className,
      )}
    >
      {icon ? (
        <span className="flex size-12 items-center justify-center rounded-2xl bg-brand-forest-soft text-brand-forest">
          {icon}
        </span>
      ) : null}
      <h3 className="font-display text-lg font-semibold tracking-[-0.01em] text-ink-primary">
        {title}
      </h3>
      {description ? (
        <p className="max-w-sm text-sm leading-relaxed text-ink-secondary">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}

/* ─────────────────────── Inline pills ─────────────────────── */

export type PillTone =
  | "neutral"
  | "forest"
  | "green"
  | "amber"
  | "red"
  | "indigo";

const PILL_TONES: Record<PillTone, string> = {
  neutral: "border-hairline-strong bg-surface-l1 text-ink-secondary",
  forest: "border-brand-forest/20 bg-brand-forest-soft text-brand-forest",
  green: "border-sem-green/30 bg-sem-green-soft text-sem-green",
  amber: "border-sem-amber/30 bg-sem-amber-soft text-sem-amber",
  red: "border-sem-red/30 bg-sem-red-soft text-sem-red",
  indigo: "border-accent-indigo/20 bg-accent-indigo/[0.06] text-accent-indigo",
};

export function Pill({
  children,
  tone = "neutral",
  className,
  dashed = false,
}: {
  children: React.ReactNode;
  tone?: PillTone;
  className?: string;
  dashed?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-1 text-xs font-medium",
        PILL_TONES[tone],
        dashed && "border-dashed",
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ─────────────────────── Data row list ─────────────────────── */

/** A hairline-separated list — the data-dense alternative to a stack of cards.
 *  Wrap rows in <DataList> and render each as a flush row. */
export function DataList({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <ul
      role="list"
      className={cn(
        "divide-y divide-neutral-200 overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm",
        className,
      )}
    >
      {children}
    </ul>
  );
}

export function DataRow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <li
      className={cn(
        "flex items-center gap-3 px-4 py-3 transition-colors duration-hover ease-smooth hover:bg-brand-forest-tint",
        className,
      )}
    >
      {children}
    </li>
  );
}
