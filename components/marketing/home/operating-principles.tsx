// Operating principles — bento grid for /home-demo.
//
// Design system: Grok-style bento cells (title + body + illustration stage).
// Three illustration approaches, one visual language:
//   01 Rankings  — the production DataPipeline (animated beams), scaled down
//   02 One record — twin session mirror of one live supplier
//   03 No scores — issuer cert strip + unpublished score well
//
// Live evidence only. If the featured profile cannot be loaded, the section
// hides — never invent company names, source counts, or certificate rows.

import type { ReactNode } from "react";

import { DataPipeline } from "@/components/marketing/home/data-pipeline";
import { Kicker } from "@/components/marketing/home/kicker";
import {
  NoScoresEvidence,
  type AuthorityItem,
} from "@/components/marketing/home/no-scores-evidence";
import { OneRecordMirror } from "@/components/marketing/home/one-record-mirror";
import { BlurFade } from "@/components/ui/blur-fade";
import { CERT_KINDS } from "@/components/discover/filter-rail";
import { fetchPublicDiscoverSuppliers } from "@/lib/discover-suppliers";
import { formatCompanyName } from "@/lib/format-company-name";
import { formatCardLocation } from "@/lib/format-location";
import { formatProfileDate } from "@/lib/format-supplier-profile";
import { sourceLogo } from "@/lib/source-logos";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

const REGISTRY_CODES = new Set([
  "BGMEA",
  "BKMEA",
  "BTMA",
  "BGAPMEA",
  "RSC",
  "EPB",
]);

const CERT_LABELS: Record<string, string> = {
  wrap: "WRAP",
  oeko_tex: "OEKO-TEX®",
  gots: "GOTS",
  sa8000: "SA8000",
  grs: "GRS",
  rcs: "RCS",
  ocs: "OCS",
};

const REGISTRY_LABELS: Record<string, string> = {
  BGMEA: "BGMEA",
  BKMEA: "BKMEA",
  BTMA: "BTMA",
  BGAPMEA: "BGAPMEA",
  RSC: "RSC",
  EPB: "EPB",
};

// Cap for the "No invented scores" card grid — bounds card height for
// evidence-heavy suppliers. The overflow count shown alongside it is
// always the real remainder, never rounded or invented.
const MAX_AUTHORITY_ITEMS = 8;

type Pill = { source_code: string; inherited_from: string | null };
type Cert = {
  kind: string;
  expires_on: string | null;
  scope: string | null;
};
type Supplier = {
  company_name: string;
  entity_type: "factory" | "buying_house" | "unknown";
  city: string | null;
  district: string | null;
  address_raw: string | null;
  is_sanctioned: boolean;
};
type ProfilePayload = {
  supplier: Supplier;
  t13_source_count: number;
  pills: Pill[];
  certifications: Cert[];
};

type PrincipleEvidence = {
  name: string;
  entityLabel: string;
  location: string | null;
  t13: number;
  /** Real registry / cert codes with logos — for the one-record card. */
  authorityCodes: string[];
  /** Every real registry filing + certification with a logo, most-evidence
   * first, capped at MAX_AUTHORITY_ITEMS. Never trimmed to look sparse on
   * purpose — the cap only exists to bound card height. */
  authorityItems: AuthorityItem[];
  /** True remaining count beyond the cap — 0 when nothing was cut. */
  authorityOverflow: number;
};

function certLabel(kind: string): string {
  return CERT_LABELS[kind] ?? kind.replace(/_/g, "-").toUpperCase();
}

function certTone(c: Cert): AuthorityItem {
  const label = certLabel(c.kind);
  const code = logoTag(c.kind);
  const scope = c.scope?.trim() ? c.scope.trim() : null;
  const base = { code, kind: "certification" as const, label, scope };
  if (c.kind === "oeko_tex") {
    return { ...base, status: "Evergreen", tone: "evergreen" };
  }
  if (!c.expires_on) {
    return { ...base, status: "No expiry", tone: "evergreen" };
  }
  const exp = new Date(c.expires_on).getTime();
  if (Number.isNaN(exp)) {
    return { ...base, status: "No expiry", tone: "evergreen" };
  }
  const daysLeft = Math.floor((exp - Date.now()) / (1000 * 60 * 60 * 24));
  if (daysLeft < 0) {
    return { ...base, status: `Expired ${formatProfileDate(c.expires_on)}`, tone: "expired" };
  }
  if (daysLeft < 90) {
    return { ...base, status: `Expires in ${daysLeft}d`, tone: "expiring" };
  }
  return { ...base, status: "Valid", tone: "valid" };
}

