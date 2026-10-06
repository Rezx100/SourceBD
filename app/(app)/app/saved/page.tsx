// /app/saved: the buyer's saved suppliers on the v4 frame (B6b, Paper `10 · Saved`, `· 3 selected for
// one RFQ`, `11 · Saved`). A table of every saved supplier with its workers, sources, the first
// certificate to check and when it was saved; `?open=<slug>` draws the record in the pane beside a
// narrow list (a drawer under 1280). Ticking suppliers turns the bar into Remove from saved and
// one RFQ to everyone ticked. `?sort=` and `?page=` are the list's.
//
// A failed `buyer_saved_list` is an error where the list was: "No saved suppliers yet" is a claim
// about the account that a failed read cannot make. A certificate cell that could not be read says
// so, and never "nothing to check". Saved searches are `/app/searches`, the second tab.

import { ListPane } from "@/components/frame";
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
  const openSlug = one(sp.open);
  const view = { sort, page, tab: one(sp.tab) };
  const supabase = await createSupabaseServerClient();
  const today = new Date();
  const [data, record] = await Promise.all([loadSaved(supabase, sort, page), openSlug ? readSavedRecord(supabase, openSlug, today, view) : Promise.resolve(null)]);

  const rows = data.rows;
  const items = rows ? buildSavedItems(rows, data.certs, today, view) : [];
  const closeHref = savedHref({ sort, page });
  const paneOpen = openSlug !== null && rows !== null && rows.length > 0;
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
      <>
        <div className="min-h-0 flex-1 overflow-y-auto max-md:hidden">
          <SavedPaneRows items={items} currentSlug={openSlug} />
        </div>
        <div className="md:hidden">
          <SelectionProvider pageIds={items.map((i) => i.id)}>
            <RemoveProvider>
              <SavedPhoneList items={items} />
            </RemoveProvider>
          </SelectionProvider>
        </div>
      </>
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

  const pane = paneOpen && record ? <SavedRecordPane read={record} view={view} today={today} /> : null;
  return <ListPane list={list} listLabel="Saved suppliers" pane={pane} paneTitle={record?.model?.name ?? "Supplier record"} closeHref={closeHref} />;
}
