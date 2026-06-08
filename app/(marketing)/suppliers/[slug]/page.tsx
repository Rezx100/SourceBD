// Spec FE-SITEWIDE Phase A — public Factory profile (anon, /suppliers/[slug]).
//
// Mirrors the prototype anatomy shipped by FE-PROTO on the authenticated
// `/app/suppliers/[slug]` route, with three public-mode adaptations:
//
//   1. No SaveButton, no ClaimCtaButton. Side-panel CTAs convert anon
//      visitors via /signup?next=… and /login?next=… instead.
//   2. Contact tab is always the gated card; its CTA links to
//      /signup?next=/suppliers/<slug> (not /pricing — anon users have no
//      plan yet; the conversion event is sign-up).
//   3. Address rows are stripped of `phone` and `email` at render time
//      (Spec M5 JC #12 (a) — registry-published PII is not exposed to
//      anonymous traffic). Inline mapper, not promoted to lib/.
//
// Hard contracts preserved:
//   - RPC `public.buyer_supplier_profile` is unchanged (no DB migration).
//   - R1 glyph payload = `t13_source_count`. No SBI / pillar / grade.
//   - Sanctions banner overrides chrome when an active hit exists; the
//     Contact CTA is disabled in that branch.
//   - Tier hierarchy is law: Provenance tab footer reiterates it.
//   - M4 JSON-LD Organization / LocalBusiness preserved.

import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ShieldCheck } from "@phosphor-icons/react/dist/ssr";

import { ReceiptsRing } from "@/components/receipts-ring";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProductsStripExpandable } from "@/components/supplier/products-strip-expandable";
import { AddressesJumpLink } from "@/components/supplier/addresses-jump-link";
import { SourcesExplainer } from "@/components/supplier/sources-explainer";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveRegistryUrl, resolveCertificateUrl } from "@/lib/source-links";
import { dedupAddresses, type DedupedAddress } from "@/lib/dedup-addresses";

export const revalidate = 300;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://sourcebd.net";

// ---------- payload shape (mirrors RPC RETURNS jsonb document) -------------

type Supplier = {
  id: string;
  slug: string;
  company_name: string;
  entity_type: "factory" | "buying_house" | "unknown";
  city: string | null;
  district: string | null;
  country: string | null;
  address_raw: string | null;
  completeness_pct: number;
  is_sanctioned: boolean;
  parent_group_name: string | null;
  established_date: string | null;
  bepza_zone: string | null;
  factory_types: string[];
  principal_products: string[];
  employees_total: number | null;
  employees_male: number | null;
  employees_female: number | null;
  machines_sewing: number | null;
  production_capacity_pcs_day: number | null;
  production_capacity_dozen_yearly: number | null;
  source_tags: string[];
};

type Pill = {
  source_code: string;
  label: string;
  value: string | null;
  verified: boolean | null;
  source_url: string | null;
  inherited_from: string | null;
  inherited_from_name: string | null;
};

type Cert = {
  kind: string;
  certificate_no: string | null;
  issuer: string | null;
  issued_on: string | null;
  expires_on: string | null;
  scope: string | null;
  document_url: string | null;
};

type RscRemediation = {
  progress_pct: number | null;
  workers_count: number | null;
  remediation_status: string | null;
  training_status: string | null;
  parent_group_name: string | null;
  parent_group_factory_count: number | null;
  fire_inspection_url: string | null;
  structural_inspection_url: string | null;
  electrical_inspection_url: string | null;
  boiler_inspection_url: string | null;
  cap_url: string | null;
};

type BrandAttribution = {
  source_code: string;
  display_name: string;
  source_url: string | null;
  last_seen_at: string;
};

type SanctionsHit = {
  list: string;
  matched_name: string;
  list_entry_ref: string | null;
  screened_at: string;
  source_url: string | null;
  listed_date: string | null;
};

type Provenance = {
  source_code: string;
  display_name: string;
  tier: string;
  source_ref: string | null;
  source_url: string | null;
  last_seen_at: string;
};

type AddressRowRaw = {
  kind: string;
  address: string;
  phone: string | null;
  email: string | null;
  source_code: string;
  fetched_at: string;
};

type PublicAddress = {
  kind: string;
  address: string;
  source_code: string;
  fetched_at: string;
};

type ComplianceDocument = {
  doc_type: "fire" | "structural" | "electrical" | "boiler" | "cap";
  mirror_url: string | null;
  original_url: string;
  fetched_at: string;
  file_size: number | null;
};

type ProfilePayload = {
  supplier: Supplier;
  t13_source_count: number;
  pills: Pill[];
  certifications: Cert[];
  rsc_remediation: RscRemediation | null;
  brand_attributions: BrandAttribution[];
  sanctions: SanctionsHit[];
  provenance: Provenance[];
  addresses: AddressRowRaw[];
  documents: ComplianceDocument[];
};

function publicAddresses(rows: AddressRowRaw[]): PublicAddress[] {
  return rows.map((r) => ({
    kind: r.kind,
    address: r.address,
    source_code: r.source_code,
    fetched_at: r.fetched_at,
  }));
}

// ---------- metadata ------------------------------------------------------

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.rpc("buyer_supplier_profile", {
      p_slug: slug,
    });
    if (!data) return { title: "Supplier — SourceBD" };
    const payload = data as ProfilePayload;
    const s = payload.supplier;
    const loc = [s.city, s.district, s.country].filter(Boolean).join(", ");
    const title = `${s.company_name} — Bangladesh RMG supplier on SourceBD`;
    const description = loc
      ? `${s.company_name}, ${loc}. Verified registers, certifications, and source receipts on SourceBD.`
      : `${s.company_name}. Verified registers, certifications, and source receipts on SourceBD.`;
    return {
      title,
      description,
      robots: { index: true, follow: true },
      alternates: { canonical: `${SITE_URL}/suppliers/${slug}` },
      openGraph: {
        title,
        description,
        url: `${SITE_URL}/suppliers/${slug}`,
        type: "profile",
      },
    };
  } catch {
    return { title: "Supplier — SourceBD" };
  }
}

// ---------- entry --------------------------------------------------------

