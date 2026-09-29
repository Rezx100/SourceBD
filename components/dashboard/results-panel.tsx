// The results panel frame (enterprise pass, 27 Sep 2026): one white panel on
// the canvas with a soft edge, a one-row header (select-all · query title ·
// live count · sort · density · Save search · Export · the table/cards
// switch) and a footer with the pager. The rows between are the ledger grid
// or the cards.

import type { ReactNode } from "react";
import { formatCount } from "@/lib/dashboard/facts";
import { cn } from "@/lib/utils";
import { Button, Menu, MenuItem, Seg } from "./controls";
import { ExportLink } from "./export-link";
import { Icon } from "./icons";
import { SelectAllCheckbox } from "./selection";
import { Caption, Title } from "./type";

export function Panel({ className, children }: { className?: string; children: ReactNode }) {
  // NOT `overflow-hidden`: that clipped every menu the header and footer open.
  // The rounded corners are kept on the first and last child instead.
  // `isolate`: the sticky header's `z-raised` stays inside the panel, so the
  // whole panel sits under the filter menus above it (`z-overlay`) and under
  // anything else the page raises.
  return (
    <section className={cn("isolate rounded-md bg-surface shadow-edge", "[&>*:first-child]:rounded-t-md [&>*:last-child]:rounded-b-md", className)}>
      {children}
    </section>
  );
}

export type PanelHeaderModel = {
  /** The query as a title: "Knitted shirts · GOTS valid". */
  title: string;
  /** The RPC's count; null when the read failed (the caption then says so, never 0). */
  total: number | null;
  /** Rows on this page. */
  shown: number;
  /** 1-based index of the first row on screen. */
  firstRow?: number;
  sortLabel: string;
  view: "cards" | "table";
  /** Set when the rows are NOT the query's first page (the gallery's named test records). */
  selection?: string;
  exportHref?: string;
  saveHref?: string;
  viewHref?: (view: "cards" | "table") => string;
  sortOptions?: readonly { value: string; label: string; href: string; active?: boolean }[];
  /** The row-height stops, when the list offers them. */
  densityOptions?: readonly { value: string; label: string; href: string; active?: boolean }[];
};

/** "51–75", or the quiet words when the page carries no rows. */
function rangeLabel(firstRow: number, shown: number): string {
  if (shown <= 0) return "none on this page";
  const from = Math.max(1, firstRow);
  return `${formatCount(from)}–${formatCount(from + shown - 1)}`;
}

/**
 * `as="h2"` when a record or line sits beside the results: its name is the page's h1 then.
 *
 * `compact` beside an open pane: the results column is a third of the region
 * there, and the full row of labelled controls wrapped onto three lines above
 * the list (founder's walkthrough, 28 Sep 2026). Beside a pane the header
 * keeps Sort and Save search as icon buttons on the title's line; density,
 * export and the cards view wait for the pane to close.
 */
