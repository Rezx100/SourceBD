// Certificate row (`03 Patterns · 3`): standard and number in mono, who issued it, a state
// chip with the exact date, and the document. Problems sort first. Phone: the chip leads so
// urgency is read first, and the whole row opens the document (44 tall at least).
// Server-safe; the document link is the only link, stretched over the row on a phone.

import { FileText } from "@phosphor-icons/react/dist/ssr";
import { CertChip, Unpublished } from "@/components/kit";
import { cn } from "@/lib/utils";
import { SourceMark, hasSourceMark } from "./source-mark";
import { ABSENT, CERT_ORDER, certHeading, certWords, type CertSummary } from "./words";

export type CertRowData = {
  scheme: string;
  number: string | null;
  issuer: string | null;
  expiresOn: string | null;
  /** A page that opens for anyone, or null: a link that may end at a 404 or a login is never drawn. */
  documentUrl: string | null;
  /** "Open certificate", or "Open on GOTS" for the GOTS directory page. */
  documentLabel?: string;
  /** The row's id, so a link from another page (the Compliance hub) can land on this one row. */
  anchor?: string;
  /** The day its body stopped listing it (spec-etl-freshness S2); the chip then says so. */
  delistedOn?: string | null;
  /** "checked with GOTS 6 Oct 2026": when its body last showed it; caution once stale or delisted. */
  check?: { text: string; caution: boolean } | null;
};

/** A certificate's chip, its words worked out from the date. */
export function CertStateChip({ expiresOn, today, className }: { expiresOn: string | null; today: Date; className?: string }) {
  const { state, label } = certWords(expiresOn, today);
  return (
    <CertChip state={state} className={className}>
      {label}
    </CertChip>
  );
}

const PILL: Record<CertSummary["state"], string> = {
  expired: "bg-cert-expired-bg text-cert-expired-fg",
  expiring: "bg-cert-expiring-bg text-cert-expiring-fg",
  valid: "bg-sunken text-ink-2",
  none: "border border-dashed border-line-strong text-ink-3",
};

/**
 * The one way a list or table says what a supplier's certificates are doing (the critique of
 * 7 Oct 2026: one certificate was drawn four ways with three date forms). Results, the pane list,
 * the phone list and Saved all call this: a 24px mark, then the state as a 6px pill in the fewest
 * words (`certShort`), then the other bodies' marks and "+N" for the rest. The full date lives in
 * the cell's title and its sr-only sentence, never in the pill. A body with no approved mark is
 * its name (the first) or part of the count (the others).
 */
export function CertSummaryCell({ cert }: { cert: CertSummary }) {
  const others = cert.others.filter((b) => hasSourceMark(b.code)).slice(0, 2);
  const rest = cert.total - 1 - others.length;
  // A screen reader hears every body the marks show, each with its state, not the marks.
  const said = cert.total === 1 ? cert.first.words : `${cert.total} certificates: ${[cert.first, ...cert.others].map((b) => b.words).join("; ")}`;
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1" title={cert.words}>
      <span className="sr-only">{said}</span>
      <span aria-hidden className="inline-flex items-center gap-1.5">
        {hasSourceMark(cert.first.code) ? (
          <SourceMark source={cert.first.code} />
        ) : (
          <span className="inline-flex h-6 items-center rounded-md border border-line px-1.5 text-xs font-medium text-ink-2">{cert.first.scheme}</span>
        )}
        <span className={cn("inline-flex whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium", PILL[cert.state])}>{cert.short}</span>
      </span>
      {others.length || rest ? (
        <span aria-hidden className="inline-flex items-center gap-1">
          {others.map((b) => (
            <span key={b.code} title={b.words}>
              <SourceMark source={b.code} />
            </span>
          ))}
          {rest ? <span className="pl-0.5 text-xs font-medium text-ink-3">+{rest}</span> : null}
        </span>
      ) : null}
    </span>
  );
}

