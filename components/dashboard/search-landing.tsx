// The search landing: the buyer app's first viewport (`/app`), and the page
// the rail's Search opens (founder, 28 Sep 2026).
//
// "When I open the app the first viewport should be the search window: the
// sidebar stays, and in the middle one big search. … When I click Search
// there shouldn't be companies already showing up with their data. Keep the
// search page super clean, with only filters and templates that users will
// use for their business."
//
// So: one large field in the middle of the page with the typeahead, one row
// of filter menus under it (founder's video, 29 Sep 2026: four rows of pills
// were noise), then the common searches as
// templates with how many suppliers each finds, then the buyer's own saved
// searches. No supplier is listed until the buyer asks for one; "Browse all"
// is the way to the whole ledger. The desk that used to be Home (certificate
// alerts, recent activity, saved suppliers) lives on Saved now.
//
// Server component. The counts stream in behind the page (`Suspense`), so the
// field is usable at once.

import Form from "next/form";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { formatCount } from "@/lib/dashboard/facts";
import { SEARCH_TEMPLATES, templateHref, type SearchTemplate } from "@/lib/dashboard/search-templates";
import { DISCOVER_PATH, EMPTY_STATE } from "@/lib/discover-v32-state";
import type { SavedSearchJson } from "@/lib/saved-searches";
import { FilterMenus } from "./filter-menus";
import { Icon } from "./icons";
import { SearchShortcut } from "./search-shortcut";
import { SearchTypeahead } from "./search-typeahead";
import { ShortcutHint } from "./topbar-search-slot";

/** A count that arrives later; the slot holds its width so nothing jumps. */
function CountSlot({ children }: { children: ReactNode }) {
  return <span className="inline-flex min-w-[6.5rem] justify-end font-mono text-xs text-ink-subtle">{children}</span>;
}

export function TemplateCount({ count }: { count: number | null }) {
  // An unread count says nothing rather than 0: "0 suppliers" is a claim.
  if (count === null) return <CountSlot>{null}</CountSlot>;
  return (
    <CountSlot>
      {formatCount(count)} {count === 1 ? "supplier" : "suppliers"}
    </CountSlot>
  );
}

function CountPending() {
  return (
    <CountSlot>
      <span aria-hidden className="skel inline-block" style={{ width: 64, height: 10 }} />
    </CountSlot>
  );
}

function TemplateCard({ t, count }: { t: SearchTemplate; count: ReactNode }) {
  return (
    <li className="flex">
      <Link
        href={templateHref(t)}
        prefetch={false}
        className="group flex min-h-[92px] w-full flex-col gap-1.5 rounded-md bg-surface px-4 py-3.5 shadow-edge transition-colors duration-fast hover:bg-surface-sunken"
      >
        <span className="flex items-baseline gap-3">
          <span className="min-w-0 flex-1 text-title font-medium text-ink-strong [overflow-wrap:anywhere] group-hover:text-brand-ink">{t.title}</span>
          {count}
        </span>
        <span className="text-sm text-ink-muted">{t.blurb}</span>
      </Link>
    </li>
  );
}

