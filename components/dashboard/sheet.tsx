// Sheet primitives (REZ-A, artifact SupplierSheet README): the record's frame
// (a pane beside the results, or the full page) with its 52px bar, tabs with
// mono counts, sections, the FactsPanel (28px rows, label 150px, a mark at
// the row's end), the locked contact card, the stats line, the
// certificate card, the RSC block and the sticky frosted action bar. `Stage`
// and `Scrim` remain for the gallery's RFQ composer, which is still a dialog.

import { Fragment, type ReactNode } from "react";
import { certStateLabel, rscStatusNeedsLook, type CertModel } from "@/lib/dashboard/facts";
import type { FacilityRowModel, FactRow, LocationRow, RecordRfqRow, SanctionRow, SourceRow } from "@/lib/dashboard/models";
import { recordPage, sourceMark } from "@/lib/dashboard/source-tiers";
import { cn } from "@/lib/utils";
import { Badge } from "./chips";
import { DialogFocus } from "./dialog-focus";
import { Button, Meter } from "./controls";
import { Icon } from "./icons";
import { SourceMark } from "./marks";
import { SbIcon, type SbIconName } from "./sb-icons";
import { Caption, Code, Heading, Label, OneLine } from "./type";

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
 *
 * Half the region, not 55%: at 1280 the 55% pane left the results 424px, the
 * supplier column 132px of it, and a name like "Benchmark Apparels" broke
 * mid-word (founder's video, 29 Sep 2026). At half, with the 16px gutter
 * beside a pane, the compact table is 492px and the name column 194px.
 */
export function RecordPane({
  closeHref,
  openKey = "",
  wide = false,
  children,
}: {
  closeHref?: string | null;
  /** What the pane is showing (record, line or notice); focus moves to it whenever that changes. */
  openKey?: string;
  /** The composer: it carries the targets, the fields and the preview side by side, so it takes the region beside the results' slim rail (`ResultsColumn rail`). */
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      data-open-key={openKey}
      data-pane-wide={wide ? "true" : undefined}
      className={cn(
        "flex min-h-0 min-w-0 flex-1 flex-col border-line lg:flex-none lg:border-l",
        // Wide: the results step aside to an 18rem rail and the composer takes
        // the rest; at 68% it crushed the table to 28rem (founder's video,
        // 29 Sep 2026).
        wide ? "lg:flex-1" : "lg:w-[clamp(480px,50%,760px)]",
      )}
    >
      {closeHref ? <DialogFocus closeHref={closeHref} openKey={openKey} /> : null}
      {/* Keyed by what it shows: opening another order, RFQ or record beside the
          list is a client navigation into the same tree, and without the key a
          form inside (the order editor, the composer) kept the previous item's
          state while its id prop changed underneath it. */}
      <Fragment key={openKey}>{children}</Fragment>
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
export function ResultsColumn({ besideRecord = false, rail = false, children }: { besideRecord?: boolean; rail?: boolean; children: ReactNode }) {
  // The gutter is on an inner box, not on the scroll region itself. A sticky
  // table header sticks to the scroll region's padding edge, so with the
  // 24px gutter on the region the header stopped 24px below the topbar and
  // the rows scrolling up showed through the gap above it (founder's
  // walkthrough, 28 Sep 2026). Padded inside, the header meets the top edge.
  // Beside a pane the gutter is 16px: every pixel of it is the supplier
  // column's (see `RecordPane`).
  // `rail`: beside the RFQ composer the results are a slim column of names,
  // still tickable, rather than a crushed table.
  return (
    <div className={cn("flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto", besideRecord && "hidden lg:flex", rail && "lg:w-[18rem] lg:flex-none")}>
      <div className={cn("flex flex-col gap-4 p-4 sm:p-6", besideRecord && "lg:p-4")}>{children}</div>
    </div>
  );
}

/**
 * The frame of every page with a list and a pane beside it (the search, Saved,
 * orders, RFQs): a column below `lg`, side by side from it.
 *
 * `overflow-clip` from `lg`: nothing in the frame may scroll it. `hidden` only
 * stops a person scrolling — a followed fragment, a `scrollIntoView` or a
 * focus call still scrolls a hidden box, and that is how a record tab slid
 * the whole search off the top of the screen (founder's video, 29 Sep 2026).
 * The list and the pane each scroll themselves. `relative` holds the
 * `.sr-only` spans inside it, which are absolutely placed and otherwise
 * stretched the shell's scroll area from a row far down a long record.
 */
export function Workbench({ children }: { children: ReactNode }) {
  return <div className="relative flex min-h-0 flex-1 flex-col lg:flex-row lg:overflow-clip">{children}</div>;
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

export { SheetTabs } from "./sheet-tabs";

/**
 * `.sec`: a section with its heading row. `collapsible` folds it behind its
 * heading (open by default, so a tab link still lands on its content); the
 * long sections of a record — Sources, Locations, Facilities, RFQs — fold so a
 * buyer can shorten a 3,000px record to the parts they are reading.
 *
 * `scroll-mt-12` keeps a plain fragment jump (the sanction banner's "See the
 * matches", a shared `#…` link) from landing the heading under the 48px
 * sticky tabs; a tab click moves focus here itself (`goToSection`).
 */
export function SheetSection({
  id,
  title,
  icon,
  caption,
  action,
  collapsible = false,
  children,
}: {
  id?: string;
  title?: string;
  /** SourceBD's icon for what the section holds, slate, before its title. */
  icon?: SbIconName;
  caption?: ReactNode;
  action?: ReactNode;
  collapsible?: boolean;
  children: ReactNode;
}) {
  if (collapsible && title) {
    return (
      <details id={id} open className="group/sec scroll-mt-12 border-b border-line-subtle px-6 py-5 outline-none">
        <summary className="flex cursor-pointer list-none flex-wrap items-baseline gap-x-2 gap-y-1 [&::-webkit-details-marker]:hidden">
          <Icon name="caret" small className="mr-0.5 self-center text-ink-subtle transition-transform duration-fast group-open/sec:rotate-180" />
          <Heading level="sm" as="h2" className="flex-1">
            {title}
          </Heading>
          {caption ? <Caption>{caption}</Caption> : null}
          {action ? <span className="ml-auto text-sm font-medium">{action}</span> : null}
        </summary>
        <div className="mt-4 flex flex-col gap-4">{children}</div>
      </details>
    );
  }
  return (
    <section id={id} className="flex scroll-mt-12 flex-col gap-4 border-b border-line-subtle px-6 py-5 outline-none">
      {title ? (
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          {icon ? <SbIcon name={icon} size={18} className="self-center text-accent" /> : null}
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

/**
 * A fact with no per-field mark yet: a dashed empty square in the mark's own
 * column, named for a screen reader and on hover. It used to be the words
 * "source pending" on nine rows of every record, the loudest text in the
 * column meant for the quietest thing (founder's walkthrough, 28 Sep 2026:
 * "really text heavy … icons scattered"). The legend under the facts says
 * once what the square means.
 */
export function PendingMark() {
  // SourceBD's own mark (a document with a clock): the dashed square read as
  // a tick box (founder's video, 29 Sep 2026).
  return (
    <span title="Source pending: the register that filed this is not linked per fact yet" className="inline-flex shrink-0 text-quiet-ink">
      <SbIcon name="pending" label="Source pending" />
    </span>
  );
}

/** A filed block with the same line twice in a row ("…Kaliakoir\nGazipur\nGazipur") reads it once. */
export function collapseRepeatedLines(text: string): string {
  const out: string[] = [];
  for (const line of text.split("\n")) {
    const key = line.trim().toLowerCase();
    if (key && out.length > 0 && out[out.length - 1]!.trim().toLowerCase() === key) continue;
    out.push(line);
  }
  return out.join("\n");
}

/** What the pending mark means, said once under the facts it marks (and in full on its hover). */
export const PENDING_LEGEND = "Source pending";

/**
 * `.fp`: the facts panel. Every row has room for a mark, in one column at the
 * row's end; a missing value reads "Not on file". A row that is a list (the
 * registers) sets each item on its own line with its own mark beside it.
 */
export function FactsPanel({ rows, legend = true }: { rows: readonly FactRow[]; legend?: boolean }) {
  const pending = rows.some((r) => r.value !== null && r.pendingSource && !(r.marks && r.marks.length > 0));
  return (
    <div className="flex flex-col">
      {rows.map((r) => (
        // Stacks below `sm`. Side by side, a 150px label plus the trailing
        // mark column left the value about 75px on a 375px screen.
        <div
          key={r.label}
          className="flex min-h-fact-row flex-col gap-0.5 border-t border-line-subtle py-1.5 first:border-t-0 sm:flex-row sm:items-start sm:gap-4"
        >
          {/* Three levels (founder, 29 Sep 2026: "the text needs visual and
              color hierarchy and icons"): the group heading, this label in
              ink-muted with its slate icon, the value in ink-strong. Slate is
              the one colour; status hues stay on status. */}
          <span className="inline-flex w-full shrink-0 items-center gap-2 text-sm leading-[22px] text-ink-muted sm:w-[150px]">
            {r.icon ? <SbIcon name={r.icon} className="text-accent" /> : null}
            {r.label}
          </span>
          {r.items && r.items.length > 0 ? (
            <ul className="m-0 flex min-w-0 flex-1 list-none flex-col gap-1 p-0">
              {r.items.map((it, i) => (
                <li key={`${it.label}-${it.code ?? ""}-${i}`} className="flex min-w-0 items-center gap-2 leading-[22px]">
                  {it.mark ? <SourceMark mark={it.mark} sm /> : <PendingMark />}
                  <span className="text-base text-ink">{it.label}</span>
                  {it.code ? <Code className="text-ink-strong [overflow-wrap:anywhere]">{it.code}</Code> : null}
                </li>
              ))}
            </ul>
          ) : (
            <span
              className={cn(
                // 4,596 of 10,266 published records file `address_raw` as a
                // newline-delimited block; `pre-line` shows the lines the
                // register filed and still collapses runs of spaces.
                "min-w-0 flex-1 whitespace-pre-line text-base leading-[22px] text-ink-strong [overflow-wrap:anywhere]",
                r.lead && r.value !== null && "font-medium",
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
                collapseRepeatedLines(r.value)
              )}
              {r.value !== null && r.note ? <span className="ml-1.5 text-sm font-normal text-ink-subtle">{r.note}</span> : null}
              {r.badge ? (
                <Badge tone={r.badge.tone} className="ml-1.5 align-middle">
                  {r.badge.label}
                </Badge>
              ) : null}
            </span>
          )}
          {r.items && r.items.length > 0 ? null : (
            <span className="inline-flex shrink-0 flex-wrap items-center justify-end gap-1 sm:min-w-[20px] sm:pt-[3px]">
              {r.marks && r.marks.length > 0 ? (
                r.marks.map((m) => <SourceMark key={m.code} mark={m} sm />)
              ) : r.value === null && r.checked ? (
                // What was checked ("registers and RSC checked") on hover and
                // to a screen reader: printed, it was the loudest text on an
                // empty row (founder's video, 29 Sep 2026).
                <span title={`Not on file · ${r.checked}`} className="inline-flex text-quiet-ink">
                  {/* A magnifier (looked), never a tick: a tick is the sign for a verified fact. */}
                  <Icon name="search" small />
                  <span className="sr-only">{r.checked}</span>
                </span>
              ) : r.pendingSource ? (
                <PendingMark />
              ) : null}
            </span>
          )}
        </div>
      ))}
      {pending && legend ? <FactsLegend /> : null}
    </div>
  );
}

export function FactsLegend() {
  return (
    <Caption className="mt-3 inline-flex items-center gap-2">
      <PendingMark />
      {PENDING_LEGEND}
    </Caption>
  );
}

/**
 * `.lockcard`: the contact block, locked by default, on the plain locked ground. Never blurred.
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
  counts,
  sanctioned = false,
}: {
  hidden: string;
  plan: string | null;
  held?: string | null;
  /** The counts themselves, drawn as rows (email, phone, website, contact person); `held` is the fallback sentence. */
  counts?: { emails: number; phones: number; representatives: number; website: boolean } | null;
  /** A sanctioned record takes no RFQ, so the card must not offer one. */
  sanctioned?: boolean;
}) {
  const rows = counts
    ? [
        { label: "Email", icon: "email" as const, value: counts.emails === 0 ? "none on file" : `${counts.emails} on file` },
        { label: "Phone", icon: "phone" as const, value: counts.phones === 0 ? "none on file" : `${counts.phones} on file` },
        { label: "Website", icon: "website" as const, value: counts.website ? "on file" : "none on file" },
        { label: "Contact person", icon: "person" as const, value: counts.representatives === 0 ? "none on file" : `${counts.representatives} on file` },
      ]
    : null;
  // A strip across the record, not a 300px box beside the facts: beside the
  // facts it squeezed every value into a thin column on a wide display
  // (founder's walkthrough, 28 Sep 2026 — "this contact details is big, I
  // won't accept it"). Plain, not striped (29 Sep 2026: the stripes went).
  return (
    <div data-locked="true" className="flex flex-col gap-1.5 rounded-md border border-locked-line bg-locked px-4 py-2.5 text-locked-ink">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
        <Label className="inline-flex items-center gap-1.5 text-ink-strong">
          <Icon name="lock" /> Contact details{plan ? ` · ${plan}` : ""}
        </Label>
        {rows ? (
          <dl data-contact-counts="true" className="m-0 flex flex-wrap gap-x-4 gap-y-1 text-xs">
            {rows.map((r) => (
              <div key={r.label} className="inline-flex items-center gap-1">
                <dt className="inline-flex items-center gap-1.5 font-medium text-ink-strong">
                  <SbIcon name={r.icon} size={14} className="text-accent" />
                  {r.label}
                </dt>
                <dd className="m-0 text-ink-muted">{r.value}</dd>
              </div>
            ))}
          </dl>
        ) : held ? (
          <span data-contact-counts="true" className="text-xs text-ink-muted">
            {held}
          </span>
        ) : null}
      </div>
      {/* No promise about delivery: the RPC does not say whether this record
          has been claimed. No "See plans": no plan unlocks contact details on
          the record (founder, 25 Sep). */}
      <span className="text-xs">
        {hidden} <span className="text-ink-muted">{sanctioned ? "RFQs cannot be sent to this supplier." : "Send an RFQ from the record instead."}</span>
      </span>
    </div>
  );
}

/**
 * `.stats`: the section's figures as label and value rows, two across. They
 * were four boxes of a 24px number each; three held one line and one five,
 * and the boxes took a screen's height for four numbers (founder's video,
 * 29 Sep 2026).
 */
export function Stats({ items }: { items: readonly { key: string; value: string; sub: string | null }[] }) {
  return (
    <dl className="m-0 grid gap-x-8 sm:grid-cols-2">
      {items.map((s) => (
        <div key={s.key} className="flex min-w-0 items-baseline gap-3 border-t border-line-subtle py-1.5">
          <dt className="w-[7.5rem] shrink-0 text-sm text-ink-muted">{s.key}</dt>
          <dd className="m-0 min-w-0 flex-1 [overflow-wrap:anywhere]">
            {/* A figure with nothing on file is a dash; why ("not on the EPB
                list") is on its hover and read to a screen reader, not
                printed under every empty figure. */}
            {s.value === "—" && s.sub ? (
              <span title={s.sub} className="text-base text-quiet-ink">
                —<span className="sr-only"> {s.sub}</span>
              </span>
            ) : (
              <>
                <span className="text-base font-medium text-ink-strong">{s.value}</span>
                {s.sub ? <Caption className="ml-1.5">{s.sub}</Caption> : null}
              </>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

const CERT_BADGE_TONE = { valid: "positive", expiring: "caution", expired: "caution", "no-expiry": "type" } as const;
const CERT_BADGE_ICON = { valid: "check-c", expiring: "clock", expired: "warn", "no-expiry": undefined } as const;

/**
 * One certificate, one line (founder's review, 29 Sep 2026: "certification
 * section very text heavy"): its mark, the scheme, the number, the certifier
 * (cut first when the line is short), then the state and the certificate
 * itself at the line's end. The scope is one click away, behind "Scope"; only
 * words that repeat the certificate's own name are left out of it.
 */
export function CertRow({ cert }: { cert: CertModel }) {
  // The certificate document IS this certificate's register page. Passing it
  // through `sourceMark` (which filters anything that is not a record page)
  // makes the square link where every other square on the sheet links.
  const mark = sourceMark(cert.markCode, cert.documentUrl);
  const scope = certScopeRows(cert);
  // All seven SA8000 certificates in production carry the SA8000 search form
  // as their document, which `recordPage` rejects: no link rather than a link
  // that promises the certificate and delivers a search page.
  const doc = recordPage(cert.documentUrl) ? cert.documentUrl : null;
  return (
    <li className="border-t border-line-subtle first:border-t-0" data-cert={cert.kind}>
      {/* One line from `sm`, the certifier giving way first; on a phone the
          state and the link drop under the name rather than off the screen. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 sm:flex-nowrap">
        <span className="flex min-w-0 flex-1 basis-[15rem] items-center gap-2.5 sm:basis-auto">
          <SourceMark mark={mark} />
          <span className="shrink-0 text-base font-medium text-ink-strong">{cert.scheme}</span>
          {cert.number ? <Code className="shrink-0 text-ink-muted">{cert.number}</Code> : <span className="shrink-0 text-sm text-ink-subtle">no number</span>}
          {cert.issuer ? (
            <span data-name="" title={cert.issuer} className="min-w-0 truncate text-sm text-ink-subtle">
              {cert.issuer}
            </span>
          ) : null}
        </span>
        <span className="ml-auto inline-flex shrink-0 items-center gap-1">
          <Badge tone={CERT_BADGE_TONE[cert.state]} icon={CERT_BADGE_ICON[cert.state]}>
            {certStateLabel(cert)}
          </Badge>
          {doc ? (
            <Button variant="ghost" icon size="sm" href={doc} aria-label={`Open the ${cert.scheme} certificate${cert.number ? ` ${cert.number}` : ""}`} title="Open the certificate">
              <Icon name="external" />
            </Button>
          ) : null}
        </span>
      </div>
      {scope.length > 0 ? (
        <details className="group/scope -mt-1 pb-2 pl-[30px]">
          <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded-xs text-sm text-ink-muted hover:text-ink-strong [&::-webkit-details-marker]:hidden">
            Scope
            <span className="sr-only">
              {" "}
              of {cert.scheme}
              {cert.number ? ` ${cert.number}` : ""}
            </span>
            <Icon name="caret" small className="transition-transform duration-fast group-open/scope:rotate-180" />
          </summary>
          <CertScope rows={scope} />
        </details>
      ) : null}
    </li>
  );
}

/**
 * A certificate's scope, as the register filed it, made readable: the
 * registers write it as `Operations: Dyeing, Knitting | Products: Men's
 * apparel`, one run-on string, which on a GOTS card ran to eight lines. Each
 * `|`-separated part becomes a row with its own label; a part with no label
 * keeps the word "Scope". The words are the register's; only the layout is
 * ours.
 */
export function parseCertScope(scope: string): { label: string; value: string }[] {
  return scope
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const m = /^([A-Za-z][A-Za-z ]{1,30}):\s*(.+)$/.exec(part);
      return m ? { label: m[1]!.trim(), value: m[2]!.trim() } : { label: "Scope", value: part };
    });
}

/**
 * The scope rows worth a click: a part that only repeats the certificate's own
 * name goes (OEKO-TEX's "OEKO-TEX STANDARD 100" under "OEKO-TEX Standard 100",
 * WRAP Gold's "Gold"); anything that says more stays, word for word.
 */
export function certScopeRows(cert: Pick<CertModel, "scheme" | "scope">): { label: string; value: string }[] {
  const bare = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const scheme = bare(cert.scheme);
  // Only an unlabelled part can be a bare repeat of the name; a labelled one
  // ("Products: …") is a field of its own, whatever its words.
  return cert.scope ? parseCertScope(cert.scope).filter((r) => !(r.label === "Scope" && bare(r.value) && scheme.includes(bare(r.value)))) : [];
}

function CertScope({ rows }: { rows: readonly { label: string; value: string }[] }) {
  return (
    <dl className="m-0 mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm">
      {rows.map((r, i) => (
        <div key={`${r.label}-${i}`} className="contents">
          <dt className="text-ink-muted">{r.label}</dt>
          <dd className="m-0 text-ink [overflow-wrap:anywhere]">{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Certificates as a list, one line each; two of one scheme stay two rows (two numbers). */
export function CertList({ certs }: { certs: readonly CertModel[] }) {
  return (
    <ul className="m-0 flex list-none flex-col p-0" data-cert-list="">
      {certs.map((c) => (
        <CertRow key={`${c.kind}-${c.number ?? c.expiresOn ?? ""}`} cert={c} />
      ))}
    </ul>
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
          {/* The address pin, slate, as on the Overview's "Factory address". */}
          <SbIcon name="address" className="mt-[3px] text-accent" />
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-sm text-ink-muted">{r.kind}</span>
            <span className="whitespace-pre-line text-base leading-[22px] text-ink-strong [overflow-wrap:anywhere]">{r.address}</span>
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
          {/* A building's name, one line like a company's (the One-Line Name Rule). */}
          <OneLine text={r.name} className="text-base font-medium leading-[22px] text-ink-strong" />
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
  label = "Supplier record",
}: {
  title: string;
  body: string;
  action?: { label: string; href: string } | null;
  closeHref?: string | null;
  /** What the pane was opening: "Supplier record", "Order", "RFQ". */
  label?: string;
}) {
  return (
    <Sheet label={label}>
      <SheetBar>
        {closeHref ? (
          <Button variant="ghost" icon aria-label="Close" href={closeHref} clientNav scroll={false}>
            <Icon name="x" />
          </Button>
        ) : null}
        <Label className="text-ink-strong">{label}</Label>
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
  rfqHref,
  save,
}: {
  sanctioned: boolean;
  rfqHref?: string | null;
  /** The real Save control, when the caller has a session to save into. */
  save?: ReactNode;
}) {
  return (
    // Wraps: three large controls plus the caption come to ~560px, which at
    // 320px pushed the caption off the sheet entirely.
    // No Compare until /app/compare exists: a disabled control that explains
    // itself only on hover is a live-looking button that does nothing.
    <div className="glass flex shrink-0 flex-wrap items-center gap-2 border-t border-line-subtle px-6 py-3">
      <Button variant="primary" lg disabled={sanctioned} href={sanctioned ? undefined : (rfqHref ?? undefined)} clientNav scroll={false}>
        <Icon name="send" /> Send RFQ
      </Button>
      {save ?? (
        <Button lg disabled title="Saving a record needs a signed-in account">
          <Icon name="bookmark" /> Save
        </Button>
      )}

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
