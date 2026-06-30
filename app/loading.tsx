"use client";

// Root Suspense fallback. For authenticated surfaces, delegate to the
// route-aware app-shell skeleton so direct loads do not flash a generic card.

import AppLoading from "./(app)/loading";
import { Skeleton, SkeletonRegion } from "@/components/ui/skeleton";
import { usePathname } from "next/navigation";

export default function RootLoading() {
  const pathname = usePathname() ?? "/";

  if (
    pathname === "/app" ||
    pathname.startsWith("/app/") ||
    pathname === "/supplier" ||
    pathname.startsWith("/supplier/") ||
    pathname === "/admin" ||
    pathname.startsWith("/admin/")
  ) {
    return <AppLoading />;
  }

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-xl items-center px-6 py-16">
      <SkeletonRegion className="w-full rounded-card border border-hairline bg-surface-l1 p-6 shadow-l1 space-y-3">
        <Skeleton w={140} h={14} />
        <Skeleton w={200} h={12} />
        <Skeleton w="100%" h={100} shape="card" tone="card" />
      </SkeletonRegion>
    </main>
  );
}
