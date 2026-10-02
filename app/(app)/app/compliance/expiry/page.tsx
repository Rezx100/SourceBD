// Certificate expiry — Spec B9 (/app/compliance/expiry).
//
// Server component. Calls compliance_expired_certs() and
// compliance_expiring_certs(90) and lists, first, every certificate on the
// buyer's saved suppliers that has expired with no renewal on file (most
// recently lapsed first), then every one that expires in the window, soonest
// first (each RPC's order).

import {
  BackToHub,
  type ExpiredPayload,
  type ExpiryPayload,
  ExpiryStats,
  ExpiryTable,
  TableFooter,
} from "@/components/dashboard/compliance";
import { EmptyState, ErrorNote, PageHeader, PageSection, Page } from "@/components/dashboard/page";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function ExpiryPageBody() {
  const supabase = await createSupabaseServerClient();
  const [exp, gone] = await Promise.all([
    supabase.rpc("compliance_expiring_certs", { p_window_days: 90 }),
    supabase.rpc("compliance_expired_certs"),
  ]);
  const payload = exp.error ? null : ((exp.data ?? null) as ExpiryPayload | null);
  const expired = gone.error ? null : ((gone.data ?? null) as ExpiredPayload | null);
  const rows = payload?.rows ?? [];
  const lapsed = expired?.rows ?? [];

  return (
    <>
      <PageHeader
        title="Certificate expiry"
        caption="Certificates on your saved suppliers that have expired with no renewal on file, then the renewal dates over the next 90 days, soonest first, so your team can follow up before a certificate lapses."
        actions={<BackToHub />}
      >
        {payload && (payload.total > 0 || lapsed.length > 0) ? <ExpiryStats payload={payload} expired={expired?.total ?? null} /> : null}
      </PageHeader>

      {gone.error ? <ErrorNote>Could not load expired certificates. Reload the page to try again.</ErrorNote> : null}
      {exp.error ? <ErrorNote>Could not load expiring certificates. Reload the page to try again.</ErrorNote> : null}

      {lapsed.length > 0 && expired ? (
        <PageSection title="Expired" caption="No renewal on file, most recent first">
          <ExpiryTable rows={lapsed} lapsed />
          <TableFooter shown={lapsed.length} total={expired.total} />
        </PageSection>
      ) : null}

      {payload ? (
        <PageSection title={lapsed.length > 0 ? "Next 90 days" : undefined}>
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
