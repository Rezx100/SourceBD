// The results panel frame (REZ-A, handoff §3.1): one white `surface` panel
// with a `line` border, a header (select-all · query title · live count ·
// sort · Save search · Export CSV · card/table toggle) and a footer with the
// pager. The rows between are cards or the table.

import type { ReactNode } from "react";
import { formatCount } from "@/lib/dashboard/facts";
import { cn } from "@/lib/utils";
import { Button, Seg } from "./controls";
import { ExportLink } from "./export-link";
import { Icon } from "./icons";
import { SelectAllCheckbox } from "./selection";
import { Caption, Title } from "./type";

export function Panel({ className, children }: { className?: string; children: ReactNode }) {
  // NOT `overflow-hidden`. That clipped every popover the header and footer
  // open: on a short result set the sort menu was painted outside the panel —
  // invisible, yet still in the tab order and still activating on Enter, which
  // is a 2.4.7 failure a keyboard user walks straight into. The clipping only
  // ever existed to keep the first and last children inside the rounded
  // corners, so do exactly that instead and let menus escape.
  return (
    <section
      className={cn(
        "rounded-md border border-line bg-surface",
        "[&>*:first-child]:rounded-t-md [&>*:last-child]:rounded-b-md",
        className,
      )}
    >
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
  /**
   * 1-based index of the first row on screen. The caption used to print
   * `1–${shown}` unconditionally, so page 3 of a 300-row set read
   * "300 suppliers · 1–25" while rows 51–75 were on screen — a range claim
   * that was wrong on every page after the first.
   */
  firstRow?: number;
  sortLabel: string;
  view: "cards" | "table";
  /**
   * Set when the rows are NOT the query's first page — the /dev/ds gallery
   * shows the named test records of the rebuild spec, two of which the query
   * does not match. "1–4" over those rows is a range claim about the result
   * set, so the caption says what these rows are instead.
   */
  selection?: string;
  exportHref?: string;
  saveHref?: string;
  viewHref?: (view: "cards" | "table") => string;
  sortOptions?: readonly { value: string; label: string; href: string }[];
};

/** "51–75", or the quiet words when the page carries no rows. */
function rangeLabel(firstRow: number, shown: number): string {
  if (shown <= 0) return "none on this page";
  const from = Math.max(1, firstRow);
  return `${formatCount(from)}–${formatCount(from + shown - 1)}`;
}

export function PanelHeader({ model }: { model: PanelHeaderModel }) {
  // `flex-wrap`, and gutters that shrink. Every child here is an `h-control`
  // button with `whitespace-nowrap`, so the row's min-content width is about
  // 525px — sort, Save search, Export CSV, the card/table seg and the
  // select-all box. In a 288px content column at 320px that forced the whole
  // DOCUMENT to scroll sideways, and the table's own scroll region (added
  // this round) does not help because the header sits outside it. WCAG 1.4.10
  // allows two-dimensional scrolling for a data table, not for the controls
  // above it.
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-line-subtle px-4 py-3 sm:gap-3 sm:px-5">
      <SelectAllCheckbox />
      <div className="flex min-w-0 flex-1 items-baseline gap-2">
        {/* The screen's heading. Without it, results-list and results-table
            rendered no heading of any level, so there was nothing to navigate
            by once the skip link had been taken. */}
        <Title as="h1">{model.title}</Title>
        <Caption>
          {model.total === null
            ? "count could not be read"
            : `${formatCount(model.total)} ${model.total === 1 ? "supplier" : "suppliers"} · ${
                model.selection ?? rangeLabel(model.firstRow ?? 1, model.shown)
              }`}
        </Caption>
      </div>
      {/* This group wraps too. The wrapper above has `flex-wrap` and the
          comment above it claims that fixed the reflow; measured at 320px it
          did not, because THIS row is a single non-wrapping line of four
          `whitespace-nowrap` h-controls — 425px inside a 286px header. The
          document scrolled to 458px, and Export CSV and the card/table
          toggle sat 66 and 137px outside the viewport, focusable but off
          screen. `flex-wrap` here is what the outer one could not do for it. */}
      <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
        {model.sortOptions && model.sortOptions.length > 0 ? (
          <details className="relative">
            <summary className="inline-flex h-control list-none items-center gap-1.5 rounded-sm border border-line-strong bg-surface px-3 text-sm font-medium text-ink hover:bg-surface-sunken">
              <Icon name="sort" /> {model.sortLabel} <Icon name="caret" small />
            </summary>
            {/* Same clipping as the footer's per-page menu: Panel is
                `overflow-hidden` and this opens downward from the header, so on
                a short result set the six options are painted outside the panel
                — invisible, but still tabbable and still activating on Enter.
                Anchored to the summary's bottom edge and allowed to escape. */}
            {/* Anchored LEFT below `sm`. `right-0` alone put a 224px menu's
                left edge at -55px on a 320px screen once the controls wrapped
                and the summary moved to the start of its row: the first six
                characters of every sort option were off the viewport, and an
                absolutely positioned overflow to the left creates no scroll
                to reach them (WCAG 1.4.10). */}
            <div className="absolute left-0 top-full z-20 mt-1 min-w-[14rem] max-w-[calc(100vw-2rem)] rounded-sm border border-line-strong bg-surface py-1 shadow-sm sm:left-auto sm:right-0">
              {model.sortOptions.map((o) => (
                <a key={o.value} href={o.href} className="block px-3 py-1.5 text-sm text-ink hover:bg-surface-sunken">
                  {o.label}
                </a>
              ))}
            </div>
          </details>
        ) : (
          <Button>
            <Icon name="sort" /> {model.sortLabel} <Icon name="caret" small />
          </Button>
        )}
        <Button href={model.saveHref}>
          <Icon name="bookmark" /> Save search
        </Button>
        {model.exportHref ? (
          <ExportLink href={model.exportHref} label="Export CSV" />
        ) : (
          <Button>
            <Icon name="download" /> Export CSV
          </Button>
        )}
        <Seg
          value={model.view}
          hrefFor={model.viewHref ? (v) => model.viewHref!(v === "table" ? "table" : "cards") : undefined}
          options={[
            { value: "cards", label: "Cards", icon: "cards" },
            { value: "table", label: "Table", icon: "table" },
          ]}
        />
      </div>
    </div>
  );
}

