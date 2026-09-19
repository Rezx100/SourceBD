// The results panel frame (REZ-A, handoff §3.1): one white `surface` panel
// with a `line` border, a header (select-all · query title · live count ·
// sort · Save search · Export CSV · card/table toggle) and a footer with the
// pager. The rows between are cards or the table.

import type { ReactNode } from "react";
import { formatCount } from "@/lib/dashboard/facts";
import { cn } from "@/lib/utils";
import { Button, Checkbox, Seg } from "./controls";
import { Icon } from "./icons";
import { Caption, Title } from "./type";

export function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cn("overflow-hidden rounded-md border border-line bg-surface", className)}>{children}</section>;
}

export type PanelHeaderModel = {
  /** The query as a title: "Knitted shirts · GOTS valid". */
  title: string;
  /** The RPC's count; null when the read failed (the caption then says so, never 0). */
  total: number | null;
  /** Rows on this page. */
  shown: number;
  sortLabel: string;
  view: "cards" | "table";
  /**
   * Set when the rows are NOT the query's first page — the /dev/ds gallery
   * shows the named test records of the rebuild spec, two of which the query
   * does not match. "1–4" over those rows is a range claim about the result
   * set, so the caption says what these rows are instead.
   */
  selection?: string;
};

export function PanelHeader({ model }: { model: PanelHeaderModel }) {
  return (
    <div className="flex items-center gap-3 border-b border-line-subtle px-5 py-3">
      <Checkbox label="Select all on this page" />
      <div className="flex min-w-0 flex-1 items-baseline gap-2">
        <Title>{model.title}</Title>
        <Caption>
          {model.total === null
            ? "count could not be read"
            : `${formatCount(model.total)} ${model.total === 1 ? "supplier" : "suppliers"} · ${
                model.selection ?? (model.shown > 0 ? `1–${model.shown}` : "none on this page")
              }`}
        </Caption>
      </div>
      <div className="flex items-center gap-2">
        <Button>
          <Icon name="sort" /> {model.sortLabel} <Icon name="caret" small />
        </Button>
        <Button>
          <Icon name="bookmark" /> Save search
        </Button>
        <Button>
          <Icon name="download" /> Export CSV
        </Button>
        <Seg
          value={model.view}
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
}: {
  shown: number;
  /** Null when the count could not be read. */
  total: number | null;
  /** The page size this panel was filled with. Omit it when the panel does not page. */
  perPage?: number;
  page?: number;
  note?: string;
}) {
  const pages = total !== null && perPage ? Math.max(1, Math.ceil(total / perPage)) : null;
  // A page that came back short of its own page size is the last one, whatever
  // the total says — the rows on screen are the evidence, the total is not.
  const paged = pages !== null && perPage !== undefined && shown >= perPage;
  return (
    <div className="flex items-center gap-3 border-t border-line-subtle px-5 py-3">
      <Caption>
        {shown > 0 ? `1–${shown}` : "0"} of {total === null ? "—" : formatCount(total)}
        {note ? ` · ${note}` : ""}
      </Caption>
      {perPage ? (
        <Button variant="ghost" className="h-7 px-2">
          {perPage} per page <Icon name="caret" small />
        </Button>
      ) : null}
      {paged && pages ? (
        <div className="ml-auto flex items-center gap-2">
          <Button icon aria-label="Previous page" disabled={page <= 1} className="disabled:border-line disabled:text-ink-disabled">
            <Icon name="chev-l" />
          </Button>
          <Caption>
            Page {page} of {pages}
          </Caption>
          <Button icon aria-label="Next page" disabled={page >= pages} className="disabled:border-line disabled:text-ink-disabled">
            <Icon name="chev-r" />
          </Button>
        </div>
      ) : null}
    </div>
  );
}
