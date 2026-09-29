"use client";

// The phone's navigation (the phone hand-off's D9 and D10; founder, 30 Sep
// 2026: "on mobile the navigation must be on the bottom part of the screen so
// that UX is top notch and user find it handy"). Below `md` the rail is
// gone, and a tab bar is fixed to the foot of the screen, where the thumb is:
// Search, Saved, RFQs, Messages, and More, a bottom sheet holding every other
// destination and the account, so nothing the rail reaches is out of reach.
// Sizes from the big iOS apps on Mobbin: 56px tall above the safe area, 24px
// icons over 11px medium labels, 4px between them, a hairline on top; the
// current tab in the strongest ink with its icon filled and a 2px near-black
// line along its top edge (the state is never colour alone, WCAG 1.4.11), the
// others muted; no pill and no hue. A client component, like the rail, so the current tab
// follows every client navigation under a shell drawn once.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MENU_NAME } from "@/lib/dashboard/menu-dismiss";
import { MORE_NAV, NAV, PHONE_TABS, navMatch, type NavKey } from "@/lib/dashboard/nav";
import { cn } from "@/lib/utils";
import { Avatar, accountName, type AccountModel } from "./account-menu";
import { Icon } from "./icons";

const TAB =
  "flex h-tabbar w-full flex-col items-center justify-center gap-1 text-nav-label font-medium text-ink-muted transition-colors duration-fast [touch-action:manipulation] active:bg-surface-sunken";
/** The current tab: the ink, and a 2px near-black line on its top edge. */
const TAB_ON = "text-ink-strong shadow-[inset_0_2px_0_rgb(var(--ds-accent))]";
const ROW =
  "flex h-sheet-row w-full items-center gap-3 px-4 text-left text-base text-ink transition-colors duration-fast [touch-action:manipulation] active:bg-surface-sunken";

/** A count that asks for action (unread messages, replies): a near-black disc on the icon. Totals never get one. */
function TabBadge({ n }: { n: number | null | undefined }) {
  if (!n || n <= 0) return null;
  return (
    <span className="absolute -right-2 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-medium leading-none text-accent-on">
      {n > 99 ? "99+" : n}
    </span>
  );
}

export function BottomNav({
  label,
  active,
  activeExact,
  badges = {},
  account,
  plan,
}: {
  label: string;
  /** The gallery and the tests name a screen; omitted, the path decides. */
  active?: NavKey | null;
  activeExact?: boolean;
  /** Counts that ask for action, per tab. None is read yet; the slot is here for when one is. */
  badges?: Partial<Record<NavKey, number | null>>;
  account?: AccountModel;
  /** "Free plan · public beta", under the name in More. */
  plan?: string | null;
}) {
  const pathname = usePathname() ?? "";
  const current = active === undefined ? navMatch(pathname) : { key: active, exact: activeExact !== false };
  const inMore = current.key !== null && !PHONE_TABS.includes(current.key);
  const aria = (key: NavKey) => (key === current.key ? (current.exact ? "page" : "true") : undefined);
  return (
    <nav
      aria-label={label}
      // Hidden inside a record, a line or the composer (`data-detail`): their
      // own bars take the top and the foot, as a detail screen does in any
      // phone app; two bars stuck to one edge would cover each other.
      className="fixed inset-x-0 bottom-0 z-sticky border-t border-line-subtle bg-surface pb-[env(safe-area-inset-bottom)] md:hidden group-has-[[data-detail]]/shell:hidden"
    >
      <ul className="m-0 flex list-none p-0">
        {PHONE_TABS.map((key) => {
          const item = NAV.find((n) => n.key === key)!;
          const on = key === current.key;
          return (
            <li key={key} className="min-w-0 flex-1">
              <Link
                href={item.href}
                // Search is not prefetched: the search is rate-limited, and a
                // prefetch spends the buyer's allowance on a search never run.
                prefetch={key === "search" ? false : undefined}
                aria-current={aria(key)}
                className={cn(TAB, on && TAB_ON)}
              >
                <span className="relative">
                  <Icon name={item.icon} size={24} fill={on} />
                  <TabBadge n={badges[key]} />
                </span>
                {item.label}
              </Link>
            </li>
          );
        })}
        <li className="min-w-0 flex-1">
          <details name={MENU_NAME}>
            <summary aria-label="More" className={cn(TAB, "cursor-pointer list-none [&::-webkit-details-marker]:hidden", inMore && TAB_ON)}>
              <Icon name="dots" size={24} fill={inMore} />
              More
            </summary>
            {/* The scrim takes the tap outside the sheet and stops the page
                moving behind it; a tap on it closes the sheet
                (`data-menu-close`, the shell's `MenuDismiss`). */}
            <div data-menu-close="" aria-hidden className="fixed inset-0 touch-none bg-surface-inverse/40 animate-fade motion-reduce:animate-none" />
            <div
              data-menu-panel=""
              role="group"
              aria-label="More"
              className="fixed inset-x-0 bottom-0 flex max-h-[70dvh] flex-col overflow-y-auto overscroll-contain rounded-t-lg bg-surface pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-lg animate-rise motion-reduce:animate-none"
            >
              <span aria-hidden className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-line" />
              <div className="flex h-sheet-head shrink-0 items-center justify-between pl-4 pr-1">
                <span className="text-lg font-semibold text-ink-strong">More</span>
                <button type="button" data-menu-close="" className="h-target rounded-sm px-3 text-base font-medium text-ink-strong [touch-action:manipulation] active:bg-surface-sunken">
                  Done
                </button>
              </div>
              <ul className="m-0 flex list-none flex-col p-0">
                {MORE_NAV.map((item) => (
                  <li key={item.key}>
                    <Link
                      data-menu-item=""
                      href={item.href}
                      prefetch={item.href === "/app/discover" ? false : undefined}
                      aria-current={aria(item.key)}
                      // The current page as the rail marks it: the grey tint and a 3px near-black bar.
                      className={cn(ROW, item.key === current.key && "bg-accent-tint font-medium text-ink-strong shadow-[inset_3px_0_0_rgb(var(--ds-accent))]")}
                    >
                      <Icon name={item.icon} size={22} fill={item.key === current.key} className={item.key === current.key ? undefined : "text-ink-muted"} />
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
              {account ? (
                <div className="mt-2 border-t border-line-subtle pt-2">
                  <div className="flex items-center gap-3 px-4 py-2">
                    <Avatar account={account} size="md" />
                    <span className="flex min-w-0 flex-col">
                      <span data-name="" className="truncate text-base font-medium text-ink-strong">
                        {accountName(account)}
                      </span>
                      {plan ? <span className="truncate text-xs text-ink-subtle">{plan}</span> : null}
                    </span>
                  </div>
                  <form action="/auth/sign-out" method="post">
                    <button type="submit" data-menu-item="" className={ROW}>
                      <Icon name="sign-out" size={22} className="text-ink-muted" />
                      Sign out
                    </button>
                  </form>
                </div>
              ) : null}
            </div>
          </details>
        </li>
      </ul>
    </nav>
  );
}
