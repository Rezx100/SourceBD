import { KitLoading } from "@/components/dashboard/kit-loading";
import { PageSkeleton } from "@/components/dashboard/page-skeleton";

// The layout draws the shell; this is the content region while the page loads.

export default function SavedLoading() {
  return (
    <KitLoading>
      <PageSkeleton kind="table" />
    </KitLoading>
  );
}
