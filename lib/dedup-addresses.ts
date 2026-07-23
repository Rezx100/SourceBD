// Address dedup for supplier profile locations.
//
// Data arrives as one row per (address, authority) pair. We merge by
// physical location first (global fuzzy match), then bucket each unique
// location into a single UI group by primary type priority:
// Factory > Registered office > Mailing.

export type AddressRowRaw = {
  kind: string;
  address: string;
  phone?: string | null;
  email?: string | null;
  source_code: string;
  fetched_at: string;
};

export type UniqueLocation<T extends AddressRowRaw = AddressRowRaw> = {
  displayAddress: string;
  authorities: string[];
  types: string[];
  phones: string[];
  emails: string[];
  fetched_at: string;
  source_rows: T[];
};

export type LocationOverviewGroup<T extends AddressRowRaw = AddressRowRaw> = {
  title: GroupTitle;
  locations: UniqueLocation<T>[];
};

export type LocationDedupResult<T extends AddressRowRaw = AddressRowRaw> = {
  locations: UniqueLocation<T>[];
  groups: LocationOverviewGroup<T>[];
  sourceRecordCount: number;
  uniqueLocationCount: number;
};

/** @deprecated Legacy shape — prefer `UniqueLocation`. */
export type DedupedAddress<T extends AddressRowRaw = AddressRowRaw> = {
  kind: string;
  kinds: string[];
  address: string;
  phones: string[];
  emails: string[];
  verified_by: string[];
  fetched_at: string;
  source_rows: T[];
};

const MERGE_THRESHOLD = 0.75;

const TRANSLITERATION_PAIRS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\bchittagong\b/g, "chattogram"],
  [/\bdacca\b/g, "dhaka"],
  [/\bbayzid\b/g, "baizid"],
  [/\bdhanmandi\b/g, "dhanmondi"],
  [/\bn[\s.]?ganj\b/g, "narayanganj"],
  [/\bmaymashingo\b/g, "mymensingh"],
  [/\bmaymanshingh\b/g, "mymensingh"],
  [/\bmymensing\b/g, "mymensingh"],
];

const ABBREVIATION_PAIRS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\bi\s*\/\s*a\b/g, "industrial area"],
  [/\bi\.\s*a\.?\b/g, "industrial area"],
  [/\bind\.?\s*area\b/g, "industrial area"],
  [/\brd\.?\b/g, "road"],
  [/\bave\.?\b/g, "avenue"],
  [/\bblvd\.?\b/g, "boulevard"],
];

export type AddressTypeCategory = "factory" | "registered" | "mailing" | "other";

export const GROUP_TITLES = [
  "Factories",
  "Registered offices",
  "Mailing addresses",
  "Other addresses",
] as const;

export type GroupTitle = (typeof GROUP_TITLES)[number];

const GROUP_BY_CATEGORY: Record<AddressTypeCategory, GroupTitle> = {
  factory: "Factories",
  registered: "Registered offices",
  mailing: "Mailing addresses",
  other: "Other addresses",
};

const TYPE_LABEL: Record<AddressTypeCategory, string> = {
  factory: "Factory",
  registered: "Registered office",
  mailing: "Mailing address",
  other: "Other",
};

const CATEGORY_PRIORITY: AddressTypeCategory[] = [
  "factory",
  "registered",
  "mailing",
  "other",
];

