import { KitLoading } from "@/components/dashboard/kit-loading";
import { PageSkeleton } from "@/components/dashboard/page-skeleton";

// Inside the kit's frame: the layout draws no shell on /app routes (`ShellSwitch`).

export default function ProfileLoading() {
  return (
    <KitLoading path="/app/settings/profile" screenLabel="Profile">
      <PageSkeleton kind="form" />
    </KitLoading>
  );
}
