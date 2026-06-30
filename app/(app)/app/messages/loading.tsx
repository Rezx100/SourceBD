// Messages inbox loading state. Mirrors `messages/page.tsx`: PageHeader with
// action and a single DataList of thread rows.

import { Skeleton, SkeletonRegion } from "@/components/ui/skeleton";

export default function MessagesLoading() {
  return (
    <SkeletonRegion className="mx-auto max-w-4xl space-y-6">
      <header className="flex flex-col gap-4 border-b border-hairline pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="mb-2 inline-flex items-center gap-2">
            <Skeleton w={6} h={6} shape="circle" />
            <Skeleton w={48} h={11} />
          </div>
          <Skeleton w={150} h={34} />
          <Skeleton w={315} h={15} className="mt-2.5" />
        </div>
        <Skeleton w={120} h={38} shape="pill" className="shrink-0" />
      </header>

      <ul
        aria-hidden
        className="divide-y divide-neutral-200 overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm"
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <li key={i}>
            <div className="flex items-center gap-3 px-4 py-3.5">
              <Skeleton w={18} h={18} shape="circle" className="shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Skeleton w={i % 2 === 0 ? 170 : 135} h={14} />
                  <Skeleton w={74} h={24} shape="pill" />
                </div>
                <Skeleton w={i % 2 === 0 ? "58%" : "44%"} h={12} className="mt-1" />
              </div>
              <Skeleton w={42} h={11} className="shrink-0" />
            </div>
          </li>
        ))}
      </ul>
    </SkeletonRegion>
  );
}
