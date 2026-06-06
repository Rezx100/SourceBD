// I-027 — Buyer-dashboard skeleton. Mirrors the real `app/(app)/app/page.tsx`
// silhouette: header (overline + title), 5-tile metric grid, saved-suppliers
// list (3 result cards), recent-activity card. Same `max-w-6xl space-y-6`
// container so layout shift on data arrival is zero.

import {
  DiscoverResultCardSkeleton,
  MetricSkeleton,
  ProtoCardSkeleton,
} from "@/components/supplier/profile-skeleton";
import { Skeleton, SkeletonRegion } from "@/components/ui/skeleton";

export default function BuyerHomeLoading() {
  return (
    <SkeletonRegion className="mx-auto max-w-6xl space-y-6">
      <header className="space-y-2">
        <Skeleton w={40} h={10} />
        <Skeleton w={180} h={32} />
      </header>

      <section
        aria-hidden
        className="grid grid-cols-1 gap-[14px] sm:grid-cols-2 lg:grid-cols-5"
      >
        {Array.from({ length: 5 }).map((_, i) => (
          <MetricSkeleton key={i} />
        ))}
      </section>

      <section aria-hidden className="space-y-3">
        <Skeleton w={170} h={22} />
        <ul className="grid grid-cols-1 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <li key={i}>
              <DiscoverResultCardSkeleton />
            </li>
          ))}
        </ul>
      </section>

      <section aria-hidden className="space-y-3">
        <Skeleton w={150} h={22} />
        <ProtoCardSkeleton rows={5} title={140} />
      </section>
    </SkeletonRegion>
  );
}
