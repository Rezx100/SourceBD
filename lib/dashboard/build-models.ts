// Builders: RPC payloads → the view models the kit renders (REZ-A).
//
// `buyer_supplier_profile(p_slug)` + `supplier_epb_hscodes(p_slug)` +
// `production_workers_display_batch` feed a card, a table row and the sheet;
// `rfq_list` feeds the RFQ rows. Every rendered value is a real field or
// "Not on file" — nothing is invented, and a read that failed says so instead
// of pretending a field is empty.
//
// Attribution: a fact carries a mark only for the register the payload
// attributes it to — register numbers (`pills`), certificates (`kind`), brand
// lists (`source_code`), RSC safety data and RSC-sourced worker counts (the
// display batch), the mother's address rows (`addresses[].source_code`). The
// profile facts the RPC does not attribute per field (type, established,
// sewing machines, capacity, parent group, product list) render WITHOUT a
// mark and the sheet says "source pending" — a best-guess register is a
// wrong receipt. Wiring the field-level `evidence_claims` rows into these
// marks is REZ-C's FactsPanel work.
//
// RSC: the RPC returns only rows with `active = true`, so every row it
// carries is active; the "no longer covered" state (spec §5) needs the flag
// in the payload and is REZ-C's. A building's row is never shown as the
// mother's: when only building rows are present the mother has no RSC block
// and the tile says which building is covered.

import type { TierRank } from "@/lib/design/tokens";
import {
  certChipLabel,
  certModel,
  certStateLabel,
  certTileSubline,
  displayName,
  entityLabel,
  establishedYearOf,
  formatCount,
  formatDay,
  initials,
  onFileLabel,
  placeLabel,
  rscStatusWords,
  rscTrainingWords,
  sortCerts,
  type CertModel,
} from "./facts";
import { heading4, hsCatalogueRow, hsExporterCount, hsPhotoSrc, hsShortLabel, photoTiles, rarestFirst } from "./hs-photos";
import { groupWorkers, type SiteWorkerInput } from "@/lib/profile-metrics";
import type {
  FactRow,
  FactWithMark,
  HighlightChip,
  ProductSheetModel,
  RfqRowModel,
  SupplierCardModel,
  SupplierSheetModel,
  TableRowModel,
  TileModel,
} from "./models";
import { marksFromTags, sourceMark, topTier, type SourceMarkModel } from "./source-tiers";

// ---- payload shapes (the RPC's jsonb, as `app/(app)/app/suppliers/[slug]/page.tsx` types them) ----

export type ProfileSupplier = {
  id: string;
  slug: string;
  company_name: string;
  entity_type: string;
  city: string | null;
  district: string | null;
  address_raw: string | null;
  is_sanctioned: boolean;
  parent_group_name: string | null;
  established_date: string | null;
  factory_types: string[];
  principal_products: string[];
  employees_total: number | null;
  machines_sewing: number | null;
  production_capacity_pcs_day: number | null;
  production_capacity_dozen_yearly?: number | null;
  supplier_moq?: number | null;
  supplier_lead_time_days?: number | null;
  source_tags: string[];
};

export type ProfilePill = {
  source_code: string;
  label: string;
  value: string | null;
  source_url: string | null;
  building_name?: string | null;
  /** `v_supplier_registry_ids` unions the parent factory's registrations onto a satellite record. */
  inherited_from?: string | null;
  inherited_from_name?: string | null;
};
export type ProfileCert = {
  kind: string;
  certificate_no: string | null;
  issuer: string | null;
  issued_on: string | null;
  expires_on: string | null;
  scope: string | null;
  document_url: string | null;
  building_name?: string | null;
};
export type ProfileRsc = {
  progress_pct: number | null;
  workers_count: number | null;
  remediation_status: string | null;
  training_status: string | null;
  fire_inspection_url: string | null;
  structural_inspection_url: string | null;
  electrical_inspection_url: string | null;
  boiler_inspection_url: string | null;
  cap_url: string | null;
  fetched_at?: string | null;
  building_name?: string | null;
};
export type ProfileBrand = { source_code: string; display_name: string; source_url: string | null; last_seen_at: string };
export type ProfileProvenance = { source_code: string; display_name: string; tier: string; source_ref: string | null; source_url: string | null; last_seen_at: string | null };
export type ProfileAddress = { kind: string; address: string; source_code: string; fetched_at?: string | null };

export type ProfilePayload = {
  supplier: ProfileSupplier;
  t13_source_count: number;
  pills: ProfilePill[];
  certifications: ProfileCert[];
  rsc_remediation: ProfileRsc | ProfileRsc[] | null;
  brand_attributions: ProfileBrand[];
  provenance: ProfileProvenance[];
  addresses?: ProfileAddress[];
};

export type HsLine = { code: string; description: string | null; source_url: string | null };

export type WorkersDisplay = { value: number; source: "RSC" | "registry"; fetched_at?: string | null } | null;

export type RecordInput = {
  profile: ProfilePayload;
  hscodes: HsLine[];
  /** True when `supplier_epb_hscodes` failed: the lines are unknown, not absent. */
  hscodesError?: boolean;
  workers: WorkersDisplay;
  today: Date;
  /** Gallery only: render the sanctioned state on a record that is not sanctioned in production, labelled as a sample. */
  sanctionSample?: boolean;
};

