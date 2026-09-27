// Certificate expiry — Spec B9 (/app/compliance/expiry).
//
// Server component. Calls compliance_expiring_certs(90) and lists every
// certificate on the buyer's saved suppliers that expires in the window,
// soonest first (the RPC's order).

import { BackToHub, type ExpiryPayload, ExpiryStats, ExpiryTable, TableFooter } from "@/components/dashboard/compliance";
import { EmptyState, ErrorNote, PageHeader, PageSection, Page } from "@/components/dashboard/page";
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
        {payload && payload.total > 0 ? <ExpiryStats payload={payload} /> : null}
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

export default async function ExpiryPage() {
  return <Page>{await ExpiryPageBody()}</Page>;
}
