// /app/headings — the HS catalogue (REZ-B), moved from /app/products on 27 Sep
// 2026 when the buyer's own product base took that address. Live exporter
// counts from hs_catalogue(); the photo files come from the generated
// catalogue. Each heading opens the search filtered to it.

import Link from "next/link";
import { Cell, DataTable, ErrorNote, EmptyState, HeadCell, Page, PageHeader, PageSection, rowClass } from "@/components/dashboard/page";
import { PhotoThumbs } from "@/components/dashboard/photo-tiles";
import { hsCatalogueRow, hsPhotoSrc, heading4, hsShortLabel } from "@/lib/dashboard/hs-photos";
import { fetchHsCatalogue } from "@/lib/discover-v32-rpc";
import { hsBuyerLabel } from "@/lib/epb-hscode-labels";
import { formatCount } from "@/lib/dashboard/facts";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "HS headings · SourceBD",
};

const CHAPTER: Record<string, string> = {
  "42": "Leather goods",
  "60": "Knitted fabrics",
  "61": "Knit apparel",
  "62": "Woven apparel",
  "63": "Made-up textiles",
  "65": "Headgear",
};

/**
 * The words after the code. `hsBuyerLabel` falls back to "HS 6302" when it
 * has neither a buyer label nor a usable description, and printed after the
 * code that read "6302 HS 6302". So: the buyer label, else the catalogue's own
 * heading, else nothing — the code alone.
 */
function headingLabel(hs: string, live: string | null): string | null {
  const label = hsBuyerLabel(hs, live);
  if (label !== `HS ${hs}`) return label;
  return hsCatalogueRow(hs)?.heading ?? null;
}

export default async function HeadingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const qRaw = sp.q;
  const q = (Array.isArray(qRaw) ? qRaw[0] : qRaw)?.trim().toLowerCase() ?? "";
  const supabase = await createSupabaseServerClient();
  const live = await fetchHsCatalogue(supabase);

  const rows = (live.error ? [] : live.rows)
    .map((r) => ({ ...r, hs: heading4(r.hs), label: headingLabel(heading4(r.hs), r.heading) }))
    .filter((r) => !q || r.hs.includes(q) || (r.label ?? "").toLowerCase().includes(q));

  return (
    <Page>
      <PageHeader
        title="HS headings"
        caption={
          live.error
            ? "Exporter counts could not be read"
            : `${formatCount(rows.length)} HS ${rows.length === 1 ? "heading" : "headings"} · exporter counts leave out sanctioned suppliers, as the search does`
        }
        actions={
          // Named, because the topbar renders a `search` landmark on this same
          // page and two unnamed ones are indistinguishable to a screen reader
          // (WCAG 1.3.1). `min-w-0` so it never pushes a phone sideways.
          <form aria-label="Search HS headings" action="/app/headings" method="get" role="search" className="flex h-control w-full min-w-0 items-center rounded-sm border border-line-strong bg-surface px-2.5 sm:w-[20rem]">
            <input type="search" name="q" defaultValue={q} placeholder="Search headings" aria-label="Search headings" className="w-full bg-transparent text-sm" />
          </form>
        }
      />
      {live.error ? (
        <ErrorNote>The catalogue could not be read. Try again in a moment.</ErrorNote>
      ) : rows.length === 0 ? (
        <div className="rounded-md bg-surface">
          <EmptyState icon="search" title="No heading matches that search">
            Search by code (6109) or by name (T-shirts).
          </EmptyState>
        </div>
      ) : (
        <PageSection>
          <DataTable label="HS headings" minWidth="34rem">
            <thead>
              <tr>
                <HeadCell className="w-16">Photo</HeadCell>
                <HeadCell>Heading</HeadCell>
                <HeadCell className="w-40">Chapter</HeadCell>
                <HeadCell align="right" className="w-28">
                  Exporters
                </HeadCell>
              </tr>
            </thead>
            <tbody className="[&>tr:last-child>*]:border-b-0">
              {rows.map((r) => {
                const chapter = r.hs.slice(0, 2);
                return (
                  <tr key={r.hs} className={rowClass()}>
                    <Cell className="py-2">
                      <PhotoThumbs
                        tiles={[{ hs: r.hs, short: hsShortLabel(r.hs, r.heading), src: hsPhotoSrc(r.hs, 512), thumb: hsPhotoSrc(r.hs, 128) }]}
                        totalLines={1}
                      />
                    </Cell>
                    <Cell className="py-2">
                      <Link href={`/app/discover?hs=${r.hs}`} prefetch={false} className="font-medium text-ink-strong [overflow-wrap:anywhere] hover:underline">
                        <span className="font-mono">{r.hs}</span>
                        {r.label ? ` ${r.label}` : null}
                      </Link>
                    </Cell>
                    <Cell className="text-ink-muted">{CHAPTER[chapter] ?? `Chapter ${chapter}`}</Cell>
                    <Cell align="right">{formatCount(r.exporter_count)}</Cell>
                  </tr>
                );
              })}
            </tbody>
          </DataTable>
        </PageSection>
      )}
    </Page>
  );
}
