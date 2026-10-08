// The search landing (Paper `10 · Search landing v2 · search first, compact` and `11 · Search
// landing`). Search first (founder's walkthrough, 6 Oct 2026: "there is no search input field,
// only this information everywhere"): one large field, the filter menus under it with their
// icons. Under it the common searches are the first screen's body, two lines each (the search and
// how many suppliers it finds), with the certificates that need a look under them at the pane's
// measure, and beside them the buyer's recent and saved searches, always drawn (critique of 8 Oct
// 2026, round 3, item 4: the app opened on one amber card over empty paper). The topbar steps its own field aside here (`topbar-search-slot.tsx`), so this field
// is the one Ctrl K reaches. No supplier is listed until the buyer asks.
// Server component; the counts are read by the page (cached an hour) so a chip paints with its
// count, never a skeleton; a count that was late is simply not drawn.

import { Buildings, CaretRight, MagnifyingGlass, MapPin, SealCheck, TShirt } from "@phosphor-icons/react/dist/ssr";
import Form from "next/form";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { NeedsAttention, type AttentionItem } from "@/components/patterns";
import { InlineError, buttonClass, linkClass } from "@/components/kit";
import { ring } from "@/components/kit/classes";
import { SearchShortcut } from "@/components/frame/search-shortcut";
import { ShortcutHint } from "@/components/frame/topbar-search-slot";
import { attentionWords, type Attention } from "@/lib/dashboard/needs-attention";
import { SEARCH_TEMPLATES, filterMenus, templateHref } from "@/lib/dashboard/search-templates";
import { DISCOVER_PATH, EMPTY_STATE, discoverHref } from "@/lib/discover-v32-state";
import type { SavedSearchJson } from "@/lib/saved-searches";
import { cn } from "@/lib/utils";
import { PendingNav } from "./pending-nav";
import { FilterMenuButton, SanctionedStanding } from "./toolbar";
import { RecentSearches } from "./recent";
import { SearchCombobox } from "./typeahead";
import { Count, LinkRow, LinkRows, h2, supplierCount } from "./rows";

const MENU_ICON: Record<string, ReactNode> = {
  product: <TShirt size={16} weight="fill" className="shrink-0 text-ink-2" aria-hidden />,
  certificate: <SealCheck size={16} weight="fill" className="shrink-0 text-ink-2" aria-hidden />,
  place: <MapPin size={16} weight="fill" className="shrink-0 text-ink-2" aria-hidden />,
  type: <Buildings size={16} weight="fill" className="shrink-0 text-ink-2" aria-hidden />,
};

