// I-027 — App-shell Suspense fallback. This is the *catch-all* for any
// (app)/* segment without its own `loading.tsx`. High-traffic segments
// (dashboard, discover, profile, supplier portal, rfqs, orders, saved,
// messages, compliance, admin) own pixel-matched skeletons next to their
// page.tsx — this one only fires on long-tail / new routes. Kept calm:
// matches the standard page chrome (header + a single card) so the user
// gets honest "something is loading here" without misrepresenting shape.

import { ProtoCardSkeleton } from "@/components/supplier/profile-skeleton";
import { Skeleton, SkeletonRegion } from "@/components/ui/skeleton";

export default function AppLoading() {
  return (
    <SkeletonRegion className="mx-auto max-w-5xl space-y-6">
      <header className="space-y-2">
        <Skeleton w={70} h={10} />
        <Skeleton w={200} h={32} />
      </header>
      <ProtoCardSkeleton rows={4} title={180} />
    </SkeletonRegion>
  );
}
