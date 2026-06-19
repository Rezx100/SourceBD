"use client";

// Spec R1 — SidebarRail (tablet icon-only collapsed sidebar).
// Spec R2 — Wired into `app/(app)/layout.tsx` at `hidden md:flex lg:hidden`
// so tablet portrait shows ONE primary nav (the rail), not two.
//
// Slot source is the SECTIONS map exported from `components/shell/sidebar.tsx`
// — flattened to a single list of (label, href, Icon) per variant so the
// rail mirrors the same IA as the full sidebar. R1 originally re-declared
// a curated subset to stay strictly additive; R2 flips to single-source-
// of-truth now that the consumer wiring is landing.

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

function flatten(variant: ShellVariant): Slot[] {
  return SECTIONS[variant].flatMap((s) => s.slots);
}

type SidebarRailProps = {
  /** Optional explicit variant (e.g. for the /dev/components showcase
   *  where the path may not match a real route). Falls back to path. */
  variant?: ShellVariant;
  /** Role (currently unused for routing — server middleware gates
   *  routes — but kept in the API so R2 can drive visual a11y hints). */
  role?: Role | null;
  className?: string;
};

export function SidebarRail({ variant, className }: SidebarRailProps) {
  const pathname = usePathname() ?? "/app";
  const v = variant ?? variantFromPath(pathname);
  const slots = flatten(v);

  return (
    <nav
      aria-label="Collapsed primary navigation"
      className={cn(
        // R2 default visibility: tablet only. Consumer can override.
        "hidden md:sticky md:top-14 md:flex md:h-[calc(100dvh-56px)] md:w-[64px] md:flex-shrink-0 md:flex-col md:items-stretch md:gap-1 md:overflow-y-auto md:border-r md:border-hairline-strong md:bg-surface-l1 md:px-1 md:py-3 lg:hidden",
        className,
      )}
    >
      <ul className="m-0 flex list-none flex-col gap-1 p-0">
        {slots.map((s) => {
          const active =
            pathname === s.href || pathname.startsWith(`${s.href}/`);
          return (
            <li key={s.href}>
              <Link
                href={s.href}
                aria-current={active ? "page" : undefined}
                aria-label={s.label}
                title={s.label}
                className={cn(
                  // 44×44 hit area, 20px glyph, label sr-only.
                  "group relative mx-auto flex h-[44px] w-[44px] items-center justify-center rounded-md text-ink-tertiary transition-colors duration-hover ease-smooth",
                  active
                    ? "bg-brand-forest-soft text-brand-forest"
                    : "hover:bg-[rgba(15,15,20,0.05)] hover:text-ink-primary",
                )}
              >
                <s.Icon size={20} weight={active ? "fill" : "regular"} aria-hidden />
                <span className="sr-only">{s.label}</span>
                {/* Active marker — 3 px forest pill aligned to the left edge. */}
                {active ? (
                  <span
                    aria-hidden
                    className="absolute left-[-1px] top-1.5 bottom-1.5 w-[3px] rounded-pill bg-brand-forest"
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
