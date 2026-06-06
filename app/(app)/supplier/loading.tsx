// I-027 — Supplier portal landing skeleton. Mirrors the real
// `app/(app)/supplier/page.tsx`: a heading + claim CTA card + a stack of
// owned-supplier cards. Sits inside the same shell padding as the page.

import { ProtoCardSkeleton } from "@/components/supplier/profile-skeleton";
import { Skeleton, SkeletonRegion } from "@/components/ui/skeleton";

export default function SupplierHomeLoading() {
  return (
    <SkeletonRegion className="mx-auto max-w-5xl space-y-6">
      <header className="space-y-2">
        <Skeleton w={70} h={10} />
        <Skeleton w={220} h={32} />
      </header>
      <ProtoCardSkeleton rows={2} title={180} />
      <div className="space-y-3">
        <Skeleton w={150} h={22} />
        <ProtoCardSkeleton rows={3} title={200} />
        <ProtoCardSkeleton rows={3} title={200} />
      </div>
    </SkeletonRegion>
  );
}
