import { OrdersSkeleton } from "@/components/orders/list";

// The layout draws the frame; this is the content region while the list loads.
//
// It lives in the `(list)` group, not at `orders/`, on purpose: a loading state is a Suspense
// boundary over every segment BELOW it, and at `orders/` it wrapped `orders/[id]` too, so its
// `notFound()` streamed behind a committed 200.

export default function OrdersLoading() {
  return <OrdersSkeleton />;
}
