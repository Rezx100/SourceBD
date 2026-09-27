import { KitLoading } from "@/components/dashboard/kit-loading";
import { Skeleton, SkeletonRegion } from "@/components/ui/skeleton";

// Inside the kit's frame: the layout draws no shell on this route (`ShellSwitch`).

export default function BuyerDiscoverLoading() {
  return (
    <KitLoading>
      <SkeletonRegion className="flex min-h-[calc(100dvh-9rem)] flex-col gap-4">
        <Skeleton w="100%" h={48} tone="card" />
        <Skeleton w="100%" h={360} tone="card" />
      </SkeletonRegion>
    </KitLoading>
  );
}
