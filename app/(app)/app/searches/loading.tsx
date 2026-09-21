import { Skeleton, SkeletonRegion } from "@/components/ui/skeleton";

export default function SearchesLoading() {
  return (
    <SkeletonRegion className="flex min-h-[calc(100dvh-9rem)] flex-col gap-4">
      <Skeleton w={220} h={28} />
      <Skeleton w="100%" h={200} tone="card" />
    </SkeletonRegion>
  );
}