// ---- shared pieces ----

const MEMBERSHIP = ["BGMEA", "BKMEA", "BGAPMEA", "BTMA"];
const MEMBERSHIP_WORDS = "not in BGMEA, BKMEA, BGAPMEA, BTMA or EPB";

/**
 * A registration the record holds in its own right: not a building's, and not
 * unioned in from a parent factory. An inherited pill is the parent's receipt,
 * and printing it here would put another company's register number on this
 * record (v_supplier_registry_ids sets `inherited_from`).
 */
export function ownPill(x: ProfilePill): boolean {
  return !x.building_name && !x.inherited_from;
}

/**
 * Brand lists that have actually been read and hold records. Six are
 * configured in `sources`, but BRAND_INDITEX and BRAND_PRIMARK hold 0
 * companies (SQL, 19 Sep 2026: ASOS 43 · H&M 199 · M&S 67 · NEXT 76 ·
 * Inditex 0 · Primark 0), so a record absent from all of them is absent from
 * four lists, not six — ds-rebuild-must-stay §3 calls the other two "silent
 * so far", and claiming they were checked is a negative without a read.
 */
const BRAND_LISTS_WITH_RECORDS = 4;
const BRAND_LISTS_WORDS = `not on ${BRAND_LISTS_WITH_RECORDS} brand lists read`;
const CERT_REGISTERS = 4;

/** The mother's own RSC row — never a building's. */
export function motherRsc(raw: ProfilePayload["rsc_remediation"]): ProfileRsc | null {
  if (!raw) return null;
  const rows = Array.isArray(raw) ? raw : [raw];
  return rows.find((s) => !s.building_name) ?? null;
}

/** Building rows the RPC carries (labelled group figures, REZ-73). */
export function buildingRsc(raw: ProfilePayload["rsc_remediation"]): ProfileRsc[] {
  if (!raw) return [];
  const rows = Array.isArray(raw) ? raw : [raw];
  return rows.filter((s) => Boolean(s.building_name));
}

/** Every source code the record carries: tags, register pills, certificates, brand lists, provenance. */
export function allSourceCodes(p: ProfilePayload): string[] {
  const codes = new Set<string>();
  for (const t of p.supplier.source_tags ?? []) codes.add(t.toUpperCase());
  for (const pill of p.pills ?? []) if (ownPill(pill)) codes.add(pill.source_code.toUpperCase());
  // A building's certificate belongs to the building; counting it here while the
  // Certificates section (which filters buildings out) says "none" contradicts itself.
  for (const c of p.certifications ?? []) if (!c.building_name) codes.add(c.kind.toUpperCase());
  for (const b of p.brand_attributions ?? []) codes.add(b.source_code.toUpperCase());
  for (const r of p.provenance ?? []) codes.add(r.source_code.toUpperCase());
  return [...codes];
}

/** The page each source links to: the register pill's page first, else the provenance row's, else the brand list's. */
export function sourceHrefs(p: ProfilePayload): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  const put = (code: string, url: string | null | undefined) => {
    const k = code.toUpperCase();
    if (!out[k] && recordPage(url)) out[k] = url!;
  };
  // A pill's URL is this record's own page, so it wins over the provenance row's,
  // which is often the agency's front page.
  for (const pill of p.pills ?? []) if (ownPill(pill)) put(pill.source_code, pill.source_url);
  for (const b of p.brand_attributions ?? []) put(b.source_code, b.source_url);
  for (const r of p.provenance ?? []) put(r.source_code, r.source_url);
  return out;
}

/**
 * Whether a URL is a page about THIS record rather than the register's front
 * door. A mark reads "opens the register page", so an agency homepage is not
 * a receipt — the same rule `lib/epb-hscodes.ts` applies to the EPB pill.
 */
export function recordPage(url: string | null | undefined): boolean {
  if (!url || !/^https?:\/\//i.test(url)) return false;
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/\/+$/, "");
    return path !== "" && path !== "/" && (/\d/.test(path) || u.search !== "" || /\.(?:pdf|xlsx|xls|csv)$/i.test(path));
  } catch {
    return false;
  }
}

function mark(p: ProfilePayload, code: string): SourceMarkModel {
  return sourceMark(code, sourceHrefs(p)[code.toUpperCase()] ?? null);
}

function isoTime(v: string | null | undefined): number {
  const t = v ? Date.parse(v) : NaN;
  return Number.isNaN(t) ? -1 : t;
}

/** Whether the record is on the EPB exporter register at all (a register number or an EPB provenance row). */
export function hasEpbRecord(p: ProfilePayload): boolean {
  return (p.pills ?? []).some((x) => x.source_code.toUpperCase() === "EPB" && ownPill(x)) || (p.provenance ?? []).some((r) => r.source_code.toUpperCase() === "EPB");
}

/** The latest read date of one register, or null when the register holds no record. */
export function readDateOf(p: ProfilePayload, code: string): string | null {
  const rows = (p.provenance ?? []).filter((r) => r.source_code.toUpperCase() === code.toUpperCase());
  const latest = rows.reduce<number>((m, r) => Math.max(m, isoTime(r.last_seen_at)), -1);
  return latest < 0 ? null : formatDay(new Date(latest).toISOString());
}

