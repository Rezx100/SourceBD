// UFLPA tracker — Spec B9 (/app/compliance/uflpa).
//
// Server component. Calls compliance_uflpa_tracker() and lists one row per
// saved supplier with its status (hit / region flag / clear) and any matched
// DHS UFLPA Entity List references, hits first (the RPC's order).

import { BackToHub, plural, TableFooter, type UflpaPayload, UflpaTable } from "@/components/dashboard/compliance";
import { Button } from "@/components/dashboard/controls";
import { EmptyState, ErrorNote, PageHeader, PageSection, Page } from "@/components/dashboard/page";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function UflpaPageBody() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("compliance_uflpa_tracker");
  const payload = error ? null : ((data ?? null) as UflpaPayload | null);

  return (
    <>
      <PageHeader
        title="UFLPA tracker"
        caption="Checks your saved suppliers against the U.S. Department of Homeland Security's UFLPA Entity List. A supplier is a hit when it has an active match on the list, a region flag when its record mentions Xinjiang, XUAR or Uyghur, and clear otherwise."
        actions={<BackToHub />}
      >
        {payload && payload.total > 0 ? (
          <p className="m-0 text-sm text-ink-muted tabular-nums">
            {plural(payload.hits, "hit")} · {plural(payload.flags, "region flag")} · {payload.clear.toLocaleString()} clear
          </p>
        ) : null}
      </PageHeader>

      {error ? <ErrorNote>Could not load the UFLPA tracker. Reload the page to try again.</ErrorNote> : null}

      {payload ? (
        <PageSection>
          {payload.rows.length === 0 ? (
            <EmptyState
              icon="shield"
              title="No saved suppliers yet"
              action={
                <Button variant="primary" href="/app/discover" clientNav>
                  Browse Discover
                </Button>
              }
            >
              Every supplier you save is checked against the UFLPA Entity List and listed here.
            </EmptyState>
          ) : (
            <>
              <UflpaTable rows={payload.rows} />
              <TableFooter shown={payload.rows.length} total={payload.total} />
            </>
          )}
        </PageSection>
      ) : null}
    </>
  );
}

export default async function UflpaPage() {
  return <Page>{await UflpaPageBody()}</Page>;
}
