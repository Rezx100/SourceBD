// I-027 — Auth-shell Suspense fallback. Single centred form-card silhouette.

import { Skeleton, SkeletonRegion } from "@/components/ui/skeleton";

export default function AuthLoading() {
  return (
    <SkeletonRegion className="mx-auto flex min-h-[80vh] max-w-md items-center px-6 py-16">
      <div className="w-full rounded-card border border-hairline bg-surface-l1 p-6 shadow-l1 space-y-3">
        <Skeleton w={120} h={20} />
        <Skeleton w={200} h={12} />
        <div className="space-y-2 pt-3">
          <Skeleton w={60} h={10} />
          <Skeleton w="100%" h={40} shape="card" tone="card" />
        </div>
        <div className="space-y-2">
          <Skeleton w={60} h={10} />
          <Skeleton w="100%" h={40} shape="card" tone="card" />
        </div>
        <div className="pt-2">
          <Skeleton w="100%" h={40} shape="pill" tone="card" />
        </div>
      </div>
    </SkeletonRegion>
  );
}
