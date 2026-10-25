// A supplier's public record that could not be read in time (the middleware's 307 lands here), in the marketing site's
// design since 25 Oct 2026: home's head on the day ground and one action, Retry, which posts to the retry route.

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { buttonClass } from "@/components/kit/button-class";
import { HomeMain } from "@/components/site/home-main";
import { PageHead } from "@/components/site/sections/inner";
import { isPublicSupplierSlug } from "@/lib/public-supplier-profile";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Service temporarily slow — SourceBD",
  robots: { index: false, follow: false },
};

export default async function TemporarilySlowPage({
  searchParams,
}: {
  searchParams: Promise<{ slug?: string | string[] }>;
}) {
  const raw = (await searchParams).slug;
  const slug = Array.isArray(raw) ? raw[0] : raw;
  if (!slug || !isPublicSupplierSlug(slug)) {
    notFound();
  }
  return (
    <HomeMain className="font-sans antialiased">
      <PageHead
        tone="day"
        label="Service temporarily slow"
        title="This factory page is taking too long."
        lede={
          <>
            The factory profile for <span className="font-mono text-ink">{slug}</span> couldn&apos;t load within the time limit. Use Retry to try the factory page again. Refreshing this page will not reload it.
          </>
        }
      >
        <form action="/temporarily-slow/retry" method="POST">
          <input type="hidden" name="slug" value={slug} />
          <button type="submit" className={buttonClass({ kind: "primary", size: "lg", className: "h-10 rounded-full px-5 text-site-item" })}>
            Retry
          </button>
        </form>
      </PageHead>
    </HomeMain>
  );
}
