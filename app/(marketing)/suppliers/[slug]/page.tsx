// Public supplier profile — anonymous, demo-mode (Spec M5).
//
// Calls the anon-granted `public.buyer_supplier_profile` RPC
// (migrations 0024 / 0034 / 0036) — same RPC the buyer surface uses.
// The RPC payload excludes the internal score and the four direct
// contact PII columns at the wire level by construction (Spec B2
// contract).
//
// Address-PII render gate (Spec M5 JC #12 (a)): the RPC's
// `addresses[]` rows DO carry `phone` and `email` (registry-published
// values, e.g. BGAPMEA). On this public surface those two fields are
// stripped at render time via an inline mapper; only
// `kind + address + source_code` is shown. A one-liner under the card
// reads "Phone & email — sign up free to view." so the omission is
// honest. The auth-gated `/app/suppliers/[slug]` is unchanged.
//
// No `SaveButton`, no `ClaimCtaButton`, no `Tabs` client island — this
// is a fully server-rendered demo for anonymous visitors and SEO.
//
// M4 JSON-LD baseline: `Organization` / `LocalBusiness` inline JSON-LD
// re-sourced from the RPC payload (not a second SELECT). `website` is
// not in the RPC payload so `sameAs` is omitted — accepted regression
// from M4 because the buyer profile already lives without `website`.

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DemoBanner } from "@/components/marketing/demo-banner";
import { ReceiptsRing } from "@/components/receipts-ring";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardMeta,
  CardTitle,
} from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://sourcebd.net";

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
  supplier_tagline: string | null;
  supplier_about: string | null;
  supplier_moq: string | null;
  supplier_lead_time_days: number | null;
  supplier_capabilities: string[];
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

type PartnerSupplier = {
  id: string;
  slug: string;
  company_name: string;
  entity_type: string;
  city: string | null;
  district: string | null;
  decided_at: string;
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
  partner_factories?: PartnerSupplier[];
  partner_buying_houses?: PartnerSupplier[];
};

