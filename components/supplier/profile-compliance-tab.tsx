import {
  ProfileActionLink,
  ProfileCard,
  ProfileCardHeader,
  ProfileEvidenceRow,
  ProfileFootnote,
  ProfileSourceMark,
  ProfileStatusBadge,
  ProfileTabStack,
} from "@/components/supplier/profile-ui";
import { formatProfileDate, formatRegistryIdLabel } from "@/lib/format-supplier-profile";
import { cn } from "@/lib/utils";

import { rscDetailBlockVisible, rscWorkforceLabel } from "@/lib/rsc-workforce-label";

export type ProfileCompliancePill = {
  source_code: string;
  label: string;
  value: string | null;
  verified: boolean | null;
  source_url: string | null;
  inherited_from: string | null;
  inherited_from_name: string | null;
  /** REZ-110: facility company_name when inherited; display-only. */
  building_name?: string | null;
};

export type ProfileComplianceCert = {
  kind: string;
  certificate_no: string | null;
  issuer: string | null;
  issued_on: string | null;
  expires_on: string | null;
  scope: string | null;
  document_url: string | null;
  /**
   * REZ-93: facility company_name when inherited from a facility_of child.
   * Display-only — does not feed discover, pills, or t13. Suffixes like
   * (Extension) / Unit-2 identify the building.
   */
  building_name?: string | null;
};

export type ProfileComplianceRsc = {
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
  /** REZ-110: facility company_name when this site is a building. */
  building_name?: string | null;
  cap_url: string | null;
};

export type ProfileComplianceBrand = {
  source_code: string;
  display_name: string;
  source_url: string | null;
  last_seen_at: string;
  /** REZ-110: facility company_name when inherited; display-only. */
  building_name?: string | null;
};

export type ProfileComplianceSanction = {
  list: string;
  matched_name: string;
  list_entry_ref: string | null;
  screened_at: string;
  source_url: string | null;
  listed_date: string | null;
};

export type ProfileComplianceDocument = {
  doc_type: "fire" | "structural" | "electrical" | "boiler" | "cap";
  mirror_url: string | null;
  original_url: string;
  fetched_at: string;
  file_size: number | null;
  /**
   * REZ-93: facility company_name when this doc was inherited from a
   * facility_of child. Omitted/null for the mother's own documents.
   * Suffixes like (Extension) / Unit-2 are intentional — they identify
   * the building.
   */
  building_name?: string | null;
};

export type ProfileComplianceData = {
  pills: readonly ProfileCompliancePill[];
  certifications: readonly ProfileComplianceCert[];
  /** REZ-110: one entry per site (mother + buildings). Null when none. */
  rsc_remediation: readonly ProfileComplianceRsc[] | null;
  brand_attributions: readonly ProfileComplianceBrand[];
  sanctions: readonly ProfileComplianceSanction[];
  documents: readonly ProfileComplianceDocument[];
};

/** Normalise REZ-110 array or legacy single RSC object from the profile RPC. */
export function asRscSites(raw: unknown): ProfileComplianceRsc[] | null {
  if (raw == null) return null;
  if (Array.isArray(raw)) {
    return raw.length > 0 ? (raw as ProfileComplianceRsc[]) : null;
  }
  if (typeof raw === "object") return [raw as ProfileComplianceRsc];
  return null;
}

const REGISTRY_CODES: ReadonlySet<string> = new Set([
  "BGMEA",
  "BKMEA",
  "BTMA",
  "BGAPMEA",
  "RSC",
  "EPB",
]);

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

// The 6 watchlists SourceBD screens against, keyed by the real
// `sanctions_list_entries.list` value (see lib/source-logos.ts and
// app/(app)/admin/sanctions/page.tsx SANCTIONS_LISTS) so the clear-state
// list and any real hit resolve the same issuer-agency logo.
const SANCTIONS_WATCHLISTS = [
  { list: "uflpa", acronym: "UFLPA", authority: "CBP Entity List" },
  { list: "us_wro", acronym: "CBP WRO", authority: "U.S. Customs & Border Protection" },
  { list: "ofac_sdn", acronym: "OFAC SDN", authority: "U.S. Treasury" },
  { list: "uk_ofsi", acronym: "OFSI", authority: "HM Treasury" },
  { list: "eu_sanctions", acronym: "EU Sanctions", authority: "European Commission" },
  { list: "ilab_tvpra", acronym: "DOL ILAB", authority: "U.S. Labor Dept." },
] as const;

