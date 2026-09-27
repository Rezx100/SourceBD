import { KitLoading } from "@/components/dashboard/kit-loading";
import { Skeleton, SkeletonRegion } from "@/components/ui/skeleton";

// The shape of the results column while the search runs: the composer bar,
// the panel header, then rows of the ledger grid, so nothing jumps when the
// page arrives. The layout draws the shell.

export default function BuyerDiscoverLoading() {
  return (
    <KitLoading>
      <SkeletonRegion className="flex min-h-[calc(100dvh-9rem)] flex-col gap-4 p-4 sm:p-6">
        <Skeleton w="100%" h={48} tone="card" />
        <div className="flex flex-col gap-0 rounded-md bg-surface shadow-edge">
          <div className="flex items-center gap-3 border-b border-line-subtle px-4 py-2.5">
            <Skeleton w={16} h={16} />
            <Skeleton w={160} h={16} />
            <Skeleton w={120} h={12} />
          </div>
          <Skeleton w="100%" h={36} />
          {Array.from({ length: 10 }, (_, i) => (
            <div key={i} className="flex items-center gap-3 border-b border-line-subtle px-4 py-2">
              <Skeleton w={16} h={16} />
              <Skeleton w={24} h={24} />
              <Skeleton w={220} h={14} />
              <Skeleton w={90} h={14} className="ml-auto" />
              <Skeleton w={120} h={14} />
              <Skeleton w={60} h={14} />
            </div>
          ))}
        </div>
      </SkeletonRegion>
    </KitLoading>
  );
}
