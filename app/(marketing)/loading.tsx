// I-027 — Marketing-shell Suspense fallback. Mirrors the marketing chrome
// (max-w-5xl, generous padding, hero-card + supporting lines) so the
// silhouette matches the most common marketing surfaces (landing, pricing,
// compliance hub). Segment-specific overrides exist for /discover and
// /suppliers/[slug].

import { Skeleton, SkeletonRegion } from "@/components/ui/skeleton";

export default function MarketingLoading() {
  return (
    <SkeletonRegion className="mx-auto max-w-5xl space-y-6 px-6 py-16">
      <Skeleton w={120} h={10} />
      <Skeleton w={420} h={48} />
      <Skeleton w={360} h={14} />
      <Skeleton w={300} h={14} />
      <Skeleton w="100%" h={200} shape="hero" tone="card" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Skeleton w="100%" h={140} shape="card" tone="card" />
        <Skeleton w="100%" h={140} shape="card" tone="card" />
        <Skeleton w="100%" h={140} shape="card" tone="card" />
      </div>
    </SkeletonRegion>
  );
}
