// The four product pages (B9c): `/product/search|records|rfqs|compliance`, one template in `components/site/pages.tsx`,
// except the pages rebuilt in the home's frame with the demos (M4): `/product/records` is `components/site/product/records.tsx`
// and reads the home's three real records too. Any other slug is a real 404.

import { notFound } from "next/navigation";
import { PAGES, SitePage, siteMetadata } from "@/components/site/pages";
import { RECORDS_KEY, RecordsPage } from "@/components/site/product/records";
import { loadHomeRecords } from "@/lib/home-records";
import { loadSiteFacts } from "@/lib/site-facts";

export const dynamic = "force-dynamic";
// An unknown slug is a 404 decided by the router, not by the page: a page-level notFound() under a loading boundary would answer 200, so no loading.tsx may sit above this folder.
export const dynamicParams = false;
export const generateStaticParams = () => Object.keys(PAGES).filter((k) => k.startsWith("product/")).map((k) => ({ slug: k.slice(8) }));

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  return siteMetadata(`product/${slug}`) ?? {};
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const key = `product/${slug}`;
  if (!Object.hasOwn(PAGES, key)) notFound();
  // The records page prints no live figure; it reads the home's three records (soft and cached, as the home does).
  if (key === RECORDS_KEY) return <RecordsPage cards={(await loadHomeRecords()).cards} />;
  return <SitePage pageKey={key} facts={await loadSiteFacts()} />;
}
