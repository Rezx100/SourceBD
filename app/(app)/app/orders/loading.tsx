import { KitLoading } from "@/components/dashboard/kit-loading";
import { PageSkeleton } from "@/components/dashboard/page-skeleton";

// Inside the kit's frame: the layout draws no shell on /app routes (`ShellSwitch`).

export default function OrdersLoading() {
  return (
    <KitLoading path="/app/orders" screenLabel="Orders">
      <PageSkeleton kind="table" />
    </KitLoading>
  );
}
