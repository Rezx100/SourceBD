// Spec H5 — Buyer route-group layout. Mounts the onboarding tour below the
// shared app shell. The mount short-circuits server-side when the caller's
// `profiles.onboarding_state.tour_completed_at` (or `tour_dismissed_at`) is
// set, so returning users incur a single profile SELECT and zero client JS.

import { TourMount } from "@/components/onboarding/tour-mount";

export default function BuyerLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <TourMount flavour="buyer" />
    </>
  );
}
