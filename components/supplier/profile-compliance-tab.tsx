import {
  ProfileFootnote,
  ProfileStatusBadge,
} from "@/components/supplier/profile-ui";
import { formatProfileDate, formatRegistryIdLabel } from "@/lib/format-supplier-profile";
import { sourceLogo } from "@/lib/source-logos";

export type ProfileCompliancePill = {
  source_code: string;
  label: string;
  value: string | null;
  verified: boolean | null;
  source_url: string | null;
  inherited_from: string | null;
  inherited_from_name: string | null;
};

export type ProfileComplianceCert = {
  kind: string;
  certificate_no: string | null;
  issuer: string | null;
  issued_on: string | null;
  expires_on: string | null;
  scope: string | null;
  document_url: string | null;
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
  cap_url: string | null;
};

export type ProfileComplianceBrand = {
  source_code: string;
  display_name: string;
  source_url: string | null;
  last_seen_at: string;
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
};

export type ProfileComplianceData = {
  pills: readonly ProfileCompliancePill[];
  certifications: readonly ProfileComplianceCert[];
  rsc_remediation: ProfileComplianceRsc | null;
  brand_attributions: readonly ProfileComplianceBrand[];
  sanctions: readonly ProfileComplianceSanction[];
  documents: readonly ProfileComplianceDocument[];
};

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

const SANCTIONS_TILES = [
  { juris: "US", acronym: "UFLPA", auth: "CBP Entity List" },
  { juris: "US", acronym: "OFAC SDN", auth: "U.S. Treasury" },
  { juris: "UK", acronym: "OFSI", auth: "HM Treasury" },
  { juris: "EU", acronym: "EU FSF", auth: "European Commission" },
  { juris: "US", acronym: "CBP WRO", auth: "U.S. Customs" },
  { juris: "US", acronym: "DOL ILAB", auth: "U.S. Labor Dept." },
];

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
  const parts: string[] = [];
  if (direct > 0) {
    parts.push(`${direct} verified record${direct === 1 ? "" : "s"}`);
  }
  if (inh > 0) {
    parts.push(`${inh} from parent group`);
  }
  return parts.length > 0 ? parts.join(" · ") : "no registry records";
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function ProfileComplianceTab({
  data,
}: {
  data: ProfileComplianceData;
}) {
  const registryPills = data.pills.filter((p) =>
    REGISTRY_CODES.has(p.source_code),
  );

  return (
    <div className="proto-grid">
      {registryPills.length > 0 ? (
        <section className="proto-card hoverable">
          <header className="proto-card-head">
            <h2 className="proto-card-title">Registries</h2>
            <span className="proto-card-meta">
              {registryPillsSummary(registryPills)}
            </span>
          </header>
          <div className="registry-list">
            {registryPills.map((p, i) => (
              <RegistryRow key={i} pill={p} />
            ))}
          </div>
          {registryPills.some((p) => p.inherited_from != null) ? (
            <ProfileFootnote>
              Inherited registries resolve from the parent group&apos;s records
              and link back to the parent profile.
            </ProfileFootnote>
          ) : null}
        </section>
      ) : null}

      {data.certifications.length > 0 ? (
        <section className="proto-card hoverable">
          <header className="proto-card-head">
            <h2 className="proto-card-title">Certifications</h2>
            <span className="proto-card-meta">
              {countActiveCerts(data.certifications)} active ·{" "}
              {countExpiringCerts(data.certifications)} expiring
            </span>
          </header>
          <div className="cert-list">
            {data.certifications.map((c, i) => (
              <CertRow key={i} cert={c} />
            ))}
          </div>
        </section>
      ) : null}

      {data.rsc_remediation ? (
        <RscCard rsc={data.rsc_remediation} />
      ) : null}

      {data.sanctions.length > 0 ? (
        <SanctionsHitsCard hits={data.sanctions} />
      ) : (
        <SanctionsClearCard />
      )}

      {data.brand_attributions.length > 0 ? (
        <section className="proto-card hoverable">
          <header className="proto-card-head">
            <h2 className="proto-card-title">Brand attribution</h2>
            <span className="proto-card-meta">
              {data.brand_attributions.length} brand
              {data.brand_attributions.length === 1 ? "" : "s"} disclosed
            </span>
          </header>
          <div className="pill-row">
            {data.brand_attributions.map((b, i) => (
              <BrandChip key={i} brand={b} />
            ))}
          </div>
          <ProfileFootnote>
            Each chip traces to the brand&apos;s own published supplier
            disclosure. Full sources on the Brand attribution tab.
          </ProfileFootnote>
        </section>
      ) : null}

      {data.documents.length > 0 ? (
        <section className="proto-card span2">
          <header className="proto-card-head">
            <h2 className="proto-card-title">Compliance documents</h2>
            <span className="proto-card-meta">
              {data.documents.length} mirrored
            </span>
          </header>
          <div className="docs-list">
            {data.documents.map((d, i) => (
              <DocRow key={i} doc={d} />
            ))}
          </div>
          <ProfileFootnote>
            Mirror copies served from SourceBD&apos;s CDN for stable archival.
            Originals link back to the issuing authority.
          </ProfileFootnote>
        </section>
      ) : null}
    </div>
  );
}

