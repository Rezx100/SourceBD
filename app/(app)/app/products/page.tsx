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
      <div className="flex items-end justify-between gap-4">
        <div>
          <Title as="h1">Products</Title>
          <Caption>
            {live.error
              ? "Exporter counts could not be read"
              : `${formatCount(rows.length)} HS ${rows.length === 1 ? "heading" : "headings"}`}
          </Caption>
        </div>
        <form action="/app/products" method="get" role="search" className="flex h-control w-[20rem] items-center rounded-sm border border-line-strong bg-surface px-2.5">
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
        <table className="w-full table-fixed border-collapse text-sm">
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
      )}
    </AppShell>
  );
}
