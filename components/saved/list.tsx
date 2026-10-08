// The parts of Saved around its table (Paper `10 · Saved`, `· saved searches`, `10 · States`,
// `11 · Saved`): the header with its sort and the two tabs, the phone's two-part switch, the narrow
// list beside a pane, the empty teaching state, the failed read and the loading skeleton. Server
// components; the table, the phone list and the bars are client (`table.tsx`, `phone.tsx`).

import { BookmarkSimple, CaretDown, Check, MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { CertCellView } from "./table";
import { DownloadCsv } from "@/components/export/download-csv";
import { ErrorPanel, Menu, MenuItem, Pagination, Skeleton, TabLink, buttonClass } from "@/components/kit";
import { SupplierRow } from "@/components/patterns";
import { cn } from "@/lib/utils";
import { PAGE_SIZE, SAVED_SORTS, SEARCHES_HREF, savedCaption, savedExportHref, savedHref, searchesCaption, tabLabels, type SavedItem, type SavedSort, type SavedView } from "./words";

export type Tab = "suppliers" | "searches";

/** The count a tab carries as a number, so `TabLink` prints "Suppliers · 11". */
const num = (n: number | null) => (n === null ? undefined : n);

/** "Sort: recently saved" and its menu: the page sorted that way, in the address. */
export function SortMenu({ view }: { view: SavedView }) {
  const current = SAVED_SORTS.find((o) => o.value === view.sort)!;
  return (
    <Menu
      align="end"
      trigger={
        <button type="button" className={buttonClass({ kind: "secondary", className: "gap-2 pl-2.5 pr-2 font-normal" })}>
          Sort: {current.label.toLowerCase()}
          <CaretDown size={16} className="shrink-0 text-ink-2" aria-hidden />
        </button>
      }
    >
      {SAVED_SORTS.map((o) => (
        <MenuItem key={o.value} href={savedHref({ ...view, sort: o.value as SavedSort, page: 1, open: null })}>
          <span className="flex items-center gap-2">
            <span className="flex size-4 shrink-0 items-center justify-center">{o.value === view.sort ? <Check size={16} className="text-brand-ink" aria-label="Sorted by" /> : null}</span>
            {o.label}
          </span>
        </MenuItem>
      ))}
    </Menu>
  );
}

/** The header on every Saved page: title, caption, the sort where there is one, and the two tabs. */
export function SavedHead({ tab, suppliers, searches, caption, view, capped }: { tab: Tab; suppliers: number | null; searches: number | null; caption?: string; view: SavedView; capped?: boolean }) {
  const text = caption ?? (tab === "suppliers" ? savedCaption(suppliers) : searchesCaption(searches, capped));
  return (
    <header className="flex shrink-0 flex-col gap-3 border-b border-line px-6 pt-5 max-md:hidden">
      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-xl font-semibold tracking-tight text-ink">Saved</h1>
          <p className="text-base text-ink-3">{text}</p>
        </div>
        {tab === "suppliers" && suppliers !== 0 ? (
          <div className="flex items-center gap-2">
            <DownloadCsv href={savedExportHref(view.sort)} />
            <SortMenu view={view} />
          </div>
        ) : null}
      </div>
      <nav aria-label="Saved" className="-mx-3 flex flex-wrap gap-3">
        <TabLink href="/app/saved" current={tab === "suppliers"} count={num(suppliers)} prefetch={false}>
          Suppliers
        </TabLink>
        <TabLink href={SEARCHES_HREF} current={tab === "searches"} count={num(searches)} prefetch={false}>
          Saved searches
        </TabLink>
      </nav>
    </header>
  );
}

/** On a phone the two tabs are one two-part switch (`11 · Saved`). */
export function PhoneTabs({ tab, suppliers, searches }: { tab: Tab; suppliers: number | null; searches: number | null }) {
  const l = tabLabels(suppliers, searches);
  const item = (key: Tab, href: string, label: string, first: boolean) => (
    <Link
      href={href}
      prefetch={false}
      aria-current={tab === key ? "page" : undefined}
      className={cn(
        "flex flex-1 items-center justify-center text-md outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus",
        !first && "border-l border-line-strong",
        tab === key ? "bg-brand-tint font-semibold text-ink" : "font-medium text-ink-2",
      )}
    >
      {label}
    </Link>
  );
  return (
    <nav aria-label="Saved" className="flex px-4 pb-2 pt-1 md:hidden">
      <div className="flex h-[46px] flex-1 overflow-clip rounded-md border border-line-strong">
        {item("suppliers", "/app/saved", l.suppliers, true)}
        {item("searches", SEARCHES_HREF, l.phoneSearches, false)}
      </div>
    </nav>
  );
}

/** Beside a pane: name, type and place, the first certificate to check, the source count. */
export function SavedPaneRows({ items, currentSlug }: { items: readonly SavedItem[]; currentSlug: string | null }) {
  return (
    <ul>
      {items.map((i) => (
        <li key={i.id}>
          <SupplierRow layout="pane" href={i.paneHref} name={i.name} type={i.type} place={i.place} sources={i.sources} problem={<CertCellView cell={i.cert} />} selected={i.slug === currentSlug} />
        </li>
      ))}
    </ul>
  );
}

/** "Showing 1–24 of 57 suppliers · Page 1 of 3". */
export function SavedFooter({ view, shown, total }: { view: SavedView; shown: number; total: number }) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = (view.page - 1) * PAGE_SIZE + 1;
  return (
    <div className="px-6 pb-4 max-md:px-0">
      <Pagination
        noun="suppliers"
        from={from}
        to={from + shown - 1}
        total={total}
        page={view.page}
        pages={pages}
        prevHref={view.page > 1 ? savedHref({ ...view, page: view.page - 1, open: null }) : undefined}
        nextHref={view.page < pages ? savedHref({ ...view, page: view.page + 1, open: null }) : undefined}
      />
    </div>
  );
}

