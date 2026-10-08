// Spec REZ-B — buyer Discover, on the v4 frame (B4). URL is the state; the list and the pane
// each scroll on their own; everything secondary opens in the pane beside the list and closes
// back to the same search:
//
//   ?record=<slug>            the record (REZ-C §3.3), and `&line=NNNN` one of its lines
//   ?rfq=<id,id,…>            the RFQ composer, for one supplier or the ticked selection
//   ?filters=1                the filter pane
//   ?save=1                   the save-search popover under the bar (a sheet on a phone), over live results
//   ?sent=<rfq id>            the toast after a send, on the search the buyer was on
//
// Two things make "never lose the search" true, and both are load-bearing: the whole search
// state stays in the URL and none of the pane parameters is part of `DiscoverState`, so a
// pane's Close is the same search; and every open and close is a `next/link` client
// navigation with `scroll={false}`, so the bulk selection (React state keyed on the search)
// survives.
//
// Opening a record is fast because it does not wait on the search (founder's walkthrough,
// 28 Sep 2026): the results are the same for every buyer and are read through a two-minute
// shared cache (`lib/dashboard/search-cache.ts`), and the record is read inside its own
// `Suspense` boundary, keyed by what the pane shows, so the pane draws its silhouette
// straight away and the record streams into it. A line reads the record once and only what
// the line draws; the composer reads its suppliers and the workspace inside a boundary of
// its own. Measurements and what is left: `ops/plans/buyer-app-speed-29sep.md`.
//
// No result cards (D-7): the table beside nothing, the narrow list beside a pane, the phone's
// rows. `?view=` and `?d=` are still read so an old link opens; they change nothing.