function RegistryRow({ pill }: { pill: ProfileCompliancePill }) {
  const logo = sourceLogo(pill.source_code);
  const inherited = !!pill.inherited_from;
  const meta = inherited
    ? `Inherited from parent group ${pill.inherited_from_name ?? ""}`.trim()
    : `Verified via ${sourceFullName(pill.source_code)}`;
  return (
    <div className="registry-row">
      <div className="reg-logo" data-source={pill.source_code}>
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
          {pill.value ? (
            <span
              className="ref"
              title={formatRegistryIdLabel(pill.source_code)}
            >
              {pill.value}
            </span>
          ) : null}
        </div>
        <div className="reg-meta">{meta}</div>
      </div>
      <span
        className={`reg-status profile-status-badge${inherited ? " inherited" : " valid"}`}
      >
        {inherited ? "Inherited" : "Verified"}
      </span>
    </div>
  );
}

function CertRow({ cert }: { cert: ProfileComplianceCert }) {
  const logo = sourceLogo(cert.kind);
  const status = certStatus(cert);
  const shortStatus = certStatusShort(status);
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
        <p className="cert-name">
          <span className="cert-name-short">{certLabel(cert.kind)}</span>
          <span className="cert-name-full">{certLongName(cert.kind)}</span>
        </p>
        <p className="cert-meta">
          {[cert.certificate_no, cert.issuer]
            .filter(Boolean)
            .join(" · ") || "—"}
          {cert.expires_on && cert.kind !== "oeko_tex"
            ? ` · expires ${formatProfileDate(cert.expires_on)}`
            : ""}
        </p>
      </div>
      <ProfileStatusBadge tone={status.tone} className="cert-status">
        <span className="cert-status-short">{shortStatus}</span>
        <span className="cert-status-full">{status.label}</span>
      </ProfileStatusBadge>
    </div>
  );
}

function RscCard({ rsc }: { rsc: ProfileComplianceRsc }) {
  const pct =
    rsc.progress_pct != null
      ? Math.max(0, Math.min(100, Number(rsc.progress_pct)))
      : null;
  return (
    <section className="proto-card hoverable rsc-card">
      <header className="proto-card-head">
        <h2 className="proto-card-title">RSC remediation</h2>
        <span className="proto-card-meta">
          {pct != null ? `${pct.toFixed(0)}% complete` : "tracked"}
        </span>
      </header>
      <div className="rsc-stack">
        {pct != null ? (
          <>
            <div className="rsc-score-row">
              <span className="rsc-headline">
                {pct.toFixed(0)}
                <span className="pct">%</span>
              </span>
              <span className="rsc-score-label">remediation completed</span>
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
          <p className="rsc-meta-line">
            {rsc.workers_count != null
              ? `${rsc.workers_count.toLocaleString()} workers`
              : ""}
            {rsc.workers_count != null && rsc.remediation_status ? " · " : ""}
            {rsc.remediation_status ?? ""}
          </p>
        ) : null}
      </div>
    </section>
  );
}

function SanctionsClearCard() {
  return (
    <section className="proto-card hoverable sanctions-card">
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

function SanctionsHitsCard({
  hits,
}: {
  hits: readonly ProfileComplianceSanction[];
}) {
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
              Screened {formatProfileDate(h.screened_at)}
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

function BrandChip({ brand }: { brand: ProfileComplianceBrand }) {
  const node = (
    <span
      className="brand-pill"
      title={`Disclosed on ${brand.display_name}'s published factory list (${formatProfileDate(brand.last_seen_at)})`}
    >
      {brand.display_name}
      <span className="ref">{formatProfileDate(brand.last_seen_at)}</span>
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
