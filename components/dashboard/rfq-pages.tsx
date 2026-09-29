// The buyer's RFQ pages in the dashboard kit (handoff §3.7): the list, its
// drafts, and the RFQ itself. Server components; the routes read `rfq_list`,
// `rfq_draft_list` and `rfq_get` and hand the rows here, so a test can render
// exactly what a buyer receives.
//
// The RFQ is drawn two ways by ONE component: in a pane beside the list
// (`/app/rfqs?open=<id>`) and as the full page (`/app/rfqs/[id]`, kept for
// deep links). Only what the RPCs return is drawn: there is no reply-by date
// and no per-supplier reply state yet, so the tabs are the RFQ's own status
// and its quote count, nothing derived beyond that.

import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { AcceptQuoteRows } from "@/components/accept-quote-button";
import { buildRfqRow, type RfqListRow } from "@/lib/dashboard/build-models";
import { formatCount, formatDay, formatMoney, formatQuantity, nameSecondLine, splitQualifier } from "@/lib/dashboard/facts";
import { cn } from "@/lib/utils";
import { Badge, Chip, CURRENT_TAB, type BadgeTone } from "./chips";
import { Button, Count } from "./controls";
import { Icon } from "./icons";
import { Cell, DataTable, DetailList, EmptyState, ErrorNote, HeadCell, PageHeader, PageSection, rowClass } from "./page";
import { Sheet, SheetBar, SheetScroll } from "./sheet";
import { Caption, OneLine, Title } from "./type";

type RfqStatus = "open" | "accepted" | "closed" | "cancelled";
type ViewerRole = "buyer" | "supplier" | "both";

export type RfqRow = RfqListRow & { updated_at: string; viewer_role: ViewerRole };

/** What `rfq_draft_list()` returns per draft: the composer's saved fields and its targets. */
export type RfqDraft = {
  id: string;
  payload: { product_title?: unknown } | null;
  target_supplier_ids: string[] | null;
  updated_at: string;
};

// ---- List ----

export const RFQ_TABS = [
  { key: "all", label: "All" },
  { key: "open", label: "Open" },
  { key: "quoted", label: "Quoted" },
  { key: "accepted", label: "Accepted" },
  { key: "closed", label: "Closed" },
] as const;
export type RfqTab = (typeof RFQ_TABS)[number]["key"];
/** A status tab, or the drafts the buyer saved and has not sent. */
export type RfqView = RfqTab | "drafts";

/** Which tab a row sits under: open with no quote, open with quotes, accepted, closed or cancelled. */
export function rfqTabOf(r: Pick<RfqRow, "status" | "quote_count">): Exclude<RfqTab, "all"> {
  if (r.status === "accepted") return "accepted";
  if (r.status === "closed" || r.status === "cancelled") return "closed";
  return r.quote_count > 0 ? "quoted" : "open";
}

export function parseRfqTab(v: unknown): RfqView {
  if (v === "drafts") return "drafts";
  return RFQ_TABS.some((t) => t.key === v) ? (v as RfqTab) : "all";
}

/** The list at a tab, with an RFQ open beside it or not. Close is this without `open`. */
export function rfqsHref(tab: RfqView, open?: string | null): string {
  const q = new URLSearchParams();
  if (tab !== "all") q.set("status", tab);
  if (open) q.set("open", open);
  const s = q.toString();
  return s ? `/app/rfqs?${s}` : "/app/rfqs";
}

/**
 * `rfq_list` failed. "You have no RFQs yet" is a fact about the account, and a
 * failed read does not establish it — the empty state that sells the feature
 * must never stand in for an unread list.
 */
export const RFQ_ERROR_COPY = "Your RFQs could not be read just now. Nothing has been lost — try again in a moment.";

/** Handoff §3.7's empty copy, as a title and its sentence: where an RFQ starts, and where its answers land. */
export const RFQ_EMPTY_TITLE = "Your first RFQ lands here.";
export const RFQ_EMPTY_BODY =
  "Start one from any supplier record with Send RFQ, or tick suppliers in the search results and send them one RFQ together. Suppliers answer inside the platform, with the record attached.";

export function draftTitle(d: RfqDraft): string {
  const t = d.payload?.product_title;
  return typeof t === "string" && t.trim() ? t.trim() : "Untitled draft";
}