// remediation_status / training_status are free-text RSC columns with no
// enum — this infers a dot colour from common phrasing instead of asserting
// a status the data doesn't guarantee. Unrecognised text stays neutral.
function statusTone(text: string): "valid" | "expiring" | "neutral" {
  const t = text.toLowerCase();
  if (/complet|done|resolved|closed/.test(t)) return "valid";
  if (/progress|pending|ongoing|underway/.test(t)) return "expiring";
  return "neutral";
}

const STATUS_DOT_CLASS: Record<"valid" | "expiring" | "neutral", string> = {
  valid: "bg-sem-green",
  expiring: "bg-sem-amber",
  neutral: "bg-neutral-400",
};

const STATUS_TEXT_CLASS: Record<"valid" | "expiring" | "neutral", string> = {
  valid: "text-sem-green",
  expiring: "text-sem-amber",
  neutral: "text-neutral-600",
};

const DOC_TYPE_LONG: Record<ProfileComplianceDocument["doc_type"], string> = {
  fire: "RSC fire-safety inspection report",
  structural: "RSC structural inspection report",
  electrical: "RSC electrical inspection report",
  boiler: "RSC boiler safety inspection",
  cap: "Corrective Action Plan",
};

function sourceFullName(code: string): string {
  return SOURCE_NAMES[code] ?? code;
}

function certLabel(kind: string): string {
  return CERT_LABELS[kind] ?? kind.toUpperCase();
}

function certLongName(kind: string): string {
  return CERT_LONG[kind] ?? certLabel(kind);
}

function certStatus(c: ProfileComplianceCert): {
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
    return { label: `Expired ${formatProfileDate(c.expires_on)}`, tone: "expired" };
  if (daysLeft < 90)
    return { label: `Expires in ${daysLeft} days`, tone: "expiring" };
  return { label: `Valid · ${daysLeft} days`, tone: "valid" };
}

function certStatusShort(status: ReturnType<typeof certStatus>): string {
  if (status.tone === "valid") return "Valid";
  if (status.tone === "expiring") return "Expiring";
  if (status.tone === "expired") return "Expired";
  return status.label === "expiry n/a" ? "No expiry" : status.label;
}

function countDirect(pills: readonly ProfileCompliancePill[]): number {
  return pills.filter((p) => p.inherited_from == null).length;
}

function countInherited(pills: readonly ProfileCompliancePill[]): number {
  return pills.filter((p) => p.inherited_from != null).length;
}

function countActiveCerts(certs: readonly ProfileComplianceCert[]): number {
  return certs.filter((c) => certStatus(c).tone !== "expired").length;
}

function countExpiringCerts(certs: readonly ProfileComplianceCert[]): number {
  return certs.filter((c) => certStatus(c).tone === "expiring").length;
}

