// The search landing (Paper `10 · Search landing v2 · search first, compact` and `11 · Search
// landing`). Search first (founder's walkthrough, 6 Oct 2026: "there is no search input field,
// only this information everywhere"): one large field, the filter menus under it with their
// icons, and the common searches as a row of chips with how many suppliers each finds. Under
// that, the work queue: the certificates that need a look beside the buyer's recent and saved
// searches. The topbar steps its own field aside here (`topbar-search-slot.tsx`), so this field
// is the one Ctrl K reaches. No supplier is listed until the buyer asks.
// Server component; the counts stream in behind the page so nothing waits on them.

import { Buildings, CaretRight, MagnifyingGlass, MapPin, SealCheck, TShirt } from "@phosphor-icons/react/dist/ssr";
import Form from "next/form";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { NeedsAttention, type AttentionItem } from "@/components/patterns";
import { InlineError, Skeleton, buttonClass, linkClass } from "@/components/kit";
import { ring } from "@/components/kit/classes";
import { SearchShortcut } from "@/components/frame/search-shortcut";
import { ShortcutHint } from "@/components/frame/topbar-search-slot";
import { attentionWords, type Attention } from "@/lib/dashboard/needs-attention";
import { SEARCH_TEMPLATES, filterMenus, templateHref } from "@/lib/dashboard/search-templates";
import { DISCOVER_PATH, EMPTY_STATE, discoverHref } from "@/lib/discover-v32-state";
import type { SavedSearchJson } from "@/lib/saved-searches";
import { cn } from "@/lib/utils";
import { PendingNav } from "./pending-nav";
import { FilterMenuButton } from "./toolbar";
import { RecentSearches } from "./recent";
import { SearchCombobox } from "./typeahead";
import { Count, LinkRow, LinkRows, h2, supplierCount } from "./rows";

const MENU_ICON: Record<string, ReactNode> = {
  product: <TShirt size={16} weight="fill" className="shrink-0 text-ink-2" aria-hidden />,
  certificate: <SealCheck size={16} weight="fill" className="shrink-0 text-ink-2" aria-hidden />,
  place: <MapPin size={16} weight="fill" className="shrink-0 text-ink-2" aria-hidden />,
  type: <Buildings size={16} weight="fill" className="shrink-0 text-ink-2" aria-hidden />,
};

async function ChipCount({ counts, k }: { counts: Promise<Record<string, number | null>>; k: string }) {
  const n = (await counts)[k];
  // An unread count says nothing: "0" is a claim.
  if (typeof n !== "number") return null;
  return (
    <span className="text-xs text-ink-3">
      {n.toLocaleString("en-GB")}
      <span className="sr-only"> {n === 1 ? "supplier" : "suppliers"}</span>
    </span>
  );
}

/** The common searches, one chip each with how many suppliers it finds. */
function CommonSearches({ counts }: { counts: Promise<Record<string, number | null>> }) {
  return (
    // One row that scrolls sideways on a phone; wraps from `sm`.
    <nav aria-label="Common searches" className="-mx-4 flex items-center gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
      <span className="shrink-0 pr-1 text-sm text-ink-3">Try</span>
      {SEARCH_TEMPLATES.map((t) => (
        <Link
          key={t.key}
          href={templateHref(t)}
          prefetch={false}
          title={t.blurb}
          className={cn("inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-subtle px-3 text-sm text-ink-2 transition-colors duration-fast hover:bg-sunken hover:text-ink", ring)}
        >
          {t.title}
          <Suspense fallback={<Skeleton className="h-2.5 w-7" />}>
            <ChipCount counts={counts} k={t.key} />
          </Suspense>
        </Link>
      ))}
    </nav>
  );
}

/** The one search field: 48 tall on a phone, 56 from `sm`, with its button. */
function SearchField() {
  return (
    <Form action={DISCOVER_PATH} role="search" aria-label="Search" className="relative">
      <div className="flex h-input-touch items-center gap-3 rounded-md border border-line-strong bg-surface pl-3.5 pr-1.5 shadow-sm transition-colors duration-fast hover:border-ink-3 focus-within:border-brand-ink focus-within:[box-shadow:inset_0_0_0_1px_theme(colors.brand-ink)] sm:h-14 sm:rounded-lg sm:pl-4">
        <MagnifyingGlass size={20} className="shrink-0 text-ink-3" aria-hidden />
        <Suspense fallback={<input type="search" name="q" data-search="topbar" autoComplete="off" placeholder="Supplier, product or certificate" aria-label="Search" className="min-w-0 flex-1 bg-transparent text-md text-ink outline-none placeholder:text-ink-3" />}>
          <SearchCombobox variant="phone" placeholder="Supplier, product or certificate" shortcutTarget />
        </Suspense>
        <ShortcutHint />
        <button type="submit" className={buttonClass({ kind: "primary", size: "lg", className: "max-sm:hidden sm:h-11 sm:px-5 sm:font-semibold" })}>
          Search
        </button>
      </div>
      <SearchShortcut />
    </Form>
  );
}

