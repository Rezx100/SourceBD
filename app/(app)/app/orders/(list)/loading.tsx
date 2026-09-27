import { KitLoading } from "@/components/dashboard/kit-loading";
import { PageSkeleton } from "@/components/dashboard/page-skeleton";

// The layout draws the shell; this is the content region while the list loads.
//
// It lives in the `(list)` group, not at `orders/`, on purpose: a loading
// state is a Suspense boundary over every segment BELOW it, and at `orders/`
// it wrapped `orders/[id]` and `orders/new` too, so their `notFound()` streamed
// behind a committed 200 (and a detail page flashed this table skeleton).

export default function OrdersLoading() {
  return (
    <KitLoading>
      <PageSkeleton kind="table" />
    </KitLoading>
  );
}
