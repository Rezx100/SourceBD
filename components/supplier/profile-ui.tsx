import type { ReactNode } from "react";

import { NumberTicker } from "@/components/ui/number-ticker";
import { sourceFullName } from "@/lib/source-full-names";
import { sourceLogo } from "@/lib/source-logos";
import { cn } from "@/lib/utils";

/** Vertical stack for tab panel content — 16px rhythm on phones, 26px sm+. */
export function ProfileTabStack({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("flex flex-col gap-4 sm:gap-6", className)}>{children}</div>;
}

export function ProfileCard({
  children,
  className,
  id,
  hoverable,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
  hoverable?: boolean;
}) {
  return (
    <section
      id={id}
      className={cn(
        "rounded-[14px] border border-neutral-200 bg-white p-3 text-left sm:p-6",
        "shadow-[0_1px_2px_rgba(15,15,20,0.03),0_5px_14px_-8px_rgba(15,15,20,0.05)]",
        hoverable &&
          "transition-colors duration-200 ease-smooth hover:border-brand-forest/[0.18] hover:bg-[#fafaf9]",
        className,
      )}
    >
      {/* 1px nudge so content sits just off the left hairline, without
          disturbing the card's own symmetric 12px padding. */}
      <div className="pl-px sm:pl-0">{children}</div>
    </section>
  );
}

export function ProfileCardHeader({
  title,
  meta,
}: {
  title: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <header className="mb-4 flex flex-col gap-1 sm:mb-5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
      <h2 className="font-display text-[17px] font-bold leading-tight tracking-[-0.015em] text-neutral-900">
        {title}
      </h2>
      {meta != null && meta !== "" ? (
        <span className="text-[13px] font-medium leading-snug text-neutral-500 sm:text-right">
          {meta}
        </span>
      ) : null}
    </header>
  );
}

export function ProfileEmptyState({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-neutral-200 bg-neutral-50 px-4 py-5 text-center text-[14px] leading-6 text-neutral-600">
      {children}
    </p>
  );
}

export function ProfileFootnote({ children }: { children: ReactNode }) {
  return <p className="mt-4 text-[13px] leading-5 text-neutral-600">{children}</p>;
}

export type ProfileKpiItem = {
  key: string;
  label: string;
  value: string;
  numValue?: number;
  sub?: string;
};

export function ProfileKpiGrid({ items }: { items: ProfileKpiItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className="grid grid-cols-1 gap-3 xs:grid-cols-2 lg:grid-cols-3">
      {items.map(({ key, ...item }) => (
        <ProfileKpiTile key={key} {...item} />
      ))}
    </div>
  );
}

export function ProfileKpiTile({
  label,
  value,
  numValue,
  sub,
}: ProfileKpiItem) {
  return (
    <div className="min-w-0 border-l-2 border-brand-forest/15 py-0.5 pl-3 sm:pl-4">
      <p className="text-[12.5px] font-semibold text-neutral-500">{label}</p>
      <div className="mt-1.5 font-display text-[23px] font-bold leading-none tracking-[-0.02em] text-neutral-950 sm:text-[26px]">
        {numValue != null ? (
          <NumberTicker value={numValue} className="text-neutral-950" />
        ) : (
          value
        )}
      </div>
      {sub ? <p className="mt-2 text-[13px] leading-5 text-neutral-500">{sub}</p> : null}
    </div>
  );
}

