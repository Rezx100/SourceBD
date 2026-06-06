// I-027 — Buyer-side supplier profile skeleton. Pixel-mirrors
// `app/(app)/app/suppliers/[slug]/page.tsx`: dossier header, expandable
// products strip, then the 6-tab strip with a default tab body.

import {
  ProfileHeaderSkeleton,
  ProfileTabBodySkeleton,
  ProfileTabsSkeleton,
} from "@/components/supplier/profile-skeleton";
import { Skeleton, SkeletonRegion } from "@/components/ui/skeleton";

export default function BuyerSupplierLoading() {
  return (
    <SkeletonRegion className="mx-auto max-w-6xl space-y-6">
      <ProfileHeaderSkeleton />

      {/* Products strip silhouette (collapsible) */}
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
