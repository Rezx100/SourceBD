// The phone's bars (`02 Components · 7`): the tab bar (56 plus the safe area, five tabs,
// D-3: Messages, Quotes, Alerts, Saved, Search), the sticky action bar (64: one primary,
// full width, with an icon button beside it) and the bar that replaces the action when a
// supplier cannot be sent an RFQ. Every target is 44 or more. Server-safe.

import { WarningOctagon } from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ringInset } from "./classes";

export type TabBarItem = {
  href: string;
  label: string;
  icon: Icon;
  current?: boolean;
  /** Something new here: a dot, and "Alerts, new" to a screen reader. */
  isNew?: boolean;
};

/** The bottom tab bar. Selected is a brand icon, a brand label and a 2px brand bar on top. */
export function TabBar({ items, label = "Main" }: { items: TabBarItem[]; label?: string }) {
  return (
    <nav aria-label={label} className="border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]">
      <ul className="flex h-tabbar">
        {items.map(({ href, label: text, icon: G, current, isNew }) => (
          <li key={href} className="flex-1">
            <Link
              href={href}
              aria-current={current ? "page" : undefined}
              aria-label={isNew ? `${text}, new` : undefined}
              className={cn(
                "relative flex h-tabbar flex-col items-center justify-center gap-0.5 text-xs outline-none",
                current ? "font-semibold text-brand-ink [box-shadow:inset_0_2px_0_theme(colors.brand-ink)]" : "font-medium text-ink-2",
                ringInset,
              )}
            >
              <G size={24} className="shrink-0" aria-hidden />
              {text}
              {isNew ? <span aria-hidden className="absolute left-1/2 top-2 ml-[5px] size-2 rounded-full border-2 border-surface bg-danger-solid" /> : null}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Sticky above the tab bar (or in place of it on a record). One primary, full width; the secondary is an icon button that names what it does. */
export function ActionBar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex min-h-action-bar items-center gap-2 border-t border-line bg-surface px-4 pb-[env(safe-area-inset-bottom)]", className)}>{children}</div>;
}

/** Replaces the action bar for a sanctioned supplier. The button is replaced, not greyed. */
export function RefusedBar({ children }: { children: ReactNode }) {
  return (
    <div role="status" className="flex min-h-16 items-center gap-2 border-t-2 border-sanction bg-sanction-tint px-4 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      <WarningOctagon size={20} weight="fill" className="shrink-0 text-sanction" aria-hidden />
      <p className="text-base font-medium text-sanction">{children}</p>
    </div>
  );
}
