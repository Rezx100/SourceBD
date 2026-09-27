import { KitLoading } from "@/components/dashboard/kit-loading";
import { PageSkeleton } from "@/components/dashboard/page-skeleton";

// The layout draws the shell; this is the content region while the list loads.
//
// It lives in the `(list)` group, not at `rfqs/`, on purpose: a loading state
// is a Suspense boundary over every segment BELOW it, and at `rfqs/` it
// wrapped `rfqs/[id]` too, so its `notFound()` streamed behind a committed 200.

export default function RfqsLoading() {
  return (
    <KitLoading>
      <PageSkeleton kind="table" />
    </KitLoading>
  );
}
