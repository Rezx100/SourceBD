// The record pane while its record is read: the sheet's own silhouette — the
// bar, the head (initials tile, name, facts line, marks), the tabs and the
// first fact rows — at the sheet's sizes, so the record lands in place rather
// than replacing a spinner (founder's walkthrough, 28 Sep 2026: opening a
// record waited on the whole search before anything moved). Server-safe, no
// script: it is a `Suspense` fallback.

import { Skeleton, SkeletonRegion } from "@/components/ui/skeleton";

export function RecordSkeleton({ label = "Loading the supplier record" }: { label?: string }) {
  return (
    <SkeletonRegion label={label} className="flex min-h-0 min-w-0 flex-1 flex-col bg-surface">
      <div className="flex min-h-[52px] items-center gap-3 border-b border-line-subtle px-5 py-2">
        <Skeleton w={28} h={28} />
        <Skeleton w={120} h={14} />
        <Skeleton w={160} h={12} />
        <Skeleton w={72} h={28} className="ml-auto" />
      </div>
      <div className="flex items-start gap-4 px-6 pt-5">
        <Skeleton w={48} h={48} />
        <div className="flex min-w-0 flex-1 flex-col gap-2.5">
          <Skeleton w="70%" h={28} />
          <Skeleton w="55%" h={14} />
          <div className="flex gap-1">
            {Array.from({ length: 7 }, (_, i) => (
              <Skeleton key={i} w={20} h={20} />
            ))}
          </div>
        </div>
      </div>
      <div className="mt-4 flex gap-5 border-b border-line-subtle px-6 pb-3">
        {[64, 72, 88, 52, 64, 76].map((w, i) => (
          <Skeleton key={i} w={w} h={14} />
        ))}
      </div>
      <div className="flex flex-col gap-3 px-6 py-5">
        {Array.from({ length: 9 }, (_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton w={130} h={12} />
            <Skeleton w={i % 3 === 0 ? "46%" : i % 3 === 1 ? "32%" : "24%"} h={14} />
            <Skeleton w={16} h={16} className="ml-auto" />
          </div>
        ))}
      </div>
    </SkeletonRegion>
  );
}

/**
 * One export line while it is read: the line sheet's bar (Back and the
 * breadcrumb), its 200px photo, the heading and a few fact rows. Opening a
 * line from a record used to show the WHOLE record's silhouette on the way
 * (founder's video, 29 Sep 2026).
 */
export function LineSkeleton() {
  return (
    <SkeletonRegion label="Loading the product line" className="flex min-h-0 min-w-0 flex-1 flex-col bg-surface">
      <div className="flex min-h-[52px] items-center gap-3 border-b border-line-subtle px-5 py-2">
        <Skeleton w={64} h={28} />
        <Skeleton w={200} h={12} />
        <Skeleton w={28} h={28} className="ml-auto" />
      </div>
      <div className="flex flex-col gap-4 p-6">
        <Skeleton w={200} h={200} />
        <Skeleton w={160} h={10} />
        <Skeleton w="60%" h={24} />
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton w={130} h={12} />
            <Skeleton w={i % 2 ? "30%" : "44%"} h={14} />
          </div>
        ))}
      </div>
    </SkeletonRegion>
  );
}

/** The RFQ form while its suppliers and the workspace's template are read: the bar, the targets strip and the first fields. */
export function ComposerSkeleton() {
  return (
    <SkeletonRegion label="Loading the RFQ form" className="flex min-h-0 min-w-0 flex-1 flex-col bg-surface">
      <div className="flex min-h-[52px] items-center gap-3 border-b border-line-subtle px-5 py-2">
        <Skeleton w={28} h={28} />
        <Skeleton w={96} h={14} />
        <Skeleton w={180} h={12} />
      </div>
      <div className="flex flex-col gap-5 p-6">
        <Skeleton w="100%" h={56} tone="card" />
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex flex-col gap-2">
            <Skeleton w={110} h={12} />
            <Skeleton w="100%" h={32} tone="card" />
          </div>
        ))}
      </div>
    </SkeletonRegion>
  );
}
