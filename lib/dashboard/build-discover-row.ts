// Card and table models from a discover_suppliers v3.2 row (REZ-B).
// The results page cannot afford buyer_supplier_profile per row; it builds
// from the RPC return + the HS batch + saved membership.

import { PII_KEYS, type DiscoverV32Row, type HsBatchLine } from "@/lib/discover-v32-rpc";
import type { WorkersBasis } from "@/lib/enrich-discover-workers";
import type { HighlightChip, SupplierCardModel, TableRowModel, TileModel } from "@/lib/dashboard/models";
import {
  certChipLabel,
  certModel,
  certScheme,
  displayName,
  entityLabel,
  establishedYearOf,
  formatCount,
  initials,
  onFileLabel,
  placeLabel,
  sortCerts,
  type CertModel,
} from "@/lib/dashboard/facts";
import { photoTiles } from "@/lib/dashboard/hs-photos";
import { marksFromTags, sourceMark, topTier } from "@/lib/dashboard/source-tiers";

const BRAND_LABEL: Record<string, string> = {
  BRAND_HM: "H&M",
  BRAND_ASOS: "ASOS",
  BRAND_NEXT: "NEXT",
  BRAND_MS: "M&S",
  BRAND_INDITEX: "Inditex",
  BRAND_PRIMARK: "Primark",
};

export function certsFromSummary(raw: unknown, today: Date): CertModel[] {
  if (!Array.isArray(raw)) return [];
  const out: CertModel[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    if (typeof r.kind !== "string") continue;
    out.push(
      certModel(
        {
          kind: r.kind,
          certificate_no: typeof r.certificate_no === "string" ? r.certificate_no : null,
          issuer: typeof r.issuer === "string" ? r.issuer : null,
          expires_on: typeof r.expires_on === "string" ? r.expires_on : null,
          scope: typeof r.scope === "string" ? r.scope : null,
          document_url: null,
        },
        today,
      ),
    );
  }
  return sortCerts(out);
}

/**
 * What the headline worker figure is, in words a buyer can act on: where it
 * came from, and — when it is not this record's own number — what it covers.
 *
 * Naming only the source was wrong. `production_workers_display_batch` sums
 * the record with its buildings, and under RSC preference over the RSC sites
 * only, so "3,166 workers · on the register" named a register holding no such
 * figure and "907 · RSC inspection" named an inspection of a different site.
 * Worse, "on the register" is the phrase the workers FILTER already uses
 * (`≤ 1,000 workers on the register`, applied to `suppliers.employees_total`)
 * — identical words, two quantities, one of them false.
 *
 * `lib/dashboard/build-models.ts` has always said this properly on the same
 * data; these are its words.
 */
export function workersBasisLabel(
  source: "RSC" | "registry" | undefined,
  basis: WorkersBasis | undefined,
): string | null {
  const from = source === "RSC" ? "RSC inspection" : source === "registry" ? "on the register" : null;
  if (basis === "group") return "across this record and its buildings";
  if (basis === "excludes-record") return "across its buildings, not this record";
  return from;
}

/**
 * Two worker figures, never confused (founder decision, 24 Sep):
 *
 * - the headline is the supplier row's own `employees_total` — the number the
 *   Workers sort and filter use, so a list sorted by workers reads in order;
 * - under it, when different, the figure the supplier's profile headlines
 *   (`production_workers_display_batch`: RSC preferred, buildings included),
 *   with words that say what it covers — taken from the batch's own account of
 *   which sites it summed, never inferred from the numbers.
 */
export function discoverWorkers(row: DiscoverV32Row): {
  own: number | null;
  ownLabel: string | null;
  second: number | null;
  secondLabel: string | null;
} {
  const basis = row.workers_basis;
  if (!basis) return { own: row.employees_total, ownLabel: null, second: null, secondLabel: null };
  const own = row.workers_own ?? null;
  const shown = row.employees_total;
  if (basis === "own" && shown === own) {
    return { own, ownLabel: workersBasisLabel(row.workers_source, "own"), second: null, secondLabel: null };
  }
  return {
    own,
    ownLabel: own == null ? null : "on the register",
    second: shown,
    // "own" here is this record's RSC headcount beside its register figure:
    // the same site, another source — named by its source, not as a group.
    // "unknown" (a batch without 0104's composition) claims nothing it cannot
    // know: only that this is the figure the profile shows.
    secondLabel: basis === "unknown" ? "as on its profile" : workersBasisLabel(row.workers_source, basis),
  };
}