// Inline render-time mapper — strips phone+email per M5 JC #12 (a).
// Local to this page file; not promoted to lib/.
function publicAddresses(rows: AddressRowRaw[]): PublicAddress[] {
  return rows.map((r) => ({
    kind: r.kind,
    address: r.address,
    source_code: r.source_code,
    fetched_at: r.fetched_at,
  }));
}

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
  if (error || data == null) notFound();
  const payload = data as ProfilePayload;
  const s = payload.supplier;

  const addresses = publicAddresses(payload.addresses ?? []);
  const partners =
    s.entity_type === "buying_house"
      ? payload.partner_factories ?? []
      : payload.partner_buying_houses ?? [];

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

  const nextPath = `/suppliers/${s.slug}`;
  const location =
    [s.city, s.district, s.country].filter((v) => v && v.trim()).join(", ") ||
    "Bangladesh";

  return (
    <>
      <DemoBanner next={nextPath} />
      <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 md:px-6">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }}
        />

        <Link
          href="/discover"
          className="text-xs uppercase tracking-wide text-ink-tertiary hover:text-ink-primary"
        >
          ← Discover
        </Link>

        <Card>
          <div className="flex flex-col gap-5 px-6 py-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <ReceiptsRing sources={payload.t13_source_count} size={64} />
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <h1 className="m-0 truncate font-display text-[28px] font-semibold leading-tight tracking-tight text-ink-primary md:text-[32px]">
                  {s.company_name}
                </h1>
                <div className="flex flex-wrap items-center gap-2 text-[13px] text-ink-secondary">
                  <Badge tone={s.entity_type === "factory" ? "active" : "neutral"}>
                    {entityLabel(s.entity_type)}
                  </Badge>
                  <span>·</span>
                  <span>{location}</span>
                  <span>·</span>
                  <span className="font-mono text-[12px] text-ink-tertiary">
                    Completeness {s.completeness_pct}%
                  </span>
                </div>
                {s.parent_group_name ? (
                  <div className="text-[13px] text-ink-secondary">
                    Part of{" "}
                    <span className="font-medium text-ink-primary">
                      {s.parent_group_name}
                    </span>
                  </div>
                ) : null}
                {s.supplier_tagline ? (
                  <p className="text-[14px] text-ink-secondary">
                    {s.supplier_tagline}
                  </p>
                ) : null}
              </div>
            </div>

            {payload.pills.length > 0 ? (
              <div className="border-t border-hairline pt-4">
                <PillRow pills={payload.pills} />
              </div>
            ) : null}

            {s.is_sanctioned ? (
              <div className="flex items-center gap-2 rounded-input border border-sem-red bg-sem-red-soft px-3 py-2 text-[13px] text-sem-red">
                <span aria-hidden>⚠</span>
                <span>
                  Listed on a sanctions / forced-labour list — see the
                  Sanctions section below for details.
                </span>
              </div>
            ) : null}
          </div>
        </Card>

        {payload.sanctions.length > 0 ? (
          <SanctionsCard hits={payload.sanctions} />
        ) : null}

        {s.supplier_about ? (
          <Card>
            <CardHeader>
              <CardTitle>About</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-line text-[14px] text-ink-secondary">
                {s.supplier_about}
              </p>
            </CardContent>
          </Card>
        ) : null}

        {payload.pills.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Registry pills</CardTitle>
              <CardMeta>{payload.pills.length} entries</CardMeta>
            </CardHeader>
            <CardContent>
              <PillRow pills={payload.pills} />
              {payload.pills.some((p) => p.inherited_from != null) ? (
                <p className="mt-3 text-[12px] text-ink-tertiary">
                  Dashed pills are inherited from a parent factory (RSC
                  sibling / extension rows).
                </p>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        {payload.certifications.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Certifications</CardTitle>
              <CardMeta>{payload.certifications.length} certs</CardMeta>
            </CardHeader>
            <CardContent>
              <ul className="m-0 flex list-none flex-col gap-3 p-0">
                {payload.certifications.map((c, i) => (
                  <li
                    key={i}
                    className="flex flex-col gap-1 border-b border-hairline pb-3 last:border-b-0 last:pb-0"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="neutral">{certLabel(c.kind)}</Badge>
                      {c.expires_on ? (
                        <span className="font-mono text-[11px] text-ink-tertiary">
                          expires {c.expires_on}
                        </span>
                      ) : null}
                      {c.certificate_no ? (
                        <span className="font-mono text-[12px] text-ink-tertiary">
                          {c.certificate_no}
                        </span>
                      ) : null}
                    </div>
                    {c.issuer ? (
                      <div className="text-[13px] text-ink-secondary">
                        Issuer: {c.issuer}
                      </div>
                    ) : null}
                    {c.scope ? (
                      <div className="text-[12px] text-ink-tertiary">
                        {c.scope}
                      </div>
                    ) : null}
                    {c.document_url ? (
                      <a
                        href={c.document_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[12px] font-medium text-accent-indigo hover:underline"
                      >
                        View certificate →
                      </a>
                    ) : null}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ) : null}

        {payload.rsc_remediation ? (
          <RscCard rsc={payload.rsc_remediation} />
        ) : null}

        {payload.brand_attributions.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Brand attribution</CardTitle>
              <CardMeta>{payload.brand_attributions.length} brands</CardMeta>
            </CardHeader>
            <CardContent>
              <p className="mb-3 text-[12px] text-ink-tertiary">
                Disclosed on each brand’s public factory list. Disclosure does
                not imply endorsement.
              </p>
              <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
                {payload.brand_attributions.map((b, i) => (
                  <li key={i}>
                    {b.source_url ? (
                      <a
                        href={b.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Tag tone="neutral">Disclosed on {b.display_name}</Tag>
                      </a>
                    ) : (
                      <Tag tone="neutral">Disclosed on {b.display_name}</Tag>
                    )}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 gap-3 text-[13px] sm:grid-cols-2">
              {s.established_date ? (
                <Stat label="Established" value={s.established_date} />
              ) : null}
              {s.bepza_zone ? (
                <Stat label="BEPZA zone" value={s.bepza_zone} />
              ) : null}
              {s.employees_total != null ? (
                <Stat
                  label="Employees"
                  value={s.employees_total.toLocaleString()}
                />
              ) : null}
              {s.machines_sewing != null ? (
                <Stat
                  label="Sewing machines"
                  value={s.machines_sewing.toLocaleString()}
                />
              ) : null}
              {s.production_capacity_pcs_day != null ? (
                <Stat
                  label="Capacity"
                  value={`${s.production_capacity_pcs_day.toLocaleString()} pcs/day`}
                />
              ) : null}
              {s.production_capacity_dozen_yearly != null ? (
                <Stat
                  label="Annual capacity"
                  value={`${s.production_capacity_dozen_yearly.toLocaleString()} dozen/yr`}
                />
              ) : null}
              {s.supplier_moq ? (
                <Stat label="MOQ" value={s.supplier_moq} />
              ) : null}
              {s.supplier_lead_time_days != null ? (
                <Stat
                  label="Lead time"
                  value={`${s.supplier_lead_time_days} days`}
                />
              ) : null}
            </dl>
            {s.factory_types.length > 0 ? (
              <div className="mt-4">
                <div className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-tertiary">
                  Factory types
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {s.factory_types.map((t) => (
                    <Tag key={t} tone="neutral">
                      {t}
                    </Tag>
                  ))}
                </div>
              </div>
            ) : null}
            {s.principal_products.length > 0 ? (
              <div className="mt-4">
                <div className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-tertiary">
                  Principal products
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {s.principal_products.map((t) => (
                    <Tag key={t} tone="neutral">
                      {t}
                    </Tag>
                  ))}
                </div>
              </div>
            ) : null}
            {s.supplier_capabilities.length > 0 ? (
              <div className="mt-4">
                <div className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-tertiary">
                  Capabilities
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {s.supplier_capabilities.map((t) => (
                    <Tag key={t} tone="neutral">
                      {t}
                    </Tag>
                  ))}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        {addresses.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Addresses</CardTitle>
              <CardMeta>{addresses.length} on record</CardMeta>
            </CardHeader>
            <CardContent>
              <ul className="m-0 flex list-none flex-col gap-3 p-0">
                {addresses.map((a, i) => (
                  <li
                    key={i}
                    className="flex flex-col gap-1 border-b border-hairline pb-3 last:border-b-0 last:pb-0"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="neutral">{a.kind.replace(/_/g, " ")}</Badge>
                      <span className="font-mono text-[11px] text-ink-tertiary">
                        {a.source_code}
                      </span>
                    </div>
                    <p className="text-[13px] text-ink-secondary">
                      {a.address}
                    </p>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[12px] text-ink-tertiary">
                Phone &amp; email —{" "}
                <Link
                  href={`/signup?next=${encodeURIComponent(nextPath)}`}
                  className="font-medium text-accent-indigo hover:underline"
                >
                  sign up free to view
                </Link>
                .
              </p>
            </CardContent>
          </Card>
        ) : null}

        {payload.documents.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Compliance documents</CardTitle>
              <CardMeta>{payload.documents.length} files</CardMeta>
            </CardHeader>
            <CardContent>
              <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
                {payload.documents.map((d, i) => (
                  <li key={i}>
                    <a
                      href={d.mirror_url ?? d.original_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-pill border border-hairline-strong bg-surface-l1 px-3 py-1.5 text-[12px] font-medium text-ink-secondary hover:text-accent-indigo"
                    >
                      📄 {d.doc_type}
                    </a>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ) : null}

        {partners.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>
                {s.entity_type === "buying_house"
                  ? "Partner factories"
                  : "Partner buying houses"}
              </CardTitle>
              <CardMeta>{partners.length}</CardMeta>
            </CardHeader>
            <CardContent>
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {partners.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/suppliers/${p.slug}`}
                      className="flex items-center justify-between rounded-input border border-hairline px-3 py-2 text-[13px] hover:border-hairline-strong"
                    >
                      <span className="font-medium text-ink-primary">
                        {p.company_name}
                      </span>
                      <span className="text-[12px] text-ink-tertiary">
                        {[p.city, p.district].filter(Boolean).join(", ") ||
                          "—"}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ) : null}

        {payload.provenance.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Provenance</CardTitle>
              <CardMeta>
                Receipts: {payload.provenance.length} records across{" "}
                {distinctSources(payload.provenance)} sources
              </CardMeta>
            </CardHeader>
            <CardContent>
              <details className="text-[13px] text-ink-secondary">
                <summary className="cursor-pointer text-[12px] font-medium text-ink-tertiary">
                  Show all source records
                </summary>
                <ul className="mt-3 flex list-none flex-col gap-2 p-0">
                  {payload.provenance.map((p, i) => (
                    <li
                      key={i}
                      className="flex flex-wrap items-center gap-2 border-b border-hairline pb-2 last:border-b-0"
                    >
                      <Badge tone="neutral">{tierLabel(p.tier)}</Badge>
                      <span className="font-mono text-[12px] text-ink-primary">
                        {p.source_code}
                      </span>
                      {p.source_ref ? (
                        <span className="font-mono text-[11px] text-ink-tertiary">
                          {p.source_ref}
                        </span>
                      ) : null}
                      <span className="text-[12px] text-ink-tertiary">
                        last seen {fmtDate(p.last_seen_at)}
                      </span>
                      {p.source_url ? (
                        <a
                          href={p.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[12px] text-accent-indigo hover:underline"
                        >
                          source
                        </a>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </details>
            </CardContent>
          </Card>
        ) : null}

        <Card className="border-accent-indigo/40 bg-brand-forest-tint">
          <CardContent className="flex flex-col items-start gap-3 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-display text-lg font-semibold text-ink-primary">
                Want to message {s.company_name}?
              </h2>
              <p className="text-[13px] text-ink-secondary">
                Sign up free to unlock contacts, saved suppliers, RFQs, and
                Smart Match.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button asChild variant="primary" size="sm">
                <Link href={`/signup?next=${encodeURIComponent(nextPath)}`}>
                  Sign up free
                </Link>
              </Button>
              <Button asChild variant="ghost" size="sm">
                <Link href={`/login?next=${encodeURIComponent(nextPath)}`}>
                  Sign in
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </>
  );
}

function PillRow({ pills }: { pills: Pill[] }) {
  return (
    <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
      {pills.map((p, i) => {
        const inherited = p.inherited_from != null;
        const label = pillText(p);
        const title = inherited
          ? `via ${p.inherited_from_name ?? "parent factory"}`
          : p.source_url ?? undefined;
        const className =
          "inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-1 text-[12px] font-medium " +
          (inherited
            ? "border-dashed border-hairline-strong bg-transparent text-ink-tertiary"
            : "border-hairline-strong bg-surface-l1 text-ink-secondary");
        const dot = (
          <span
            aria-hidden
            className={
              "inline-block h-1.5 w-1.5 rounded-full " +
              (inherited ? "bg-ink-tertiary/50" : "bg-accent-indigo")
            }
          />
        );
        return (
          <li key={`${p.source_code}-${p.value ?? "x"}-${i}`}>
            {p.source_url ? (
              <a
                href={p.source_url}
                target="_blank"
                rel="noopener noreferrer"
                title={title}
                className={className}
              >
                {dot}
                {label}
              </a>
            ) : (
              <span className={className} title={title}>
                {dot}
                {label}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function pillText(p: Pill): string {
  const base = p.value ? `${p.source_code} ${p.value}` : p.source_code;
  return p.inherited_from ? `${base} (parent)` : base;
}

function SanctionsCard({ hits }: { hits: SanctionsHit[] }) {
  return (
    <Card className="border-sem-red">
      <CardHeader>
        <CardTitle className="text-sem-red">Sanctions hits</CardTitle>
        <CardMeta>{hits.length} active</CardMeta>
      </CardHeader>
      <CardContent>
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {hits.map((h, i) => (
            <li
              key={i}
              className="flex flex-col gap-1 border-b border-hairline pb-2 last:border-b-0 last:pb-0"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="alert">{h.list}</Badge>
                <span className="text-[13px] text-ink-primary">
                  {h.matched_name}
                </span>
              </div>
              <div className="text-[12px] text-ink-tertiary">
                {h.list_entry_ref ? `Ref: ${h.list_entry_ref}` : null}
                {h.listed_date ? ` · Listed ${fmtDate(h.listed_date)}` : null}
                {` · Screened ${fmtDate(h.screened_at)}`}
              </div>
              {h.source_url ? (
                <a
                  href={h.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[12px] font-medium text-accent-indigo hover:underline"
                >
                  View list entry →
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function RscCard({ rsc }: { rsc: RscRemediation }) {
  const pct =
    rsc.progress_pct != null
      ? Math.max(0, Math.min(100, Number(rsc.progress_pct)))
      : null;
  const docs: Array<{ label: string; url: string | null }> = [
    { label: "Fire", url: rsc.fire_inspection_url },
    { label: "Structural", url: rsc.structural_inspection_url },
    { label: "Electrical", url: rsc.electrical_inspection_url },
    { label: "Boiler", url: rsc.boiler_inspection_url },
    { label: "CAP", url: rsc.cap_url },
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle>RSC remediation</CardTitle>
        {pct != null ? <CardMeta>{pct.toFixed(0)}% complete</CardMeta> : null}
      </CardHeader>
      <CardContent>
        {pct != null ? (
          <div className="mb-4">
            <div
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="RSC remediation progress"
              className="relative h-2 w-full overflow-hidden rounded-pill bg-surface-l2"
            >
              <div
                className="absolute inset-y-0 left-0 bg-sem-green"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="mt-1 flex justify-between text-[11px] text-ink-tertiary">
              <span>{pct.toFixed(1)}%</span>
              <span>industry median 95%</span>
            </div>
          </div>
        ) : null}
        <dl className="grid grid-cols-1 gap-3 text-[13px] sm:grid-cols-2">
          {rsc.workers_count != null ? (
            <Stat label="Workers" value={rsc.workers_count.toLocaleString()} />
          ) : null}
          {rsc.remediation_status ? (
            <Stat label="Remediation status" value={rsc.remediation_status} />
          ) : null}
          {rsc.training_status ? (
            <Stat label="Training status" value={rsc.training_status} />
          ) : null}
        </dl>
        <ul className="m-0 mt-4 flex list-none flex-wrap gap-2 p-0">
          {docs.map((d) =>
            d.url ? (
              <li key={d.label}>
                <a
                  href={d.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-pill border border-hairline-strong bg-surface-l1 px-3 py-1.5 text-[12px] font-medium text-ink-secondary hover:text-accent-indigo"
                >
                  📄 {d.label}
                </a>
              </li>
            ) : null,
          )}
        </ul>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-tertiary">
        {label}
      </dt>
      <dd className="m-0 text-ink-primary">{value}</dd>
    </div>
  );
}

function entityLabel(e: Supplier["entity_type"]): string {
  switch (e) {
    case "factory":
      return "Factory";
    case "buying_house":
      return "Buying house";
    default:
      return "Unknown";
  }
}

function certLabel(kind: string): string {
  switch (kind) {
    case "wrap":
      return "WRAP";
    case "oeko_tex":
      return "OEKO-TEX";
    case "gots":
      return "GOTS";
    case "sa8000":
      return "SA8000";
    default:
      return kind.toUpperCase();
  }
}

function tierLabel(tier: string): string {
  switch (tier) {
    case "tier1_gov":
      return "Tier 1 · Gov";
    case "tier2_industry":
      return "Tier 2 · Industry";
    case "tier3_cert":
      return "Tier 3 · Cert";
    case "tier4_brand":
      return "Tier 4 · Brand";
    case "tier5_regulatory":
      return "Tier 5 · Reg";
    case "tier6_crosscheck":
      return "Tier 6 · X-check";
    default:
      return tier;
  }
}

function distinctSources(rows: Provenance[]): number {
  const set = new Set<string>();
  for (const r of rows) set.add(r.source_code);
  return set.size;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toISOString().slice(0, 10);
  } catch {
    return iso;
  }
}
