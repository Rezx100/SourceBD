// Address dedup for supplier profile locations.
// Uses the shared BD place lexicon (lib/bd-place-lexicon.ts) inside
// normaliseAddressKey for place-name canonicalization (REZ-28).
//
// Data arrives as one row per (address, authority) pair, and the registries
// spell the same premises differently: transliteration drift (Kainzanul /
// Kainjanul), abbreviations (BSCIC I/E vs Industrial Estate), floor markers,
// embedded newlines, ALL CAPS, and repeated administrative tails.
//
// We merge by physical location first, then bucket each unique location into
// a single UI group by primary type priority: Factory > Registered office >
// Mailing. Alternate spellings stay visible as variants with their
// authorities — one row per premises, not one row per registry string.
//
// Hard blocks: conflicting plot / holding / house numbers, and conflicting
// leading village names (including the never-same list Sreepur≠Sripur and
// Nawabganj≠Chapainawabganj). Extra unmatched words that are not a competing
// leading village no longer keep the same premises apart.

import { applyPlaceLexicon } from "./bd-place-lexicon";

export type AddressRowRaw = {
  kind: string;
  address: string;
  phone?: string | null;
  email?: string | null;
  source_code: string;
  fetched_at: string;
};

/** One alternate registry spelling of a merged premises. */
export type AddressVariant = {
  address: string;
  authorities: string[];
};

