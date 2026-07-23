// Compact evidence panels for /home-demo — same ProfileCard / evidence-row
// primitives as the live profile. List panels show up to 6 rows so stage
// height comes from real evidence density, not stretched empty space.
// Production profile tabs are untouched.

import {
  ProfileCard,
  ProfileCardHeader,
  ProfileEvidenceRow,
  ProfileFootnote,
  ProfileSourceMark,
  ProfileStatusBadge,
} from "@/components/supplier/profile-ui";
import {
  ChatCircle,
  DeviceMobile,
  EnvelopeSimple,
  Globe,
  MapPin,
  Phone,
  User,
} from "@phosphor-icons/react/dist/ssr";
import type { ReactNode } from "react";
import {
  formatProfileDate,
  formatRegistryIdLabel,
  provenanceTierShort,
  tierGroupLabel,
  trustLine,
} from "@/lib/format-supplier-profile";
import { toTitleCaseAddress } from "@/lib/format-location";
import {
  buildLocationOverview,
  locationOverviewMeta,
  type AddressRowRaw,
} from "@/lib/dedup-addresses";
import { cn } from "@/lib/utils";

/**
 * Row caps for demo panels.
 * Registries / certifications pad to 6 + footnote; height follows content.
 * Sanctions / addresses use 6 so height grows from rows.
 */
export const DEMO_ROWS = {
  default: 6,
  certifications: 6,
  provenance: 6,
  addresses: 6,
} as const;

/** Light-stage card: hairline + quiet elevation matching /home-demo cards. */
const DEMO_CARD =
  "rounded-card border-neutral-200/90 bg-white shadow-[0_1px_2px_rgba(15,15,20,0.04),0_10px_24px_-16px_rgba(15,15,20,0.12)] ring-1 ring-black/[0.03]";

/** Keep the ID readable; blur only the last 3 characters. Demo-only redaction. */
function DemoPartialId({
  value,
  className,
}: {
  value: string;
  className?: string;
}) {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const keep = Math.max(0, trimmed.length - 3);
  const visible = trimmed.slice(0, keep);
  const hidden = trimmed.slice(keep);

  return (
    <span
      className={className}
      aria-label="Identifier partially redacted"
      title="Redacted on public demo"
    >
      {visible ? <span className="font-mono">{visible}</span> : null}
      {hidden ? (
        <span
          aria-hidden
          className="select-none font-mono blur-[4.5px] [filter:blur(4.5px)]"
        >
          {hidden}
        </span>
      ) : null}
    </span>
  );
}

/** Plausible registry IDs when the live profile has no value for a padded row. */
const DEMO_REGISTRY_IDS: Record<string, string> = {
  BGAPMEA: "184729",
  BGMEA: "482915",
  BKMEA: "6251847",
  RSC: "392817",
  BTMA: "11842",
  EPB: "8006289",
};

const REGISTRY_CODES = new Set([
  "BGMEA",
  "BKMEA",
  "BTMA",
  "BGAPMEA",
  "RSC",
  "EPB",
]);

/** Preferred demo order — live pills first, then pad to 6 with peers. */
const DEMO_REGISTRY_ORDER = [
  "BGAPMEA",
  "BGMEA",
  "BKMEA",
  "RSC",
  "BTMA",
  "EPB",
] as const;

const SOURCE_NAMES: Record<string, string> = {
  BGMEA: "BGMEA",
  BKMEA: "BKMEA",
  BTMA: "BTMA",
  BGAPMEA: "BGAPMEA",
  EPB: "Export Promotion Bureau",
  RSC: "RMG Sustainability Council",
};

