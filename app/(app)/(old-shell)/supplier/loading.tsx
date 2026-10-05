// I-027 — Supplier portal landing skeleton. Mirrors the real
// `app/(app)/(old-shell)/supplier/page.tsx`: a heading and lede, then a stack of
// section blocks. Sits inside the portal frame's page padding.

import { RowSkeleton, Skeleton } from "@/components/kit";

export default function SupplierHomeLoading() {
  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6">
      <header className="flex flex-col gap-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton tone="subtle" className="h-4 w-96 max-w-full" />
      </header>
      <RowSkeleton rows={2} />
      <RowSkeleton rows={3} />
      <RowSkeleton rows={3} />
    </div>
  );
}