export type UniqueLocation<T extends AddressRowRaw = AddressRowRaw> = {
  displayAddress: string;
  authorities: string[];
  types: string[];
  phones: string[];
  emails: string[];
  /** Floor markers stripped from the variants ("4th & 5th Floor"). */
  floors: string[];
  /** Other spellings this premises was recorded under, each with the
   *  authorities that used that wording. */
  variants: AddressVariant[];
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

/** Similarity needed to merge when neither side names a plot number. */
const MERGE_THRESHOLD = 0.75;
/** Relaxed threshold once both sides name the same plot number: the
 *  identifier already establishes identity, so spelling may drift freely. */
const SHARED_ID_THRESHOLD = 0.6;
/** A pair of words counts as the same word at this Jaro-Winkler score, but
 *  only if the edit-distance ratio also holds. Jaro-Winkler alone rewards a
 *  shared prefix too generously and would fuse Mirpur with Mirzapur. */
const TOKEN_JW = 0.9;
const TOKEN_LEV = 0.78;


const ABBREVIATION_PAIRS: ReadonlyArray<readonly [RegExp, string]> = [
  // Longest first: "in/estate" must not be eaten by the "i/a" rule.
  [/\bin\s*\/\s*estate\b/g, "industrial estate"],
  [/\binds?\.?\s*est\w*\b/g, "industrial estate"],
  [/\bindustrial\s+est\w*\b/g, "industrial estate"],
  [/\bind\.?\s*area\b/g, "industrial estate"],
  [/\bi\s*\/\s*[ea]\b/g, "industrial estate"],
  [/\bi\.\s*[ea]\.?\b/g, "industrial estate"],
  [/\bindustrial\s+area\b/g, "industrial estate"],
  [/\br\s*\/\s*a\b/g, "residential area"],
  [/\bcomm\.?\s+complex\b/g, "commercial complex"],
  [/\bfl(?:r|oor)?s?\.?\b/g, "floor"],
  [/\bp\.?\s*s\.?\b(?=\s|$)/g, "police station"],
  [/\brd\.?\b/g, "road"],
  [/\bave\.?\b/g, "avenue"],
  [/\bblvd\.?\b/g, "boulevard"],
  // REZ-112: Post Office abbreviations. Do not require \\b after the optional
  // trailing period — "p.o.-bhawal" has no word-boundary between '.' and '-'.
  [/\bp\.?\s*o\.?(?=[\s,\-]|$)/g, "post"],
  [/\bpost\s*:/g, "post"],
];

/** Words that describe a kind of place rather than which place. Matching on
 *  these alone must never merge two suppliers. */
const GENERIC_TOKENS = new Set([
  "road",
  "avenue",
  "lane",
  "plot",
  "plots",
  "holding",
  "house",
  "block",
  "sector",
  "section",
  "building",
  "floor",
  "industrial",
  "estate",
  "residential",
  "commercial",
  "complex",
  "tower",
  "market",
  "police",
  "station",
  "part",
  "north",
  "south",
  "east",
  "west",
  // REZ-112: P.O./Post: expands to "post" — administrative, not a place name.
  "post",
  // Village/admin wrappers that name a kind of place, not which place.
  "mouza",
  "para",
  "thana",
  "upazila",
  "upazilla",
  "zila",
  "zilla",
  "village",
  "vill",
  "ward",
  "union",
  "gpo",
  "sharani",
  "sharak",
  "sharok",
]);

/** Bangla script → English comparison tokens. Applied only to the match
 *  key; raw registry strings are never rewritten. */
const BANGLA_VOCAB: ReadonlyArray<readonly [RegExp, string]> = [
  [/রোড/g, " road "],
  [/সড়ক/g, " road "],
  [/রাস্তা/g, " road "],
  [/বাজার/g, " bazar "],
  [/মৌজা/g, " mouza "],
  [/প্লট/g, " plot "],
  [/থানা/g, " thana "],
  [/বাড়ি/g, " bari "],
  [/পাড়া/g, " para "],
  [/পারা/g, " para "],
  [/গ্রাম/g, " village "],
  [/এলাকা/g, " area "],
  [/হাউস/g, " house "],
  [/হোল্ডিং/g, " holding "],
  [/ফ্লোর/g, " floor "],
  [/উপজেলা/g, " upazila "],
];

/** Place pairs that a sound-key would otherwise fuse, but that are
 *  different administrative units. Honour the lexicon negatives here
 *  rather than in the geocode lexicon (this file only). */
const NEVER_SAME: ReadonlyArray<readonly [string, string]> = [
  ["sreepur", "sripur"],
  ["nawabganj", "chapainawabganj"],
];

/** Administrative names shared by thousands of suppliers. Low weight, so a
 *  shared district can support a merge but can never cause one. */
const ADMIN_TOKENS = new Set([
  "bangladesh",
  "dhaka",
  "chattogram",
  "gazipur",
  "narayanganj",
  "mymensingh",
  "khulna",
  "rajshahi",
  "sylhet",
  "barishal",
  "rangpur",
  "comilla",
  "cumilla",
  "sadar",
  "tongi",
  "savar",
  "ashulia",
  "mirpur",
  "uttara",
  "pallabi",
  "kafrul",
  "baizid",
  "chandgaon",
  "siddhirganj",
  "agrabad",
  "pahartali",
  "pahartoli",
  "kalurghat",
  "dewanhat",
  "epz",
  "bscic",
  "dohs",
  "old",
  "new",
]);

const GENERIC_WEIGHT = 0.2;
const ADMIN_WEIGHT = 0.35;
const DISTINCT_WEIGHT = 1;

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

/** Group heading → category. Lives here rather than in a `"use client"`
 *  component so Server Components can read it: importing a plain object out of
 *  a client module yields a client-reference proxy, not the object, which
 *  silently classified every map pin as "other" (REZ-30). */
export const CATEGORY_BY_GROUP: Record<GroupTitle, AddressTypeCategory> = {
  Factories: "factory",
  "Registered offices": "registered",
  "Mailing addresses": "mailing",
  "Other addresses": "other",
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

/** Registry tiers, highest first — used to break canonical-address ties. */
const SOURCE_TIER: Record<string, number> = {
  BGMEA: 3,
  BKMEA: 3,
  BTMA: 3,
  BGAPMEA: 3,
  EPB: 2,
  GOTS: 2,
  RSC: 2,
};

function segmentWords(segment: string): string[] {
  return segment
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/** Split on commas AND newlines, drop empty segments, then drop a trailing
 *  segment whose every word already appeared earlier — registry exports
 *  routinely re-state the district and thana at the end. */
export function cleanAddressString(raw: string | null | undefined): string {
  if (!raw?.trim()) return "";
  const parts = raw
    .split(/[\n\r,]+/)
    .map((part) => part.trim().replace(/\s+/g, " "))
    .filter(Boolean);

  let end = parts.length;
  while (end > 1) {
    const words = segmentWords(parts[end - 1]!);
    if (words.length === 0) {
      end -= 1;
      continue;
    }
    const earlier = new Set(parts.slice(0, end - 1).flatMap(segmentWords));
    if (words.every((word) => earlier.has(word))) end -= 1;
    else break;
  }

  return parts.slice(0, end).join(", ");
}

const FLOOR_RE =
  /\(?\s*\b(\d+\s*(?:st|nd|rd|th)?(?:\s*(?:,|&|and)\s*\d+\s*(?:st|nd|rd|th)?)*)\s*(?:floor|fl|flr)\b\.?\s*\)?/gi;

/** Pull "(4th & 5th Fl)" out of the match key and keep it as a detail. */
export function extractFloors(address: string): {
  stripped: string;
  floors: string[];
} {
  const floors: string[] = [];
  const stripped = address.replace(FLOOR_RE, (_match, label: string) => {
    const normalised = `${label.replace(/\s+/g, " ").trim()} Floor`;
    if (!floors.includes(normalised)) floors.push(normalised);
    return " ";
  });
  return { stripped: stripped.replace(/\s{2,}/g, " ").replace(/\s+,/g, ","), floors };
}

/** Normalised match key: lowercase, no punctuation, collapsed whitespace,
 *  consecutive duplicate words removed, empty tokens dropped. */
export function normaliseAddressKey(input: string): string {
  let s = input.toLowerCase();
  for (const [pat, rep] of BANGLA_VOCAB) s = s.replace(pat, rep);
  s = applyPlaceLexicon(s);
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
  s = s.replace(/\b\d+\s*\(\s*new\s*\)/gi, " ");
  s = s.replace(/\(\s*(?:old|new)\s*\)/gi, " ");
  s = s.replace(/[#().,:;/\-&]/g, " ");
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

function tokens(key: string): string[] {
  const out: string[] = [];
  for (const raw of key.split(" ")) {
    if (!raw) continue;
    const t = /^\d+$/.test(raw) ? String(Number(raw)) : raw;
    // Short tokens carrying a digit are plot fragments ("c5", "i10"), not noise.
    if (t.length >= 3 || /\d/.test(t)) {
      if (!out.includes(t)) out.push(t);
    }
  }
  return out;
}

function tokenWeight(token: string): number {
  if (ADMIN_TOKENS.has(token)) return ADMIN_WEIGHT;
  if (GENERIC_TOKENS.has(token)) return GENERIC_WEIGHT;
  return DISTINCT_WEIGHT;
}

// ---------- fuzzy word matching -------------------------------------------

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1]! + 1, prev[j]! + 1, prev[j - 1]! + cost);
    }
    prev = curr;
  }
  return prev[b.length]!;
}

function jaroWinkler(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;

  const window = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);
  const aFlags = new Array<boolean>(a.length).fill(false);
  const bFlags = new Array<boolean>(b.length).fill(false);
  let matches = 0;

  for (let i = 0; i < a.length; i++) {
    const start = Math.max(0, i - window);
    const stop = Math.min(i + window + 1, b.length);
    for (let j = start; j < stop; j++) {
      if (bFlags[j] || a[i] !== b[j]) continue;
      aFlags[i] = true;
      bFlags[j] = true;
      matches += 1;
      break;
    }
  }
  if (matches === 0) return 0;

  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < a.length; i++) {
    if (!aFlags[i]) continue;
    while (!bFlags[k]) k += 1;
    if (a[i] !== b[k]) transpositions += 1;
    k += 1;
  }
  transpositions /= 2;

  const jaro =
    (matches / a.length + matches / b.length + (matches - transpositions) / matches) / 3;

  let prefix = 0;
  while (prefix < 4 && prefix < a.length && prefix < b.length && a[prefix] === b[prefix]) {
    prefix += 1;
  }
  return jaro + prefix * 0.1 * (1 - jaro);
}

