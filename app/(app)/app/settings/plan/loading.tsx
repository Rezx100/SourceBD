import { KitLoading } from "@/components/dashboard/kit-loading";
import { PageSkeleton } from "@/components/dashboard/page-skeleton";

// Inside the kit's frame: the layout draws no shell on /app routes (`ShellSwitch`).

export default function PlanLoading() {
  return (
    <KitLoading path="/app/settings/plan" screenLabel="Plan">
      <PageSkeleton kind="cards" />
    </KitLoading>
  );
}
