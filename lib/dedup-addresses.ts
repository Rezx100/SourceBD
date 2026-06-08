// I-012 (extended by debug batch 2026-06-06 I-020, and 2026-06-09 I-035 —
// Levenshtein-based proper-noun matching for Bangladeshi place-name
// transliteration drift) — pure-function dedup for the "Addresses on file"
// panel.
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
//   2. fold transliteration variants for Bangladeshi place names that
//      Levenshtein won't catch on its own (chittagong/chattogram,
//      dacca/dhaka, dhanmandi/dhanmondi, n.ganj/narayanganj, etc.)
//   3. expand abbreviations ("ind. area"/"i/a" → "industrial area",
//      "rd" → "road", "ave" → "avenue", "blvd" → "boulevard")
//   4. join dotted initialisms (d.o.h.s → dohs, c/a → ca)
//   5. fold "plot no" / "plot #" / "plot:" → "plot"; same for
//      block/road/sector/house number prefixes
//   6. strip Bangladesh 4-digit postal codes and the standalone
//      country token (`bangladesh` / `bd`)
//   7. strip `# . , : ; / ( ) -` and collapse whitespace
//   8. collapse repeated trailing tokens ("dhaka dhaka" → "dhaka")
//
// After deterministic-key grouping we run a second pass with a fuzzy
// containment check on **discriminating** tokens only (street/building
// noise words like "house", "road", "floor", "block" are dropped before
// comparison so they don't dilute the ratio). Two address groups are
// considered the same physical building when the smaller group's
// discriminating tokens are ≥95% contained in the larger one — under a
// fuzzy match that treats two ≥6-char tokens within Levenshtein 2 of each
// other as identical. This collapses spelling drift like
// "Sardaganj"/"Shardaganj"/"Shardagong",
// "Mosaraf"/"Mosharaf", "Shofipur"/"Shafipur", "Kaliakair"/"Kaliakoir",
// "Vangnahati"/"Vanggahati", "Chandura"/"Chondura" without us having to
// hard-code every variant.
//
// Finally, the chosen display string for each group is run through
// `cleanDisplayAddress` to remove adjacent duplicate word tokens like
// "Dhaka Dhaka" or "Sreepur, Sreepur" that the source rows sometimes
// emit when a city and district share a name.

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
  // Join dotted initialisms before the punctuation strip so "d.o.h.s"
  // collapses to "dohs" instead of splitting into four 1-char tokens
  // that fall under the token-length filter.
  s = s.replace(
    /\b([a-z])\.([a-z])\.?([a-z])?\.?([a-z])?\.?(?=[\s,.)/-]|$)/g,
    (_m, a, b, c, d) => `${a}${b}${c ?? ""}${d ?? ""}`,
  );
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

// Street/building noise words — present in nearly every Bangladeshi address
// and therefore add no discriminating signal when comparing two address
// strings. Dropping them before the fuzzy comparison prevents two
// completely different addresses ("House 288 Road 4 Dhaka" vs
// "House 365 Road 28 Dhaka") from inflating each other's containment
// ratio just because they share `house`, `road`, `dhaka`.
const STOP_TOKENS: ReadonlySet<string> = new Set([
  "house", "road", "rd", "block", "plot", "sector", "lane", "avenue",
  "floor", "flr", "building", "tower", "apt", "suite", "ste",
  "holding", "premises", "unit",
  "city", "town", "post", "office", "ps", "thana", "upazila",
  "industrial", "area", "zone", "ind", "park",
  "bangladesh", "bd",
  // The four divisions/major cities appear on most addresses; they're
  // useful as a tie-breaker but not as a discriminator.
  "dhaka", "chattogram", "khulna", "rajshahi", "sylhet", "barisal",
  "rangpur", "mymensingh",
]);

// Floor-level ordinals (1st-12th floor / 1st-6th floor) appear as
// building-internal descriptors next to "floor" and should also drop
// out of the discriminating set. Cheaper to match by regex than to
// enumerate.
const ORDINAL_RE = /^\d+(st|nd|rd|th)$/;

function discriminatingTokens(key: string): Set<string> {
  const out = new Set<string>();
  for (const t of key.split(" ")) {
    if (t.length < 3 && !/^\d+$/.test(t)) continue;
    if (STOP_TOKENS.has(t)) continue;
    if (ORDINAL_RE.test(t)) continue;
    // Drop the BGMEA-style "b" single-letter block marker that survives
    // punctuation stripping but adds no signal.
    if (t.length === 1) continue;
    out.add(t);
  }
  return out;
}

/** Two tokens are "fuzzy-equal" when:
 *   - they're identical, OR
 *   - both are pure-numeric and equal after stripping leading zeros
 *     ("4" == "04", "100" == "00100"), OR
 *   - one is a substring of the other and the longer is at least
 *     5 chars (catches subword overlap like "ananta"/"ananta-ltd"),
 *     OR
 *   - both are ≥6 chars and their Damerau-style Levenshtein distance
 *     is ≤2 (catches single-character insert/delete/substitute and an
 *     adjacent-letter transposition — the three error classes that
 *     account for nearly all Bangla-to-English transliteration drift:
 *     "Mosaraf"/"Mosharaf", "Shofipur"/"Shafipur",
 *     "Kaliakair"/"Kaliakoir", "Sardaganj"/"Shardaganj"/"Shardagong",
 *     "Vangnahati"/"Vanggahati"). */
