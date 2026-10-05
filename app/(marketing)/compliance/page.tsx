// Compliance guides, the index (B9f): five laws, each with the date we last reviewed it. The words of each guide are
// `lib/marketing/compliance-pages`. Static, and `assertContentFresh()` still fails the build if any guide is over 365 days old.

import type { Metadata } from "next";
import { GuidesIndex } from "@/components/site/guides";
import { HUB_METADATA, assertContentFresh } from "@/lib/marketing/compliance-pages";

export const dynamic = "force-static";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://sourcebd.net";

export const metadata: Metadata = {
  title: HUB_METADATA.title,
  description: HUB_METADATA.description,
  robots: { index: true, follow: true },
  alternates: { canonical: SITE_URL + "/compliance" },
};

export default function ComplianceIndexPage() {
  assertContentFresh();
  return <GuidesIndex />;
}
