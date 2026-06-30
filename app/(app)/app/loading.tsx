// Buyer dashboard loading state. Mirrors `app/(app)/app/page.tsx`: PageHeader,
// 5 stat tiles, saved supplier cards, and recent activity rows.

import { DiscoverResultCardSkeleton } from "@/components/supplier/profile-skeleton";
import { Skeleton, SkeletonRegion } from "@/components/ui/skeleton";

export default function BuyerHomeLoading() {
  return (
    <SkeletonRegion className="mx-auto max-w-6xl space-y-10">
      <header className="flex flex-col gap-4 border-b border-hairline pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="mb-2 inline-flex items-center gap-2">
            <Skeleton w={6} h={6} shape="circle" />
            <Skeleton w={52} h={11} />
          </div>
          <Skeleton w={150} h={34} />
          <Skeleton w={245} h={15} className="mt-2.5" />
        </div>
      </header>

      <section
        aria-hidden
        className="grid grid-cols-2 gap-3 lg:grid-cols-5"
      >
        {Array.from({ length: 5 }).map((_, i) => (
          <StatTileSkeleton key={i} />
        ))}
      </section>

      <section aria-hidden className="flex flex-col gap-3">
        <div className="flex items-end justify-between gap-3">
          <Skeleton w={135} h={20} />
          <Skeleton w={58} h={16} />
        </div>
        <ul className="grid grid-cols-1 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <li key={i}>
              <DiscoverResultCardSkeleton />
            </li>
          ))}
        </ul>
      </section>

      <section aria-hidden className="flex flex-col gap-3">
        <Skeleton w={128} h={20} />
        <ul className="m-0 list-none divide-y divide-hairline overflow-hidden rounded-card border border-hairline bg-surface-l1 p-0">
          {Array.from({ length: 5 }).map((_, i) => (
            <li key={i} className="flex items-center gap-3 px-4 py-3">
              <Skeleton w={16} h={16} shape="circle" />
              <div className="min-w-0 flex-1">
                <Skeleton w={i % 2 === 0 ? "72%" : "58%"} h={13} />
              </div>
              <Skeleton w={44} h={11} className="shrink-0" />
            </li>
          ))}
        </ul>
      </section>
    </SkeletonRegion>
  );
}

function StatTileSkeleton() {
  return (
    <div className="flex h-full flex-col rounded-card border border-hairline bg-surface-l1 p-5 shadow-[0_1px_2px_rgba(15,15,20,0.05)]">
      <Skeleton w={86} h={12} />
      <Skeleton w={52} h={28} className="mt-2" />
      <Skeleton w="82%" h={11} className="mt-2" />
    </div>
  );
}
