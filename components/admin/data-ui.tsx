// The v4 page pieces shared by the admin data pages (suppliers, users, audit log, sources, citation
// health, feedback): a heading with its one-line lede, a titled section, a facts list, a status
// chip, the two native field classes, a JSON block and the three formatters. Everything in them is
// the v4 kit and its tokens; there is no new primitive. Server-safe (no hooks, no state), so a
// client island can use it too. The sibling `admin-ui.tsx` stays for the pages still on the old kit.

import { Warning } from "@phosphor-icons/react/dist/ssr";
import type { ReactNode } from "react";
import { Chip, FactChip, TypeChip, fieldBox, fieldEdge } from "@/components/kit";
import { cn } from "@/lib/utils";

/** A one-line native field (input or select) at the kit's height; a `<select>` posts with a plain GET form. */
export const adminFieldClass = cn(fieldBox, fieldEdge, "h-control px-2.5 text-base");
/** A native multi-line field. */
export const adminAreaClass = cn(fieldBox, fieldEdge, "px-2.5 py-1.5 text-base");

/** The page's one `h1`, its one-line lede, and the actions beside them. */
export function AdminHead({ title, lede, actions }: { title: ReactNode; lede?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-ink [overflow-wrap:anywhere]">{title}</h1>
        {lede ? <p className="mt-1 text-md text-ink-2">{lede}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

/** The column every admin data page sits in. `narrow` is for forms and one record. */
export function AdminColumn({ children, narrow = false }: { children: ReactNode; narrow?: boolean }) {
  return <div className={cn("mx-auto flex w-full flex-col gap-6", narrow ? "max-w-[760px]" : "max-w-[1200px]")}>{children}</div>;
}

/** A titled, bordered section. `flush` hands the body its whole width (a table or a list). */
export function AdminSection({
  title,
  description,
  meta,
  actions,
  flush = false,
  children,
  className,
}: {
  title?: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  flush?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("flex flex-col overflow-clip rounded-lg border border-line", className)}>
      {title || description || meta || actions ? (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3">
          <div className="min-w-0">
            {title ? <h2 className="text-base font-semibold text-ink">{title}</h2> : null}
            {description ? <p className="mt-0.5 text-base text-ink-2">{description}</p> : null}
            {meta ? <p className="mt-0.5 text-sm text-ink-3">{meta}</p> : null}
          </div>
          {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
        </div>
      ) : null}
      <div className={flush ? undefined : "p-4"}>{children}</div>
    </section>
  );
}

/** Facts as label over value. An empty value says "Not on file", never a dash. */
export function AdminFacts({ rows, className }: { rows: Array<{ label: ReactNode; value: ReactNode; mono?: boolean }>; className?: string }) {
  return (
    <dl className={cn("grid gap-x-4 gap-y-3 text-base sm:grid-cols-2", className)}>
      {rows.map((row, i) => (
        <div key={i} className="min-w-0">
          <dt className="text-sm text-ink-3">{row.label}</dt>
          <dd className={cn("mt-0.5 min-w-0 text-ink [overflow-wrap:anywhere]", row.mono && "font-mono text-sm")}>{row.value ?? "Not on file"}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A list of rows inside a flush section: a rule between rows, one row per entry. */
export function AdminRows({ children, className }: { children: ReactNode; className?: string }) {
  return <ul className={cn("m-0 list-none divide-y divide-line p-0", className)}>{children}</ul>;
}

export function AdminRow({ children, className }: { children: ReactNode; className?: string }) {
  return <li className={cn("flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between", className)}>{children}</li>;
}

/** A status in a table or a header. Normal is neutral; a thing to look at is caution; a block is danger. */
export function StatusChip({ tone = "plain", children }: { tone?: "plain" | "caution" | "danger"; children: ReactNode }) {
  if (tone === "danger") return <FactChip state="disagree">{children}</FactChip>;
  if (tone === "caution") return (
    <Chip tone="caution" icon={Warning}>
      {children}
    </Chip>
  );
  return <TypeChip>{children}</TypeChip>;
}

/** A JSON payload, as the audit trail stores it. */
export function JsonBlock({ value, className }: { value: unknown; className?: string }) {
  return (
    <pre className={cn("overflow-x-auto rounded-sm border border-line bg-subtle p-3 font-mono text-xs text-ink", className)}>
      {JSON.stringify(value, null, 2)}
    </pre>
  );
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