/** Bengali romanization sound-key. Collapses bh/v, z/j, inserted vowels
 *  and doubled consonants so Gajaria≈Gojaria and Vhawal≈Bhawal. Never-same
 *  pairs are rejected in `sameWord` even when their keys collide. */
export function bengaliSoundKey(word: string): string {
  let s = word.toLowerCase();
  s = s.replace(/vh/g, "b");
  s = s.replace(/bh/g, "b");
  s = s.replace(/ph/g, "f");
  s = s.replace(/gh/g, "g");
  s = s.replace(/dh/g, "d");
  s = s.replace(/th/g, "t");
  s = s.replace(/kh/g, "k");
  s = s.replace(/sh/g, "s");
  s = s.replace(/zh/g, "j");
  s = s.replace(/z/g, "j");
  s = s.replace(/v/g, "b");
  s = s.replace(/w/g, "u");
  s = s.replace(/y/g, "i");
  s = s.replace(/ee/g, "i");
  s = s.replace(/oo/g, "u");
  s = s.replace(/aa/g, "a");
  s = s.replace(/[aeiou]+/g, "a");
  s = s.replace(/(.)\1+/g, "$1");
  return s;
}

function neverSamePair(a: string, b: string): boolean {
  const left = a.toLowerCase();
  const right = b.toLowerCase();
  for (const [x, y] of NEVER_SAME) {
    if ((left === x && right === y) || (left === y && right === x)) return true;
  }
  return false;
}

/** Same word, allowing for transliteration drift. Digits must match exactly —
 *  "246" and "249" are not a spelling variation. Sreepur≠Sripur even though
 *  their sound-keys collide. */
