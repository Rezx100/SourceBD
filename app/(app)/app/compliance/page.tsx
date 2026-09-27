// Compliance hub — Spec B9 (/app/compliance).
//
// Server component. Calls the three compliance RPCs in parallel under the
// caller's session and draws one row per surface: the next certificates to
// expire, the UFLPA summary, and what the Modern Slavery Act generator makes.

import Link from "next/link";

import { AppShell } from "@/components/dashboard/app-shell";
import { type ExpiryPayload, ExpiryTable, plural, TableFooter, type UflpaPayload } from "@/components/dashboard/compliance";
import { Badge } from "@/components/dashboard/chips";
import { Button } from "@/components/dashboard/controls";
import { EmptyState, ErrorNote, PageHeader, PageSection } from "@/components/dashboard/page";
import { loadBuyerShell } from "@/lib/dashboard/load-buyer-shell";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type MsaSummary = {
  total_saved: number;
  total_published: number;
  rsc_covered: number;
  expiring_certs_90d: number;
  sanctions_hits: number;
};

/** How many upcoming renewals the hub lists before "View all". */
const HUB_ROWS = 5;

function SectionLink({ href, children }: { href: string; children: string }) {
  return (
    <Link href={href} prefetch={false} className="text-brand-ink hover:underline">
      {children}
    </Link>
  );
}

async function ComplianceHubPageBody() {
  const supabase = await createSupabaseServerClient();
  const [exp, ufl, msa] = await Promise.all([
    supabase.rpc("compliance_expiring_certs", { p_window_days: 90 }),
    supabase.rpc("compliance_uflpa_tracker"),
    supabase.rpc("compliance_msa_inputs"),
  ]);

  const expiry = exp.error ? null : ((exp.data ?? null) as ExpiryPayload | null);
  const uflpa = ufl.error ? null : ((ufl.data ?? null) as UflpaPayload | null);
  const msaIn = msa.error ? null : ((msa.data ?? null) as MsaSummary | null);
  const anyError = Boolean(exp.error || ufl.error || msa.error);

  const savedTotal = msaIn?.total_saved ?? 0;
  const upcoming = (expiry?.rows ?? []).slice(0, HUB_ROWS);

  return (
    <>
      <PageHeader
        title="Compliance hub"
        caption={
          msaIn
            ? `Certificate renewals, UFLPA exposure and your Modern Slavery Act statement, drawn from your ${plural(savedTotal, "saved supplier")}.`
            : "Certificate renewals, UFLPA exposure and your Modern Slavery Act statement, drawn from your saved suppliers."
        }
      />

      {anyError ? <ErrorNote>Could not load one or more compliance views. Reload the page to try again.</ErrorNote> : null}

      {msaIn && savedTotal === 0 ? (
        <section className="rounded-md border border-line-subtle bg-surface">
          <EmptyState
            icon="bookmark"
            title="No saved suppliers yet"
            action={
              <Button variant="primary" href="/app/discover" clientNav>
                Browse Discover
              </Button>
            }
          >
            The compliance hub draws from your saved list. Save suppliers from Discover to begin.
          </EmptyState>
        </section>
      ) : null}

      <PageSection
        title="Certificate expiry"
        caption="Next 90 days, soonest first"
        action={<SectionLink href="/app/compliance/expiry">View all</SectionLink>}
      >
        {expiry === null ? (
          <p className="m-0 px-4 py-3 text-sm text-ink-muted">Expiring certificates did not load.</p>
        ) : upcoming.length === 0 ? (
          <p className="m-0 px-4 py-3 text-sm text-ink-muted">
            No certificates on your saved suppliers expire in the next 90 days.
          </p>
        ) : (
          <>
            <ExpiryTable rows={upcoming} compact />
            <div className="flex flex-wrap items-center justify-between gap-2 pr-4">
              <TableFooter shown={upcoming.length} total={expiry.total} />
              <span className="text-xs text-ink-muted tabular-nums">
                {expiry.bucket_30} within 30 days · {expiry.bucket_60} in 30–60 days · {expiry.bucket_90} in 60–90 days
              </span>
            </div>
          </>
        )}
      </PageSection>

      <PageSection
        title="UFLPA tracker"
        caption="Forced-labour exposure"
        action={<SectionLink href="/app/compliance/uflpa">Open tracker</SectionLink>}
      >
        <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="m-0 text-base text-ink">
            {uflpa === null
              ? "The UFLPA tracker did not load."
              : uflpa.total === 0
                ? "No saved suppliers to check yet."
                : `Of your ${plural(uflpa.total, "saved supplier")}, ${uflpa.hits.toLocaleString()} ${uflpa.hits === 1 ? "matches" : "match"} the U.S. UFLPA Entity List, ${uflpa.flags.toLocaleString()} ${uflpa.flags === 1 ? "has" : "have"} Xinjiang-linked text in the record and ${uflpa.clear.toLocaleString()} ${uflpa.clear === 1 ? "is" : "are"} clear.`}
          </p>
          {uflpa && uflpa.hits > 0 ? (
            <Badge tone="sanction" className="self-start sm:self-auto">
              {plural(uflpa.hits, "Entity List hit")}
            </Badge>
          ) : uflpa && uflpa.flags > 0 ? (
            <Badge tone="caution" className="self-start sm:self-auto">
              {plural(uflpa.flags, "region flag")}
            </Badge>
          ) : null}
        </div>
      </PageSection>

      <PageSection
        title="Modern Slavery Act statement"
        caption="UK Modern Slavery Act 2015, §54"
        action={<SectionLink href="/app/compliance/msa">Open generator</SectionLink>}
      >
        <div className="flex flex-col gap-1 px-4 py-3">
          <p className="m-0 text-base text-ink">
            Drafts your §54 transparency statement from your saved suppliers: organisation and supply chain, policies,
            due diligence, risk assessment, training and effectiveness. It is composed in your browser and nothing is
            uploaded.
          </p>
          {msaIn ? (
            <p className="m-0 text-sm text-ink-muted">
              Built from {plural(msaIn.total_published, "published saved supplier")}, {msaIn.rsc_covered.toLocaleString()}{" "}
              covered by the RSC and {plural(msaIn.expiring_certs_90d, "certificate")} expiring in 90 days.
            </p>
          ) : null}
        </div>
      </PageSection>
    </>
  );
}

// The kit's shell on every buyer page (one sidebar, one topbar), read in the
// same wave as the page's own data.
export default async function ComplianceHubPage() {
  const supabase = await createSupabaseServerClient();
  const [shell, body] = await Promise.all([loadBuyerShell(supabase, "/app/compliance"), ComplianceHubPageBody()]);
  return (
    <AppShell sidebar={shell.sidebar} topbar={shell.topbar} mainId="main-content" screenLabel="Compliance hub">
      {body}
    </AppShell>
  );
}
