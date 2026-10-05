// Pricing (B9d): free during beta, two plans as they really are today, what ships now, the questions buyers ask.
// The page is `components/site/pricing.tsx`; the supplier count is the site's live fact, left out when not read.

import { Pricing, pricingMetadata } from "@/components/site/pricing";
import { loadSiteFacts } from "@/lib/site-facts";

export const dynamic = "force-dynamic";

export const metadata = pricingMetadata();

export default async function PricingPage() {
  return <Pricing facts={await loadSiteFacts()} />;
}
