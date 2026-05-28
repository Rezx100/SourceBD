// Spec B2 — buyer Factory profile (authenticated, /app/suppliers/[slug]).
//
// Distinct from the public anonymous `(marketing)/suppliers/[slug]` route
// (F3 exit gate) — that one shows blurred contacts to anonymous visitors and
// SELECTs a minimal whitelist directly. This route is gated behind the
// `(app)/app/*` middleware, calls the `public.buyer_supplier_profile` RPC
// (migration 0024), and renders the canonical profile anatomy in
// `context/frontend-design-spec.md` §4: header + 5 tabs
// (Compliance default / Overview / Capacity / Documents / Contact-gated).
//
// SBI hard contract (ai-workflow-rules.md, frontend-design-spec.md §0):
//   * The RPC does NOT join `sbi_scores` at all (the profile has no
//     ordering). Nothing on this page selects, derives, or renders any
//     `sbi_scores.*` value.
//   * Receipts Ring centre = `t13_source_count` (distinct Tier 1–3 sources),
//     never the SBI numeric.
//
// Contact PII hard contract (code-standards.md, §0):
//   * Contact fields (`email_primary`, `phones`, `contact_name`,
//     `contact_role`, `website`) are excluded from the RPC's RETURNS — they
//     never leave the database for this surface. The Contact tab renders a
//     gated empty-state linking to `/pricing`. There is no payload to
//     un-blur in the browser.
//
// `phases.md` line 60 lists "Overview, Compliance, Media, Reviews, Contact".
// "Media" maps to the Documents tab per §4.6. "Reviews" is explicitly
// out of scope per §4.2 ("No review table exists; do not stub a UI for it").
//
// Spec B3 (buying-house variant) shares this route and RPC per §3 IA table
// (option (a)). When `entity_type === 'buying_house'` an extra Partner
// Factories tab is rendered with a static empty state — `bh_factory_relationships`
// does not exist in the DB yet (§4.8); reserving the slot is the spec.

import Link from "next/link";
import { notFound } from "next/navigation";

import { ReceiptsRing } from "@/components/receipts-ring";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardMeta, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tag } from "@/components/ui/tag";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

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

type AddressRow = {
  kind: string;
  address: string;
  phone: string | null;
  email: string | null;
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
  addresses: AddressRow[];
  documents: ComplianceDocument[];
};

// ---------- entry --------------------------------------------------------

export default async function FactoryProfilePage({
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
    notFound();
  }

  const payload = data as ProfilePayload;
  const s = payload.supplier;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 md:px-6">
      <ProfileHeader payload={payload} />
      <Tabs defaultValue="compliance" className="flex flex-col gap-4">
        <TabsList aria-label="Profile sections">
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          {hasCapacity(s) ? (
            <TabsTrigger value="capacity">Capacity</TabsTrigger>
          ) : null}
          {payload.documents.length > 0 ? (
            <TabsTrigger value="documents">Documents</TabsTrigger>
          ) : null}
          {s.entity_type === "buying_house" ? (
            <TabsTrigger value="partners">Partner factories</TabsTrigger>
          ) : null}
          <TabsTrigger value="contact">Contact</TabsTrigger>
        </TabsList>
        <TabsContent value="compliance">
          <ComplianceTab payload={payload} />
        </TabsContent>
        <TabsContent value="overview">
          <OverviewTab payload={payload} />
        </TabsContent>
        {hasCapacity(s) ? (
          <TabsContent value="capacity">
            <CapacityTab supplier={s} />
          </TabsContent>
        ) : null}
        {payload.documents.length > 0 ? (
          <TabsContent value="documents">
            <DocumentsTab documents={payload.documents} />
          </TabsContent>
        ) : null}
        {s.entity_type === "buying_house" ? (
          <TabsContent value="partners">
            <PartnerFactoriesTab />
          </TabsContent>
        ) : null}
        <TabsContent value="contact">
          <ContactTab slug={s.slug} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---------- header --------------------------------------------------------

function ProfileHeader({ payload }: { payload: ProfilePayload }) {
  const s = payload.supplier;
  const location =
    [s.city, s.district].filter((v) => v && v.trim()).join(", ") || "Unknown";
  return (
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
                <Link
                  href={`/app/discover?group=${encodeURIComponent(s.parent_group_name)}`}
                  className="font-medium text-accent-indigo hover:underline"
                >
                  {s.parent_group_name}
                </Link>
              </div>
            ) : null}
          </div>
        </div>

        {payload.pills.length > 0 ? (
          <div className="border-t border-hairline pt-4">
            <PillRow pills={payload.pills} compact />
          </div>
        ) : null}

        {s.is_sanctioned ? (
          <div
            role="alert"
            className="flex items-center gap-2 rounded-input border border-sem-red bg-sem-red-soft px-3 py-2 text-[13px] text-sem-red"
          >
            <span aria-hidden>⚠</span>
            <span>
              Listed on a sanctions / forced-labour list — see{" "}
              <a href="#compliance" className="underline">
                Compliance
              </a>{" "}
              tab for details.
            </span>
          </div>
        ) : null}
      </div>
    </Card>
  );
}

