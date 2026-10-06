// The buyer's first-run steps (Paper `20 Onboarding` 3 to 5), out of React: the choices, what each step
// asks for and refuses, which step a person is on, and where they start. What each answer lands in is
// `context/feature-specs/ds-v4/onboarding-data-map.md`; the writes are `onboarding_save_buyer` (0109) and
// the settings RPCs. Nothing here reads the database.

import { CERT_KINDS, EMPTY_STATE, serializeDiscoverState, type CertKind } from "@/lib/discover-v32-state";

/** The terms a person accepts by signing up; stamped by the server on their first onboarding save (0109). */
export const TERMS_VERSION = "2026-10-05";

export const STEPS = ["about", "company", "source"] as const;
export type Step = (typeof STEPS)[number];
export const stepOf = (v: string): Step | null => ((STEPS as readonly string[]).includes(v) ? (v as Step) : null);
export const stepLine = (s: Step) => `Step ${STEPS.indexOf(s) + 1} of ${STEPS.length}`;
export const stepHref = (s: Step) => `/onboarding/${s}`;

export const JOB_ROLES = [
  { value: "sourcing", label: "Sourcing" },
  { value: "compliance", label: "Compliance" },
  { value: "merchandising", label: "Merchandising" },
  { value: "founder", label: "Founder or owner" },
  { value: "other", label: "Other" },
] as const;
export type JobRole = (typeof JOB_ROLES)[number]["value"];
export const isJobRole = (v: unknown): v is JobRole => JOB_ROLES.some((r) => r.value === v);

/** Compliance people start on Compliance; everyone else on Search (Paper: "Where you'll start"). */
export const startPath = (role: string | null | undefined): string => (role === "compliance" ? "/app/compliance" : "/app");

export const COMPANY_TYPE_CHOICES = [
  { value: "brand", label: "Brand" },
  { value: "retailer", label: "Retailer" },
  { value: "importer", label: "Importer" },
  { value: "agent", label: "Sourcing agent" },
  { value: "other", label: "Other" },
] as const;
export type CompanyType = (typeof COMPANY_TYPE_CHOICES)[number]["value"];
export const companyTypeLabel = (v: string | null | undefined) => COMPANY_TYPE_CHOICES.find((c) => c.value === v)?.label ?? null;

export const PEOPLE_BANDS = [
  { value: "1-10", label: "1–10" },
  { value: "11-50", label: "11–50" },
  { value: "51-200", label: "51–200" },
  { value: "201-1000", label: "201–1,000" },
  { value: "1000+", label: "1,000+" },
] as const;
export const peopleLabel = (v: string | null | undefined) => PEOPLE_BANDS.find((c) => c.value === v)?.label ?? null;

/** Where buyers are (the markets they sell into first, then the rest alphabetically); ISO 3166-1 alpha-2. */
export const COUNTRIES: readonly { code: string; name: string }[] = [
  { code: "GB", name: "United Kingdom" },
  { code: "US", name: "United States" },
  { code: "CA", name: "Canada" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "NL", name: "Netherlands" },
  { code: "SE", name: "Sweden" },
  { code: "DK", name: "Denmark" },
  { code: "ES", name: "Spain" },
  { code: "IT", name: "Italy" },
  { code: "BE", name: "Belgium" },
  { code: "IE", name: "Ireland" },
  { code: "PL", name: "Poland" },
  { code: "PT", name: "Portugal" },
  { code: "NO", name: "Norway" },
  { code: "FI", name: "Finland" },
  { code: "CH", name: "Switzerland" },
  { code: "AT", name: "Austria" },
  { code: "AU", name: "Australia" },
  { code: "NZ", name: "New Zealand" },
  { code: "JP", name: "Japan" },
  { code: "KR", name: "South Korea" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "IN", name: "India" },
  { code: "BD", name: "Bangladesh" },
  { code: "CN", name: "China" },
  { code: "HK", name: "Hong Kong" },
  { code: "TR", name: "Türkiye" },
  { code: "ZA", name: "South Africa" },
  { code: "MX", name: "Mexico" },
  { code: "BR", name: "Brazil" },
];
export const countryName = (code: string | null | undefined) => COUNTRIES.find((c) => c.code === code)?.name ?? null;
const COUNTRY_CODES = new Set(COUNTRIES.map((c) => c.code));

export const MARKETS = [
  { value: "UK", label: "UK", note: "Your modern slavery statement draft is in Compliance." },
  { value: "EU", label: "EU", note: null },
  { value: "US", label: "US", note: "UFLPA Entity List checks run on the suppliers you save." },
  { value: "CA", label: "Canada", note: null },
] as const;
export type Market = (typeof MARKETS)[number]["value"];