import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { ListPane } from "@/components/frame";
import { ComposerPane, parseRfqIds } from "@/components/rfqs/composer-pane";
import { LineView, RecordView, parseTab, type TabId } from "@/components/record";
import { FirstResultsCoach } from "@/components/onboarding/coach";
import { RecordLastSearch } from "@/components/saved/last-search";
import { alertsAvailable } from "@/components/saved/load";
import { SaveSearchPanel, saveSummary } from "@/components/saved/save-search";
import { ResultsBar } from "@/components/search/bulk-bar";
import { FilterPane } from "@/components/search/filters";
import { Flash } from "@/components/search/flash";
import { PastEnd, PaneRows, PhoneMore, PhoneRows, ResultsEmpty, ResultsError, ResultsFooter } from "@/components/search/list";
import { resultRow } from "@/components/search/model";
import { MoreMenu } from "@/components/search/more-menu";
import { ComposerSkeleton, LineSkeleton, PaneFrame, PaneNotice, RecordSkeleton } from "@/components/search/pane";
import { RecordRecentSearch } from "@/components/search/record-recent-search";
import { SelectionProvider } from "@/components/search/selection";
import { ResultsTable } from "@/components/search/table";
import { PaneListToolbar, PhoneToolbar, ResultsToolbar, resultsTitle } from "@/components/search/toolbar";
import { buildDiscoverTableRow } from "@/lib/dashboard/build-discover-row";
import { ProfileReadTimeout, loadLineBeside, loadRecordSheet } from "@/lib/dashboard/load-record";
import { readSearch } from "@/lib/dashboard/search-cache";
import { fetchDiscoverExplain, fetchDiscoverV32, fetchHsBatch } from "@/lib/discover-v32-rpc";
import { fetchFacilityParentSlug } from "@/lib/facility-parent-redirect";
import { DISCOVER_PATH, discoverHref, filterCount, parseDiscoverState, queryTitle, serializeDiscoverState, withPaneParams, type DiscoverState } from "@/lib/discover-v32-state";
import { noteActivity } from "@/lib/ledger/note";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Search suppliers · SourceBD",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function BuyerDiscoverPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const state = parseDiscoverState(sp);
  const one = (v: string | string[] | undefined): string | null => (Array.isArray(v) ? v[0] : v)?.trim() || null;
  const recordSlug = one(sp.record);
  const lineCode = /^\d{4}$/.test(one(sp.line) ?? "") ? one(sp.line)! : null;
  const allLines = one(sp.lines) === "all";
  const rfqIds = parseRfqIds(sp.rfq);
  const composerOpen = rfqIds.length > 0;
  const prefillHs = /^\d{4}$/.test(one(sp.hs_line) ?? "") ? one(sp.hs_line)! : null;
  const filtersOpen = !composerOpen && one(sp.filters) === "1";
  const saveOpen = !composerOpen && !filtersOpen && one(sp.save) === "1";
  const sentId = UUID_RE.test(one(sp.sent) ?? "") ? one(sp.sent)! : null;
  // The end of onboarding opens the buyer's first search with `?welcome=1`: one note on where facts come from.
  const welcome = one(sp.welcome) === "1";
  const supabase = await createSupabaseServerClient();
  const today = new Date();

  // Every pane's Close is this same search: `discoverHref` serializes the state and none of
  // the pane parameters is part of it.
  const closeHref = discoverHref(state);
  const withParams = (extra: string) => withPaneParams(closeHref, extra);
  const recordHref = (slug: string) => withParams(`record=${encodeURIComponent(slug)}`);
  // The tab is part of what is open: the composer's Close and a line's Back return to it.
  const tab = parseTab(sp.tab);
  const recordBase = recordSlug ? `record=${encodeURIComponent(recordSlug)}${allLines ? "&lines=all" : ""}` : "";
  const recordParams = recordBase && tab !== "overview" ? `${recordBase}&tab=${tab}` : recordBase;
  const tabHref = (t: TabId) => withParams(t === "overview" ? recordBase : `${recordBase}&tab=${t}`);
  // The composer opens on the search, keeping the record it came from behind it so Close
  // returns to the record and not only to the search.
  const rfqHref = (id: string) => withParams(`${recordParams ? `${recordParams}&` : ""}rfq=${encodeURIComponent(id)}`);
  const lineRfqHref = (id: string, hs: string) => withParams(`${recordParams ? `${recordParams}&` : ""}rfq=${encodeURIComponent(id)}&hs_line=${hs}`);
  // A phone opens the record as a page and comes back to this search.
  const pageHref = (slug: string) => `/app/suppliers/${encodeURIComponent(slug)}?back=${encodeURIComponent(closeHref)}`;

  const { rows, total, error, failure } = await readSearch(state, () => fetchDiscoverV32(supabase, state));
  // The search is written to the activity record as this buyer's (moderation plan 1d); not awaited, never failing the page.
  void noteActivity(supabase, "search.run", { content: { search: serializeDiscoverState(state).toString().slice(0, 2000), total, shown: rows.length } });
  const slugs = rows.map((r) => r.slug);
  // Not awaited here: the rows wait for their HS lines and saved marks, the pane does not. The
  // record's read used to start only after these two answered, one more round trip to the
  // database on every open and every page-size change with a record open (6 Oct 2026).
  const decorated = Promise.all([
    fetchHsBatch(supabase, slugs),
    rows.length > 0
      ? supabase
          .from("saved_suppliers")
          .select("supplier_id")
          .in(
            "supplier_id",
            rows.map((r) => r.id),
          )
          .then((r) => r.data ?? [])
      : Promise.resolve([] as unknown[]),
  ]).then(([hs, savedRows]) => {
    const savedSet = new Set<string>();
    for (const r of savedRows) {
      if (r && typeof r === "object" && typeof (r as { supplier_id?: unknown }).supplier_id === "string") {
        savedSet.add((r as { supplier_id: string }).supplier_id);
      }
    }
    const rowOpts = { today, hsLines: hs.lines, hsError: hs.error, recordHref, rfqHref };
    return rows.map((row) => resultRow(buildDiscoverTableRow(row, { ...rowOpts, saved: savedSet.has(row.id) }), today, pageHref(row.slug)));
  });
  // An empty or failed search never draws the rows; its rejection must not go unhandled. Drawn, it still throws.
  decorated.catch(() => {});

  let explain: { dropped: string; remaining: number }[] = [];
  if (!error && total === 0 && state.page === 1 && filterCount(state) > 0) {
    explain = await fetchDiscoverExplain(supabase, state);
  }

  const pages = total !== null ? Math.max(1, Math.ceil(total / state.per)) : null;

  // A pane docked beside the results narrows them; the filter panel lies over the full-width
  // table instead (B4 fix 4), so the results keep their own bar and columns under it.
  const paneOpen = composerOpen || recordSlug !== null;
  const exportHref = `/api/v1/discover/export?${serializeDiscoverState(state).toString()}`;
  const title = resultsTitle(state.q, error ? null : total);
  const filtersHref = withParams("filters=1");
  const saveHref = withParams("save=1");
  // Every results control (page, page size, sort, a filter) keeps the open record and its tab:
  // the pane works on its own and the list's controls never close it (founder, 6 Oct 2026).
  const openParams = recordParams && lineCode ? `${recordParams}&line=${lineCode}` : recordParams;
  const hrefFor = (s: DiscoverState) => withPaneParams(discoverHref(s), openParams);
  const nextHref = pages && state.page < pages ? hrefFor({ ...state, page: state.page + 1 }) : null;

  // Save this search is a popover under the bar (a sheet on a phone), not a pane: the results stay
  // live beside it. Close keeps the record that was open; a saved search lands on this search.
  const keepOpen = recordParams ? withParams(recordParams) : closeHref;
  const saveAlerts = saveOpen ? await alertsAvailable(supabase) : false;
  const savePanel = saveOpen ? (
    <SaveSearchPanel
      alerts={saveAlerts}
      search={serializeDiscoverState({ ...state, page: 1 }).toString()}
      defaultName={queryTitle(state)}
      summary={saveSummary(queryTitle(state), error ? null : total)}
      closeHref={keepOpen}
      nextHref={`${keepOpen}${keepOpen.includes("?") ? "&" : "?"}saved=1`}
    />
  ) : null;

  const toolbar = paneOpen ? (
    <PaneListToolbar state={state} title={title} hrefFor={hrefFor} filtersHref={filtersOpen ? closeHref : filtersHref} saveHref={saveHref} savePanel={savePanel} more={error || total === 0 ? null : <MoreMenu exportHref={exportHref} total={total} saveHref={saveHref} />} />
  ) : (
    <ResultsToolbar
      state={state}
      title={title}
      hrefFor={hrefFor}
      filtersHref={filtersHref}
      filtersOpen={filtersOpen}
      saveHref={saveHref}
      savePanel={savePanel}
      more={<MoreMenu exportHref={exportHref} total={error ? null : total} saveHref={saveHref} />}
      bare={Boolean(error) || total === 0}
    />
  );

  const list = (
    <SelectionProvider key={serializeDiscoverState(state).toString()} pageIds={error ? null : rows.map((r) => r.id)}>
      <RecordRecentSearch label={queryTitle(state)} href={discoverHref(state)} count={total} />
      {error || filterCount(state) === 0 ? null : <RecordLastSearch search={serializeDiscoverState({ ...state, page: 1 }).toString()} />}
      {welcome && !error && total !== 0 ? <FirstResultsCoach supabase={supabase} closeHref={keepOpen} /> : null}
      <div className="flex min-h-0 flex-1 flex-col">
        <PhoneToolbar state={state} count={resultsTitle("", error ? null : total)} hrefFor={hrefFor} filtersHref={filtersHref} />
        {/* Beside a pane too: ticking turns the pane list's toolbar into the bulk bar, as it does the filter bar. */}
        <ResultsBar toolbar={toolbar} exportHref={exportHref} searchHref={closeHref} pageSize={rows.length} narrow={paneOpen} />
        {error ? (
          <ResultsError failure={failure ?? "unavailable"} retryHref={closeHref} />
        ) : rows.length === 0 && state.page > 1 ? (
          <PastEnd page={state.page} firstHref={hrefFor({ ...state, page: 1 })} />
        ) : total === 0 ? (
          <ResultsEmpty state={state} explain={explain} clearHref={DISCOVER_PATH} saveHref={saveHref} />
        ) : (
          <>
            {/* From md the table, or the narrow list beside a pane; on a phone the rows that open as pages. */}
            <div className="hidden min-h-0 flex-1 overflow-y-auto md:block">
              <Await value={decorated}>
                {(results) =>
                  paneOpen ? (
                    <PaneRows rows={results} currentSlug={recordSlug} />
                  ) : (
                    <div className="px-6">
                    <ResultsTable
                      rows={results}
                      sort={{ key: state.sort, dir: state.sort === "name" || state.sort === "cert_expiry" || state.sort === "established" ? "asc" : "desc" }}
                      sortHrefs={{ workers: hrefFor({ ...state, sort: "workers", page: 1 }), sources: hrefFor({ ...state, sort: "sources", page: 1 }) }}
                    />
                    </div>
                  )
                }
              </Await>
            </div>
            <div className="md:hidden">
              <Await value={decorated}>{(results) => <PhoneRows rows={results} />}</Await>
              <PhoneMore shown={(state.page - 1) * state.per + rows.length} total={total ?? rows.length} nextHref={nextHref} per={state.per} />
            </div>
            <div className="hidden md:block">
              <ResultsFooter state={state} shown={rows.length} total={total ?? rows.length} hrefFor={hrefFor} />
            </div>
          </>
        )}
      </div>
    </SelectionProvider>
  );

  const pane = composerOpen ? (
    // A boundary of its own: the suppliers and the workspace's template are read inside it,
    // so the pane's silhouette paints with the results instead of the whole page waiting.
    <Suspense
      key={`rfq:${rfqIds.join(",")}`}
      fallback={
        <PaneFrame openKey="loading:rfq">
          <ComposerSkeleton />
        </PaneFrame>
      }
    >
      <ComposerPane
        supabase={supabase}
        rfqIds={rfqIds}
        prefillHs={prefillHs}
        closeHref={recordParams ? withParams(recordParams) : closeHref}
        backHref={recordParams ? withParams(recordParams) : null}
      />
    </Suspense>
  ) : filtersOpen ? (
    <PaneFrame openKey="filters">
      <FilterPane state={state} count={error ? null : total} closeHref={closeHref} />
    </PaneFrame>
  ) : recordSlug ? (
    // The pane's silhouette at once, the record streamed into it: a new key per record or
    // line is a new boundary, so the silhouette shows the moment the buyer clicks — the
    // line's own silhouette for a line, not the whole record's.
    <Suspense
      key={`${recordSlug}:${lineCode ?? ""}:${allLines ? "all" : ""}`}
      fallback={
        <PaneFrame openKey={`loading:${recordSlug}`}>
          {lineCode ? <LineSkeleton /> : <RecordSkeleton />}
        </PaneFrame>
      }
    >
      <DiscoverRecord
        supabase={supabase}
        slug={recordSlug}
        supplierId={rows.find((r) => r.slug === recordSlug)?.id ?? null}
        lineCode={lineCode}
        allLines={allLines}
        today={today}
        closeHref={closeHref}
        withParams={withParams}
        recordParams={recordParams}
        tab={tab}
        tabHref={tabHref}
        recordHref={recordHref}
        rfqHref={rfqHref}
        lineRfqHref={lineRfqHref}
      />
    </Suspense>
  ) : null;

  return (
    <>
      <ListPane
        list={list}
        listLabel="Results"
        pane={pane}
        paneTitle={composerOpen ? "New request" : filtersOpen ? "Filters" : "Supplier"}
        closeHref={closeHref}
        presentation={filtersOpen ? "overlay" : "docked"}
      />
      {sentId ? <Flash text="RFQ sent" link={{ href: `/app/rfqs/${sentId}`, label: "Open the RFQ" }} /> : null}
      {one(sp.saved) === "1" ? <Flash text="Search saved" link={{ href: "/app/searches", label: "Saved searches" }} /> : null}
    </>
  );
}

