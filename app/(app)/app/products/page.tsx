// REZ-B — HS catalogue. Live exporter counts from hs_catalogue(); the photo
// files come from the generated catalogue.

import Link from "next/link";
import { AppShell } from "@/components/dashboard/app-shell";
import { PhotoThumbs } from "@/components/dashboard/photo-tiles";
import { Caption, Title } from "@/components/dashboard/type";
import { loadBuyerShell } from "@/lib/dashboard/load-buyer-shell";
import { hsPhotoSrc, heading4, hsShortLabel } from "@/lib/dashboard/hs-photos";
import { fetchHsCatalogue } from "@/lib/discover-v32-rpc";
import { hsBuyerLabel } from "@/lib/epb-hscode-labels";
import { formatCount } from "@/lib/dashboard/facts";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Products · SourceBD",
};

const CHAPTER: Record<string, string> = {
  "42": "Leather goods",
  "60": "Knitted fabrics",
  "61": "Knit apparel",
  "62": "Woven apparel",
  "63": "Made-up textiles",
  "65": "Headgear",
};

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const qRaw = sp.q;
  const q = (Array.isArray(qRaw) ? qRaw[0] : qRaw)?.trim().toLowerCase() ?? "";
  const supabase = await createSupabaseServerClient();
  const shell = await loadBuyerShell(supabase, "products");
  const live = await fetchHsCatalogue(supabase);

  const rows = live.error
    ? []
    : live.rows.filter((r) => {
        if (!q) return true;
        const heading = (r.heading ?? hsBuyerLabel(r.hs, null)).toLowerCase();
        return r.hs.includes(q) || heading.includes(q);
      });

  return (
    <AppShell sidebar={shell.sidebar} topbar={shell.topbar} mainId="main-content" screenLabel="Products">
      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <div>
          <Title as="h1">Products</Title>
          <Caption>
            {live.error
              ? "Exporter counts could not be read"
              : `${formatCount(rows.length)} HS ${rows.length === 1 ? "heading" : "headings"}`}
          </Caption>
        </div>
        {/* Was a hard `w-[20rem]` with no `min-w-0`: 320px of search box in a
            288px content column, so the page scrolled sideways before the
            table even had a say. */}
        <form action="/app/products" method="get" role="search" className="flex h-control w-full min-w-0 items-center rounded-sm border border-line-strong bg-surface px-2.5 sm:w-[20rem]">
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search headings"
            aria-label="Search headings"
            // See components/dashboard/app-shell.tsx: `outline-none` beats the
            // global focus ring and leaves no keyboard indicator.
            className="w-full bg-transparent text-sm"
          />
        </form>
      </div>
      {live.error ? (
        <p className="text-sm text-ink-muted">The catalogue could not be read. Try again in a moment.</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-ink-muted">No heading matches that search.</p>
      ) : (
        // `w-16` + `w-28` + `w-28` is 288px of fixed columns, so at 320px the
        // Heading column — the HS code and the link into Discover, the whole
        // point of the page — was allocated nothing and overlapped Chapter.
        // Unlike ResultsTable this one had no scroll container, so there was
        // nothing to scroll and the content was simply crushed.
        <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="HS headings table">
        <table className="w-full min-w-[34rem] table-fixed border-collapse text-sm">
          <thead>
            <tr>
              <th className="w-16 border-b border-line-subtle py-2 text-left font-mono text-eyebrow uppercase text-ink-subtle">Photo</th>
              <th className="border-b border-line-subtle py-2 text-left font-mono text-eyebrow uppercase text-ink-subtle">Heading</th>
              <th className="w-28 border-b border-line-subtle py-2 text-left font-mono text-eyebrow uppercase text-ink-subtle">Chapter</th>
              <th className="w-28 border-b border-line-subtle py-2 text-right font-mono text-eyebrow uppercase text-ink-subtle">Exporters</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const hs = heading4(r.hs);
              const src = hsPhotoSrc(hs, 128);
              const chapter = hs.slice(0, 2);
              return (
                <tr key={hs} className="border-b border-line-subtle">
                  <td className="py-2">
                    <PhotoThumbs
                      tiles={[
                        {
                          hs,
                          short: hsShortLabel(hs, r.heading),
                          src: hsPhotoSrc(hs, 512),
                          thumb: src,
                        },
                      ]}
                      totalLines={1}
                    />
                  </td>
                  <td className="py-2">
                    <Link href={`/app/discover?hs=${hs}`} className="font-medium text-brand-ink">
                      <span className="font-mono">{hs}</span> {hsBuyerLabel(hs, r.heading)}
                    </Link>
                  </td>
                  <td className="py-2 text-ink-muted">{CHAPTER[chapter] ?? `Chapter ${chapter}`}</td>
                  <td className="py-2 text-right tabular-nums">{formatCount(r.exporter_count)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      )}
    </AppShell>
  );
}
