// I-027 — Public-discover skeleton (marketing chrome). Same anatomy as the
// authenticated discover but inside the marketing layout, so the demo
// banner is preserved by the layout above and the silhouette starts at
// the filter rail.

import { DiscoverResultCardSkeleton } from "@/components/supplier/profile-skeleton";
import { Skeleton, SkeletonRegion } from "@/components/ui/skeleton";

export default function PublicDiscoverLoading() {
  return (
    <SkeletonRegion className="mx-auto max-w-7xl space-y-6 px-4 py-6 md:px-8 md:py-8">
      <header className="space-y-2">
        <Skeleton w={180} h={32} />
        <Skeleton w={420} h={14} />
      </header>

      <div className="space-y-4 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm sm:p-5">
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

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Skeleton w={140} h={14} />
        <Skeleton w={180} h={36} shape="pill" tone="card" />
      </div>

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
