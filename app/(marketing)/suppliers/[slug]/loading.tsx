// I-027 — Public supplier profile skeleton (marketing chrome).

import {
  ProfileHeaderSkeleton,
  ProfileTabBodySkeleton,
  ProfileTabsSkeleton,
} from "@/components/supplier/profile-skeleton";
import { Skeleton, SkeletonRegion } from "@/components/ui/skeleton";

export default function PublicSupplierLoading() {
  return (
    <SkeletonRegion className="mx-auto max-w-6xl space-y-6 px-4 py-6 md:px-8 md:py-8">
      <ProfileHeaderSkeleton />

      <div className="proto-card space-y-3">
        <div className="flex items-center justify-between">
          <Skeleton w={120} h={16} />
          <Skeleton w={70} h={20} shape="pill" />
        </div>
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} w={88 + (i % 4) * 22} h={28} shape="pill" tone="card" />
          ))}
        </div>
      </div>

      <ProfileTabsSkeleton />
      <ProfileTabBodySkeleton />
    </SkeletonRegion>
  );
}
