// I-027 — Messages skeleton: two-pane silhouette (thread list + body).

import { Skeleton, SkeletonRegion } from "@/components/ui/skeleton";

export default function MessagesLoading() {
  return (
    <SkeletonRegion className="mx-auto max-w-6xl space-y-4">
      <header className="space-y-2">
        <Skeleton w={70} h={10} />
        <Skeleton w={180} h={32} />
      </header>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[280px_minmax(0,1fr)]">
        <div className="proto-card space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-1.5 border-b border-hairline pb-3 last:border-0 last:pb-0">
              <Skeleton w="70%" h={14} />
              <Skeleton w="40%" h={10} />
            </div>
          ))}
        </div>
        <div className="proto-card space-y-3">
          <Skeleton w={220} h={18} />
          <Skeleton w="100%" h={12} />
          <Skeleton w="85%" h={12} />
          <Skeleton w="70%" h={12} />
          <div className="pt-4">
            <Skeleton w="100%" h={100} shape="card" tone="card" />
          </div>
        </div>
      </div>
    </SkeletonRegion>
  );
}
