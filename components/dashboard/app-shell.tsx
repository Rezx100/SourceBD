// AppShell of the dashboard kit: a 232px sidebar on canvas, a 56px frosted
// topbar, and the content region. The buyer layout draws it ONCE around every
// /app page (27 Sep 2026): the rail and the topbar stay mounted across client
// navigations and only `<main>` changes. From `md` up the shell IS the
// viewport — the page never scrolls; the content region does, or a pane
// inside it (the results beside an open record, the inbox beside a thread).
// Below `md` the rail reflows into a strip under the logo and the document
// scrolls as one, which is what a phone expects.

import Form from "next/form";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { NAV, activeNavKey, navMatch, type NavKey } from "@/lib/dashboard/nav";
import { cn } from "@/lib/utils";
import { AccountMenu, Avatar, type AccountModel } from "./account-menu";
import { LiveDot, Meter } from "./controls";
import { Icon } from "./icons";
import { RailToggle } from "./rail-toggle";
import { RecentSearchesSlot } from "./recent-searches";
import { SearchCarry } from "./search-carry";
import { SearchShortcut } from "./search-shortcut";
import { SearchTypeahead } from "./search-typeahead";
import { SidebarNav, type NavCounts } from "./sidebar-nav";
import { ShortcutHint, TopbarSearchSlot } from "./topbar-search-slot";
import { Caption } from "./type";

export { NAV, activeNavKey, navMatch, type NavKey };

export type SidebarModel = {
  /**
   * False when the buyer is on a page UNDER the active item rather than on it.
   * The rail then marks the row as current-section (`aria-current="true"`)
   * instead of current-page.
   */
  activeExact?: boolean;
  /**
   * The nav item to mark current. The layout leaves it out and the rail reads
   * the URL itself, so the mark follows every client navigation; the gallery
   * and the tests name a screen. `null` marks nothing — `/app/searches/new`
   * used to claim `"search"`, which put `aria-current="page"` on a link to a
   * page the buyer was not on (WCAG 4.1.2).
   */
  active?: NavKey | null;
  /** Live counts from `buyer_dashboard`; a count that could not be read is null and renders no pill. */
  counts: NavCounts;
  recent: { label: string; count: number | null; href: string }[];
  /** Plan line: name, and the RFQ allowance when billing exists. */
  plan: { name: string; note?: string | null; used?: number | null; allowance?: number | null };
  /** Who is signed in: the account menu at the foot of the rail and on the topbar. */
  account?: AccountModel;
};

/**
 * "Free plan · Beta": the plan's line under the name in the rail's account row.
 * The rail has about 124px for it, so the public beta is "Beta" there;
 * Settings keeps the whole note ("Free plan · public beta").
 */
export function planLine(plan: SidebarModel["plan"], short = true): string {
  const note = plan.note ? (short && /beta/i.test(plan.note) ? "Beta" : plan.note) : null;
  return [`${plan.name} plan`, note].filter(Boolean).join(" · ");
}

