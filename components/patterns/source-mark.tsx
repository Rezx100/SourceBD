// Source marks (`03 Patterns · 1`): a 24px frame with the one-colour mark, then the short
// name in words. Marks run in tier order, each group named. A brand supplier list is a
// name in a dashed frame with a document glyph, never a logo. Server-safe.

import { FileText, Hourglass } from "@phosphor-icons/react/dist/ssr";
import type { ReactNode } from "react";
import { daysUntil, formatDay } from "@/lib/dashboard/facts";
import { sourceFullName } from "@/lib/source-full-names";
import { cn } from "@/lib/utils";

type Tier = 1 | 2 | 3 | 4;

// code to mark file under public/icons/sources and its tier. No row: dashed document frame.
const MARKS: Record<string, { file: string; tier: Tier }> = {
  EPB: { file: "regulatory/epb", tier: 1 },
  RSC: { file: "regulatory/rsc", tier: 1 },
  BEPZA: { file: "regulatory/bepza", tier: 1 },
  DIFE: { file: "regulatory/dife", tier: 1 },
  BGMEA: { file: "associations/bgmea", tier: 2 },
  BKMEA: { file: "associations/bkmea", tier: 2 },
  BGAPMEA: { file: "associations/bgapmea", tier: 2 },
  BTMA: { file: "associations/btma", tier: 2 },
  GOTS: { file: "cert/gots", tier: 3 },
  "OEKO-TEX": { file: "cert/oeko-tex", tier: 3 },
  OEKO_TEX: { file: "cert/oeko-tex", tier: 3 },
  WRAP: { file: "cert/wrap", tier: 3 },
};

export const TIER_LABEL: Record<Tier, string> = {
  1: "Tier 1 · government and RSC",
  2: "Tier 2 · trade bodies",
  3: "Tier 3 · certification bodies",
  4: "Tier 4 · brand supplier lists",
};

const norm = (c: string) => c.toUpperCase();
/** The tier a source sits in: its mark's, else 4 (a name with no mark is listed as a supplier list). */
export const tierOf = (c: string): Tier => MARKS[norm(c)]?.tier ?? 4;

/** Whether a source has an approved mark (`context/logos.lock.md`: no row, no render). */
export const hasSourceMark = (c: string): boolean => norm(c) in MARKS;

/** The 24px frame. A source with a mark shows it; any other shows the dashed document glyph. `lazy`: a mark far down a page is fetched when it nears, not with the first screen. */
export function SourceMark({ source, className, lazy }: { source: string; className?: string; lazy?: boolean }) {
  const m = MARKS[norm(source)];
  if (!m)
    return (
      <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-md border border-dashed border-line-strong bg-subtle", className)} aria-hidden>
        <FileText size={14} className="text-ink-3" />
      </span>
    );
  return (
    <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-md border border-line bg-surface", className)} aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element -- a locked one-colour mark, 18px at most */}
      <img src={`/icons/sources/${m.file}.png`} alt="" loading={lazy ? "lazy" : undefined} decoding={lazy ? "async" : undefined} className="h-auto max-h-[18px] w-auto max-w-[18px] object-contain" />
    </span>
  );
}

/**
 * SourceBD's own mark for a fact the record holds but no register is linked to yet: the dashed
 * document, 16px under a fact, named "Source pending". One glyph per fact; the words live once in
 * the legend under the facts (DESIGN.md, Record Sheet), never as a sentence under each.
 */
export function PendingMark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex size-4 items-center justify-center rounded-sm border border-dashed border-line-strong bg-subtle", className)} title="Source pending: the register that filed this fact is not linked yet">
      <FileText size={10} className="text-ink-3" aria-hidden />
      <span className="sr-only">Source pending</span>
    </span>
  );
}

