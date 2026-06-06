// I-027 — Root Suspense fallback. Matched only when no route group + no
// segment-level `loading.tsx` covers the boundary. Bare centred card so
// the user sees motion without overclaiming the final shape.

import { Skeleton, SkeletonRegion } from "@/components/ui/skeleton";

export default function RootLoading() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-xl items-center px-6 py-16">
      <SkeletonRegion className="w-full rounded-card border border-hairline bg-surface-l1 p-6 shadow-l1 space-y-3">
        <Skeleton w={140} h={14} />
        <Skeleton w={200} h={12} />
        <Skeleton w="100%" h={100} shape="card" tone="card" />
      </SkeletonRegion>
    </main>
  );
}
