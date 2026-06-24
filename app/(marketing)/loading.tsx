// Marketing-shell Suspense fallback. Mirrors the homepage anatomy: hero copy,
// CTA row, visual panel, stats, and feature cards. Segment-specific overrides
// exist for /discover and /suppliers/[slug].

import { Skeleton, SkeletonRegion } from "@/components/ui/skeleton";

export default function MarketingLoading() {
  return (
    <SkeletonRegion className="mx-auto max-w-7xl space-y-10 px-4 py-10 sm:px-6 lg:px-8">
      <section className="grid items-center gap-8 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-5">
          <Skeleton w={150} h={26} shape="pill" tone="card" />
          <div className="space-y-3">
            <Skeleton w="92%" h={54} />
            <Skeleton w="78%" h={54} />
          </div>
          <div className="space-y-2">
            <Skeleton w="86%" h={14} />
            <Skeleton w="72%" h={14} />
          </div>
          <div className="flex flex-wrap gap-3">
            <Skeleton w={150} h={44} shape="pill" tone="card" />
            <Skeleton w={130} h={44} shape="pill" tone="card" />
          </div>
        </div>

        <Skeleton w="100%" h={420} shape="hero" tone="card" />
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
            <Skeleton w={80} h={28} />
            <div className="mt-2">
              <Skeleton w="75%" h={11} />
            </div>
          </div>
        ))}
      </section>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
            <Skeleton w={38} h={38} shape="card" tone="card" />
            <div className="mt-4 space-y-2">
              <Skeleton w={150} h={18} />
              <Skeleton w="90%" h={12} />
              <Skeleton w="75%" h={12} />
            </div>
          </div>
        ))}
      </div>
    </SkeletonRegion>
  );
}