/** Overview fact row — four equal columns below the narrative paragraph. */
export function ProfileOverviewFactRow({
  facts,
}: {
  facts: { label: ReactNode; value: ReactNode }[];
}) {
  if (facts.length === 0) return null;
  return (
    <dl className="grid grid-cols-2 gap-x-7 gap-y-4 sm:grid-cols-4">
      {facts.map((f, i) => (
        <div key={i} className="min-w-0">
          <dt className="text-[12.5px] font-semibold text-neutral-500">{f.label}</dt>
          <dd className="mt-1 text-[14.5px] font-semibold leading-5 text-neutral-900">
            {f.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Overview sidebar fact grid — readable labels, not micro-uppercase. */
export function ProfileFactGrid({
  facts,
}: {
  facts: { label: string; value: ReactNode }[];
}) {
  if (facts.length === 0) return null;
  return (
    <dl className="grid grid-cols-1 gap-x-7 gap-y-4 sm:grid-cols-2">
      {facts.map((f) => (
        <div key={f.label} className="min-w-0">
          <dt className="text-[12.5px] font-semibold text-neutral-500">{f.label}</dt>
          <dd className="mt-1 text-[14.5px] font-semibold leading-5 text-neutral-900">
            {f.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function ProfileStatusBadge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "valid" | "expiring" | "expired" | "evergreen" | "inherited" | "neutral" | "danger";
  className?: string;
}) {
  const toneClass =
    tone === "valid"
      ? "border-sem-green/20 bg-sem-green-soft text-sem-green"
      : tone === "expiring"
        ? "border-sem-amber/20 bg-sem-amber-soft text-sem-amber"
        : tone === "expired" || tone === "danger"
          ? "border-sem-red/20 bg-sem-red-soft text-sem-red"
          : tone === "inherited"
            ? "border-neutral-300 bg-white text-neutral-600 border-dashed"
            : "border-neutral-200 bg-neutral-100 text-neutral-600";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[12px] font-semibold leading-none",
        toneClass,
        className,
      )}
    >
      {children}
    </span>
  );
}

function sourceLabel(tag: string): string {
  if (tag === "OEKO_TEX") return "OEKO-TEX";
  if (tag === "BRAND_HM") return "H&M";
  if (tag === "BRAND_MS") return "M&S";
  if (tag.startsWith("BRAND_")) {
    const raw = tag.slice(6).replace(/_/g, " ").trim();
    return raw ? raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase() : tag;
  }
  return tag.replace(/_/g, "-");
}

function shortCode(tag: string): string {
  const letters = sourceLabel(tag).replace(/[^A-Za-z0-9]/g, "");
  return letters.length > 4 ? letters.slice(0, 3).toUpperCase() : letters.toUpperCase();
}

const SOURCE_MARK_SIZE_CLASSES: Record<"sm" | "md" | "lg", string> = {
  // Header "Corroborated by" row — quiet, secondary-weight marks, 22px.
  sm: "size-5 rounded-[6px] text-[8px]",
  // Default — Overview locations, Provenance, Documents.
  md: "size-8 rounded-[8px] text-[12px]",
  // Compliance-tab list rows (Registries/Certifications/Sanctions) — these
  // read as list-item logos next to a single line of text, not tiny
  // wayfinding dots, so they size up from the default mark. Phones step
  // down to 36px so the text column keeps the width.
  lg: "size-9 rounded-[9px] text-[11px] sm:size-[42px] sm:rounded-[10px] sm:text-[12px]",
};

export function ProfileSourceMark({
  tag,
  label,
  size = "md",
  className,
}: {
  tag: string;
  label?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const resolvedLabel = label ?? sourceFullName(tag) ?? sourceLabel(tag);
  const logo = sourceLogo(tag);
  return (
    <span
      role="img"
      aria-label={resolvedLabel}
      title={resolvedLabel}
      className={cn(
        "flex shrink-0 items-center justify-center border border-[rgba(15,15,20,0.065)] bg-[#fafaf9] font-mono font-bold text-[#4a4a55]",
        SOURCE_MARK_SIZE_CLASSES[size],
        className,
      )}
    >
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt="" className="h-full w-full rounded-[6px] object-contain p-1" />
      ) : (
        shortCode(tag)
      )}
    </span>
  );
}

export function ProfileEvidenceRow({
  mark,
  title,
  meta,
  status,
  action,
  markSize = "md",
  /** "trailing" (default): status + action share a right-aligned column at
   *  sm+ but drop to their own row below the title on phones. "top": status
   *  sits inline with the title — right-aligned — on every breakpoint, and
   *  any action renders on its own row below the meta line instead. */
  pillAlign = "trailing",
  className,
}: {
  mark: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  status?: ReactNode;
  action?: ReactNode;
  /** Widens the mark column for `size="lg"` marks (Compliance-tab list rows). */
  markSize?: "md" | "lg";
  pillAlign?: "trailing" | "top";
  className?: string;
}) {
  if (pillAlign === "top") {
    return (
      <div
        className={cn(
          "grid grid-cols-[2rem_minmax(0,1fr)] items-start gap-x-3 border-t border-neutral-100 py-3",
          markSize === "lg" && "grid-cols-[2.5rem_minmax(0,1fr)] items-center sm:grid-cols-[3rem_minmax(0,1fr)] sm:py-3.5",
          className,
        )}
      >
        <div className={markSize === "lg" ? "flex items-center" : "pt-0.5"}>{mark}</div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1.5">
            <div className="min-w-0 text-[14px] font-semibold leading-5 text-neutral-900">
              {title}
            </div>
            {status ? <div className="shrink-0">{status}</div> : null}
          </div>
          {meta ? (
            <div className="mt-0.5 text-[13px] leading-5 text-neutral-600">{meta}</div>
          ) : null}
          {action ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">{action}</div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "grid gap-x-3 gap-y-2 border-t border-neutral-100 sm:gap-3 sm:items-center",
        markSize === "lg"
          ? "grid-cols-[2.5rem_minmax(0,1fr)] items-center py-3 sm:grid-cols-[3rem_minmax(0,1fr)_auto] sm:py-3.5"
          : "grid-cols-[2rem_minmax(0,1fr)] py-3 sm:grid-cols-[2rem_minmax(0,1fr)_auto]",
        className,
      )}
    >
      <div className={markSize === "lg" ? "flex items-center" : "pt-0.5 sm:pt-0"}>{mark}</div>
      <div className="min-w-0">
        <div className="text-[14px] font-semibold leading-5 text-neutral-900">{title}</div>
        {meta ? (
          <div className="mt-0.5 text-[13px] leading-5 text-neutral-600">{meta}</div>
        ) : null}
      </div>
      {(status || action) ? (
        <div className="col-start-2 flex flex-wrap items-center gap-2 sm:col-start-auto sm:justify-end">
          {status}
          {action}
        </div>
      ) : null}
    </div>
  );
}

export function ProfileActionLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex min-h-8 items-center rounded-md px-2 py-1 text-[13px] font-semibold text-brand-forest underline decoration-brand-forest/30 underline-offset-2 hover:bg-brand-forest-soft"
    >
      {children}
    </a>
  );
}