/** No saved suppliers (`10 · States · Saved empty`): what a saved list gets you, and the way to start. */
export function SavedEmpty() {
  return (
    <div className="px-6 py-8 max-md:px-4">
      <div className="flex max-w-[528px] flex-col gap-3 rounded-lg border border-line p-6">
        <BookmarkSimple size={24} className="shrink-0 text-ink-2" aria-hidden />
        <h2 className="text-lg font-semibold text-ink">No saved suppliers yet.</h2>
        <p className="text-base text-ink-2">Save suppliers to check them here. A saved list gets you:</p>
        <ul className="flex flex-col gap-1.5 text-base text-ink">
          <li>· A warning before any certificate expires</li>
          <li>· One RFQ to up to 50 suppliers at once</li>
          <li>· UFLPA checks and a modern slavery statement draft</li>
        </ul>
        <div className="pt-1">
          <Link href="/app" prefetch={false} className={buttonClass({ kind: "primary", size: "lg", className: "max-md:h-input-touch max-md:w-full" })}>
            Search suppliers
          </Link>
        </div>
      </div>
    </div>
  );
}

/** A page number past the end of a list that has suppliers. */
export function SavedPastEnd({ firstHref }: { firstHref: string }) {
  return (
    <div className="flex max-w-pane flex-col gap-3 px-6 py-12 max-md:px-4">
      <h2 className="text-lg font-semibold text-ink">That page is past the end of your saved list.</h2>
      <p className="text-md text-ink-2">Your saved list is shorter than this page number.</p>
      <div className="pt-2">
        <Link href={firstHref} prefetch={false} className={buttonClass({ kind: "secondary", size: "lg" })}>
          Back to the first page
        </Link>
      </div>
    </div>
  );
}

/** `buyer_saved_list` failed. "No saved suppliers yet" would be a claim about the account that a failed read cannot make. */
export function SavedError({ retryHref }: { retryHref: string }) {
  return (
    <div className="p-6 max-md:p-4">
      <ErrorPanel
        title="We couldn't load your saved suppliers."
        retry={
          <Link href={retryHref} prefetch={false} className={buttonClass({ kind: "primary", className: "max-md:h-input-touch" })}>
            Try again
          </Link>
        }
      >
        Nothing has been removed. Your saved suppliers are safe.
      </ErrorPanel>
    </div>
  );
}

/** The saved searches could not be read. */
export function SearchesError({ retryHref }: { retryHref: string }) {
  return (
    <div className="p-6 max-md:p-4">
      <ErrorPanel
        title="We couldn't load your saved searches."
        retry={
          <Link href={retryHref} prefetch={false} className={buttonClass({ kind: "primary", className: "max-md:h-input-touch" })}>
            Try again
          </Link>
        }
      >
        Nothing has been removed. Your saved searches are safe.
      </ErrorPanel>
    </div>
  );
}

/** No saved searches (`10 · States · Saved searches empty`). */
export function SearchesEmpty() {
  return (
    <div className="px-6 py-8 max-md:px-4">
      <div className="flex max-w-[528px] flex-col gap-3 rounded-lg border border-line p-6">
        <MagnifyingGlass size={24} className="shrink-0 text-ink-2" aria-hidden />
        <h2 className="text-lg font-semibold text-ink">No saved searches yet.</h2>
        <p className="text-base text-ink-2">Save a search to run it again in one click and see how many suppliers match it today.</p>
        <div className="pt-1">
          <Link href="/app" prefetch={false} className={buttonClass({ kind: "primary", size: "lg", className: "max-md:h-input-touch max-md:w-full" })}>
            Search suppliers
          </Link>
        </div>
      </div>
    </div>
  );
}

/** The saved list while it loads: the table's own silhouette (the phone's rows under 768). */
export function SavedSkeleton() {
  const widths = [220, 180, 240, 200, 160, 230, 190, 210];
  return (
    <div role="status" aria-busy="true" aria-label="Loading saved suppliers" className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-col gap-3 border-b border-line px-6 pb-4 pt-5 max-md:hidden">
        <h1 className="text-xl font-semibold tracking-tight text-ink">Saved</h1>
        <Skeleton className="h-3 w-[200px]" />
      </div>
      <div className="mx-6 mt-4 hidden h-row-head items-center border-b border-line bg-subtle px-3 text-xs font-medium text-ink-3 md:flex">
        <span className="w-[330px] pl-10">Supplier</span>
        <span className="w-[150px]">Type and district</span>
        <span className="w-[100px] text-right">Workers</span>
        <span className="w-[84px] text-right">Sources</span>
        <span className="flex-1 pl-6">First certificate to check</span>
      </div>
      <div className="mx-6 max-md:mx-0" aria-hidden>
        {widths.map((w, i) => (
          <div key={i} className="flex h-row items-center gap-6 border-b border-line pl-[52px] pr-3 max-md:h-auto max-md:flex-col max-md:items-start max-md:gap-2 max-md:px-4 max-md:py-4">
            <Skeleton className="h-3 shrink-0" style={{ width: w }} />
            <Skeleton tone="subtle" className="h-3 w-[120px] shrink-0 md:hidden" />
            <Skeleton className="h-3 w-[70px] shrink-0 max-md:hidden" />
            <Skeleton className="h-3 shrink-0 max-md:hidden" style={{ width: 80 + (i % 3) * 15 }} />
          </div>
        ))}
      </div>
    </div>
  );
}