/** Skip null/empty segments so ",," never renders in display text. */
export function cleanAddressString(raw: string | null | undefined): string {
  if (!raw?.trim()) return "";
  const parts = raw
    .split(/,\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.join(", ");
}

/** Normalised match key: lowercase, no punctuation, collapsed whitespace,
 *  consecutive duplicate words removed, empty tokens dropped. */
export function normaliseAddressKey(input: string): string {
  let s = input.toLowerCase();
  for (const [pat, rep] of TRANSLITERATION_PAIRS) s = s.replace(pat, rep);
  for (const [pat, rep] of ABBREVIATION_PAIRS) s = s.replace(pat, rep);
  s = s.replace(/\bplot\s*(no\.?|number|#|:)\s*/g, "plot ");
  s = s.replace(/\bblock\s*[-:]\s*/g, "block ");
  s = s.replace(/\broad\s*(no\.?|#|:)\s*/g, "road ");
  s = s.replace(/\bsector\s*#\s*/g, "sector ");
  s = s.replace(/\bhouse\s*(no\.?|#|:)\s*/g, "house ");
  s = s.replace(/[-,]\s*\b\d{4}\b/g, " ");
  s = s.replace(/\b\d{4}\b(?=\s*(?:,|bangladesh|$))/g, " ");
  s = s.replace(/\bbangladesh\b/g, "");
  s = s.replace(/\bbd\b/g, "");
  s = s.replace(/[#().,:;/\-]/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  const deduped: string[] = [];
  for (const part of s.split(" ")) {
    if (!part) continue;
    if (deduped.length === 0 || deduped[deduped.length - 1] !== part) {
      deduped.push(part);
    }
  }
  return deduped.join(" ");
}

function tokens(key: string): Set<string> {
  return new Set(
    key.split(" ").filter((t) => t.length >= 3 || /^\d+$/.test(t)),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter += 1;
  return inter / (a.size + b.size - inter);
}

function containment(a: Set<string>, b: Set<string>): number {
  const small = a.size <= b.size ? a : b;
  const large = a.size <= b.size ? b : a;
  if (small.size === 0) return 0;
  let inter = 0;
  for (const t of small) if (large.has(t)) inter += 1;
  return inter / small.size;
}

export function typeCategory(kind: string): AddressTypeCategory {
  const k = kind.toLowerCase().trim();
  if (k === "factory" || k === "warehouse") return "factory";
  if (
    k === "registered" ||
    k === "registered_office" ||
    k === "head_office" ||
    k === "corporate" ||
    k === "office"
  ) {
    return "registered";
  }
  if (k === "mailing") return "mailing";
  return "other";
}

export function primaryCategory(types: readonly string[]): AddressTypeCategory {
  const cats = new Set(types.map(typeCategory));
  for (const cat of CATEGORY_PRIORITY) {
    if (cats.has(cat)) return cat;
  }
  return "other";
}

export function primaryGroupTitle(types: readonly string[]): GroupTitle {
  return GROUP_BY_CATEGORY[primaryCategory(types)];
}

/** Secondary type labels for display ("Registered office", …). */
export function secondaryTypeLabels(types: readonly string[]): string[] {
  const primary = primaryCategory(types);
  const labels: string[] = [];
  for (const cat of CATEGORY_PRIORITY) {
    if (cat === primary) continue;
    if (types.some((t) => typeCategory(t) === cat)) {
      const label = TYPE_LABEL[cat];
      if (!labels.includes(label)) labels.push(label);
    }
  }
  return labels;
}

function rowToLocation<T extends AddressRowRaw>(row: T): UniqueLocation<T> {
  const display = cleanAddressString(row.address);
  return {
    displayAddress: display,
    authorities: [row.source_code],
    types: [row.kind],
    phones: row.phone ? [row.phone] : [],
    emails: row.email ? [row.email] : [],
    fetched_at: row.fetched_at,
    source_rows: [row],
  };
}

function mergeLocations<T extends AddressRowRaw>(
  target: UniqueLocation<T>,
  donor: UniqueLocation<T>,
): void {
  const donorDisplay = cleanAddressString(donor.displayAddress);
  if (donorDisplay.length > target.displayAddress.length) {
    target.displayAddress = donorDisplay;
  }
  for (const kind of donor.types) {
    if (!target.types.includes(kind)) target.types.push(kind);
  }
  for (const auth of donor.authorities) {
    if (!target.authorities.includes(auth)) target.authorities.push(auth);
  }
  for (const p of donor.phones) {
    if (!target.phones.includes(p)) target.phones.push(p);
  }
  for (const e of donor.emails) {
    if (!target.emails.includes(e)) target.emails.push(e);
  }
  if (donor.fetched_at > target.fetched_at) {
    target.fetched_at = donor.fetched_at;
  }
  target.source_rows.push(...donor.source_rows);
}

/** Merge all records whose normalised keys share ≥ threshold token-set
 *  similarity into one location (longest displayAddress, union authorities
 *  and types). */
export function mergeUniqueLocations<T extends AddressRowRaw>(
  rows: readonly T[],
  threshold = MERGE_THRESHOLD,
): UniqueLocation<T>[] {
  const valid = rows.filter((r) => r.address?.trim());
  const singletons = valid.map(rowToLocation);
  const ordered = [...singletons].sort(
    (a, b) => b.displayAddress.length - a.displayAddress.length,
  );
  const merged: UniqueLocation<T>[] = [];
  const tokenSets: Set<string>[] = [];

  for (const loc of ordered) {
    const tok = tokens(normaliseAddressKey(loc.displayAddress));
    let mergedIdx = -1;
    for (let i = 0; i < merged.length; i++) {
      const other = tokenSets[i]!;
      const minSize = Math.min(other.size, tok.size);
      if (
        jaccard(other, tok) >= threshold ||
        (minSize >= 5 && containment(other, tok) >= 0.95)
      ) {
        mergedIdx = i;
        break;
      }
    }
    if (mergedIdx === -1) {
      merged.push(loc);
      tokenSets.push(tok);
    } else {
      mergeLocations(merged[mergedIdx]!, loc);
      for (const t of tok) tokenSets[mergedIdx]!.add(t);
    }
  }
  return merged;
}

export function buildLocationOverview<T extends AddressRowRaw>(
  rows: readonly T[],
): LocationDedupResult<T> {
  const valid = rows.filter((r) => r.address?.trim());
  const locations = mergeUniqueLocations(valid);
  const buckets = new Map<GroupTitle, UniqueLocation<T>[]>();

  for (const loc of locations) {
    const title = primaryGroupTitle(loc.types);
    const list = buckets.get(title) ?? [];
    list.push(loc);
    buckets.set(title, list);
  }

  const groups: LocationOverviewGroup<T>[] = [];
  for (const title of GROUP_TITLES) {
    const bucket = buckets.get(title);
    if (!bucket || bucket.length === 0) continue;
    groups.push({ title, locations: bucket });
  }

  return {
    locations,
    groups,
    sourceRecordCount: valid.length,
    uniqueLocationCount: locations.length,
  };
}

export function locationOverviewMeta(
  uniqueCount: number,
  recordCount: number,
): string {
  const locLabel = uniqueCount === 1 ? "location" : "locations";
  const recLabel = recordCount === 1 ? "record" : "records";
  return `${uniqueCount} unique ${locLabel} · ${recordCount} source ${recLabel}`;
}

/** Legacy adapter — header primary address lookup. */
export function dedupAddresses<T extends AddressRowRaw>(
  rows: readonly T[],
): DedupedAddress<T>[] {
  return mergeUniqueLocations(rows).map((loc) => ({
    kind: loc.types[0] ?? "unknown",
    kinds: loc.types,
    address: loc.displayAddress,
    phones: loc.phones,
    emails: loc.emails,
    verified_by: loc.authorities,
    fetched_at: loc.fetched_at,
    source_rows: loc.source_rows,
  }));
}
