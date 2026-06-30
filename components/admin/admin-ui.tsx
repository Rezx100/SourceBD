import Link from "next/link";
import * as React from "react";

import { EmptyState, PageHeader, Panel, type PillTone } from "@/components/ui/page-kit";
import { cn } from "@/lib/utils";

type MaxWidth = "4xl" | "5xl" | "6xl" | "7xl";

const MAX_WIDTH_CLASS: Record<MaxWidth, string> = {
  "4xl": "max-w-4xl",
  "5xl": "max-w-5xl",
  "6xl": "max-w-6xl",
  "7xl": "max-w-7xl",
};

export const ADMIN_INPUT_CLASS =
  "min-h-[44px] rounded-lg border border-neutral-200 bg-white px-3 text-sm text-ink-primary outline-none transition-colors placeholder:text-ink-tertiary focus:border-brand-forest/50 focus:ring-3 focus:ring-brand-forest/10";

export const ADMIN_SELECT_CLASS = cn(ADMIN_INPUT_CLASS, "pr-8");

export function AdminPage({
  children,
  maxWidth = "6xl",
  className,
}: {
  children: React.ReactNode;
  maxWidth?: MaxWidth;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto w-full space-y-6", MAX_WIDTH_CLASS[maxWidth], className)}>
      {children}
    </div>
  );
}

export function AdminPageHeader({
  kicker = "Admin",
  title,
  description,
  actions,
  icon,
}: {
  kicker?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <PageHeader
      kicker={kicker}
      title={title}
      description={description}
      actions={actions}
      icon={icon}
      animate={false}
    />
  );
}

export function AdminPanel({
  title,
  description,
  meta,
  actions,
  children,
  className,
  contentClassName,
  padded = true,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  padded?: boolean;
}) {
  return (
    <Panel className={cn("overflow-hidden", className)} padded={false}>
      {title || description || meta || actions ? (
        <div className="flex flex-col gap-3 border-b border-neutral-200 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5">
          <div className="min-w-0">
            {title ? (
              <h2 className="font-display text-base font-semibold tracking-[-0.01em] text-ink-primary">
                {title}
              </h2>
            ) : null}
            {description ? (
              <p className="mt-1 text-[13px] leading-relaxed text-ink-secondary">
                {description}
              </p>
            ) : null}
            {meta ? (
              <p className="mt-1 font-mono text-[11px] text-ink-tertiary">{meta}</p>
            ) : null}
          </div>
          {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
        </div>
      ) : null}
      <div className={cn(padded && "p-4 sm:p-5", contentClassName)}>{children}</div>
    </Panel>
  );
}

export function AdminFilterPanel({
  title = "Filter",
  description,
  children,
  actions,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <AdminPanel
      title={title}
      description={description}
      actions={actions}
      contentClassName="space-y-4"
    >
      {children}
    </AdminPanel>
  );
}

export function AdminField({
  label,
  hint,
  children,
  className,
}: {
  label: React.ReactNode;
  hint?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("flex min-w-0 flex-col gap-1.5 text-[12px] font-medium text-ink-secondary", className)}>
      <span>{label}</span>
      {children}
      {hint ? <span className="text-[11px] font-normal leading-relaxed text-ink-tertiary">{hint}</span> : null}
    </label>
  );
}

export function AdminActionLink({
  href,
  children,
  variant = "secondary",
  className,
  target,
}: {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  className?: string;
  target?: string;
}) {
  const classes: Record<"primary" | "secondary" | "danger" | "ghost", string> = {
    primary: "border-brand-forest bg-brand-forest text-white hover:bg-brand-forest-mid",
    secondary: "border-neutral-200 bg-white text-ink-secondary hover:border-brand-forest/30 hover:bg-brand-forest-tint hover:text-ink-primary",
    danger: "border-sem-red/25 bg-sem-red-soft text-sem-red hover:border-sem-red/40",
    ghost: "border-transparent text-ink-secondary hover:bg-neutral-100 hover:text-ink-primary",
  };
  return (
    <Link
      href={href}
      target={target}
      className={cn(
        "inline-flex min-h-[40px] items-center justify-center rounded-pill border px-3 text-sm font-semibold transition-colors",
        classes[variant],
        className,
      )}
    >
      {children}
    </Link>
  );
}

