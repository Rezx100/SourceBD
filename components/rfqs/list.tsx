// The parts of the RFQ list around its table (Paper `10 · RFQs list`, `· beside a pane`,
// `· empty`, `· loading`, `11 · Quotes tab`): the page header with its status tabs, the
// narrow list beside a pane, the phone's rows, the empty teaching state, the failed read and
// the loading skeleton. Server components; the table itself is the client `RfqTable`.

import type { Icon } from "@phosphor-icons/react";
import { CaretRight, ChatCircle, Check, CheckCircle, Clock, MagnifyingGlass, PencilSimple, Plus, Receipt, Warning, XCircle } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { ButtonLink, ErrorPanel, Skeleton, TabLink, buttonClass } from "@/components/kit";
import { LinkPending } from "@/components/patterns/link-pending";
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
                "flex min-h-14 items-start gap-3 border-b border-l-2 border-line py-2.5 pl-3.5 pr-4 outline-none hover:bg-brand-wash focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus",
                current ? "border-l-brand-ink bg-brand-tint" : "border-l-transparent",
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

/** The small line over a phone row's title: what kind of thing it is and where it stands (Paper 36 `rfqs`). */
function rowTag(i: ListItem): { icon: Icon; label: string; brand: boolean } {
  const tag = (icon: Icon, label: string, brand = false) => ({ icon, label: i.asSupplier ? `${label} · as supplier` : label, brand });
  if (i.kind === "draft") return tag(PencilSimple, `Draft${i.chipNote ? ` · ${i.chipNote.charAt(0).toLowerCase()}${i.chipNote.slice(1)}` : ""}`);
  if (i.tab === "accepted") return tag(CheckCircle, "Quote accepted", true);
  if (i.tab === "closed") return tag(XCircle, i.chip.label);
  if (i.tab === "waiting") return tag(Clock, `RFQ${i.chipNote ? ` · ${i.chipNote}` : ""}`);
  return tag(ChatCircle, `RFQ · ${i.chip.label}`);
}

