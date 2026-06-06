// I-027 — Admin overview skeleton: 4 metric tiles + 2 tables.

import { MetricSkeleton, ProtoCardSkeleton } from "@/components/supplier/profile-skeleton";
import { Skeleton, SkeletonRegion } from "@/components/ui/skeleton";

export default function AdminLoading() {
  return (
    <SkeletonRegion className="mx-auto max-w-6xl space-y-6">
      <header className="space-y-2">
        <Skeleton w={50} h={10} />
        <Skeleton w={200} h={32} />
      </header>
      <section className="grid grid-cols-1 gap-[14px] sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <MetricSkeleton key={i} />
        ))}
      </section>
      <ProtoCardSkeleton rows={6} title={180} />
      <ProtoCardSkeleton rows={4} title={160} />
    </SkeletonRegion>
  );
}
