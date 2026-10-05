// About (B9e): what SourceBD is for, where the suppliers are (dated counts), and how we work.

import { About, ABOUT_META, trustMetadata } from "@/components/site/trust";
import { loadSiteFacts } from "@/lib/site-facts";

export const dynamic = "force-dynamic";

export const metadata = trustMetadata(ABOUT_META.path, ABOUT_META.title, ABOUT_META.description);

export default async function AboutPage() {
  return <About facts={await loadSiteFacts()} />;
}