/**
 * The footer describes the page that was actually rendered.
 *
 * `perPage` is the size of the request that produced these rows, so the pager
 * may only appear when the caller really paged: a hand-picked four-row panel
 * under "25 per page · Page 1 of 2" with Next enabled offered a page 2 that
 * does not exist. A caller that does not page passes no `perPage`, gets no
 * pager, and says what the panel holds in `note`.
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
}: {
  shown: number;
  /** Null when the count could not be read. */
  total: number | null;
  /** The page size this panel was filled with. Omit it when the panel does not page. */
  perPage?: number;
  page?: number;
  /**
   * What these rows are, when they are not the query's first page. The header
   * was changed in cycle 5 to stop claiming "1–4 of 42" over the gallery's
   * named test records, two of which the query does not match; the footer kept
   * printing the range under the same rows. A note replaces the range, it does
   * not decorate it.
   */
  note?: string;
  prevHref?: string | null;
  nextHref?: string | null;
  perHrefs?: readonly { n: number; href: string }[];
}) {
  const pages = total !== null && perPage ? Math.max(1, Math.ceil(total / perPage)) : null;
  // A page that came back short of its own page size is the last one, whatever
  // the total says — the rows on screen are the evidence, the total is not. But
  // "last page" must still render the pager: gating the whole block on
  // `shown >= perPage` removed Previous from the final page, stranding a buyer
  // on page 3 of 3 with no way back.
  const paged = pages !== null && perPage !== undefined && (shown >= perPage || page > 1);
  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-line-subtle px-4 py-3 sm:gap-3 sm:px-5">
      <Caption>
        {note
          ? `${note}${total === null ? "" : ` · ${formatCount(total)} in the result set`}`
          : `${rangeLabel(perPage ? (page - 1) * perPage + 1 : 1, shown)} of ${total === null ? "—" : formatCount(total)}`}
      </Caption>
      {perPage ? (
        perHrefs && perHrefs.length > 0 ? (
          <details className="relative">
            <summary className="inline-flex h-7 list-none items-center gap-1 rounded-sm px-2 text-sm text-ink-muted hover:bg-surface-sunken">
              {perPage} per page <Icon name="caret" small />
            </summary>
            {/* Opens upward: this menu lives in the panel footer, and Panel is
                `overflow-hidden`, so a downward menu is clipped to the few
                pixels of footer below the summary while its links stay in the
                tab order — a keyboard user tabs into items they cannot see. */}
            <div className="absolute bottom-full z-20 mb-1 rounded-sm border border-line-strong bg-surface py-1 shadow-sm">
              {perHrefs.map((p) => (
                <a key={p.n} href={p.href} className="block px-3 py-1.5 text-sm text-ink hover:bg-surface-sunken">
                  {p.n} per page
                </a>
              ))}
            </div>
          </details>
        ) : (
          <Button variant="ghost" className="h-7 px-2">
            {perPage} per page <Icon name="caret" small />
          </Button>
        )
      ) : null}
      {paged && pages ? (
        <div className="ml-auto flex items-center gap-2">
          <Button icon aria-label="Previous page" href={page > 1 ? (prevHref ?? undefined) : undefined} disabled={page <= 1} className="disabled:border-line disabled:text-ink-disabled">
            <Icon name="chev-l" />
          </Button>
          <Caption>
            Page {page} of {pages}
          </Caption>
          <Button icon aria-label="Next page" href={page < pages ? (nextHref ?? undefined) : undefined} disabled={page >= pages} className="disabled:border-line disabled:text-ink-disabled">
            <Icon name="chev-r" />
          </Button>
        </div>
      ) : null}
    </div>
  );
}
