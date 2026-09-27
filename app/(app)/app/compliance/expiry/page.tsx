// Certificate expiry — Spec B9 (/app/compliance/expiry).
//
// Server component. Calls compliance_expiring_certs(90) and lists every
// certificate on the buyer's saved suppliers that expires in the window,
// soonest first (the RPC's order).

import { AppShell } from "@/components/dashboard/app-shell";
import { BackToHub, type ExpiryPayload, ExpiryTable, TableFooter } from "@/components/dashboard/compliance";
import { EmptyState, ErrorNote, PageHeader, PageSection } from "@/components/dashboard/page";
import { loadBuyerShell } from "@/lib/dashboard/load-buyer-shell";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function ExpiryPageBody() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("compliance_expiring_certs", {
    p_window_days: 90,
  });
  const payload = error ? null : ((data ?? null) as ExpiryPayload | null);
  const rows = payload?.rows ?? [];

  return (
    <>
      <PageHeader
        title="Certificate expiry"
        caption="Renewal dates for your saved suppliers over the next 90 days, soonest first, so your team can follow up before a certificate lapses."
        actions={<BackToHub />}
      >
        {payload && payload.total > 0 ? (
          <p className="m-0 text-sm text-ink-muted tabular-nums">
            {payload.bucket_30} within 30 days · {payload.bucket_60} in 30–60 days · {payload.bucket_90} in 60–90 days
          </p>
        ) : null}
      </PageHeader>

      {error ? <ErrorNote>Could not load expiring certificates. Reload the page to try again.</ErrorNote> : null}

      {payload ? (
        <PageSection>
          {rows.length === 0 ? (
            <EmptyState icon="clock" title="Nothing expires in the next 90 days">
              When a certificate on one of your saved suppliers comes within 90 days of its expiry date, it is listed
              here, soonest first.
            </EmptyState>
          ) : (
            <>
              <ExpiryTable rows={rows} />
              <TableFooter shown={rows.length} total={payload.total} />
            </>
          )}
        </PageSection>
      ) : null}
    </>
  );
}

// The kit's shell on every buyer page (one sidebar, one topbar), read in the
// same wave as the page's own data.
export default async function ExpiryPage() {
  const supabase = await createSupabaseServerClient();
  const [shell, body] = await Promise.all([loadBuyerShell(supabase, "/app/compliance/expiry"), ExpiryPageBody()]);
  return (
    <AppShell sidebar={shell.sidebar} topbar={shell.topbar} mainId="main-content" screenLabel="Certificate expiry">
      {body}
    </AppShell>
  );
}