export function PanelHeader({
  model,
  as = "h1",
  compact = false,
  rail = false,
}: {
  model: PanelHeaderModel;
  as?: "h1" | "h2";
  compact?: boolean;
  /**
   * Beside the RFQ composer (the 18rem rail): one line, the count and the
   * search's words cut to fit, and no controls. The rail is for ticking
   * suppliers into the RFQ; its header wrapped onto five lines beside sort and
   * save, and its sort menu opened under the rows (founder's review, 29 Sep
   * 2026).
   */
  rail?: boolean;
}) {
  if (rail) {
    const As = as;
    return (
      <div className="flex items-center gap-2 border-b border-line-subtle px-3 py-2">
        <SelectAllCheckbox />
        <As className="m-0 flex min-w-0 flex-1 items-baseline gap-2">
          <span className="shrink-0 text-sm font-medium text-ink-strong">
            {model.total === null ? "Count not read" : `${formatCount(model.total)} ${model.total === 1 ? "supplier" : "suppliers"}`}
          </span>
          <span title={model.title} className="min-w-0 truncate text-xs font-normal text-ink-subtle">
            {model.title}
          </span>
        </As>
      </div>
    );
  }
  if (compact) {
    return (
      <div className="flex items-center gap-2 border-b border-line-subtle px-3 py-2">
        <SelectAllCheckbox />
        <div className="flex min-w-0 flex-1 flex-col">
          <Title as={as} className="[overflow-wrap:anywhere]">
            {model.title}
          </Title>
          <Caption>
            {model.total === null
              ? "count could not be read"
              : `${formatCount(model.total)} ${model.total === 1 ? "supplier" : "suppliers"} · ${model.selection ?? rangeLabel(model.firstRow ?? 1, model.shown)}`}
          </Caption>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          {model.sortOptions && model.sortOptions.length > 0 ? (
            <Menu label={`Sort: ${model.sortLabel}`} size="sm" summary={<Icon name="sort" />}>
              {model.sortOptions.map((o) => (
                <MenuItem key={o.value} href={o.href} active={o.active}>
                  {o.label}
                </MenuItem>
              ))}
            </Menu>
          ) : null}
          {model.saveHref ? (
            <Button size="sm" variant="ghost" icon href={model.saveHref} clientNav scroll={false} aria-label="Save search" title="Save search">
              <Icon name="bookmark" />
            </Button>
          ) : null}
        </div>
      </div>
    );
  }
  // `flex-wrap`, and gutters that shrink: in a 288px content column at 320px
  // a non-wrapping row of controls forced the whole DOCUMENT to scroll
  // sideways (WCAG 1.4.10 allows two-dimensional scrolling for a data table,
  // not for the controls above it).
  //
  // On a phone (the phone hand-off's D3): the title on one line, cut; the
  // count under it on one line; then one row of Sort, the view switch and a
  // ⋯ holding Save search, Density and Export CSV. It took five lines before:
  // the count broke inside its range and the toolbar wrapped into three
  // right-aligned rows.
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-line-subtle px-3 py-2 sm:gap-3 sm:px-4">
      <SelectAllCheckbox />
      <div className="flex min-w-0 flex-1 items-baseline gap-2 max-sm:flex-col max-sm:items-start max-sm:gap-0">
        {/* The screen's heading: without it the results rendered no heading of
            any level, so there was nothing to navigate by once the skip link
            had been taken. */}
        <Title as={as} className="max-sm:w-full">
          <span data-line="" className="max-sm:block max-sm:truncate">
            {model.title}
          </span>
        </Title>
        <Caption className="whitespace-nowrap tabular-nums">
          {model.total === null
            ? "count could not be read"
            : `${formatCount(model.total)} ${model.total === 1 ? "supplier" : "suppliers"} · ${
                model.selection ?? rangeLabel(model.firstRow ?? 1, model.shown)
              }`}
        </Caption>
      </div>
      <div className="flex min-w-0 flex-wrap items-center justify-end gap-1.5 max-sm:basis-full max-sm:flex-nowrap max-sm:justify-start max-sm:gap-2">
        {model.sortOptions && model.sortOptions.length > 0 ? (
          <Menu
            label="Sort"
            size="sm"
            summaryClassName="max-sm:h-target max-sm:px-3 max-sm:text-base"
            summary={
              <>
                <Icon name="sort" /> <span className="max-sm:hidden">{model.sortLabel}</span>
                <span className="sm:hidden">Sort</span>
              </>
            }
          >
            {model.sortOptions.map((o) => (
              <MenuItem key={o.value} href={o.href} active={o.active}>
                {o.label}
              </MenuItem>
            ))}
          </Menu>
        ) : (
          <Button size="sm" variant="ghost">
            <Icon name="sort" /> {model.sortLabel} <Icon name="caret" small />
          </Button>
        )}
        {/* From sm; on a phone these three are in the ⋯ at the row's end. */}
        <div className="contents max-sm:hidden">
          {model.densityOptions && model.densityOptions.length > 0 ? (
            <Menu key={model.densityOptions.find((o) => o.active)?.value} label="Row density" size="sm" summary={<><Icon name="rows" /> Density</>}>
              {model.densityOptions.map((o) => (
                <MenuItem key={o.value} href={o.href} active={o.active} clientNav>
                  {o.label}
                </MenuItem>
              ))}
            </Menu>
          ) : null}
          <Button size="sm" href={model.saveHref} clientNav scroll={false}>
            <Icon name="bookmark" /> Save search
          </Button>
          {model.exportHref ? (
            <ExportLink href={model.exportHref} label="Export CSV" size="sm" />
          ) : (
            <Button size="sm">
              <Icon name="download" /> Export CSV
            </Button>
          )}
        </div>
        <Seg
          label="View"
          className="h-7 max-sm:h-target"
          value={model.view}
          hrefFor={model.viewHref ? (v) => model.viewHref!(v === "cards" ? "cards" : "table") : undefined}
          options={[
            { value: "table", label: "Table", icon: "table" },
            { value: "cards", label: "Cards", icon: "cards" },
          ]}
        />
        <Menu
          key={`more:${model.densityOptions?.find((o) => o.active)?.value ?? ""}`}
          label="More for this search"
          size="sm"
          className="ml-auto sm:hidden"
          summaryClassName="max-sm:size-target max-sm:justify-center max-sm:px-0 [&>svg:last-child]:hidden"
          summary={<Icon name="dots" size={22} />}
        >
          {model.saveHref ? (
            <MenuItem href={model.saveHref} clientNav>
              Save search
            </MenuItem>
          ) : null}
          {model.exportHref ? <MenuItem href={model.exportHref}>Export CSV</MenuItem> : null}
          {model.densityOptions && model.densityOptions.length > 0 ? (
            <>
              <span className="block px-4 pb-1 pt-3 font-mono text-eyebrow uppercase text-ink-subtle">Density</span>
              {model.densityOptions.map((o) => (
                <MenuItem key={o.value} href={o.href} active={o.active} clientNav>
                  {o.label}
                </MenuItem>
              ))}
            </>
          ) : null}
        </Menu>
      </div>
    </div>
  );
}