export function Sidebar({ model, screenLabel, collapsed = false }: { model: SidebarModel; screenLabel?: string; collapsed?: boolean }) {
  const { plan, account } = model;
  const pct =
    plan.used !== null && plan.used !== undefined && plan.allowance ? Math.round((plan.used / plan.allowance) * 100) : null;
  // Below `md` there is no room for a 232px rail beside the content — at
  // 320px it left about 88px to read in. It does not follow that the nav can
  // be hidden: an earlier pass did that and handed phones a bottom tab bar
  // with five of the ten destinations, so Products and Compliance hub became
  // unreachable below 768px (WCAG 1.4.10). So it reflows instead: a
  // horizontal, scrollable strip of the same links on phones, the full rail
  // from `md`, where it is the viewport's height and scrolls on its own.
  //
  // From `md` the rail collapses to its icons (`data-rail="collapsed"` on the
  // shell, set by `RailToggle` and the `sb_rail` cookie): labels become
  // screen-reader text, counts and the recent searches step out, and the
  // account corner is its avatar. The aside itself does not scroll — the
  // links between the head and the foot do — so the account menu can open
  // past the rail's edge.
  return (
    <aside
      aria-label={screenLabel ? `Sidebar, ${screenLabel}` : "Sidebar"}
      className="flex w-full shrink-0 flex-col gap-5 border-b border-line-subtle px-3 py-3 md:h-full md:w-sidebar md:border-b-0 md:border-r md:py-4 md:transition-[width] md:duration-fast md:group-data-[rail=collapsed]/shell:w-14 md:group-data-[rail=collapsed]/shell:px-2"
    >
      <div className="hidden items-center gap-1 md:flex md:group-data-[rail=collapsed]/shell:flex-col md:group-data-[rail=collapsed]/shell:gap-3">
        {/* The way home: /app has no nav item of its own. The mark and the
            wordmark are placeholders parked for the animation step: not
            restyled here (founder's video, 29 Sep 2026). */}
        <Link href="/app" aria-label="SourceBD home" className="flex min-w-0 items-center gap-2.5 rounded-sm px-2 py-0.5 md:group-data-[rail=collapsed]/shell:px-0">
          <span
            aria-hidden
            className="grid size-7 shrink-0 place-items-center rounded-sm bg-brand font-mono text-xs font-medium tracking-[0.02em] text-brand-on"
          >
            SB
          </span>
          <span className="text-title font-medium tracking-[-0.01em] text-ink-strong md:group-data-[rail=collapsed]/shell:hidden">SourceBD</span>
        </Link>
        <span className="ml-auto md:group-data-[rail=collapsed]/shell:ml-0">
          <RailToggle collapsed={collapsed} />
        </span>
      </div>
      <div className="flex flex-col gap-5 md:-mx-1 md:min-h-0 md:flex-1 md:overflow-y-auto md:px-1">
        <SidebarNav
          label={screenLabel ? `Primary, ${screenLabel}` : "Primary"}
          active={model.active}
          activeExact={model.activeExact}
          counts={model.counts}
        />
        {/* Rail furniture, not navigation: hidden on phones where the strip
            above carries every destination, and on the collapsed rail. */}
        <div className="hidden md:contents md:group-data-[rail=collapsed]/shell:hidden">
          <RecentSearchesSlot items={model.recent} />
        </div>
      </div>
      {/* No plan named (a loading state does not know it): no footer at all.
          The foot is one account row, the whole row the account menu's button
          (founder's review, 29 Sep 2026: "really under done"): the photo, the
          name over the plan, an up-and-down chevron, as a workspace switcher
          draws it. The separate plan line went into the row. When the plan
          has an RFQ allowance, a quiet meter sits above it. */}
      {plan.name ? (
        <div data-plan="true" className="hidden flex-col gap-2 border-t border-line-subtle pt-3 md:flex">
          {pct !== null ? (
            <div className="flex flex-col gap-1.5 px-2 md:group-data-[rail=collapsed]/shell:hidden">
              <Meter pct={pct} label={`RFQs used this month, ${plan.name}`} />
              <Caption>
                {plan.used} of {plan.allowance} RFQs this month ·{" "}
                <Link href="/app/settings/subscription" prefetch={false} className="text-accent-ink hover:underline">
                  Upgrade
                </Link>
              </Caption>
            </div>
          ) : null}
          {account ? (
            <AccountMenu account={account} place="rail" plan={planLine(plan)} />
          ) : (
            <Caption className="px-2 md:group-data-[rail=collapsed]/shell:hidden">{planLine(plan)}</Caption>
          )}
        </div>
      ) : null}
    </aside>
  );
}

export type TopbarModel = {
  /** "10,266 published suppliers · 4 records on this page, read 18 May – 18 Sep 2026" */
  caption: string;
  /** The viewer's initial; null renders an empty avatar. */
  initial: string | null;
  searchAction?: string;
  /** What the field starts with when the URL carries no `q` (the gallery). */
  searchQuery?: string;
};

export function Topbar({ model, screenLabel, account }: { model: TopbarModel; screenLabel?: string; account?: AccountModel }) {
  const field = model.searchAction ? (
    // `next/form`: submitting runs a client navigation to the results
    // instead of reloading the document. Not prefetched, like the rail's
    // Search row: /app/discover is rate-limited and a prefetch spends the
    // allowance. The one search field on a page: on the results page the
    // filter bar carries chips, not a second box, and on the search landing
    // the page's own large field replaces this one (`TopbarSearchSlot`).
    <Form
      prefetch={false}
      role="search"
      // Named, because /app/products renders a search landmark of its own
      // and two unnamed ones are indistinguishable (WCAG 1.3.1). Not
      // `Search, ${screenLabel}` unconditionally: on the results page the
      // screen label IS "Search", and the landmark read "Search, Search".
      aria-label={screenLabel && screenLabel !== "Search" ? `Search, ${screenLabel}` : "Search"}
      action={model.searchAction}
      // `relative`: the typeahead's listbox hangs under this field.
      // A filled field (founder's pick, 29 Sep 2026: no green border, no
      // shadow, depth from tone): a sunken fill at rest, a step darker under
      // the pointer, white with a 2px ink line under it while typing. The
      // field is the focus indicator, so the input inside draws none of its
      // own (founder's walkthrough, 28 Sep 2026).
      className="relative flex h-control w-full min-w-0 max-w-[420px] items-center gap-2 rounded-sm bg-surface-sunken px-2.5 text-sm text-ink-subtle transition-[background-color,box-shadow] duration-fast hover:bg-line-subtle focus-within:bg-surface focus-within:shadow-[inset_0_0_0_1px_rgb(var(--ds-line)),inset_0_-2px_0_rgb(var(--ds-ink-strong))] focus-within:hover:bg-surface"
    >
      <Icon name="search" />
      {/* The input itself, plus the suggestions under it as the buyer
          types. Renders the same `<input>` on the server — `name="q"`,
          `data-search="topbar"` — so the GET form and the shortcut work
          before any script runs, and without it. It reads the URL's `q` on
          the results page, and the filters ride along as hidden fields, so a
          new query keeps them. `Suspense`: both read the URL, which a
          statically rendered page (the gallery) has to defer. */}
      <Suspense fallback={null}>
        <SearchTypeahead defaultValue={model.searchQuery ?? ""} />
        <SearchCarry />
      </Suspense>
      <ShortcutHint />
      <SearchShortcut />
    </Form>
  ) : null;
  return (
    // `relative z-raised`: the topbar is frosted glass, and `backdrop-filter`
    // makes it a stacking context of its own. Without a z-index it painted
    // under the page's content — every page fades in through an animated
    // wrapper that is a later stacking context — so the suggestion list that
    // hangs below the field slid UNDER the filter bar and the results panel
    // (founder's walkthrough, 28 Sep 2026). Raised is enough: `<main>` below is
    // `isolate`, so nothing inside the page (a sticky table header, the
    // record's tabs, both `z-raised` too) can climb over the list; and the
    // onboarding tour's scrim (`z-modal`) still covers the topbar.
    <div className="glass relative z-raised flex h-topbar shrink-0 items-center gap-3 border-b border-line-subtle px-4 sm:gap-4 sm:px-6">
      {field ? (
        <TopbarSearchSlot>{field}</TopbarSearchSlot>
      ) : (
        <div className="flex h-control w-full min-w-0 max-w-[360px] items-center gap-2 rounded-sm bg-surface-sunken px-2.5 text-sm text-ink-subtle">
          <Icon name="search" />
          <span className="min-w-0 grow truncate">Search suppliers, HS codes, certificates</span>
        </div>
      )}
      <Caption className="ml-auto hidden items-center gap-2 lg:inline-flex">
        <LiveDot />
        {model.caption}
      </Caption>
      {/* No Help button until /app/help exists: it had no destination
          (founder decision, 24 Sep). render.test.ts holds this. */}
      {account ? (
        <AccountMenu account={account} place="topbar" />
      ) : (
        <Link href="/app/settings" aria-label="Account and settings" className="rounded-full">
          <Avatar account={model.initial ? { initial: model.initial, name: null, email: null } : null} />
        </Link>
      )}
    </div>
  );
}

