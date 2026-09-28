import { KitLoading } from "@/components/dashboard/kit-loading";
import { PageSkeleton } from "@/components/dashboard/page-skeleton";

// The layout draws the shell; this is the content region while the list loads.
// Only the list: it sits in the `(list)` group so the edit page's 404 stays a status code.

export default function ProductsLoading() {
  return (
    <KitLoading>
      <PageSkeleton kind="table" />
    </KitLoading>
  );
}
