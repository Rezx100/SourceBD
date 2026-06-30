// I-027 — Skeleton silhouettes for the supplier-profile dossier. Shared by
// both `/app/suppliers/[slug]/loading.tsx` and `/suppliers/[slug]/loading.tsx`
// so the marketing + buyer routes show identical chrome while RSC streams.
//
// Dimensions mirror the real `.header-card`, `.metric-grid`, `.proto-card`,
// and `.prov-list` declarations in `app/globals.css` so layout shift between
// skeleton and rendered DOM is zero.

import { Skeleton } from "@/components/ui/skeleton";

/** Mirrors the dossier `.header-card` (64px / 1fr / auto grid). Below 900px
 *  the real CSS collapses to one column; the silhouette inherits that via
 *  the same class names. */
export function ProfileHeaderSkeleton() {
  return (
    <div className="header-card">
      {/* glyph column */}
      <div className="header-glyph-col">
        <Skeleton w={64} h={72} shape="card" />
        <Skeleton w={56} h={20} shape="pill" />
      </div>

      {/* identity column */}
      <div className="min-w-0">
        <Skeleton w={120} h={10} />
        <div className="mt-2">
          <Skeleton w="70%" h={40} />
        </div>
        <div className="mt-3">
          <Skeleton w={220} h={12} />
        </div>
        <div className="header-chips" style={{ marginTop: 14 }}>
          <Skeleton w={150} h={22} shape="pill" />
          <Skeleton w={90} h={22} shape="pill" />
          <Skeleton w={110} h={22} shape="pill" />
          <Skeleton w={80} h={22} shape="pill" />
        </div>
        <div className="header-meta-row" style={{ marginTop: 12 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i}>
              <Skeleton w={70} h={10} />
              <div className="mt-1.5">
                <Skeleton w={120} h={14} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* side column (completeness + CTAs) */}
      <div className="header-side">
        <Skeleton w={110} h={22} shape="pill" />
        <Skeleton w={140} h={36} shape="pill" />
        <Skeleton w={120} h={36} shape="pill" />
      </div>
    </div>
  );
}

/** Mirrors the tab strip — 6 tabs at ~96px each, 36px tall. */
export function ProfileTabsSkeleton() {
  return (
    <div className="flex flex-wrap gap-2" aria-hidden>
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} w={96} h={36} shape="pill" tone="card" />
      ))}
    </div>
  );
}

function CertRowSkeleton() {
  return (
    <div className="cert">
      <Skeleton w={36} h={36} shape="card" />
      <div className="cert-main">
        <Skeleton w={92} h={16} />
        <Skeleton w="80%" h={12} />
      </div>
      <Skeleton w={64} h={24} shape="pill" />
    </div>
  );
}

/** Tabbed-body placeholder: compliance-first cards matching the default tab. */
export function ProfileTabBodySkeleton() {
  return (
    <div className="space-y-4">
      <div className="proto-card space-y-3">
        <div className="proto-card-head">
          <Skeleton w={130} h={16} />
          <Skeleton w={120} h={12} />
        </div>
        <div className="cert-list">
          <CertRowSkeleton />
          <CertRowSkeleton />
          <CertRowSkeleton />
        </div>
      </div>
      <div className="proto-card space-y-3">
        <div className="proto-card-head">
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
    <div className="proto-card space-y-3">
      <div className="proto-card-head">
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