async function SavedSearches({ saved }: { saved: Promise<SavedSearchJson[] | null> }) {
  const list = await saved;
  if (list === null) return null;
  if (list.length === 0) return <p className="text-sm text-ink-3">No saved searches yet. Save a search to hear when new suppliers match it.</p>;
  return (
    <section aria-labelledby="saved-searches" className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <h2 id="saved-searches" className={h2}>
          Saved searches
        </h2>
        <Link href="/app/searches" prefetch={false} className={cn(linkClass, "text-sm")}>
          All saved searches
        </Link>
      </div>
      <LinkRows>
        {list.slice(0, 5).map((s) => (
          <LinkRow key={s.id} href={s.href} label={s.name || "Untitled search"} count={s.last_count === null ? null : <Count>{supplierCount(s.last_count)}</Count>} />
        ))}
      </LinkRows>
    </section>
  );
}

/** The certificates that need a look: the first few, the total, and the way to the rest. */
function Attention({ attention }: { attention: Attention | null }) {
  if (attention === null)
    return (
      <InlineError retry={<Link href="/app" className={buttonClass({ kind: "secondary" })}>Try again</Link>}>We couldn&apos;t load the certificate checks.</InlineError>
    );
  const words = attentionWords(attention.total);
  const items: AttentionItem[] = attention.rows.map((r) => ({
    state: r.state,
    supplier: r.supplier,
    what: r.what,
    note: r.note,
    action: (
      <Link href={r.askHref} className={buttonClass({ kind: "secondary" })}>
        {r.askLabel}
      </Link>
    ),
  }));
  return (
    <section className="flex flex-col gap-2" aria-label="Needs attention">
      <div className="flex items-baseline justify-between max-sm:hidden">
        <h2 className={h2}>{words.heading}</h2>
        <Link href="/app/compliance" className={cn(linkClass, "text-sm")}>
          Open Compliance
        </Link>
      </div>
      <NeedsAttention
        items={items}
        total={attention.total}
        header="phone"
        footer={
          attention.total > items.length ? (
            <Link href="/app/compliance" className="flex h-12 items-center justify-between px-4 text-md font-medium text-brand-ink sm:hidden">
              {words.seeAll}
              <CaretRight size={20} className="shrink-0 text-ink-2" aria-hidden />
            </Link>
          ) : null
        }
      />
    </section>
  );
}

export function SearchLanding({
  published,
  attention,
  counts,
  saved,
}: {
  /** Published suppliers; null when it could not be read. */
  published: number | null;
  attention: Attention | null;
  /** The common searches' counts, resolved behind a `Suspense` boundary. */
  counts: Promise<Record<string, number | null>>;
  /** The buyer's own saved searches, newest first; null when they could not be read. */
  saved: Promise<SavedSearchJson[] | null>;
}) {
  const startMenus = filterMenus(EMPTY_STATE).filter((m) => m.key !== "more");
  return (
    <PendingNav className="flex min-h-0 flex-1 flex-col gap-6 px-4 pb-6 pt-1 sm:px-8 sm:pt-7">
      <div className="flex items-baseline gap-4 max-sm:hidden">
        <h1 className="text-xl font-semibold tracking-tight text-ink">Search</h1>
        <p className="text-base text-ink-3">{published === null ? "Every published supplier" : supplierCount(published)} · every fact from a named source</p>
      </div>
      <section aria-label="Find suppliers" className="flex flex-col gap-3">
        <SearchField />
        <div className="flex flex-wrap items-center gap-2 max-sm:hidden">
          {startMenus.map((m) => (
            <FilterMenuButton key={m.key} menu={m} hrefFor={discoverHref} icon={MENU_ICON[m.key]} />
          ))}
          <span aria-hidden className="mx-1 h-5 w-px bg-line" />
          <span className="text-sm text-ink-3">Hiding sanctioned suppliers</span>
        </div>
        <CommonSearches counts={counts} />
      </section>
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
        <div className="flex min-w-0 flex-1 flex-col gap-6">
          <Attention attention={attention} />
        </div>
        <div className="flex flex-col gap-6 lg:w-[400px] lg:shrink-0">
          <RecentSearches />
          <Suspense fallback={null}>
            <SavedSearches saved={saved} />
          </Suspense>
        </div>
      </div>
    </PendingNav>
  );
}
