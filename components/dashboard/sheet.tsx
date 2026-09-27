// Sheet primitives (REZ-A, artifact SupplierSheet README): the record's frame
// (a pane beside the results, or the full page) with its 52px bar, tabs with
// mono counts, sections, the FactsPanel (28px rows, label 150px, a mark at
// the row's end), the striped locked contact card, stat blocks, the
// certificate card, the RSC block and the sticky frosted action bar. `Stage`
// and `Scrim` remain for the gallery's RFQ composer, which is still a dialog.

import type { ReactNode } from "react";
import { certStateLabel, rscStatusNeedsLook, type CertModel } from "@/lib/dashboard/facts";
import type { FacilityRowModel, FactRow, LocationRow, RecordRfqRow, SanctionRow, SourceRow } from "@/lib/dashboard/models";
import { recordPage, sourceMark } from "@/lib/dashboard/source-tiers";
import { cn } from "@/lib/utils";
import { Badge } from "./chips";
import { DialogFocus } from "./dialog-focus";
import { Button, Meter } from "./controls";
import { Icon } from "./icons";
import { SourceMark } from "./marks";
import { Caption, Code, Eyebrow, Heading, Label } from "./type";

/**
 * `.stage`: a fixed-height frame that clips the shell under a sheet or dialog.
 *
 * `behind` is the shell the sheet covers, and it is `inert`. The scrim takes
 * the pointer, so a mouse could not reach it; the keyboard could, and 57
 * elements outside the dialog were still tab stops on each of the three sheet
 * screens — the dialog's own Close button came 27th. `aria-modal="true"` also
 * told a screen reader that background was hidden while Chromium's own
 * accessibility tree still exposed it, so the page failed in both directions
 * at once.
 */
export function Stage({ height, behind, children }: { height: number; behind?: ReactNode; children: ReactNode }) {
  return (
    <div className="relative overflow-hidden" style={{ height }}>
      {behind === undefined ? null : <div inert>{behind}</div>}
      {children}
    </div>
  );
}

export function Scrim() {
  return <div aria-hidden className="absolute inset-0 bg-surface-inverse opacity-[0.32] animate-scrim-in motion-reduce:animate-none" />;
}

/**
 * The record's frame: its bar, its scroll region and its action bar, filling
 * whatever holds it.
 *
 * `pane`: beside the results on /app/discover, in `RecordPane`. Focusable by
 * script (`DialogFocus` moves focus here on open, so the label is announced),
 * never a tab stop, and it slides in from the right edge (320 ms, a long
 * decelerating curve, from 32px). Only the entrance is drawn: a close is a
 * navigation and lands at once. `motion-reduce` keeps it still.
 *
 * `page`: the full record page at `/app/suppliers/[slug]`, filling the content
 * region, with nothing to close.
 *
 * Neither is a dialog. The record used to be a modal sheet over a scrim, with
 * the whole shell inert behind it; the founder's one-viewport frame (27 Sep
 * 2026) puts the record beside the results with both live, so nothing is
 * modal and nothing is inert.
 */
export function Sheet({ label, mode = "pane", children }: { label: string; mode?: "pane" | "page"; children: ReactNode }) {
  const base = "flex min-h-0 min-w-0 flex-1 flex-col bg-surface";
  if (mode === "page") {
    return (
      <section aria-label={label} className={base}>
        {children}
      </section>
    );
  }
  return (
    <section
      data-record-pane=""
      aria-label={label}
      tabIndex={-1}
      className={cn(base, "outline-none animate-sheet-in motion-reduce:animate-none")}
    >
      {children}
    </section>
  );
}

/**
 * Where the record sits on /app/discover: a pane beside the results from
 * `lg`, the whole content region below it — the results column hides itself
 * under it there, the search is still in the URL, and Close returns to it.
 * The width is a share of the content region between two stops, so the
 * results keep a readable column on a 1280 display and the record keeps its
 * measure on a 1920 one.
 */
export function RecordPane({
  closeHref,
  openKey = "",
  children,
}: {
  closeHref?: string | null;
  /** What the pane is showing (record, line or notice); focus moves to it whenever that changes. */
  openKey?: string;
  children: ReactNode;
}) {
  return (
    <div
      data-open-key={openKey}
      className="flex min-h-0 min-w-0 flex-1 flex-col border-line lg:w-[clamp(480px,55%,760px)] lg:flex-none lg:border-l"
    >
      {closeHref ? <DialogFocus closeHref={closeHref} openKey={openKey} /> : null}
      {children}
    </div>
  );
}