/**
 * The shell: sidebar · (topbar + content). From `md` up it is exactly the
 * viewport: the rail scrolls on its own, `<main>` scrolls on its own, and a
 * page that wants panes of its own (the results beside a record) fills
 * `<main>` and scrolls inside them instead — `Page` is the frame for every
 * page that simply scrolls.
 */
export function AppShell({
  sidebar,
  topbar,
  className,
  contentClassName,
  /** The content landmark's id, and the skip link's target. Six screens in one gallery document must not share one. */
  mainId = "ds-main",
  /**
   * Distinguishes this instance's nav, search and main landmarks — and its
   * skip link's own name — from another AppShell's when both are live in the
   * same accessible tree at once (the gallery renders several).
   */
  screenLabel,
  railCollapsed = false,
  children,
}: {
  sidebar: SidebarModel;
  topbar: TopbarModel;
  /** The rail drawn as icons only: the buyer's `sb_rail` cookie, read by the layout. */
  railCollapsed?: boolean;
  /** The gallery's frames have a height of their own: `md:h-full` there, the viewport here. */
  className?: string;
  contentClassName?: string;
  mainId?: string;
  screenLabel?: string;
  children: ReactNode;
}) {
  // Every screen opens with the same ten sidebar links. Without a `main`
  // landmark and a skip link there is no way past them (WCAG 2.4.1).
  //
  // `overflow-clip`, not `overflow-hidden`: hidden stops a person scrolling
  // the shell but not a script, a followed fragment or a focus call, and a
  // record tab slid the whole app up under itself that way (founder's video,
  // 29 Sep 2026). Clip refuses every kind of scroll.
  return (
    <div
      data-shell=""
      data-rail={railCollapsed ? "collapsed" : undefined}
      className={cn("group/shell flex min-h-dvh flex-col bg-canvas text-base text-ink md:h-dvh md:flex-row md:overflow-clip", className)}
    >
      <a
        href={`#${mainId}`}
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-toast focus:rounded-sm focus:border focus:border-line-strong focus:bg-surface focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-ink-strong"
      >
        {screenLabel ? `Skip to content, ${screenLabel}` : "Skip to content"}
      </a>
      <Sidebar model={sidebar} screenLabel={screenLabel} collapsed={railCollapsed} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <Topbar model={topbar} screenLabel={screenLabel} account={sidebar.account} />
        <main
          id={mainId}
          aria-label={screenLabel}
          // Without it the skip link relies on the browser choosing to move
          // focus to a non-focusable fragment target, which older Safari does
          // not.
          tabIndex={-1}
          // The one scroll region of a plain page. A workbench page (the
          // search, the inbox) fills it with `min-h-0 flex-1` columns that
          // scroll themselves, and this never overflows. `isolate`: every
          // z-index inside the page stays inside it, so the topbar's
          // suggestion list always paints over the page. Without it a sticky
          // header (`z-raised`, the topbar's own level and later in the page)
          // would paint over the list whenever the page's fade-in is not
          // there to contain it, as under reduced motion.
          className={cn("isolate flex min-h-0 flex-1 flex-col overflow-y-auto", contentClassName)}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
