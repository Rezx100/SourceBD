// ResultsTable: the ledger grid (enterprise pass, 27 Sep 2026, direction G1).
// One table for the search: 36px rows on a sticky header, seven columns with
// fixed roles, the name opening the record beside the results, the row's
// actions on hover and on the keyboard, the row that is open marked, numbers
// right-aligned and tabular, export lines as codes. Beside an open record the
// table narrows to its three essential columns (`compact`) so the pane keeps
// its measure. Sanctioned: the reserved rule and the word under the name,
// Send RFQ withheld. Selected: the brand inset rule and the filled box.
//
// Keyboard: a row is a focus stop. ↑/↓ (or j/k) move between rows, ↵ opens
// the record, Space selects, r sends an RFQ, s saves. Each key drives the
// row's own link or control, so the keyboard never diverges from the mouse.
//
// Client (REZ-B): the selection context, which only exists inside a
// `SelectionProvider`; outside one (the gallery) the checkbox stays inert.

"use client";

import { certTableLabel, formatCount } from "@/lib/dashboard/facts";
import type { TableRowModel } from "@/lib/dashboard/models";
import Link from "next/link";
import type { KeyboardEvent } from "react";
import { cn } from "@/lib/utils";
import { Chip } from "./chips";
import { Button, Checkbox } from "./controls";
import { Icon } from "./icons";
import { LogoTile, SourceMarks } from "./marks";
import { HeadCell, rowClass, type SortDir } from "./page";
import { SaveRecordButton } from "./save-record-button";
import { useSelection } from "./selection";

export type ResultsDensity = "compact" | "default" | "comfortable";

const ROW_H: Record<ResultsDensity, string> = { compact: "h-8", default: "h-9", comfortable: "h-11" };

/** The sortable columns, by the search's own sort keys (`lib/discover-v32-state.ts` SORTS). */
export type ResultsSortKey = "name" | "sources" | "cert_expiry" | "hs_lines" | "workers";

