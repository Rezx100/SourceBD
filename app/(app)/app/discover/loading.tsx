import { Skeleton, SkeletonRegion } from "@/components/ui/skeleton";

export default function BuyerDiscoverLoading() {
  return (
    <SkeletonRegion className="flex min-h-[calc(100dvh-9rem)] flex-col gap-4">
      <Skeleton w="100%" h={48} tone="card" />
      <Skeleton w="100%" h={360} tone="card" />
    </SkeletonRegion>
  );
}
