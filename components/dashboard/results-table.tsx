// ResultsTable: the ledger grid (enterprise pass, 27 Sep 2026, direction G1).
// One table for the search: 40px rows on a sticky header, columns with fixed
// roles, the name opening the record beside the results, the row that is
// open marked, numbers right-aligned and tabular, export lines as codes.
// Beside an open record the table narrows to its essential columns
// (`compact`) so the pane keeps its measure. Sanctioned: the reserved rule
// and the word under the name, Send RFQ withheld. Selected: the slate inset
// rule and the filled box.
//
// Founder's walkthrough, 28 Sep 2026: the row's Save, Open and RFQ appeared
// only under the pointer ("these buttons should not just show up when I
// mouse over"), and when they did they squeezed the name beside them onto
// three lines. They now have a column of their own at the row's end, always
// drawn, quiet (icon buttons in the ghost tier) so twenty-five rows of them
// do not shout; the text and the source marks are a step larger, and a
// certificate is one pill on one line with its state as an icon.
//
// Keyboard: a row is a focus stop. ↑/↓ (or j/k) move between rows, ↵ opens
// the record, Space selects, r sends an RFQ, s saves. Each key drives the
// row's own link or control, so the keyboard never diverges from the mouse.
//
// Client (REZ-B): the selection context, which only exists inside a
// `SelectionProvider`; outside one (the gallery) the checkbox stays inert.

"use client";

import { certStateLabel, type CertModel } from "@/lib/dashboard/facts";
import type { TableRowModel } from "@/lib/dashboard/models";
import Link from "next/link";
import type { KeyboardEvent } from "react";
import { cn } from "@/lib/utils";
import { Button, Checkbox } from "./controls";
import { Icon } from "./icons";
import { LinkPending } from "./link-pending";
import { LogoTile, SourceMarks } from "./marks";
import { HeadCell, rowClass, type SortDir } from "./page";
import { SaveRecordButton } from "./save-record-button";
import { SbIcon } from "./sb-icons";
import { useSelection } from "./selection";
import { WorkersCell } from "./workers-cell";

export type ResultsDensity = "compact" | "default" | "comfortable";

const ROW_H: Record<ResultsDensity, string> = { compact: "h-9", default: "h-10", comfortable: "h-12" };

/** The sortable columns, by the search's own sort keys (`lib/discover-v32-state.ts` SORTS). */
export type ResultsSortKey = "name" | "sources" | "cert_expiry" | "hs_lines" | "workers";

/**
 * Column widths in px, null for the supplier column that takes the rest:
 * select · supplier · registers & certifiers · certificates · export lines ·
 * workers · actions (wide); select · supplier · sources · workers · actions
 * beside a pane.
 *
 * Set from widths measured in Geist (29 Sep 2026), because the old ones
 * overlapped (founder's video): Workers gave 68px to a second line of up to
 * 118px ("11,119 with buildings"), which ran under the Save and RFQ icons; the
 * compact actions column gave two 28px buttons 48px; the registers column
 * could not hold its own header (119px with the caret) or three logo marks;
 * and beside a pane the supplier column fell to 132px, so a name broke
 * mid-word ("Benchmar k"). Now every column holds its content, and the
 * supplier column keeps at least 184px — the longest register word at 14px
 * ("MANUFACTURING", 120px) plus the tile, its gap and the padding — at the
 * table's minimum width (`RESULTS_MIN_WIDTH`), below which the region
 * scrolls sideways rather than crushing it.
 */
export const RESULTS_COLUMNS = {
  wide: [40, null, 160, 212, 112, 152, 104],
  compact: [36, null, 76, 112, 66],
  // Beside the RFQ composer: the box and the name.
  rail: [36, null],
} as const;

/** The table's minimum width in px: `min-w-[62rem]` and `min-w-[30rem]` on the table below. */
export const RESULTS_MIN_WIDTH = { wide: 992, compact: 480 } as const;

const CERT_TONE: Record<CertModel["state"], string> = {
  valid: "bg-positive-tint text-positive-ink",
  expiring: "bg-caution-tint text-caution-ink",
  expired: "bg-caution-tint text-caution-ink",
  "no-expiry": "bg-surface-sunken text-ink-muted",
};
const CERT_ICON = { valid: "check-c", expiring: "clock", expired: "warn", "no-expiry": "seal" } as const;

/**
 * One certificate in a row: the scheme, its state as an icon, and only the
 * words the icon cannot say ("17 d", "expired"). "WRAP Gold valid" set as a
 * wrapping chip broke onto two lines in every row (founder's walkthrough).
 * Never wraps; the full state is in its accessible name and title.
 */