function PillRow({ pills, compact }: { pills: Pill[]; compact?: boolean }) {
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
            : "border-hairline-strong bg-surface-l1 text-ink-secondary") +
          (compact ? "" : " px-3 py-1.5 text-[13px]");
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

// ---------- Compliance tab -------------------------------------------------

function ComplianceTab({ payload }: { payload: ProfilePayload }) {
  return (
    <div id="compliance" className="flex flex-col gap-4">
      {payload.sanctions.length > 0 ? (
        <SanctionsCard hits={payload.sanctions} />
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
                Dashed pills are inherited from a parent factory (RSC sibling /
                extension rows, migration 0021).
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
                <li key={i} className="flex flex-col gap-1 border-b border-hairline pb-3 last:border-b-0 last:pb-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="neutral">{certLabel(c.kind)}</Badge>
                    <ExpiryChip kind={c.kind} expiresOn={c.expires_on} />
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
                    <div className="text-[12px] text-ink-tertiary">{c.scope}</div>
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

      {payload.rsc_remediation ? <RscCard rsc={payload.rsc_remediation} /> : null}

      {payload.brand_attributions.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Brand attribution</CardTitle>
            <CardMeta>{payload.brand_attributions.length} brands</CardMeta>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-[12px] text-ink-tertiary">
              Disclosed on each brand’s public factory list. Disclosure does not
              imply endorsement.
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
    </div>
  );
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
  const docs: Array<{ label: string; url: string | null; available: boolean }> = [
    { label: "Fire", url: rsc.fire_inspection_url, available: rsc.fire_inspection_url != null },
    { label: "Structural", url: rsc.structural_inspection_url, available: rsc.structural_inspection_url != null },
    { label: "Electrical", url: rsc.electrical_inspection_url, available: rsc.electrical_inspection_url != null },
    { label: "Boiler", url: rsc.boiler_inspection_url, available: rsc.boiler_inspection_url != null },
    { label: "CAP", url: rsc.cap_url, available: rsc.cap_url != null },
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
              <div
                aria-hidden
                className="absolute inset-y-0 w-px bg-ink-tertiary/40"
                style={{ left: "95%" }}
                title="Industry median 95%"
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
          {rsc.parent_group_factory_count != null ? (
            <Stat
              label="Group factories"
              value={String(rsc.parent_group_factory_count)}
            />
          ) : null}
        </dl>
        <ul className="m-0 mt-4 flex list-none flex-wrap gap-2 p-0">
          {docs.map((d) =>
            d.available ? (
              <li key={d.label}>
                <a
                  href={d.url!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-pill border border-hairline-strong bg-surface-l1 px-3 py-1.5 text-[12px] font-medium text-ink-secondary hover:text-accent-indigo"
                >
                  📄 {d.label}
                </a>
              </li>
            ) : d.label === "Boiler" ? (
              <li key={d.label}>
                <Tag tone="muted">Boiler n/a</Tag>
              </li>
            ) : null,
          )}
        </ul>
      </CardContent>
    </Card>
  );
}

// ---------- Overview tab ---------------------------------------------------

function OverviewTab({ payload }: { payload: ProfilePayload }) {
  const s = payload.supplier;
  const primaryAddress =
    s.address_raw ?? payload.addresses[0]?.address ?? null;
  const otherAddressCount = Math.max(0, payload.addresses.length - 1);

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {primaryAddress ? (
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Address</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="m-0 text-[14px] text-ink-primary">{primaryAddress}</p>
            {otherAddressCount > 0 ? (
              <details className="mt-3">
                <summary className="cursor-pointer text-[12px] font-medium text-ink-tertiary">
                  + {otherAddressCount} other address
                  {otherAddressCount === 1 ? "" : "es"} on file
                </summary>
                <ul className="mt-2 flex list-none flex-col gap-2 p-0 text-[13px] text-ink-secondary">
                  {payload.addresses.slice(1).map((a, i) => (
                    <li key={i} className="border-b border-hairline pb-2 last:border-b-0">
                      <div className="flex items-center gap-2">
                        <Tag tone="neutral">{a.kind}</Tag>
                        <span className="font-mono text-[11px] text-ink-tertiary">
                          {a.source_code}
                        </span>
                      </div>
                      <div>{a.address}</div>
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {s.established_date ? (
        <Card>
          <CardHeader>
            <CardTitle>Established</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="m-0 text-[14px] text-ink-primary">{s.established_date}</p>
          </CardContent>
        </Card>
      ) : null}

      {s.factory_types.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Factory types</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
              {s.factory_types.slice(0, 4).map((t) => (
                <li key={t}>
                  <Tag tone="neutral">{t}</Tag>
                </li>
              ))}
              {s.factory_types.length > 4 ? (
                <li>
                  <Tag tone="muted">+{s.factory_types.length - 4} more</Tag>
                </li>
              ) : null}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {s.principal_products.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Principal products</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
              {s.principal_products.slice(0, 4).map((t) => (
                <li key={t}>
                  <Tag tone="neutral">{t}</Tag>
                </li>
              ))}
              {s.principal_products.length > 4 ? (
                <li>
                  <Tag tone="muted">+{s.principal_products.length - 4} more</Tag>
                </li>
              ) : null}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {s.bepza_zone ? (
        <Card>
          <CardHeader>
            <CardTitle>BEPZA zone</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="m-0 text-[14px] text-ink-primary">{s.bepza_zone}</p>
          </CardContent>
        </Card>
      ) : null}

      {s.parent_group_name ? (
        <Card>
          <CardHeader>
            <CardTitle>Group</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="m-0 text-[14px] text-ink-primary">
              Part of{" "}
              <Link
                href={`/app/discover?group=${encodeURIComponent(s.parent_group_name)}`}
                className="font-medium text-accent-indigo hover:underline"
              >
                {s.parent_group_name}
              </Link>
            </p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

// ---------- Capacity tab ---------------------------------------------------

function CapacityTab({ supplier: s }: { supplier: Supplier }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {s.machines_sewing != null ? (
        <StatCard label="Sewing machines" value={s.machines_sewing.toLocaleString()} />
      ) : null}
      {s.production_capacity_dozen_yearly != null ? (
        <StatCard
          label="Production capacity"
          value={`${s.production_capacity_dozen_yearly.toLocaleString()} dozen / year`}
        />
      ) : null}
      {s.production_capacity_pcs_day != null ? (
        <StatCard
          label="Production capacity"
          value={`${s.production_capacity_pcs_day.toLocaleString()} pcs / day`}
        />
      ) : null}
      {s.employees_total != null ? (
        <StatCard
          label="Workforce"
          value={s.employees_total.toLocaleString()}
        />
      ) : null}
      {s.employees_male != null || s.employees_female != null ? (
        <StatCard
          label="Workforce split"
          value={`${s.employees_male?.toLocaleString() ?? "?"} M / ${s.employees_female?.toLocaleString() ?? "?"} F`}
        />
      ) : null}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent>
        <div className="font-mono text-[11px] uppercase tracking-wider text-ink-tertiary">
          {label}
        </div>
        <div className="mt-1 font-display text-[22px] font-semibold text-ink-primary">
          {value}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------- Documents tab --------------------------------------------------

function DocumentsTab({ documents }: { documents: ComplianceDocument[] }) {
  const grouped = new Map<string, ComplianceDocument[]>();
  for (const d of documents) {
    const arr = grouped.get(d.doc_type) ?? [];
    arr.push(d);
    grouped.set(d.doc_type, arr);
  }
  const order: ComplianceDocument["doc_type"][] = [
    "fire",
    "structural",
    "electrical",
    "boiler",
    "cap",
  ];
  return (
    <div className="flex flex-col gap-4">
      {order
        .filter((k) => grouped.has(k))
        .map((k) => {
          const rows = grouped.get(k)!;
          return (
            <Card key={k}>
              <CardHeader>
                <CardTitle>{docTypeLabel(k)}</CardTitle>
                <CardMeta>
                  {rows.length} document{rows.length === 1 ? "" : "s"}
                </CardMeta>
              </CardHeader>
              <CardContent>
                <ul className="m-0 flex list-none flex-col gap-2 p-0">
                  {rows.map((d, i) => (
                    <li
                      key={i}
                      className="flex flex-wrap items-center gap-3 border-b border-hairline pb-2 last:border-b-0 last:pb-0 text-[13px]"
                    >
                      <span className="font-mono text-[11px] text-ink-tertiary">
                        {fmtDate(d.fetched_at)}
                      </span>
                      {d.mirror_url ? (
                        <a
                          href={d.mirror_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-accent-indigo hover:underline"
                        >
                          Open mirror
                        </a>
                      ) : null}
                      <a
                        href={d.original_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-ink-secondary hover:underline"
                      >
                        Open original (RSC)
                      </a>
                      {d.file_size ? (
                        <span className="font-mono text-[11px] text-ink-tertiary">
                          {fmtBytes(d.file_size)}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          );
        })}
    </div>
  );
}

// ---------- Partner Factories tab (BH only, Spec B3) -----------------------
//
// `bh_factory_relationships` does not exist in the DB yet; per
// frontend-design-spec.md §4.8 the slot is reserved with a static empty state
// until the BH relationship graph ships in a later Phase-2 spec.

function PartnerFactoriesTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Partner factories</CardTitle>
        <CardMeta>Reserved · Phase 2</CardMeta>
      </CardHeader>
      <CardContent className="flex flex-col items-start gap-3 py-6">
        <p className="m-0 max-w-prose text-[14px] text-ink-secondary">
          Partner-factory disclosures will land with the buying-house
          relationship graph in a later Phase&nbsp;2 spec. We don&rsquo;t show a
          list here until we have first-party evidence linking each factory to
          this buying house.
        </p>
      </CardContent>
    </Card>
  );
}

// ---------- Contact tab (gated) --------------------------------------------

function ContactTab({ slug }: { slug: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-start gap-3 py-8">
        <div className="font-display text-[18px] font-semibold text-ink-primary">
          Contact details unlocked on paid plans
        </div>
        <p className="m-0 max-w-prose text-[14px] text-ink-secondary">
          Email, phone, contact name, and website are released on Pro and
          Enterprise plans. Every contact is verified against the source
          register at fetch time.
        </p>
        <Button asChild variant="primary">
          <Link href={`/pricing?from=/app/suppliers/${slug}`}>
            Upgrade to view contacts
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

// ---------- small helpers --------------------------------------------------

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="font-mono text-[11px] uppercase tracking-wider text-ink-tertiary">
        {label}
      </dt>
      <dd className="m-0 text-[14px] text-ink-primary">{value}</dd>
    </div>
  );
}

function ExpiryChip({
  kind,
  expiresOn,
}: {
  kind: string;
  expiresOn: string | null;
}) {
  // OEKO-TEX has no expiry by design (with_expiry = 0); do not render a chip
  // per frontend-design-spec.md §4.3.
  if (kind === "oeko_tex") return null;
  if (expiresOn == null) return <Tag tone="muted">expiry n/a</Tag>;
  const now = Date.now();
  const exp = new Date(expiresOn).getTime();
  if (Number.isNaN(exp)) return <Tag tone="muted">expiry n/a</Tag>;
  const daysLeft = Math.floor((exp - now) / (1000 * 60 * 60 * 24));
  if (daysLeft < 0) return <Tag tone="red">Expired {fmtDate(expiresOn)}</Tag>;
  if (daysLeft < 90) return <Tag tone="amber">Expires {fmtDate(expiresOn)}</Tag>;
  return <Tag tone="green">Valid · {fmtDate(expiresOn)}</Tag>;
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
  if (e === "factory") return "Factory";
  if (e === "buying_house") return "Buying house";
  return "Unknown";
}

const CERT_LABELS: Record<string, string> = {
  wrap: "WRAP",
  oeko_tex: "OEKO-TEX",
  gots: "GOTS",
  sa8000: "SA8000",
  grs: "GRS",
  rcs: "RCS",
  bci: "BCI",
  fairtrade: "Fairtrade",
  iso9001: "ISO 9001",
  iso14001: "ISO 14001",
  iso45001: "ISO 45001",
  sedex_smeta: "SMETA",
  bsci: "BSCI",
  other: "Other",
};
function certLabel(kind: string): string {
  return CERT_LABELS[kind] ?? kind.toUpperCase();
}

const TIER_LABELS: Record<string, string> = {
  tier1_gov: "Tier 1 · Gov",
  tier2_industry: "Tier 2 · Industry",
  tier3_cert: "Tier 3 · Cert",
  tier4_brand: "Tier 4 · Brand",
  tier5_regulatory: "Tier 5 · Regulatory",
  tier6_crosscheck: "Tier 6 · Cross-check",
};
function tierLabel(tier: string): string {
  return TIER_LABELS[tier] ?? tier;
}

const DOC_TYPE_LABELS: Record<ComplianceDocument["doc_type"], string> = {
  fire: "Fire safety",
  structural: "Structural safety",
  electrical: "Electrical safety",
  boiler: "Boiler safety",
  cap: "Corrective Action Plan (CAP)",
};
function docTypeLabel(k: ComplianceDocument["doc_type"]): string {
  return DOC_TYPE_LABELS[k];
}

function distinctSources(prov: Provenance[]): number {
  return new Set(prov.map((p) => p.source_code)).size;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