export default async function PublicSupplierProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.rpc("buyer_supplier_profile", {
    p_slug: slug,
  });
  if (error || data == null) {
    // Distinguish "row missing" (correct 404) from "DB timeout" (transient).
    const code = (error as { code?: string } | null)?.code ?? null;
    const msg = error?.message ?? "";
    const isTimeout =
      code === "57014" ||
      /statement timeout|canceling statement|timed out/i.test(msg);
    if (isTimeout) {
      return (
        <div className="mx-auto max-w-2xl px-4 py-12">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-6">
            <h1 className="text-lg font-semibold text-amber-900">
              Service temporarily slow
            </h1>
            <p className="mt-2 text-sm text-amber-800">
              The factory profile for{" "}
              <span className="font-mono">{slug}</span> couldn&apos;t load
              within the time limit. Please refresh in a few seconds.
            </p>
            <Link
              href={`/suppliers/${slug}`}
              className="mt-4 inline-flex items-center rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700"
            >
              Retry
            </Link>
          </div>
        </div>
      );
    }
    notFound();
  }

  const payload = data as ProfilePayload;
  const s = payload.supplier;
  const nextPath = `/suppliers/${s.slug}`;

  const hasLocality = !!(s.city || s.district);
  const ldType = hasLocality ? "LocalBusiness" : "Organization";
  const ld: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": ldType,
    name: s.company_name,
    url: `${SITE_URL}/suppliers/${s.slug}`,
  };
  if (hasLocality || s.country) {
    ld.address = {
      "@type": "PostalAddress",
      ...(s.city ? { addressLocality: s.city } : {}),
      ...(s.district ? { addressRegion: s.district } : {}),
      ...(s.country ? { addressCountry: s.country } : {}),
    };
  }

  return (
    <>
      <div className="mx-auto flex max-w-[1180px] flex-col gap-4 px-6 py-8">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }}
        />

        {s.is_sanctioned ? <SanctionsBanner /> : null}

        <ProfileHeader payload={payload} nextPath={nextPath} />

        {s.principal_products.length > 0 ? (
          <ProductsStripExpandable products={s.principal_products} />
        ) : null}

        <Tabs defaultValue="compliance" className="mt-4 flex flex-col gap-4">
          <TabsList
            aria-label="Profile sections"
            className="proto-tabs h-auto bg-transparent p-0"
          >
            <TabsTrigger value="overview" id="tab-trigger-overview" className="proto-tab">
              Overview
            </TabsTrigger>
            <TabsTrigger value="compliance" className="proto-tab">
              Compliance
              <span className="proto-tab-count">{complianceCount(payload)}</span>
            </TabsTrigger>
            {hasCapacity(s) ? (
              <TabsTrigger value="capacity" className="proto-tab">
                Capacity
              </TabsTrigger>
            ) : null}
            {payload.brand_attributions.length > 0 ? (
              <TabsTrigger value="brands" className="proto-tab">
                Brand attribution
                <span className="proto-tab-count">
                  {payload.brand_attributions.length}
                </span>
              </TabsTrigger>
            ) : null}
            <TabsTrigger value="contact" className="proto-tab">
              Contact
            </TabsTrigger>
            <TabsTrigger value="provenance" className="proto-tab">
              Provenance
              <span className="proto-tab-count">{payload.provenance.length}</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <OverviewTab payload={payload} />
          </TabsContent>
          <TabsContent value="compliance" id="compliance">
            <ComplianceTab payload={payload} />
          </TabsContent>
          {hasCapacity(s) ? (
            <TabsContent value="capacity">
              <CapacityTab supplier={s} />
            </TabsContent>
          ) : null}
          {payload.brand_attributions.length > 0 ? (
            <TabsContent value="brands">
              <BrandsTab brands={payload.brand_attributions} />
            </TabsContent>
          ) : null}
          <TabsContent value="contact">
            <ContactTab nextPath={nextPath} disabled={s.is_sanctioned} />
          </TabsContent>
          <TabsContent value="provenance">
            <ProvenanceTab provenance={payload.provenance} />
          </TabsContent>
        </Tabs>

        <p className="affiliation-disclaimer mt-6">
          Authority logos identify the data sources we aggregate from. SourceBD
          is not affiliated with or endorsed by BGMEA, BKMEA, BTMA, EPB,
          OEKO-TEX, WRAP, GOTS, RSC, or any of the brands named on this page.
          Every datum traces to the issuing authority shown on the Provenance
          tab.
        </p>
      </div>
    </>
  );
}

// ---------- header --------------------------------------------------------

// I-023 — "Verified by" hero badge (see /app/suppliers/[slug] twin). Surfaces
// Tier-1 (government) and Tier-2 (industry-association) backing only.
const VERIFIED_TIER_CODES: Record<string, string> = {
  RJSC: "RJSC",
  BIN: "BIN",
  EPB: "EPB",
  BGMEA: "BGMEA",
  BKMEA: "BKMEA",
  BTMA: "BTMA",
  BGAPMEA: "BGAPMEA",
};

function VerifiedByChip({ pills }: { pills: Pill[] }) {
  const codes: string[] = [];
  for (const p of pills) {
    const label = VERIFIED_TIER_CODES[p.source_code];
    if (label && !codes.includes(label)) codes.push(label);
  }
  if (codes.length === 0) return null;
  const shown = codes.slice(0, 4);
  const overflow = codes.length - shown.length;
  return (
    <span
      className="chip chip-verified"
      title={`Verified by ${codes.join(", ")}`}
    >
      <ShieldCheck size={13} weight="fill" aria-hidden />
      <span>Verified by</span>
      <span className="chip-verified-sources">
        {shown.join(" + ")}
        {overflow > 0 ? ` +${overflow}` : ""}
      </span>
    </span>
  );
}

