import { Skeleton, SkeletonRegion } from "@/components/ui/skeleton";

export default function SmartMatchLoading() {
  return (
    <SkeletonRegion className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-col gap-4 border-b border-hairline pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="mb-2 inline-flex items-center gap-2">
            <Skeleton w={6} h={6} shape="circle" />
            <Skeleton w={102} h={11} />
          </div>
          <div className="flex items-center gap-3">
            <Skeleton w={44} h={44} shape="card" />
            <Skeleton w={300} h={34} />
          </div>
          <Skeleton w="100%" h={15} className="mt-2.5 max-w-2xl" />
        </div>
      </header>

      <div className="space-y-4">
        <ol
          aria-hidden
          className="flex items-center gap-2 text-[12px]"
        >
          {["Product", "Requirements", "Review & match"].map((label, i) => (
            <li key={label} className="flex items-center gap-2">
              <Skeleton w={24} h={24} shape="pill" />
              <Skeleton w={i === 0 ? 44 : i === 1 ? 82 : 98} h={11} />
              {i < 2 ? <Skeleton w={24} h={1} className="mx-1" /> : null}
            </li>
          ))}
        </ol>

        <section className="proto-card space-y-5">
          <div className="proto-card-head">
            <Skeleton w={125} h={18} />
            <Skeleton w={132} h={12} />
          </div>

          <div className="block space-y-1.5">
            <Skeleton w={128} h={11} />
            <Skeleton w="100%" h={38} shape="card" tone="card" />
            <Skeleton w={430} h={12} className="max-w-full" />
          </div>

          <div className="block space-y-1.5">
            <Skeleton w={165} h={11} />
            <div className="flex flex-wrap gap-1.5">
              <Skeleton w={72} h={26} shape="pill" tone="card" />
              <Skeleton w={112} h={26} shape="pill" tone="card" />
            </div>
            <Skeleton w={470} h={12} className="max-w-full" />
          </div>

          <div className="h-[84px] md:hidden" aria-hidden />
          <div className="fixed bottom-[calc(56px+env(safe-area-inset-bottom,0px))] left-0 right-0 z-30 flex flex-col gap-2 border-t border-neutral-200 bg-white px-4 py-3 shadow-sm md:static md:flex-row md:items-center md:gap-3 md:rounded-b-lg md:border-0 md:border-t md:bg-transparent md:px-0 md:py-4 md:shadow-none">
            <div className="md:flex-1" />
            <div className="flex items-center justify-end gap-2">
              <Skeleton w={156} h={38} shape="pill" />
            </div>
          </div>
        </section>
      </div>
    </SkeletonRegion>
  );
}
