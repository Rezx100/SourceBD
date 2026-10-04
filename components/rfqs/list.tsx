// The parts of the RFQ list around its table (Paper `10 · RFQs list`, `· beside a pane`,
// `· empty`, `· loading`, `11 · Quotes tab`): the page header with its status tabs, the
// narrow list beside a pane, the phone's rows, the empty teaching state, the failed read and
// the loading skeleton. Server components; the table itself is the client `RfqTable`.

import { Check, Plus } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { ButtonLink, ErrorPanel, Skeleton, TabLink, buttonClass } from "@/components/kit";
import { cn } from "@/lib/utils";
import { RfqChip } from "./chip";
import { openHref } from "./table";
import { RFQ_TABS, countOf, rfqsHref, type ListItem, type RfqSort, type RfqTab } from "./words";

export const NEW_RFQ_HREF = "/app/rfqs/new";

/** The page header: title, the caption of what is on it, the two ways to start, and the status tabs. */
export function ListHeader({ caption, items, tab, sort }: { caption: string; items: readonly ListItem[]; tab: RfqTab; sort: RfqSort }) {
  return (
    <header className="flex shrink-0 flex-col gap-4 border-b border-line px-6 pt-6 max-md:hidden">
      <div className="flex items-end justify-between gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold tracking-tight text-ink">RFQs</h1>
          <p className="text-base text-ink-3">{caption}</p>
        </div>
        <div className="flex items-center gap-2">
          <ButtonLink href="/app/discover" kind="secondary" prefetch={false}>
            Find suppliers
          </ButtonLink>
          <ButtonLink href={NEW_RFQ_HREF} kind="primary" icon={Plus} prefetch={false}>
            New RFQ
          </ButtonLink>
        </div>
      </div>
      {items.length > 0 ? (
        <nav aria-label="RFQ status" className="-mx-3 flex flex-wrap gap-3">
          {RFQ_TABS.map((t) => (
            <TabLink key={t.key} href={rfqsHref(t.key, null, sort)} current={t.key === tab} count={countOf(items, t.key)} prefetch={false}>
              {t.label}
            </TabLink>
          ))}
        </nav>
      ) : null}
    </header>
  );
}

/** The bar over the narrow list beside a pane: what is listed and the one way to start. */
export function PaneListHead({ title, count }: { title: string; count: number }) {
  return (
    <div className="flex h-14 shrink-0 items-center justify-between border-b border-line px-4">
      <h1 className="text-md font-semibold text-ink">
        {title} · {count}
      </h1>
      <ButtonLink href={NEW_RFQ_HREF} kind="primary" prefetch={false}>
        New RFQ
      </ButtonLink>
    </div>
  );
}

