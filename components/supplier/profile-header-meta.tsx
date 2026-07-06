import type { ReactNode } from "react";
import {
  CalendarBlank,
  IdentificationBadge,
  MapPin,
  UsersThree,
} from "@phosphor-icons/react/dist/ssr";

import { cn } from "@/lib/utils";

export type ProfileHeaderMetaItem = {
  key: string;
  label: string;
  icon: "employees" | "established" | "registry" | "address";
  children: ReactNode;
};

const META_ICONS = {
  employees: UsersThree,
  established: CalendarBlank,
  registry: IdentificationBadge,
  address: MapPin,
} as const;

/**
 * Fact grid for the profile header footer. On desktop the address column
 * takes roughly double the width of each metric so a full street address
 * wraps to one or two lines instead of towering over the single-line
 * numbers. Labels are sentence-case (not ERP uppercase); every value sits
 * on the same 22px line box so the row scans on one optical baseline.
 */
export function ProfileHeaderStatsRow({
  stats,
}: {
  stats: readonly ProfileHeaderMetaItem[];
}) {
  if (stats.length === 0) return null;

  return (
    // Phones: two facts per row (address on its own full-width row) so the
    // short metrics don't stack one-per-line down half the screen.
    <dl className="grid min-w-0 flex-1 grid-cols-2 gap-x-5 gap-y-4 sm:gap-x-7 lg:flex lg:items-start lg:gap-x-8">
      {stats.map((item) => {
        const Icon = META_ICONS[item.icon];
        const isAddress = item.key === "address";
        return (
          <div
            key={item.key}
            className={cn(
              "min-w-0",
              isAddress ? "col-span-2 sm:col-span-1 lg:flex-[2.6]" : "lg:flex-1",
            )}
          >
            <dt className="flex h-[18px] items-center gap-1.5 whitespace-nowrap text-[12px] font-semibold text-neutral-500">
              <Icon size={15} weight="duotone" aria-hidden className="shrink-0 text-brand-forest/80" />
              {item.label}
            </dt>
            <dd
              className={cn(
                "mt-1 text-neutral-900",
                item.key === "registration"
                  ? "font-mono text-[14px] font-semibold leading-[22px] tracking-tight"
                  : isAddress
                    ? "text-[13.5px] font-semibold leading-[20px] text-neutral-700"
                    : "font-display text-[17px] font-bold leading-[22px] tabular-nums tracking-[-0.01em]",
              )}
            >
              {item.children}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