export function SearchLanding({
  published,
  counts,
  saved,
  filtersHref,
  menuCounts = Promise.resolve({}),
}: {
  /** Published suppliers, for "Browse all"; null when it could not be read. */
  published: number | null;
  /** The templates' counts, resolved behind a `Suspense` boundary. */
  counts: Promise<Record<string, number | null>>;
  /** What each filter-menu option finds, by option key (`filterMenus`). */
  menuCounts?: Promise<Record<string, number | null>>;
  /** The buyer's own saved searches, newest first; null when they could not be read. */
  saved: Promise<SavedSearchJson[] | null>;
  /** Where "All filters" opens: the filter pane beside this page. */
  filtersHref: string;
}) {
  return (
    <div className="mx-auto flex w-full max-w-[920px] flex-col gap-12 px-4 pb-16 pt-10 sm:px-6 md:pt-[11vh]">
      <section aria-labelledby="search-landing-title" className="flex flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 id="search-landing-title" className="m-0 text-3xl font-medium text-ink-strong">
            Search Bangladesh suppliers
          </h1>
          <p className="m-0 max-w-prose text-base text-ink-muted">
            {published === null ? "Every published supplier" : `${formatCount(published)} published suppliers`}, each fact traced to the register that filed it.
          </p>
        </div>

        {/* The large field. The same typeahead as the topbar's (which steps
            aside on this page), at the landing's size; the GET form runs the
            search on Enter with or without script. */}
        <Form
          prefetch={false}
          role="search"
          aria-label="Search"
          action={DISCOVER_PATH}
          className="relative flex h-14 w-full items-center gap-3 rounded-md bg-surface-sunken pl-4 pr-2 text-ink-subtle transition-[background-color,box-shadow] duration-fast hover:bg-line-subtle focus-within:bg-surface focus-within:shadow-[inset_0_0_0_1px_rgb(var(--ds-line)),inset_0_-2px_0_rgb(var(--ds-ink-strong))] focus-within:hover:bg-surface"
        >
          <Icon name="search" size={20} />
          <Suspense fallback={<input name="q" data-search="topbar" aria-label="Search suppliers, HS codes, certificates" className="min-w-0 grow bg-transparent text-lg" />}>
            <SearchTypeahead defaultValue="" variant="hero" autoFocus />
          </Suspense>
          <ShortcutHint />
          {/* The topbar's field, and with it its listener, steps aside here. */}
          <SearchShortcut />
          <button
            type="submit"
            className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-sm bg-brand px-4 text-sm font-medium text-brand-on transition-colors duration-fast hover:bg-brand-hover active:bg-brand-active"
          >
            Search
          </button>
        </Form>

        {/* The filter menus (founder's pick, 29 Sep 2026), each option a
            search of its own with how many suppliers it finds; the counts
            stream in behind the menus, which work without them. */}
        <Suspense fallback={<LandingMenus filtersHref={filtersHref} published={published} />}>
          <ResolvedMenus counts={menuCounts} filtersHref={filtersHref} published={published} />
        </Suspense>
      </section>

      <section aria-labelledby="search-templates-title" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 id="search-templates-title" className="m-0 text-title font-semibold text-ink-strong">
            Common searches
          </h2>
          <span className="text-xs text-ink-subtle">Each opens as a search you can narrow or save</span>
        </div>
        <ul className="m-0 grid list-none gap-2.5 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {SEARCH_TEMPLATES.map((t) => (
            <TemplateCard
              key={t.key}
              t={t}
              count={
                <Suspense fallback={<CountPending />}>
                  <ResolvedCount counts={counts} k={t.key} />
                </Suspense>
              }
            />
          ))}
        </ul>
      </section>

      <Suspense fallback={null}>
        <SavedSearches saved={saved} />
      </Suspense>
    </div>
  );
}

function LandingMenus({ counts, filtersHref, published }: { counts?: Record<string, number | null>; filtersHref: string; published: number | null }) {
  return (
    <FilterMenus state={EMPTY_STATE} counts={counts} className="w-full justify-center">
      <span className="mx-1 h-5 w-px bg-line" aria-hidden />
      <Link href={filtersHref} prefetch={false} scroll={false} className="inline-flex h-7 items-center gap-1.5 rounded-sm px-2 text-sm font-medium text-brand-ink hover:underline">
        <Icon name="sliders" /> All filters
      </Link>
      <Link href={DISCOVER_PATH} prefetch={false} className="inline-flex h-7 items-center gap-1.5 rounded-sm px-2 text-sm font-medium text-brand-ink hover:underline">
        Browse all {published === null ? "" : `${formatCount(published)} `}suppliers <Icon name="arrow-r" small />
      </Link>
    </FilterMenus>
  );
}

async function ResolvedMenus({ counts, ...rest }: { counts: Promise<Record<string, number | null>>; filtersHref: string; published: number | null }) {
  return <LandingMenus counts={await counts} {...rest} />;
}

async function ResolvedCount({ counts, k }: { counts: Promise<Record<string, number | null>>; k: string }) {
  const all = await counts;
  return <TemplateCount count={all[k] ?? null} />;
}

async function SavedSearches({ saved }: { saved: Promise<SavedSearchJson[] | null> }) {
  const list = await saved;
  if (!list || list.length === 0) return null;
  return (
    <section aria-labelledby="landing-saved-title" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 id="landing-saved-title" className="m-0 text-title font-semibold text-ink-strong">
          Your saved searches
        </h2>
        <Link href="/app/searches" prefetch={false} className="ml-auto text-sm font-medium text-brand-ink hover:underline">
          All saved searches
        </Link>
      </div>
      <ul className="m-0 flex list-none flex-col rounded-md bg-surface p-0 shadow-edge">
        {list.slice(0, 5).map((s) => (
          <li key={s.id} className="border-b border-line-subtle last:border-b-0">
            <Link
              href={s.href}
              prefetch={false}
              className="flex min-h-11 items-center gap-3 px-4 py-2 transition-colors duration-fast hover:bg-surface-sunken"
            >
              <Icon name="funnel" className="text-ink-subtle" />
              <span className="min-w-0 flex-1 text-base font-medium text-ink-strong [overflow-wrap:anywhere]">{s.name || "Untitled search"}</span>
              {s.last_count === null ? null : (
                <span className="font-mono text-xs text-ink-subtle">
                  {formatCount(s.last_count)} {s.last_count === 1 ? "supplier" : "suppliers"}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
