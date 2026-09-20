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
  rscStatusNeedsLook,
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
import { mergeUniqueLocations } from "@/lib/dedup-addresses";
import { marksFromTags, recordPage, sourceMark, topTier, type SourceMarkModel } from "./source-tiers";

export { recordPage } from "./source-tiers";

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
export type ProfileBrand = {
  source_code: string;
  display_name: string;
  source_url: string | null;
  last_seen_at: string;
  /** `buyer_supplier_profile` unions a `facility_of` child's brand rows onto the mother, labelled. */
  building_name?: string | null;
};
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
 * A brand list that names THIS record. `buyer_supplier_profile` unions a
 * building's brand rows onto the mother the same way it unions pills and
 * certificates; eight published mothers carry brand rows that are entirely a
 * building's, and printing them says the company is on a disclosure list it is
 * not on — and adds tier-4 squares to its source count.
 */
export function ownBrand(b: ProfileBrand): boolean {
  return !b.building_name;
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
/**
 * Registers that have actually been read and hold records. `sources` holds 25
 * rows, and 11 of them have never produced a `source_records` row for anybody
 * (SQL, 20 Sep 2026: BEPZA, DIFE, RJSC, BRAND_INDITEX, BRAND_PRIMARK, EU_SANC,
 * ILAB, OFAC, UFLPA, UK_OFSI, US_WRO — all 0). "1 of 25 sources" therefore
 * claimed the record had been weighed against 25 registers when 14 had been
 * read, on 6,708 published records — the same standard that makes the brand
 * negative say "4 brand lists read" rather than 6.
 */
const SOURCES_WITH_RECORDS = 14;
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
  for (const b of p.brand_attributions ?? []) if (ownBrand(b)) codes.add(b.source_code.toUpperCase());
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
  for (const b of p.brand_attributions ?? []) if (ownBrand(b)) put(b.source_code, b.source_url);
  for (const r of p.provenance ?? []) put(r.source_code, r.source_url);
  return out;
}

function mark(p: ProfilePayload, code: string): SourceMarkModel {
  return sourceMark(code, sourceHrefs(p)[code.toUpperCase()] ?? null);
}

/**
 * A mark only for a source this record itself holds.
 *
 * Aswad Composite Mills files no RSC registration — its two buildings do — so
 * RSC is not in `allSourceCodes` and the bar reads "6 sources", while the
 * workers figure (which the RSC rows produce) was stamped with a seventh, RSC
 * square. A square the count does not include contradicts the count on the
 * same screen; the coverage words ("across 2 of 3 sites, none of them this
 * record") are what attribute the figure in that case.
 */