function latestReadDate(p: ProfilePayload): string | null {
  const latest = (p.provenance ?? []).reduce<number>((m, r) => Math.max(m, isoTime(r.last_seen_at)), -1);
  return latest < 0 ? null : formatDay(new Date(latest).toISOString());
}

function sameAddress(a: string | null | undefined, b: string | null | undefined): boolean {
  const norm = (v: string | null | undefined) => (v ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return norm(a) !== "" && norm(a) === norm(b);
}

/**
 * The register that filed the mother's own factory address — only when the
 * RPC's `addresses[]` holds a row of kind `factory` (never an inherited or
 * mailing row) whose text is the address shown. Otherwise the address is an
 * unattributed profile fact.
 */
function addressMark(p: ProfilePayload): SourceMarkModel | null {
  const row = (p.addresses ?? []).find((a) => a.kind === "factory" && a.source_code && sameAddress(a.address, p.supplier.address_raw));
  return row ? mark(p, row.source_code) : null;
}

/**
 * The worker figure, and how many sites it covers.
 *
 * `production_workers_display_batch` returns one number for the whole group —
 * for Aboni that is 2,662 (the mother) + 504 (the New Shed) = 3,166, and for
 * S M Knitwears it is the Extension building's 907 while the mother itself has
 * no RSC row at all. Printed bare under a single RSC mark, both read as this
 * one site's headcount. `lib/profile-metrics.ts` is the rule the production
 * profile already uses ("3,166 across 2 of 2 sites"); the kit reads the same
 * RSC rows through it so the two surfaces cannot drift apart.
 *
 * Coverage is claimed only when the site sum reconciles with the figure the
 * RPC returned. If they disagree the number is still shown — it is the RPC's —
 * but the kit does not invent a coverage sentence for it.
 */
export type WorkersFact = {
  value: number | null;
  source: "RSC" | "registry" | null;
  /** "2 of 2 sites" when the figure is a group sum; null when it is one site's. */
  coverage: string | null;
  /** Sites the figure leaves out, named. */
  excluded: string[];
};

function workerSites(input: RecordInput): SiteWorkerInput[] {
  const p = input.profile;
  const s = p.supplier;
  const mother = motherRsc(p.rsc_remediation);
  return [
    {
      label: displayName(s.company_name),
      employees_total: s.employees_total,
      rsc_workers_count: mother?.workers_count ?? null,
      rsc_fetched_at: mother?.fetched_at ?? null,
    },
    ...buildingRsc(p.rsc_remediation).map((b) => ({
      label: b.building_name ?? "building",
      employees_total: null,
      rsc_workers_count: b.workers_count ?? null,
      rsc_fetched_at: b.fetched_at ?? null,
    })),
  ];
}

export function workersFact(input: RecordInput): WorkersFact {
  const sites = workerSites(input);
  const group = groupWorkers(sites);
  const batch = input.workers;
  const value = batch?.value ?? group.value ?? input.profile.supplier.employees_total ?? null;
  const source = batch?.source ?? group.source ?? null;
  const reconciled = batch != null && group.value === batch.value;
  const multi = sites.length > 1 && reconciled;
  return {
    value,
    source: value === null ? null : source,
    coverage: multi ? `${group.includedCount} of ${group.totalCount} sites` : null,
    excluded: multi ? group.excludedLabels : [],
  };
}

function metaFacts(input: RecordInput, options: { registerNumber?: boolean } = {}): FactWithMark[] {
  const s = input.profile.supplier;
  const p = input.profile;
  const facts: FactWithMark[] = [{ text: entityLabel(s.entity_type), mark: null }];
  const place = placeLabel(s.city, s.district);
  const year = establishedYearOf(s.established_date);
  const w = workersFact(input);
  const workersMark = w.source === "RSC" ? mark(p, "RSC") : null;
  // City and district are derived fields (EPB → GOTS → the address text); no register is attributed to them.
  if (place) facts.push({ text: place, mark: null });
  const missing: string[] = [];
  if (year) facts.push({ text: `Est. ${year}`, mark: null });
  else missing.push("year");
  if (w.value !== null) {
    // A group sum is never printed bare: "3,166 workers" on a mother whose
    // figure is mother + buildings reads as this site's headcount.
    const words = `${formatCount(w.value)} workers${w.coverage ? ` across ${w.coverage}` : ""}`;
    facts.push({ text: words, mark: workersMark });
  } else missing.push("workers");
  if (!place) missing.unshift("district");
  if (options.registerNumber) {
    const pill = (p.pills ?? []).find((x) => x.source_code.toUpperCase() === "BGMEA" && x.value && ownPill(x));
    if (pill?.value) facts.push({ text: `BGMEA ${pill.value}`, mark: mark(p, "BGMEA"), code: true });
  }
  if (missing.length > 0) {
    const words = missing.length === 1 ? `${cap(missing[0]!)} not on file` : `${cap(missing.slice(0, -1).join(", "))} and ${missing.at(-1)} not on file`;
    facts.push({ text: words, mark: null, quiet: true });
  }
  return facts;
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function certs(input: RecordInput): CertModel[] {
  return sortCerts((input.profile.certifications ?? []).filter((c) => !c.building_name).map((c) => certModel(c, input.today)));
}

/** Buildings that hold a certificate of their own, named so the record does not appear to hold it. */
export function certBuildings(p: ProfilePayload): string[] {
  return [...new Set((p.certifications ?? []).map((c) => c.building_name).filter((b): b is string => Boolean(b)))];
}

/** Buildings that hold a register pill of their own (RSC aside — the Safety section names those). */
export function pillBuildings(p: ProfilePayload): string[] {
  return [...new Set((p.pills ?? []).filter((x) => x.building_name && x.source_code.toUpperCase() !== "RSC").map((x) => x.building_name!))];
}

/**
 * One label per brand list. Migration 0099 unions a facility's rows into
 * `brand_attributions`, so the same list can appear twice for one record; the
 * count beside it says how many LISTS name the record, not how many rows.
 */
function brandLabels(p: ProfilePayload): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const b of p.brand_attributions ?? []) {
    const code = b.source_code.toUpperCase();
    if (seen.has(code)) continue;
    seen.add(code);
    out.push(sourceMark(b.source_code).label);
  }
  return out;
}

