// The two solutions pages (B9c): `/solutions/sourcing` and `/solutions/compliance`, one template in
// `components/site/pages.tsx`. Any other slug is a real 404.

import { notFound } from "next/navigation";
import { PAGES, SitePage, siteMetadata } from "@/components/site/pages";
import { loadSiteFacts } from "@/lib/site-facts";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  return siteMetadata(`solutions/${slug}`) ?? {};
}

export default async function SolutionsPage({ params }: Props) {
  const { slug } = await params;
  const key = `solutions/${slug}`;
  if (!Object.hasOwn(PAGES, key)) notFound();
  return <SitePage pageKey={key} facts={await loadSiteFacts()} />;
}