// The table's columns from 640px. The Document column is drawn only when a certificate has a page to open.
const COLS = "sm:grid-cols-[minmax(0,200px)_minmax(0,1fr)_minmax(0,330px)]";
const COLS_DOC = "sm:grid-cols-[minmax(0,180px)_minmax(0,1fr)_minmax(0,250px)_minmax(0,132px)]";

/**
 * The certificates of a record: heading with the count and the problems, then the rows.
 * `compact` keeps the stacked layout at every width: a docked pane is 640 wide, too narrow for four columns.
 */
export function CertTable({ certs, today, from, className, compact = false, level: H = "h3" }: { certs: CertRowData[]; today: Date; from?: string; className?: string; compact?: boolean; level?: "h2" | "h3" }) {
  const rows = certs
    .map((c) => ({ c, w: certWords(c.expiresOn, today, c.delistedOn) }))
    .sort((a, b) => CERT_ORDER[a.w.state] - CERT_ORDER[b.w.state]);
  const docs = rows.some((r) => r.c.documentUrl);
  const cols = docs ? COLS_DOC : COLS;
  return (
    <section aria-label="Certificates" className={cn("flex flex-col rounded-md border border-line", className)}>
      <header className="flex min-h-12 flex-wrap items-center justify-between gap-x-4 border-b border-line px-4 py-2">
        <H className="text-base font-semibold text-ink">{certHeading(rows.map((r) => r.w.state))}</H>
        {from ? <p className="text-xs text-ink-3">{from}</p> : null}
      </header>
      <div className={cn("hidden h-9 items-center gap-4 border-b border-line bg-subtle px-4 text-xs font-medium text-ink-3", !compact && "sm:grid", !compact && cols)}>
        <span>Certificate</span>
        <span>Issued by</span>
        <span>State</span>
        {docs ? <span>Document</span> : null}
      </div>
      <ul>
        {rows.map(({ c, w }, i) => (
          <li
            key={`${c.scheme}-${c.number}-${i}`}
            id={c.anchor}
            className={cn(
              "relative scroll-mt-[var(--record-offset,4rem)] border-b border-line px-4 py-3 last:border-b-0 target:bg-brand-tint",
              compact
                ? "grid min-h-11 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1"
                : cn("flex flex-col gap-1.5 max-sm:min-h-11 sm:grid sm:min-h-14 sm:items-center sm:gap-4 sm:py-2", cols),
            )}
          >
            <span className={cn("flex flex-col", compact ? "col-start-1 row-start-1 flex-row items-baseline gap-2" : "max-sm:order-2 max-sm:flex-row max-sm:items-baseline max-sm:gap-2")}>
              <span className="text-md font-medium text-ink sm:text-base">{c.scheme}</span>
              {c.number ? <span className="font-mono text-sm text-ink-2">{c.number}</span> : null}
            </span>
            <span className={cn("text-sm text-ink-2 sm:text-base", compact ? "col-start-1 row-start-2" : "max-sm:order-3")}>{c.issuer ?? <Unpublished>{ABSENT.issuer}</Unpublished>}</span>
            <span className={cn("flex flex-col gap-0.5", compact ? "col-start-2 row-start-1 items-end justify-self-end" : "max-sm:order-1 sm:items-start")}>
              <CertChip state={w.state} className="whitespace-nowrap">
                {w.label}
              </CertChip>
              {c.check ? <span className={cn("text-xs", c.check.caution ? "text-caution" : "text-ink-3")}>{c.check.text}</span> : null}
            </span>
            {c.documentUrl ? (
              <span className={cn("flex h-8 items-center gap-1.5", compact ? "col-start-2 row-start-2 justify-self-end" : "max-sm:order-4")}>
                <FileText size={16} className="shrink-0 text-brand-ink" aria-hidden />
                <a
                  href={c.documentUrl}
                  className="rounded-sm text-sm font-medium text-brand-ink underline decoration-1 [text-underline-position:from-font] hover:decoration-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus max-sm:after:absolute max-sm:after:inset-0"
                >
                  {c.documentLabel ?? "Open certificate"}
                </a>
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
