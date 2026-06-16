// I-012 (extended by debug batch 2026-06-06 I-020) — pure-function dedup
// for the "Addresses on file" panel.
//
// `v_supplier_addresses` correctly emits one row per (source_code,
// address_kind) as provenance. When two or more rows describe the same
// physical building we want to render that building **once** — even when
// one source labels it `factory` and another labels it `mailing` /
// `registered`. The goal is "most detailed unique address; mention who
// approved it", so we collapse across `address_kind` and surface the
// kinds + sources that corroborate the row.
//
// Match key (case-insensitive, punctuation-folded):
//   1. lowercase
//   2. fold transliteration variants for Bangladeshi place names
//      (chittagong/chattogram, dacca/dhaka, baizid/bayzid, etc.)
//   3. expand abbreviations ("ind. area"/"i/a" → "industrial area",
//      "rd" → "road", "ave" → "avenue", "blvd" → "boulevard")
//   4. fold "plot no" / "plot #" / "plot:" → "plot"; same for
//      block/road/sector/house number prefixes
//   5. strip Bangladesh 4-digit postal codes and the standalone
//      country token (`bangladesh` / `bd`)
//   6. strip `# . , : ; / ( ) -` and collapse whitespace
//   7. collapse repeated trailing tokens ("dhaka dhaka" → "dhaka")
//
// After deterministic-key grouping we run a second pass that merges any
// remaining groups whose normalised token sets share ≥ 0.9 Jaccard
// overlap, so rows that add postal codes or extra locality words still
// collapse onto the canonical (longest) row.

export type AddressRowRaw = {
  kind: string;
  address: string;
  phone?: string | null;
  email?: string | null;
  source_code: string;
  fetched_at: string;
};

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

const TRANSLITERATION_PAIRS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\bchittagong\b/g, "chattogram"],
  [/\bdacca\b/g, "dhaka"],
  [/\bbayzid\b/g, "baizid"],
  [/\bdhanmandi\b/g, "dhanmondi"],
  [/\bn[\s.]?ganj\b/g, "narayanganj"],
];

const ABBREVIATION_PAIRS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\bi\s*\/\s*a\b/g, "industrial area"],
  [/\bi\.\s*a\.?\b/g, "industrial area"],
  [/\bind\.?\s*area\b/g, "industrial area"],
  [/\brd\.?\b/g, "road"],
  [/\bave\.?\b/g, "avenue"],
  [/\bblvd\.?\b/g, "boulevard"],
];

function normaliseKey(input: string): string {
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
  const parts = s.split(" ");
  while (
    parts.length >= 2 &&
    parts[parts.length - 1] === parts[parts.length - 2]
  ) {
    parts.pop();
  }
  return parts.join(" ");
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

/** Containment ratio = |A ∩ B| / min(|A|, |B|). 1.0 when one set is a
 * subset of the other — catches the common case where one source records
 * a richer address (extra locality, postal code) for the same building. */
function containment(a: Set<string>, b: Set<string>): number {
  const small = a.size <= b.size ? a : b;
  const large = a.size <= b.size ? b : a;
  if (small.size === 0) return 0;
  let inter = 0;
  for (const t of small) if (large.has(t)) inter += 1;
  return inter / small.size;
}

function mergeInto<T extends AddressRowRaw>(
  target: DedupedAddress<T>,
  donor: DedupedAddress<T>,
): void {
  if (donor.address.length > target.address.length) {
    target.address = donor.address;
  }
  for (const k of donor.kinds) {
    if (!target.kinds.includes(k)) target.kinds.push(k);
  }
  for (const p of donor.phones) {
    if (!target.phones.includes(p)) target.phones.push(p);
  }
  for (const e of donor.emails) {
    if (!target.emails.includes(e)) target.emails.push(e);
  }
  for (const sc of donor.verified_by) {
    if (!target.verified_by.includes(sc)) target.verified_by.push(sc);
  }
  if (donor.fetched_at > target.fetched_at) {
    target.fetched_at = donor.fetched_at;
  }
  target.source_rows.push(...donor.source_rows);
}

export function dedupAddresses<T extends AddressRowRaw>(
  rows: readonly T[],
): DedupedAddress<T>[] {
  const groups = new Map<string, DedupedAddress<T>>();
  for (const row of rows) {
    if (!row.address || row.address.trim() === "") continue;
    const key = normaliseKey(row.address);
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, {
        kind: row.kind,
        kinds: [row.kind],
        address: row.address,
        phones: row.phone ? [row.phone] : [],
        emails: row.email ? [row.email] : [],
        verified_by: [row.source_code],
        fetched_at: row.fetched_at,
        source_rows: [row],
      });
      continue;
    }
    if (row.address.length > existing.address.length) {
      existing.address = row.address;
    }
    if (!existing.kinds.includes(row.kind)) existing.kinds.push(row.kind);
    if (row.phone && !existing.phones.includes(row.phone)) {
      existing.phones.push(row.phone);
    }
    if (row.email && !existing.emails.includes(row.email)) {
      existing.emails.push(row.email);
    }
    if (!existing.verified_by.includes(row.source_code)) {
      existing.verified_by.push(row.source_code);
    }
    if (row.fetched_at > existing.fetched_at) {
      existing.fetched_at = row.fetched_at;
    }
    existing.source_rows.push(row);
  }

  const ordered = Array.from(groups.entries()).sort(
    (a, b) => b[1].address.length - a[1].address.length,
  );
  const merged: DedupedAddress<T>[] = [];
  const tokenSets: Set<string>[] = [];
  for (const [key, group] of ordered) {
    const tok = tokens(key);
    let mergedIdx = -1;
    for (let i = 0; i < merged.length; i++) {
      const other = tokenSets[i]!;
      const minSize = Math.min(other.size, tok.size);
      // Two address groups merge when either:
      //  - their token sets are ≥ 90% Jaccard-similar (genuinely the same
      //    address, e.g. trivial punctuation differences); or
      //  - the smaller set is ≥ 95% contained in the larger one AND has at
      //    least 5 significant tokens (so one source recorded a richer
      //    version of the other — extra locality / postal code / etc.).
      if (
        jaccard(other, tok) >= 0.9 ||
        (minSize >= 5 && containment(other, tok) >= 0.95)
      ) {
        mergedIdx = i;
        break;
      }
    }
    if (mergedIdx === -1) {
      merged.push(group);
      tokenSets.push(tok);
    } else {
      mergeInto(merged[mergedIdx]!, group);
      for (const t of tok) tokenSets[mergedIdx]!.add(t);
    }
  }
  return merged;
}
