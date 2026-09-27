import { KitLoading } from "@/components/dashboard/kit-loading";
import { PageSkeleton } from "@/components/dashboard/page-skeleton";

// Inside the kit's frame: the layout draws no shell on /app routes (`ShellSwitch`).

export default function UflpaTrackerLoading() {
  return (
    <KitLoading path="/app/compliance/uflpa" screenLabel="UFLPA tracker">
      <PageSkeleton kind="table" />
    </KitLoading>
  );
}
