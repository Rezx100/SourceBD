// Compliance Hub landing — Spec B9 (/app/compliance), FE-SITEWIDE Phase C7.
//
// Server component. Calls all three compliance RPCs in parallel under the
// caller's session and renders three navigation tiles (expiry / UFLPA /
// MSA) using `.proto-card.hoverable` with live counts from each RPC's
// summary fields.

import Link from "next/link";
import {
  ArrowRight,
  Certificate,
  FileText,
  ShieldCheck,
  WarningCircle,
} from "@phosphor-icons/react/dist/ssr";

import { EmptyState, PageHeader } from "@/components/ui/page-kit";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type ExpirySummary = {
  window_days: number;
  bucket_30: number;
  bucket_60: number;
  bucket_90: number;
  total: number;
};
type UflpaSummary = {
  total: number;
  hits: number;
  flags: number;
  clear: number;
};
type MsaSummary = {
  total_saved: number;
  total_published: number;
  rsc_covered: number;
  expiring_certs_90d: number;
  sanctions_hits: number;
};

export default async function ComplianceHubPage() {
  const supabase = await createSupabaseServerClient();
  const [exp, ufl, msa] = await Promise.all([
    supabase.rpc("compliance_expiring_certs", { p_window_days: 90 }),
    supabase.rpc("compliance_uflpa_tracker"),
    supabase.rpc("compliance_msa_inputs"),
  ]);

  const expiry = (exp.data ?? null) as ExpirySummary | null;
  const uflpa = (ufl.data ?? null) as UflpaSummary | null;
  const msaIn = (msa.data ?? null) as MsaSummary | null;
  const anyError = exp.error || ufl.error || msa.error;

  const savedTotal = msaIn?.total_saved ?? 0;
  const expCount = expiry?.total ?? 0;
  const uflpaHits = uflpa?.hits ?? 0;
  const uflpaFlags = uflpa?.flags ?? 0;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        kicker="Buyer"
        title="Compliance"
        description={`Personalised compliance posture across your ${savedTotal.toLocaleString()} saved suppliers — upcoming cert renewals, UFLPA risk, and your UK Modern Slavery Act §54 statement.`}
      />

      {anyError ? (
        <div className="rounded-card border border-sem-red/30 bg-sem-red-soft p-4 text-sm text-sem-red">
          Could not load one or more compliance views.
        </div>
      ) : null}

      {savedTotal === 0 ? (
        <EmptyState
          title="No saved suppliers yet"
          description="The Compliance page draws from your saved list. Save suppliers from Discover to begin."
          action={
            <Link
              href="/app/discover"
              className="inline-flex items-center gap-1 rounded-pill bg-brand-forest px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-forest-mid"
            >
              Browse Discover <ArrowRight size={13} weight="bold" />
            </Link>
          }
        />
      ) : null}

      <section
        aria-label="Compliance surfaces"
        className="grid grid-cols-1 gap-4 md:grid-cols-3"
      >
        <HubTile
          href="/app/compliance/expiry"
          Icon={Certificate}
          title="Certification expiry"
          meta="Next 90 days"
          value={expCount}
          chip={
            (expiry?.bucket_30 ?? 0) > 0
              ? "alert"
              : expCount > 0
                ? "active"
                : "neutral"
          }
          subline={
            expiry
              ? `${expiry.bucket_30} <30d · ${expiry.bucket_60} 30–60d · ${expiry.bucket_90} 60–90d`
              : "No data"
          }
        />
        <HubTile
          href="/app/compliance/uflpa"
          Icon={ShieldCheck}
          title="UFLPA tracker"
          meta="Forced-labour exposure"
          value={uflpaHits + uflpaFlags}
          chip={uflpaHits > 0 ? "alert" : uflpaFlags > 0 ? "active" : "success"}
          subline={
            uflpa
              ? `${uflpa.hits} hit${uflpa.hits === 1 ? "" : "s"} · ${uflpa.flags} region flag${uflpa.flags === 1 ? "" : "s"} · ${uflpa.clear} clear`
              : "No data"
          }
        />
        <HubTile
          href="/app/compliance/msa"
          Icon={FileText}
          title="MSA §54 generator"
          meta="Modern Slavery Act"
          value={msaIn?.total_published ?? 0}
          chip="neutral"
          subline={
            msaIn
              ? `${msaIn.rsc_covered} RSC-covered · ${msaIn.expiring_certs_90d} certs expiring`
              : "No data"
          }
        />
      </section>

      {expCount > 0 && (expiry?.bucket_30 ?? 0) > 0 ? (
        <section className="proto-card space-y-2">
          <div className="proto-card-head">
            <h2 className="proto-card-title">Imminent renewals</h2>
            <span className="proto-card-meta">
              Certifications expiring in under 30 days
            </span>
          </div>
          <p className="flex items-center gap-2 text-sm text-ink-secondary">
            <WarningCircle size={16} weight="fill" className="text-sem-amber" />
            {expiry?.bucket_30}{" "}
            {expiry?.bucket_30 === 1 ? "certification expires" : "certifications expire"}{" "}
            within 30 days. Review under{" "}
            <Link
              href="/app/compliance/expiry"
              className="font-medium text-brand-forest underline-offset-2 hover:underline"
            >
              certification expiry
            </Link>
            .
          </p>
        </section>
      ) : null}
    </div>
  );
}

type IconCmp = React.ComponentType<{
  size?: number;
  weight?: "regular" | "fill" | "duotone";
  className?: string;
}>;

function HubTile({
  href,
  Icon,
  title,
  meta,
  value,
  chip,
  subline,
}: {
  href: string;
  Icon: IconCmp;
  title: string;
  meta: string;
  value: number;
  chip: "neutral" | "active" | "alert" | "success";
  subline: string;
}) {
  const chipClass =
    chip === "alert"
      ? "chip !bg-sem-red-soft !text-sem-red !border-sem-red"
      : chip === "active"
        ? "chip !bg-sem-amber-soft !text-sem-amber !border-sem-amber"
        : chip === "success"
          ? "chip claim-verified"
          : "chip";
  return (
    <Link
      href={href}
      className="block rounded-card focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-forest"
    >
      <article className="proto-card hoverable h-full space-y-3">
        <div className="flex items-center gap-2">
          <Icon size={18} weight="duotone" className="text-brand-forest" />
          <p className="text-[10px] font-semibold text-ink-tertiary">
            {meta}
          </p>
        </div>
        <div className="flex items-baseline gap-3">
          <p className="font-display text-3xl font-light tabular-nums text-ink-primary">
            {value.toLocaleString()}
          </p>
          <span className={chipClass}>{title}</span>
        </div>
        <p className="text-[11px] text-ink-tertiary">
          {subline}
        </p>
      </article>
    </Link>
  );
}
