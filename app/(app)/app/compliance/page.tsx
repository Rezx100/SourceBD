// Compliance hub — Spec B9 (/app/compliance).
//
// Server component. Calls the four compliance RPCs in parallel under the
// caller's session and draws one section per surface: certificate expiry (the
// expired ones with no renewal on file first, then the next to expire, with
// the expired count and the 30/60/90-day buckets as stats under the title),
// the UFLPA summary, and what the Modern Slavery Act generator makes. Sections
// are tonal panels on the canvas — no box inside a box.

import Link from "next/link";

import { type ExpiredPayload, type ExpiryPayload, ExpiryStats, ExpiryTable, plural, TableFooter, type UflpaPayload } from "@/components/dashboard/compliance";
import { Badge } from "@/components/dashboard/chips";
import { Button } from "@/components/dashboard/controls";
import { EmptyState, ErrorNote, PageHeader, PageSection, Page } from "@/components/dashboard/page";
import { formatCount } from "@/lib/dashboard/facts";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type MsaSummary = {
  total_saved: number;
  total_published: number;
  rsc_covered: number;
  expiring_certs_90d: number;
  sanctions_hits: number;
};

/** How many expired certificates, and how many upcoming renewals, the hub lists before "View all". */
const HUB_ROWS = 5;

function SectionLink({ href, children }: { href: string; children: string }) {
  return (
    <Link href={href} prefetch={false} className="link">
      {children}
    </Link>
  );
}

async function ComplianceHubPageBody() {
  const supabase = await createSupabaseServerClient();
  const [exp, gone, ufl, msa] = await Promise.all([
    supabase.rpc("compliance_expiring_certs", { p_window_days: 90 }),
    supabase.rpc("compliance_expired_certs"),
    supabase.rpc("compliance_uflpa_tracker"),
    supabase.rpc("compliance_msa_inputs"),
  ]);

  const expiry = exp.error ? null : ((exp.data ?? null) as ExpiryPayload | null);
  // Null when it did not load: the section then says so, never "0 expired".
  const expired = gone.error ? null : ((gone.data ?? null) as ExpiredPayload | null);
  const uflpa = ufl.error ? null : ((ufl.data ?? null) as UflpaPayload | null);
  const msaIn = msa.error ? null : ((msa.data ?? null) as MsaSummary | null);
  const anyError = Boolean(exp.error || gone.error || ufl.error || msa.error);

  const savedTotal = msaIn?.total_saved ?? 0;
  const upcoming = (expiry?.rows ?? []).slice(0, HUB_ROWS);
  const lapsed = (expired?.rows ?? []).slice(0, HUB_ROWS);

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
        <div className="rounded-md bg-surface">
          <EmptyState
            art="certificate"
            compact
            title="No saved suppliers yet"
            action={
              <Button variant="primary" href="/app/discover" clientNav>
                Search suppliers
              </Button>
            }
          >
            The compliance hub draws from your saved list. Save suppliers from search to begin.
          </EmptyState>
        </div>
      ) : null}

      <PageSection
        title="Certificate expiry"
        caption="Expired with no renewal on file, then the next 90 days"
        action={<SectionLink href="/app/compliance/expiry">View all</SectionLink>}
        bare
      >
        {/* The expired list stands on its own read: a failed upcoming list
            must not hide a lapsed certificate, and the reverse. */}
        {expiry ? <ExpiryStats payload={expiry} expired={expired?.total ?? null} /> : null}
        {expired === null ? (
          <p className="m-0 rounded-md bg-surface px-4 py-3 text-sm text-ink-muted">Expired certificates did not load.</p>
        ) : lapsed.length > 0 ? (
          <div className="rounded-md bg-surface">
            <ExpiryTable rows={lapsed} compact lapsed />
            <TableFooter shown={lapsed.length} total={expired.total} />
          </div>
        ) : null}
        {expiry === null ? (
          <p className="m-0 rounded-md bg-surface px-4 py-3 text-sm text-ink-muted">Expiring certificates did not load.</p>
        ) : (
          <div className="rounded-md bg-surface">
            {upcoming.length === 0 ? (
              <p className="m-0 px-4 py-3 text-sm text-ink-muted">
                No certificates on your saved suppliers expire in the next 90 days.
              </p>
            ) : (
              <>
                <ExpiryTable rows={upcoming} compact />
                <TableFooter shown={upcoming.length} total={expiry.total} />
              </>
            )}
          </div>
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
                ? "None of your saved suppliers is published yet, so there is nothing to check."
                : // The tracker reads published suppliers only, so this can be
                  // fewer than the saved count in the caption.
                  `Of your ${plural(uflpa.total, "saved supplier")} that ${uflpa.total === 1 ? "is" : "are"} published, ${formatCount(uflpa.hits)} ${uflpa.hits === 1 ? "matches" : "match"} the U.S. UFLPA Entity List, ${formatCount(uflpa.flags)} ${uflpa.flags === 1 ? "has" : "have"} Xinjiang-linked text in the record and ${formatCount(uflpa.clear)} ${uflpa.clear === 1 ? "is" : "are"} clear.`}
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
              Built from {plural(msaIn.total_published, "published saved supplier")}, {formatCount(msaIn.rsc_covered)}{" "}
              covered by the RSC and {plural(msaIn.expiring_certs_90d, "certificate")} expiring in 90 days.
            </p>
          ) : null}
        </div>
      </PageSection>
    </>
  );
}

export default async function ComplianceHubPage() {
  return <Page>{await ComplianceHubPageBody()}</Page>;
}
