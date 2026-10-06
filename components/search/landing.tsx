// The search landing (Paper `10 · Search landing, returning user` and `11 · Search landing`).
// There is no second search box on a desktop: the topbar's is the only one (Ctrl K); on a phone
// the page draws its own. What is here is the work queue: the certificates that need a
// look, the buyer's recent and saved searches, a filter to start from, and the common
// searches with how many suppliers each finds. No supplier is listed until the buyer asks.
// Server component; the counts stream in behind the page so nothing waits on them.

import { CaretRight, MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import Form from "next/form";
import Link from "next/link";
import { Suspense } from "react";
import { NeedsAttention, type AttentionItem } from "@/components/patterns";
import { InlineError, Skeleton, buttonClass, linkClass } from "@/components/kit";
import { attentionWords, type Attention } from "@/lib/dashboard/needs-attention";
import { SEARCH_TEMPLATES, filterMenus, templateHref } from "@/lib/dashboard/search-templates";
import { DISCOVER_PATH, EMPTY_STATE, discoverHref } from "@/lib/discover-v32-state";
import type { SavedSearchJson } from "@/lib/saved-searches";
import { cn } from "@/lib/utils";
import { FilterMenuButton } from "./toolbar";
import { RecentSearches } from "./recent";
import { SearchCombobox } from "./typeahead";
import { Count, LinkRow, LinkRows, h2, supplierCount } from "./rows";


async function ResolvedCount({ counts, k }: { counts: Promise<Record<string, number | null>>; k: string }) {
  const n = (await counts)[k];
  // An unread count says nothing: "0 suppliers" is a claim.
  return typeof n === "number" ? <Count>{supplierCount(n)}</Count> : <Count>{null}</Count>;
}

function CommonSearches({ counts }: { counts: Promise<Record<string, number | null>> }) {
  return (
    <section aria-labelledby="common-searches" className="flex flex-col gap-2">
      <h2 id="common-searches" className={cn(h2, "max-sm:pb-0")}>
        Common searches
      </h2>
      <LinkRows>
        {SEARCH_TEMPLATES.map((t) => (
          <LinkRow
            key={t.key}
            href={templateHref(t)}
            label={t.title}
            count={
              <Suspense fallback={<Skeleton className="h-3 w-16" />}>
                <ResolvedCount counts={counts} k={t.key} />
              </Suspense>
            }
          />
        ))}
      </LinkRows>
      <p className="text-xs text-ink-3 max-sm:hidden">Counts as of today.</p>
    </section>
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
            <Link href="/app/compliance" className="flex h-12 items-center justify-between px-4 text-md font-medium text-brand sm:hidden">
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
    <div className="flex min-h-0 flex-1 flex-col gap-6 px-4 pb-6 pt-1 sm:px-8 sm:pt-7">
      {/* A phone has no topbar field: the page draws its own, 48 tall at 16px. */}
      <Form action={DISCOVER_PATH} role="search" aria-label="Search" className="relative md:hidden">
        <div className="flex h-input-touch items-center gap-3 rounded-md border border-line-strong bg-surface px-3.5 focus-within:border-brand focus-within:[box-shadow:inset_0_0_0_1px_theme(colors.brand)]">
          <MagnifyingGlass size={20} className="shrink-0 text-ink-3" aria-hidden />
          <Suspense fallback={<input type="search" name="q" autoComplete="off" placeholder="Supplier, product or certificate" aria-label="Search" className="min-w-0 flex-1 bg-transparent text-md text-ink outline-none placeholder:text-ink-3" />}>
            <SearchCombobox variant="phone" placeholder="Supplier, product or certificate" />
          </Suspense>
        </div>
      </Form>
      <div className="flex items-baseline gap-4 max-sm:hidden">
        <h1 className="text-xl font-semibold tracking-tight text-ink">Search</h1>
        <p className="text-base text-ink-3">{published === null ? "Every published supplier" : supplierCount(published)} · every fact from a named source</p>
      </div>
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
        <div className="flex min-w-0 flex-1 flex-col gap-6">
          <Attention attention={attention} />
          <RecentSearches />
          <Suspense fallback={null}>
            <SavedSearches saved={saved} />
          </Suspense>
        </div>
        <div className="flex flex-col gap-6 lg:w-[420px] lg:shrink-0 lg:gap-4">
          <section aria-labelledby="start-filter" className="flex flex-col gap-2.5 max-sm:hidden">
            <h2 id="start-filter" className={h2}>
              Start with a filter
            </h2>
            <div className="flex flex-wrap gap-2">
              {startMenus.map((m) => (
                <FilterMenuButton key={m.key} menu={m} hrefFor={discoverHref} />
              ))}
            </div>
          </section>
          <CommonSearches counts={counts} />
        </div>
      </div>
    </div>
  );
}
