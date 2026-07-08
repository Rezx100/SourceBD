// I-027 — Public-discover skeleton (marketing chrome). Centered search
// hero silhouette matching the no-query initial state.

import { Skeleton, SkeletonRegion } from "@/components/ui/skeleton";

export default function PublicDiscoverLoading() {
  return (
    <SkeletonRegion className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-6xl flex-col px-4 py-8 sm:px-6">
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-5">
          <div className="space-y-1.5">
            <Skeleton w={220} h={26} />
            <Skeleton w={340} h={14} />
          </div>
          <Skeleton w="100%" h={48} shape="pill" tone="card" />
        </div>
      </div>
    </SkeletonRegion>
  );
}
