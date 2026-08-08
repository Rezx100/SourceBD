// I-027 — Skeleton silhouettes for the supplier-profile dossier. Used by the
// admin/supplier detail `loading.tsx` files (the buyer and public profile
// routes no longer have segment loadings — REZ-72 removed them so profile
// misses emit real 404/308 statuses instead of a streamed soft-200).
//
// Dimensions mirror the real `.header-card`, `.metric-grid`, `.proto-card`,
// and `.prov-list` declarations in `app/globals.css` so layout shift between
// skeleton and rendered DOM is zero.

import { Skeleton } from "@/components/ui/skeleton";

export function ProfileHeaderSkeleton() {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm sm:p-5 lg:p-6">
      <div className="grid gap-5 lg:grid-cols-[76px_minmax(0,1fr)_minmax(170px,auto)]">
        <div className="flex items-start gap-3 lg:flex-col lg:items-center">
          <Skeleton w={64} h={60} shape="card" />
          <Skeleton w={58} h={22} shape="pill" />
        </div>
        <div className="min-w-0">
          <Skeleton w={150} h={10} />
          <div className="mt-2">
            <Skeleton w="72%" h={38} />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Skeleton w={70} h={22} shape="pill" />
            <Skeleton w={140} h={14} />
            <Skeleton w={120} h={14} />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Skeleton w={32} h={32} shape="card" />
            <Skeleton w={32} h={32} shape="card" />
            <Skeleton w={32} h={32} shape="card" />
            <Skeleton w={130} h={14} />
            <Skeleton w={92} h={22} shape="pill" />
          </div>
          <div className="mt-5 grid gap-3 border-t border-neutral-100 pt-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i}>
                <Skeleton w={70} h={10} />
                <div className="mt-2">
                  <Skeleton w="80%" h={14} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2 lg:items-end">
          <Skeleton w={140} h={44} shape="pill" />
          <Skeleton w={140} h={44} shape="pill" />
        </div>
      </div>
    </div>
  );
}

/** Mirrors the tab strip — 6 tabs at ~96px each, 36px tall. */
export function ProfileTabsSkeleton() {
  return (
    <div
      className="flex gap-2 overflow-hidden rounded-lg border border-neutral-200 bg-white p-2 shadow-sm"
      aria-hidden
    >
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} w={96} h={36} shape="pill" tone="card" />
      ))}
    </div>
  );
}

function CertRowSkeleton() {
  return (
    <div className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 border-t border-neutral-100 py-3">
      <Skeleton w={32} h={32} shape="card" />
      <div>
        <Skeleton w={92} h={16} />
        <div className="mt-1">
          <Skeleton w="80%" h={12} />
        </div>
      </div>
      <Skeleton w={64} h={24} shape="pill" />
    </div>
  );
}

/** Tabbed-body placeholder: compliance-first cards matching the default tab. */
export function ProfileTabBodySkeleton() {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex items-baseline justify-between border-b border-neutral-100 pb-3">
          <Skeleton w={130} h={16} />
          <Skeleton w={120} h={12} />
        </div>
        <div>
          <CertRowSkeleton />
          <CertRowSkeleton />
          <CertRowSkeleton />
        </div>
      </div>
      <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex items-baseline justify-between border-b border-neutral-100 pb-3">
          <Skeleton w={150} h={16} />
          <Skeleton w={90} h={12} />
        </div>
        <div className="space-y-2">
          <Skeleton w="100%" h={38} shape="card" />
          <Skeleton w="100%" h={38} shape="card" />
        </div>
      </div>
    </div>
  );
}

export function MetricSkeleton() {
  return (
    <div className="metric">
      <Skeleton w={80} h={10} />
      <div className="mt-2">
        <Skeleton w={70} h={22} />
      </div>
      <div className="mt-2">
        <Skeleton w={100} h={10} />
      </div>
    </div>
  );
}

/** Mirrors `.proto-card` with a card-head + body rows. */
export function ProtoCardSkeleton({
  rows = 3,
  title = 160,
}: {
  rows?: number;
  title?: number;
}) {
  return (
    <div className="space-y-3 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="border-b border-neutral-100 pb-3">
        <Skeleton w={title} h={16} />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} w={i === rows - 1 ? "70%" : "100%"} h={12} />
      ))}
    </div>
  );
}

/** Mirrors `DiscoverResultCard`: verified-sources ring + source pills + fact chips. */
export function DiscoverResultCardSkeleton() {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-5">
        <Skeleton w={48} h={48} shape="circle" />
        <div className="min-w-0 flex-1 space-y-2.5">
          <Skeleton w="55%" h={16} />
          <div className="flex flex-wrap gap-2">
            <Skeleton w={64} h={22} shape="pill" />
            <Skeleton w={120} h={12} />
          </div>
          <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-1.5">
              <Skeleton w={76} h={32} shape="pill" />
              <Skeleton w={86} h={32} shape="pill" />
              <Skeleton w={68} h={32} shape="pill" />
            </div>
            <div className="flex flex-wrap gap-1.5 sm:justify-end">
              <Skeleton w={82} h={28} shape="pill" />
              <Skeleton w={76} h={28} shape="pill" />
            </div>
          </div>
          <Skeleton w="70%" h={12} />
          <Skeleton w="58%" h={12} />
        </div>
      </div>
    </div>
  );
}
