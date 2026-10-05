import { RfqListSkeleton } from "@/components/rfqs/list";

// The layout draws the frame; this is the content region while the list loads (Paper
// `10 · RFQs loading`).
//
// It lives in the `(list)` group, not at `rfqs/`, on purpose: a loading state
// is a Suspense boundary over every segment BELOW it, and at `rfqs/` it
// wrapped `rfqs/[id]` too, so its `notFound()` streamed behind a committed 200.

export default function RfqsLoading() {
  return <RfqListSkeleton />;
}
