"use client";

// Spec R1 — BottomTabBar.
// Spec R2 — Wired into `app/(app)/layout.tsx` at `md:hidden` so phones get
// the bottom-tab + MobileDrawer hamburger combo, with no overlap onto the
// tablet rail or the desktop sidebar.
//
// Slot source: the SECTIONS map exported from
// `components/shell/sidebar.tsx`. R2 takes the first 5 slots of the
// flattened IA per variant — keeps the bar in sync with the full sidebar
// without re-declaring destinations.

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import type { Role } from "@/lib/auth";
import {
  SECTIONS,
  variantFromPath,
  type ShellVariant,
  type Slot,
} from "@/components/shell/sidebar";

function topTabs(variant: ShellVariant, n = 5): Slot[] {
  const flat = SECTIONS[variant].flatMap((s) => s.slots);
  return flat.slice(0, n);
}

type BottomTabBarProps = {
  /** Explicit variant override (used by /dev/components showcase). */
  variant?: ShellVariant;
  /** Reserved for R2 (badge counts, role-aware filtering). */
  role?: Role | null;
  /** Optional className — R2 will pass `md:hidden` to confine to phones. */
  className?: string;
};

export function BottomTabBar({ variant, className }: BottomTabBarProps) {
  const pathname = usePathname() ?? "/app";
  const v = variant ?? variantFromPath(pathname);
  const slots = topTabs(v);

  return (
    <nav
      aria-label="Primary navigation"
      className={cn(
        // Fixed to viewport bottom with safe-area inset; backdrop-blur so
        // content scrolling underneath stays legible. md:hidden confines
        // the bar to phones — tablet+ gets SidebarRail or full Sidebar.
        "fixed left-0 right-0 bottom-0 z-30 safe-bottom-0 safe-pb safe-px md:hidden",
        "border-t border-hairline-strong bg-surface-l1/95",
        "supports-[backdrop-filter]:bg-surface-l1/82 supports-[backdrop-filter]:backdrop-blur",
        // Light shadow toward content above.
        "shadow-[0_-6px_18px_-8px_rgba(15,15,20,0.10)]",
        className,
      )}
    >
      <ul
        role="list"
        className="m-0 flex list-none items-stretch justify-around p-0"
      >
        {slots.map((s) => {
          const active =
            pathname === s.href || pathname.startsWith(`${s.href}/`);
          return (
            <li key={s.href} className="flex-1 relative">
              <Link
                href={s.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-[56px] min-h-[44px] flex-col items-center justify-center gap-0.5 text-[10px] font-medium",
                  active
                    ? "text-brand-forest"
                    : "text-ink-tertiary hover:text-ink-primary",
                )}
              >
                <s.Icon size={20} weight={active ? "fill" : "regular"} aria-hidden />
                <span className="font-display tracking-[-0.005em]">{s.label}</span>
                {active ? (
                  <span
                    aria-hidden
                    className="absolute top-0 left-1/2 -translate-x-1/2 h-[3px] w-8 rounded-pill bg-brand-forest"
                  />
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