/**
 * The results beside the record on /app/discover: the column that scrolls on
 * its own and, with a record open, steps aside below `lg` — the record takes
 * the content region and the search waits in the URL for Close. One
 * definition for the page, the gallery and the preview harness, so the
 * three cannot drift.
 */
export function ResultsColumn({ besideRecord = false, children }: { besideRecord?: boolean; children: ReactNode }) {
  return (
    <div className={cn("flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-y-auto p-4 sm:p-6", besideRecord && "hidden lg:flex")}>
      {children}
    </div>
  );
}

export function SheetBar({ children }: { children: ReactNode }) {
  // `min-w-0` on the row, so a long child (the breadcrumb on the line sheet)
  // shrinks instead of pushing Share and Close off a 320px screen. A minimum
  // height, not a fixed one: a 125-character name in that breadcrumb wraps to
  // several lines at 320px, and a fixed 52px bar cut its first lines off above
  // the screen.
  return <div className="flex min-h-[52px] min-w-0 shrink-0 items-center gap-3 border-b border-line-subtle px-5 py-2">{children}</div>;
}

export function SheetScroll({ measure = false, children }: { measure?: boolean; children: ReactNode }) {
  // `data-sheet-scroll` so a guard can find this element without pinning its
  // class attribute: the one that did meant the scroll region could never
  // gain a utility, and `overscroll-contain` — which a pane's scroll region
  // wants, so its scroll does not chain into the results beside it — was
  // therefore a repair the suite refused.
  // `measure`: the full page is as wide as the content region, and a facts
  // panel across 1600px is unreadable; the body keeps the record's measure
  // and centres it, while the bar and the action bar run the full width.
  return (
    <div data-sheet-scroll="true" className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
      {measure ? <div className="mx-auto w-full max-w-[1120px]">{children}</div> : children}
    </div>
  );
}

/**
 * A tab links only to a section this sheet actually renders. The others keep
 * the approved fragment's inert `href="#"` and say so to a screen reader,
 * rather than pointing at an anchor that does not exist.
 */
export function SheetTabs({ tabs }: { tabs: readonly { label: string; count: string | null; href: string | null; active?: boolean }[] }) {
  // Eight tabs at 320px is ~640px of nav. It scrolls sideways rather than
  // wrapping into three rows or pushing the sheet past the viewport, and
  // `tabIndex` lets a keyboard reach that scroll region (WCAG 2.1.1).
  return (
    <nav
      aria-label="Record sections"
      tabIndex={0}
      className="mt-2 flex gap-5 overflow-x-auto border-b border-line-subtle px-6 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {tabs.map((t) => (
        <a
          key={t.label}
          href={t.href ?? "#"}
          aria-disabled={t.href === null ? "true" : undefined}
          tabIndex={t.href === null ? -1 : undefined}
          title={t.href === null ? "Not available on this record" : undefined}
          aria-current={t.active ? "true" : undefined}
          className={cn(
            "-mb-px inline-flex h-10 items-center gap-1.5 whitespace-nowrap border-b-2 border-transparent text-base font-medium text-ink-muted transition-colors duration-fast hover:text-ink-strong",
            t.href === null && "text-ink-subtle hover:text-ink-subtle",
            t.active && "border-brand text-ink-strong",
          )}
        >
          {t.label}
          {t.count !== null ? (
            <span className={cn("font-mono text-[11px] text-ink-subtle", t.active && "text-brand-ink")}>{t.count}</span>
          ) : null}
        </a>
      ))}
    </nav>
  );
}