/** Beside a pane: the title and one line, the chip on the right; the open row has the brand bar. A long title wraps. */
export function RfqPaneRows({ items, tab, sort, currentId }: { items: readonly ListItem[]; tab: RfqTab; sort: RfqSort; currentId: string | null }) {
  return (
    <ul>
      {items.map((i) => {
        const current = i.id === currentId;
        return (
          <li key={`${i.kind}:${i.id}`}>
            <Link
              href={openHref(i, tab, sort)}
              prefetch={false}
              scroll={false}
              aria-current={current ? "true" : undefined}
              className={cn(
                "flex min-h-14 items-start gap-3 border-b border-l-2 border-line py-2.5 pl-3.5 pr-4 outline-none hover:bg-brand-wash focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand",
                current ? "border-l-brand bg-brand-tint" : "border-l-transparent",
              )}
            >
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-base font-medium text-ink">{i.title}</span>
                <span className={cn("text-sm", i.best || current ? "text-ink-2" : "text-ink-3")}>{i.paneLine}</span>
              </span>
              <RfqChip tone={i.chip.tone}>{i.chip.label}</RfqChip>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** On a phone a row opens the RFQ as a page: the title and chip, the best price large, who it went to. */
export function RfqPhoneRows({ items }: { items: readonly ListItem[] }) {
  return (
    <ul>
      {items.map((i) => (
        <li key={`${i.kind}:${i.id}`}>
          <Link
            href={i.kind === "draft" ? `${NEW_RFQ_HREF}?draft=${encodeURIComponent(i.id)}` : `/app/rfqs/${i.id}`}
            prefetch={false}
            className="flex min-h-11 flex-col gap-2 border-b border-line px-4 py-4 outline-none hover:bg-brand-wash focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand"
          >
            <span className="flex items-start justify-between gap-3">
              <span className="text-md font-medium text-ink">{i.title}</span>
              <RfqChip tone={i.chip.tone}>{i.chip.label}</RfqChip>
            </span>
            {i.best ? (
              <span className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-xl font-semibold tracking-tight text-ink">{i.best.price.replace(/ per .*$/, "")}</span>
                <span className="text-base text-ink-2">
                  {i.best.price.replace(/^.* per /, "per ")}
                  {i.best.versus ? ` · ${i.best.versus.replace(/ target$/, " your target")}` : ""}
                </span>
              </span>
            ) : null}
            {i.phoneLines.map((l) => (
              <span key={l} className="text-sm text-ink-3">
                {l}
              </span>
            ))}
            {i.moqNote ? (
              <span className="text-sm font-medium text-caution">{i.moqNote}</span>
            ) : null}
            {i.chipNote && !i.best && i.tab !== "waiting" && i.kind !== "draft" ? <span className="text-sm text-ink-3">{i.chipNote}</span> : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Quotes and orders on a phone are one tab: this is its switch (Paper `11 · Quotes tab`). Each side is a page of its own. */
export function QuotesSwitch({ current, rfqs, orders, newHref = NEW_RFQ_HREF }: { current: "rfqs" | "orders"; rfqs: number | null; orders: number | null; newHref?: string }) {
  const tile = (on: boolean) =>
    cn(
      "flex h-11 flex-1 items-center justify-center rounded-md text-md font-medium outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
      on ? "border border-line-strong bg-surface text-ink" : "text-ink-2",
    );
  return (
    <div className="flex flex-col gap-3 px-4 pb-3 pt-3 md:hidden">
      <div className="flex justify-end">
        <Link href={newHref} prefetch={false} className="inline-flex min-h-11 items-center rounded-sm px-1 text-md font-semibold text-brand outline-none hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
          New RFQ
        </Link>
      </div>
      <nav aria-label="Quotes and orders" className="flex gap-1 rounded-lg bg-sunken p-1">
        <Link href="/app/rfqs" prefetch={false} aria-current={current === "rfqs" ? "page" : undefined} className={tile(current === "rfqs")}>
          RFQs{rfqs !== null ? ` · ${rfqs}` : ""}
        </Link>
        <Link href="/app/orders" prefetch={false} aria-current={current === "orders" ? "page" : undefined} className={tile(current === "orders")}>
          Orders{orders !== null ? ` · ${orders}` : ""}
        </Link>
      </nav>
    </div>
  );
}

const PROMISES = ["Each quote shows how far it is above or under your target.", "We flag any MOQ that is above your quantity.", "Each supplier gets its own copy. Your email stays private."];

/** No RFQs yet (`10 · RFQs empty`): what it is for, three promises that are true of the product, and the way to start. */
export function RfqEmpty() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex shrink-0 flex-col gap-1 border-b border-line px-6 py-6 max-md:hidden">
        <h1 className="text-xl font-semibold tracking-tight text-ink">RFQs</h1>
        <p className="text-base text-ink-3">Ask suppliers for prices and compare their quotes here.</p>
      </header>
      <div className="flex max-w-prose flex-col gap-4 px-6 py-12 max-md:px-4 max-md:py-8">
        <h2 className="text-xl font-semibold tracking-tight text-ink">No RFQs yet</h2>
        <p className="text-md text-ink-2">Send one RFQ to up to 50 suppliers. Their quotes line up here, against your target price.</p>
        <ul className="flex flex-col gap-3">
          {PROMISES.map((p) => (
            <li key={p} className="flex items-start gap-3 text-base text-ink-2">
              <Check size={20} className="mt-px shrink-0 text-brand" aria-hidden />
              {p}
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2 pt-2">
          <Link href="/app/discover" prefetch={false} className={buttonClass({ kind: "primary", size: "lg", className: "max-md:h-input-touch" })}>
            Find suppliers
          </Link>
          <Link href={NEW_RFQ_HREF} prefetch={false} className={buttonClass({ kind: "secondary", size: "lg", className: "max-md:h-input-touch" })}>
            New RFQ
          </Link>
        </div>
      </div>
    </div>
  );
}

/** A tab with nothing under it. */
export function TabEmpty({ tab }: { tab: Exclude<RfqTab, "all"> }) {
  const words: Record<Exclude<RfqTab, "all">, string> = {
    draft: "A draft is kept when you close the RFQ composer before sending.",
    waiting: "An RFQ waits here until its first quote arrives.",
    quoted: "An RFQ moves here when a supplier sends a quote.",
    accepted: "An RFQ moves here when you accept a quote.",
    closed: "A cancelled or closed RFQ is kept here.",
  };
  const label = RFQ_TABS.find((t) => t.key === tab)!.label.toLowerCase();
  return (
    <div className="flex flex-col gap-1 px-6 py-10">
      <p className="text-md font-semibold text-ink">No {label} RFQs</p>
      <p className="text-base text-ink-2">{words[tab]}</p>
    </div>
  );
}

/** `rfq_list` failed. "No RFQs yet" would be a claim about the account that a failed read cannot make. */
export function RfqListError({ retryHref }: { retryHref: string }) {
  return (
    <div className="p-6 max-md:p-4">
      <ErrorPanel
        title="We couldn't load your RFQs."
        retry={
          <Link href={retryHref} prefetch={false} className={buttonClass({ kind: "primary" })}>
            Try again
          </Link>
        }
      >
        Nothing has been lost. Your RFQs and their quotes are safe.
      </ErrorPanel>
    </div>
  );
}

/** The table's silhouette while the list loads (`10 · RFQs loading`). */
export function RfqListSkeleton() {
  const names = [280, 220, 300, 190, 250, 280];
  return (
    <div role="status" aria-busy="true" aria-label="Loading RFQs" className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-col gap-4 border-b border-line px-6 pb-4 pt-6 max-md:hidden">
        <div className="flex items-start justify-between gap-6">
          <div className="flex flex-col gap-2">
            <h1 className="text-xl font-semibold tracking-tight text-ink">RFQs</h1>
            <Skeleton className="h-3 w-[200px]" />
          </div>
          <ButtonLink href={NEW_RFQ_HREF} kind="primary" prefetch={false}>
            New RFQ
          </ButtonLink>
        </div>
        <div className="flex gap-6" aria-hidden>
          {[48, 56, 64, 56].map((w, i) => (
            <Skeleton key={i} className="h-3" style={{ width: w }} />
          ))}
        </div>
      </div>
      <div className="mx-6 hidden h-row-head items-center border-b border-line bg-subtle px-3 text-xs font-medium text-ink-3 md:flex">
        <span className="w-[360px]">RFQ</span>
        <span className="w-[110px]">Sent to</span>
        <span className="w-[200px]">Status</span>
        <span className="w-[250px]">Best quote vs your target</span>
        <span className="w-[130px]">Ship by</span>
        <span className="w-32">Sent</span>
      </div>
      <div className="mx-6 max-md:mx-4" aria-hidden>
        {names.map((w, i) => (
          <div key={i} className="flex h-14 items-center gap-6 border-b border-line px-3 max-md:flex-col max-md:items-start max-md:justify-center max-md:gap-2 max-md:px-0">
            <div className="flex w-[336px] shrink-0 flex-col gap-1.5 max-md:w-full">
              <Skeleton className="h-3" style={{ width: w }} />
              <Skeleton tone="subtle" className="h-2.5 w-[180px]" />
            </div>
            <Skeleton className="h-3 w-[72px] shrink-0 max-md:hidden" />
            <Skeleton className="h-6 w-24 shrink-0 max-md:hidden" />
            <Skeleton className="h-3 w-40 shrink-0 max-md:hidden" />
            <Skeleton className="h-3 w-20 shrink-0 max-md:hidden" />
          </div>
        ))}
      </div>
    </div>
  );
}