/** Draws `children` once `value` is read: the page returns without waiting on it, so the pane's read starts beside it. */
async function Await<T>({ value, children }: { value: Promise<T>; children: (v: T) => ReactNode }) {
  return children(await value);
}

/**
 * The record (or one of its lines) in its pane beside the results, read on its own so the
 * results never wait for it. What the pane says when there is no record is decided here, and
 * the pane is keyed by what it shows — a notice and the record it becomes are different keys,
 * so focus moves between them.
 */
async function DiscoverRecord({
  supabase,
  slug,
  supplierId,
  lineCode,
  allLines,
  today,
  closeHref,
  withParams,
  recordParams,
  tab,
  tabHref,
  recordHref,
  rfqHref,
  lineRfqHref,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the Supabase server client, as loadRecordSheet takes it.
  supabase: any;
  slug: string;
  /** The record's id when a row of these results carries it. */
  supplierId: string | null;
  lineCode: string | null;
  allLines: boolean;
  today: Date;
  closeHref: string;
  withParams: (extra: string) => string;
  recordParams: string;
  tab: TabId;
  tabHref: (tab: TabId) => string;
  recordHref: (slug: string) => string;
  rfqHref: (id: string) => string;
  lineRfqHref: (id: string, hs: string) => string;
}) {
  const safe = async <T,>(p: Promise<T | null>): Promise<{ value: T | null; slow: boolean }> => {
    try {
      return { value: await p, slow: false };
    } catch (err) {
      return { value: null, slow: err instanceof ProfileReadTimeout };
    }
  };
  let slow: boolean;
  if (lineCode) {
    // The line alone, on one read of the record; a heading the record does not export goes
    // to the record, on this search.
    const read = await safe(loadLineBeside(supabase, slug, lineCode, today, { backHref: withParams(recordParams), closeHref, rfqHref: lineRfqHref, supplierId }));
    if (read.value?.line) {
      void noteActivity(supabase, "supplier.line_viewed", { supplierId, content: { slug, hs: lineCode, via: "pane" } });
      return (
        <PaneFrame openKey={`line:${slug}:${lineCode}`}>
          <LineView model={read.value.line} mode="pane" />
        </PaneFrame>
      );
    }
    if (read.value?.found) redirect(withParams(recordParams));
    slow = read.slow;
  } else {
    const read = await safe(
      loadRecordSheet(supabase, slug, today, {
        // Every section is on the page at once (the tabs scroll to them), so the map's pins are always read.
        pins: true,
        closeHref,
        fullHref: `/app/suppliers/${slug}`,
        allLines,
        allLinesHref: allLines ? null : withParams(`record=${encodeURIComponent(slug)}&tab=products&lines=all`),
        lineHref: (hs) => withParams(`${recordParams}&line=${hs}`),
        rfqHref,
        supplierId,
      }),
    );
    const record = read.value;
    if (record) {
      // A signed-in buyer's record carries the company's contact details, so the open is the reveal.
      void noteActivity(supabase, "supplier.viewed", { supplierId, content: { slug, via: "pane", tab, contact_visible: true } });
      return (
        <PaneFrame openKey={`record:${slug}:${allLines ? "all" : ""}`}>
          <RecordView model={record} mode="pane" tab={tab} tabHref={tabHref} today={today} backHref={withParams(recordParams)} />
        </PaneFrame>
      );
    }
    slow = read.slow;
  }
  const motherSlug = slow ? null : await fetchFacilityParentSlug(supabase, slug).catch(() => null);
  return (
    <PaneFrame openKey={`notice:${slug}`}>
      <RecordNotice slow={slow} motherSlug={motherSlug} closeHref={closeHref} retryHref={withParams(`${recordParams}${lineCode ? `&line=${lineCode}` : ""}`)} recordHref={recordHref} />
    </PaneFrame>
  );
}

/** Why the pane holds no record: too slow, a building rather than a company, or no record for the link. */
function RecordNotice({
  slow,
  motherSlug,
  closeHref,
  retryHref,
  recordHref,
}: {
  slow: boolean;
  motherSlug: string | null;
  closeHref: string;
  retryHref: string;
  recordHref: (slug: string) => string;
}) {
  if (slow) {
    return (
      <PaneNotice
        title="This record could not be read in time"
        body="The database is under load. The company is still on SourceBD — this read simply took too long."
        action={{ label: "Try again", href: retryHref }}
        closeHref={closeHref}
      />
    );
  }
  if (motherSlug) {
    return (
      <PaneNotice
        title="That is a building, not a company record"
        body="SourceBD files this address under the company that operates it. Its record has the certificates, the registers and the export lines."
        action={{ label: "Open the company record", href: recordHref(motherSlug) }}
        closeHref={closeHref}
      />
    );
  }
  return (
    <PaneNotice
      title="No record for that link"
      body="It may have been unpublished, the link may be wrong, or it could not be read just now. Your search is still here behind this."
      closeHref={closeHref}
    />
  );
}

