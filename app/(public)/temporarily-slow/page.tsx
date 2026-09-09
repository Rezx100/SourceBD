import type { Metadata } from "next";
import { notFound } from "next/navigation";

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
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-6">
        <h1 className="text-lg font-semibold text-amber-900">
          Service temporarily slow
        </h1>
        <p className="mt-2 text-sm text-amber-800">
          The factory profile for{" "}
          <span className="font-mono">{slug}</span> couldn&apos;t load
          within the time limit. Use Retry to try the factory page again.
          Refreshing this page will not reload it.
        </p>
        <form action="/temporarily-slow/retry" method="POST">
          <input type="hidden" name="slug" value={slug} />
          <button
            type="submit"
            className="mt-4 inline-flex items-center rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700"
          >
            Retry
          </button>
        </form>
      </div>
    </div>
  );
}
