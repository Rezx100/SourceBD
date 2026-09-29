// Spec H5 — Supplier route-group layout. Same shape as the buyer layout;
// mounts the onboarding tour with the supplier flavour. Short-circuits
// server-side for returning users.

import { TourMount } from "@/components/onboarding/tour-mount";

export default function SupplierLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <TourMount flavour="supplier" />
    </>
  );
}