/** On a phone a row opens the RFQ as a page (Paper 36 `rfqs`): the tag, the title, the best price large against the target, the MOQ caution in words. */
export function RfqPhoneRows({ items }: { items: readonly ListItem[] }) {
  return (
    <div className="px-5 pb-6 pt-4">
      <ul className="flex flex-col overflow-clip rounded-[10px] border border-line">
        {items.map((i) => {
          const t = rowTag(i);
          const versus = i.best?.versus?.replace(/ target$/, "") ?? null;
          return (
            <li key={`${i.kind}:${i.id}`} className="border-t border-line first:border-t-0">
              <Link
                href={i.kind === "draft" ? `${NEW_RFQ_HREF}?draft=${encodeURIComponent(i.id)}` : `/app/rfqs/${i.id}`}
                prefetch={false}
                className="flex flex-col gap-2.5 p-4 outline-none active:bg-sunken focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus"
              >
                <span className="flex items-center justify-between gap-2">
                  <span className={cn("flex min-w-0 items-center gap-1.5 text-xs font-medium", t.brand ? "text-brand-ink" : "text-ink-3")}>
                    <t.icon size={16} weight="thin" className={cn("shrink-0", t.brand ? "text-brand-ink" : "text-ink-3")} aria-hidden />
                    {t.label}
                  </span>
                  <span className="flex shrink-0 items-center gap-1">
                    <LinkPending />
                    <CaretRight size={16} weight="thin" className="shrink-0 text-ink-3" aria-hidden />
                  </span>
                </span>
                <span className="text-md/[22px] font-medium text-ink">{i.title}</span>
                {i.best && i.tab !== "accepted" ? (
                  <span className="flex w-full items-baseline gap-2">
                    <span className="w-max shrink-0 text-xl/[30px] font-medium tracking-tighter tabular-nums text-ink">{i.best.price.replace(/ per .*$/, "")}</span>
                    <span className="min-w-0 text-sm/[16px] text-ink-3">
                      {i.best.price.replace(/^.* per /, "per ")}
                      {i.best.supplier ? ` · ${i.best.supplier}` : ""}
                    </span>
                    <span className="grow basis-0" />
                    {versus ? (
                      <span className={cn("flex h-6 shrink-0 items-center gap-1 self-center rounded-full pl-1.5 pr-2 text-xs font-medium", i.best.over ? "bg-caution-tint text-caution" : "bg-brand-tint text-brand-ink")}>
                        {i.best.over ? <Warning size={14} weight="thin" className="shrink-0 text-caution-icon" aria-hidden /> : <CheckCircle size={14} weight="thin" className="shrink-0 text-brand-ink" aria-hidden />}
                        <span className="w-max">{versus}</span>
                      </span>
                    ) : null}
                  </span>
                ) : null}
                {i.phoneLines.map((l, n) => (
                  <span key={l} className={n === 0 && !(i.best && i.tab !== "accepted") ? "text-sm text-ink-2" : "text-xs text-ink-3"}>
                    {l}
                  </span>
                ))}
                {i.moqNote ? (
                  <span className="flex items-center gap-1.5 text-sm text-caution">
                    <Warning size={14} weight="thin" className="shrink-0 text-caution-icon" aria-hidden />
                    {i.moqNote}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Quotes and orders on a phone are one tab (Paper 36 `rfqs`, `orders`): two underlined tabs with
 * their counts under the frame's bar, and the one way to start on the right. Each side is a page.
 */
export function QuotesSwitch({ current, rfqs, orders, newHref = NEW_RFQ_HREF, newLabel = "New RFQ" }: { current: "rfqs" | "orders"; rfqs: number | null; orders: number | null; newHref?: string; newLabel?: string }) {
  const tab = (key: "rfqs" | "orders", label: string, count: number | null) => {
    const on = current === key;
    return (
      <Link
        href={`/app/${key}`}
        aria-current={on ? "page" : undefined}
        className="relative flex shrink-0 items-center gap-1.5 px-2 outline-none active:bg-sunken focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus"
      >
        <span className={`text-md/[20px] font-medium ${on ? "text-ink" : "text-ink-3"}`}>{label}</span>
        {count !== null ? (
          <span className="text-sm/[16px] text-ink-3">
            <span className="sr-only"> · </span>
            {count}
          </span>
        ) : null}
        {on ? <span aria-hidden className="absolute inset-x-2 -bottom-px h-0.5 rounded-t-[2px] bg-ink" /> : null}
      </Link>
    );
  };
  return (
    <div className="flex h-12 shrink-0 items-stretch gap-1 border-b border-line px-3 md:hidden">
      <nav aria-label="Quotes and orders" className="flex gap-1">
        {tab("rfqs", "RFQs", rfqs)}
        {tab("orders", "Orders", orders)}
      </nav>
      <Link href={newHref} className="group ml-auto flex items-center rounded-full outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus">
        <span className="flex h-9 items-center gap-1.5 rounded-full bg-sunken pl-2.5 pr-3.5 group-active:bg-line">
          <Plus size={16} weight="thin" className="shrink-0 text-ink" aria-hidden />
          <span className="text-base/[18px] font-medium text-ink">{newLabel}</span>
        </span>
      </Link>
    </div>
  );
}

const PROMISES = ["Each quote shows how far it is above or under your target.", "We flag any MOQ that is above your quantity.", "Each supplier gets its own copy. Your email stays private."];

/** The phone's "No RFQs yet" (Paper 36 `rfqs-empty`): how a quote starts, in three steps, and the search. */
export const RFQ_EMPTY_PHONE = {
  lead: "Ask one supplier from its record, or up to 50 at once from Saved. Quotes come back here, side by side.",
  steps: ["Find suppliers in Search", "Save the ones you like", "Send one RFQ to all of them"],
} as const;

/** No RFQs yet (`10 · RFQs empty`, phone 36 `rfqs-empty`): what it is for, three promises that are true of the product, and the way to start. */
export function RfqEmpty() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex shrink-0 flex-col gap-1 border-b border-line px-6 py-6 max-md:hidden">
        <h1 className="text-xl font-semibold tracking-tight text-ink">RFQs</h1>
        <p className="text-base text-ink-3">Ask suppliers for prices and compare their quotes here.</p>
      </header>
      <div className="flex max-w-prose flex-col gap-4 px-6 py-12 max-md:hidden">
        <h2 className="text-xl font-semibold tracking-tight text-ink">No RFQs yet</h2>
        <p className="text-md text-ink-2">Send one RFQ to up to 50 suppliers. Their quotes line up here, against your target price.</p>
        <ul className="flex flex-col gap-3">
          {PROMISES.map((p) => (
            <li key={p} className="flex items-start gap-3 text-base text-ink-2">
              <Check size={20} className="mt-px shrink-0 text-brand-ink" aria-hidden />
              {p}
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2 pt-2">
          <Link href="/app/discover" prefetch={false} className={buttonClass({ kind: "primary", size: "lg" })}>
            Find suppliers
          </Link>
          <Link href={NEW_RFQ_HREF} prefetch={false} className={buttonClass({ kind: "secondary", size: "lg" })}>
            New RFQ
          </Link>
        </div>
      </div>
      <div className="flex flex-col gap-5 px-5 pb-8 pt-10 md:hidden">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-sunken">
          <Receipt size={24} weight="thin" className="shrink-0 text-ink-2" aria-hidden />
        </span>
        <div className="flex flex-col gap-2">
          <h2 className="text-xl/[30px] font-medium tracking-tighter text-ink">No RFQs yet</h2>
          <p className="text-[15px]/[22px] text-ink-2">{RFQ_EMPTY_PHONE.lead}</p>
        </div>
        <ol className="flex flex-col overflow-clip rounded-[10px] border border-line">
          {RFQ_EMPTY_PHONE.steps.map((step, n) => (
            <li key={step} className="flex min-h-[52px] items-center gap-3 border-t border-line px-4 py-2 first:border-t-0">
              <span className="w-6 shrink-0 text-base font-medium text-ink-3">{n + 1}</span>
              <span className="grow basis-0 text-[15px]/[22px] text-ink">{step}</span>
            </li>
          ))}
        </ol>
        {/* Class strings, not `cn`: tailwind-merge reads `text-md/[20px]` as a colour and would drop one. */}
        <Link href="/app/discover" className="flex h-12 items-center justify-center gap-1.5 rounded-lg bg-brand text-md/[20px] font-medium text-brand-on outline-none active:bg-brand-active focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
          <MagnifyingGlass size={18} weight="thin" className="shrink-0" aria-hidden />
          Search suppliers
        </Link>
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