/** The saved drafts; a row reopens its draft in the composer. */
function DraftsTable({ drafts }: { drafts: readonly RfqDraft[] }) {
  return (
    <div className="rounded-md border border-line-subtle bg-surface">
      {drafts.length === 0 ? (
        <EmptyState icon="send" title="No drafts">
          A draft is kept when you close the RFQ composer before sending.
        </EmptyState>
      ) : (
        <DataTable label="Drafts" minWidth="28rem">
          <thead>
            <tr>
              <HeadCell>Draft</HeadCell>
              <HeadCell align="right">Suppliers</HeadCell>
              <HeadCell>Updated</HeadCell>
            </tr>
          </thead>
          <tbody>
            {drafts.map((d) => {
              const n = d.target_supplier_ids?.length ?? 0;
              return (
                <tr key={d.id} className={rowClass({ className: "relative" })}>
                  <Cell>
                    <Link
                      prefetch={false}
                      href={`/app/rfqs/new?draft=${encodeURIComponent(d.id)}`}
                      className="font-medium text-ink-strong [overflow-wrap:anywhere] after:absolute after:inset-0 after:content-['']"
                    >
                      {draftTitle(d)}
                    </Link>
                  </Cell>
                  <Cell align="right" className="whitespace-nowrap">{`${formatCount(n)} ${n === 1 ? "supplier" : "suppliers"}`}</Cell>
                  <Cell className="whitespace-nowrap text-ink-muted">{formatDay(d.updated_at) ?? "—"}</Cell>
                </tr>
              );
            })}
          </tbody>
        </DataTable>
      )}
      <div className="px-4 py-3">
        <Caption>{drafts.length === 1 ? "1 draft" : `${formatCount(drafts.length)} drafts`}</Caption>
      </div>
    </div>
  );
}

/**
 * `rows: null` → `rfq_list` failed; no count and no empty state stand in for
 * it. `openId` is the RFQ open beside the list: its row is marked and the
 * table narrows to name, status and date so it keeps a column beside the pane.
 */
