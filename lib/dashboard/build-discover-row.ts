// Card and table models from a discover_suppliers v3.2 row (REZ-B).
// The results page cannot afford buyer_supplier_profile per row; it builds
// from the RPC return + the HS batch + saved membership.

import { PII_KEYS, type DiscoverV32Row, type HsBatchLine } from "@/lib/discover-v32-rpc";
import type { WorkersBasis } from "@/lib/enrich-discover-workers";
import type { FactWithMark, HighlightChip, SupplierCardModel, TableRowModel } from "@/lib/dashboard/models";
import {
  certChipLabel,
  certModel,
  displayName,
  entityLabel,
  establishedYearOf,
  formatCount,
  initials,
  placeLabel,
  sortCerts,
  type CertModel,
} from "@/lib/dashboard/facts";
import { photoTiles } from "@/lib/dashboard/hs-photos";
import { marksFromTags, topTier } from "@/lib/dashboard/source-tiers";

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
 * Words for a worker figure: the source it came from, or — when the batch
 * reports it summed buildings — what it covers. Composition comes only from
 * `production_workers_display_batch`'s own `sites` / `includes_root`; see
 * `discoverWorkers`.
 */
export function workersBasisLabel(
  source: "RSC" | "registry" | undefined,
  basis: WorkersBasis | undefined,
): string | null {
  const from = source === "RSC" ? "RSC inspection" : source === "registry" ? "on the supplier record" : null;
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
export function discoverWorkers(row: Pick<DiscoverV32Row, "employees_total" | "workers_basis" | "workers_own" | "workers_source">): {
  own: number | null;
  ownLabel: string | null;
  second: number | null;
  secondLabel: string | null;
} {
  // The headline is always suppliers.employees_total: the registers' figure,
  // or an RSC headcount filled in where they had none
  // (ops/backfill_rsc_employees.py). So it is always "on the supplier record"
  // — the sort's and the filter's words too — even when an RSC headcount
  // happens to equal it, and when the batch failed. One name for one figure.
  const register = (n: number | null) => (n == null ? null : "on the supplier record");
  const basis = row.workers_basis;
  if (!basis) return { own: row.employees_total, ownLabel: register(row.employees_total), second: null, secondLabel: null };
  const own = row.workers_own ?? null;
  const shown = row.employees_total;
  if (basis === "own" && shown === own) {
    return { own, ownLabel: register(own), second: null, secondLabel: null };
  }
  return {
    own,
    ownLabel: register(own),
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

/**
 * The second figure in a few words, for a table cell where the full line
 * does not fit: "793 RSC", "5,195 with buildings". It used to live only in
 * the cell's hover title (and under the figure in the comfortable density),
 * so the list read 770 where the record beside it read 793, and Saved — which
 * printed the profile's figure alone — read 5,195 against the search's 2,030
 * for one factory (founder's walkthrough, 28 Sep 2026). Now both figures are
 * on screen wherever the two differ, in every list, with the same words.
 */
export function workersSecondShort(w: ReturnType<typeof discoverWorkers>): string | null {
  if (w.second == null) return null;
  const n = formatCount(w.second);
  switch (w.secondLabel) {
    case "RSC inspection":
      return `${n} RSC`;
    case "across this record and its buildings":
      return `${n} with buildings`;
    case "across its buildings, not this record":
      return `${n} in buildings`;
    default:
      return `${n} on profile`;
  }
}

/** "8 registers & certifiers" — the population `p_min_sources` filters on. */
function registerCountLabel(n: number): string {
  // None is said in words, never as a count of 0 beside a list of none.
  return n === 0 ? "No register or certifier" : `${n} ${n === 1 ? "register or certifier" : "registers & certifiers"}`;
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
    /** Discover passes the search's own URL with `?record=<slug>`, so the record opens over the results. */
    recordHref?: (slug: string) => string;
    /** Where Send RFQ goes for this supplier; Discover passes the search URL with `rfq=`, so the composer opens beside the results. */
    rfqHref?: (supplierId: string) => string;
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
  // The tile sub-lines ("2 on file", "12 lines", "11 sources") are links INTO
  // this record's sheet tabs (§3.1). They hardcoded the full-page URL while
  // this same function took a `recordHref` option for the card's own links —
  // so clicking a sub-line on a result threw the search away, which is the one
  // thing §3.3 exists to prevent.
  const recordHref = opts.recordHref?.(row.slug) ?? `/app/suppliers/${row.slug}`;
  const year = establishedYearOf(row.established_date);
  const place = placeLabel(row.city, row.district);
  // Spec §3.1: "we show the exact worker count with its source", and §3.3 puts
  // workers on the meta line "with its register mark".
  const w = discoverWorkers(row);
  const workersSecond = secondLine(w);

  // Status only, the one place the card spends a status colour (founder's
  // review, 29 Sep 2026: every fact was said two or three times). Every
  // certificate is a chip; the card draws four and names the rest on "+N".
  // The links the four tiles carried ride on the matching chip.
  const certChips: HighlightChip[] = [];
  for (const c of certList) {
    certChips.push({
      tone: c.state === "valid" ? "positive" : c.state === "no-expiry" ? "neutral" : "caution",
      icon: c.state === "valid" ? "check-c" : c.state === "expiring" ? "clock" : c.state === "expired" ? "warn" : undefined,
      label: certChipLabel(c),
      href: `${recordHref}#certificates`,
    });
  }
  // The sketch's order: two certificates, then RSC and EPB, so the card's
  // one line of status never hides the safety or export facts behind "+N".
  const chips: HighlightChip[] = certChips.slice(0, 2);
  if (row.rsc_progress_pct != null) {
    chips.push({ tone: "neutral", icon: "shield", label: "RSC inspected", href: `${recordHref}#safety` });
  }
  // "Not on the list" is a claim about the register; an empty `lines` is not.
  // Lines come back empty whenever the EPB record carries no `epb_hscodes`
  // array, the codes fail the 4–6 digit shape, or the host/exporter pair is on
  // the `epb_record_is_foreign_to_host` denylist — none of which mean the
  // supplier is absent from EPB. The register itself is what `registries`
  // reports, so only say "not on the list" when EPB is genuinely not there.
  const onEpbRegister = registers.includes("EPB");
  if (opts.hsError) chips.push({ tone: "quiet", label: "EPB lines could not be read" });
  else if (lines.length > 0) chips.push({ tone: "neutral", label: `EPB exporter · ${lines.length} ${lines.length === 1 ? "line" : "lines"}`, href: `${recordHref}#products` });
  else if (onEpbRegister) chips.push({ tone: "quiet", label: "EPB exporter · no lines recorded" });
  else chips.push({ tone: "quiet", label: "Not on the EPB exporter list" });
  chips.push(...certChips.slice(2));
  if (certList.length === 0) chips.push({ tone: "quiet", label: "No certificate on file" });
  if (marks.length <= 1) {
    chips.push({
      tone: "quiet",
      label: `Nothing else on file · ${marks.length} of the sources read`,
    });
  }

  // One facts line, icon and value (PR B's style), cut to one line with the
  // whole line in its title. The two worker figures stay two (founder, 28 Sep
  // 2026: a list figure and a record figure must never be confused), each in
  // its short form, its full words in its title and read to a screen reader.
  const meta: FactWithMark[] = [
    { text: entityLabel(row.entity_type), mark: null, icon: row.entity_type === "buying_house" ? "buying-house" : row.entity_type === "factory" ? "factory" : "company" },
    ...(place ? [{ text: place, mark: null, icon: "address" as const }] : []),
    ...(year ? [{ text: `Est. ${year}`, mark: null, icon: "established" as const }] : []),
    ...(w.own != null
      ? [{ text: `${formatCount(w.own)} workers`, title: `${formatCount(w.own)} workers${w.ownLabel ? ` · ${w.ownLabel}` : ""}`, mark: null, icon: "workers" as const }]
      : [{
          // "Workers not on file" directly above "907 workers · …" read as a
          // contradiction; with a second figure the gap is only the record's own.
          text: workersSecond ? "No worker figure on the supplier record" : "Workers not on file",
          mark: null,
          icon: "workers" as const,
          quiet: true as const,
        }]),
    ...(workersSecond ? [{ text: workersSecondShort(w)!, title: workersSecond, mark: null, aside: w.own != null }] : []),
  ];
  // The marks row's one caption, the two populations apart. The first figure is
  // the one the "≥ N registers or certifiers" filter and the "Most registers &
  // certifiers" sort use (t13_source_count, tiers 1–3), not the mark count, or
  // a card reads "0 sources" while matching "≥ 1".
  const sourcesCaption = [registerCountLabel(row.t13_source_count ?? 0), brands.length ? `${brands.length} brand ${brands.length === 1 ? "list" : "lists"}` : null]
    .filter(Boolean)
    .join(" · ");
  // What the Registers and Listed by tiles said beyond the marks.
  const sourcesNote =
    [registers.length === 0 ? "Registers: no register number on file" : null, brands.length ? null : "Brand lists: not on a brand list we read"].filter(Boolean).join(" · ") || null;

  return {
    slug: row.slug,
    recordHref: opts.recordHref?.(row.slug) ?? null,
    name,
    initials: initials(name),
    topTier: (row.top_tier as SupplierCardModel["topTier"]) ?? topTier(tags),
    marks,
    meta,
    sanctioned,
    chips,
    sourcesCaption,
    sourcesNote,
    photos: opts.hsError ? [] : photoTiles(lines, 6),
    totalLines: lines.length,
    linesUnknown: opts.hsError,
    epbReadDate: null,
    onEpbRegister,
    why: null,
    selected: false,
    saved: Boolean(opts.saved),
    supplierId: row.id,
    rfqHref: row.is_sanctioned ? null : (opts.rfqHref?.(row.id) ?? `/app/rfqs/new?supplier=${row.id}`),
  };
}

export function buildDiscoverTableRow(
  row: DiscoverV32Row,
  opts: {
    today: Date;
    hsLines: readonly HsBatchLine[];
    hsError: boolean;
    saved?: boolean;
    recordHref?: (slug: string) => string;
    rfqHref?: (supplierId: string) => string;
  },
): TableRowModel {
  const card = buildDiscoverCard(row, opts);
  const w = discoverWorkers(row);
  const certList = certsFromSummary(row.cert_summary, opts.today);
  const lines = hsForSlug(row.slug, opts.hsLines, row.hs_codes ?? []);
  return {
    slug: row.slug,
    recordHref: card.recordHref,
    name: card.name,
    place: placeLabel(row.city, row.district),
    initials: card.initials,
    topTier: card.topTier,
    // The figure the default sort ("Most registers & certifiers") and the
    // minimum-sources filter use, as the card's count line does — not the
    // number of marks, which counts brand lists too and read out of order.
    sourceCount: row.t13_source_count ?? 0,
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
    workersSecondShort: workersSecondShort(w),
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
    workers_source: w.own == null ? "" : (w.ownLabel ?? "on the supplier record"),
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