/** `.sec`: a section with its heading row. */
export function SheetSection({
  id,
  title,
  caption,
  action,
  children,
}: {
  id?: string;
  title?: string;
  caption?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} className="flex flex-col gap-4 border-b border-line-subtle px-6 py-5">
      {title ? (
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <Heading level="sm" as="h2" className="flex-1">
            {title}
          </Heading>
          {caption ? <Caption>{caption}</Caption> : null}
          {action ? <span className="ml-auto text-sm font-medium">{action}</span> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

/** `.fp`: the facts panel. Every row has room for a mark; a missing value reads "Not on file". */
export function FactsPanel({ rows }: { rows: readonly FactRow[] }) {
  const pending = rows.some((r) => r.value !== null && r.pendingSource && !(r.marks && r.marks.length > 0));
  return (
    <div className="flex flex-col">
      {rows.map((r) => (
        // Stacks below `sm`. Side by side, a 150px label plus the trailing
        // "source pending" / "registers checked" caption left the value about
        // 75px on a 375px screen, and `[overflow-wrap:anywhere]` then broke
        // "ABONI KNITWEAR LTD." one character per line.
        <div
          key={r.label}
          className="flex min-h-fact-row flex-col gap-0.5 border-t border-line-subtle py-[3px] first:border-t-0 sm:flex-row sm:items-start sm:gap-3"
        >
          <span className="w-full shrink-0 text-sm font-medium leading-[22px] text-ink-muted sm:w-[150px]">{r.label}</span>
          {/* 4,596 of 10,266 published records file `address_raw` as a
              newline-delimited block ("…, Hemayetpur\nDhaka\nSavar"); in
              normal flow the breaks collapse and the street runs into the
              district. `pre-line` shows the lines the register filed and
              still collapses runs of spaces. */}
          <span
            className={cn(
              "min-w-0 flex-1 whitespace-pre-line text-base leading-[22px] text-ink [overflow-wrap:anywhere]",
              r.value === null && "text-quiet-ink",
            )}
          >
            {r.value === null ? (
              <>
                {r.empty ?? "Not on file"}
                {r.note ? ` · ${r.note}` : ""}
              </>
            ) : r.href ? (
              <a href={r.href} className="inline-flex items-center gap-0.5 text-brand-ink">
                {r.code ? <Code>{r.value}</Code> : r.value} <Icon name="external" small />
              </a>
            ) : r.code ? (
              <Code>{r.value}</Code>
            ) : (
              r.value
            )}
            {r.value !== null && r.note ? <Caption className="ml-1.5">{r.note}</Caption> : null}
            {r.badge ? (
              <Badge tone={r.badge.tone} className="ml-1.5 align-middle">
                {r.badge.label}
              </Badge>
            ) : null}
          </span>
          <span className="inline-flex shrink-0 flex-wrap items-center gap-1.5 sm:pt-[3px]">
            {r.marks && r.marks.length > 0 ? (
              r.marks.map((m) => <SourceMark key={m.code} mark={m} sm />)
            ) : r.value === null && r.checked ? (
              <Caption className="sm:whitespace-nowrap">{r.checked}</Caption>
            ) : r.pendingSource ? (
              // Said once under the panel, not on every row: seven "source
              // pending" captions down the right edge were louder than the
              // facts. Each row keeps the words for a screen reader.
              <span className="sr-only">source pending</span>
            ) : null}
          </span>
        </div>
      ))}
      {pending ? (
        <Caption className="mt-2">Rows without a mark: source pending. The register that filed them is not linked per field yet.</Caption>
      ) : null}
    </div>
  );
}

/**
 * `.lockcard`: the contact block, locked by default. Striped, never blurred.
 * The plan name comes from settings; without one the label is just "Contact
 * details".
 *
 * `held` is the COUNT sentence from `supplier_contact_counts` (0105, REZ-C
 * §4.3) — "On file: 1 email · 6 phone numbers · a website". It is the whole of
 * what this card may say about the record's contact details: no email, no
 * phone number, no name and no role reaches this component, so there is
 * nothing here for a browser to reveal. `held` is null when the count could
 * not be read, and the card then claims nothing about kinds at all.
 */
export function LockCard({
  hidden,
  plan,
  held,
  sanctioned = false,
}: {
  hidden: string;
  plan: string | null;
  held?: string | null;
  /** A sanctioned record takes no RFQ, so the card must not offer one. */
  sanctioned?: boolean;
}) {
  return (
    <div data-locked="true" className="overflow-hidden rounded-md border border-locked-line">
      <div className="locked-pattern flex flex-col gap-1.5 p-4 text-locked-ink">
        <Label className="inline-flex items-center gap-1.5 text-ink-strong">
          <Icon name="lock" /> Contact details{plan ? ` · ${plan}` : ""}
        </Label>
        {held ? (
          <span data-contact-counts="true" className="text-xs text-ink-muted">
            {held}
          </span>
        ) : null}
        <span className="text-xs">{hidden}</span>
      </div>
      <div className="flex flex-col gap-3 px-4 py-3 text-sm text-ink-muted">
        {/* No promise about delivery: the RPC does not say whether this record
            has been claimed, and an unclaimed supplier is not reached until
            REZ-D ships behind RFQ_EMAIL_UNCLAIMED (handoff §4.6). */}
        {/* No "See plans": no plan unlocks contact details on the record
            (founder, 25 Sep), and a button that went nowhere said one did. */}
        <span>{sanctioned ? "RFQs cannot be sent to this supplier." : "Send an RFQ from the record instead."}</span>
      </div>
    </div>
  );
}

/** `.stats`: four stat blocks in a row. */
export function Stats({ items }: { items: readonly { key: string; value: string; sub: string | null }[] }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {items.map((s) => (
        <div key={s.key} className="flex min-w-0 flex-col gap-0.5 rounded-md border border-line-subtle bg-surface px-3.5 py-3">
          <Eyebrow>{s.key}</Eyebrow>
          <span className="whitespace-nowrap text-2xl font-normal text-ink-strong">{s.value}</span>
          {/* The sub-line carries a certificate's scope and a chapter list; held
              to one line it ran out of its cell and over the next stat. */}
          {s.sub ? <Caption className="[overflow-wrap:anywhere]">{s.sub}</Caption> : null}
        </div>
      ))}
    </div>
  );
}

const CERT_BADGE_TONE = { valid: "positive", expiring: "caution", expired: "caution", "no-expiry": "type" } as const;
const CERT_BADGE_ICON = { valid: "check-c", expiring: "clock", expired: "warn", "no-expiry": undefined } as const;

/** `.cert`: one certificate card. */
export function CertCard({ cert }: { cert: CertModel }) {
  // The certificate document IS this certificate's register page. Passing it
  // through `sourceMark` (which filters anything that is not a record page)
  // makes the square link where every other square on the sheet links; it was
  // the one mark set rendered unlinked, which made the action bar's "every
  // source mark links to its register page" false on any sheet with a cert.
  const mark = sourceMark(cert.markCode, cert.documentUrl);
  return (
    <div className="flex flex-col gap-1 rounded-md border border-line-subtle bg-surface px-4 py-3.5">
      <div className="flex items-center gap-2">
        <SourceMark mark={mark} lg />
        <Label className="flex-1 text-ink-strong">{cert.scheme}</Label>
        <Badge tone={CERT_BADGE_TONE[cert.state]} icon={CERT_BADGE_ICON[cert.state]}>
          {certStateLabel(cert)}
        </Badge>
      </div>
      {cert.number ? <Code className="text-ink">{cert.number}</Code> : <Caption>No certificate number on file</Caption>}
      <Caption>
        {[cert.issuer, cert.scope ? `scope: ${cert.scope}` : null].filter(Boolean).join(" · ")}
        {/* All seven SA8000 certificates in production carry
            `https://sa-intl.org/sa8000-search/` as their document — the search
            form `recordPage` rejects by name. The square beside this line was
            correctly left unlinked while the link promised the certificate and
            delivered a search page, so this goes through the same rule. */}
        {recordPage(cert.documentUrl) ? (
          <a href={cert.documentUrl!} className="ml-1.5 inline-flex items-center gap-0.5 text-brand-ink">
            Certificate <Icon name="external" small />
          </a>
        ) : null}
      </Caption>
    </div>
  );
}

export function CertGrid({ certs }: { certs: readonly CertModel[] }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {certs.map((c) => (
        <CertCard key={`${c.kind}-${c.number ?? c.expiresOn ?? ""}`} cert={c} />
      ))}
    </div>
  );
}

/** `.rsc`: the remediation meter with status words and the five report links. The RPC carries only active rows, so the "no longer covered" state is never drawn. */
export function RscBlock({
  progress,
  status,
  training,
  links,
  of,
}: {
  progress: number | null;
  status: string | null;
  training: string | null;
  links: readonly { label: string; href: string | null }[];
  /** Whose remediation this is — the meter needs a name, and two blocks sit on one section. */
  of: string;
}) {
  // "not finalised" is as much a caution as "behind schedule"; matching two of
  // the five states left the other one in the positive treatment.
  const behind = rscStatusNeedsLook(status);
  // A caution badge already says the status; the caption beside it repeated it.
  const words = [behind ? null : status, training].filter(Boolean).join(" · ");
  return (
    // One column. Side by side at 880px the label got about 90px, so
    // "Remediation 100 %" broke over two lines beside empty space.
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="inline-flex items-baseline gap-2 whitespace-nowrap">
            <Label className="text-ink-muted">Remediation</Label>
            <span className="text-xl font-semibold tabular-nums tracking-[-0.01em] text-ink-strong">
              {progress === null ? "not on file" : `${progress}%`}
            </span>
          </span>
          {behind ? (
            <Badge tone="caution" icon="shield">
              Active · {status}
            </Badge>
          ) : (
            <Badge tone="positive" icon="check-c">
              Active
            </Badge>
          )}
          {words ? <Caption className="ml-auto">{words}</Caption> : null}
        </div>
        {progress === null ? null : <Meter pct={progress} thick label={`Remediation, ${of}`} />}
      </div>
      <div className="flex flex-wrap gap-2">
        {links.map((l) =>
          l.href ? (
            <a
              key={l.label}
              href={l.href}
              // A live link, so its outline is a control outline: `border-line`
              // is 1.44:1 against the surface behind it, short of WCAG
              // 1.4.11's 3:1; `border-line-strong` (3.93:1) is what
              // lib/design/tokens.ts reserves for exactly this (accessibility,
              // cycle 19, BLOCKING F4).
              className="inline-flex h-7 items-center gap-1.5 rounded-sm border border-line-strong px-2.5 text-sm font-medium text-ink"
            >
              {l.label} <Icon name="external" small />
            </a>
          ) : (
            <span
              key={l.label}
              className="inline-flex h-7 items-center gap-1.5 rounded-sm border border-dashed border-quiet-line px-2.5 text-sm text-quiet-ink"
            >
              {l.label} · not on file
            </span>
          ),
        )}
      </div>
    </div>
  );
}

/**
 * The Sources section (REZ-C §3.3): one row per register that filed a record
 * for this company, best rank first, with its tier in words, the reference it
 * filed and the date it was read. The register's own page is the link where
 * the record carries one — a brand's disclosure list is not a page about this
 * company, and `sourceMark` already refuses to link one as though it were.
 */
export function SourcesList({ rows }: { rows: readonly SourceRow[] }) {
  return (
    <ul className="flex flex-col">
      {rows.map((r) => (
        <li key={r.mark.code} className="flex items-start gap-3 border-t border-line-subtle py-2 first:border-t-0">
          <SourceMark mark={r.mark} lg />
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <Label className="text-ink-strong">{r.name}</Label>
            <Caption>
              {r.tier}
              {r.ref ? " · " : ""}
              {r.ref ? <Code>{r.ref}</Code> : null}
            </Caption>
          </span>
          {/* A register the record names but that has filed no `source_records`
              row has no read to report. "read date not on file" claimed there
              was a read whose date we lost; "no record read" is the fact. */}
          <Caption className="shrink-0 pt-0.5 sm:whitespace-nowrap">{r.readDate ? `read ${r.readDate}` : "no record read"}</Caption>
        </li>
      ))}
    </ul>
  );
}

/**
 * The Locations section (REZ-C §3.3): one row per PREMISES. The registers
 * write the same place several ways, so the other spellings are named under
 * the row rather than dropped — dropping them turns nine filed addresses into
 * seven premises with no account of the other two.
 */
export function LocationsList({ rows }: { rows: readonly LocationRow[] }) {
  return (
    <ul className="flex flex-col">
      {rows.map((r, i) => (
        <li key={`${r.address}-${i}`} className="flex items-start gap-3 border-t border-line-subtle py-2.5 first:border-t-0">
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <Eyebrow>{r.kind}</Eyebrow>
            <span className="whitespace-pre-line text-base leading-[22px] text-ink [overflow-wrap:anywhere]">{r.address}</span>
            {r.alsoRecordedAs.length > 0 ? (
              <Caption>Also recorded as: {r.alsoRecordedAs.join(" · ")}</Caption>
            ) : null}
          </span>
          <span className="inline-flex shrink-0 items-center gap-1.5 pt-1">
            {r.marks.map((m) => (
              <SourceMark key={m.code} mark={m} sm />
            ))}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** The Facilities section: one row per extension building. */
export function FacilitiesList({ rows }: { rows: readonly FacilityRowModel[] }) {
  return (
    <ul className="flex flex-col" data-facilities="true">
      {rows.map((r, i) => (
        <li key={`${r.name}-${i}`} className="flex flex-col gap-0.5 border-t border-line-subtle py-2.5 first:border-t-0">
          <span className="text-base font-medium leading-[22px] text-ink-strong [overflow-wrap:anywhere]">{r.name}</span>
          {r.address ? <span className="whitespace-pre-line text-sm text-ink [overflow-wrap:anywhere]">{r.address}</span> : null}
          {r.workers ? <Caption>{r.workers}</Caption> : null}
        </li>
      ))}
    </ul>
  );
}

/** The RFQs section (REZ-C §3.3): the calling buyer's own RFQs naming this record. */
export function RecordRfqList({ rows }: { rows: readonly RecordRfqRow[] }) {
  return (
    <ul className="flex flex-col">
      {rows.map((r) => (
        <li key={r.id} className="flex items-center gap-3 border-t border-line-subtle py-2 first:border-t-0">
          <a href={r.href} className="min-w-0 flex-1 truncate text-base font-medium text-brand-ink">
            {r.title}
          </a>
          {r.quantity ? <Caption className="shrink-0 tabular-nums">{r.quantity}</Caption> : null}
          <Badge tone={r.status.tone}>{r.status.label}</Badge>
          <Caption className="w-[9rem] shrink-0 text-right">
            {[r.sent ? `sent ${r.sent}` : null, r.shipBy ? `ship by ${r.shipBy}` : null].filter(Boolean).join(" · ") || "—"}
          </Caption>
        </li>
      ))}
    </ul>
  );
}

/**
 * The watchlist entries behind the sanction banner: which list, which name it
 * matched, the entry reference, when it was screened, and a link to the entry.
 * The banner makes the claim; this is the receipt for it.
 */
export function SanctionEvidence({ rows }: { rows: readonly SanctionRow[] }) {
  return (
    <ul className="flex flex-col">
      {rows.map((r, i) => (
        <li key={`${r.list}-${r.ref ?? i}`} className="flex flex-col gap-0.5 border-t border-line-subtle py-2.5 first:border-t-0">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <Label className="text-ink-strong">{r.list}</Label>
            {r.ref ? <Code className="text-ink">{r.ref}</Code> : null}
            {r.href ? (
              <a href={r.href} className="ml-auto inline-flex items-center gap-0.5 text-sm font-medium text-brand-ink">
                {r.opens === "entry" ? "Entry" : "The list"} <Icon name="external" small />
              </a>
            ) : null}
          </div>
          <span className="text-base leading-[22px] text-ink [overflow-wrap:anywhere]">Matched “{r.matchedName}”</span>
          <Caption>
            {[r.listedOn ? `listed ${r.listedOn}` : null, r.screenedOn ? `screened ${r.screenedOn}` : "screening date not on file"]
              .filter(Boolean)
              .join(" · ")}
          </Caption>
        </li>
      ))}
    </ul>
  );
}

/**
 * What the overlay shows when the record could not be opened.
 *
 * Silence is not an answer: the URL still says `?record=<slug>`, so a buyer
 * who clicked a result and got nothing cannot tell a slow read from a wrong
 * link. The full page already distinguishes these; the overlay now does too.
 */
export function SheetNotice({
  title,
  body,
  action,
  closeHref,
}: {
  title: string;
  body: string;
  action?: { label: string; href: string } | null;
  closeHref?: string | null;
}) {
  return (
    <Sheet label="Supplier record">
      <SheetBar>
        {closeHref ? (
          <Button variant="ghost" icon aria-label="Close" href={closeHref} clientNav scroll={false}>
            <Icon name="x" />
          </Button>
        ) : null}
        <Label className="text-ink-strong">Supplier record</Label>
      </SheetBar>
      <SheetScroll>
        <div className="flex flex-col items-start gap-3 px-6 py-8">
          <Heading level="sm" as="h2">
            {title}
          </Heading>
          <p className="m-0 max-w-prose text-base text-ink-muted">{body}</p>
          {action ? (
            <Button href={action.href} clientNav scroll={false}>
              {action.label}
            </Button>
          ) : null}
        </div>
      </SheetScroll>
    </Sheet>
  );
}

/**
 * The affiliation notice. Every surface that draws authority marks carries it:
 * the public profile and the marketing footer do, and the buyer record page did
 * until the kit replaced it. A page showing BGMEA, BKMEA, H&M and NEXT marks
 * has to say what they are and are not.
 */
export function AffiliationNote() {
  return (
    <p className="mx-auto max-w-prose px-6 py-5 text-center text-xs leading-5 text-ink-subtle">
      Authority logos identify the data sources we aggregate from. SourceBD is not affiliated with or endorsed by BGMEA,
      BKMEA, BTMA, EPB, OEKO-TEX, WRAP, GOTS, RSC, or any of the brands named on this page. Every fact traces to the
      issuing authority shown in Sources.
    </p>
  );
}

/** A section's quiet empty state: a dashed chip saying what is absent, never a bare "none". */
export function QuietEmpty({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex h-[26px] items-center rounded-sm border border-dashed border-quiet-line px-2.5 text-sm text-quiet-ink">
      {children}
    </span>
  );
}

/**
 * `.actbar`: the sticky frosted action bar. The caption is only made when
 * every mark on the sheet links to its register page.
 *
 * Send RFQ is a link when the record can receive one and a disabled button
 * when it cannot — a sanctioned record's control is dead in the UI AND the
 * server refuses it (`rfq_create` validates
 * `is_published = true and is_sanctioned = false`), because hiding UI is never
 * a security control.
 *
 * Compare has no page yet (`/app/compare` is deferred), so it stays an
 * explicitly disabled control that says so, rather than a live button that
 * does nothing.
 */
export function ActionBar({
  sanctioned,
  everyMarkLinks,
  rfqHref,
  save,
}: {
  sanctioned: boolean;
  everyMarkLinks: boolean;
  rfqHref?: string | null;
  /** The real Save control, when the caller has a session to save into. */
  save?: ReactNode;
}) {
  return (
    // Wraps: three large controls plus the caption come to ~560px, which at
    // 320px pushed the caption off the sheet entirely.
    <div className="glass flex shrink-0 flex-wrap items-center gap-2 border-t border-line-subtle px-6 py-3">
      <Button variant="primary" lg disabled={sanctioned} href={sanctioned ? undefined : (rfqHref ?? undefined)}>
        <Icon name="send" /> Send RFQ
      </Button>
      {save ?? (
        <Button lg disabled title="Saving a record needs a signed-in account">
          <Icon name="bookmark" /> Save
        </Button>
      )}
      <Button lg disabled title="Comparing records arrives with the compare page">
        <Icon name="compare" /> Compare
      </Button>
      {/* A brand disclosure list is one file listing every supplier on it, so
          a tier-4 mark never opens a page about this record — its own
          accessible name says "opens the disclosure list". The absolute
          sentence contradicted that on ~43 published records, so it is made
          only when every mark that links opens a record page. */}
      <Caption className="ml-auto">
        {everyMarkLinks ? "Every source mark links to its register page" : "Source marks link to their register page where one is on file"}
      </Caption>
    </div>
  );
}

/**
 * The full-width sanction banner under the bar of a sanctioned record — on
 * every tab. `data-sanction-visible` is what a guard asserts: spec §2 says the
 * warning "cannot be hidden by layout", and every assertion about it used to
 * match on its text, which an `sr-only` class leaves in place.
 */
export function SanctionBanner({ sample, evidenceHref }: { sample?: boolean; evidenceHref?: string | null }) {
  return (
    <div data-sanction-visible="true" role="alert" className="flex flex-wrap items-center gap-x-2 gap-y-1 bg-sanction px-6 py-2.5 text-sm font-medium text-sanction-on">
      <Icon name="warn" />
      Sanctioned{sample ? " · sample record" : ""} — matched on a sanctions screen. RFQs cannot be sent to this supplier.
      {/* The claim has to lead somewhere. Without this the banner asserted a
          match and evidenced nothing, while the page it replaced named the
          list, the matched name and the entry. */}
      {evidenceHref ? (
        <a href={evidenceHref} className="ml-auto underline">
          See the matches
        </a>
      ) : null}
    </div>
  );
}