export function ResultsTable({
  rows,
  currentSlug = null,
  compact = false,
  density = "default",
  sort,
  sortHref,
}: {
  rows: readonly TableRowModel[];
  /** The record open beside the results, so its row is marked. */
  currentSlug?: string | null;
  /** Beside an open record: Supplier, Sources and Workers only. */
  compact?: boolean;
  density?: ResultsDensity;
  /** The active sort, for the header arrow. */
  sort?: { key: string; dir: SortDir } | null;
  /** The URL that orders the list by a column. */
  sortHref?: (key: ResultsSortKey) => string;
}) {
  const sel = useSelection();
  const head = (key: ResultsSortKey, label: string, align: "left" | "right" = "left", className?: string) => (
    <HeadCell
      align={align}
      className={className}
      sort={sortHref ? { href: sortHref(key), active: sort?.key === key, dir: sort?.dir } : undefined}
    >
      {label}
    </HeadCell>
  );
  const h = ROW_H[density];
  return (
    <div
      // `relative`: `.sr-only` is position:absolute, and without a containing
      // block here the per-row status spans escaped the scroll clip and
      // widened the whole page to the table's width (WCAG 1.4.10). Below `xl`
      // the table scrolls sideways in this region; from `xl` it fits and the
      // header sticks to the results column's own scroll.
      className={cn("relative", compact ? "overflow-x-auto" : "max-xl:overflow-x-auto")}
      tabIndex={0}
      role="region"
      aria-label="Results table"
    >
      <table
        className={cn(
          "w-full table-fixed border-collapse text-sm",
          compact ? "min-w-[26rem]" : "min-w-[60rem]",
          !compact && "[&_thead_th]:xl:sticky [&_thead_th]:xl:top-0 [&_thead_th]:xl:z-10",
        )}
      >
        <colgroup>
          <col style={{ width: 40 }} />
          <col />
          <col style={{ width: compact ? 132 : 150 }} />
          {compact ? null : <col style={{ width: 200 }} />}
          {compact ? null : <col style={{ width: 150 }} />}
          {compact ? null : <col style={{ width: 104 }} />}
          <col style={{ width: 92 }} />
        </colgroup>
        <thead>
          <tr>
            <HeadCell className="px-2">
              <span className="sr-only">Select</span>
            </HeadCell>
            {head("name", "Supplier", "left", "px-3")}
            {head("sources", "Registers & certifiers")}
            {compact ? null : head("cert_expiry", "Certificates")}
            {compact ? null : head("hs_lines", "Export lines")}
            {compact ? null : <HeadCell>Type</HeadCell>}
            {head("workers", "Workers", "right")}
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
                <th scope="row" className={cn(h, "border-b border-line-subtle px-3 py-1 text-left align-middle font-normal")}>
                  <div className="flex min-w-0 items-center gap-2.5">
                    <LogoTile initials={r.initials} tier={r.topTier} size="sm" />
                    <div className="min-w-0 flex-1">
                      {/* Wraps, never an ellipsis (the Wrapping Name Rule): a
                          company's name is the company's name, and a 125-character
                          one grows its row rather than losing its end. */}
                      <div className="[overflow-wrap:anywhere]">
                        {/* The name opens the record beside these results (§3.3), as a
                            client navigation that keeps the results and the selection. */}
                        <Link
                          prefetch={false}
                          scroll={false}
                          href={recordHref}
                          data-open="record"
                          className="font-medium text-ink-strong [overflow-wrap:anywhere] hover:text-brand-ink"
                        >
                          {r.name}
                        </Link>
                        {r.place ? (
                          <span className="text-ink-subtle before:mx-1.5 before:content-['·']">{r.place}</span>
                        ) : null}
                      </div>
                      {r.sanctioned ? (
                        <div className="inline-flex items-center gap-1 text-xs font-medium text-sanction-ink">
                          <Icon name="warn" small /> Sanctioned{r.sanctionSample ? " · sample" : ""}
                        </div>
                      ) : null}
                    </div>
                    {/* The row's actions, revealed on hover and on focus within the row;
                        the keyboard drives the same controls. */}
                    <span className="hidden shrink-0 items-center gap-1 group-hover:inline-flex group-focus-within:inline-flex">
                      {r.supplierId ? (
                        <SaveRecordButton supplierId={r.supplierId} saved={Boolean(r.saved)} icon size="sm" />
                      ) : null}
                      <Button size="sm" href={recordHref} clientNav scroll={false} data-action="open" tabIndex={-1}>
                        Open
                      </Button>
                      <Button
                        size="sm"
                        href={r.sanctioned ? undefined : (r.rfqHref ?? undefined)}
                        clientNav
                        scroll={false}
                        disabled={r.sanctioned || !r.rfqHref}
                        data-action="rfq"
                        tabIndex={-1}
                        title={r.sanctioned ? "RFQs cannot be sent to a sanctioned supplier" : undefined}
                      >
                        <Icon name="send" /> RFQ
                      </Button>
                    </span>
                  </div>
                </th>
                <td className={cn(h, "border-b border-line-subtle px-4 align-middle")}>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="min-w-4 text-right font-mono text-xs font-medium text-ink-strong">{r.sourceCount}</span>
                    <SourceMarks marks={r.marks.slice(0, 4)} caption="none" sm className="flex-nowrap gap-0.5" />
                    {r.marks.length > 4 ? <span className="text-xs text-ink-subtle">+{r.marks.length - 4}</span> : null}
                  </span>
                </td>
                {compact ? null : (
                  <td className={cn(h, "border-b border-line-subtle px-4 align-middle")}>
                    {r.certs.length > 0 ? (
                      <span className="inline-flex flex-nowrap items-center gap-1">
                        {r.certs.slice(0, 2).map((c) => (
                          <Chip key={`${c.kind}-${c.number ?? ""}`} compact tone={c.state === "valid" ? "positive" : c.state === "no-expiry" ? "neutral" : "caution"}>
                            {certTableLabel(c)}
                          </Chip>
                        ))}
                        {r.certs.length > 2 ? <span className="text-xs text-ink-subtle">+{r.certs.length - 2}</span> : null}
                      </span>
                    ) : (
                      <span className="text-xs text-quiet-ink">{r.certsEmptyReason ?? "none on file"}</span>
                    )}
                  </td>
                )}
                {compact ? null : (
                  <td className={cn(h, "border-b border-line-subtle px-4 py-1 align-middle")}>
                    {r.totalLines > 0 ? (
                      <>
                        <span className="font-mono text-xs font-medium text-ink-strong">{r.totalLines}</span>
                        <span className="ml-1.5 font-mono text-xs text-ink-subtle">{r.photos.slice(0, 3).map((p) => p.hs).join(" · ")}</span>
                      </>
                    ) : (
                      <span className="text-xs text-quiet-ink">{r.linesEmptyReason ?? "not on EPB list"}</span>
                    )}
                  </td>
                )}
                {compact ? null : <td className={cn(h, "whitespace-nowrap border-b border-line-subtle px-4 align-middle text-ink-muted")}>{r.type}</td>}
                <td className={cn(h, "border-b border-line-subtle px-4 text-right align-middle tabular-nums")}>
                  {r.workers === null ? (
                    // No figure of its own, but the profile's may exist: it travels
                    // as the card and the CSV carry it.
                    <span className="text-quiet-ink" title={r.workersSecond ?? undefined}>
                      —
                      {density !== "compact" && r.workersSecond ? (
                        <span className="block text-xs font-normal text-ink-subtle [overflow-wrap:anywhere]">{r.workersSecond}</span>
                      ) : null}
                    </span>
                  ) : (
                    // A figure printed bare hides what it counts (founder, 24 Sep):
                    // the coverage and the profile's second figure sit under it on
                    // every density but compact, where they travel in the title.
                    <span title={[r.workersCoverage, r.workersSecond].filter(Boolean).join(" · ") || undefined}>
                      {formatCount(r.workers)}
                      {density !== "compact" && r.workersCoverage ? (
                        <span className="block text-xs font-normal text-ink-subtle [overflow-wrap:anywhere]">{r.workersCoverage}</span>
                      ) : null}
                      {density !== "compact" && r.workersSecond ? (
                        <span className="block text-xs font-normal text-ink-subtle [overflow-wrap:anywhere]">{r.workersSecond}</span>
                      ) : null}
                    </span>
                  )}
                </td>
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
