// Admin scraper operations console.

import { AdminColumn, AdminHead } from "@/components/admin/data-ui";
import { AdminScraperMonitor } from "@/components/admin-scraper-monitor";
import { InlineError } from "@/components/kit";
import type { DashboardDoc } from "@/lib/admin/etl-monitoring";
import type { EvidenceByScraper, EvidenceSummary } from "@/lib/admin/evidence";
import type { FreshnessDoc } from "@/lib/admin/source-freshness";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminSourcesPage() {
  const supabase = await createSupabaseServerClient();
  // Evidence health is fetched alongside the dashboard but its failure is not
  // fatal: an operator who cannot see citation counts can still run and
  // schedule scrapers, and blanking the whole console over it would be worse.
  const [dashboard, evidence, byScraper, freshness, nearMatches] = await Promise.all([
    supabase.rpc("admin_etl_dashboard"),
    supabase.rpc("admin_evidence_summary"),
    supabase.rpc("admin_evidence_by_scraper"),
    // S3 (0123); like evidence, a failed read is not fatal.
    supabase.rpc("admin_source_freshness"),
    // The open near-match records, for "Needs you": the review queue's own read, one row.
    supabase.rpc("admin_queue_list", { p_type: "fuzzy_match_review", p_status: "open", p_limit: 1, p_offset: 0 }),
  ]);

  if (dashboard.error || dashboard.data == null) {
    return (
      <AdminColumn>
        <AdminHead
          title="Sources & ingestion"
          lede="Run and schedule SourceBD scraper jobs from one operator console."
        />
        <InlineError>
          Could not load scraper operations
          {dashboard.error?.message ? <>: {dashboard.error.message}</> : null}.
        </InlineError>
      </AdminColumn>
    );
  }

  const queueTotal = (nearMatches.data as { total?: unknown } | null)?.total;
  return (
    <AdminScraperMonitor
      initialDoc={dashboard.data as DashboardDoc}
      evidence={(evidence.data as EvidenceSummary | null) ?? null}
      evidenceByScraper={(byScraper.data as EvidenceByScraper | null) ?? null}
      freshness={freshness.error ? null : ((freshness.data as FreshnessDoc | null) ?? null)}
      nearMatches={!nearMatches.error && typeof queueTotal === "number" ? queueTotal : null}
    />
  );
}
