import { KitLoading } from "@/components/dashboard/kit-loading";
import { PageSkeleton } from "@/components/dashboard/page-skeleton";

// The layout draws the shell; this is the content region while the page loads.

export default function ConversationLoading() {
  return (
    <KitLoading>
      <PageSkeleton kind="thread" />
    </KitLoading>
  );
}
