// I-027 — Saved suppliers skeleton: 6 result cards.

import { DiscoverResultCardSkeleton } from "@/components/supplier/profile-skeleton";
import { Skeleton, SkeletonRegion } from "@/components/ui/skeleton";

export default function SavedLoading() {
  return (
    <SkeletonRegion className="mx-auto max-w-6xl space-y-6">
      <header className="space-y-2">
        <Skeleton w={70} h={10} />
        <Skeleton w={210} h={32} />
      </header>
      <ul className="grid grid-cols-1 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <li key={i}>
            <DiscoverResultCardSkeleton />
          </li>
        ))}
      </ul>
    </SkeletonRegion>
  );
}