export const CERT_LABELS: Record<CertKind, string> = { gots: "GOTS", oeko_tex: "OEKO-TEX", wrap: "WRAP", sa8000: "SA8000" };
/** Paper's order. */
export const CERT_ORDER: readonly CertKind[] = ["gots", "oeko_tex", "wrap", "sa8000"];
export const isCertKind = (v: unknown): v is CertKind => (CERT_KINDS as readonly string[]).includes(String(v));

export const NAME_MAX = 120;
export const COMPANY_MAX = 200;
export const HS_MAX = 100;

export type Refusal = { field: string; message: string };

export function aboutRefusal(i: { name: string; role: string }): Refusal | null {
  if (!i.name.trim()) return { field: "name", message: "Enter your name." };
  if (i.name.trim().length > NAME_MAX) return { field: "name", message: `Use ${NAME_MAX} characters or fewer.` };
  if (!isJobRole(i.role)) return { field: "role", message: "Choose the work that is closest to yours." };
  return null;
}

export function companyRefusal(i: { company: string; type: string; country: string; people: string }): Refusal | null {
  if (!i.company.trim()) return { field: "company", message: "Enter your company's name." };
  if (i.company.trim().length > COMPANY_MAX) return { field: "company", message: `Use ${COMPANY_MAX} characters or fewer.` };
  if (!COMPANY_TYPE_CHOICES.some((c) => c.value === i.type)) return { field: "type", message: "Choose what your company is." };
  if (!COUNTRY_CODES.has(i.country)) return { field: "country", message: "Choose your country." };
  if (!PEOPLE_BANDS.some((b) => b.value === i.people)) return { field: "people", message: "Choose how many people work at your company." };
  return null;
}

export function sourceRefusal(i: { hs: string[]; certs: string[]; markets: string[] }): Refusal | null {
  if (i.hs.length === 0) return { field: "hs", message: "Choose at least one product." };
  if (i.hs.length > HS_MAX) return { field: "hs", message: `Choose up to ${HS_MAX} products.` };
  if (i.hs.some((h) => !/^[0-9]{4}$/.test(h))) return { field: "hs", message: "One of those products is not an HS heading." };
  if (i.certs.some((c) => !isCertKind(c))) return { field: "certs", message: "One of those certificates is not one we know." };
  if (i.markets.some((m) => !MARKETS.some((x) => x.value === m))) return { field: "markets", message: "One of those markets is not one we cover." };
  return null;
}

/** Four-digit headings from the form's repeated field, in order, once each. */
export function headingsOf(values: readonly FormDataEntryValue[]): string[] {
  return [...new Set(values.map((v) => String(v).trim()).filter((v) => /^[0-9]{4}$/.test(v)))];
}

/** What onboarding_get_buyer answers; every key may be null. */
export type BuyerAnswers = {
  jobRole: JobRole | null;
  termsVersion: string | null;
  country: string | null;
  hs: string[];
  certs: CertKind[];
  markets: Market[];
};

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

/** A reply that is not the shape is null: a half-read answer must never look like "nothing chosen". */
export function parseAnswers(raw: unknown): BuyerAnswers | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  return {
    jobRole: isJobRole(r.job_role) ? r.job_role : null,
    termsVersion: typeof r.terms_version === "string" ? r.terms_version : null,
    country: typeof r.company_country === "string" ? r.company_country : null,
    hs: strings(r.sourcing_hs_headings),
    certs: strings(r.required_cert_kinds).filter(isCertKind),
    markets: strings(r.sell_markets).filter((m): m is Market => MARKETS.some((x) => x.value === m)),
  };
}

export type Progress = { name: string | null; company: string | null; companyType: string | null; people: string | null };

/** The step to show: the first one whose answers are missing; null when all three are in. */
export function firstStep(a: BuyerAnswers, p: Progress): Step | null {
  if (!p.name?.trim() || !a.jobRole) return "about";
  if (!p.company?.trim() || !p.companyType || !p.people || !a.country) return "company";
  if (a.hs.length === 0) return "source";
  return null;
}

/** The search these answers open: the products, and the certificates that have not expired. */
export function sourceSearch(hs: readonly string[], certs: readonly CertKind[]): URLSearchParams {
  return serializeDiscoverState({ ...EMPTY_STATE, hs: [...hs], cert: certs.map((kind) => ({ kind, state: "valid" as const })) });
}

/** The address of the first results: the search above, with the welcome note. */
export function firstResultsHref(hs: readonly string[], certs: readonly CertKind[]): string {
  const q = sourceSearch(hs, certs);
  q.set("welcome", "1");
  return `/app/discover?${q.toString()}`;
}

/** "GOTS", "GOTS or WRAP", "GOTS, WRAP or SA8000". */
export function certWords(certs: readonly CertKind[]): string {
  const names = CERT_ORDER.filter((c) => certs.includes(c)).map((c) => CERT_LABELS[c]);
  return names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} or ${names[names.length - 1]}`;
}