function registryPillsSummary(pills: readonly ProfileCompliancePill[]): string {
  const direct = countDirect(pills);
  const inh = countInherited(pills);
  const buildings = new Set(
    pills
      .map((p) => p.building_name?.trim())
      .filter((n): n is string => Boolean(n)),
  ).size;
  const parts: string[] = [];
  if (buildings > 0) {
    parts.push(
      `${pills.length} record${pills.length === 1 ? "" : "s"} · ${buildings} building${buildings === 1 ? "" : "s"}`,
    );
  } else {
    parts.push(`${direct} verified record${direct === 1 ? "" : "s"}`);
    if (inh > 0) parts.push(`${inh} inherited`);
  }
  return parts.join(" · ");
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function ProfileRegistriesCard({
  pills,
}: {
  pills: readonly ProfileCompliancePill[];
}) {
  const registryPills = pills.filter((p) => REGISTRY_CODES.has(p.source_code));
  if (registryPills.length === 0) return null;
  const buildingCount = new Set(
    registryPills
      .map((p) => p.building_name?.trim())
      .filter((n): n is string => Boolean(n)),
  ).size;
  return (
    <ProfileCard hoverable>
      <ProfileCardHeader
        title="Registries"
        meta={registryPillsSummary(registryPills)}
      />
      <div>
        {registryPills.map((p, i) => (
          <RegistryRow key={i} pill={p} />
        ))}
      </div>
      {buildingCount > 0 ? (
        <ProfileFootnote>
          Records labelled with a building name belong to that facility, not
          the main plant. They appear here for due diligence only — they do
          not make the company searchable under that registry in Discover.
        </ProfileFootnote>
      ) : registryPills.some((p) => p.inherited_from != null) ? (
        <ProfileFootnote>
          Inherited registries resolve from the parent group&apos;s records
          and link back to the parent profile.
        </ProfileFootnote>
      ) : null}
    </ProfileCard>
  );
}

export function ProfileCertificationsCard({
  certifications,
}: {
  certifications: readonly ProfileComplianceCert[];
}) {
  if (certifications.length === 0) return null;
  const buildingCount = new Set(
    certifications
      .map((c) => c.building_name?.trim())
      .filter((n): n is string => Boolean(n)),
  ).size;
  return (
    <ProfileCard hoverable>
      <ProfileCardHeader
        title="Certifications"
        meta={
          buildingCount > 0
            ? `${countActiveCerts(certifications)} active · ${countExpiringCerts(certifications)} expiring · ${buildingCount} building${buildingCount === 1 ? "" : "s"}`
            : `${countActiveCerts(certifications)} active · ${countExpiringCerts(certifications)} expiring`
        }
      />
      <div>
        {certifications.map((c, i) => (
          <CertRow key={i} cert={c} />
        ))}
      </div>
      {buildingCount > 0 ? (
        <ProfileFootnote>
          Certificates labelled with a building name were issued for that
          facility. They appear here for due diligence only — they do not make
          the company searchable under that certification in Discover.
        </ProfileFootnote>
      ) : null}
    </ProfileCard>
  );
}

export function ProfileSanctionsCard({
  hits,
}: {
  hits: readonly ProfileComplianceSanction[];
}) {
  return hits.length > 0 ? (
    <SanctionsHitsCard hits={hits} />
  ) : (
    <SanctionsClearCard />
  );
}

export function ProfileDocumentsCard({
  documents,
  className,
}: {
  documents: readonly ProfileComplianceDocument[];
  className?: string;
}) {
  if (documents.length === 0) return null;
  const buildingCount = new Set(
    documents
      .map((d) => d.building_name?.trim())
      .filter((n): n is string => Boolean(n)),
  ).size;
  return (
    <ProfileCard className={className}>
      <ProfileCardHeader
        title="Compliance documents"
        meta={
          buildingCount > 0
            ? `${documents.length} mirrored · ${buildingCount} building${buildingCount === 1 ? "" : "s"}`
            : `${documents.length} mirrored`
        }
      />
      <div>
        {documents.map((d, i) => (
          <DocRow key={i} doc={d} />
        ))}
      </div>
      <ProfileFootnote>
        Mirror copies served from SourceBD&apos;s CDN for stable archival.
        Originals link back to the issuing authority.
        {buildingCount > 0
          ? " Documents labelled with a building name were inspected at that facility, not the main plant."
          : null}
      </ProfileFootnote>
    </ProfileCard>
  );
}

export function ProfileComplianceTab({
  data,
}: {
  data: ProfileComplianceData;
}) {
  const rscSites = data.rsc_remediation ?? [];
  return (
    <ProfileTabStack>
      <div className="grid gap-4 lg:grid-cols-2">
        <ProfileRegistriesCard pills={data.pills} />
        <ProfileCertificationsCard certifications={data.certifications} />
        {rscSites.length > 0
          ? rscSites.map((rsc, i) => (
              <RscCard key={i} rsc={rsc} />
            ))
          : null}
        <ProfileSanctionsCard hits={data.sanctions} />
        {data.brand_attributions.length > 0 ? (
          <ProfileCard hoverable>
            <ProfileCardHeader
              title="Brand attribution"
              meta={`${data.brand_attributions.length} brand${data.brand_attributions.length === 1 ? "" : "s"} disclosed`}
            />
            <div className="flex flex-wrap gap-2">
              {data.brand_attributions.map((b, i) => (
                <BrandChip key={i} brand={b} />
              ))}
            </div>
            <ProfileFootnote>
              Each chip traces to the brand&apos;s own published supplier
              disclosure. Full sources on the Brand attribution tab.
              {data.brand_attributions.some((b) => b.building_name)
                ? " Chips labelled with a building name were disclosed for that facility."
                : null}
            </ProfileFootnote>
          </ProfileCard>
        ) : null}
        <ProfileDocumentsCard
          documents={data.documents}
          className="lg:col-span-2"
        />
      </div>
    </ProfileTabStack>
  );
}

function RegistryRow({ pill }: { pill: ProfileCompliancePill }) {
  const inherited = !!pill.inherited_from;
  const building = pill.building_name?.trim() || null;
  const meta = building
    ? building
    : inherited
      ? `Inherited from parent group ${pill.inherited_from_name ?? ""}`.trim()
      : `Verified via ${sourceFullName(pill.source_code)}`;
  return (
    <ProfileEvidenceRow
      markSize="lg"
      pillAlign="top"
      mark={<ProfileSourceMark tag={pill.source_code} size="lg" />}
      title={
        <>
          {sourceFullName(pill.source_code)}
          {pill.value ? (
            <span
              className="ml-2 font-mono text-[13px] font-medium text-neutral-500"
              title={formatRegistryIdLabel(pill.source_code)}
            >
              {pill.value}
            </span>
          ) : null}
        </>
      }
      meta={
        building ? (
          <>
            <span className="text-neutral-500">
              Verified via {sourceFullName(pill.source_code)}
            </span>
            <span className="mt-0.5 block text-[12px] font-medium text-neutral-500">
              {building}
            </span>
          </>
        ) : (
          meta
        )
      }
      status={
        <ProfileStatusBadge tone={inherited ? "inherited" : "valid"}>
          {inherited ? "Inherited" : "Verified"}
        </ProfileStatusBadge>
      }
    />
  );
}

function CertRow({ cert }: { cert: ProfileComplianceCert }) {
  const status = certStatus(cert);
  const shortStatus = certStatusShort(status);
  const building = cert.building_name?.trim() || null;
  const expirySuffix =
    cert.expires_on && cert.kind !== "oeko_tex"
      ? ` · expires ${formatProfileDate(cert.expires_on)}`
      : "";
  return (
    <ProfileEvidenceRow
      markSize="lg"
      pillAlign="top"
      mark={<ProfileSourceMark tag={cert.kind} label={certLabel(cert.kind)} size="lg" />}
      title={
        <>
          {/* Phones: acronym only — the full descriptive name is what makes
              this list read as a wall of text on narrow screens. */}
          <span className="sm:hidden">{certLabel(cert.kind)}</span>
          <span className="hidden sm:inline">{certLongName(cert.kind)}</span>
        </>
      }
      meta={
        <>
          {/* Phones: drop the issuer name (often the longest, least-scannable
              segment) and keep just the certificate number + expiry. */}
          <span className="font-mono sm:hidden">
            {[cert.certificate_no].filter(Boolean).join(" · ") || "—"}
            {expirySuffix}
          </span>
          <span className="hidden font-mono sm:inline">
            {[cert.certificate_no, cert.issuer].filter(Boolean).join(" · ") || "—"}
            {expirySuffix}
          </span>
          {building ? (
            <span className="mt-0.5 block text-[12px] font-medium text-neutral-500">
              {building}
            </span>
          ) : null}
        </>
      }
      status={
        <ProfileStatusBadge tone={status.tone}>
          <span className="sm:hidden">{shortStatus}</span>
          <span className="hidden sm:inline">{status.label}</span>
        </ProfileStatusBadge>
      }
    />
  );
}

function RscCard({ rsc }: { rsc: ProfileComplianceRsc }) {
  const pct =
    rsc.progress_pct != null
      ? Math.max(0, Math.min(100, Number(rsc.progress_pct)))
      : null;
  const building = rsc.building_name?.trim() || null;
  return (
    <ProfileCard hoverable>
      <ProfileCardHeader
        title="RSC remediation"
        meta={
          building
            ? building
            : pct != null
              ? `${pct.toFixed(0)}% complete`
              : "tracked"
        }
      />
      <div className="space-y-4">
        {pct != null ? (
          <>
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="font-display text-[34px] font-bold leading-none tracking-[-0.02em] text-neutral-950">
                {pct.toFixed(0)}
                <span className="text-[18px]">%</span>
              </span>
              <span className="text-[13px] font-medium text-neutral-500">
                remediation completed
              </span>
            </div>
            <div className="relative h-2 rounded-full bg-neutral-100">
              <div
                className="h-full rounded-full bg-brand-forest"
                style={{ width: `${pct}%` }}
              />
              <span
                className="absolute top-1/2 h-4 w-px -translate-y-1/2 bg-neutral-400"
                style={{ left: "95%" }}
                title="Industry median 95%"
              />
            </div>
            <div className="flex justify-between font-mono text-[12px] text-neutral-500">
              <span>0%</span>
              <span>100%</span>
            </div>
          </>
        ) : null}
        {rscDetailBlockVisible(rsc) ? (
          <div>
            <div className="flex items-center justify-between border-t border-neutral-100 py-2.5 text-[14px]">
              <span className="text-neutral-600">Workforce covered</span>
              <span className="font-semibold text-neutral-800">
                {rscWorkforceLabel(rsc.workers_count)}
              </span>
            </div>
            {rsc.remediation_status ? (
              <div className="flex items-center justify-between border-t border-neutral-100 py-2.5 text-[14px]">
                <span className="text-neutral-600">Remediation status</span>
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 font-semibold",
                    STATUS_TEXT_CLASS[statusTone(rsc.remediation_status)],
                  )}
                >
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      STATUS_DOT_CLASS[statusTone(rsc.remediation_status)],
                    )}
                  />
                  {rsc.remediation_status}
                </span>
              </div>
            ) : null}
            {rsc.training_status ? (
              <div className="flex items-center justify-between border-t border-neutral-100 py-2.5 text-[14px]">
                <span className="text-neutral-600">Training status</span>
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 font-semibold",
                    STATUS_TEXT_CLASS[statusTone(rsc.training_status)],
                  )}
                >
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      STATUS_DOT_CLASS[statusTone(rsc.training_status)],
                    )}
                  />
                  {rsc.training_status}
                </span>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      <ProfileFootnote>
        {building
          ? "Tracked by the RMG Sustainability Council for this building — fire, structural, and electrical remediation on file."
          : "Tracked by the RMG Sustainability Council under the post-Accord safety transition programme — covers fire, structural, and electrical remediation across all factory buildings on file."}
      </ProfileFootnote>
    </ProfileCard>
  );
}

