// /app/saved: the buyer's saved suppliers on the v4 frame (B6b, Paper `10 · Saved`, `· 3 selected for
// one RFQ`, `11 · Saved`). A table of every saved supplier with its workers, sources, the first
// certificate to check and when it was saved; `?open=<slug>` draws the record in the pane beside a
// narrow list (a drawer under 1280); `?rfq=<id,...>` draws the RFQ composer there instead, for one
// supplier or everyone ticked, so the buyer never leaves the list. Ticking suppliers turns the bar
// into Remove from saved and one RFQ to everyone ticked. `?sort=` and `?page=` are the list's.
//
// A failed `buyer_saved_list` is an error where the list was: "No saved suppliers yet" is a claim
// about the account that a failed read cannot make. A certificate cell that could not be read says
// so, and never "nothing to check". Saved searches are `/app/searches`, the second tab.

import { Suspense } from "react";
import { ListPane } from "@/components/frame";
import { ComposerPane, parseRfqIds } from "@/components/rfqs/composer-pane";
import { ComposerSkeleton, PaneFrame } from "@/components/search/pane";
import { SelectionProvider } from "@/components/search/selection";
import { RemoveProvider } from "@/components/saved/actions";
import { SavedEmpty, SavedError, SavedFooter, SavedHead, SavedPaneRows, SavedPastEnd, PhoneTabs } from "@/components/saved/list";
import { loadSaved } from "@/components/saved/load";
import { SavedPhoneList } from "@/components/saved/phone";
import { SavedRecordPane, readSavedRecord } from "@/components/saved/record";
import { SavedBar, SavedTable } from "@/components/saved/table";
import { buildSavedItems, parsePage, parseSort, savedHref } from "@/components/saved/words";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata = { title: "Saved · SourceBD" };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || null;

export default async function SavedPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const sort = parseSort(sp.sort);
  const page = parsePage(sp.page);
  const rfqIds = parseRfqIds(sp.rfq);
  const composerOpen = rfqIds.length > 0;
  const openSlug = composerOpen ? null : one(sp.open);
  const view = { sort, page, tab: one(sp.tab) };
  const supabase = await createSupabaseServerClient();
  const today = new Date();
  const [data, record] = await Promise.all([loadSaved(supabase, sort, page), openSlug ? readSavedRecord(supabase, openSlug, today, view) : Promise.resolve(null)]);

  const rows = data.rows;
  const items = rows ? buildSavedItems(rows, data.certs, today, view) : [];
  const closeHref = savedHref({ sort, page });
  const behindSlug = composerOpen ? one(sp.open) : null;
  const behind = behindSlug ? savedHref({ sort, page, open: behindSlug }) : null;
  // A pane (the composer, or a record with rows to stand beside) always gets the narrow list, never the full table.
  const paneOpen = composerOpen || (openSlug !== null && rows !== null && rows.length > 0);
  const total = data.total ?? items.length;

  const body =
    rows === null ? (
      <SavedError retryHref={closeHref} />
    ) : items.length === 0 ? (
      page > 1 ? (
        <SavedPastEnd firstHref={savedHref({ sort, page: 1 })} />
      ) : (
        <SavedEmpty />
      )
    ) : paneOpen ? (
      // The list beside a pane keeps the table's tick and bulk bar (critique of 8 Oct 2026, round 3, item 2).
      <SelectionProvider key={`${sort}:${page}`} pageIds={items.map((i) => i.id)}>
        <RemoveProvider>
          <div className="max-md:hidden [&>*:not(.sr-only)]:mx-3 [&>*:not(.sr-only)]:mt-3">
            <SavedBar items={items} />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto max-md:hidden">
            <SavedPaneRows items={items} currentSlug={openSlug} />
          </div>
          <div className="md:hidden">
            <SavedPhoneList items={items} />
          </div>
        </RemoveProvider>
      </SelectionProvider>
    ) : (
      <SelectionProvider key={`${sort}:${page}`} pageIds={items.map((i) => i.id)}>
        <RemoveProvider>
          <div className="flex flex-col gap-3 px-6 pt-4 max-md:hidden">
            <SavedBar items={items} />
            <SavedTable items={items} currentSlug={openSlug} />
          </div>
          <SavedPhoneList items={items} />
          <SavedFooter view={view} shown={items.length} total={total} />
        </RemoveProvider>
      </SelectionProvider>
    );

  const list = (
    <div className="flex min-h-0 flex-1 flex-col">
      <SavedHead tab="suppliers" suppliers={rows === null ? null : total} searches={data.searches} view={view} />
      <PhoneTabs tab="suppliers" suppliers={rows === null ? null : total} searches={data.searches} />
      {body}
    </div>
  );

  const pane = composerOpen ? (
    <Suspense
      key={`rfq:${rfqIds.join(",")}`}
      fallback={
        <PaneFrame openKey="loading:rfq">
          <ComposerSkeleton />
        </PaneFrame>
      }
    >
      {/* Sent from a record (`&open=`, the full page's Send RFQ): Close and Back return to it. */}
      <ComposerPane supabase={supabase} rfqIds={rfqIds} closeHref={behind ?? closeHref} backHref={behind} />
    </Suspense>
  ) : paneOpen && record ? (
    <SavedRecordPane read={record} view={view} today={today} />
  ) : null;
  return <ListPane list={list} listLabel="Saved suppliers" pane={pane} paneTitle={composerOpen ? "New request" : (record?.model?.name ?? "Supplier record")} closeHref={closeHref} />;
}
