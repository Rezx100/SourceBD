// I-027 — Buyer-discover skeleton. Mirrors the FilterRail bar +
// sort/pagination + 8-card result grid actually rendered by
// `app/(app)/app/discover/page.tsx` so the filter row stays visually
// pinned while RSC streams the supplier rows.

import { DiscoverResultCardSkeleton } from "@/components/supplier/profile-skeleton";
import { Skeleton, SkeletonRegion } from "@/components/ui/skeleton";

export default function BuyerDiscoverLoading() {
  return (
    <SkeletonRegion className="mx-auto max-w-7xl space-y-6">
      <header className="space-y-2">
        <Skeleton w={40} h={10} />
        <Skeleton w={180} h={32} />
        <Skeleton w={420} h={14} />
      </header>

      {/* Filter rail silhouette — horizontal pill row + More filters chip. */}
      <div className="proto-card space-y-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton w={70} h={10} />
              <Skeleton w="100%" h={40} shape="pill" tone="card" />
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 pt-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} w={72 + (i % 3) * 18} h={28} shape="pill" tone="card" />
          ))}
        </div>
      </div>

      {/* Sort row + result count. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Skeleton w={140} h={14} />
        <Skeleton w={180} h={36} shape="pill" tone="card" />
      </div>

      {/* 8 result cards — matches PAGE_SIZE. */}
      <ul className="grid grid-cols-1 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <li key={i}>
            <DiscoverResultCardSkeleton />
          </li>
        ))}
      </ul>
    </SkeletonRegion>
  );
}