function ProfileHeader({
  payload,
  nextPath,
}: {
  payload: ProfilePayload;
  nextPath: string;
}) {
  const s = payload.supplier;
  const addrs = publicAddresses(payload.addresses);
  const dedupedAddresses = dedupAddresses(addrs);
  const primaryAddress = s.address_raw ?? addrs[0]?.address ?? null;
  const cityLine = [s.city, s.district].filter(Boolean).join(", ");
  const otherAddressCount = Math.max(0, dedupedAddresses.length - 1);
  const lastVerified = payload.provenance[0]?.last_seen_at ?? null;
  const lastVerifiedSource = payload.provenance[0]?.display_name ?? null;

  const entityBreadcrumb =
    s.entity_type === "buying_house"
      ? "Discover › Buying house"
      : "Discover › Garment manufacturer";

  const rjsc = pillByCode(payload.pills, "RJSC")?.value ?? null;
  const bin = pillByCode(payload.pills, "BIN")?.value ?? null;
  const epbExp = pillByCode(payload.pills, "EPB")?.value ?? null;
  const established = s.established_date;

  // I-015 — build cells conditionally; never emit an em-dash placeholder.
  const metaCells: { key: string; dt: string; dd: ReactNode }[] = [];
  if (primaryAddress || cityLine) {
    metaCells.push({
      key: "address",
      dt: "Address",
      dd: (
        <>
          {primaryAddress}
          {primaryAddress && cityLine ? <br /> : null}
          {cityLine ? <span className="mono">{cityLine}</span> : null}
        </>
      ),
    });
  }
  if (established) {
    metaCells.push({
      key: "established",
      dt: "Established",
      dd: (
        <>
          {established}
          <br />
          <span className="mono">{yearsSince(established)} yrs</span>
        </>
      ),
    });
  }
  if (rjsc) {
    metaCells.push({
      key: "rjsc",
      dt: "RJSC",
      dd: <span className="mono">{rjsc}</span>,
    });
  }
  if (bin || epbExp) {
    metaCells.push({
      key: "bin-epb",
      dt: bin ? "BIN" : "EPB",
      dd: <span className="mono">{bin ?? epbExp}</span>,
    });
  }
  if (lastVerified) {
    metaCells.push({
      key: "last-verified",
      dt: "Last verified",
      dd: (
        <>
          <span className="mono">{fmtDate(lastVerified)}</span>
          {lastVerifiedSource ? (
            <>
              <br />
              <span
                style={{
                  fontSize: 10,
                  color: "var(--ink-tertiary)",
                  fontFamily: "var(--font-mono)",
                }}
              >
                {lastVerifiedSource}
              </span>
            </>
          ) : null}
        </>
      ),
    });
  }

  return (
    <section className="header-card" aria-labelledby="company-name">
      <div className="header-glyph-col">
        <ReceiptsRing sources={payload.t13_source_count} size={64} />
        <SourcesExplainer variant="inline" />
      </div>

      <div className="header-main min-w-0">
        <div className="breadcrumb">{entityBreadcrumb}</div>
        <h1 id="company-name" className="header-name">
          {s.company_name}
        </h1>
        {s.parent_group_name ? (
          <p className="header-parentline">
            <span style={{ color: "var(--ink-tertiary)" }}>Member of</span>{" "}
            <Link
              href={`/discover?group=${encodeURIComponent(s.parent_group_name)}`}
            >
              {s.parent_group_name}
            </Link>
          </p>
        ) : null}

        <div className="header-chips">
          <VerifiedByChip pills={payload.pills} />
          <span className="chip">{entityLabel(s.entity_type)}</span>
          {s.factory_types.slice(0, 2).map((t) => (
            <span key={t} className="chip">
              {t}
            </span>
          ))}
        </div>

        <dl className="header-meta-row">
          {metaCells.map((cell) => (
            <div key={cell.key}>
              <dt>{cell.dt}</dt>
              <dd>{cell.dd}</dd>
            </div>
          ))}
        </dl>
        {otherAddressCount > 0 ? (
          <AddressesJumpLink count={otherAddressCount} />
        ) : null}
      </div>

      <div className="header-side">
        <CompletenessChip pct={s.completeness_pct} />
        <div className="btn-row">
          <Link
            href={`/signup?next=${encodeURIComponent(nextPath)}`}
            className="btn-proto"
          >
            Sign up to save
          </Link>
          {s.is_sanctioned ? (
            <span
              className="btn-proto"
              aria-disabled
              style={{ opacity: 0.5, cursor: "not-allowed" }}
              title="Contact disabled — sanctions flag active"
            >
              Contact disabled
            </span>
          ) : (
            <Link
              href={`/signup?next=${encodeURIComponent(nextPath)}`}
              className="btn-proto primary"
            >
              Contact
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}

function CompletenessChip({ pct }: { pct: number }) {
  const thin = pct < 60;
  return (
    <span
      className={`completeness${thin ? " thin" : ""}`}
      title={`${pct}% of expected fields populated`}
    >
      {pct}% complete
    </span>
  );
}

function SanctionsBanner() {
  return (
    <div role="alert" className="sanctions-banner">
      <svg
        viewBox="0 0 24 24"
        width={28}
        height={28}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ color: "var(--sem-red)" }}
        aria-hidden
      >
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <path d="M12 9v4M12 17h.01" />
      </svg>
      <div>
        <p className="sanctions-banner-title">Sanctions / forced-labour flag</p>
        <p className="sanctions-banner-body">
          This supplier matches an active watchlist entry. See the Compliance
          tab for the matched record and source link.
        </p>
      </div>
      <a href="#compliance" className="btn-proto">
        View matches
      </a>
    </div>
  );
}

// ---------- Products strip ------------------------------------------------
// Rendered via the client-side `ProductsStripExpandable` component so that
// the "+ N more" affordance can expand inline.

// ---------- Overview tab --------------------------------------------------

function OverviewTab({ payload }: { payload: ProfilePayload }) {
  const s = payload.supplier;
  const addrs = publicAddresses(payload.addresses);
  const dedupedAddresses = dedupAddresses(addrs);
  return (
    <div className="proto-grid">
      <section className="proto-card hoverable span2">
        <header className="proto-card-head">
          <h2 className="proto-card-title">About</h2>
          <span className="proto-card-meta">
            {payload.provenance.length} source records
          </span>
        </header>
        <p
          style={{
            margin: 0,
            fontSize: 14,
            lineHeight: 1.65,
            color: "var(--ink-primary)",
            fontWeight: 300,
          }}
        >
          {entityNarrative(s)}
        </p>
        <dl
          className="header-meta-row"
          style={{ border: "none", padding: 0, marginTop: 16 }}
        >
          {s.parent_group_name ? (
            <div>
              <dt>Group</dt>
              <dd>{s.parent_group_name}</dd>
            </div>
          ) : null}
          {s.bepza_zone ? (
            <div>
              <dt>EPZ zone</dt>
              <dd>{s.bepza_zone}</dd>
            </div>
          ) : null}
          {s.country ? (
            <div>
              <dt>Country</dt>
              <dd>{s.country}</dd>
            </div>
          ) : null}
          {s.factory_types.length > 0 ? (
            <div>
              <dt>Factory type</dt>
              <dd>{s.factory_types.slice(0, 3).join(" · ")}</dd>
            </div>
          ) : null}
          <div>
            <dt>Receipts</dt>
            <dd>
              <span className="mono">
                {payload.t13_source_count} Tier 1–3 source
                {payload.t13_source_count === 1 ? "" : "s"}
              </span>
            </dd>
          </div>
        </dl>
      </section>

      {dedupedAddresses.length > 1 ? (
        <section id="locations" className="proto-card hoverable span2">
          <header className="proto-card-head">
            <h2 className="proto-card-title">Addresses on file</h2>
            <span className="proto-card-meta">
              {dedupedAddresses.length} location{dedupedAddresses.length === 1 ? "" : "s"}
            </span>
          </header>
          <ul
            className="m-0 flex list-none flex-col p-0"
            style={{ borderTop: "1px solid var(--hairline)" }}
          >
            {dedupedAddresses.map((a, i) => (
              <AddressRow key={i} address={a} />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function AddressRow({ address }: { address: DedupedAddress<PublicAddress> }) {
  const kindLabel = address.kinds.join(" · ");
  return (
    <li
      style={{
        padding: "12px 0",
        borderBottom: "1px solid var(--hairline)",
        display: "grid",
        gridTemplateColumns: "140px 1fr auto",
        gap: 16,
        alignItems: "baseline",
      }}
    >
      <span
        className="mono"
        style={{
          fontSize: 11,
          color: "var(--ink-tertiary)",
          letterSpacing: "0.06em",
        }}
      >
        {kindLabel}
      </span>
      <span style={{ fontSize: 13, color: "var(--ink-primary)" }}>
        {address.address}
      </span>
      <span
        className="mono"
        style={{ fontSize: 11, color: "var(--ink-tertiary)" }}
      >
        via {address.verified_by.join(" + ")}
      </span>
    </li>
  );
}

function entityNarrative(s: Supplier): string {
  const kind =
    s.entity_type === "buying_house"
      ? "buying house"
      : s.factory_types[0] ?? "garment manufacturer";
  const where = [s.city, s.district].filter(Boolean).join(", ");
  const since = s.established_date
    ? ` operating since ${s.established_date}`
    : "";
  const products =
    s.principal_products.length > 0
      ? ` Principal products: ${s.principal_products.slice(0, 4).join(", ")}.`
      : "";
  return `${s.company_name} is a ${kind}${
    where ? ` based in ${where}` : ""
  }${since}.${products}`;
}

// ---------- Compliance tab ------------------------------------------------

function ComplianceTab({ payload }: { payload: ProfilePayload }) {
  const registryPills = payload.pills.filter((p) =>
    REGISTRY_CODES.has(p.source_code),
  );
  return (
    <div className="proto-grid">
      {registryPills.length > 0 ? (
        <section className="proto-card hoverable">
          <header className="proto-card-head">
            <h2 className="proto-card-title">Registries</h2>
            <span className="proto-card-meta">
              {countDirect(registryPills)} direct ·{" "}
              {countInherited(registryPills)} inherited
            </span>
          </header>
          <div className="registry-list">
            {registryPills.map((p, i) => (
              <RegistryRow key={i} pill={p} />
            ))}
          </div>
          {registryPills.some((p) => p.inherited_from != null) ? (
            <p
              style={{
                margin: "14px 0 0",
                fontSize: 11,
                color: "var(--ink-tertiary)",
              }}
            >
              Inherited registries resolve from the parent group&apos;s records
              and link back to the parent profile.
            </p>
          ) : null}
        </section>
      ) : null}

      {payload.certifications.length > 0 ? (
        <section className="proto-card hoverable">
          <header className="proto-card-head">
            <h2 className="proto-card-title">Certifications</h2>
            <span className="proto-card-meta">
              {countActiveCerts(payload.certifications)} active ·{" "}
              {countExpiringCerts(payload.certifications)} expiring
            </span>
          </header>
          <div className="cert-list">
            {payload.certifications.map((c, i) => (
              <CertRow key={i} cert={c} />
            ))}
          </div>
        </section>
      ) : null}

      {payload.rsc_remediation ? (
        <RscCard rsc={payload.rsc_remediation} />
      ) : null}

      {payload.sanctions.length > 0 ? (
        <SanctionsHitsCard hits={payload.sanctions} />
      ) : (
        <SanctionsClearCard />
      )}

      {payload.brand_attributions.length > 0 ? (
        <section className="proto-card hoverable">
          <header className="proto-card-head">
            <h2 className="proto-card-title">Brand attribution</h2>
            <span className="proto-card-meta">
              {payload.brand_attributions.length} brand
              {payload.brand_attributions.length === 1 ? "" : "s"} disclosed
            </span>
          </header>
          <div className="pill-row">
            {payload.brand_attributions.map((b, i) => (
              <BrandChip key={i} brand={b} />
            ))}
          </div>
          <p
            style={{
              margin: "14px 0 0",
              fontSize: 11,
              color: "var(--ink-tertiary)",
            }}
          >
            Each chip traces to the brand&apos;s own published supplier
            disclosure. Full sources on the Brand attribution tab.
          </p>
        </section>
      ) : null}

      {payload.documents.length > 0 ? (
        <section className="proto-card span2">
          <header className="proto-card-head">
            <h2 className="proto-card-title">Compliance documents</h2>
            <span className="proto-card-meta">
              {payload.documents.length} mirrored
            </span>
          </header>
          <div className="docs-list">
            {payload.documents.map((d, i) => (
              <DocRow key={i} doc={d} />
            ))}
          </div>
          <p
            style={{
              margin: "14px 0 0",
              fontSize: 11,
              color: "var(--ink-tertiary)",
            }}
          >
            Mirror copies served from SourceBD&apos;s CDN for stable archival.
            Originals link back to the issuing authority.
          </p>
        </section>
      ) : null}
    </div>
  );
}

// ---------- Registry / cert / RSC / sanctions / brand / doc rows ---------

function RegistryRow({ pill }: { pill: Pill }) {
  const inherited = pill.inherited_from != null;
  const logo = LOGO_BY_CODE[pill.source_code];
  const meta = inherited
    ? `Inherited via parent ${pill.inherited_from_name ?? ""}`.trim()
    : pill.label;
  const linkUrl =
    resolveRegistryUrl(pill.source_code, pill.value) ?? pill.source_url ?? null;
  return (
    <div className="registry-row">
      <div className="reg-logo">
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt={pill.source_code} />
        ) : (
          <span className="reg-mark">{pill.source_code}</span>
        )}
      </div>
      <div>
        <div className="reg-name">
          {sourceFullName(pill.source_code)}
          {pill.value ? <span className="ref">{pill.value}</span> : null}
        </div>
        <div className="reg-meta">{meta}</div>
      </div>
      <span className={`reg-status${inherited ? " inherited" : ""}`}>
        {inherited ? "↳ Inherited" : "Active"}
      </span>
      {linkUrl ? (
        <a
          className="reg-action"
          href={linkUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          Look up ↗
        </a>
      ) : (
        <span style={{ width: 1 }} />
      )}
    </div>
  );
}

function CertRow({ cert }: { cert: Cert }) {
  const logo = LOGO_BY_CERT[cert.kind];
  const status = certStatus(cert);
  const linkUrl = resolveCertificateUrl(
    cert.kind,
    cert.certificate_no,
    cert.document_url,
  );
  return (
    <div className="cert">
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="auth-logo-color" src={logo} alt={certLabel(cert.kind)} />
      ) : (
        <span className="issuer-mark">
          {certLabel(cert.kind).slice(0, 3).toUpperCase()}
        </span>
      )}
      <div className="cert-main">
        <p className="cert-name">{certLongName(cert.kind)}</p>
        <p className="cert-meta">
          {[cert.certificate_no, cert.issuer]
            .filter(Boolean)
            .join(" · ") || "—"}
          {cert.expires_on && cert.kind !== "oeko_tex"
            ? ` · expires ${fmtDate(cert.expires_on)}`
            : ""}
        </p>
      </div>
      <span className={`cert-status ${status.tone}`}>{status.label}</span>
      {linkUrl ? (
        <a
          className="cert-view"
          href={linkUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          Verify ↗
        </a>
      ) : (
        <span />
      )}
    </div>
  );
}

function RscCard({ rsc }: { rsc: RscRemediation }) {
  const pct =
    rsc.progress_pct != null
      ? Math.max(0, Math.min(100, Number(rsc.progress_pct)))
      : null;
  return (
    <section className="proto-card hoverable">
      <header className="proto-card-head">
        <h2 className="proto-card-title">RSC remediation</h2>
        <span className="proto-card-meta">
          {pct != null ? `${pct.toFixed(0)}% complete` : "tracked"}
        </span>
      </header>
      <div className="rsc-stack">
        {pct != null ? (
          <>
            <div>
              <span className="rsc-headline">
                {pct.toFixed(0)}
                <span className="pct">%</span>
              </span>
              <span
                style={{
                  marginLeft: 8,
                  fontSize: 11,
                  color: "var(--ink-tertiary)",
                  fontFamily: "var(--font-mono)",
                }}
              >
                remediation completed
              </span>
            </div>
            <div className="rsc-bar-wrap">
              <div className="rsc-bar" style={{ width: `${pct}%` }} />
              <div
                className="rsc-tick"
                style={{ left: "95%" }}
                data-label="Industry median 95%"
              />
            </div>
            <div className="rsc-legend">
              <span>0%</span>
              <span>100%</span>
            </div>
          </>
        ) : null}
        {rsc.workers_count != null || rsc.remediation_status ? (
          <p
            style={{
              margin: "10px 0 0",
              fontSize: 11,
              color: "var(--ink-tertiary)",
              fontFamily: "var(--font-mono)",
            }}
          >
            {rsc.workers_count != null
              ? `${rsc.workers_count.toLocaleString()} workers`
              : ""}
            {rsc.workers_count != null && rsc.remediation_status
              ? " · "
              : ""}
            {rsc.remediation_status ?? ""}
          </p>
        ) : null}
      </div>
    </section>
  );
}

function SanctionsClearCard() {
  return (
    <section className="proto-card hoverable">
      <header className="proto-card-head">
        <h2 className="proto-card-title">Sanctions screening</h2>
        <span className="proto-card-meta">
          6 of 6 watchlists clear · re-screened weekly
        </span>
      </header>
      <div className="sanctions-clear">
        <svg
          className="ico"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M20 6L9 17l-5-5" />
        </svg>
        <div>
          <p className="sanctions-clear-title">
            No matches across any watchlist
          </p>
          <p className="sanctions-clear-body">
            Name + address + registry IDs cross-checked against the 6
            watchlists below.
          </p>
        </div>
        <span className="cert-status valid">Clear</span>
      </div>
      <div className="sanctions-grid">
        {SANCTIONS_TILES.map((t) => (
          <div key={t.acronym} className="sanctions-tile">
            <div className="tile-top">
              <span className="tile-juris">{t.juris}</span>
              <span className="tile-check">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={3.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  width={11}
                  height={11}
                  aria-hidden
                >
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </span>
            </div>
            <span className="tile-acronym">{t.acronym}</span>
            <span className="tile-auth">{t.auth}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function SanctionsHitsCard({ hits }: { hits: SanctionsHit[] }) {
  return (
    <section
      className="proto-card hoverable"
      style={{ borderColor: "var(--sem-red)" }}
    >
      <header className="proto-card-head">
        <h2 className="proto-card-title" style={{ color: "var(--sem-red)" }}>
          Sanctions matches
        </h2>
        <span className="proto-card-meta">{hits.length} active</span>
      </header>
      <ul className="m-0 flex list-none flex-col p-0">
        {hits.map((h, i) => (
          <li
            key={i}
            style={{
              padding: "12px 0",
              borderBottom: "1px solid var(--hairline)",
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span
                className="cert-status"
                style={{
                  background: "var(--sem-red-soft)",
                  color: "var(--sem-red)",
                }}
              >
                {h.list}
              </span>
              <span style={{ fontSize: 13, color: "var(--ink-primary)" }}>
                {h.matched_name}
              </span>
            </div>
            <div
              className="mono"
              style={{ fontSize: 11, color: "var(--ink-tertiary)" }}
            >
              {h.list_entry_ref ? `Ref: ${h.list_entry_ref} · ` : ""}
              Screened {fmtDate(h.screened_at)}
            </div>
            {h.source_url ? (
              <a
                href={h.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="cert-view"
              >
                View list entry ↗
              </a>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

function BrandChip({ brand }: { brand: BrandAttribution }) {
  const node = (
    <span
      className="brand-pill"
      title={`Disclosed on ${brand.display_name}'s published factory list (${fmtDate(brand.last_seen_at)})`}
    >
      {brand.display_name}
      <span className="ref">{fmtDate(brand.last_seen_at)}</span>
    </span>
  );
  if (!brand.source_url) return node;
  return (
    <a href={brand.source_url} target="_blank" rel="noopener noreferrer">
      {node}
    </a>
  );
}

function DocRow({ doc }: { doc: ComplianceDocument }) {
  return (
    <div className="doc-row">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        width={18}
        height={18}
        style={{ color: "var(--ink-tertiary)" }}
        aria-hidden
      >
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
      </svg>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span className="doc-type">{doc.doc_type}</span>
        <span className="doc-name">{DOC_TYPE_LONG[doc.doc_type]}</span>
      </div>
      <span className="doc-meta">
        {doc.file_size ? fmtBytes(doc.file_size) : ""}
      </span>
      {doc.mirror_url ? (
        <a
          className="doc-action"
          href={doc.mirror_url}
          target="_blank"
          rel="noopener noreferrer"
        >
          Mirror ↗
        </a>
      ) : (
        <span />
      )}
      <a
        className="doc-action secondary"
        href={doc.original_url}
        target="_blank"
        rel="noopener noreferrer"
      >
        Original ↗
      </a>
    </div>
  );
}

// ---------- Capacity / Brands / Contact / Provenance tabs ---------------

// Workforce sanity check — see I-008 / pickWorkforce in the (app) version.
function pickWorkforce(
  total: number | null,
  female: number | null,
  male: number | null,
): {
  total: number | null;
  femaleCount: number | null;
  maleCount: number | null;
  femalePct: number | null;
  showGenderSplit: boolean;
  note: string | null;
} {
  const t = total != null && total > 0 ? total : null;
  const f = female != null && female > 0 ? female : null;
  const m = male != null && male > 0 ? male : null;
  if (t == null && f == null && m == null)
    return { total: null, femaleCount: null, maleCount: null, femalePct: null, showGenderSplit: false, note: null };
  if (t != null && f != null && m != null) {
    const r = (f + m) / t;
    if (r < 0.9 || r > 1.1)
      return { total: t, femaleCount: null, maleCount: null, femalePct: null, showGenderSplit: false, note: "gender split unavailable" };
    return { total: t, femaleCount: f, maleCount: m, femalePct: Math.round((f / t) * 100), showGenderSplit: true, note: null };
  }
  if (t != null && f != null && m == null) {
    if (f > t) return { total: t, femaleCount: null, maleCount: null, femalePct: null, showGenderSplit: false, note: "gender split unavailable" };
    return { total: t, femaleCount: f, maleCount: t - f > 0 ? t - f : null, femalePct: Math.round((f / t) * 100), showGenderSplit: true, note: null };
  }
  if (t != null && m != null && f == null) {
    if (m > t) return { total: t, femaleCount: null, maleCount: null, femalePct: null, showGenderSplit: false, note: "gender split unavailable" };
    return { total: t, femaleCount: t - m > 0 ? t - m : null, maleCount: m, femalePct: t > 0 ? Math.round(((t - m) / t) * 100) : null, showGenderSplit: true, note: null };
  }
  if (t == null && f != null && m != null) {
    const inf = f + m;
    return { total: inf, femaleCount: f, maleCount: m, femalePct: Math.round((f / inf) * 100), showGenderSplit: true, note: "total inferred" };
  }
  return { total: t, femaleCount: null, maleCount: null, femalePct: null, showGenderSplit: false, note: null };
}

function CapacityTab({ supplier: s }: { supplier: Supplier }) {
  const wf = pickWorkforce(s.employees_total, s.employees_female, s.employees_male);
  return (
    <div className="proto-grid">
      <section className="proto-card hoverable span2">
        <header className="proto-card-head">
          <h2 className="proto-card-title">Workforce</h2>
          <span className="proto-card-meta">
            {wf.note ? wf.note : "self-disclosed"}
          </span>
        </header>
        {wf.total == null ? (
          <p style={{ margin: 0, fontSize: 13, color: "var(--ink-tertiary)" }}>
            Workforce data unavailable.
          </p>
        ) : (
          <div className="metric-grid">
            <Metric label="Total" value={wf.total.toLocaleString()} sub="workers + staff" />
            {wf.showGenderSplit && wf.femalePct != null ? (
              <Metric
                label="Female"
                value={`${wf.femalePct}%`}
                sub={wf.femaleCount != null ? `${wf.femaleCount.toLocaleString()} workers` : undefined}
              />
            ) : null}
            {wf.showGenderSplit && wf.maleCount != null ? (
              <Metric label="Male" value={wf.maleCount.toLocaleString()} sub="workers + staff" />
            ) : null}
          </div>
        )}
      </section>

      {(s.machines_sewing != null ||
        s.production_capacity_pcs_day != null ||
        s.production_capacity_dozen_yearly != null) && (
        <section className="proto-card hoverable">
          <header className="proto-card-head">
            <h2 className="proto-card-title">Lines &amp; output</h2>
          </header>
          <div className="metric-grid">
            {s.machines_sewing != null ? (
              <Metric
                label="Sewing m/c"
                value={s.machines_sewing.toLocaleString()}
              />
            ) : null}
            {s.production_capacity_pcs_day != null ? (
              <Metric
                label="Per day"
                value={s.production_capacity_pcs_day.toLocaleString()}
                sub="pcs"
              />
            ) : null}
            {s.production_capacity_dozen_yearly != null ? (
              <Metric
                label="Per year"
                value={s.production_capacity_dozen_yearly.toLocaleString()}
                sub="dozen"
              />
            ) : null}
          </div>
        </section>
      )}

      {s.bepza_zone || s.factory_types.length > 0 ? (
        <section className="proto-card hoverable">
          <header className="proto-card-head">
            <h2 className="proto-card-title">Site</h2>
          </header>
          <dl
            className="header-meta-row"
            style={{
              border: "none",
              padding: 0,
              margin: 0,
              gridTemplateColumns: "1fr 1fr",
            }}
          >
            {s.bepza_zone ? (
              <div>
                <dt>EPZ</dt>
                <dd>{s.bepza_zone}</dd>
              </div>
            ) : null}
            {s.factory_types.length > 0 ? (
              <div>
                <dt>Type</dt>
                <dd>{s.factory_types.slice(0, 3).join(", ")}</dd>
              </div>
            ) : null}
          </dl>
        </section>
      ) : null}
    </div>
  );
}

function Metric({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="metric">
      <p className="metric-label">{label}</p>
      <div className="metric-val">{value}</div>
      {sub ? <p className="metric-sub">{sub}</p> : null}
    </div>
  );
}

function BrandsTab({ brands }: { brands: BrandAttribution[] }) {
  return (
    <section className="proto-card span2">
      <header className="proto-card-head">
        <h2 className="proto-card-title">
          Brand attribution — full history
        </h2>
        <span className="proto-card-meta">
          {brands.length} brand{brands.length === 1 ? "" : "s"} ·
          per-factory authenticity
        </span>
      </header>
      <div className="brand-list">
        {brands.map((b, i) => (
          <div key={i} className="brand-row">
            <div className="brand-id">
              <div className="brand-mark">
                {b.display_name.slice(0, 2).toUpperCase()}
              </div>
              <div className="brand-text">
                <span className="brand-name">{b.display_name}</span>
                <span className="brand-since">
                  last seen {fmtDate(b.last_seen_at)}
                </span>
              </div>
            </div>
            <p className="brand-desc">
              Named on{" "}
              <strong>{b.display_name}&apos;s published BD supplier list</strong>
              . Disclosure does not imply endorsement.
            </p>
            <span className="brand-meta">{fmtDate(b.last_seen_at)}</span>
            <div className="brand-actions">
              {b.source_url ? (
                <a
                  className="doc-action"
                  href={b.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Brand source ↗
                </a>
              ) : null}
            </div>
          </div>
        ))}
      </div>
      <p
        style={{
          margin: "14px 0 0",
          fontSize: 11,
          color: "var(--ink-tertiary)",
        }}
      >
        Per-factory authenticity rule: a brand attribution attaches only when
        the brand&apos;s own publication names this specific factory.
      </p>
    </section>
  );
}

function ContactTab({
  nextPath,
  disabled,
}: {
  nextPath: string;
  disabled: boolean;
}) {
  return (
    <section className="proto-card">
      <header className="proto-card-head">
        <h2 className="proto-card-title">Contact</h2>
        <span className="proto-card-meta">
          {disabled
            ? "Contact disabled — sanctions flag active"
            : "Sign up free to unlock"}
        </span>
      </header>
      <dl className="contact-list">
        <dt>Phone</dt>
        <dd className="masked">+880-2-XXXXXXXX</dd>
        <dt>Email</dt>
        <dd className="masked">XXXXXX@XXXXX.com</dd>
        <dt>Website</dt>
        <dd className="masked">XXXXXX.com</dd>
        <dt>Contact</dt>
        <dd className="masked">Mr. XXXXXX XXXXXX</dd>
      </dl>
      <div className="gated-cta">
        <p className="gated-cta-title">
          {disabled
            ? "Contact disabled while a sanctions flag is active"
            : "Sign up free to view verified contacts"}
        </p>
        <p className="gated-cta-body">
          {disabled
            ? "We render the profile so you can do diligence on the hit. Direct contact is held back until the listing clears."
            : "Direct-dial phone, decision-maker email, and principal contact name + title for every supplier. Server-enforced; we never ship masked PII to the browser."}
        </p>
        {disabled ? null : (
          <Link
            className="btn-proto primary"
            href={`/signup?next=${encodeURIComponent(nextPath)}`}
          >
            Sign up free →
          </Link>
        )}
      </div>
    </section>
  );
}

function ProvenanceTab({ provenance }: { provenance: Provenance[] }) {
  const distinct = new Set(provenance.map((p) => p.source_code)).size;
  return (
    <section className="proto-card span2" id="provenance">
      <header className="proto-card-head">
        <h2 className="proto-card-title">
          Source records — full timeline
        </h2>
        <span className="proto-card-meta">
          {provenance.length} records · {distinct} sources
        </span>
      </header>
      <div className="prov-list">
        {provenance.map((p, i) => (
          <div key={i} className="prov-row">
            <span className="prov-source">{p.source_code}</span>
            <span>{p.display_name}</span>
            <span className="prov-ref">{p.source_ref ?? ""}</span>
            <span className="prov-seen">
              last seen {fmtDate(p.last_seen_at)}
            </span>
            <span className={`tier-badge ${tierShort(p.tier)}`}>
              {tierShort(p.tier).toUpperCase()}
            </span>
          </div>
        ))}
      </div>
      <SourcesExplainer variant="footer" />
    </section>
  );
}

// ---------- maps + helpers ------------------------------------------------

// Registry / membership source codes emitted by `v_supplier_registry_ids`.
// The view also unions in the typed certifications table (cert kind upcased
// as `source_code`), so the UI filters those out and renders them under the
// Certifications card instead.
const REGISTRY_CODES: ReadonlySet<string> = new Set([
  "BGMEA",
  "BKMEA",
  "BTMA",
  "BGAPMEA",
  "RSC",
  "EPB",
]);

const LOGO_BY_CODE: Record<string, string> = {
  BGMEA: "https://sourcebd-docs.b-cdn.net/inapp-logos/bgmea.png",
  BKMEA: "https://sourcebd-docs.b-cdn.net/inapp-logos/bkmea.png",
  BTMA: "https://sourcebd-docs.b-cdn.net/inapp-logos/BTMA.webp",
  RSC: "https://sourcebd-docs.b-cdn.net/inapp-logos/RSC.png",
};

const LOGO_BY_CERT: Record<string, string> = {
  wrap: "https://sourcebd-docs.b-cdn.net/inapp-logos/wrap.png",
  oeko_tex: "https://sourcebd-docs.b-cdn.net/inapp-logos/okeo100.png",
  gots: "https://sourcebd-docs.b-cdn.net/inapp-logos/gost.png",
  grs: "https://sourcebd-docs.b-cdn.net/inapp-logos/GRS.png",
  rcs: "https://sourcebd-docs.b-cdn.net/inapp-logos/RCS.png",
  ocs: "https://sourcebd-docs.b-cdn.net/inapp-logos/OCS.png",
};

const SOURCE_NAMES: Record<string, string> = {
  BGMEA: "BGMEA",
  BKMEA: "BKMEA",
  BTMA: "BTMA",
  BGAPMEA: "BGAPMEA",
  EPB: "Export Promotion Bureau",
  RJSC: "RJSC",
  BIN: "BIN",
  RSC: "RMG Sustainability Council",
  BEPZA: "BEPZA",
  DIFE: "DIFE",
};
function sourceFullName(code: string): string {
  return SOURCE_NAMES[code] ?? code;
}

const CERT_LABELS: Record<string, string> = {
  wrap: "WRAP",
  oeko_tex: "OEKO-TEX®",
  gots: "GOTS",
  sa8000: "SA8000",
  grs: "GRS",
  rcs: "RCS",
  ocs: "OCS",
  bci: "BCI",
  fairtrade: "Fairtrade",
  iso9001: "ISO 9001",
  iso14001: "ISO 14001",
  iso45001: "ISO 45001",
  sedex_smeta: "SMETA",
  bsci: "BSCI",
  other: "Other",
};
const CERT_LONG: Record<string, string> = {
  wrap: "WRAP — Worldwide Responsible Accredited Production",
  oeko_tex: "OEKO-TEX® STANDARD 100",
  gots: "GOTS — Global Organic Textile Standard",
  sa8000: "SA8000 — Social Accountability",
  grs: "GRS — Global Recycled Standard",
  rcs: "RCS — Recycled Claim Standard",
  ocs: "OCS — Organic Content Standard",
};
function certLabel(kind: string): string {
  return CERT_LABELS[kind] ?? kind.toUpperCase();
}
function certLongName(kind: string): string {
  return CERT_LONG[kind] ?? certLabel(kind);
}

function certStatus(c: Cert): {
  label: string;
  tone: "valid" | "expiring" | "expired" | "evergreen";
} {
  if (c.kind === "oeko_tex") return { label: "Evergreen", tone: "evergreen" };
  if (!c.expires_on) return { label: "expiry n/a", tone: "evergreen" };
  const now = Date.now();
  const exp = new Date(c.expires_on).getTime();
  if (Number.isNaN(exp)) return { label: "expiry n/a", tone: "evergreen" };
  const daysLeft = Math.floor((exp - now) / (1000 * 60 * 60 * 24));
  if (daysLeft < 0)
    return { label: `Expired ${fmtDate(c.expires_on)}`, tone: "expired" };
  if (daysLeft < 90)
    return { label: `Expires in ${daysLeft} days`, tone: "expiring" };
  return { label: `Valid · ${daysLeft} days`, tone: "valid" };
}

const SANCTIONS_TILES = [
  { juris: "US", acronym: "UFLPA", auth: "CBP Entity List" },
  { juris: "US", acronym: "OFAC SDN", auth: "U.S. Treasury" },
  { juris: "UK", acronym: "OFSI", auth: "HM Treasury" },
  { juris: "EU", acronym: "EU FSF", auth: "European Commission" },
  { juris: "US", acronym: "CBP WRO", auth: "U.S. Customs" },
  { juris: "US", acronym: "DOL ILAB", auth: "U.S. Labor Dept." },
];

const DOC_TYPE_LONG: Record<ComplianceDocument["doc_type"], string> = {
  fire: "RSC fire-safety inspection report",
  structural: "RSC structural inspection report",
  electrical: "RSC electrical inspection report",
  boiler: "RSC boiler safety inspection",
  cap: "Corrective Action Plan",
};

function pillByCode(pills: Pill[], code: string): Pill | undefined {
  return pills.find((p) => p.source_code === code);
}
function countDirect(pills: Pill[]): number {
  return pills.filter((p) => p.inherited_from == null).length;
}
function countInherited(pills: Pill[]): number {
  return pills.filter((p) => p.inherited_from != null).length;
}
function countActiveCerts(certs: Cert[]): number {
  return certs.filter((c) => certStatus(c).tone !== "expired").length;
}
function countExpiringCerts(certs: Cert[]): number {
  return certs.filter((c) => certStatus(c).tone === "expiring").length;
}

function complianceCount(p: ProfilePayload): number {
  let n = 0;
  if (p.pills.length) n++;
  if (p.certifications.length) n++;
  if (p.rsc_remediation) n++;
  n++; // sanctions card always rendered
  if (p.brand_attributions.length) n++;
  if (p.documents.length) n++;
  return n;
}

function hasCapacity(s: Supplier): boolean {
  return (
    s.machines_sewing != null ||
    s.production_capacity_dozen_yearly != null ||
    s.production_capacity_pcs_day != null ||
    s.employees_total != null ||
    s.employees_male != null ||
    s.employees_female != null
  );
}

function entityLabel(e: Supplier["entity_type"]): string {
  if (e === "factory") return "Garment manufacturer";
  if (e === "buying_house") return "Buying house";
  return "Supplier";
}

function tierShort(tier: string): "t1" | "t2" | "t3" | "t4" {
  const t = tier.toLowerCase();
  if (t.includes("1") || t.includes("gov") || t.includes("regulator"))
    return "t1";
  if (t.includes("2") || t.includes("assoc")) return "t2";
  if (t.includes("3") || t.includes("cert")) return "t3";
  return "t4";
}

function yearsSince(dateStr: string): number {
  const t = new Date(dateStr).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.floor((Date.now() - t) / (365.25 * 24 * 3600 * 1000)));
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().slice(0, 10);
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
