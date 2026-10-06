// Certificate row (`03 Patterns · 3`): standard and number in mono, who issued it, a state
// chip with the exact date, and the document. Problems sort first. Phone: the chip leads so
// urgency is read first, and the whole row opens the document (44 tall at least).
// Server-safe; the document link is the only link, stretched over the row on a phone.

import { CheckCircle, Clock, FileText, MinusCircle, XCircle } from "@phosphor-icons/react/dist/ssr";
import { CertChip } from "@/components/kit";
import { cn } from "@/lib/utils";
import { CERT_ORDER, certHeading, certWords } from "./words";

export type CertRowData = {
  scheme: string;
  number: string | null;
  issuer: string | null;
  expiresOn: string | null;
  documentUrl: string | null;
  /** "Open certificate", "Open label check" for OEKO-TEX, "Open on GOTS" for the GOTS directory page. */
  documentLabel?: string;
  /** Said in place of the link when there is no public page left ("No longer on the GOTS list"). */
  documentNote?: string;
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

/**
 * The first certificate problem in a list or table row: glyph, words, "· 3 more certificates".
 * `valid` is a quiet check in ink-2, `none` the no-expiry line; with no certificates at all the row says "None found".
 */
export function CertProblem({
  state,
  children,
  more,
  small,
}: {
  state: "expired" | "expiring" | "valid" | "none";
  children: string;
  more?: number;
  small?: boolean;
}) {
  const px = small ? 12 : 14;
  return (
    <span className="inline-flex items-center gap-1.5">
      {state === "expired" ? (
        <XCircle size={px} weight="fill" className="shrink-0 text-danger" aria-hidden />
      ) : state === "expiring" ? (
        <Clock size={px} weight="fill" className="shrink-0 text-caution-icon" aria-hidden />
      ) : state === "valid" ? (
        <CheckCircle size={px} weight="fill" className="shrink-0 text-ink-2" aria-hidden />
      ) : (
        <MinusCircle size={px} className="shrink-0 text-ink-3" aria-hidden />
      )}
      <span className={cn(small ? "text-xs" : "text-sm", state === "expired" && "font-medium text-danger", state === "expiring" && "font-medium text-caution", (state === "none" || state === "valid") && "text-ink-2")}>
        {children}
      </span>
      {more ? (
        <span className={cn("text-ink-3", small ? "text-xs" : "text-sm")}>
          · {more} more {more === 1 ? "certificate" : "certificates"}
        </span>
      ) : null}
    </span>
  );
}

/**
 * The certificates of a record: heading with the count and the problems, then the rows.
 * `compact` keeps the stacked layout at every width: a docked pane is 640 wide, too narrow for four columns.
 */
export function CertTable({ certs, today, from, className, compact = false }: { certs: CertRowData[]; today: Date; from?: string; className?: string; compact?: boolean }) {
  const rows = certs
    .map((c) => ({ c, w: certWords(c.expiresOn, today, c.delistedOn) }))
    .sort((a, b) => CERT_ORDER[a.w.state] - CERT_ORDER[b.w.state]);
  return (
    <section aria-label="Certificates" className={cn("flex flex-col rounded-md border border-line", className)}>
      <header className="flex min-h-12 flex-wrap items-center justify-between gap-x-4 border-b border-line px-4 py-2">
        <h3 className="text-base font-semibold text-ink">{certHeading(rows.map((r) => r.w.state))}</h3>
        {from ? <p className="text-xs text-ink-3">{from}</p> : null}
      </header>
      <div className={cn("hidden h-9 items-center gap-4 border-b border-line bg-subtle px-4 text-xs font-medium text-ink-3", !compact && "sm:grid sm:grid-cols-[minmax(0,200px)_minmax(0,1fr)_minmax(0,260px)_minmax(0,140px)]")}>
        <span>Certificate</span>
        <span>Issued by</span>
        <span>State</span>
        <span>Document</span>
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
                : "flex flex-col gap-1.5 max-sm:min-h-11 sm:grid sm:min-h-14 sm:grid-cols-[minmax(0,200px)_minmax(0,1fr)_minmax(0,260px)_minmax(0,140px)] sm:items-center sm:gap-4 sm:py-2",
            )}
          >
            <span className={cn("flex flex-col", compact ? "col-start-1 row-start-1 flex-row items-baseline gap-2" : "max-sm:order-2 max-sm:flex-row max-sm:items-baseline max-sm:gap-2")}>
              <span className="text-md font-medium text-ink sm:text-base">{c.scheme}</span>
              {c.number ? <span className="font-mono text-sm text-ink-2">{c.number}</span> : null}
            </span>
            <span className={cn("text-sm text-ink-2 sm:text-base", compact ? "col-start-1 row-start-2" : "max-sm:order-3")}>{c.issuer ?? <span className="text-ink-3">Issuer not published</span>}</span>
            <span className={cn("flex flex-col gap-0.5", compact ? "col-start-2 row-start-1 items-end justify-self-end" : "max-sm:order-1 sm:items-start")}>
              <CertChip state={w.state} className="whitespace-nowrap">
                {w.label}
              </CertChip>
              {c.check ? <span className={cn("text-xs", c.check.caution ? "text-caution" : "text-ink-3")}>{c.check.text}</span> : null}
            </span>
            <span className={cn("flex h-8 items-center gap-1.5", compact ? "col-start-2 row-start-2 justify-self-end" : "max-sm:order-4")}>
              {c.documentUrl ? (
                <>
                  <FileText size={16} className="shrink-0 text-brand" aria-hidden />
                  <a
                    href={c.documentUrl}
                    className="rounded-sm text-sm font-medium text-brand underline decoration-1 [text-underline-position:from-font] hover:decoration-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand max-sm:after:absolute max-sm:after:inset-0"
                  >
                    {c.documentLabel ?? "Open certificate"}
                  </a>
                </>
              ) : c.documentNote ? (
                <span className="text-sm text-ink-3">{c.documentNote}</span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
