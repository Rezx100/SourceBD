// I-027 — RFQ list skeleton. Mirrors `app/(app)/app/rfqs/page.tsx` which
// renders a `proto-card p-0` containing a flex-row list (icon · title +
// metadata · timestamp), not a rigid table.

import { Skeleton, SkeletonRegion } from "@/components/ui/skeleton";

export default function RfqsLoading() {
  return (
    <SkeletonRegion className="mx-auto max-w-5xl space-y-6">
      <header className="space-y-2">
        <Skeleton w={70} h={10} />
        <Skeleton w={150} h={32} />
      </header>
      <div className="proto-card p-0">
        <ul className="m-0 flex list-none flex-col p-0">
          {Array.from({ length: 6 }).map((_, i) => (
            <li
              key={i}
              className="flex items-center gap-3 border-b border-hairline px-5 py-3 last:border-0"
            >
              <Skeleton w={18} h={18} shape="circle" />
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Skeleton w={160} h={14} />
                  <Skeleton w={70} h={18} shape="pill" tone="card" />
                </div>
                <Skeleton w="60%" h={11} />
              </div>
              <Skeleton w={70} h={11} className="shrink-0" />
            </li>
          ))}
        </ul>
      </div>
    </SkeletonRegion>
  );
}