function registryItem(p: Pill): AuthorityItem {
  return {
    code: p.source_code,
    kind: "registry",
    label: REGISTRY_LABELS[p.source_code] ?? p.source_code,
    status: p.inherited_from ? "Inherited" : "On record",
    tone: "valid",
    scope: null,
  };
}

function logoTag(code: string): string {
  if (code === "oeko_tex" || code === "OEKO-TEX") return "OEKO_TEX";
  return code.toUpperCase();
}

function entityLabel(type: Supplier["entity_type"]): string {
  if (type === "factory") return "Factory";
  if (type === "buying_house") return "Buying house";
  return "Supplier";
}

/** Bound profile RPCs — first eligible candidate wins; avoid a 12-row scan. */
const PRINCIPLE_CANDIDATE_LIMIT = 6;

async function loadPrincipleEvidence(): Promise<PrincipleEvidence | null> {
  const certKinds = CERT_KINDS.map((c) => c.value);
  // Same default Discover sort the product uses for "Most evidence":
  // ORDER BY t13_source_count DESC (see discover_suppliers p_sort='receipts').
  const { rows, error } = await fetchPublicDiscoverSuppliers({
    p_q: null,
    p_entity_types: null,
    p_min_sources: 3,
    p_cert_kinds: [...certKinds],
    p_rsc_min: null,
    p_city: null,
    p_district: null,
    p_category: null,
    p_sort: "receipts",
    p_limit: PRINCIPLE_CANDIDATE_LIMIT,
    p_offset: 0,
    p_registries: null,
    p_factory_types: null,
    p_brand_codes: null,
    p_completeness_min: null,
    p_workers_min: null,
  });
  if (error || rows.length < 2) return null;

  if (rows.slice(0, 2).some((row) => row.t13_source_count < 1)) return null;

  try {
    const supabase = await createSupabaseServerClient();
    const slugs = rows.map((r) => r.slug).filter((s): s is string => !!s);
    const results = await Promise.all(
      slugs.map(async (slug) => {
        const { data, error: profileError } = await supabase.rpc(
          "buyer_supplier_profile",
          { p_slug: slug },
        );
        if (profileError || data == null) return null;
        return data as ProfilePayload;
      }),
    );

    for (const payload of results) {
      if (!payload) continue;
      if (payload.supplier.is_sanctioned) continue;
      if (payload.t13_source_count < 3) continue;
      if (payload.certifications.length === 0) continue;

      const registryPills = payload.pills.filter((p) =>
        REGISTRY_CODES.has(p.source_code),
      );
      const registryCodes = registryPills.map((p) => p.source_code);
      const certCodes = payload.certifications.map((c) => logoTag(c.kind));
      const authorityCodes = [...new Set([...registryCodes, ...certCodes])]
        .filter((c) => sourceLogo(c) != null)
        .slice(0, 3);
      if (authorityCodes.length === 0) continue;

      // Full breadth for the "No invented scores" card — every real
      // registry filing + certification with a logo, direct filings
      // before inherited ones, most-evidence-relevant certs first (RPC
      // order). Capped only to bound card height, never to look sparse.
      const directRegistries = registryPills
        .filter((p) => !p.inherited_from && !(p as { building_name?: string | null }).building_name?.trim())
        .map(registryItem);
      const inheritedRegistries = registryPills
        .filter((p) => p.inherited_from && !(p as { building_name?: string | null }).building_name?.trim())
        .map(registryItem);
      const certItems = payload.certifications.map(certTone);
      const allAuthorityItems = [
        ...directRegistries,
        ...certItems,
        ...inheritedRegistries,
      ].filter((item) => sourceLogo(item.code) != null);
      const authorityItems = allAuthorityItems.slice(0, MAX_AUTHORITY_ITEMS);
      const authorityOverflow = Math.max(
        0,
        allAuthorityItems.length - authorityItems.length,
      );

      const location = formatCardLocation(
        payload.supplier.address_raw,
        payload.supplier.city,
        payload.supplier.district,
      );

      return {
        name: formatCompanyName(payload.supplier.company_name),
        entityLabel: entityLabel(payload.supplier.entity_type),
        location,
        t13: payload.t13_source_count,
        authorityCodes,
        authorityItems,
        authorityOverflow,
      };
    }
    return null;
  } catch {
    return null;
  }
}

