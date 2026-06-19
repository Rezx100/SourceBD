// Auth-shell Suspense fallback — mirrors the split-pane layout.

import { Skeleton, SkeletonRegion } from "@/components/ui/skeleton";

export default function AuthLoading() {
  return (
    <SkeletonRegion className="flex min-h-svh bg-white">
      {/* Left brand panel silhouette */}
      <div className="hidden w-[45%] shrink-0 flex-col justify-between border-r border-neutral-200 bg-[#f5f8f6] p-12 lg:flex xl:w-[42%]">
        <Skeleton w={140} h={32} shape="pill" tone="card" />
        <div className="space-y-4">
          <Skeleton w={120} h={24} shape="pill" tone="card" />
          <Skeleton w="80%" h={40} tone="card" />
          <Skeleton w="100%" h={56} tone="card" />
          <Skeleton w="100%" h={150} shape="card" tone="card" />
        </div>
        <Skeleton w={200} h={12} tone="card" />
      </div>

      {/* Right form panel silhouette */}
      <div className="flex flex-1 items-center justify-center px-6">
        <div className="w-full max-w-[26rem] space-y-5">
          <Skeleton w={180} h={28} tone="card" />
          <Skeleton w={220} h={14} tone="card" />
          <div className="space-y-2 pt-3">
            <Skeleton w={70} h={12} tone="card" />
            <Skeleton w="100%" h={48} shape="card" tone="card" />
          </div>
          <div className="space-y-2">
            <Skeleton w={70} h={12} tone="card" />
            <Skeleton w="100%" h={48} shape="card" tone="card" />
          </div>
          <Skeleton w="100%" h={48} shape="card" tone="card" />
        </div>
      </div>
    </SkeletonRegion>
  );
}
