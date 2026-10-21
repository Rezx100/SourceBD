// Security (B9e): nine plain answers for a security review, then the details and what we do not have yet.

import { Security, SECURITY_META, trustMetadata } from "@/components/site/trust";

export const dynamic = "force-static";

export const metadata = trustMetadata(SECURITY_META.path, SECURITY_META.title, SECURITY_META.description);

export default function SecurityPage() {
  return <Security />;
}