/** Mark and short name: "BGMEA". The full name is its hover title. */
export function SourceChip({ source, name, className }: { source: string; name?: string; className?: string }) {
  return (
    <span className={cn("inline-flex h-6 items-center gap-1.5", className)} title={sourceFullName(source) ?? undefined}>
      <SourceMark source={source} />
      <span className="w-max text-sm font-medium text-ink">{name ?? source}</span>
    </span>
  );
}

/** Every source of a record in tier order, each group named in words. */
export function SourceGroups({ sources, className }: { sources: string[]; className?: string }) {
  const tiers = ([1, 2, 3, 4] as const).map((t) => [t, sources.filter((s) => tierOf(s) === t)] as const).filter(([, s]) => s.length);
  return (
    <div className={cn("flex flex-wrap items-start gap-6", className)}>
      {tiers.map(([t, list]) => (
        <div key={t} className="flex flex-col gap-2">
          <p className="text-xs font-medium text-ink-3">{TIER_LABEL[t]}</p>
          <div className="flex gap-3">
            {list.map((s) => (
              <SourceChip key={s} source={s} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export type SourceEntry = {
  source: string;
  checkedOn: string | null;
  /** The mark's short name when it is not the code itself ("H&M" for BRAND_HM). */
  label?: string;
  /** The register spelled out, when the page holds it. */
  fullName?: string;
};

/**
 * The record's details panel (344): every source with its full name and the date we last
 * checked it. Past 90 days the read turns caution, as an hourglass and in words ("read 102 days
 * ago", the date in its title): the clock on a record means a certificate expiring, nothing else.
 * `level` is the heading's: h2 on the record's page, where the name is the h1.
 */
export function SourceList({ sources, today, className, level: H = "h3" }: { sources: SourceEntry[]; today: Date; className?: string; level?: "h2" | "h3" }) {
  return (
    <section aria-label="Sources" className={cn("flex w-full max-w-details flex-col rounded-lg border border-line bg-surface", className)}>
      <header className="flex h-11 items-center justify-between border-b border-line px-4">
        <H className="text-base font-semibold text-ink">Sources · {sources.length}</H>
        <span className="text-xs text-ink-3">Last checked</span>
      </header>
      <ul>
        {sources.map(({ source, checkedOn, label, fullName }) => {
          const age = daysUntil(checkedOn, today);
          const stale = age !== null && -age > 90;
          return (
            <li key={source} className="flex min-h-12 flex-wrap items-center gap-x-2 gap-y-0.5 border-b border-line px-4 py-2.5 last:border-b-0">
              <span className="flex flex-1">
                <SourceChip source={source} name={label} />
              </span>
              <span className={cn("flex w-[132px] shrink-0 items-center justify-end gap-1 text-right text-xs", stale ? "font-medium text-caution" : "text-ink-2")} title={stale ? (formatDay(checkedOn) ?? undefined) : undefined}>
                {stale ? <Hourglass size={12} weight="fill" className="shrink-0 text-caution-icon" aria-hidden /> : null}
                {stale ? `read ${-age} days ago` : (formatDay(checkedOn) ?? "Not dated")}
              </span>
              <span className="w-full pl-[30px] text-xs text-ink-3">{fullName ?? sourceFullName(source) ?? source}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** A table cell: three marks, then the rest as a count with its noun ("8 more sources"). */
export function SourcesCell({ sources }: { sources: string[] }) {
  const shown = sources.slice(0, 3);
  const rest = sources.length - shown.length;
  return (
    <span className="inline-flex items-center gap-1.5" title={sources.map((s) => sourceFullName(s) ?? s).join(", ")}>
      {shown.map((s) => (
        <SourceMark key={s} source={s} />
      ))}
      {rest > 0 ? (
        <span className="text-sm text-ink-3">
          {rest} more {rest === 1 ? "source" : "sources"}
        </span>
      ) : null}
    </span>
  );
}

/** "From BGMEA · checked 24 Jul 2026": the line that sits under a fact. */
export function SourceLine({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("text-xs text-ink-3 max-sm:text-sm", className)}>{children}</p>;
}