export function CertPill({ cert }: { cert: CertModel }) {
  const words = certStateLabel(cert);
  const suffix = cert.state === "expiring" && cert.daysLeft !== null ? `${cert.daysLeft} d` : cert.state === "expired" ? "expired" : null;
  return (
    <span
      className={cn("inline-flex h-6 shrink-0 items-center gap-1 whitespace-nowrap rounded-sm px-1.5 text-sm font-medium", CERT_TONE[cert.state])}
      title={`${cert.scheme} · ${words}`}
      aria-label={`${cert.scheme}, ${words}`}
    >
      <Icon name={CERT_ICON[cert.state]} small />
      {cert.scheme}
      {suffix ? <span className="font-normal">{suffix}</span> : null}
    </span>
  );
}

export function ResultsTable({
  rows,
  currentSlug = null,
  compact = false,
  rail = false,
  density = "default",
  sort,
  sortHrefs,
}: {
  rows: readonly TableRowModel[];
  /** The record open beside the results, so its row is marked. */
  currentSlug?: string | null;
  /** Beside an open record: Supplier, Sources and Workers only. */
  compact?: boolean;
  /** Beside the RFQ composer: the box and the name only, so a buyer can still tick suppliers into the RFQ. */
  rail?: boolean;
  density?: ResultsDensity;
  /** The active sort, for the header arrow. */
  sort?: { key: string; dir: SortDir } | null;
  /** The URL that orders the list by each column. Strings, not a function:
   *  this is a client component and the search page renders it from the
   *  server, where a function prop crashes the whole page. */
  sortHrefs?: Record<ResultsSortKey, string>;
}) {
  const sel = useSelection();
  const head = (key: ResultsSortKey, label: string, align: "left" | "right" = "left", className?: string) => (
    <HeadCell
      align={align}
      className={className}
      sort={sortHrefs ? { href: sortHrefs[key], active: sort?.key === key, dir: sort?.dir } : undefined}
    >
      {label}
    </HeadCell>
  );
  const h = ROW_H[density];
  // Beside a pane the column is the count and the best mark; the count says
  // how many more there are, so no "+N" beside it.
  const marksShown = compact ? 1 : 3;
  return (
    <div
      // `relative`: `.sr-only` is position:absolute, and without a containing
      // block here the per-row status spans escaped the scroll clip and
      // widened the whole page to the table's width (WCAG 1.4.10). Below `xl`
      // the table scrolls sideways in this region; from `xl` it fits and the
      // header sticks to the results column's own scroll.
      className={cn("relative", rail ? "" : compact ? "overflow-x-auto" : "max-xl:overflow-x-auto")}
      tabIndex={0}
      role="region"
      aria-label="Results table"
    >
      <table
        className={cn(
          "w-full table-fixed border-collapse text-base",
          rail ? "" : compact ? "min-w-[30rem]" : "min-w-[62rem]",
          !compact && "[&_thead_th]:xl:sticky [&_thead_th]:xl:top-0 [&_thead_th]:xl:z-10",
        )}
      >
        {/* The widths are `RESULTS_COLUMNS`; the loading skeleton draws the same grid. */}
        <colgroup>
          {(rail ? RESULTS_COLUMNS.rail : compact ? RESULTS_COLUMNS.compact : RESULTS_COLUMNS.wide).map((w, i) => (
            <col key={i} style={w === null ? undefined : { width: w }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <HeadCell className="px-2">
              <span className="sr-only">Select</span>
            </HeadCell>
            {head("name", "Supplier", "left", "px-3")}
            {/* "Registers & certifiers" is 119px with its caret; beside a pane
                the column is 76px, and the record calls them sources too. */}
            {rail ? null : head("sources", compact ? "Sources" : "Registers & certifiers", "left", compact ? "px-2" : "px-3")}
            {compact ? null : head("cert_expiry", "Certificates", "left", "px-3")}
            {compact ? null : head("hs_lines", "Export lines", "left", "px-3")}
            {rail ? null : head("workers", "Workers", "right", "px-3")}
            {rail ? null : (
              <HeadCell className={compact ? "px-1" : "px-2"}>
                <span className="sr-only">Actions</span>
              </HeadCell>
            )}
          </tr>
        </thead>
        <tbody onKeyDown={onRowKey} className="[&>tr:last-child>*]:border-b-0">
          {rows.map((r) => {
            const selectable = sel.interactive && Boolean(r.supplierId);
            const selected = selectable ? sel.isSelected(r.supplierId!) : Boolean(r.selected);
            const current = currentSlug !== null && r.slug === currentSlug;
            const recordHref = r.recordHref ?? `/app/suppliers/${r.slug}`;
            return (
              <tr
                key={r.slug}
                tabIndex={0}
                aria-label={r.name}
                aria-current={current ? "true" : undefined}
                data-sanctioned={r.sanctioned ? "true" : undefined}
                data-row="result"
                className={rowClass({ current, selected, sanctioned: r.sanctioned, className: "outline-none focus-visible:bg-surface-sunken" })}
              >
                <td className={cn(h, "border-b border-line-subtle px-2 align-middle")}>
                  <Checkbox
                    on={selected}
                    label={`Select ${r.name}`}
                    onToggle={selectable ? () => sel.toggle(r.supplierId!) : undefined}
                    className="ml-1"
                  />
                </td>
                <th scope="row" className={cn(h, "border-b border-line-subtle px-3 py-1.5 text-left align-middle font-normal")}>
                  <div className={cn("flex min-w-0 items-center", compact ? "gap-2.5" : "gap-3")}>
                    <LogoTile initials={r.initials} tier={r.topTier} size={compact ? "sm" : "row"} />
                    <div className="min-w-0 flex-1">
                      {/* Wraps, never an ellipsis (the Wrapping Name Rule): a
                          company's name is the company's name, and a 125-character
                          one grows its row rather than losing its end. */}
                      <div className="[overflow-wrap:anywhere]">
                        {/* The name opens the record beside these results (§3.3), as a
                            client navigation that keeps the results and the selection.
                            Not in the rail beside the composer: opening a record there
                            replaced the composer and lost the draft; the box is the
                            action (tick it into the RFQ). */}
                        {rail ? (
                          <span className="font-medium text-ink-strong [overflow-wrap:anywhere]">{r.name}</span>
                        ) : (
                        <Link
                          prefetch={false}
                          scroll={false}
                          href={recordHref}
                          data-open="record"
                          className="font-medium text-ink-strong [overflow-wrap:anywhere] hover:text-brand-ink"
                        >
                          {r.name}
                          <LinkPending className="ml-1.5 inline-block align-[-1px] text-ink-subtle" />
                        </Link>
                        )}
                      </div>
                      {/* What kind of company and where, under the name, as on Saved:
                          a column of its own for the type cost the name its width. */}
                      <div className="text-sm text-ink-subtle [overflow-wrap:anywhere]">{[r.type, r.place].filter(Boolean).join(" · ")}</div>
                      {r.sanctioned ? (
                        <div className="inline-flex items-center gap-1 text-xs font-medium text-sanction-ink">
                          <Icon name="warn" small /> Sanctioned{r.sanctionSample ? " · sample" : ""}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </th>
                {rail ? null : (
                  <td className={cn(h, "border-b border-line-subtle align-middle", compact ? "px-2" : "px-3")}>
                    <span className="inline-flex items-center gap-2">
                      <span className="min-w-4 text-right font-mono text-sm font-medium text-ink-strong">{r.sourceCount}</span>
                      <SourceMarks marks={r.marks.slice(0, marksShown)} caption="none" className="flex-nowrap gap-1" />
                      {!compact && r.marks.length > marksShown ? <span className="text-sm text-ink-subtle">+{r.marks.length - marksShown}</span> : null}
                    </span>
                  </td>
                )}
                {compact ? null : (
                  <td className={cn(h, "border-b border-line-subtle px-3 align-middle")}>
                    {r.certs.length > 0 ? (
                      <span className="flex flex-wrap items-center gap-1 py-1">
                        {r.certs.slice(0, 2).map((c) => (
                          <CertPill key={`${c.kind}-${c.number ?? ""}`} cert={c} />
                        ))}
                        {r.certs.length > 2 ? <span className="text-sm text-ink-subtle">+{r.certs.length - 2}</span> : null}
                      </span>
                    ) : (
                      <span className="text-sm text-quiet-ink">{r.certsEmptyReason ?? "none on file"}</span>
                    )}
                  </td>
                )}
                {compact ? null : (
                  <td className={cn(h, "border-b border-line-subtle px-3 py-1 align-middle")}>
                    {r.totalLines > 0 ? (
                      <>
                        <span className="block font-mono text-sm font-medium text-ink-strong">{r.totalLines}</span>
                        <span className="block whitespace-nowrap font-mono text-xs text-ink-subtle">{r.photos.slice(0, 2).map((p) => p.hs).join(" · ")}</span>
                      </>
                    ) : (
                      <span className="text-sm text-quiet-ink">{r.linesEmptyReason ?? "not on EPB list"}</span>
                    )}
                  </td>
                )}
                {rail ? null : (
                  <td className={cn(h, "border-b border-line-subtle px-3 py-1 text-right align-middle tabular-nums")}>
                    {/* The record's own figure, and the profile's under it wherever the
                        two differ, so the list and the record beside it agree. */}
                    <WorkersCell own={r.workers} ownWords={r.workersCoverage} second={r.workersSecondShort} secondWords={r.workersSecond} />
                  </td>
                )}
                {/* The row's actions: always drawn, quiet, the same three the
                    keyboard drives (s saves, Enter opens, r sends an RFQ). */}
                {rail ? null : (
                <td className={cn(h, "border-b border-line-subtle align-middle", compact ? "px-1" : "px-2")}>
                  <span className="flex items-center justify-end gap-0.5">
                    {r.supplierId ? (
                      <SaveRecordButton supplierId={r.supplierId} saved={Boolean(r.saved)} icon size="sm" variant="ghost" />
                    ) : null}
                    {compact ? null : (
                      // SourceBD's own "open beside" icon, and its word over it
                      // under the pointer and while the row has keyboard focus
                      // (↵ opens it): the founder did not know the old sidebar
                      // glyph opened the record (video, 29 Sep 2026).
                      <span className="group/open relative inline-flex">
                        <Button
                          variant="ghost"
                          size="sm"
                          icon
                          href={recordHref}
                          clientNav
                          scroll={false}
                          data-action="open"
                          tabIndex={-1}
                          aria-label={`Open ${r.name} beside the results`}
                        >
                          <SbIcon name="open-beside" />
                        </Button>
                        <span
                          aria-hidden
                          className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 whitespace-nowrap rounded-sm bg-surface-inverse px-1.5 py-0.5 text-xs font-medium text-ink-inverse opacity-0 transition-opacity duration-fast group-hover/open:opacity-100 group-focus-within/open:opacity-100 group-focus-visible:opacity-100"
                        >
                          Open
                        </span>
                      </span>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      icon
                      href={r.sanctioned ? undefined : (r.rfqHref ?? undefined)}
                      clientNav
                      scroll={false}
                      disabled={r.sanctioned || !r.rfqHref}
                      data-action="rfq"
                      tabIndex={-1}
                      aria-label={r.sanctioned ? `RFQs cannot be sent to ${r.name}, a sanctioned supplier` : `Send an RFQ to ${r.name}`}
                      title={r.sanctioned ? "RFQs cannot be sent to a sanctioned supplier" : "Send an RFQ"}
                    >
                      <Icon name="send" />
                    </Button>
                  </span>
                </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * The keyboard on the rows. Only fires for a key pressed on the row itself
 * (not inside its checkbox or a link), and drives the row's own controls so
 * the mouse and the keyboard cannot diverge.
 */
/** The ledger's row keys. Exported for its test. */
export function onRowKey(e: Pick<KeyboardEvent<HTMLTableSectionElement>, "key" | "target" | "metaKey" | "ctrlKey" | "altKey" | "preventDefault">) {
  // A modified key is the browser's or the app's (⌘R reloads, ⌘K searches), never a row action.
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const target = e.target as HTMLElement;
  if (target.tagName !== "TR") return;
  const row = target as HTMLTableRowElement;
  const move = (dir: 1 | -1) => {
    const rows = Array.from(row.parentElement?.querySelectorAll<HTMLTableRowElement>('tr[data-row="result"]') ?? []);
    const next = rows[rows.indexOf(row) + dir];
    if (next) next.focus();
  };
  switch (e.key) {
    case "ArrowDown":
    case "j":
      e.preventDefault();
      move(1);
      return;
    case "ArrowUp":
    case "k":
      e.preventDefault();
      move(-1);
      return;
    case "Enter":
      e.preventDefault();
      row.querySelector<HTMLAnchorElement>('a[data-open="record"]')?.click();
      return;
    case " ":
      e.preventDefault();
      row.querySelector<HTMLElement>('[role="checkbox"]:not([aria-disabled])')?.click();
      return;
    case "r":
      e.preventDefault();
      row.querySelector<HTMLAnchorElement>('a[data-action="rfq"]')?.click();
      return;
    case "s":
      e.preventDefault();
      row.querySelector<HTMLButtonElement>('button[data-save]')?.click();
      return;
    default:
      return;
  }
}
