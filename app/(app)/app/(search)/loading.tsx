import { Skeleton } from "@/components/kit";

// The search landing's own silhouette while it loads: the title, the field, the filter menus
// and the common searches, then the work queue beside the buyer's searches, at the sizes the
// page draws them (`components/search/landing.tsx`), so nothing jumps when it arrives. The
// layout draws the frame.

export default function SearchLandingLoading() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading search" className="flex min-h-0 flex-1 flex-col gap-6 px-4 pb-6 pt-1 sm:px-8 sm:pt-7">
      <div className="flex items-baseline gap-4 max-sm:hidden">
        <h1 className="text-xl font-semibold tracking-tight text-ink">Search</h1>
        <Skeleton className="h-3.5 w-64" />
      </div>
      <div className="flex flex-col gap-3" aria-hidden>
        <Skeleton className="h-input-touch w-full rounded-md sm:h-14 sm:rounded-lg" />
        <div className="flex gap-2 max-sm:hidden">
          {[148, 120, 104, 136].map((w) => (
            <Skeleton key={w} className="h-8" style={{ width: w }} />
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {[176, 150, 184, 170, 160, 190, 168].map((w) => (
            <Skeleton key={w} className="h-8 rounded-full" style={{ width: w }} />
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8" aria-hidden>
        <Skeleton className="h-36 w-full rounded-lg lg:flex-1" />
        <Skeleton className="h-36 w-full rounded-lg lg:w-[400px] lg:shrink-0" />
      </div>
    </div>
  );
}