function fuzzyTokenEq(a: string, b: string): boolean {
  if (a === b) return true;
  if (/^\d+$/.test(a) && /^\d+$/.test(b)) {
    return a.replace(/^0+/, "") === b.replace(/^0+/, "");
  }
  const len = Math.max(a.length, b.length);
  if (len >= 5 && (a.includes(b) || b.includes(a))) return true;
  if (a.length < 6 || b.length < 6) return false;
  if (Math.abs(a.length - b.length) > 2) return false;
  return levenshtein(a, b) <= 2;
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = new Array<number>(n + 1);
  let curr = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(
        prev[j]! + 1,        // deletion
        curr[j - 1]! + 1,    // insertion
        prev[j - 1]! + cost, // substitution
      );
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n]!;
}

/** Containment ratio = |A ∩ B| / |smaller| under the fuzzy token-equality
 * relation. 1.0 means every discriminating token in the smaller group
 * has a fuzzy match in the larger one — i.e. the two address strings
 * almost certainly describe the same physical building. */
function fuzzyContainment(a: Set<string>, b: Set<string>): number {
  const small = a.size <= b.size ? a : b;
  const large = a.size <= b.size ? b : a;
  if (small.size === 0) return 0;
  let matched = 0;
  for (const t of small) {
    for (const u of large) {
      if (fuzzyTokenEq(t, u)) { matched += 1; break; }
    }
  }
  return matched / small.size;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter += 1;
  return inter / (a.size + b.size - inter);
}

/** Collapse adjacent duplicate word tokens in the *display* address so
 * that the source-supplied "Dhaka Dhaka" / "Sreepur, Sreepur" /
 * "Gazipur Gazipur" artefacts (caused by ETL concatenating a row whose
 * city and district happen to share a name) don't leak into the UI.
 * Operates on word boundaries only — preserves real numerics and
 * intentional repetition like "Block-B Block-B" (which never occurs in
 * practice but would be left alone if it did). */
export function cleanDisplayAddress(input: string): string {
  if (!input) return input;
  // Split on whitespace OR comma, keeping the separators so we can
  // reassemble the original string verbatim except for the collapses.
  const segments = input.split(/(,\s*|\s+)/);
  const out: string[] = [];
  let lastWord: string | null = null;
  const isSep = (s: string) => /^(,\s*|\s+)$/.test(s);
  for (const seg of segments) {
    if (isSep(seg)) {
      // If the previous emitted segment is already a separator, merge
      // them by preferring whichever is "stronger". A comma-bearing
      // separator outranks a pure-whitespace one — this is what keeps
      // "Sreepur, Sreepur Gazipur" → "Sreepur, Gazipur" instead of
      // "Sreepur Gazipur" when the duplicate word in the middle is
      // dropped.
      if (out.length > 0 && isSep(out[out.length - 1]!)) {
        const prev = out[out.length - 1]!;
        if (seg.includes(",") && !prev.includes(",")) {
          out[out.length - 1] = seg;
        }
        // else: keep the existing one
        continue;
      }
      out.push(seg);
      continue;
    }
    const lc = seg.toLowerCase();
    if (lastWord !== null && lc === lastWord) {
      // Drop this duplicate word but keep the separator that preceded
      // it so the surrounding context flows: "Sreepur, Sreepur Gazipur"
      // becomes "Sreepur,  Gazipur" — the next iteration's separator
      // merge then collapses the redundant whitespace.
      continue;
    }
    out.push(seg);
    lastWord = lc;
  }
  return out.join("").trim();
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

  // Sort longest-first so the richest version of an address becomes the
  // anchor that shorter variants merge into.
  const ordered = Array.from(groups.entries()).sort(
    (a, b) => b[1].address.length - a[1].address.length,
  );
  const merged: DedupedAddress<T>[] = [];
  // We carry two parallel arrays per merged group: the *full* token set
  // (used only as a fast-path for exact-match Jaccard) and the
  // discriminating token set (used for fuzzy containment, our main
  // merge signal). Both grow as more donor groups fold in.
  const fullTokenSets: Set<string>[] = [];
  const discTokenSets: Set<string>[] = [];
  for (const [key, group] of ordered) {
    const full = tokens(key);
    const disc = discriminatingTokens(key);
    let mergedIdx = -1;
    for (let i = 0; i < merged.length; i++) {
      const otherFull = fullTokenSets[i]!;
      const otherDisc = discTokenSets[i]!;
      const minDisc = Math.min(otherDisc.size, disc.size);
      // Two address groups describe the same physical building when:
      //  (a) their full token sets are ≥90% Jaccard-similar — handles
      //      genuinely-identical rows with only punctuation differences;
      //      OR
      //  (b) the smaller's discriminating tokens (street/building noise
      //      words removed) are ≥95% fuzzy-contained in the larger's,
      //      AND both groups have at least 2 discriminating tokens.
      //      This is what catches "Sardaganj"/"Shardaganj"/"Shardagong"
      //      or "Vangnahati"/"Vanggahati" — each address only contributes
      //      one or two truly discriminating tokens (the village/road
      //      name), and Levenshtein-≤2 fuzzy match folds the spelling
      //      drift onto the canonical row.
      if (
        jaccard(otherFull, full) >= 0.9 ||
        (minDisc >= 2 && fuzzyContainment(otherDisc, disc) >= 0.95)
      ) {
        mergedIdx = i;
        break;
      }
    }
    if (mergedIdx === -1) {
      merged.push(group);
      fullTokenSets.push(full);
      discTokenSets.push(disc);
    } else {
      mergeInto(merged[mergedIdx]!, group);
      for (const t of full) fullTokenSets[mergedIdx]!.add(t);
      for (const t of disc) discTokenSets[mergedIdx]!.add(t);
    }
  }

  // Final cosmetic pass: clean adjacent duplicate words in the display
  // address only (the source_rows keep the raw values).
  for (const g of merged) {
    g.address = cleanDisplayAddress(g.address);
  }
  return merged;
}