export function RfqListBody({
  rows,
  tab,
  today,
  drafts = [],
  openId = null,
}: {
  rows: RfqRow[] | null;
  tab: RfqView;
  today: Date;
  drafts?: readonly RfqDraft[];
  openId?: string | null;
}) {
  const sent = rows?.filter((r) => r.viewer_role !== "supplier") ?? null;
  const quotes = sent?.reduce((n, r) => n + (Number.isFinite(r.quote_count) ? r.quote_count : 0), 0) ?? null;
  const shown = rows ? rows.filter((r) => tab === "all" || rfqTabOf(r) === tab) : [];
  const countOf = (key: RfqTab) => (rows ? rows.filter((r) => key === "all" || rfqTabOf(r) === key).length : null);
  const compact = openId !== null;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <PageHeader
        title="RFQs"
        caption={
          sent === null || quotes === null
            ? "Counts could not be read"
            : `${formatCount(sent.length)} sent · ${formatCount(quotes)} ${quotes === 1 ? "quote" : "quotes"}`
        }
        actions={
          // An RFQ starts from suppliers — a record, or the ticked results —
          // so this is the way there, not a composer with nobody to send to.
          <Button href="/app/discover" clientNav>
            <Icon name="search" /> Find suppliers
          </Button>
        }
      >
        {(rows && rows.length > 0) || drafts.length > 0 ? (
          <nav aria-label="RFQ status" className="flex flex-wrap gap-2">
            {rows && rows.length > 0
              ? RFQ_TABS.map((t) => (
                  <Link prefetch={false} key={t.key} href={rfqsHref(t.key)} aria-current={t.key === tab ? "page" : undefined} className="rounded-sm">
                    <Chip tone={t.key === tab ? "on" : "neutral"} className={t.key === tab ? CURRENT_TAB : undefined}>
                      {t.label}
                      <Count className={t.key === tab ? "text-xs text-ink-muted" : "text-xs"}>{countOf(t.key)}</Count>
                    </Chip>
                  </Link>
                ))
              : null}
            {drafts.length > 0 ? (
              <Link prefetch={false} href={rfqsHref("drafts")} aria-current={tab === "drafts" ? "page" : undefined} className="rounded-sm">
                <Chip tone={tab === "drafts" ? "on" : "neutral"} className={tab === "drafts" ? CURRENT_TAB : undefined}>
                  Drafts
                  <Count className={tab === "drafts" ? "text-xs text-ink-muted" : "text-xs"}>{drafts.length}</Count>
                </Chip>
              </Link>
            ) : null}
          </nav>
        ) : null}
      </PageHeader>

      {tab === "drafts" ? (
        <DraftsTable drafts={drafts} />
      ) : rows === null ? (
        <ErrorNote>{RFQ_ERROR_COPY}</ErrorNote>
      ) : rows.length === 0 ? (
        <div className="rounded-md border border-line-subtle bg-surface">
          <EmptyState art="rfq" title={RFQ_EMPTY_TITLE}>
            {RFQ_EMPTY_BODY}
          </EmptyState>
        </div>
      ) : (
        <div className="rounded-md border border-line-subtle bg-surface">
          {shown.length === 0 ? (
            <EmptyState icon="send" title={`No ${RFQ_TABS.find((t) => t.key === tab)?.label.toLowerCase()} RFQs`}>
              RFQs move here as their status changes.
            </EmptyState>
          ) : (
            <DataTable label="RFQs" minWidth={compact ? "24rem" : "40rem"}>
              <thead>
                <tr>
                  <HeadCell>RFQ</HeadCell>
                  {compact ? null : <HeadCell align="right">Suppliers</HeadCell>}
                  {compact ? null : <HeadCell align="right">Quantity</HeadCell>}
                  <HeadCell>Status</HeadCell>
                  <HeadCell>Updated</HeadCell>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => {
                  const m = buildRfqRow(r, null, today);
                  const current = r.id === openId;
                  return (
                    <tr key={r.id} aria-current={current ? "true" : undefined} className={rowClass({ current, className: "relative" })}>
                      <Cell>
                        <span className="flex flex-wrap items-center gap-2">
                          {/* The whole row opens the RFQ beside the list: this link's box is stretched over the row. */}
                          <Link
                            prefetch={false}
                            scroll={false}
                            href={rfqsHref(tab, r.id)}
                            className="font-medium text-ink-strong [overflow-wrap:anywhere] after:absolute after:inset-0 after:content-['']"
                          >
                            {m.name}
                          </Link>
                          {r.viewer_role !== "buyer" ? <Badge tone="type">As supplier</Badge> : null}
                        </span>
                      </Cell>
                      {compact ? null : <Cell align="right">{m.supplierCount}</Cell>}
                      {compact ? null : (
                        <Cell align="right" className="whitespace-nowrap">
                          {formatQuantity(r.quantity, r.quantity_unit) ?? "—"}
                        </Cell>
                      )}
                      <Cell>
                        {/* Positive is for an accepted quote only: quotes arriving are a fact, not an outcome. */}
                        <Badge tone={r.status === "accepted" ? "positive" : "type"} icon={m.status.icon}>
                          {m.status.label}
                        </Badge>
                      </Cell>
                      <Cell className="whitespace-nowrap text-ink-muted">{formatDay(r.updated_at) ?? "—"}</Cell>
                    </tr>
                  );
                })}
              </tbody>
            </DataTable>
          )}
          <div className="px-4 py-3">
            <Caption>{shown.length === 0 ? "0 RFQs" : `1–${formatCount(shown.length)} of ${formatCount(shown.length)}`}</Caption>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Detail ----

export type RfqDoc = {
  id: string;
  product_title: string;
  product_description: string | null;
  quantity: number;
  quantity_unit: string;
  target_unit_price: number | null;
  currency: string;
  ship_to_country: string | null;
  ship_by: string | null;
  status: RfqStatus;
  accepted_quote_id: string | null;
  /** 0106: what the buyer wrote in the composer; absent before it. */
  message?: string | null;
  questions?: string[] | null;
  created_at: string;
  updated_at: string;
  viewer_role: ViewerRole;
  targets: { id: string; slug: string; company_name: string; entity_type: string; city: string | null; district: string | null }[];
  quotes: {
    id: string;
    supplier_id: string;
    supplier_slug: string;
    supplier_name: string;
    supplier_entity_type: string;
    unit_price: number;
    currency: string;
    lead_time_days: number | null;
    moq: number | null;
    valid_until: string | null;
    notes: string | null;
    status: "submitted" | "accepted" | "rejected" | "withdrawn";
    created_at: string;
    updated_at: string;
  }[];
  thread_id: string | null;
};

export type RfqListItem = { id: string; product_title: string; status: RfqStatus; updated_at: string };

const RFQ_STATUS: Record<RfqStatus, { tone: BadgeTone; label: string }> = {
  open: { tone: "type", label: "Open" },
  accepted: { tone: "positive", label: "Accepted" },
  closed: { tone: "type", label: "Closed" },
  cancelled: { tone: "type", label: "Cancelled" },
};

export const QUOTE_STATUS: Record<RfqDoc["quotes"][number]["status"], { tone: BadgeTone; label: string }> = {
  submitted: { tone: "type", label: "Submitted" },
  accepted: { tone: "positive", label: "Accepted" },
  rejected: { tone: "type", label: "Rejected" },
  withdrawn: { tone: "type", label: "Withdrawn" },
};

const notGiven = <span className="text-ink-subtle">Not given</span>;
const dash = <span className="text-ink-subtle">—</span>;

function entityLabel(et: string): string {
  if (et === "factory") return "Factory";
  if (et === "buying_house") return "Buying house";
  return "Supplier";
}

/** The quotes table's column count, for the rows that span it (a note, the accept confirm). */
const QUOTE_COLUMNS = 7;
/** The action column, pinned right: the comparison scrolls sideways under it. */
const QUOTE_ACTION_CELL = "sticky right-0 border-l border-line-subtle bg-surface";

/**
 * The RFQ: the request, the quotes side by side, its status and its
 * suppliers. `pane` draws it beside the list in a sheet with a Close
 * (`closeHref`) and one column; `page` is the full page at `/app/rfqs/[id]`,
 * three columns from `xl`, with the buyer's other RFQs in the side column.
 */
export function RfqDetailBody({
  rfq,
  list,
  mode = "page",
  closeHref = "/app/rfqs",
}: {
  rfq: RfqDoc;
  list: RfqListItem[];
  mode?: "page" | "pane";
  closeHref?: string;
}) {
  const isBuyer = rfq.viewer_role === "buyer" || rfq.viewer_role === "both";
  const canAccept = isBuyer && rfq.status === "open";
  const status = RFQ_STATUS[rfq.status] ?? RFQ_STATUS.closed;
  const pane = mode === "pane";
  const updated = `Updated ${formatDay(rfq.updated_at) ?? "—"}`;

  const facts: { label: string; value: ReactNode }[] = [
    { label: "Product", value: rfq.product_title },
    { label: "Quantity", value: formatQuantity(rfq.quantity, rfq.quantity_unit) ?? notGiven },
    ...(rfq.target_unit_price != null
      ? [{ label: "Target unit price", value: formatMoney(rfq.target_unit_price, rfq.currency) }]
      : []),
    { label: "Ship to", value: rfq.ship_to_country || notGiven },
    { label: "Ship by", value: formatDay(rfq.ship_by) ?? notGiven },
    { label: "Created", value: formatDay(rfq.created_at) ?? "—" },
  ];

  const request = (
    <PageSection title="Request" className={pane ? undefined : "lg:col-start-1 lg:row-start-1"}>
      <DetailList rows={facts} />
      {rfq.product_description ? (
        <div className="flex flex-col gap-1 border-t border-line-subtle px-4 py-3">
          <span className="text-sm font-medium text-ink-muted">Description</span>
          <p className="m-0 whitespace-pre-wrap text-base text-ink [overflow-wrap:anywhere]">{rfq.product_description}</p>
        </div>
      ) : null}
      {rfq.message ? (
        <div className="flex flex-col gap-1 border-t border-line-subtle px-4 py-3">
          <span className="text-sm font-medium text-ink-muted">Message</span>
          <p className="m-0 whitespace-pre-wrap text-base text-ink [overflow-wrap:anywhere]">{rfq.message}</p>
        </div>
      ) : null}
      {rfq.questions && rfq.questions.length > 0 ? (
        <div className="flex flex-col gap-1 border-t border-line-subtle px-4 py-3">
          <span className="text-sm font-medium text-ink-muted">Questions asked</span>
          <ol className="m-0 flex list-decimal flex-col gap-0.5 pl-5 text-base text-ink">
            {rfq.questions.map((q) => (
              <li key={q} className="[overflow-wrap:anywhere]">
                {q}
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </PageSection>
  );

  const quotesTable = (
    <PageSection
      title="Quotes"
      caption={`${formatCount(rfq.quotes.length)} submitted`}
      className={cn("min-w-0", !pane && "lg:col-start-2 lg:row-span-2 lg:row-start-1")}
    >
      {rfq.quotes.length === 0 ? (
        <EmptyState icon="clock" title="No quotes yet">
          Quotes appear here as suppliers answer. You can compare and accept them side by side.
        </EmptyState>
      ) : (
        // Its own sideways scroll at every width: a comparison of seven fixed
        // columns does not fit a pane or the middle of three page columns. The
        // action column is pinned to the right so Accept never scrolls away.
        <DataTable label="Quotes" minWidth="50rem" className="overflow-x-auto [&_table]:table-fixed">
          <thead>
            <tr>
              <HeadCell className="whitespace-nowrap">Supplier</HeadCell>
              <HeadCell align="right" className="w-36 whitespace-nowrap">
                Unit price
              </HeadCell>
              <HeadCell align="right" className="w-24 whitespace-nowrap">
                Lead time
              </HeadCell>
              <HeadCell align="right" className="w-24 whitespace-nowrap">
                MOQ
              </HeadCell>
              <HeadCell align="right" className="w-28 whitespace-nowrap">
                Valid until
              </HeadCell>
              <HeadCell className="w-28 whitespace-nowrap">Status</HeadCell>
              <HeadCell className="w-32 sticky right-0 border-l border-line-subtle bg-surface">
                <span className="sr-only">Action</span>
              </HeadCell>
            </tr>
          </thead>
          <tbody>
            {rfq.quotes.map((q) => {
              const qs = QUOTE_STATUS[q.status] ?? QUOTE_STATUS.withdrawn;
              const price = formatMoney(q.unit_price, q.currency) ?? "—";
              // With a note, the quote and its note read as one row: the rule runs under the note.
              const joined = q.notes ? "border-b-0" : undefined;
              const cells = (
                <>
                  <Cell className={cn("py-2.5", joined)}>
                    <Link
                      prefetch={false}
                      href={`/app/suppliers/${q.supplier_slug}`}
                      className="block max-w-[20rem] font-medium text-ink-strong hover:underline"
                    >
                      <OneLine text={q.supplier_name} />
                    </Link>
                  </Cell>
                  <Cell align="right" className={cn("whitespace-nowrap", joined)}>
                    {price}
                    <span className="text-ink-subtle"> / {rfq.quantity_unit}</span>
                  </Cell>
                  <Cell align="right" className={cn("whitespace-nowrap", joined)}>
                    {q.lead_time_days != null ? `${formatCount(q.lead_time_days)} days` : dash}
                  </Cell>
                  <Cell align="right" className={joined}>
                    {q.moq != null ? formatCount(q.moq) : dash}
                  </Cell>
                  <Cell align="right" className={cn("whitespace-nowrap", joined)}>
                    {formatDay(q.valid_until) ?? dash}
                  </Cell>
                  <Cell className={joined}>
                    <Badge tone={qs.tone}>{qs.label}</Badge>
                  </Cell>
                </>
              );
              const notes = q.notes ? (
                <tr>
                  <td colSpan={QUOTE_COLUMNS} className="border-b border-line-subtle px-4 pb-2.5">
                    <p className="m-0 max-w-prose whitespace-pre-wrap text-xs text-ink-muted [overflow-wrap:anywhere]">{q.notes}</p>
                  </td>
                </tr>
              ) : null;
              if (canAccept && q.status === "submitted") {
                return (
                  <AcceptQuoteRows
                    key={q.id}
                    quoteId={q.id}
                    question={`Accept ${price}/${rfq.quantity_unit} from ${q.supplier_name}?`}
                    colSpan={QUOTE_COLUMNS}
                    cells={cells}
                    after={notes}
                    joined={Boolean(q.notes)}
                  />
                );
              }
              return (
                <Fragment key={q.id}>
                  <tr className={rowClass()}>
                    {cells}
                    <Cell align="right" className={cn(QUOTE_ACTION_CELL, joined)}>
                      {isBuyer && rfq.status === "accepted" && q.status === "accepted" ? (
                        <Button variant="primary" size="sm" href={`/app/orders/new?from_quote=${q.id}`} clientNav>
                          Create order
                        </Button>
                      ) : null}
                    </Cell>
                  </tr>
                  {notes}
                </Fragment>
              );
            })}
          </tbody>
        </DataTable>
      )}
    </PageSection>
  );

  const side = (
    <div className={cn("flex flex-col gap-5", !pane && "lg:col-start-1 lg:row-start-2 xl:col-start-3 xl:row-start-1")}>
      <PageSection title="Status">
        <div className="flex flex-col gap-3 px-4 py-3">
          <span>
            <Badge tone={status.tone}>{status.label}</Badge>
          </span>
          {isBuyer && rfq.thread_id ? (
            <Button href={`/app/messages/${rfq.thread_id}`} clientNav>
              <Icon name="chat" /> Open message thread
            </Button>
          ) : (
            <Caption>No message thread yet.</Caption>
          )}
        </div>
      </PageSection>

      <PageSection title="Suppliers" caption={formatCount(rfq.targets.length)}>
        <ul className="m-0 flex list-none flex-col p-0">
          {rfq.targets.map((s) => (
            <li key={s.id} className="flex flex-col gap-0.5 border-t border-line-subtle px-4 py-2.5 first:border-t-0">
              {/* Two lines, each cut to one (the One-Line Name Rule). */}
              <Link
                prefetch={false}
                href={`/app/suppliers/${s.slug}`}
                className="block min-w-0 text-sm font-medium text-ink-strong hover:underline"
              >
                <OneLine text={splitQualifier(s.company_name).base} title={s.company_name} />
              </Link>
              <Caption className="block min-w-0 truncate">
                {nameSecondLine(s.company_name, entityLabel(s.entity_type))}
                {s.city ? ` · ${s.city}` : ""}
                {s.district ? `, ${s.district}` : ""}
              </Caption>
            </li>
          ))}
        </ul>
      </PageSection>

      {/* The list is beside the pane already; only the full page needs its own. */}
      {!pane && list.length > 1 ? (
        <PageSection title="Other RFQs">
          <nav aria-label="All RFQs">
            <ul className="m-0 flex max-h-80 list-none flex-col overflow-y-auto p-0">
              {list.map((r) => {
                const active = r.id === rfq.id;
                return (
                  <li key={r.id} className="border-t border-line-subtle first:border-t-0">
                    <Link
                      prefetch={false}
                      href={`/app/rfqs/${r.id}`}
                      aria-current={active ? "page" : undefined}
                      className={cn("flex flex-col gap-0.5 px-4 py-2.5 hover:bg-surface-sunken", active && "bg-surface-sunken")}
                    >
                      <span className="text-sm font-medium text-ink-strong [overflow-wrap:anywhere]">{r.product_title}</span>
                      <Caption>
                        {(RFQ_STATUS[r.status] ?? RFQ_STATUS.closed).label} · {formatDay(r.updated_at) ?? "—"}
                      </Caption>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </PageSection>
      ) : null}
    </div>
  );

  if (pane) {
    return (
      <Sheet label={`RFQ: ${rfq.product_title}`}>
        <SheetBar>
          <Button variant="ghost" icon size="sm" aria-label="Close" href={closeHref} clientNav scroll={false}>
            <Icon name="x" />
          </Button>
          <div className="flex min-w-0 flex-1 flex-col">
            <Title as="h2">{rfq.product_title}</Title>
            <Caption>{updated}</Caption>
          </div>
          <Button variant="ghost" size="sm" href={`/app/rfqs/${rfq.id}`} clientNav>
            Full page
          </Button>
        </SheetBar>
        <SheetScroll>
          {/* The page's own ground, so the sections read as they do on the full page. */}
          <div className="flex min-h-full flex-col gap-5 bg-canvas p-4 sm:p-5">
            {request}
            {quotesTable}
            {side}
          </div>
        </SheetScroll>
      </Sheet>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
      {/* The product is the reference; the id is not something a buyer reads. */}
      <PageHeader
        title={rfq.product_title}
        caption={updated}
        actions={
          <Button href="/app/rfqs" clientNav variant="ghost">
            <Icon name="chev-l" /> All RFQs
          </Button>
        }
      />

      {/* Facts left, quotes in the middle, status and suppliers in a side
          column: three columns from `xl`, the side column under the facts below it. */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[20rem_minmax(0,1fr)] lg:items-start xl:grid-cols-[20rem_minmax(0,1fr)_17rem]">
        {request}
        {quotesTable}
        {side}
      </div>
    </div>
  );
}