/** The common searches, the first screen's body: one tonal cell each, the search on the first line and how many suppliers it finds on the second. */
function CommonSearches({ counts }: { counts: Record<string, number | null> }) {
  return (
    <nav aria-labelledby="common-searches" className="flex flex-col gap-2">
      <h2 id="common-searches" className={h2}>
        Common searches
      </h2>
      {/* A phone scrolls them sideways, so the work queue is still on its first screen; a grid from `sm`. */}
      <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 xl:grid-cols-3">
        {SEARCH_TEMPLATES.map((t) => {
          const n = counts[t.key];
          return (
            <li key={t.key} className="w-60 shrink-0 sm:w-auto">
              <Link
                href={templateHref(t)}
                prefetch={false}
                title={t.blurb}
                className={cn("flex h-full min-h-14 flex-col justify-center gap-0.5 rounded-md bg-subtle px-4 py-2.5 transition-colors duration-fast hover:bg-sunken", ring)}
              >
                <span className="text-base font-medium text-ink">{t.title}</span>
                {/* An unread or late count says nothing: "0" is a claim, and a skeleton a promise the page may not keep. */}
                {typeof n === "number" ? <span className="text-sm text-ink-3">{supplierCount(n)}</span> : null}
              </Link>
            </li>
          );
        })}
      </ul>
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

/** The saved column's frame, drawn at once (the Suspense fallback) and around whatever the read says. */
function SavedFrame({ all, children }: { all?: boolean; children?: ReactNode }) {
  return (
    <section aria-labelledby="saved-searches" className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <h2 id="saved-searches" className={h2}>
          Saved searches
        </h2>
        {all ? (
          <Link href="/app/searches" prefetch={false} className={cn(linkClass, "text-sm")}>
            All saved searches
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}

async function SavedSearches({ saved }: { saved: Promise<SavedSearchJson[] | null> }) {
  const list = await saved;
  if (list === null)
    return (
      <SavedFrame>
        <p className="text-sm text-ink-3">Your saved searches could not be read just now.</p>
      </SavedFrame>
    );
  if (list.length === 0)
    return (
      <SavedFrame>
        <p className="text-sm text-ink-3">No saved searches yet. Save one from the results bar.</p>
      </SavedFrame>
    );
  return (
    <SavedFrame all>
      <LinkRows>
        {list.slice(0, 5).map((s) => (
          <LinkRow key={s.id} href={s.href} label={s.name || "Untitled search"} count={s.last_count === null ? null : <Count>{supplierCount(s.last_count)}</Count>} />
        ))}
      </LinkRows>
    </SavedFrame>
  );
}

/** The suppliers whose certificates need a look (one row each), the total, and the way to the rest in the card's foot at every width. */
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
  // The way to the rest is in the card's foot at every width (the critique of 7 Oct 2026: on a desktop
  // the other six were reachable only through a link at the top right and a phone-only footer).
  const shown = items.reduce((n, _, i) => n + 1 + (attention.rows[i]?.more ?? 0), 0);
  return (
    // At the pane's measure, under the common searches: a work queue, not the page (round 3, item 4).
    <section className="flex w-full max-w-pane flex-col gap-2" aria-label="Needs attention">
      <h2 className={cn(h2, "max-sm:hidden")}>{words.heading}</h2>
      <NeedsAttention
        items={items}
        total={attention.total}
        header="phone"
        footer={
          <Link href="/app/compliance" className="flex h-12 items-center justify-between px-4 text-md font-medium text-brand-ink sm:text-sm">
            {attention.total > shown ? words.seeAll : "Open Compliance"}
            <CaretRight size={20} className="shrink-0 text-ink-2" aria-hidden />
          </Link>
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
  /** The common searches' counts, read by the page; a key that is missing or null draws a chip with no count. */
  counts: Record<string, number | null>;
  /** The buyer's own saved searches, newest first; null when they could not be read. */
  saved: Promise<SavedSearchJson[] | null>;
}) {
  const startMenus = filterMenus(EMPTY_STATE).filter((m) => m.key !== "more");
  return (
    <PendingNav className="flex min-h-0 flex-1 flex-col gap-6 px-4 pb-6 pt-1 sm:px-8 sm:pt-7">
      <div className="flex items-baseline gap-4 max-sm:hidden">
        <h1 className="text-xl font-semibold tracking-tight text-ink">Search</h1>
        <p className="text-base text-ink-3">{published === null ? "Every published supplier" : supplierCount(published)}</p>
      </div>
      <section aria-label="Find suppliers" className="flex flex-col gap-3">
        <SearchField />
        <div className="flex flex-wrap items-center gap-2 max-sm:hidden">
          {startMenus.map((m) => (
            <FilterMenuButton key={m.key} menu={m} hrefFor={discoverHref} icon={MENU_ICON[m.key]} />
          ))}
          {/* The same quiet toggle the results bar carries, at the bar's end, with the way to lift it. */}
          <span className="sm:ml-auto">
            <SanctionedStanding state={EMPTY_STATE} hrefFor={discoverHref} />
          </span>
        </div>
      </section>
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
        <div className="flex min-w-0 flex-1 flex-col gap-8">
          <CommonSearches counts={counts} />
          <Attention attention={attention} />
        </div>
        <div className="flex flex-col gap-6 lg:w-[400px] lg:shrink-0">
          <RecentSearches />
          <Suspense fallback={<SavedFrame />}>
            <SavedSearches saved={saved} />
          </Suspense>
        </div>
      </div>
    </PendingNav>
  );
}