/**
 * The footer describes the page that was actually rendered. `perPage` is the
 * size of the request that produced these rows, so the pager may only appear
 * when the caller really paged; a caller that does not page passes none and
 * says what the panel holds in `note`.
 */
export function PanelFooter({
  shown,
  total,
  perPage,
  page = 1,
  note,
  prevHref,
  nextHref,
  perHrefs,
  rail = false,
}: {
  /** Beside the RFQ composer: one line, the range and two icon buttons, no rows-per-page menu. */
  rail?: boolean;
  shown: number;
  /** Null when the count could not be read. */
  total: number | null;
  perPage?: number;
  page?: number;
  note?: string;
  prevHref?: string | null;
  nextHref?: string | null;
  perHrefs?: readonly { n: number; href: string }[];
}) {
  const pages = total !== null && perPage ? Math.max(1, Math.ceil(total / perPage)) : null;
  // A page that came back short of its own page size is the last one; but
  // "last page" must still render the pager, or page 3 of 3 has no way back.
  const paged = pages !== null && perPage !== undefined && (shown >= perPage || page > 1);
  if (rail) {
    return (
      <div className="flex items-center gap-1 border-t border-line-subtle py-1.5 pl-3 pr-2">
        <Caption className="min-w-0 flex-1 truncate tabular-nums">
          {`${rangeLabel(perPage ? (page - 1) * perPage + 1 : 1, shown)} of ${total === null ? "—" : formatCount(total)}`}
        </Caption>
        {paged && pages ? (
          <>
            <Button icon size="sm" variant="ghost" aria-label="Previous page" href={page > 1 ? (prevHref ?? undefined) : undefined} clientNav disabled={page <= 1}>
              <Icon name="chev-l" />
            </Button>
            <Button icon size="sm" variant="ghost" aria-label="Next page" href={page < pages ? (nextHref ?? undefined) : undefined} clientNav disabled={page >= pages}>
              <Icon name="chev-r" />
            </Button>
          </>
        ) : null}
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-line-subtle px-3 py-2 sm:gap-3 sm:px-4">
      <Caption>
        {note
          ? `${note}${total === null ? "" : ` · ${formatCount(total)} in the result set`}`
          : `${rangeLabel(perPage ? (page - 1) * perPage + 1 : 1, shown)} of ${total === null ? "—" : formatCount(total)}`}
      </Caption>
      {perPage ? (
        perHrefs && perHrefs.length > 0 ? (
          // Opens upward: this menu lives in the panel footer.
          <Menu label="Rows per page" size="sm" align="left" up summary={<>{perPage} per page</>}>
            {perHrefs.map((p) => (
              <MenuItem key={p.n} href={p.href} active={p.n === perPage}>
                {p.n} per page
              </MenuItem>
            ))}
          </Menu>
        ) : (
          <Button variant="ghost" size="sm">
            {perPage} per page <Icon name="caret" small />
          </Button>
        )
      ) : null}
      {paged && pages ? (
        <div className="ml-auto flex items-center gap-2">
          <Button icon size="sm" aria-label="Previous page" href={page > 1 ? (prevHref ?? undefined) : undefined} clientNav disabled={page <= 1}>
            <Icon name="chev-l" />
          </Button>
          <Caption className="tabular-nums">
            Page {page} of {pages}
          </Caption>
          <Button icon size="sm" aria-label="Next page" href={page < pages ? (nextHref ?? undefined) : undefined} clientNav disabled={page >= pages}>
            <Icon name="chev-r" />
          </Button>
        </div>
      ) : null}
    </div>
  );
}
