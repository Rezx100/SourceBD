import { PaneSkeleton, RowSkeleton } from "@/components/kit";

export default function SupplierMessageThreadLoading() {
  return (
    <div className="mx-auto grid w-full max-w-[1200px] items-start gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
      <RowSkeleton rows={4} className="max-lg:hidden" />
      <PaneSkeleton />
    </div>
  );
}
