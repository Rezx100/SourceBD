import { Skeleton, SkeletonRegion } from "@/components/ui/skeleton";

export default function ProductsLoading() {
  return (
    <SkeletonRegion className="flex min-h-[calc(100dvh-9rem)] flex-col gap-4">
      <Skeleton w={220} h={28} />
      <Skeleton w="100%" h={360} tone="card" />
    </SkeletonRegion>
  );
}
