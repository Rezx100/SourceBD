// The few pieces the admin decision queues share (overview, beta, review queue, claims,
// certifications, sanctions), composed from the v4 kit: a page head, a titled section, a
// stat row, a filter bar and the foot of a paged table. Nothing here is a new primitive.

import Link from "next/link";
import type { ReactNode } from "react";

import { ButtonLink, Pagination, Skeleton, TableFrame, TableScroll } from "@/components/kit";
import { cn } from "@/lib/utils";

/** One `h1`, an optional one-line lede, and the page's own actions on the right. */
export function QueueHead({ title, lede, actions }: { title: ReactNode; lede?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        {lede ? <p className="text-md text-ink-2">{lede}</p> : null}
      </div>
      {actions}
    </header>
  );
}

/** The column every queue page sits in (the portal frame draws the page padding). */
export function QueueColumn({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mx-auto flex w-full max-w-[1200px] flex-col gap-6", className)}>{children}</div>;
}

/** A titled block: an `h2`, what it covers, and the body in a bordered box (or bare, for a table). */
export function QueueSection({
  title,
  meta,
  children,
  bare = false,
}: {
  title: ReactNode;
  meta?: ReactNode;
  children: ReactNode;
  bare?: boolean;
}) {
  return (
    <section className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-lg font-semibold text-ink">{title}</h2>
        {meta ? <p className="text-sm text-ink-3">{meta}</p> : null}
      </div>
      {bare ? children : <div className="rounded-md border border-line p-4">{children}</div>}
    </section>
  );
}

/** A row of figures, each with its name and one line under it. */
export function StatRow({ items }: { items: { label: string; value: number; hint?: string }[] }) {
  return (
    <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((s) => (
        <div key={s.label} className="flex flex-col gap-1 rounded-md border border-line p-4">
          <dt className="text-sm font-medium text-ink-3">{s.label}</dt>
          <dd className="text-2xl font-semibold tabular-nums text-ink">{s.value.toLocaleString()}</dd>
          {s.hint ? <dd className="text-sm text-ink-2">{s.hint}</dd> : null}
        </div>
      ))}
    </dl>
  );
}

/** A name and a figure on each line. */
export function FigureList({ rows, mono = false }: { rows: ReadonlyArray<readonly [string, number]>; mono?: boolean }) {
  return (
    <ul className="m-0 flex list-none flex-col p-0 text-base">
      {rows.map(([k, v]) => (
        <li key={k} className="flex items-baseline justify-between gap-3 border-b border-line py-1.5 last:border-b-0">
          <span className={cn("text-ink-2", mono && "font-mono text-sm")}>{k}</span>
          <span className="font-mono tabular-nums text-ink">{v.toLocaleString()}</span>
        </li>
      ))}
    </ul>
  );
}

/** The filter bar of a queue: a GET form, so the filters live in the address. */
export function QueueFilter({
  action,
  hidden,
  children,
  reset,
}: {
  action: string;
  hidden?: { name: string; value: string };
  children: ReactNode;
  reset?: ReactNode;
}) {
  return (
    <form method="get" action={action} className="flex flex-wrap items-end gap-3 rounded-md border border-line p-4">
      {hidden ? <input type="hidden" name={hidden.name} value={hidden.value} /> : null}
      {children}
      {reset}
    </form>
  );
}

/** A table in its frame, scrolling sideways on a narrow screen, with the pager under it. */
export function QueueTable({
  noun,
  total,
  page,
  pages,
  perPage,
  shown,
  pageHref,
  children,
}: {
  noun: string;
  total: number;
  page: number;
  pages: number;
  perPage: number;
  shown: number;
  pageHref: (n: number) => string;
  children: ReactNode;
}) {
  const from = (page - 1) * perPage + 1;
  return (
    <TableFrame>
      <TableScroll>{children}</TableScroll>
      {pages > 1 ? (
        <Pagination
          noun={noun}
          from={from}
          to={from + shown - 1}
          total={total}
          page={page}
          pages={pages}
          prevHref={page > 1 ? pageHref(page - 1) : undefined}
          nextHref={page < pages ? pageHref(page + 1) : undefined}
        />
      ) : null}
    </TableFrame>
  );
}

/** A name that links to the supplier's admin record. */
export function SupplierLink({ id, children }: { id: string; children: ReactNode }) {
  return (
    <Link
      href={`/admin/suppliers/${id}`}
      className="rounded-sm font-medium text-ink decoration-1 [text-underline-position:from-font] outline-none hover:underline focus-visible:underline"
    >
      {children}
    </Link>
  );
}

/** A link to a document or a source, opened in a new tab. */
export function OutLink({ href }: { href: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="font-mono text-sm font-medium text-brand-ink underline decoration-1 hover:decoration-2">
      view
    </a>
  );
}

/** The "Review hub" style link in a page head. */
export function HeadLink({ href, children }: { href: string; children: ReactNode }) {
  return <ButtonLink href={href}>{children}</ButtonLink>;
}

/** The loading shape of a queue page: head, a row of figures, a table. */
export function QueueLoading() {
  return (
    <QueueColumn>
      <div role="status" aria-label="Loading" className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton tone="subtle" className="h-4 w-80" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="flex flex-col gap-2 rounded-md border border-line p-4">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-7 w-16" />
              <Skeleton tone="subtle" className="h-3 w-32" />
            </div>
          ))}
        </div>
        <div className="rounded-md border border-line">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex items-center justify-between gap-6 border-b border-line px-4 py-3 last:border-b-0">
              <Skeleton className="h-3.5 w-48" />
              <Skeleton tone="subtle" className="h-3 w-16" />
            </div>
          ))}
        </div>
      </div>
    </QueueColumn>
  );
}

const WORDS: [RegExp, string][] = [
  [/\bRsc\b/g, "RSC"],
  [/\bOeko Tex\b/g, "OEKO-TEX"],
  [/\bGots\b/g, "GOTS"],
  [/\bSmeta\b/g, "SMETA"],
  [/\bUflpa\b/g, "UFLPA"],
  [/\bOfac\b/g, "OFAC"],
];

export function humanizeAdminToken(value: string | null | undefined): string {
  if (!value) return "Any";
  return WORDS.reduce((s, [re, to]) => s.replace(re, to), value.replace(/_/g, " ").replace(/\b\w/g, (ch) => ch.toUpperCase()));
}

export function formatAdminDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toISOString().slice(0, 10);
}

export function formatAdminDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toISOString().replace("T", " ").slice(0, 19);
}
