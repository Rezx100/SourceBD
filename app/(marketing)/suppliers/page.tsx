// For suppliers (B9e): why claim, what a supplier can change, the three steps. "Start your claim" opens the supplier
// sign-up; the claim itself lives in the supplier portal. The public record pages are `app/(public)/suppliers/[slug]`.

import { ForSuppliers, SUPPLIERS_META, trustMetadata } from "@/components/site/trust";
import { loadSiteFacts } from "@/lib/site-facts";

export const dynamic = "force-dynamic";

export const metadata = trustMetadata(SUPPLIERS_META.path, SUPPLIERS_META.title, SUPPLIERS_META.description);

export default async function SuppliersPage() {
  return <ForSuppliers facts={await loadSiteFacts()} />;
}
