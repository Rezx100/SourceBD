import { Skeleton } from "@/components/kit";

// The search landing's own silhouette while it loads: the title, the work queue on the left,
// the filter buttons and the common searches on the right, at the sizes the page draws them
// (`components/search/landing.tsx`), so nothing jumps when it arrives. The layout draws the frame.

export default function SearchLandingLoading() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading search" className="flex min-h-0 flex-1 flex-col gap-6 px-4 pb-6 pt-1 sm:px-8 sm:pt-7">
      <div className="flex items-baseline gap-4 max-sm:hidden">
        <h1 className="text-xl font-semibold tracking-tight text-ink">Search</h1>
        <Skeleton className="h-3.5 w-64" />
      </div>
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
        <div className="flex min-w-0 flex-1 flex-col gap-6" aria-hidden>
          <Skeleton className="h-36 w-full rounded-lg" />
          <Skeleton className="h-36 w-full rounded-lg" />
        </div>
        <div className="flex flex-col gap-4 lg:w-[420px] lg:shrink-0" aria-hidden>
          <div className="flex gap-2">
            {[112, 96, 80, 104].map((w) => (
              <Skeleton key={w} className="h-8" style={{ width: w }} />
            ))}
          </div>
          <Skeleton className="h-72 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}