function SanctionsClearCard() {
  return (
    <ProfileCard hoverable>
      <ProfileCardHeader
        title="Sanctions screening"
        meta="6 of 6 watchlists clear · re-screened weekly"
      />
      <div>
        {SANCTIONS_WATCHLISTS.map((w) => (
          <ProfileEvidenceRow
            key={w.list}
            markSize="lg"
            pillAlign="top"
            mark={<ProfileSourceMark tag={w.list} label={w.acronym} size="lg" />}
            title={w.acronym}
            meta={w.authority}
            status={<ProfileStatusBadge tone="valid">Clear</ProfileStatusBadge>}
          />
        ))}
      </div>
      <ProfileFootnote>
        Name + address + registry IDs cross-checked against all 6 watchlists
        above.
      </ProfileFootnote>
    </ProfileCard>
  );
}

function SanctionsHitsCard({
  hits,
}: {
  hits: readonly ProfileComplianceSanction[];
}) {
  return (
    <ProfileCard className="border-sem-red/50 bg-sem-red-soft/40">
      <ProfileCardHeader title="Sanctions matches" meta={`${hits.length} active`} />
      <div>
        {hits.map((h, i) => (
          <ProfileEvidenceRow
            key={i}
            markSize="lg"
            mark={<ProfileSourceMark tag={h.list} size="lg" />}
            title={h.matched_name}
            meta={`${h.list_entry_ref ? `Ref: ${h.list_entry_ref} · ` : ""}Screened ${formatProfileDate(h.screened_at)}`}
            status={<ProfileStatusBadge tone="danger">{h.list}</ProfileStatusBadge>}
            action={
              h.source_url ? (
                <ProfileActionLink href={h.source_url}>View list entry</ProfileActionLink>
              ) : null
            }
          />
        ))}
      </div>
    </ProfileCard>
  );
}