function sameWord(a: string, b: string): boolean {
  if (a === b) return true;
  if (neverSamePair(a, b)) return false;
  if (/^\d+$/.test(a) && /^\d+$/.test(b)) return Number(a) === Number(b);
  if (/\d/.test(a) || /\d/.test(b)) return false;
  if (bengaliSoundKey(a) === bengaliSoundKey(b) && bengaliSoundKey(a).length >= 3) {
    return true;
  }
  if (Math.abs(a.length - b.length) > 3) return false;
  if (jaroWinkler(a, b) < TOKEN_JW) return false;
  const ratio = 1 - levenshtein(a, b) / Math.max(a.length, b.length);
  return ratio >= TOKEN_LEV;
}

// ---------- premises identifiers ------------------------------------------

// Registries write the label a dozen ways: "Plot # 9", "PLOT NO- B-336",
// "Plot-M-8", "House No. 39", "CH Plot # 1260", "Plot (Ka-12)". Swallow any
// run of separators after the label. Match the label anywhere in the segment
// so a two-letter industrial prefix ("CH Plot", "C H PLOT") still counts.
const LABELLED_ID_RE =
  /(?:plot|plots|holding|house|unit)\b[\s.:#-]*(?:no\.?|number|#|:)?[\s.:#-]*/i;

/** Bengali ka/kha/ga letter-prefixes used as plot block letters. Ka = K. */
function canonicalLetterPrefix(letters: string): string {
  const u = letters.toUpperCase().replace(/[^A-Z]/g, "");
  if (u === "KA") return "K";
  return u;
}

/** Leading zeros are formatting, not identity: FS-02 is FS-2. */
function normaliseId(prefix: string, value: string): string {
  return `${canonicalLetterPrefix(prefix)}${Number(value)}`;
}

/** Letters then digits, so "29/B", "B-29" and "B/29" all land on "B29". */
function canonicalCompound(raw: string): string {
  const letters = canonicalLetterPrefix((raw.match(/[A-Za-z]+/g) ?? []).join(""));
  const digits = (raw.match(/\d+/g) ?? []).map((d) => String(Number(d))).join("/");
  return `${letters}${digits}`;
}

function expandRange(prefix: string, from: number, to: number): string[] {
  if (to > from && to - from <= 30) {
    const out: string[] = [];
    for (let n = from; n <= to; n++) out.push(normaliseId(prefix, String(n)));
    return out;
  }
  return [normaliseId(prefix, String(from)), normaliseId(prefix, String(to))];
}

function stripIdBrackets(raw: string): string {
  return raw.replace(/[()[\]{}]/g, " ").replace(/\s+/g, " ").trim();
}

function parseIdPiece(piece: string): string[] {
  const raw = stripIdBrackets(piece.replace(/\((?:part|pt)\.?\)/gi, ""))
    .replace(/\s*\/\s*/g, "/")
    .replace(/\s*-\s*/g, "-")
    .trim();
  if (!raw || !/\d/.test(raw)) return [];
  if (/^(?:\d+(?:st|nd|rd|th)|floor|fl|flr)$/i.test(raw)) return [];

  const toRange = /^(\d+)\s+to\s+(\d+)$/i.exec(raw);
  if (toRange) return expandRange("", Number(toRange[1]), Number(toRange[2]));

  // Prefixed range: C5-C7, A-12-A-14, B/336 - 337, Ka-12-Ka-14.
  const letterRange =
    /^([A-Za-z]{1,3})[-/\s]?(\d+)\s*[-–]\s*([A-Za-z]{1,3})?[-/\s]?(\d+)$/.exec(raw);
  if (letterRange && (!letterRange[3] || canonicalLetterPrefix(letterRange[3]!) === canonicalLetterPrefix(letterRange[1]!))) {
    return expandRange(letterRange[1]!, Number(letterRange[2]), Number(letterRange[4]));
  }

  if (/\//.test(raw) && /^[A-Za-z0-9/\s-]+$/.test(raw)) {
    const parts = raw.split("/").map((p) => p.trim()).filter(Boolean);
    const allNumeric = parts.every((p) => /^\d+$/.test(p));
    if (allNumeric) {
      // "22/23" may be a pair written with a slash and "22-23" the same pair
      // written with a dash, so register the components alongside the compound.
      const compound = parts.map((p) => String(Number(p))).join("/");
      return [compound, ...parts.map((p) => String(Number(p)))];
    }
    // "A-169/170" is the same plots as "A-169-170": keep the compound and
    // each lettered component so slash and dash lists overlap.
    const letterSlash = /^([A-Za-z]{1,3})[-]?(\d+)$/.exec(parts[0]!);
    if (letterSlash && parts.slice(1).every((p) => /^\d+$/.test(p))) {
      const prefix = letterSlash[1]!;
      const nums = [letterSlash[2]!, ...parts.slice(1)];
      const ids = nums.map((n) => normaliseId(prefix, n));
      return [`${canonicalLetterPrefix(prefix)}${nums.map((n) => String(Number(n))).join("/")}`, ...ids];
    }
    return [canonicalCompound(raw)];
  }

  // Dash lists of three+ numbers are not a range: 12-13-14.
  const dashList = raw.split(/\s*[-–]\s*/).map((p) => p.trim()).filter(Boolean);
  if (dashList.length >= 3 && dashList.every((p) => /^\d+$/.test(p))) {
    const compound = dashList.map((p) => String(Number(p))).join("/");
    return [compound, ...dashList.map((p) => String(Number(p)))];
  }

  const range = /^([A-Za-z]{1,3})?[-\s]?(\d+)\s*[-–]\s*(\d+)$/.exec(raw);
  if (range) return expandRange(range[1] ?? "", Number(range[2]), Number(range[3]));

  const single = /^([A-Za-z]{1,3})?[-\s]?(\d+)$/.exec(raw);
  if (single) return [normaliseId(single[1] ?? "", single[2]!)];

  return [];
}

/** Collapse "C H PLOT" / "C.H. Plot" so the industrial prefix stays on the id. */
function collapsePlotInitials(segment: string): string {
  return segment.replace(
    /\b([A-Za-z])\s*[.\s]\s*([A-Za-z])\s+(?=(?:plot|plots|holding|house|unit)\b)/gi,
    "$1$2 ",
  );
}

/** A bare segment counts as an identifier only when it is short, contains a
 *  digit, and carries no real word — so "670" and "68/V" qualify while
 *  "Gazipur - 1712" and "Sm Tower" do not. Standalone four-digit numbers are
 *  treated as postcodes and ignored. */
function looksLikeBareId(segment: string): boolean {
  const trimmed = segment.trim();
  if (!/\d/.test(trimmed)) return false;
  if (/^\d{4}$/.test(trimmed)) return false;
  // Unlabelled 5+ digit runs are telephone / fax, not plot numbers.
  if (/^\d{5,}$/.test(trimmed)) return false;
  if (trimmed.split(/\s+/).length > 3) return false;
  return !/[A-Za-z]{3,}/.test(trimmed);
}

/** Not every registry puts a comma after the number: "68/V Sagarika Road"
 *  carries the same identifier as "68/V, Sagarica Road". */
const LEADING_ID_RE = /^([A-Za-z]{0,3}[-]?\d+(?:\/[A-Za-z0-9]+)?)\s+\S/;
const LEADING_RANGE_RE = /^(\d+)\s*[-–]\s*(\d+)(?:\b|$)/;

function collectIdPieces(body: string, ids: Set<string>): void {
  for (const piece of body.split(/\s*(?:&|,|\band\b)\s*/i)) {
    for (const id of parseIdPiece(piece)) ids.add(id);
  }
}

/** Plot / holding / house numbers named by an address. Floor markers are
 *  stripped first so "House 42/A (5th Floor)" does not mint a phantom id. */
export function premisesIdentifiers(cleanedAddress: string): Set<string> {
  const { stripped } = extractFloors(cleanedAddress);
  const withoutRenumber = stripped
    .replace(/\b\d+\s*\(\s*new\s*\)/gi, " ")
    .replace(/\(\s*(?:old|new)\s*\)/gi, " ");
  const ids = new Set<string>();
  for (const segment of withoutRenumber.split(",")) {
    const trimmed = collapsePlotInitials(stripIdBrackets(segment.trim()));
    if (!trimmed) continue;
    const labelled = LABELLED_ID_RE.exec(trimmed);
    let body: string | null = null;
    if (labelled) {
      body = trimmed.slice(labelled.index + labelled[0].length).trim();
    } else if (looksLikeBareId(trimmed)) {
      body = trimmed;
    } else {
      const range = LEADING_RANGE_RE.exec(trimmed);
      if (range) {
        for (const id of expandRange("", Number(range[1]), Number(range[2]))) ids.add(id);
        continue;
      }
      const leading = LEADING_ID_RE.exec(trimmed);
      if (leading && !/^\d{5,}$/.test(leading[1]!.replace(/-/g, ""))) body = leading[1]!;
    }
    if (body) collectIdPieces(body, ids);
  }
  return ids;
}

function idParts(id: string): { letters: string; digits: string } {
  return {
    letters: canonicalLetterPrefix((id.match(/[A-Z]+/g) ?? []).join("")),
    digits: (id.match(/[0-9/]+/g) ?? []).join(""),
  };
}

/** Do two addresses name a plot in common?
 *
 *  "A-51" and "50-51" are the same premises: one registry carried the block
 *  letter, the other did not. But "A-23" and "B-23" are NOT — when both sides
 *  state a block, the blocks have to agree, or every estate collapses into
 *  one plot. So a bare number matches a lettered one, and two lettered ids
 *  must match exactly. */
export function idSetsOverlap(a: Set<string>, b: Set<string>): boolean {
  for (const left of a) {
    if (b.has(left)) return true;
    const l = idParts(left);
    for (const right of b) {
      const r = idParts(right);
      if (l.digits !== r.digits) continue;
      if ((l.letters === "") !== (r.letters === "")) return true;
    }
  }
  return false;
}

function overlappingIdCount(a: Set<string>, b: Set<string>): number {
  let n = 0;
  const used = new Set<string>();
  for (const left of a) {
    for (const right of b) {
      if (used.has(right)) continue;
      if (idSetsOverlap(new Set([left]), new Set([right]))) {
        n += 1;
        used.add(right);
        break;
      }
    }
  }
  return n;
}

function digitTokens(tokens: string[]): Set<string> {
  const out = new Set<string>();
  for (const t of tokens) {
    if (/^\d+$/.test(t)) out.add(String(Number(t)));
  }
  return out;
}

function overlappingIdDigits(ids: Set<string>): Set<string> {
  const out = new Set<string>();
  for (const id of ids) {
    for (const d of id.match(/\d+/g) ?? []) out.add(String(Number(d)));
  }
  return out;
}

/** Road 6 vs Road 3 at the same house number are different premises.
 *  Plot numbers themselves (50-51 vs A-51) are not a road conflict. */
function extraDigitConflict(a: Candidate, b: Candidate): boolean {
  const idDigits = new Set([
    ...overlappingIdDigits(a.ids),
    ...overlappingIdDigits(b.ids),
  ]);
  const extraA = [...digitTokens(a.tokens)].filter((d) => !idDigits.has(d));
  const extraB = [...digitTokens(b.tokens)].filter((d) => !idDigits.has(d));
  const onlyA = extraA.filter((d) => !extraB.includes(d));
  const onlyB = extraB.filter((d) => !extraA.includes(d));
  return onlyA.length > 0 && onlyB.length > 0;
}

function adminCompatible(a: Candidate, b: Candidate): boolean {
  const aa = a.tokens.filter((t) => ADMIN_TOKENS.has(t));
  const bb = b.tokens.filter((t) => ADMIN_TOKENS.has(t));
  if (aa.length === 0 || bb.length === 0) return true;
  for (const t of aa) {
    if (bb.some((u) => sameWord(t, u))) return true;
  }
  return false;
}

// ---------- similarity ----------------------------------------------------

type Candidate = {
  tokens: string[];
  ids: Set<string>;
};

function concatTokens(tokens: string[], start: number, count: number): string {
  let out = "";
  for (let i = 0; i < count; i++) out += tokens[start + i]!;
  return out;
}

function largeWindowFree(used: Set<number>, start: number, count: number): boolean {
  for (let i = 0; i < count; i++) {
    if (used.has(start + i)) return false;
  }
  return true;
}

function markUsed(used: Set<number>, start: number, count: number): void {
  for (let i = 0; i < count; i++) used.add(start + i);
}

/** Compound joining: "gajaria"+"para" = "gojariapara", "high"+"way" = "highway". */
function findCompoundMatch(
  small: string[],
  i: number,
  large: string[],
  used: Set<number>,
): { smallConsumed: number; largeStart: number; largeConsumed: number } | null {
  const smallLeft = small.length - i;
  // Longest first so "gajaria"+"para" beats a weaker single-token hit.
  for (const smallN of [3, 2, 1]) {
    if (smallN > smallLeft) continue;
    const smallJoin = concatTokens(small, i, smallN);
    for (const largeN of [3, 2, 1]) {
      for (let j = 0; j < large.length; j++) {
        if (j + largeN > large.length) continue;
        if (!largeWindowFree(used, j, largeN)) continue;
        const largeJoin = concatTokens(large, j, largeN);
        if (!sameWord(smallJoin, largeJoin)) continue;
        return { smallConsumed: smallN, largeStart: j, largeConsumed: largeN };
      }
    }
  }
  return null;
}

/** Weighted containment over the smaller token set. Containment rather than
 *  Jaccard because one registry routinely records a fuller address than
 *  another; the short form should still merge into the long one. */
function similarity(a: Candidate, b: Candidate): {
  score: number;
  distinctHits: number;
  unmatchedDistinct: number;
} {
  const [small, large] = a.tokens.length <= b.tokens.length ? [a.tokens, b.tokens] : [b.tokens, a.tokens];
  if (small.length === 0) return { score: 0, distinctHits: 0, unmatchedDistinct: 0 };

  let total = 0;
  let matched = 0;
  let distinctHits = 0;
  let unmatchedDistinct = 0;
  const used = new Set<number>();

  for (let i = 0; i < small.length; ) {
    const hit = findCompoundMatch(small, i, large, used);
    if (hit) {
      for (let k = 0; k < hit.smallConsumed; k++) {
        const weight = tokenWeight(small[i + k]!);
        total += weight;
        matched += weight;
        if (weight === DISTINCT_WEIGHT) distinctHits += 1;
      }
      markUsed(used, hit.largeStart, hit.largeConsumed);
      i += hit.smallConsumed;
      continue;
    }
    const weight = tokenWeight(small[i]!);
    total += weight;
    if (weight === DISTINCT_WEIGHT) unmatchedDistinct += 1;
    i += 1;
  }

  return { score: total === 0 ? 0 : matched / total, distinctHits, unmatchedDistinct };
}

function firstDistinctPlace(tokens: string[]): string | null {
  for (const token of tokens) {
    if (tokenWeight(token) !== DISTINCT_WEIGHT) continue;
    if (/\d/.test(token)) continue;
    return token;
  }
  return null;
}

function tokenInList(token: string, tokens: string[]): boolean {
  for (let i = 0; i < tokens.length; i++) {
    if (sameWord(token, tokens[i]!)) return true;
    if (i + 1 < tokens.length && sameWord(token, concatTokens(tokens, i, 2))) return true;
    if (i + 2 < tokens.length && sameWord(token, concatTokens(tokens, i, 3))) return true;
  }
  return false;
}

/** Conflicting leading village names — Nayapara vs Bahadurpur — unless one
 *  side's leading name appears in the other (order-swap / nested locality)
 *  or a shared plot number already establishes identity and the names are
 *  not a never-same pair. */
function leadingVillageConflict(a: Candidate, b: Candidate): boolean {
  const la = firstDistinctPlace(a.tokens);
  const lb = firstDistinctPlace(b.tokens);
  if (!la || !lb) return false;
  if (sameWord(la, lb)) return false;
  if (tokenInList(lb, a.tokens) || tokenInList(la, b.tokens)) return false;
  return true;
}

function isSameLocation(a: Candidate, b: Candidate): boolean {
  const bothHaveIds = a.ids.size > 0 && b.ids.size > 0;
  const idsOverlap = bothHaveIds && idSetsOverlap(a.ids, b.ids);

  // Hard discriminator: different plot numbers, different premises.
  if (bothHaveIds && !idsOverlap) return false;

  const villageConflict = leadingVillageConflict(a, b);
  if (villageConflict) {
    const la = firstDistinctPlace(a.tokens);
    const lb = firstDistinctPlace(b.tokens);
    // Shared plot still cannot fuse Sreepur with Sripur.
    if (idsOverlap && la && lb && neverSamePair(la, lb)) return false;
    if (!idsOverlap) return false;
  }

  const { score, distinctHits } = similarity(a, b);
  const leadingMatch = (() => {
    const la = firstDistinctPlace(a.tokens);
    const lb = firstDistinctPlace(b.tokens);
    if (la && lb && sameWord(la, lb)) return true;
    if (la && tokenInList(la, b.tokens)) return true;
    if (lb && tokenInList(lb, a.tokens)) return true;
    return false;
  })();
  if (idsOverlap) {
    const overlapN = overlappingIdCount(a.ids, b.ids);
    // Two named plots in common is the same campus even when one registry
    // listed extra neighbouring plots (Comilla EPZ 220-227 ⊂ 12-14, 220-227).
    if (overlapN >= 2) return true;
    // House 17 Road 6 is not House 17 Road 3; Plot 51 Uttara is not Plot 51 CEPZ.
    if (extraDigitConflict(a, b)) return false;
    if (!adminCompatible(a, b)) return false;
    if (leadingMatch) return true;
    return score >= SHARED_ID_THRESHOLD;
  }
  // Near-identical wording is the same place even when every word is
  // administrative — "Plot # C5-C7, BSCIC I/A, Kalurghat, Chattogram" has no
  // distinguishing word at all, yet two copies of it are plainly one location.
  if (score >= 0.95) return true;
  // Shared leading village (Gajaria Para / Gojariapara) is enough identity
  // that extra unmatched words (Kauitis, Mouza) no longer veto.
  if (leadingMatch && distinctHits > 0 && score >= 0.5) return true;
  // Otherwise at least one distinguishing word must match, or
  // "Konabari, Gazipur" merges into "Chandra, Gazipur".
  return distinctHits > 0 && score >= MERGE_THRESHOLD;
}

// ---------- canonical selection -------------------------------------------

/** How specific an address is. The old rule kept the longest string, which
 *  rewarded the repeated "…, Sadar, Gazipur" tail over the variant that
 *  actually named the road. */
export function specificityScore(address: string, sourceCode?: string): number {
  const cleaned = cleanAddressString(address);
  const key = normaliseAddressKey(cleaned);
  const words = tokens(key);
  let score = 0;

  if (premisesIdentifiers(cleaned).size > 0) score += 30;
  score += cleaned.split(",").filter((s) => s.trim()).length * 4;
  for (const word of words) {
    if (tokenWeight(word) === DISTINCT_WEIGHT) score += 3;
  }
  if (/\b\d{4}\b/.test(cleaned)) score += 2;
  // ALL CAPS registry dumps are usually the least carefully entered.
  if (address === address.toUpperCase()) score -= 4;
  score += SOURCE_TIER[sourceCode ?? ""] ?? 0;

  return score;
}

function rowToLocation<T extends AddressRowRaw>(row: T): UniqueLocation<T> {
  const display = cleanAddressString(row.address);
  const { floors } = extractFloors(display);
  return {
    displayAddress: display,
    authorities: [row.source_code],
    types: [row.kind],
    phones: row.phone ? [row.phone] : [],
    emails: row.email ? [row.email] : [],
    floors,
    variants: [],
    fetched_at: row.fetched_at,
    source_rows: [row],
  };
}

function addVariant<T extends AddressRowRaw>(
  target: UniqueLocation<T>,
  address: string,
  authorities: readonly string[],
): void {
  const cleaned = cleanAddressString(address);
  if (!cleaned || cleaned === target.displayAddress) return;
  const existing = target.variants.find((v) => v.address === cleaned);
  if (existing) {
    for (const auth of authorities) {
      if (!existing.authorities.includes(auth)) existing.authorities.push(auth);
    }
    return;
  }
  target.variants.push({ address: cleaned, authorities: [...authorities] });
}

function mergeLocations<T extends AddressRowRaw>(
  target: UniqueLocation<T>,
  donor: UniqueLocation<T>,
): void {
  // Ordering guarantees the target is at least as specific as the donor, so
  // the donor's wording is kept as provenance rather than promoted.
  addVariant(target, donor.displayAddress, donor.authorities);
  for (const variant of donor.variants) {
    addVariant(target, variant.address, variant.authorities);
  }
  for (const floor of donor.floors) {
    if (!target.floors.includes(floor)) target.floors.push(floor);
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

function candidateFor(display: string): Candidate {
  const { stripped } = extractFloors(display);
  return {
    tokens: tokens(normaliseAddressKey(stripped)),
    ids: premisesIdentifiers(stripped),
  };
}

/** Merge records describing the same premises into one location, keeping the
 *  most specific wording and refusing to merge conflicting plot numbers. */
export function mergeUniqueLocations<T extends AddressRowRaw>(
  rows: readonly T[],
): UniqueLocation<T>[] {
  const valid = rows.filter((r) => r.address?.trim());
  const ordered = valid
    .map((row) => ({
      location: rowToLocation(row),
      score: specificityScore(row.address, row.source_code),
    }))
    // Most specific first, so it becomes the surviving display address.
    .sort((a, b) => b.score - a.score || b.location.displayAddress.length - a.location.displayAddress.length)
    .map((entry) => entry.location);

  const merged: UniqueLocation<T>[] = [];
  const candidates: Candidate[] = [];

  for (const location of ordered) {
    const candidate = candidateFor(location.displayAddress);
    let target = -1;
    for (let i = 0; i < merged.length; i++) {
      if (isSameLocation(candidates[i]!, candidate)) {
        target = i;
        break;
      }
    }
    if (target === -1) {
      merged.push(location);
      candidates.push(candidate);
    } else {
      mergeLocations(merged[target]!, location);
      for (const token of candidate.tokens) {
        if (!candidates[target]!.tokens.includes(token)) candidates[target]!.tokens.push(token);
      }
      for (const id of candidate.ids) candidates[target]!.ids.add(id);
    }
  }
  for (const location of merged) {
    location.floors.sort((a, b) => (parseInt(a, 10) || 0) - (parseInt(b, 10) || 0));
  }
  return merged;
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
