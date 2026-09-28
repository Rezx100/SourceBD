import { ResultsColumn } from "@/components/dashboard/sheet";
import { Skeleton, SkeletonRegion } from "@/components/ui/skeleton";

// Saved while it loads, in the page's own frame: the header, the desk
// (alerts beside recent activity from `xl`), then the saved list's rows at
// its row height. The founder's walkthrough (28 Sep 2026) found this page
// blank while loading: the skeleton's styles had stayed behind in the old
// design's stylesheet. The layout draws the shell.

export default function SavedLoading() {
  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      <ResultsColumn>
        <SkeletonRegion label="Loading saved suppliers" className="mx-auto flex w-full max-w-6xl flex-col gap-6">
          <div className="flex items-end justify-between gap-3">
            <div className="flex flex-col gap-2">
              <Skeleton w={96} h={24} />
              <Skeleton w={260} h={13} />
            </div>
            <Skeleton w={150} h={32} tone="card" />
          </div>
          <div className="grid gap-6 xl:grid-cols-2">
            {[0, 1].map((k) => (
              <div key={k} className="flex flex-col gap-3">
                <Skeleton w={120} h={15} />
                <Skeleton w="100%" h={96} tone="card" />
              </div>
            ))}
          </div>
          <div className="flex flex-col overflow-hidden rounded-md bg-surface">
            <div className="flex h-9 items-center gap-8 border-b border-line-subtle px-4">
              {[64, 56, 52, 60].map((w, i) => (
                <Skeleton key={i} w={w} h={10} />
              ))}
            </div>
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="flex h-11 items-center gap-3 border-b border-line-subtle px-4 last:border-b-0">
                <Skeleton w={24} h={24} />
                <Skeleton w={i % 2 ? 180 : 230} h={13} />
                <span className="ml-auto flex gap-1">
                  {Array.from({ length: 5 }, (_, k) => (
                    <Skeleton key={k} w={16} h={16} />
                  ))}
                </span>
                <Skeleton w={48} h={12} className="ml-8" />
                <Skeleton w={80} h={12} className="ml-8" />
                <Skeleton w={28} h={28} className="ml-4" />
              </div>
            ))}
          </div>
        </SkeletonRegion>
      </ResultsColumn>
    </div>
  );
}