function ownMark(p: ProfilePayload, code: string): SourceMarkModel | null {
  return allSourceCodes(p).includes(code.toUpperCase()) ? mark(p, code) : null;
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

function words(v: string | null | undefined): string[] {
  return (v ?? "").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

/**
 * The factory address to show, and the register that filed it.
 *
 * `suppliers.address_raw` is the profile column, and on 1,010 published
 * records it is a country-and-district stub — "Bangladesh / Gazipur - 1710" —
 * while the same payload's `addresses[]` carries the street. Showing the stub
 * and calling it "source pending" printed the worse of two real values and
 * then declined to attribute it. So: when a `factory` row says everything the
 * profile column says and more, that row is the address, and it is attributed.
 * Otherwise the profile column stands, attributed only on an exact match.
 *
 * Only `factory` rows are eligible — never a mailing row, never an inherited
 * one — and nothing is composed: both strings come from the same payload.
 */
function factoryAddress(p: ProfilePayload): { text: string | null; marks: SourceMarkModel[] } {
  const raw = p.supplier.address_raw;
  const rows = (p.addresses ?? []).filter((a) => a.kind === "factory" && a.source_code);
  // Every register that filed the text shown, best rank first. It used to be
  // `rows.find(...)`, so when two registers had filed the same premises the
  // receipt beside the address was whichever the RPC happened to list first:
  // the sentence was identical either way and the square — a link to that
  // register's page — flipped. One of the two was wrong every time, and
  // nothing in the data decided which.
  const marksFiling = (text: string): SourceMarkModel[] =>
    [...new Set(rows.filter((a) => sameAddress(a.address, text)).map((a) => a.source_code.toUpperCase()))]
      .map((c) => mark(p, c))
      .sort((a, b) => a.tier - b.tier || a.code.localeCompare(b.code));
  if (rows.some((a) => sameAddress(a.address, raw))) return { text: raw, marks: marksFiling(raw ?? "") };
  const own = words(raw);
  if (own.length > 0) {
    // Two supersets of equal length used to resolve by array order, which
    // changed the address text as well as the mark. The tie-break is the
    // source trust hierarchy (AGENTS.md 5), then the text itself, so the
    // choice is total and cannot depend on how the RPC ordered its rows.
    const fuller = rows
      .filter((a) => {
        const has = new Set(words(a.address));
        return words(a.address).length > own.length && own.every((w) => has.has(w));
      })
      .sort(
        (a, b) =>
          words(b.address).length - words(a.address).length ||
          mark(p, a.source_code).tier - mark(p, b.source_code).tier ||
          a.address.localeCompare(b.address),
      )[0];
    if (fuller) return { text: fuller.address, marks: marksFiling(fuller.address) };
  }
  return { text: raw, marks: [] };
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
  /** "2 of 2 sites" when the figure is a group sum this payload can account for. */
  coverage: string | null;
  /** Sites the figure leaves out, named. */
  excluded: string[];
  /** The record itself is not one of the sites the figure covers. */
  excludesRecord: boolean;
  /**
   * The figure covers sites this payload does not enumerate, so the kit can
   * neither break it down nor attribute it to a register.
   * `production_workers_display_batch` sums the mother and every `facility_of`
   * child; the profile payload carries a building only when it has an RSC row,
   * so a family with no RSC rows at all (52 published records on 19 Sep 2026,
   * four of which file no headcount of their own) returns a group figure the
   * kit can only describe. Printed bare it reads as this site's headcount.
   */
  groupUnknown: boolean;
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
  if (value === null) return { value: null, source: null, coverage: null, excluded: [], excludesRecord: false, groupUnknown: false };

  // With no batch figure, what is shown is what this payload holds and `group`
  // enumerated it. A batch figure the site sum reproduces is accounted for too.
  if (batch != null && group.value !== batch.value) {
    return { value, source: null, coverage: null, excluded: [], excludesRecord: false, groupUnknown: true };
  }
  const multi = sites.length > 1;
  const record = group.sites[0];
  return {
    value,
    source: batch?.source ?? group.source ?? null,
    // "N of N sites" is a completeness claim, and the payload cannot support
    // one: `production_workers_display_batch` walks every `facility_of`
    // child, while `buyer_supplier_profile` returns a child only when it has
    // an active RSC row. On 12 published records the two agree by coincidence
    // and the record claimed to cover every site of a family it cannot see —
    // `friends-knittings` said "11,800 workers across 2 of 2 sites" over four
    // sites, one of which files 2,000 employees of its own. So the
    // denominator is stated only when this payload itself excludes a site it
    // enumerated, which is a fact about the payload rather than the family.
    coverage: multi ? (group.includedCount === group.totalCount ? `${group.totalCount} sites` : `${group.includedCount} of the ${group.totalCount} sites on file`) : null,
    excluded: multi ? group.excludedLabels : [],
    excludesRecord: multi && record !== undefined && group.excludedLabels.includes(record.label),
    groupUnknown: false,
  };
}

/** The words the meta line and the table row carry beside the figure. */
export function workersCoverageWords(w: WorkersFact): string | null {
  if (w.groupUnknown) return "across this record and its buildings";
  if (!w.coverage) return null;
  return w.excludesRecord ? `across ${w.coverage}, none of them this record` : `across ${w.coverage}`;
}

function metaFacts(input: RecordInput, options: { registerNumber?: boolean } = {}): FactWithMark[] {
  const s = input.profile.supplier;
  const p = input.profile;
  const facts: FactWithMark[] = [{ text: entityLabel(s.entity_type), mark: null }];
  const place = placeLabel(s.city, s.district);
  const year = establishedYearOf(s.established_date);
  const w = workersFact(input);
  const workersMark = w.source === "RSC" && !w.groupUnknown ? ownMark(p, "RSC") : null;
  // City and district are derived fields (EPB → GOTS → the address text); no register is attributed to them.
  if (place) facts.push({ text: place, mark: null });
  const missing: string[] = [];
  if (year) facts.push({ text: `Est. ${year}`, mark: null });
  else missing.push("year");
  if (w.value !== null) {
    // A group sum is never printed bare: "3,166 workers" on a mother whose
    // figure is mother + buildings reads as this site's headcount.
    const cover = workersCoverageWords(w);
    facts.push({ text: `${formatCount(w.value)} workers${cover ? ` ${cover}` : ""}`, mark: workersMark });
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

/**
 * Buildings holding a **registration** of their own — a membership body or EPB.
 * A certificate number on a building is not a registration: saying a building
 * is "registered under" BGMEA/BKMEA/… because it holds an OEKO-TEX certificate
 * is the same wrong receipt the bare negative was. RSC is the Safety section's.
 */
export function pillBuildings(p: ProfilePayload): string[] {
  return [
    ...new Set(
      (p.pills ?? [])
        .filter((x) => x.building_name && MEMBERSHIP.concat("EPB").includes(x.source_code.toUpperCase()))
        .map((x) => x.building_name!),
    ),
  ];
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
    if (!ownBrand(b)) continue;
    const code = b.source_code.toUpperCase();
    if (seen.has(code)) continue;
    seen.add(code);
    out.push(sourceMark(b.source_code).label);
  }
  // Best rank first, then alphabetical — the order every other mark row uses.
  return out.sort((a, b) => a.localeCompare(b));
}

/** Buildings named on a brand list this record is not on. */
export function brandBuildings(p: ProfilePayload): string[] {
  return [...new Set((p.brand_attributions ?? []).map((b) => b.building_name).filter((b): b is string => Boolean(b)))];
}

/**
 * "Not on 4 brand lists read" — and, when a building of this record is on one,
 * who. The third union `buyer_supplier_profile` performs, and the third place
 * the bare negative would be a negative the payload contradicts: eight
 * published mothers carry brand rows that are entirely a building's, and
 * `brandBuildings` was written for them and then wired to nothing.
 */
export function brandListsEmptyWords(p: ProfilePayload): string {
  const buildings = brandBuildings(p);
  if (buildings.length === 0) return BRAND_LISTS_WORDS;
  return `not on this record · ${buildings.join(", ")} ${buildings.length === 1 ? "is listed" : "are listed"}`;
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
  const elsewhere = certsElsewhereWords(p);
  return elsewhere ? `none on ${elsewhere}` : `none on ${CERT_REGISTERS} registers`;
}

/**
 * The same absence, as a card chip and as the sheet's empty state.
 *
 * The chip used to be written inline as "No certificate on any register" —
 * an absolute over ten schemes production has never read (`certifications`
 * holds four `cert_kind` values; `sources` holds four tier-3 rows), on 7,531
 * published records. The inline copy had also already drifted from the
 * helper: it said "holds one" for two buildings. Both now come from here.
 */
/**
 * The certificate whose scope the screens show.
 *
 * It was `certList.find(c => c.kind === "GOTS" && c.state !== "expired")`, and
 * every other shape read as a negative. A record holding a live WRAP Gold —
 * whose scope string always carries a `Products:` half — printed "Certified
 * scope — no scope certificate" on the sheet and "Certified scope · Not on
 * file · 4 cert registers checked" on the product sheet, three sections above
 * the WRAP certificate itself. That last string claims four registers were
 * read and came back empty; the read came back with certificates carrying
 * scope text. 434 published records hold WRAP, 911 hold GOTS, and an expired
 * GOTS was discarded rather than shown as expired, which ds-rebuild-must-stay
 * §5 names as a state the design must show.
 *
 * Order, and it is total so the choice cannot depend on row order: carries
 * scope text at all, then unexpired before expired, then GOTS before the
 * others (its scope is a line scope; WRAP and OEKO-TEX file an operations and
 * products scope, which is still the record's own words), then the order
 * `sortCerts` already fixed.
 */
export function scopeCert(certList: CertModel[]): CertModel | null {
  const withScope = certList.filter((c) => (c.scope ?? "").trim().length > 0);
  if (withScope.length === 0) return null;
  const rank = (c: CertModel) => (c.state === "expired" ? 1 : 0) * 2 + (c.kind.toUpperCase() === "GOTS" ? 0 : 1);
  return withScope
    .map((c, i) => ({ c, i }))
    .sort((a, b) => rank(a.c) - rank(b.c) || a.i - b.i)[0]!.c;
}

/**
 * What to say where a scope would have gone. "4 cert registers checked" over
 * a payload holding certificates was the lie; over a payload holding none it
 * is true, and `certsEmptyWords` says it better.
 */
export function scopeEmptyWords(p: ProfilePayload, certList: CertModel[]): string {
  return certList.length === 0 ? certsEmptyWords(p) : "no scope on the certificates on file";
}

export function certsEmptyChipLabel(p: ProfilePayload): string {
  const elsewhere = certsElsewhereWords(p);
  return elsewhere ? `No certificate on ${elsewhere}` : `No certificate on ${CERT_REGISTERS} registers`;
}

function certsElsewhereWords(p: ProfilePayload): string | null {
  const buildings = certBuildings(p);
  if (buildings.length === 0) return null;
  return `this record · ${buildings.join(", ")} ${buildings.length === 1 ? "holds one" : "hold one"}`;
}

/**
 * The words a buyer reads for a register's label. The database stores the
 * register's own column heading, and two of the eleven carry the marker in
 * the middle rather than at the end — `BTMA Member #SL` reached the screen
 * verbatim on 421 published records, and `OEKO_TEX Cert #` printed the
 * database's underscore. Stripping only a trailing "#" missed both.
 *
 * The eleven labels production holds, and what they become:
 *   BGAPMEA #  → BGAPMEA          BGMEA Associate member # → BGMEA Associate member
 *   BKMEA #    → BKMEA            BGMEA General member #   → BGMEA General member
 *   BTMA Member #SL → BTMA Member  EPB Reg # → EPB Reg      RSC ID → RSC ID
 *
 * The sheet's Registers row drops a trailing "member" so the number reads as
 * a number ("BGMEA General 3498"); the card's sub-line keeps it, because
 * "associate member" is the grade the register awarded.
 *   GOTS Cert # → GOTS Cert       WRAP Cert # → WRAP Cert
 *   SA8000 Cert # → SA8000 Cert   OEKO_TEX Cert # → OEKO-TEX Cert
 */
export function registerLabel(label: string): string {
  return label
    .replace(/OEKO_TEX/gi, "OEKO-TEX")
    // the marker and whatever the register glues to it ("#", "#SL", "#No.")
    .replace(/\s*#\S*/g, "")
    .replace(/\s+/g, " ")
    .trim();
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

/** "100 % remediated" · "53 %" · null when the row carries no percentage. */
function rscPercentWords(rsc: ProfileRsc): string | null {
  // `progress_pct` absent from the row (undefined) is not 0 %: Math.round of
  // it is NaN, and "NaN %" reached the chip and aria-valuenow.
  if (!Number.isFinite(rsc.progress_pct)) return null;
  const pct = Math.round(rsc.progress_pct as number);
  return pct === 100 ? "100 % remediated" : `${pct} %`;
}

function rscChip(rsc: ProfileRsc | null, buildings: ProfileRsc[]): HighlightChip | null {
  if (rsc) {
    const needsLook = rscStatusNeedsLook(rsc.remediation_status);
    return {
      tone: needsLook ? "caution" : "positive",
      icon: "shield",
      label: ["RSC active", rscPercentWords(rsc), needsLook ? rscStatusWords(rsc.remediation_status) : null].filter(Boolean).join(" · "),
    };
  }
  if (buildings.length > 0) {
    // The building's own figures, said to be the building's. Naming the
    // building and dropping its percentage and status left a record whose only
    // RSC row is 53 % and behind schedule looking like one with nothing to
    // look at — and in the neutral tone rather than caution.
    const first = buildings[0]!;
    const worst = buildings.find((b) => rscStatusNeedsLook(b.remediation_status)) ?? first;
    const needsLook = rscStatusNeedsLook(worst.remediation_status);
    const more = buildings.length > 1 ? ` +${buildings.length - 1}` : "";
    // Naming the worst building must not silently drop the others: 16
    // published mothers have two or more building RSC rows and none of their
    // own, and "RSC covers <the behind-schedule one>" alone hid the fact that
    // a second building is covered too.
    const named = needsLook && worst !== first ? `${worst.building_name}${more}` : `${first.building_name}${more}`;
    return {
      tone: needsLook ? "caution" : "neutral",
      icon: "shield",
      label: [`RSC covers ${named}`, rscPercentWords(worst), needsLook ? rscStatusWords(worst.remediation_status) : null].filter(Boolean).join(" · "),
    };
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
  if (certList.length === 0) chips.push({ tone: "quiet", label: certsEmptyChipLabel(p) });
  const bgmea = registers.find((r) => r.source_code.toUpperCase() === "BGMEA");
  // Every BGMEA label production holds already ends in "member #", so
  // appending the word gave "BGMEA General member member" on the 3,313
  // published records whose only source is BGMEA.
  if (marks.length <= 1 && bgmea) {
    const label = registerLabel(bgmea.label);
    chips.unshift({ tone: "neutral", label: /\bmember$/i.test(label) ? label : `${label} member` });
  }
  if (marks.length <= 1) chips.push({ tone: "quiet", label: `Nothing else on file · ${marks.length} of ${SOURCES_WITH_RECORDS} sources read` });
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
      : { label: "Listed by", value: null, sub: brandListsEmptyWords(p) },
    // Three shapes, and the last one is the empty state. A record with several
    // numbers at ONE body (279 published records — BGMEA 112, BGAPMEA 105,
    // BTMA 62) used to satisfy neither of the first two and fell through to
    // "not in BGMEA, BKMEA, …", denying registrations the sheet listed.
    registerCodes(registers).length > 1
      ? { label: "Registers", value: `${registerCodes(registers).length} registers`, sub: registerCodes(registers).map((c) => sourceMark(c).label).join(" · "), href: `${recordHref}#sources` }
      : registers.length > 1 && registers[0]
        ? {
            label: "Registers",
            value: `${registers.length} ${sourceMark(registers[0].source_code).label} numbers`,
            sub: registers.map((r) => r.value).filter(Boolean).join(" · "),
            href: `${recordHref}#sources`,
          }
        : registers.length === 1 && registers[0]
          ? {
              label: "Registers",
              value: `${sourceMark(registers[0].source_code).label} ${registers[0].value ?? ""}`.trim(),
              sub: registerLabel(registers[0].label).replace(/^BGMEA\s+/i, "").toLowerCase() || registerLabel(registers[0].label).toLowerCase(),
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
    // The words, not the bare coverage: the row printed "1 of the 2 sites on
    // file" and dropped the half that says the figure is entirely a
    // building's, which the card has carried since cycle 6.
    workersCoverage: workersCoverageWords(w)?.replace(/^across /, "") ?? null,
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
  const workersMark = w.source === "RSC" && !w.groupUnknown ? ownMark(p, "RSC") : null;
  const registerRows = registers.filter((r) => r.value);
  const scoped = scopeCert(certList);
  // Distinct premises, not rows and not spellings. Aboni files nine address
  // rows; an exact-text dedupe called them seven, and the registers write the
  // same place several ways ("Kewa, Bakultala, Sreepur, 1744, Gazipur" and
  // "…Sreepur, Gazipur - 1744"), which over-counts on 79 published records.
  // `mergeUniqueLocations` is the matcher the production profile's Locations
  // section already uses, with its own fixture suite in this repo; counting
  // with anything else means the tab and that section disagree.
  const addresses = mergeUniqueLocations(
    (p.addresses ?? [])
      .filter((a) => (a.address ?? "").trim())
      .map((a) => ({ kind: a.kind, address: a.address, source_code: a.source_code ?? "", fetched_at: a.fetched_at ?? "" })),
  ).length;
  const addr = factoryAddress(p);
  const capacity =
    s.production_capacity_pcs_day
      ? `${formatCount(s.production_capacity_pcs_day)} pcs/day`
      : s.production_capacity_dozen_yearly
        ? `${formatCount(s.production_capacity_dozen_yearly)} dozen/year`
        : null;

  const pending = (value: string | null, m: SourceMarkModel | null = null, checked = "registers checked"): Pick<FactRow, "value" | "marks" | "pendingSource" | "checked"> =>
    pendingMarks(value, m ? [m] : [], checked);
  const pendingMarks = (value: string | null, ms: SourceMarkModel[], checked = "registers checked"): Pick<FactRow, "value" | "marks" | "pendingSource" | "checked"> =>
    value === null ? { value, marks: [], checked } : ms.length > 0 ? { value, marks: ms } : { value, marks: [], pendingSource: true };

  const facts: FactRow[] = [
    { label: "Registered name", ...pending(s.company_name) },
    { label: "Type", ...pending([entityLabel(s.entity_type), s.factory_types?.length ? s.factory_types.join(", ") : null].filter(Boolean).join(" · ")) },
    { label: "Parent group", ...pending(s.parent_group_name, null, "registers and RSC checked") },
    { label: "Factory address", ...pendingMarks(addr.text, addr.marks) },
    { label: "Established", ...pending(establishedYearOf(s.established_date)) },
    {
      label: "Workers",
      ...pending(w.value !== null ? formatCount(w.value) : null, workersMark, "registers and RSC checked"),
      note: workersNote(w),
    },
    { label: "Sewing machines", ...pending(formatCount(s.machines_sewing)) },
    { label: "Capacity, as filed", ...pending(capacity) },
    {
      label: "Registers",
      value: registerRows.length ? registerRows.map((r) => `${registerLabel(r.label).replace(/\s+member$/i, "")} ${r.value}`).join(" · ") : null,
      code: true,
      checked: registersEmptyWords(p),
      marks: registerCodes(registerRows).map((c) => mark(p, c)),
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

  const model: SupplierSheetModel = {
    slug: s.slug,
    everyMarkLinks: false,
    name,
    initials: initials(name),
    topTier: topTier(codes),
    marks,
    meta: metaFacts(input, { registerNumber: true }),
    readDate: latestReadDate(p),
    sourceCount: marks.length,
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
      certifiedScope: scoped ? { scheme: scoped.scheme, scope: scopeWords(scoped.scope), state: scoped.state } : null,
      certifiedScopeEmpty: scopeEmptyWords(p, certList),
      buyerLists: brands,
      buyerListsEmpty: brandListsEmptyWords(p),
      tiles: input.hscodesError ? [] : photoTiles(lines, 6),
    },
    certs: certList,
    certsCaption: certList.length ? `${onFileLabel(certList.length)} · ${certRegisters.join(", ")}` : null,
    certsEmpty: certsEmptyWords(p),
    certsEmptyChip: certsEmptyChipLabel(p),
    certBuildings: certBuildings(p),
    rsc: rsc
      ? {
          ref: (p.pills ?? []).find((x) => x.source_code.toUpperCase() === "RSC" && ownPill(x))?.value ?? null,
          readDate: formatDay(rsc.fetched_at) ?? readDateOf(p, "RSC"),
          progress: Number.isFinite(rsc.progress_pct) ? Math.round(rsc.progress_pct as number) : null,
          status: rscStatusWords(rsc.remediation_status),
          training: rscTrainingWords(rsc.training_status),
          links: rscLinks(rsc),
        }
      : null,
    rscBuildings: buildings.map((b) => b.building_name ?? "building"),
    // Each building's own row, labelled. The mother's block stays the mother's
    // (cycle 4); showing nothing at all for a record whose only RSC record is a
    // building's hid every safety receipt the register published for it.
    rscBuildingBlocks: buildings.map((b) => ({
      name: b.building_name ?? "building",
      readDate: formatDay(b.fetched_at) ?? null,
      progress: Number.isFinite(b.progress_pct) ? Math.round(b.progress_pct as number) : null,
      status: rscStatusWords(b.remediation_status),
      training: rscTrainingWords(b.training_status),
      links: rscLinks(b),
    })),
  };

  // Every square this sheet draws: the mark row, the attributed fact rows and
  // the certificate cards. The certificate marks were outside this sum, so a
  // sheet holding a certificate whose document is not a record page claimed
  // that every mark links while rendering one that does not.
  const rendered = [
    ...model.marks,
    ...model.facts.flatMap((f) => (f.value === null ? [] : (f.marks ?? []))),
    ...model.certs.map((c) => sourceMark(c.markCode, c.documentUrl)),
  ];
  // "…to its register page" is false of a brand mark however well it links: a
  // disclosure list is one file listing every supplier on it, and the mark's
  // own accessible name says so. 43 published records hold nothing but
  // linkable registers plus a brand list, and every one of them made the
  // absolute claim over a link the same page called a disclosure list.
  // `[].every()` is true, so a record with no marks at all made the claim too.
  const everyMarkLinks =
    rendered.length > 0 && rendered.every((m) => Boolean(m.href)) && rendered.every((m) => m.opens !== "list");
  return { ...model, everyMarkLinks };
}

/** The five RSC reports, in the order the spec lists them; a missing one keeps its slot. */
function rscLinks(rsc: ProfileRsc): { label: string; href: string | null }[] {
  return [
    { label: "Fire", href: rsc.fire_inspection_url },
    { label: "Structural", href: rsc.structural_inspection_url },
    { label: "Electrical", href: rsc.electrical_inspection_url },
    { label: "Boiler", href: rsc.boiler_inspection_url },
    { label: "CAP", href: rsc.cap_url },
  ];
}

/** What the sheet says under the worker figure about the sites it covers. */
function workersNote(w: WorkersFact): string | null {
  if (w.groupUnknown) return "this record and its buildings together; the site breakdown is not on the record";
  if (!w.coverage) return null;
  return [`across ${w.coverage}`, w.excluded.length ? `excluded: ${w.excluded.join(", ")}` : null].filter(Boolean).join(" · ");
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

/**
 * GOTS operation names that contain a comma. Splitting the scope on every
 * comma turned "Embroidery, embellishment" into two operations — inventing
 * "embellishment" and inflating the "+N" — on 545 of the 911 GOTS
 * certificates on file (SQL, 19 Sep 2026).
 */
const SCOPE_PHRASES = [
  "Warehousing, distribution of non-final products",
  "Warehousing, distribution of final products",
  "Embroidery, embellishment",
  "Washing, laundering",
];
const SCOPE_SEP = "\u0000";

function scopeList(raw: string): string[] {
  let guarded = raw;
  for (const phrase of SCOPE_PHRASES) {
    guarded = guarded.replace(new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), (m) => m.replace(/,\s*/g, SCOPE_SEP));
  }
  return guarded
    .split(",")
    .map((w) => w.trim().replace(new RegExp(SCOPE_SEP, "g"), ", ").toLowerCase())
    .filter(Boolean);
}

/**
 * Three items and a count of the rest.
 *
 * Joined with commas this miscounted itself: GOTS writes one of its operations
 * as "Embroidery, embellishment", so "dyeing, embroidery, embellishment,
 * finishing +6" showed three operations and read as four, over a scope of
 * nine. 545 of the 911 GOTS certificates carry such a phrase. A semicolon
 * between the items leaves the commas inside them unambiguous.
 */
function scopeShorten(items: string[]): string {
  const sep = items.some((i) => i.includes(",")) ? "; " : ", ";
  return items.length > SCOPE_SHOWN ? `${items.slice(0, SCOPE_SHOWN).join(sep)} +${items.length - SCOPE_SHOWN}` : items.join(sep);
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
  const scoped = scopeCert(certList);
  const brands = brandLabels(p);
  // One square per list, best rank first — `brand_attributions` can repeat a
  // list when a facility's row is unioned in (13 published records do).
  const brandMarks = marksFromTags(
    [...new Set((p.brand_attributions ?? []).filter(ownBrand).map((b) => b.source_code.toUpperCase()))],
    sourceHrefs(p),
  );
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
        // The read date of THIS page, not the register's latest read, and the
        // count when the record holds more than one (14 published records do).
        note: exported && epb ? [epb.readDate ? `read ${epb.readDate}` : null, epb.pages > 1 ? `+${epb.pages - 1} more exporter page${epb.pages > 2 ? "s" : ""} on this record` : null].filter(Boolean).join(" · ") || null : null,
        checked: exported ? "EPB checked" : "this line is not on the record's EPB page",
        marks: exported && epb ? [ep] : [],
      },
      { label: "Exporting since", value: null, note: "EPB lists lines, not dates" },
      { label: "Other lines", value: others.length ? others.join(" · ") : null, code: true, checked: "EPB checked", marks: others.length ? [ep] : [] },
      scoped
        ? {
            label: "Certified scope",
            value: `${scoped.number ?? scoped.scheme} · ${scopeWords(scoped.scope)}`,
            // `certChipLabel` reads "GOTS · no expiry on file"; stripping the
            // scheme alone left the badge starting with a stray middle dot.
            badge: { tone: scoped.state === "valid" ? "positive" : scoped.state === "no-expiry" ? "type" : "caution", label: certStateLabel(scoped) },
            marks: [sourceMark(scoped.markCode, scoped.documentUrl)],
          }
        : { label: "Certified scope", value: null, checked: scopeEmptyWords(p, certList) },
      {
        label: "Product list",
        value: products.length ? products.slice(0, 4).join(" · ") : null,
        note: products.length > 4 ? `+${products.length - 4} items` : null,
        checked: "registers checked",
        marks: [],
        pendingSource: products.length > 0,
      },
      { label: "Buyer lists", value: brands.length ? brands.join(" · ") : null, note: brands.length ? "disclosure lists" : null, checked: brandListsEmptyWords(p), marks: brandMarks },
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
  // `rfq_list` emits `coalesce(array_length(target_supplier_ids,1), 0)`, so a
  // draft with no target counts 0 — and `Math.max(1, undefined)` is NaN, which
  // rendered "NaN suppliers". An RFQ with no target says so.
  const count = Number.isFinite(r.target_supplier_count) ? Math.max(0, r.target_supplier_count) : 0;
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