function secondLine(w: ReturnType<typeof discoverWorkers>): string | null {
  return w.second == null ? null : `${formatCount(w.second)} workers${w.secondLabel ? ` · ${w.secondLabel}` : ""}`;
}

/** "8 registers & certifiers" — the population `p_min_sources` filters on. */
function registerCountLabel(n: number): string {
  return `${n} ${n === 1 ? "register or certifier" : "registers & certifiers"}`;
}

function brandNames(codes: readonly string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const c of codes) {
    const label = BRAND_LABEL[c] ?? (c.startsWith("BRAND_") ? c.slice(6) : c);
    if (seen.has(label)) continue;
    seen.add(label);
    out.push(label);
  }
  return out;
}

function hsForSlug(slug: string, batch: readonly HsBatchLine[], rowCodes: readonly string[]): string[] {
  const fromBatch = batch.filter((l) => l.slug === slug).map((l) => l.hs);
  return fromBatch.length > 0 ? fromBatch : [...rowCodes];
}

export function buildDiscoverCard(
  row: DiscoverV32Row,
  opts: {
    today: Date;
    hsLines: readonly HsBatchLine[];
    hsError: boolean;
    saved?: boolean;
  },
): SupplierCardModel {
  const name = displayName(row.company_name);
  const tags = row.source_tags ?? [];
  const marks = marksFromTags(tags);
  const certList = certsFromSummary(row.cert_summary, opts.today);
  const brands = brandNames(row.brand_codes ?? []);
  const registers = row.registries ?? [];
  const sanctioned = Boolean(row.is_sanctioned);
  const lines = hsForSlug(row.slug, opts.hsLines, row.hs_codes ?? []);
  const recordHref = `/app/suppliers/${row.slug}`;
  const year = establishedYearOf(row.established_date);
  const place = placeLabel(row.city, row.district);
  // Spec §3.1: "we show the exact worker count with its source", and §3.3 puts
  // workers on the meta line "with its register mark".
  const w = discoverWorkers(row);
  const workersSecond = secondLine(w);

  const chips: HighlightChip[] = [];
  for (const c of certList.slice(0, 2)) {
    chips.push({
      tone: c.state === "valid" ? "positive" : c.state === "no-expiry" ? "neutral" : "caution",
      icon: c.state === "valid" ? "check-c" : c.state === "expiring" ? "clock" : c.state === "expired" ? "warn" : undefined,
      label: certChipLabel(c),
    });
  }
  if (row.rsc_progress_pct != null) {
    chips.push({ tone: "neutral", icon: "shield", label: "RSC inspected" });
  }
  // "Not on the list" is a claim about the register; an empty `lines` is not.
  // Lines come back empty whenever the EPB record carries no `epb_hscodes`
  // array, the codes fail the 4–6 digit shape, or the host/exporter pair is on
  // the `epb_record_is_foreign_to_host` denylist — none of which mean the
  // supplier is absent from EPB. The register itself is what `registries`
  // reports, so only say "not on the list" when EPB is genuinely not there.
  const onEpbRegister = registers.includes("EPB");
  if (opts.hsError) chips.push({ tone: "quiet", label: "EPB lines could not be read" });
  else if (lines.length > 0) chips.push({ tone: "neutral", label: `EPB exporter · ${lines.length} ${lines.length === 1 ? "line" : "lines"}` });
  else if (onEpbRegister) chips.push({ tone: "quiet", label: "EPB exporter · no lines recorded" });
  else chips.push({ tone: "quiet", label: "Not on the EPB exporter list" });
  if (brands.length > 0) chips.push({ tone: "neutral", label: `Listed by ${brands.join(", ")}` });
  if (certList.length === 0) chips.push({ tone: "quiet", label: "No certificate on file" });
  if (marks.length <= 1) {
    chips.push({
      tone: "quiet",
      label: `Nothing else on file · ${marks.length} of the sources read`,
    });
  }
  const shown = chips.slice(0, 5);
  const moreChips = Math.max(0, chips.length - shown.length);

  const tiles: [TileModel, TileModel, TileModel, TileModel] = [
    certList.length > 0
      ? {
          label: "Certificates",
          value: onFileLabel(certList.length),
          sub: certList
            .slice(0, 2)
            .map((c) => certScheme(c.kind, c.scope))
            .join(" · "),
          href: `${recordHref}#certificates`,
        }
      : { label: "Certificates", value: null, sub: "none on file" },
    opts.hsError
      ? { label: "Export lines", value: null, sub: "EPB could not be read" }
      : lines.length > 0
        ? {
            label: "Export lines",
            value: `${lines.length} HS ${lines.length === 1 ? "line" : "lines"}`,
            sub: "EPB exporter page",
            href: `${recordHref}#products`,
          }
        : {
            label: "Export lines",
            value: null,
            sub: onEpbRegister ? "no lines recorded" : "not on the EPB list",
          },
    brands.length > 0
      ? {
          label: "Listed by",
          value: brands.join(", "),
          sub: `${brands.length} brand ${brands.length === 1 ? "list" : "lists"}`,
          href: `${recordHref}#sources`,
        }
      : { label: "Listed by", value: null, sub: "not on a brand list we read" },
    registers.length > 1
      ? {
          label: "Registers",
          value: `${registers.length} registers`,
          sub: registers.map((c) => sourceMark(c).label).join(" · "),
          href: `${recordHref}#sources`,
        }
      : registers.length === 1 && registers[0]
        ? {
            label: "Registers",
            value: sourceMark(registers[0]).label,
            sub: "on file",
            href: `${recordHref}#sources`,
          }
        : { label: "Registers", value: null, sub: "no register number on file" },
  ];

  const meta = [
    { text: entityLabel(row.entity_type), mark: null },
    ...(place ? [{ text: place, mark: null }] : []),
    ...(year ? [{ text: `Est. ${year}`, mark: null }] : []),
    ...(w.own != null
      ? [{ text: `${formatCount(w.own)} workers${w.ownLabel ? ` · ${w.ownLabel}` : ""}`, mark: null }]
      : [{ text: "Workers not on file", mark: null, quiet: true as const }]),
    ...(workersSecond ? [{ text: workersSecond, mark: null }] : []),
    // The mark row beside this already shows every source, brand lists
    // included. This number must be the one the "≥ N registers or certifiers"
    // filter and the "Most registers & certifiers" sort actually use
    // (t13_source_count, tiers 1–3), or a card reads "0 sources" while
    // matching "≥ 1". Named for what it counts.
    { text: registerCountLabel(row.t13_source_count ?? 0), mark: null },
  ];

  return {
    slug: row.slug,
    name,
    initials: initials(name),
    topTier: (row.top_tier as SupplierCardModel["topTier"]) ?? topTier(tags),
    marks,
    meta,
    sanctioned,
    chips: shown,
    moreChips,
    tiles,
    photos: opts.hsError ? [] : photoTiles(lines, 6),
    totalLines: lines.length,
    linesUnknown: opts.hsError,
    epbReadDate: null,
    onEpbRegister,
    why: null,
    selected: false,
    saved: Boolean(opts.saved),
    supplierId: row.id,
    rfqHref: row.is_sanctioned ? null : `/app/rfqs/new?supplier=${row.id}`,
  };
}

