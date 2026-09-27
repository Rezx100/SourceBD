import { KitLoading } from "@/components/dashboard/kit-loading";
import { PageSkeleton } from "@/components/dashboard/page-skeleton";

// Inside the kit's frame: the layout draws no shell on /app routes (`ShellSwitch`).

export default function CertificateExpiryLoading() {
  return (
    <KitLoading path="/app/compliance/expiry" screenLabel="Certificate expiry">
      <PageSkeleton kind="table" />
    </KitLoading>
  );
}
