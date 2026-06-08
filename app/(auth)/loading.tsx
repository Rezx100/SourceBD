// R9 — Auth-shell Suspense fallback. Mirrors the real AuthShell split-pane
// so the suspense fallback doesn't reflow into a different layout when the
// real form mounts. Brand panel hides <920 the same way the live shell does.

import { Skeleton, SkeletonRegion } from "@/components/ui/skeleton";

export default function AuthLoading() {
  return (
    <SkeletonRegion>
      <main className="mkt-auth">
        <section className="mkt-auth-brand" aria-hidden="true">
          <div className="mkt-ab-inner space-y-6">
            <Skeleton w={120} h={20} tone="card" />
            <div className="space-y-3">
              <Skeleton w="85%" h={36} tone="card" />
              <Skeleton w="70%" h={36} tone="card" />
            </div>
            <Skeleton w="90%" h={14} tone="card" />
            <div className="space-y-2 rounded-card border border-white/15 bg-white/[0.04] p-4">
              <Skeleton w="60%" h={12} tone="card" />
              <Skeleton w="40%" h={10} tone="card" />
              <Skeleton w="100%" h={8} tone="card" />
              <Skeleton w="100%" h={10} tone="card" />
              <Skeleton w="100%" h={10} tone="card" />
              <Skeleton w="100%" h={10} tone="card" />
            </div>
            <Skeleton w="80%" h={12} tone="card" />
          </div>
        </section>

        <section className="mkt-auth-main">
          <div className="mkt-am-card space-y-4">
            <Skeleton w={120} h={20} />
            <div className="space-y-2">
              <Skeleton w={180} h={26} />
              <Skeleton w={220} h={14} />
            </div>
            <div className="space-y-2 pt-3">
              <Skeleton w={70} h={11} />
              <Skeleton w="100%" h={48} shape="card" tone="card" />
            </div>
            <div className="space-y-2">
              <Skeleton w={70} h={11} />
              <Skeleton w="100%" h={48} shape="card" tone="card" />
            </div>
            <div className="flex items-center justify-between pt-1">
              <Skeleton w={110} h={16} />
              <Skeleton w={90} h={14} />
            </div>
            <Skeleton w="100%" h={44} shape="pill" tone="card" />
            <div className="flex items-center gap-3 py-2">
              <Skeleton w="100%" h={1} tone="card" />
              <Skeleton w={120} h={10} tone="card" />
              <Skeleton w="100%" h={1} tone="card" />
            </div>
            <div className="space-y-2">
              <Skeleton w={120} h={11} />
              <Skeleton w="100%" h={48} shape="card" tone="card" />
            </div>
            <Skeleton w="100%" h={44} shape="pill" tone="card" />
            <Skeleton w={200} h={14} className="mx-auto" />
          </div>
        </section>
      </main>
    </SkeletonRegion>
  );
}

