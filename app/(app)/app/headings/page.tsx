// /app/headings on the v4 frame (B7a-3, Paper `10 · HS codes by chapter`, `11 · HS codes by chapter`): the
// HS catalogue, moved here from /app/products on 27 Sep 2026 when the buyer's own product base took that
// address. Live exporter counts from `hs_catalogue()`. From 768 a grid of chapters with the open one's
// headings in a table under it (`?chapter=`, `?sort=code|suppliers`, `?more=1` for every other chapter);
// on a phone each chapter opens in place. A search (`?q=`) lists the matching headings across chapters.
// Each heading opens the search filtered to it.
//
// A failed read is an error, never "No HS codes". Paper's "from the export records of 2,456 suppliers ·
// checked 14 Aug 2026" is not here: the read carries neither figure. The old photo column is gone
// (Paper has none).

import { CatalogueError, ChapterGrid, HeadingsHead, NoCatalogue, NoMatch, OpenChapter, PhoneChapters, SearchResults } from "@/components/headings/view";
import { loadHeadings } from "@/components/headings/load";
import { SANCTION_NOTE, buildChapters, caption, headingsHref, openChapter, parseSort, searchCaption, splitChapters } from "@/components/headings/words";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata = { title: "HS codes · SourceBD" };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function HeadingsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const q = one(sp.q).trim();
  const sort = parseSort(sp.sort);
  const more = one(sp.more) === "1";
  const headings = await loadHeadings(await createSupabaseServerClient());

  if (headings === null) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <HeadingsHead caption="Exporter counts could not be read" q={q} />
        <CatalogueError retryHref={headingsHref({ sort, more })} />
      </div>
    );
  }

  const chapters = buildChapters(headings);
  const needle = q.toLowerCase();
  const matches = needle ? headings.filter((h) => h.hs.includes(needle) || (h.label ?? "").toLowerCase().includes(needle)) : [];
  const { primary, more: rest } = splitChapters(chapters);
  const open = openChapter(chapters, sp.chapter);
  const current = chapters.find((c) => c.code === open) ?? null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <HeadingsHead caption={needle ? searchCaption(matches.length) : headings.length === 0 ? `No HS headings · ${SANCTION_NOTE}` : caption({ headings: headings.length, chapters: chapters.length })} q={q} />
      {needle ? (
        matches.length === 0 ? (
          <NoMatch q={q} />
        ) : (
          <SearchResults rows={matches} sort={sort} />
        )
      ) : chapters.length === 0 ? (
        <NoCatalogue />
      ) : (
        <>
          <ChapterGrid primary={primary} more={rest} showMore={more} open={open} sort={sort} />
          {current ? <OpenChapter chapter={current} sort={sort} more={more} /> : null}
          <PhoneChapters chapters={[...primary, ...rest]} open={open} sort={sort} />
        </>
      )}
    </div>
  );
}
