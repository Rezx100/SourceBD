import { InboxSkeleton } from "@/components/messages/list";

// The layout draws the frame; this is the content region while the inbox loads.
//
// It lives in the `(list)` group, not at `messages/`, on purpose: a loading state is a Suspense
// boundary over every segment BELOW it, and at `messages/` it wrapped `messages/[thread]` too, so
// its `notFound()` streamed behind a committed 200.

export default function MessagesLoading() {
  return <InboxSkeleton />;
}
