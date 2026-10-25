// The two solutions pages (B9c): `/solutions/sourcing` and `/solutions/compliance`, drawn in the home page's design
// with the product pages' recordings of the real app (`components/site/product/solutions.tsx`, 25 Oct 2026). Any
// other slug is a real 404.

import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { PAGES, siteMetadata } from "@/components/site/pages";
import { COMPLIANCE_TEAMS_KEY, SOURCING_KEY, SolutionsCompliancePage, SolutionsSourcingPage } from "@/components/site/product/solutions";

export const dynamic = "force-dynamic";
// An unknown slug is a 404 decided by the router, not by the page: a page-level notFound() under a loading boundary would answer 200, so no loading.tsx may sit above this folder.
export const dynamicParams = false;
export const generateStaticParams = () => Object.keys(PAGES).filter((k) => k.startsWith("solutions/")).map((k) => ({ slug: k.slice(10) }));

const REBUILT: Record<string, () => ReactNode> = {
  [SOURCING_KEY]: () => <SolutionsSourcingPage />,
  [COMPLIANCE_TEAMS_KEY]: () => <SolutionsCompliancePage />,
};

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  return siteMetadata(`solutions/${slug}`) ?? {};
}

export default async function SolutionsPage({ params }: Props) {
  const { slug } = await params;
  const key = `solutions/${slug}`;
  if (!Object.hasOwn(PAGES, key)) notFound();
  // Every page is rebuilt in the home's frame (M4); one that is not has no page to draw.
  const rebuilt = REBUILT[key];
  if (!rebuilt) notFound();
  return rebuilt();
}