export function buildDiscoverTableRow(
  row: DiscoverV32Row,
  opts: {
    today: Date;
    hsLines: readonly HsBatchLine[];
    hsError: boolean;
    saved?: boolean;
  },
): TableRowModel {
  const card = buildDiscoverCard(row, opts);
  const w = discoverWorkers(row);
  const certList = certsFromSummary(row.cert_summary, opts.today);
  const lines = hsForSlug(row.slug, opts.hsLines, row.hs_codes ?? []);
  return {
    slug: row.slug,
    name: card.name,
    place: placeLabel(row.city, row.district),
    initials: card.initials,
    topTier: card.topTier,
    sourceCount: card.marks.length,
    marks: card.marks,
    certs: certList,
    certsEmptyReason: certList.length === 0 ? "none on file" : null,
    photos: opts.hsError ? [] : photoTiles(lines, 3),
    totalLines: lines.length,
    // Same rule as the card and the photo tile: an empty line list is not a
    // claim about the register. The table said "not on EPB list" regardless,
    // so one record contradicted itself between ?view=cards and ?view=table.
    linesEmptyReason: opts.hsError
      ? "EPB could not be read"
      : lines.length > 0
        ? null
        : card.onEpbRegister
          ? "no lines recorded"
          : "not on EPB list",
    type: entityLabel(row.entity_type),
    // Same figures and words as the card.
    workers: w.own,
    workersCoverage: w.ownLabel,
    workersSecond: secondLine(w),
    sanctioned: card.sanctioned,
    selected: false,
    saved: Boolean(opts.saved),
    supplierId: row.id,
    rfqHref: card.rfqHref,
  };
}

