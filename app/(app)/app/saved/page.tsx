// Saved suppliers (/app/saved). Calls `public.buyer_saved_list(p_sort,
// p_limit, p_offset)` (migration 0026) under the caller's session, enriches
// the worker figures (REZ-114, the same headline figure the profile shows)
// and draws the list with `components/dashboard/saved-list.tsx`.
//
// SBI hard contract: the RPC excludes SBI from its RETURNS whitelist;
// nothing here references `sbi_*`. Contact PII fields are never fetched.

import { SAVED_SORTS, SavedList, type SavedSort } from "@/components/dashboard/saved-list";
import { enrichDiscoverWorkers } from "@/lib/enrich-discover-workers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Page } from "@/components/dashboard/page";

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

async function SavedSuppliersPageBody({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const sort = clampSort(asString(sp.sort));
  const pageNum = Math.max(1, Number.parseInt(asString(sp.page), 10) || 1);
  const offset = (pageNum - 1) * PAGE_SIZE;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("buyer_saved_list", {
    p_sort: sort,
    p_limit: PAGE_SIZE,
    p_offset: offset,
  });

  const rows = await enrichDiscoverWorkers(
    supabase,
    (data ?? []) as SavedRow[],
  );
  const totalCount = Number(rows[0]?.total_count ?? 0);

  return (
    <SavedList
      rows={rows}
      total={totalCount}
      page={pageNum}
      pageSize={PAGE_SIZE}
      sort={sort}
      failed={Boolean(error)}
    />
  );
}

export default async function SavedSuppliersPage(props: Parameters<typeof SavedSuppliersPageBody>[0]) {
  return <Page>{await SavedSuppliersPageBody(props)}</Page>;
}
