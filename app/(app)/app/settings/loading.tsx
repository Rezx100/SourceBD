import { Skeleton, SkeletonRegion } from "@/components/ui/skeleton";

export default function SettingsLoading() {
  return (
    <SkeletonRegion className="mx-auto max-w-6xl space-y-6">
      <header className="space-y-2">
        <Skeleton w={80} h={10} />
        <Skeleton w={170} h={36} />
        <Skeleton w="55%" h={14} />
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <section key={i} className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <Skeleton w={40} h={40} shape="card" tone="card" />
              <Skeleton w={16} h={16} shape="circle" />
            </div>
            <div className="mt-4 space-y-2">
              <Skeleton w={150} h={18} />
              <Skeleton w="70%" h={12} />
              <Skeleton w="92%" h={12} />
              <Skeleton w="80%" h={12} />
            </div>
          </section>
        ))}
      </div>

      <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
        <Skeleton w={95} h={18} />
        <div className="mt-2">
          <Skeleton w={180} h={12} />
        </div>
        <div className="mt-4">
          <Skeleton w={82} h={38} shape="pill" tone="card" />
        </div>
      </section>
    </SkeletonRegion>
  );
}