/** Shared bento cell chrome — matches the reference feature-grid language. */
function BentoCell({
  title,
  body,
  children,
  className,
}: {
  title: string;
  body: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <article
      className={cn(
        "flex h-full flex-col rounded-2xl border border-neutral-200/80 bg-neutral-50 p-6 md:p-7",
        className,
      )}
    >
      <h3 className="font-display text-lg font-semibold tracking-tight text-neutral-900 md:text-xl">
        {title}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-neutral-600">{body}</p>
      <div className="mt-6 flex flex-1 items-center">{children}</div>
    </article>
  );
}

/**
 * 01 — Real evidence pipeline, reused verbatim from the production
 * DataPipeline (cert bodies + registries converging on the canonical
 * SourceBD index), just scaled down to bento-cell proportions via its
 * existing size-override props. Payment has no node in this diagram —
 * only verified Tier 1–3 sources feed the index.
 */
function RankingsPipeline() {
  return (
    <div
      role="img"
      aria-label="Verified Tier 1–3 sources feed the SourceBD index; payment has no path into it"
      className="w-full"
    >
      <DataPipeline
        containerClassName="min-h-[220px] grid-cols-[48px_minmax(90px,1fr)_48px] gap-2 sm:min-h-[240px] sm:grid-cols-[52px_minmax(100px,1fr)_52px] sm:gap-2.5"
        columnGapClassName="gap-2.5 sm:gap-3"
        nodeClassName="size-11 rounded-md p-1.5 sm:size-12"
        logoSize={34}
        showConnectionDots={false}
        showHairline={false}
        markSrc="/icons/brand/sourcebd-stack-hub.png?v=5"
        markClassName="size-[56px] sm:size-[70px] lg:size-[67px]"
      />
    </div>
  );
}

export async function OperatingPrinciples() {
  const evidence = await loadPrincipleEvidence();
  if (!evidence) return null;

  return (
    <section className="border-b border-neutral-200 bg-white py-20 md:py-24">
      <div className="mx-auto w-full max-w-[1200px] px-4 sm:px-6">
        <BlurFade delay={0.1}>
          <header className="max-w-2xl">
            <Kicker>Operating principles</Kicker>
            <h2 className="mt-3 text-balance font-display text-2xl font-bold leading-tight tracking-tight text-neutral-900 md:text-3xl">
              Independent supplier intelligence.{" "}
              <span className="text-neutral-500">Neutral by design.</span>
            </h2>
          </header>
        </BlurFade>

        <div className="mt-10 grid gap-4 sm:mt-12 md:grid-cols-3 md:gap-5">
          <BlurFade delay={0.08} className="h-full">
            <BentoCell
              title="Rankings are never for sale."
              body="Placement follows evidence — never payment."
            >
              <RankingsPipeline />
            </BentoCell>
          </BlurFade>

          <BlurFade delay={0.12} className="h-full">
            <BentoCell
              title="One record, every buyer."
              body="The same evidence, shown the same way, every time."
            >
              <OneRecordMirror evidence={evidence} />
            </BentoCell>
          </BlurFade>

          <BlurFade delay={0.16} className="h-full">
            <BentoCell
              title="No invented scores."
              body="Issuer evidence only — you form your own view."
            >
              <NoScoresEvidence
              items={evidence.authorityItems}
              overflow={evidence.authorityOverflow}
            />
          </BentoCell>
          </BlurFade>
        </div>
      </div>
    </section>
  );
}