function BrandChip({ brand }: { brand: ProfileComplianceBrand }) {
  const building = brand.building_name?.trim() || null;
  const node = (
    <span
      className="inline-flex flex-col items-start gap-0.5 rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-[13px] font-semibold text-neutral-800"
      title={`Disclosed on ${brand.display_name}'s published factory list (${formatProfileDate(brand.last_seen_at)})${building ? ` · ${building}` : ""}`}
    >
      <span className="inline-flex items-center gap-2">
        {brand.display_name}
        <span className="border-l border-neutral-200 pl-2 font-mono text-[13px] font-medium text-neutral-500">
          {formatProfileDate(brand.last_seen_at)}
        </span>
      </span>
      {building ? (
        <span className="text-[11px] font-medium text-neutral-500">{building}</span>
      ) : null}
    </span>
  );
  if (!brand.source_url) return node;
  return (
    <a href={brand.source_url} target="_blank" rel="noopener noreferrer">
      {node}
    </a>
  );
}

function DocRow({ doc }: { doc: ProfileComplianceDocument }) {
  const building = doc.building_name?.trim() || null;
  const sizeMeta = doc.file_size ? (
    <span className="font-mono">{fmtBytes(doc.file_size)}</span>
  ) : null;
  return (
    <ProfileEvidenceRow
      mark={<ProfileSourceMark tag="RSC" />}
      title={
        <>
          {/* Phones: doc-type badge as an eyebrow above the full name instead
              of wrapping inline — reads as one clean two-line block instead
              of a ragged wrap. sm+: unchanged inline pairing. */}
          <span className="flex flex-col items-start gap-1 sm:hidden">
            <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
              {doc.doc_type}
            </span>
            <span>{DOC_TYPE_LONG[doc.doc_type]}</span>
          </span>
          <span className="hidden flex-wrap items-center gap-2 sm:flex">
            <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[12px] font-semibold uppercase text-neutral-600">
              {doc.doc_type}
            </span>
            {DOC_TYPE_LONG[doc.doc_type]}
          </span>
        </>
      }
      meta={
        building || sizeMeta ? (
          <>
            {building ? (
              <span title="Inspection covers this building">
                {building}
                {sizeMeta ? " · " : null}
              </span>
            ) : null}
            {sizeMeta}
          </>
        ) : null
      }
      action={
        <>
          {/* Phones: plain compact text links instead of the padded
              button-style tap target, which read as stray whitespace in a
              list this dense. sm+: unchanged full-size tap targets. */}
          <span className="flex items-center gap-4 sm:hidden">
            {doc.mirror_url ? (
              <a
                href={doc.mirror_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[13px] font-semibold text-brand-forest underline decoration-brand-forest/30 underline-offset-2"
              >
                Mirror
              </a>
            ) : null}
            <a
              href={doc.original_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[13px] font-semibold text-brand-forest underline decoration-brand-forest/30 underline-offset-2"
            >
              Original
            </a>
          </span>
          <span className="hidden items-center gap-2 sm:flex">
            {doc.mirror_url ? (
              <ProfileActionLink href={doc.mirror_url}>Mirror</ProfileActionLink>
            ) : null}
            <ProfileActionLink href={doc.original_url}>Original</ProfileActionLink>
          </span>
        </>
      }
    />
  );
}
