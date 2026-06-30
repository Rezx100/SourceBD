// Compliance hub loading state. Mirrors `compliance/page.tsx`: PageHeader,
// three hub tiles, and the optional imminent-renewals card.

import { Skeleton, SkeletonRegion } from "@/components/ui/skeleton";

export default function ComplianceLoading() {
  return (
    <SkeletonRegion className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-col gap-4 border-b border-hairline pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="mb-2 inline-flex items-center gap-2">
            <Skeleton w={6} h={6} shape="circle" />
            <Skeleton w={48} h={11} />
          </div>
          <Skeleton w={180} h={34} />
          <Skeleton w="100%" h={15} className="mt-2.5 max-w-2xl" />
        </div>
      </header>

      <section
        aria-hidden
        className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-3"
      >
        {Array.from({ length: 3 }).map((_, i) => (
          <HubTileSkeleton key={i} />
        ))}
      </section>

      <section aria-hidden className="proto-card space-y-2">
        <div className="proto-card-head">
          <Skeleton w={150} h={16} />
          <Skeleton w={220} h={12} />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton w={16} h={16} shape="circle" />
          <Skeleton w="68%" h={14} />
        </div>
      </section>
    </SkeletonRegion>
  );
}

function HubTileSkeleton() {
  return (
    <article className="h-full rounded-card border border-neutral-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <Skeleton w={40} h={40} shape="card" />
        <Skeleton w={88} h={24} shape="pill" />
      </div>

      <div className="mt-4">
        <Skeleton w={120} h={10} />
        <div className="mt-2 flex items-end justify-between gap-3">
          <div className="min-w-0 flex-1">
            <Skeleton w={170} h={19} />
            <Skeleton w="88%" h={12} className="mt-2" />
          </div>
          <Skeleton w={54} h={40} className="shrink-0" />
        </div>
      </div>
    </article>
  );
}
