// The body of a buyer page while it loads, inside `KitLoading`'s real shell.
// Shapes, not spinners: the header, then the page's own layout — a table, a
// detail page, a form, a grid of cards or a conversation — so nothing jumps
// when the page arrives.

import { Skeleton, SkeletonRegion } from "@/components/ui/skeleton";

export type PageSkeletonKind = "table" | "detail" | "form" | "cards" | "thread";

export function PageSkeleton({ kind }: { kind: PageSkeletonKind }) {
  return (
    <SkeletonRegion className="flex min-h-[calc(100dvh-9rem)] flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Skeleton w={200} h={24} />
        <Skeleton w={320} h={14} />
      </div>
      {kind === "table" ? (
        <div className="flex flex-col gap-2">
          <Skeleton w="100%" h={36} tone="card" />
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} w="100%" h={44} tone="card" />
          ))}
        </div>
      ) : kind === "detail" ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <Skeleton w="100%" h={360} tone="card" />
          <Skeleton w="100%" h={220} tone="card" />
        </div>
      ) : kind === "form" ? (
        <div className="flex max-w-2xl flex-col gap-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="flex flex-col gap-1.5">
              <Skeleton w={120} h={14} />
              <Skeleton w="100%" h={32} tone="card" />
            </div>
          ))}
        </div>
      ) : kind === "thread" ? (
        <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
          <Skeleton w="100%" h={420} tone="card" />
          <Skeleton w="100%" h={420} tone="card" />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} w="100%" h={140} tone="card" />
          ))}
        </div>
      )}
    </SkeletonRegion>
  );
}
