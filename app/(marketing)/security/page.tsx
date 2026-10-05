// Security (B9e): nine plain answers for a security review, then the details and what we do not have yet.

import { Security, SECURITY_META, trustMetadata } from "@/components/site/trust";
import { loadSiteFacts } from "@/lib/site-facts";

export const dynamic = "force-dynamic";

export const metadata = trustMetadata(SECURITY_META.path, SECURITY_META.title, SECURITY_META.description);

export default async function SecurityPage() {
  return <Security facts={await loadSiteFacts()} />;
}
