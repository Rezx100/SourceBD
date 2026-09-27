import { KitLoading } from "@/components/dashboard/kit-loading";
import { PageSkeleton } from "@/components/dashboard/page-skeleton";

// The buyer section's own loading state, for every route without a closer one:
// the shell is already on screen (the layout draws it), so this is only the
// content region waiting for its page.

export default function BuyerLoading() {
  return (
    <KitLoading>
      <PageSkeleton kind="table" />
    </KitLoading>
  );
}
