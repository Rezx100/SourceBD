// Data & methodology (B9e): the source ladder and the 25 sources by tier (figures only when read), freshness,
// matching, corrections and what we never do.

import { Methodology, METHOD_META, trustMetadata } from "@/components/site/trust";
import { loadSiteFacts } from "@/lib/site-facts";

export const dynamic = "force-dynamic";

export const metadata = trustMetadata(METHOD_META.path, METHOD_META.title, METHOD_META.description);

export default async function MethodologyPage() {
  return <Methodology facts={await loadSiteFacts()} />;
}