const CERT_LABELS: Record<string, string> = {
  wrap: "WRAP",
  oeko_tex: "OEKO-TEX®",
  gots: "GOTS",
  sa8000: "SA8000",
  grs: "GRS",
  rcs: "RCS",
  ocs: "OCS",
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

// Exact 6 watchlists from profile-compliance-tab.tsx / source-logos.ts keys.
const SANCTIONS_WATCHLISTS = [
  { list: "uflpa", acronym: "UFLPA", authority: "CBP Entity List" },
  { list: "us_wro", acronym: "CBP WRO", authority: "U.S. Customs & Border Protection" },
  { list: "ofac_sdn", acronym: "OFAC SDN", authority: "U.S. Treasury" },
  { list: "uk_ofsi", acronym: "OFSI", authority: "HM Treasury" },
  { list: "eu_sanctions", acronym: "EU Sanctions", authority: "European Commission" },
  { list: "ilab_tvpra", acronym: "DOL ILAB", authority: "U.S. Labor Dept." },
] as const;

type Pill = {
  source_code: string;
  value: string | null;
  inherited_from: string | null;
  inherited_from_name: string | null;
};

type Cert = {
  kind: string;
  certificate_no: string | null;
  issuer: string | null;
  expires_on: string | null;
};

/** Pad kinds when the live profile has fewer than DEMO_ROWS.certifications. */
const DEMO_CERT_PAD: readonly Cert[] = [
  {
    kind: "sa8000",
    certificate_no: "SA80XXXXXX",
    issuer: null,
    expires_on: "2027-06-01",
  },
  {
    kind: "grs",
    certificate_no: "GRSXXXXXX",
    issuer: null,
    expires_on: "2027-03-15",
  },
];

type Provenance = {
  source_code: string;
  display_name: string;
  tier: string;
  source_ref: string | null;
  last_seen_at: string;
};

function sourceName(code: string) {
  return SOURCE_NAMES[code] ?? code;
}

function certLabel(kind: string) {
  return CERT_LABELS[kind] ?? kind.toUpperCase();
}

function certLong(kind: string) {
  return CERT_LONG[kind] ?? certLabel(kind);
}

function certTone(c: Cert): "valid" | "expiring" | "expired" | "evergreen" {
  if (c.kind === "oeko_tex" || !c.expires_on) return "evergreen";
  const days = Math.floor(
    (new Date(c.expires_on).getTime() - Date.now()) / 86_400_000,
  );
  if (Number.isNaN(days) || days < 0) return days < 0 ? "expired" : "evergreen";
  if (days < 90) return "expiring";
  return "valid";
}

function certStatusLabel(c: Cert): string {
  const tone = certTone(c);
  if (tone === "evergreen") return c.kind === "oeko_tex" ? "Evergreen" : "No expiry";
  if (tone === "expired") return "Expired";
  if (tone === "expiring") return "Expiring";
  return "Valid";
}

/** One row per registry source — drops repeat IDs for the same authority. */
function uniqueRegistryPills(pills: readonly Pill[]): Pill[] {
  const out: Pill[] = [];
  const seen = new Set<string>();
  for (const p of pills) {
    if (!REGISTRY_CODES.has(p.source_code) || seen.has(p.source_code)) continue;
    seen.add(p.source_code);
    out.push(p);
  }
  return out;
}

/** Resolve a registry ID for demo display — live value, else padded fallback. */
function demoRegistryId(code: string, value: string | null): string {
  const live = value?.trim();
  if (live) return live;
  return DEMO_REGISTRY_IDS[code] ?? "100000";
}

/** Live unique pills in demo order, padded to 6 with peer registries. */
function demoRegistryRows(pills: readonly Pill[]): Pill[] {
  const byCode = new Map(
    uniqueRegistryPills(pills).map((p) => [p.source_code, p]),
  );
  const rows: Pill[] = [];
  for (const code of DEMO_REGISTRY_ORDER) {
    if (rows.length >= DEMO_ROWS.default) break;
    const existing = byCode.get(code);
    if (existing) {
      rows.push({
        ...existing,
        value: demoRegistryId(code, existing.value),
      });
      byCode.delete(code);
      continue;
    }
    rows.push({
      source_code: code,
      value: demoRegistryId(code, null),
      inherited_from: null,
      inherited_from_name: null,
    });
  }
  for (const leftover of byCode.values()) {
    if (rows.length >= DEMO_ROWS.default) break;
    rows.push({
      ...leftover,
      value: demoRegistryId(leftover.source_code, leftover.value),
    });
  }
  return rows;
}

export function DemoRegistriesPanel({ pills }: { pills: readonly Pill[] }) {
  const rows = demoRegistryRows(pills);
  if (rows.length === 0) return null;
  return (
    <ProfileCard className={DEMO_CARD}>
      <ProfileCardHeader
        title="Registries"
        meta={`${rows.length} verified record${rows.length === 1 ? "" : "s"}`}
      />
      <div>
        {rows.map((p, i) => {
          const inherited = !!p.inherited_from;
          return (
            <ProfileEvidenceRow
              key={i}
              markSize="lg"
              pillAlign="top"
              mark={<ProfileSourceMark tag={p.source_code} size="lg" />}
              title={
                <>
                  {sourceName(p.source_code)}
                  {p.value ? (
                    <span
                      className="ml-2 text-[13px] font-medium text-neutral-500"
                      title={formatRegistryIdLabel(p.source_code)}
                    >
                      <DemoPartialId value={p.value} />
                    </span>
                  ) : null}
                </>
              }
              meta={
                inherited
                  ? `From parent ${p.inherited_from_name ?? "group"}`.trim()
                  : null
              }
              status={
                <ProfileStatusBadge tone={inherited ? "inherited" : "valid"}>
                  {inherited ? "Inherited" : "Verified"}
                </ProfileStatusBadge>
              }
            />
          );
        })}
      </div>
      <ProfileFootnote>
        BGMEA, BKMEA, BTMA, BGAPMEA, RSC, and EPB memberships — verified IDs
        from the issuing register. Inherited rows resolve from the parent
        group&apos;s records and link back to the parent profile.
      </ProfileFootnote>
    </ProfileCard>
  );
}

export function DemoCertificationsPanel({
  certifications,
}: {
  certifications: readonly Cert[];
}) {
  const rows = demoCertRows(certifications);
  if (rows.length === 0) return null;
  const active = rows.filter((c) => certTone(c) !== "expired").length;
  return (
    <ProfileCard className={DEMO_CARD}>
      <ProfileCardHeader
        title="Certifications"
        meta={`${active} active`}
      />
      <div>
        {rows.map((c, i) => (
          <ProfileEvidenceRow
            key={`${c.kind}-${c.certificate_no ?? i}`}
            markSize="lg"
            pillAlign="top"
            mark={
              <ProfileSourceMark
                tag={c.kind}
                label={certLabel(c.kind)}
                size="lg"
              />
            }
            title={
              <>
                {/* Short label while the evidence stage is narrow (stacked or
                    lg side-by-side at 1024–1280). Long names only when the
                    stage has room — avoids title+badge crowding. */}
                <span className="xl:hidden">{certLabel(c.kind)}</span>
                <span className="hidden xl:inline">{certLong(c.kind)}</span>
              </>
            }
            meta={
              c.certificate_no ? (
                <DemoPartialId value={c.certificate_no} />
              ) : (
                <span className="font-mono">—</span>
              )
            }
            status={
              <ProfileStatusBadge tone={certTone(c)}>
                {certStatusLabel(c)}
              </ProfileStatusBadge>
            }
          />
        ))}
      </div>
      <ProfileFootnote>
        Certificate number, issuer, and validity from the body that issued
        them — OEKO-TEX, GOTS, WRAP, SA8000, and peer schemes.
      </ProfileFootnote>
    </ProfileCard>
  );
}

/** Prefer one of each kind, then duplicates, then pad to 6 with peer schemes. */
function demoCertRows(certifications: readonly Cert[]): Cert[] {
  const preferred: Cert[] = [];
  const extras: Cert[] = [];
  const seen = new Set<string>();
  for (const c of certifications) {
    if (!seen.has(c.kind)) {
      seen.add(c.kind);
      preferred.push(c);
    } else {
      extras.push(c);
    }
  }
  const rows = [...preferred, ...extras];
  for (const pad of DEMO_CERT_PAD) {
    if (rows.length >= DEMO_ROWS.certifications) break;
    if (seen.has(pad.kind)) continue;
    seen.add(pad.kind);
    rows.push(pad);
  }
  return rows.slice(0, DEMO_ROWS.certifications);
}

export function DemoSanctionsPanel({
  hitCount,
}: {
  hitCount: number;
}) {
  if (hitCount > 0) {
    return (
      <ProfileCard
        className={cn(DEMO_CARD, "border-sem-red/50 bg-sem-red-soft/40")}
      >
        <ProfileCardHeader
          title="Sanctions screening"
          meta={`${hitCount} active match${hitCount === 1 ? "" : "es"}`}
        />
        <p className="text-[14px] leading-6 text-neutral-700">
          This supplier matches an active watchlist entry. Open the full
          profile Compliance tab for the matched record.
        </p>
      </ProfileCard>
    );
  }

  const rows = SANCTIONS_WATCHLISTS.slice(0, DEMO_ROWS.default);
  return (
    <ProfileCard className={DEMO_CARD}>
      <ProfileCardHeader
        title="Sanctions screening"
        meta="6 of 6 watchlists clear"
      />
      <div>
        {rows.map((w) => (
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
        above — UFLPA, CBP WRO, OFAC SDN, OFSI, EU Sanctions, and DOL ILAB.
        Re-screened weekly against the issuing authorities.
      </ProfileFootnote>
    </ProfileCard>
  );
}

function ContactMark({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <span className="flex size-10 items-center justify-center rounded-[8px] border border-neutral-200 bg-neutral-50 text-neutral-600">
      {children}
    </span>
  );
}

export function DemoContactPanel({ meta }: { meta: string }) {
  // Realistic-looking demo values — last 3 chars blurred via DemoPartialId.
  const fields = [
    {
      label: "Phone",
      value: "+880-2-9884721",
      mark: <Phone size={18} weight="duotone" aria-hidden />,
    },
    {
      label: "Mobile",
      value: "+880-1712345896",
      mark: <DeviceMobile size={18} weight="duotone" aria-hidden />,
    },
    {
      label: "Email",
      value: "export@factorybd.com",
      mark: <EnvelopeSimple size={18} weight="duotone" aria-hidden />,
    },
    {
      label: "Website",
      value: "www.factorybd.com",
      mark: <Globe size={18} weight="duotone" aria-hidden />,
    },
    {
      label: "Contact",
      value: "Mr. Karim Rahman",
      mark: <User size={18} weight="duotone" aria-hidden />,
    },
    {
      label: "WhatsApp",
      value: "+880-1712345896",
      mark: <ChatCircle size={18} weight="duotone" aria-hidden />,
    },
  ] as const;

  return (
    <ProfileCard className={DEMO_CARD}>
      <ProfileCardHeader title="Contact" meta={meta} />
      <div>
        {fields.map((f) => (
          <ProfileEvidenceRow
            key={f.label}
            markSize="lg"
            pillAlign="top"
            mark={<ContactMark>{f.mark}</ContactMark>}
            title={f.label}
            meta={<DemoPartialId value={f.value} />}
            status={
              <ProfileStatusBadge tone="neutral">Masked</ProfileStatusBadge>
            }
          />
        ))}
      </div>
      <ProfileFootnote>
        Contact fields stay masked on the public profile until sign-up unlocks
        them. Server-enforced — we never ship contact PII to the browser before
        auth.
      </ProfileFootnote>
    </ProfileCard>
  );
}

export function DemoAddressesPanel<TAddress extends AddressRowRaw>({
  addresses,
}: {
  addresses: readonly TAddress[];
}) {
  const overview = buildLocationOverview(addresses);
  if (overview.uniqueLocationCount === 0) return null;

  const locations = overview.groups
    .flatMap((g) => g.locations)
    .slice(0, DEMO_ROWS.addresses);

  return (
    <ProfileCard className={DEMO_CARD}>
      <ProfileCardHeader
        title="Locations & addresses"
        meta={locationOverviewMeta(
          overview.uniqueLocationCount,
          overview.sourceRecordCount,
        )}
      />
      <div>
        {locations.map((location, i) => (
          <ProfileEvidenceRow
            key={i}
            markSize="lg"
            pillAlign="top"
            mark={
              <ContactMark>
                <MapPin size={18} weight="duotone" aria-hidden />
              </ContactMark>
            }
            title={toTitleCaseAddress(location.displayAddress)}
            meta={
              location.types[0]
                ? location.types[0].replace(/_/g, " ")
                : location.authorities[0] ?? null
            }
            status={
              <ProfileStatusBadge tone="valid">On record</ProfileStatusBadge>
            }
          />
        ))}
      </div>
      <ProfileFootnote>
        Factory and registered-office addresses as published by the source
        authorities on file.
      </ProfileFootnote>
    </ProfileCard>
  );
}

export function DemoProvenancePanel({
  provenance,
  t13SourceCount,
}: {
  provenance: readonly Provenance[];
  t13SourceCount: number;
}) {
  const rows = demoProvenanceRows(provenance, DEMO_ROWS.provenance);
  if (rows.length === 0) return null;
  return (
    <ProfileCard className={DEMO_CARD}>
      <ProfileCardHeader
        title="Source records"
        meta={trustLine(t13SourceCount, provenance.length)}
      />
      <div>
        {rows.map((p, i) => (
          <ProfileEvidenceRow
            key={`${p.source_code}-${p.source_ref ?? ""}-${p.last_seen_at}-${i}`}
            markSize="lg"
            pillAlign="top"
            mark={
              <ProfileSourceMark
                tag={p.source_code}
                label={p.display_name}
                size="lg"
              />
            }
            // display_name only — source_code next to it was duplicate chrome.
            title={p.display_name}
            meta={
              <span className="font-mono">
                Last verified {formatProfileDate(p.last_seen_at)}
              </span>
            }
            status={
              <ProfileStatusBadge tone="neutral">
                {tierGroupLabel(p.tier)}
              </ProfileStatusBadge>
            }
          />
        ))}
      </div>
      <ProfileFootnote>
        Every active source record for this supplier — tier, reference, and last
        verified date. A brand mention alone is never enough; at least one Tier
        1–3 source must confirm the factory.
      </ProfileFootnote>
    </ProfileCard>
  );
}

/**
 * Demo row picker for Source records:
 * - One row per source_code (no duplicate BGMEA harvest rows on stage).
 * - Reserve up to 2 slots for real Tier-4 brand-list provenance rows already
 *   on the payload — never invent brands or duplicate codes.
 */
function demoProvenanceRows(
  provenance: readonly Provenance[],
  limit: number,
): Provenance[] {
  const brands: Provenance[] = [];
  const rest: Provenance[] = [];
  for (const row of provenance) {
    if (provenanceTierShort(row.tier) === "t4") brands.push(row);
    else rest.push(row);
  }

  const out: Provenance[] = [];
  const seenCodes = new Set<string>();

  const brandSlots = Math.min(2, new Set(brands.map((b) => b.source_code)).size);

  for (const row of rest) {
    if (out.length >= limit - brandSlots) break;
    if (seenCodes.has(row.source_code)) continue;
    seenCodes.add(row.source_code);
    out.push(row);
  }

  for (const row of brands) {
    if (out.length >= limit) break;
    if (seenCodes.has(row.source_code)) continue;
    seenCodes.add(row.source_code);
    out.push(row);
  }

  for (const row of provenance) {
    if (out.length >= limit) break;
    if (seenCodes.has(row.source_code)) continue;
    seenCodes.add(row.source_code);
    out.push(row);
  }

  return out.slice(0, limit);
}
