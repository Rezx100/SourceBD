// I-027 — Buyer-discover skeleton. Mirrors the centered search hero +
// optional filter rail + result grid rendered by
// `app/(app)/app/discover/page.tsx`.

import { Skeleton, SkeletonRegion } from "@/components/ui/skeleton";

export default function BuyerDiscoverLoading() {
  return (
    <SkeletonRegion className="mx-auto flex min-h-[calc(100dvh-9rem)] max-w-6xl flex-col">
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
