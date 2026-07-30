// Admin scraper operations console.

import { AdminPage, AdminPageHeader } from "@/components/admin/admin-ui";
import { AdminScraperMonitor } from "@/components/admin-scraper-monitor";
import { Card, CardContent } from "@/components/ui/card";
import type { DashboardDoc } from "@/lib/admin/etl-monitoring";
import type { EvidenceByScraper, EvidenceSummary } from "@/lib/admin/evidence";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminSourcesPage() {
  const supabase = await createSupabaseServerClient();
  // Evidence health is fetched alongside the dashboard but its failure is not
  // fatal: an operator who cannot see citation counts can still run and
  // schedule scrapers, and blanking the whole console over it would be worse.
  const [dashboard, evidence, byScraper] = await Promise.all([
    supabase.rpc("admin_etl_dashboard"),
    supabase.rpc("admin_evidence_summary"),
    supabase.rpc("admin_evidence_by_scraper"),
  ]);

  if (dashboard.error || dashboard.data == null) {
    return (
      <AdminPage maxWidth="5xl">
        <AdminPageHeader
          kicker="Admin"
          title="Sources & ingestion"
          description="Run and schedule SourceBD scraper jobs from one operator console."
        />
        <Card>
          <CardContent className="text-sm text-sem-red">
            Could not load scraper operations
            {dashboard.error?.message ? <>: {dashboard.error.message}</> : null}.
          </CardContent>
        </Card>
      </AdminPage>
    );
  }

  return (
    <AdminScraperMonitor
      initialDoc={dashboard.data as DashboardDoc}
      evidence={(evidence.data as EvidenceSummary | null) ?? null}
      evidenceByScraper={(byScraper.data as EvidenceByScraper | null) ?? null}
    />
  );
}
