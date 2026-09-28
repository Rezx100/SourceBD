import { Skeleton, SkeletonRegion } from "@/components/ui/skeleton";

// The search landing's own silhouette while it loads: the title, the large
// field, the filter rows and the template cards, at the sizes the page draws
// them (`components/dashboard/search-landing.tsx`), so nothing jumps when it
// arrives. The layout draws the shell.

export default function SearchLandingLoading() {
  return (
    <SkeletonRegion label="Loading search" className="mx-auto flex w-full max-w-[920px] flex-col gap-12 px-4 pb-16 pt-10 sm:px-6 md:pt-[11vh]">
      <div className="flex flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-3">
          <Skeleton w={380} h={30} />
          <Skeleton w={460} h={14} />
        </div>
        <Skeleton w="100%" h={56} tone="card" />
        <div className="flex w-full flex-col gap-2.5">
          {[7, 5, 4, 2].map((n, row) => (
            <div key={row} className="flex flex-wrap items-center gap-2">
              <Skeleton w={80} h={10} className="mr-2" />
              {Array.from({ length: n }, (_, i) => (
                <Skeleton key={i} w={i % 2 ? 96 : 128} h={32} tone="card" />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <Skeleton w={160} h={16} />
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 9 }, (_, i) => (
            <Skeleton key={i} w="100%" h={92} tone="card" />
          ))}
        </div>
      </div>
    </SkeletonRegion>
  );
}
