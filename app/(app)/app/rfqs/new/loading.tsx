import { Skeleton, SkeletonRegion } from "@/components/ui/skeleton";

export default function NewRfqLoading() {
  return (
    <SkeletonRegion className="mx-auto max-w-4xl space-y-6">
      <header className="space-y-2">
        <Skeleton w={70} h={10} />
        <Skeleton w={210} h={34} />
        <Skeleton w="65%" h={14} />
      </header>

      <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton w={110} h={10} />
              <Skeleton w="100%" h={42} shape="card" tone="card" />
            </div>
          ))}
        </div>
        <div className="mt-4 space-y-1.5">
          <Skeleton w={120} h={10} />
          <Skeleton w="100%" h={120} shape="card" tone="card" />
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Skeleton w={82} h={40} shape="pill" tone="card" />
          <Skeleton w={112} h={40} shape="pill" tone="card" />
        </div>
      </section>
    </SkeletonRegion>
  );
}