/**
 * "Not in BGMEA, BKMEA, BGAPMEA, BTMA or EPB" — and, when a building of this
 * record does hold one, who. Printing the bare negative while the payload
 * carries a building's pill is a negative the data does not support.
 */
export function registersEmptyWords(p: ProfilePayload): string {
  const buildings = pillBuildings(p);
  if (buildings.length === 0) return MEMBERSHIP_WORDS;
  return `${MEMBERSHIP_WORDS}; registered under ${buildings.join(", ")}`;
}

/**
 * "None on 4 registers" — and, when a building holds a certificate, who. The
 * building's certificate is not counted as this record's (`allSourceCodes`),
 * so the section must say where it is rather than claim there is none.
 */
export function certsEmptyWords(p: ProfilePayload): string {
  const buildings = certBuildings(p);
  if (buildings.length === 0) return `none on ${CERT_REGISTERS} registers`;
  return `none on this record · ${buildings.join(", ")} ${buildings.length === 1 ? "holds one" : "hold one"}`;
}

/** The register pills (BGMEA, BKMEA, BGAPMEA, BTMA, EPB), best rank first; every registration is kept (a record can hold two EPB numbers). */
function registerPills(p: ProfilePayload): ProfilePill[] {
  const seen = new Set<string>();
  return (p.pills ?? [])
    .filter((x) => ownPill(x) && MEMBERSHIP.concat("EPB").includes(x.source_code.toUpperCase()))
    .filter((x) => {
      const k = `${x.source_code.toUpperCase()}|${x.value ?? ""}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .sort((a, b) => sourceMark(a.source_code).tier - sourceMark(b.source_code).tier || a.source_code.localeCompare(b.source_code) || (a.value ?? "").localeCompare(b.value ?? ""));
}

/** Distinct registers among the pills, best rank first. */
function registerCodes(pills: readonly ProfilePill[]): string[] {
  return [...new Set(pills.map((x) => x.source_code.toUpperCase()))];
}

/** The EPB exporter page the record links to, with the exporter id read from that same URL. */
function epbExporter(p: ProfilePayload): { href: string; ref: string | null; readDate: string | null; pages: number } | null {
  const pills = (p.pills ?? []).filter((x) => x.source_code.toUpperCase() === "EPB" && ownPill(x) && x.source_url);
  const pill = pills[0];
  if (!pill?.source_url) return null;
  const ref = /\/exporter\/(\d+)\b/.exec(pill.source_url)?.[1] ?? null;
  // The read date must be the read of THIS exporter page, not the register's
  // latest read — a record can hold two exporter pages read on different days.
  const row = (p.provenance ?? []).find((r) => r.source_code.toUpperCase() === "EPB" && ref !== null && r.source_ref === ref);
  const readDate = row?.last_seen_at ? formatDay(row.last_seen_at) : null;
  return { href: pill.source_url, ref, readDate, pages: pills.length };
}

/** Distinct 4-digit headings of the record's export lines. */
function headings(input: RecordInput): string[] {
  return rarestFirst(input.hscodes.map((h) => h.code));
}

function rscChip(rsc: ProfileRsc | null, buildings: ProfileRsc[]): HighlightChip | null {
  if (rsc) {
    // `progress_pct` absent from the row (undefined) is not 0 %: Math.round of
    // it is NaN, and "NaN %" reached the chip and aria-valuenow.
    const pct = Number.isFinite(rsc.progress_pct) ? `${Math.round(rsc.progress_pct as number)} %` : null;
    const status = rscStatusWords(rsc.remediation_status);
    const behind = /behind|not implemented/i.test(status ?? "");
    return {
      tone: behind ? "caution" : "positive",
      icon: "shield",
      label: ["RSC active", pct === "100 %" ? "100 % remediated" : pct, behind ? status : null].filter(Boolean).join(" · "),
    };
  }
  if (buildings.length > 0) {
    const first = buildings[0]!;
    return { tone: "neutral", icon: "shield", label: `RSC covers ${first.building_name}${buildings.length > 1 ? ` +${buildings.length - 1}` : ""}` };
  }
  return null;
}

// ---- the card ----

export function buildCard(input: RecordInput): SupplierCardModel {
  const p = input.profile;
  const s = p.supplier;
  const codes = allSourceCodes(p);
  const hrefs = sourceHrefs(p);
  const marks = marksFromTags(codes, hrefs);
  const name = displayName(s.company_name);
  const certList = certs(input);
  const rsc = motherRsc(p.rsc_remediation);
  const buildings = buildingRsc(p.rsc_remediation);
  const lines = headings(input);
  const brands = brandLabels(p);
  const registers = registerPills(p);
  const sanctioned = s.is_sanctioned || Boolean(input.sanctionSample);
  const epbRead = readDateOf(p, "EPB");

  const chips: HighlightChip[] = [];
  for (const c of certList.slice(0, 2)) {
    chips.push({
      tone: c.state === "valid" ? "positive" : c.state === "no-expiry" ? "neutral" : "caution",
      icon: c.state === "valid" ? "check-c" : c.state === "expiring" ? "clock" : c.state === "expired" ? "warn" : undefined,
      label: certChipLabel(c),
    });
  }
  const rc = rscChip(rsc, buildings);
  if (rc) chips.push(rc);
  const onEpb = hasEpbRecord(p);
  if (input.hscodesError) chips.push({ tone: "quiet", label: "EPB lines could not be read" });
  else if (lines.length > 0) chips.push({ tone: "neutral", label: `EPB exporter · ${lines.length} ${lines.length === 1 ? "line" : "lines"}` });
  else if (onEpb) chips.push({ tone: "quiet", label: "EPB exporter · no lines on file" });
  else chips.push({ tone: "quiet", label: "Not on the EPB exporter list" });
  if (brands.length > 0) chips.push({ tone: "neutral", label: `Listed by ${brands.join(", ")}` });
  if (certList.length === 0) chips.push({ tone: "quiet", label: "No certificate on any register" });
  const bgmea = registers.find((r) => r.source_code.toUpperCase() === "BGMEA");
  if (marks.length <= 1 && bgmea) chips.unshift({ tone: "neutral", label: bgmea.label.replace(/\s*#\s*$/, "").replace(/^BGMEA General member$/, "BGMEA general member") });
  if (marks.length <= 1) chips.push({ tone: "quiet", label: `Nothing else on file · ${marks.length} of 25 sources` });
  const shown = chips.slice(0, 5);
  const moreChips = Math.max(0, chips.length - shown.length + Math.max(0, certList.length - 2));

  const epb = epbExporter(p);
  // A tile's sub-line opens the record at that section. The results panel has
  // no #certificates / #sources of its own, so a bare fragment went nowhere.
  const recordHref = `/app/suppliers/${s.slug}`;
  const tiles: [TileModel, TileModel, TileModel, TileModel] = [
    certList.length > 0
      ? { label: "Certificates", value: onFileLabel(certList.length), sub: certTileSubline(certList), href: `${recordHref}#certificates` }
      : { label: "Certificates", value: null, sub: certsEmptyWords(p) },
    input.hscodesError
      ? { label: "Export lines", value: null, sub: "EPB could not be read" }
      : lines.length > 0
        ? { label: "Export lines", value: `${lines.length} HS ${lines.length === 1 ? "line" : "lines"}`, sub: "EPB exporter page", href: epb?.href ?? `${recordHref}#products` }
        : onEpb
          ? { label: "Export lines", value: null, sub: "none on the EPB page", href: epb?.href ?? null }
          : { label: "Export lines", value: null, sub: "not on the EPB list" },
    brands.length > 0
      ? { label: "Listed by", value: brands.join(", "), sub: `${brands.length} brand ${brands.length === 1 ? "list" : "lists"}`, href: `${recordHref}#sources` }
      : { label: "Listed by", value: null, sub: BRAND_LISTS_WORDS },
    registerCodes(registers).length > 1
      ? { label: "Registers", value: `${registerCodes(registers).length} registers`, sub: registerCodes(registers).map((c) => sourceMark(c).label).join(" · "), href: `${recordHref}#sources` }
      : registers.length === 1 && registers[0]
        ? {
            label: "Registers",
            value: `${sourceMark(registers[0].source_code).label} ${registers[0].value ?? ""}`.trim(),
            sub: registers[0].label.replace(/\s*#\s*$/, "").replace(/^BGMEA\s+/i, "").toLowerCase(),
            href: recordPage(registers[0].source_url) ? registers[0].source_url : `${recordHref}#sources`,
          }
        : { label: "Registers", value: null, sub: registersEmptyWords(p) },
  ];

  return {
    slug: s.slug,
    name,
    initials: initials(name),
    topTier: topTier(codes),
    marks,
    meta: metaFacts(input),
    sanctioned,
    sanctionSample: input.sanctionSample,
    chips: shown,
    moreChips,
    tiles,
    photos: input.hscodesError ? [] : photoTiles(lines, 6),
    totalLines: lines.length,
    linesUnknown: Boolean(input.hscodesError),
    epbReadDate: epbRead,
    why: null,
  };
}

// ---- the table row ----

export function buildTableRow(input: RecordInput): TableRowModel {
  const p = input.profile;
  const s = p.supplier;
  const codes = allSourceCodes(p);
  const hrefs = sourceHrefs(p);
  const lines = headings(input);
  const certList = certs(input);
  const name = displayName(s.company_name);
  const w = workersFact(input);
  return {
    slug: s.slug,
    name,
    place: placeLabel(s.city, s.district),
    initials: initials(name),
    topTier: topTier(codes),
    sourceCount: marksFromTags(codes).length,
    marks: marksFromTags(codes, hrefs),
    certs: certList,
    certsEmptyReason: certList.length === 0 ? certsEmptyWords(p) : null,
    photos: input.hscodesError ? [] : photoTiles(lines, 3),
    totalLines: lines.length,
    // On the EPB register with no lines is not the same fact as absent from it.
    linesEmptyReason: input.hscodesError
      ? "EPB could not be read"
      : lines.length > 0
        ? null
        : hasEpbRecord(p)
          ? "no lines on the EPB page"
          : "not on EPB list",
    type: entityLabel(s.entity_type),
    workers: w.value,
    workersCoverage: w.coverage,
    sanctioned: s.is_sanctioned || Boolean(input.sanctionSample),
    sanctionSample: input.sanctionSample,
  };
}

// ---- the sheet ----

export type SheetOptions = {
  /** The viewer's plan name, from settings; without one the contact card says only "Contact details". */
  plan?: string | null;
};

export function buildSheet(input: RecordInput, options: SheetOptions = {}): SupplierSheetModel {
  const p = input.profile;
  const s = p.supplier;
  const codes = allSourceCodes(p);
  const hrefs = sourceHrefs(p);
  const marks = marksFromTags(codes, hrefs);
  const name = displayName(s.company_name);
  const certList = certs(input);
  const rsc = motherRsc(p.rsc_remediation);
  const buildings = buildingRsc(p.rsc_remediation);
  const lines = headings(input);
  const brands = brandLabels(p);
  const registers = registerPills(p);
  const epb = epbExporter(p);
  const w = workersFact(input);
  const workersMark = w.source === "RSC" ? mark(p, "RSC") : null;
  const registerRows = registers.filter((r) => r.value);
  const gots = certList.find((c) => c.kind.toUpperCase() === "GOTS" && c.state !== "expired");
  const addresses = (p.addresses ?? []).length;
  const addrMark = addressMark(p);
  const capacity =
    s.production_capacity_pcs_day
      ? `${formatCount(s.production_capacity_pcs_day)} pcs/day`
      : s.production_capacity_dozen_yearly
        ? `${formatCount(s.production_capacity_dozen_yearly)} dozen/year`
        : null;

  const pending = (value: string | null, m: SourceMarkModel | null = null, checked = "registers checked"): Pick<FactRow, "value" | "marks" | "pendingSource" | "checked"> =>
    value === null ? { value, marks: [], checked } : m ? { value, marks: [m] } : { value, marks: [], pendingSource: true };

  const facts: FactRow[] = [
    { label: "Registered name", ...pending(s.company_name) },
    { label: "Type", ...pending([entityLabel(s.entity_type), s.factory_types?.length ? s.factory_types.join(", ") : null].filter(Boolean).join(" · ")) },
    { label: "Parent group", ...pending(s.parent_group_name, null, "registers and RSC checked") },
    { label: "Factory address", ...pending(s.address_raw, addrMark) },
    { label: "Established", ...pending(establishedYearOf(s.established_date)) },
    {
      label: "Workers",
      ...pending(w.value !== null ? formatCount(w.value) : null, workersMark, "registers and RSC checked"),
      note: w.coverage ? [`across ${w.coverage}`, w.excluded.length ? `excluded: ${w.excluded.join(", ")}` : null].filter(Boolean).join(" · ") : null,
    },
    { label: "Sewing machines", ...pending(formatCount(s.machines_sewing)) },
    { label: "Capacity, as filed", ...pending(capacity) },
    {
      label: "Registers",
      value: registerRows.length ? registerRows.map((r) => `${r.label.replace(/\s*#\s*$/, "").replace(/ member$/i, "")} ${r.value}`).join(" · ") : null,
      code: true,
      checked: registersEmptyWords(p),
      marks: registerCodes(registerRows).map((c) => sourceMark(c, registerRows.find((r) => r.source_code.toUpperCase() === c)?.source_url ?? null)),
    },
  ];

  const readDates = (p.provenance ?? [])
    .reduce<{ code: string; at: number }[]>((acc, r) => {
      const code = r.source_code.toUpperCase();
      const at = isoTime(r.last_seen_at);
      if (at < 0) return acc;
      const existing = acc.find((a) => a.code === code);
      if (existing) existing.at = Math.max(existing.at, at);
      else acc.push({ code, at });
      return acc;
    }, [])
    .sort((a, b) => sourceMark(a.code).tier - sourceMark(b.code).tier || a.code.localeCompare(b.code))
    .map((r) => `${sourceMark(r.code).label} ${formatDay(new Date(r.at).toISOString())}`)
    .join(" · ");

  const certRegisters = [...new Set(certList.map((c) => c.scheme.split(" ")[0]))];

  return {
    slug: s.slug,
    name,
    initials: initials(name),
    topTier: topTier(codes),
    marks,
    meta: metaFacts(input, { registerNumber: true }),
    readDate: latestReadDate(p),
    sourceCount: marks.length,
    pagesUnchanged: null,
    sanctioned: s.is_sanctioned || Boolean(input.sanctionSample),
    sanctionSample: input.sanctionSample,
    // Only the four sections this sheet renders get a fragment; Sources,
    // Locations, Facilities and RFQs arrive with REZ-C, and until they do a
    // link to #sources is a link to nothing.
    tabs: [
      { label: "Overview", count: null, href: "#overview", active: true },
      { label: "Products", count: input.hscodesError ? null : String(lines.length), href: "#products" },
      { label: "Certificates", count: String(certList.length), href: "#certificates" },
      { label: "Safety", count: rsc ? "RSC" : null, href: "#safety" },
      { label: "Sources", count: String(marks.length), href: null },
      { label: "Locations", count: p.addresses ? String(addresses) : null, href: null },
      { label: "Facilities", count: null, href: null },
      { label: "RFQs", count: null, href: null },
    ],
    summary: null,
    facts,
    contact: {
      // The RPC returns neither the values nor their counts; the claim is plan-level only.
      hidden: "Contact details are shown on paid plans.",
      plan: options.plan ?? null,
    },
    readDates: readDates || null,
    products: {
      lines: lines.length,
      linesUnknown: Boolean(input.hscodesError),
      onEpb: hasEpbRecord(p),
      exporterHref: epb?.href ?? null,
      exporterRef: epb?.ref ?? null,
      // A supplier's lines can span two chapters (S M Knitwears exports 61 and
      // 62); naming only the rarest line's chapter silently drops the rest.
      chapters: [...new Set(lines.map((l) => l.slice(0, 2)))].sort(),
      productListCount: (s.principal_products ?? []).length,
      certifiedScope: gots ? { scheme: gots.scheme, scope: scopeWords(gots.scope) } : null,
      buyerLists: brands,
      tiles: input.hscodesError ? [] : photoTiles(lines, 6),
    },
    certs: certList,
    certsCaption: certList.length ? `${onFileLabel(certList.length)} · ${certRegisters.join(", ")}` : null,
    certBuildings: certBuildings(p),
    rsc: rsc
      ? {
          ref: (p.pills ?? []).find((x) => x.source_code.toUpperCase() === "RSC" && ownPill(x))?.value ?? null,
          readDate: formatDay(rsc.fetched_at) ?? readDateOf(p, "RSC"),
          progress: Number.isFinite(rsc.progress_pct) ? Math.round(rsc.progress_pct as number) : null,
          status: rscStatusWords(rsc.remediation_status),
          training: rscTrainingWords(rsc.training_status),
          links: [
            { label: "Fire", href: rsc.fire_inspection_url },
            { label: "Structural", href: rsc.structural_inspection_url },
            { label: "Electrical", href: rsc.electrical_inspection_url },
            { label: "Boiler", href: rsc.boiler_inspection_url },
            { label: "CAP", href: rsc.cap_url },
          ],
        }
      : null,
    rscBuildings: buildings.map((b) => b.building_name ?? "building"),
  };
}

/**
 * "Operations: Dyeing, Knitting, … | Products: Men's apparel, …" →
 * "dyeing, knitting, manufacturing +7 · products: men's apparel".
 *
 * The `Products:` half is the only part that says what the certificate covers,
 * so it is never dropped, and a truncated operation list says how many it left
 * out instead of ending silently at three.
 */
const SCOPE_SHOWN = 3;

function scopeList(raw: string): string[] {
  return raw
    .split(",")
    .map((w) => w.trim().toLowerCase())
    .filter(Boolean);
}

function scopeShorten(items: string[]): string {
  return items.length > SCOPE_SHOWN ? `${items.slice(0, SCOPE_SHOWN).join(", ")} +${items.length - SCOPE_SHOWN}` : items.join(", ");
}

function scopeWords(scope: string | null): string {
  if (!scope) return "";
  const ops = /Operations:\s*([^|]+)/i.exec(scope)?.[1] ?? null;
  const products = /Products:\s*([^|]+)/i.exec(scope)?.[1] ?? null;
  if (!ops && !products) return scopeShorten(scopeList(scope));
  return [ops ? scopeShorten(scopeList(ops)) : null, products ? `products: ${scopeShorten(scopeList(products))}` : null]
    .filter(Boolean)
    .join(" · ");
}

// ---- the product sheet ----

export function buildProductSheet(input: RecordInput, hs: string): ProductSheetModel {
  const p = input.profile;
  const s = p.supplier;
  const code = heading4(hs);
  const line = input.hscodes.find((h) => heading4(h.code) === code) ?? null;
  const exported = line !== null;
  const row = hsCatalogueRow(code);
  const others = headings(input).filter((c) => c !== code).sort();
  const certList = certs(input);
  // The certified scope shown is a GOTS scope certificate; WRAP and OEKO-TEX carry no line scope.
  const gots = certList.find((c) => c.kind.toUpperCase() === "GOTS" && c.state !== "expired") ?? null;
  const brands = brandLabels(p);
  const brandMarks = (p.brand_attributions ?? []).map((b) => sourceMark(b.source_code, b.source_url));
  const epb = epbExporter(p);
  const ep = mark(p, "EPB");
  const products = s.principal_products ?? [];
  const attested = [
    s.supplier_moq ? `MOQ ${formatCount(s.supplier_moq)}` : null,
    s.supplier_lead_time_days ? `lead time ${formatCount(s.supplier_lead_time_days)} days` : null,
  ].filter(Boolean);
  return {
    supplierName: displayName(s.company_name),
    sanctioned: s.is_sanctioned || Boolean(input.sanctionSample),
    sanctionSample: input.sanctionSample,
    hs: code,
    // The eyebrow may only call this an EPB export line when the record's own
    // EPB page carries it; otherwise it is a heading the buyer arrived at.
    exported,
    heading: line?.description ?? row?.heading ?? hsShortLabel(code),
    photo: { hs: code, short: hsShortLabel(code), src: hsPhotoSrc(code, 512), thumb: hsPhotoSrc(code, 128) },
    generatedOn: null,
    facts: [
      // The chapter name is the HS nomenclature, not something EPB published
      // about this record: stamping it with an EPB mark is a wrong receipt,
      // and it was stamped even for a record on no EPB register at all.
      { label: "Chapter", value: `${code.slice(0, 2)} · ${chapterName(code.slice(0, 2))}`, marks: [], note: "HS nomenclature" },
      {
        label: "Exporter page",
        value: exported && epb ? `edb.epb.gov.bd · exporter ${epb.ref ?? ""}`.trim() : null,
        href: exported ? (epb?.href ?? null) : null,
        note: exported && readDateOf(p, "EPB") ? `read ${readDateOf(p, "EPB")}` : null,
        checked: exported ? "EPB checked" : "this line is not on the record's EPB page",
        marks: exported && epb ? [ep] : [],
      },
      { label: "Exporting since", value: null, note: "EPB lists lines, not dates" },
      { label: "Other lines", value: others.length ? others.join(" · ") : null, code: true, checked: "EPB checked", marks: others.length ? [ep] : [] },
      gots
        ? {
            label: "Certified scope",
            value: `${gots.number ?? gots.scheme} · ${scopeWords(gots.scope)}`,
            // `certChipLabel` reads "GOTS · no expiry on file"; stripping the
            // scheme alone left the badge starting with a stray middle dot.
            badge: { tone: gots.state === "valid" ? "positive" : gots.state === "no-expiry" ? "type" : "caution", label: certStateLabel(gots) },
            marks: [sourceMark(gots.markCode, gots.documentUrl)],
          }
        : { label: "Certified scope", value: null, checked: `${CERT_REGISTERS} cert registers checked` },
      {
        label: "Product list",
        value: products.length ? products.slice(0, 4).join(" · ") : null,
        note: products.length > 4 ? `+${products.length - 4} items` : null,
        checked: "registers checked",
        marks: [],
        pendingSource: products.length > 0,
      },
      { label: "Buyer lists", value: brands.length ? brands.join(" · ") : null, note: brands.length ? "disclosure lists" : null, checked: BRAND_LISTS_WORDS, marks: brandMarks },
      attested.length
        ? { label: "Price · MOQ · lead time", value: attested.join(" · "), note: "supplier-attested", marks: [], pendingSource: true }
        : { label: "Price · MOQ · lead time", value: null, note: "supplier-attested fields, shown when attested" },
    ],
    otherExporters: row && exported ? Math.max(0, hsExporterCount(code) - 1) : null,
  };
}

const CHAPTERS: Record<string, string> = {
  "42": "Articles of leather; travel goods, handbags",
  "60": "Knitted or crocheted fabrics",
  "61": "Articles of apparel, knitted or crocheted",
  "62": "Articles of apparel, not knitted or crocheted",
  "63": "Other made-up textile articles",
  "65": "Headgear and parts thereof",
};

function chapterName(ch: string): string {
  return CHAPTERS[ch] ?? "HS chapter";
}

// ---- RFQ rows ----

export type RfqListRow = {
  id: string;
  product_title: string;
  quantity: number;
  quantity_unit: string;
  ship_by: string | null;
  status: "open" | "accepted" | "closed" | "cancelled";
  target_supplier_count: number;
  quote_count: number;
  created_at: string;
};

export function buildRfqRow(
  r: RfqListRow,
  /** Resolved target, when REZ-D's join gives one. A sanction on it must reach this row (spec §2). */
  supplier: { name: string; tier: TierRank; sanctioned?: boolean; sanctionSample?: boolean } | null,
  today: Date,
): RfqRowModel {
  // "Reply overdue" needs the reply-by date and the thread (REZ-D's derived_status); `rfq_list`
  // carries neither, so an open RFQ without a quote is "awaiting reply" whatever the ship-by date.
  void today;
  const status: RfqRowModel["status"] =
    r.status === "accepted"
      ? { tone: "positive", label: "Quote accepted", icon: "check-c" }
      : r.status === "closed" || r.status === "cancelled"
        ? { tone: "type", label: r.status === "closed" ? "Closed" : "Cancelled" }
        : r.quote_count > 0
          ? { tone: "positive", label: `Quoted · ${r.quote_count}`, icon: "check-c" }
          : { tone: "positive", label: "Sent · awaiting reply", icon: "send" };
  const count = Math.max(1, r.target_supplier_count);
  return {
    id: r.id,
    name: r.product_title,
    hs: null,
    supplierName: supplier?.name ?? null,
    supplierInitials: supplier ? initials(supplier.name) : null,
    supplierTier: supplier?.tier ?? null,
    supplierCount: count,
    sanctioned: Boolean(supplier?.sanctioned) || Boolean(supplier?.sanctionSample),
    sanctionSample: supplier?.sanctionSample,
    quantity: `${formatCount(r.quantity)} ${r.quantity_unit}`,
    status,
    sent: formatDay(r.created_at),
    shipBy: formatDay(r.ship_by),
    action: "Open",
  };
}
