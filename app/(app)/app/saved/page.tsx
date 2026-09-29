// Saved (/app/saved): the buyer's desk. Certificate alerts and recent
// activity on the suppliers they saved (from `public.buyer_dashboard()`,
// migration 0026 — what the Home page showed until the search became the
// app's first viewport, 28 Sep 2026), then the saved list itself from
// `public.buyer_saved_list(p_sort, p_limit, p_offset)`, with the same two
// worker figures the search shows (REZ-114's headline figure and the record's
// own), drawn by `components/dashboard/saved-list.tsx`.
//
//   ?open=<slug>   the record in the pane beside the list (the one-viewport
//                  frame, as on the search); Close returns to the same sort
//                  and page, and the open row is marked. The record streams
//                  into its pane, so the list never waits on it.
//
// SBI hard contract: neither RPC returns SBI; nothing here references
// `sbi_*`. Contact PII fields are never fetched.

import { Suspense } from "react";
import { SAVED_SORTS, SavedList, savedHref, type SavedSort } from "@/components/dashboard/saved-list";
import { SavedDesk, deskFrom } from "@/components/dashboard/saved-desk";
import { RecordBeside, readRecordBeside } from "@/components/dashboard/record-beside";
import { RecordSkeleton } from "@/components/dashboard/record-skeleton";
import { RecordPane, ResultsColumn, Workbench } from "@/components/dashboard/sheet";
import { enrichDiscoverWorkers } from "@/lib/enrich-discover-workers";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 24;

type SavedRow = {
  id: string;
  slug: string;
  company_name: string;
  entity_type: string;
  city: string | null;
  district: string | null;
  source_tags: string[];
  t13_source_count: number;
  completeness_pct: number;
  employees_total: number | null;
  established_date: string | null;
  principal_products: string[];
  factory_types: string[];
  rsc_progress_pct: number | null;
  parent_group_name: string | null;
  saved_at: string;
  total_count: number;
};

type SearchParams = Record<string, string | string[] | undefined>;

function asString(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v[0] ?? "";
  return v ?? "";
}

function clampSort(v: string): SavedSort {
  const found = SAVED_SORTS.find((o) => o.value === v);
  return found ? found.value : "recent";
}

export default async function SavedSuppliersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const sort = clampSort(asString(sp.sort));
  const pageNum = Math.max(1, Number.parseInt(asString(sp.page), 10) || 1);
  const offset = (pageNum - 1) * PAGE_SIZE;
  const openSlug = asString(sp.open).trim() || null;
  const listHref = savedHref(sort, pageNum);

  const supabase = await createSupabaseServerClient();
  const [{ data, error }, dash] = await Promise.all([
    supabase.rpc("buyer_saved_list", {
      p_sort: sort,
      p_limit: PAGE_SIZE,
      p_offset: offset,
    }),
    supabase.rpc("buyer_dashboard").then(
      (r) => (r.error ? null : deskFrom(r.data)),
      () => null,
    ),
  ]);

  const rows = await enrichDiscoverWorkers(
    supabase,
    (data ?? []) as SavedRow[],
  );
  const totalCount = Number(rows[0]?.total_count ?? 0);

  return (
    // The workbench frame: the list scrolls on its own and the record sits
    // beside it from `lg`; below that the record takes the region and the
    // list waits in the URL for Close.
    <Workbench>
      <ResultsColumn besideRecord={openSlug !== null}>
        <SavedList
          rows={rows}
          total={totalCount}
          page={pageNum}
          pageSize={PAGE_SIZE}
          sort={sort}
          failed={Boolean(error)}
          openSlug={openSlug}
          desk={<SavedDesk doc={dash} failed={dash === null} openHref={(slug) => savedHref(sort, pageNum, slug)} />}
        />
      </ResultsColumn>
      {openSlug ? (
        <Suspense
          key={openSlug}
          fallback={
            <RecordPane closeHref={listHref} openKey={`loading:${openSlug}`}>
              <RecordSkeleton />
            </RecordPane>
          }
        >
          <SavedRecord
            supabase={supabase}
            slug={openSlug}
            supplierId={rows.find((r) => r.slug === openSlug)?.id ?? null}
            closeHref={listHref}
            retryHref={savedHref(sort, pageNum, openSlug)}
          />
        </Suspense>
      ) : null}
    </Workbench>
  );
}

async function SavedRecord({
  supabase,
  slug,
  supplierId,
  closeHref,
  retryHref,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the Supabase server client, as loadRecordSheet takes it.
  supabase: any;
  slug: string;
  supplierId: string | null;
  closeHref: string;
  retryHref: string;
}) {
  const read = await readRecordBeside(supabase, slug, closeHref, new Date(), supplierId);
  return <RecordBeside read={read} closeHref={closeHref} retryHref={retryHref} />;
}
