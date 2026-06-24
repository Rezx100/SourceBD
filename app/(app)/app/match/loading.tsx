import { Skeleton, SkeletonRegion } from "@/components/ui/skeleton";

export default function SmartMatchLoading() {
  return (
    <SkeletonRegion className="mx-auto max-w-5xl space-y-6">
      <header className="space-y-2">
        <Skeleton w={110} h={10} />
        <Skeleton w={260} h={36} />
        <Skeleton w="70%" h={14} />
      </header>

      <div className="flex items-center gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-2">
            <Skeleton w={24} h={24} shape="pill" />
            <Skeleton w={i === 2 ? 92 : 76} h={11} />
            {i < 2 ? <Skeleton w={24} h={1} /> : null}
          </div>
        ))}
      </div>

      <section className="proto-card space-y-5">
        <div className="proto-card-head">
          <Skeleton w={150} h={18} />
          <Skeleton w={190} h={12} />
        </div>
        <div className="space-y-1.5">
          <Skeleton w={130} h={10} />
          <Skeleton w="100%" h={42} shape="card" tone="card" />
          <Skeleton w="70%" h={12} />
        </div>
        <div className="space-y-1.5">
          <Skeleton w={160} h={10} />
          <div className="flex flex-wrap gap-2">
            <Skeleton w={82} h={28} shape="pill" tone="card" />
            <Skeleton w={118} h={28} shape="pill" tone="card" />
          </div>
          <Skeleton w="75%" h={12} />
        </div>
      </section>
    </SkeletonRegion>
  );
}
