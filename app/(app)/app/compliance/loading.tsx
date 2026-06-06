// I-027 — Compliance hub skeleton.

import { ProtoCardSkeleton } from "@/components/supplier/profile-skeleton";
import { Skeleton, SkeletonRegion } from "@/components/ui/skeleton";

export default function ComplianceLoading() {
  return (
    <SkeletonRegion className="mx-auto max-w-5xl space-y-6">
      <header className="space-y-2">
        <Skeleton w={70} h={10} />
        <Skeleton w={220} h={32} />
        <Skeleton w={420} h={14} />
      </header>
      <ProtoCardSkeleton rows={4} title={200} />
      <ProtoCardSkeleton rows={3} title={180} />
    </SkeletonRegion>
  );
}
