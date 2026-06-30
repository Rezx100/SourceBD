// Admin scraper operations console.

import { AdminPage, AdminPageHeader } from "@/components/admin/admin-ui";
import { AdminScraperMonitor } from "@/components/admin-scraper-monitor";
import { Card, CardContent } from "@/components/ui/card";
import type { DashboardDoc } from "@/lib/admin/etl-monitoring";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminSourcesPage() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("admin_etl_dashboard");

  if (error || data == null) {
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
            {error?.message ? <>: {error.message}</> : null}.
          </CardContent>
        </Card>
      </AdminPage>
    );
  }

  return <AdminScraperMonitor initialDoc={data as DashboardDoc} />;
}
