// The four product pages (B9c): `/product/search|records|rfqs|compliance`, one template in `components/site/pages.tsx`,
// except the pages rebuilt in the home's frame with the demos (M4, `components/site/product/*`), each drawn with what
// it reads. Any other slug is a real 404.

import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { PAGES, siteMetadata } from "@/components/site/pages";
import { COMPLIANCE_KEY, CompliancePage } from "@/components/site/product/compliance";
import { RECORDS_KEY, RecordsPage } from "@/components/site/product/records";
import { RFQS_KEY, RfqsPage } from "@/components/site/product/rfqs";
import { SEARCH_KEY, SearchPage } from "@/components/site/product/search";
import { loadSiteFacts } from "@/lib/site-facts";

export const dynamic = "force-dynamic";
// An unknown slug is a 404 decided by the router, not by the page: a page-level notFound() under a loading boundary would answer 200, so no loading.tsx may sit above this folder.
export const dynamicParams = false;
export const generateStaticParams = () => Object.keys(PAGES).filter((k) => k.startsWith("product/")).map((k) => ({ slug: k.slice(8) }));

/** The pages rebuilt in the home's frame, each reading what it shows (soft and cached, as the home does). */
const REBUILT: Record<string, () => Promise<ReactNode>> = {
  [RECORDS_KEY]: async () => <RecordsPage />,
  [SEARCH_KEY]: async () => <SearchPage facts={await loadSiteFacts()} />,
  [RFQS_KEY]: async () => <RfqsPage />,
  [COMPLIANCE_KEY]: async () => <CompliancePage facts={await loadSiteFacts()} />,
};

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  return siteMetadata(`product/${slug}`) ?? {};
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const key = `product/${slug}`;
  if (!Object.hasOwn(PAGES, key)) notFound();
  // Every page is rebuilt in the home's frame (M4); one that is not has no page to draw.
  const rebuilt = REBUILT[key];
  if (!rebuilt) notFound();
  return rebuilt();
}
