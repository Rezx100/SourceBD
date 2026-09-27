import { KitLoading } from "@/components/dashboard/kit-loading";
import { PageSkeleton } from "@/components/dashboard/page-skeleton";

// Inside the kit's frame: the layout draws no shell on /app routes (`ShellSwitch`).

export default function ModernSlaveryActStatementLoading() {
  return (
    <KitLoading path="/app/compliance/msa" screenLabel="Modern Slavery Act statement">
      <PageSkeleton kind="form" />
    </KitLoading>
  );
}