export function discoverCsvValue(row: DiscoverV32Row, today: Date): Record<string, string> {
  const certs = certsFromSummary(row.cert_summary, today);
  const w = discoverWorkers(row);
  return {
    company: displayName(row.company_name),
    slug: row.slug,
    type: entityLabel(row.entity_type),
    city: row.city ?? "",
    district: row.district ?? "",
    sources: (row.source_tags ?? []).join("; "),
    certificates: certs.map((c) => certChipLabel(c)).join("; "),
    // `row.hs_codes` is `discover_v32_hs_codes` — `left(code, 4)` DISTINCT,
    // i.e. 4-digit EPB headings. The card and the table count full 6-digit
    // lines from `supplier_epb_hscodes_batch`, so a supplier reading
    // "12 HS lines" on screen exported three values here. Named for what it
    // is, as the "Most HS headings" sort already is.
    hs_headings: (row.hs_codes ?? []).join("; "),
    // The same two figures as the card and the table: `workers` is the one the
    // Workers sort and filter use; `profile_workers` is the figure the
    // supplier's profile headlines, when it differs. Each has a words column
    // beside it so the number columns stay plain numbers a spreadsheet sums.
    workers: w.own == null ? "" : String(w.own),
    workers_source: w.own == null ? "" : (w.ownLabel ?? "on the register"),
    profile_workers: w.second == null ? "" : String(w.second),
    profile_workers_source: w.second == null ? "" : (w.secondLabel ?? ""),
    established: row.established_date ?? "",
    sanctioned: row.is_sanctioned ? "yes" : "no",
  };
}

export const CSV_COLUMNS = [
  "company",
  "slug",
  "type",
  "city",
  "district",
  "sources",
  "certificates",
  "hs_headings",
  "workers",
  "workers_source",
  "profile_workers",
  "profile_workers_source",
  "established",
  "sanctioned",
] as const;

function csvEscape(value: string): string {
  // Spreadsheet formula injection: Excel and Sheets evaluate a cell whose text
  // begins with = + - @ (or a leading tab/CR before one). Supplier-supplied
  // names, addresses and certificate scopes reach this export, so a supplier
  // could ship a formula that runs on the buyer's machine when they open the
  // file. Prefix a single quote, which those applications strip on display.
  const guarded = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  if (/[",\n\r]/.test(guarded)) return `"${guarded.replace(/"/g, '""')}"`;
  return guarded;
}

export function discoverRowsToCsv(rows: readonly DiscoverV32Row[], today: Date): string {
  const header = CSV_COLUMNS.join(",");
  const lines = rows.map((row) => {
    const rec = discoverCsvValue(row, today);
    return CSV_COLUMNS.map((k) => csvEscape(rec[k] ?? "")).join(",");
  });
  return [header, ...lines].join("\r\n") + "\r\n";
}

/**
 * Header names the export must never carry. The four real column names come
 * from `PII_KEYS`, so the two lists cannot drift apart again; the bare words
 * are the looser aliases a rename might reach for.
 */
export const CSV_CONTACT_HEADERS = [...PII_KEYS, "email", "phone", "contact"] as const;