export type AdminTabItem = {
  href: string;
  label: React.ReactNode;
  active?: boolean;
  count?: number | string | null;
  tone?: PillTone;
};

export function AdminTabs({
  items,
  label = "Admin tabs",
  className,
}: {
  items: AdminTabItem[];
  label?: string;
  className?: string;
}) {
  return (
    <nav
      aria-label={label}
      className={cn(
        "flex gap-2 overflow-x-auto rounded-lg border border-neutral-200 bg-white p-2 shadow-sm",
        className,
      )}
    >
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={item.active ? "page" : undefined}
          className={cn(
            "inline-flex min-h-[40px] shrink-0 items-center gap-2 rounded-pill border px-3 text-sm font-semibold transition-colors",
            item.active
              ? "border-brand-forest/25 bg-brand-forest-soft text-brand-forest"
              : "border-transparent text-ink-secondary hover:bg-brand-forest-tint hover:text-ink-primary",
          )}
        >
          <span>{item.label}</span>
          {item.count != null ? (
            <span className="rounded-full bg-white/80 px-2 py-0.5 font-mono text-[11px] tabular-nums text-inherit">
              {typeof item.count === "number" ? item.count.toLocaleString("en-US") : item.count}
            </span>
          ) : null}
        </Link>
      ))}
    </nav>
  );
}

export function AdminPagination({
  page,
  totalPages,
  pageHref,
  className,
}: {
  page: number;
  totalPages: number;
  pageHref: (page: number) => string;
  className?: string;
}) {
  if (totalPages <= 1) return null;
  return (
    <nav
      aria-label="Pagination"
      className={cn(
        "flex items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-[12px] text-ink-tertiary shadow-sm",
        className,
      )}
    >
      {page > 1 ? (
        <AdminActionLink href={pageHref(page - 1)} variant="secondary" className="min-h-[36px] px-3 text-xs">
          Previous
        </AdminActionLink>
      ) : (
        <span />
      )}
      <span className="font-mono tabular-nums">
        Page {page} / {totalPages}
      </span>
      {page < totalPages ? (
        <AdminActionLink href={pageHref(page + 1)} variant="secondary" className="min-h-[36px] px-3 text-xs">
          Next
        </AdminActionLink>
      ) : (
        <span />
      )}
    </nav>
  );
}

export function AdminEmptyState({
  title,
  description,
  action,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return <EmptyState title={title} description={description} action={action} />;
}

export function AdminKeyValueList({
  rows,
  className,
}: {
  rows: Array<{ label: React.ReactNode; value: React.ReactNode; mono?: boolean }>;
  className?: string;
}) {
  return (
    <dl className={cn("grid gap-x-4 gap-y-3 text-[13px] sm:grid-cols-2", className)}>
      {rows.map((row, index) => (
        <div key={index} className="min-w-0">
          <dt className="font-mono text-[11px] uppercase tracking-[0.05em] text-ink-tertiary">
            {row.label}
          </dt>
          <dd
            className={cn(
              "mt-1 min-w-0 break-words text-ink-primary",
              row.mono && "font-mono text-[12px]",
            )}
          >
            {row.value ?? "—"}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function AdminRowList({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <ul className={cn("m-0 divide-y divide-neutral-200 p-0", className)}>{children}</ul>;
}

export function AdminRow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <li className={cn("flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5", className)}>{children}</li>;
}

export function humanizeAdminToken(value: string | null | undefined): string {
  if (!value) return "Any";
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (ch) => ch.toUpperCase())
    .replace(/\bRsc\b/g, "RSC")
    .replace(/\bOeko Tex\b/g, "OEKO-TEX")
    .replace(/\bGots\b/g, "GOTS")
    .replace(/\bSmeta\b/g, "SMETA")
    .replace(/\bUflpa\b/g, "UFLPA")
    .replace(/\bOfac\b/g, "OFAC");
}

export function formatAdminDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toISOString().slice(0, 10);
}

export function formatAdminDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toISOString().replace("T", " ").slice(0, 19);
}
