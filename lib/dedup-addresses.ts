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
// leading village names — including a shared plot/holding that sits on two
// named villages, and the never-same list (Sreepur≠Sripur,
// Nawabganj≠Chapainawabganj, Chandra≠Chandona≠Chandora). Extra unmatched
// words that are not a competing leading village no longer keep the same
// premises apart.

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
const SHARED_ID_THRESHOLD = 0.42;
/** A pair of words counts as the same word at this Jaro-Winkler score, but
 *  only if the edit-distance ratio also holds. Jaro-Winkler alone rewards a
 *  shared prefix too generously and would fuse Mirpur with Mirzapur. */
const TOKEN_JW = 0.9;
/** Letter-level edit must stay stricter than Mirpur/Mirzapur (Damerau 1/8 =
 *  0.875). Chanmary/Chandmari (2/9 ≈ 0.778) is handled by the sound-key
 *  one-edit rule instead. */
const TOKEN_LEV = 0.88;


const ABBREVIATION_PAIRS: ReadonlyArray<readonly [RegExp, string]> = [
  // Longest first: "in/estate" must not be eaten by the "i/a" rule.
  [/\bin\s*\/\s*estate\b/g, "industrial estate"],
  [/\binds?\.?\s*est\w*\b/g, "industrial estate"],
  [/\bindustrial\s+est\w*\b/g, "industrial estate"],
  [/\bind\.?\s*area\b/g, "industrial estate"],
  [/\bi\s*\/\s*[ea]\b/g, "industrial estate"],
  [/\bi\.\s*[ea]\.?\b/g, "industrial estate"],
  [/\bindustrial\s+area\b/g, "industrial estate"],
  [/\bexport\s+processing\s+zone\b/g, "epz"],
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
  "housing",
  "block",
  "sector",
  "section",
  "building",
  "floor",
  "industrial",
  "hosiery",
  "hosieryi",
  "estate",
  "residential",
  "commercial",
  "complex",
  "tower",
  "market",
  "police",
  "station",
  "line",
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
  // Size adjectives and honorifics, not which place.
  "baro",
  "boro",
  "choto",
  "chhoto",
  "haji",
  "hazi",
  "alhaj",
  "mohammad",
  "mohammed",
  "dag",
  "dug",
  "daag",
  "bhaban",
  "bhawan",
  "madrasha",
  "madrasa",
  "madrasah",
  "industria",
  "zone",
  "apartment",
  "apt",
  "flat",
  "shopping",
  "shoping",
  "name",
  "near",
  "opposite",
  "uttar",
  "dakhin",
  "dakshin",
  "poschim",
  "purba",
  "purbo",
  "moddho",
  "madhya",
  // Landmark / junction words. The name in front of these (Shamser Plaza,
  // Sreepur Stand, Sarkar Bari, Ideal Mor, Dhour Chowrasta) is a building
  // or stop, not a competing village.
  "plaza",
  "stand",
  "stadium",
  "bus",
  "chowrasta",
  "mor",
  // National University lexicon expands to "board bazar"; that post office
  // is shared by half of Gazipur and must not be a leading place.
  "board",
  "bazar",
  "bazaar",
  // Road honorifics. If these stay distinct they become firstDistinctPlace
  // ahead of the village (Shaheed Mosharaf Hossain Road vs Nayapara).
  "shaheed",
  "shahid",
  "mosharraf",
  "mosharof",
  "mosharaf",
  // Renumber labels in "Holding-213/1 (Present-D-119/1)".
  "present",
  "former",
  "current",
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
  ["chandra", "chandona"],
  ["chandra", "chandora"],
  ["chandona", "chandora"],
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
  "keraniganj",
  "keranigonj",
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
  // Post-office tail at Turag. One-sided Nishatnagar must not block once
  // Dhour/Turag already matches (plot vs Sarkar Bari at Dhour Chowrasta).
  "nishatnagar",
]);

/** District / division / country plus labels that appear on thousands of
 *  rows. Sharing one of these cannot override a village clash. Thana-level
 *  admin (Pahartali, Mirpur, Savar) can: it is the containing area when one
 *  registry named the village and the other named the union or post office. */
const COARSE_ADMIN = new Set([
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
  "old",
  "new",
  "epz",
  "bscic",
  "dohs",
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
  const stripped = address
    .replace(FLOOR_RE, (_match, label: string) => {
      const normalised = `${label.replace(/\s+/g, " ").trim()} Floor`;
      if (!floors.includes(normalised)) floors.push(normalised);
      return " ";
    })
    .replace(/\([^)]*(?:floor|corner|block|office|level)[^)]*\)/gi, " ");
  return { stripped: stripped.replace(/\s{2,}/g, " ").replace(/\s+,/g, ","), floors };
}

/** Normalised match key: lowercase, no punctuation, collapsed whitespace,
 *  consecutive duplicate words removed, empty tokens dropped. */
export function normaliseAddressKey(input: string): string {
  let s = input.toLowerCase();
  for (const [pat, rep] of BANGLA_VOCAB) s = s.replace(pat, rep);
  // Hyphens must not hide Chapainawabganj from the lexicon / never-same list.
  s = s.replace(/\bchapai[-_]+nawabganj\b/g, "chapainawabganj");
  s = applyPlaceLexicon(s);
  for (const [pat, rep] of ABBREVIATION_PAIRS) s = s.replace(pat, rep);
  s = s.replace(/\bfac(?:tory)?\s*:/g, " ");
  s = s.replace(/\bhosue\b/g, "house");
  s = s.replace(/\b(mouza|village|ward|word|holding|plot)(?=[a-z])/g, "$1 ");
  s = s.replace(/\bvill(?!age)(?=[a-z])/g, "vill ");
  s = s.replace(/\bword\b/g, "ward");
  // Road37 / Sector10 glued to the label hid the extra-digit conflict.
  s = s.replace(/\b(road|sector|house|plot|holding)(\d+)\b/g, "$1 $2");
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
  s = s.replace(/['"]/g, " ");
  // After abbreviation expansion, remaining punctuation is not identity.
  // Leaving commas on tokens made "pahartali," miss the admin set and
  // "mirpur-12," hide the extra-digit road/section conflict.
  s = s.replace(/[#().,:;/\-&]/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  let joined = s;
  let prevJoin = "";
  while (joined !== prevJoin) {
    prevJoin = joined;
    joined = joined.replace(/\b([a-z])\s+([a-z])\b/g, "$1$2");
  }
  s = joined;
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
  const rows = a.length + 1;
  const cols = b.length + 1;
  const d: number[][] = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));
  for (let i = 0; i < rows; i++) d[i]![0] = i;
  for (let j = 0; j < cols; j++) d[0]![j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i]![j] = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i]![j] = Math.min(d[i]![j]!, d[i - 2]![j - 2]! + 1);
      }
    }
  }
  return d[a.length]![b.length]!;
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
  s = s.replace(/ch/g, "s");
  s = s.replace(/zh/g, "j");
  s = s.replace(/z/g, "j");
  s = s.replace(/v/g, "b");
  s = s.replace(/w/g, "u");
  s = s.replace(/y/g, "i");
  s = s.replace(/ee/g, "i");
  s = s.replace(/oo/g, "u");
  s = s.replace(/aa/g, "a");
  s = s.replace(/[aeiou]+/g, "");
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

/** Never-same names anywhere in the token lists — not only as the leading
 *  village — so Kewa+Sreepur cannot fuse Kewa+Sripur, and a shared plot
 *  cannot fuse Chandra with Chandona. */
function neverSameAcross(aTokens: string[], bTokens: string[]): boolean {
  const PREFIX = /^(?:purbo|purba|purb|uttar|dakshin|dokkhin|south|north)/;
  const collect = (list: string[]): Set<string> => {
    const out = new Set<string>();
    const add = (t: string) => {
      if (!t) return;
      out.add(t);
      for (const st of withPlaceStems(t)) out.add(st);
      const stripped = t.replace(PREFIX, "");
      if (stripped && stripped !== t) {
        out.add(stripped);
        for (const st of withPlaceStems(stripped)) out.add(st);
      }
    };
    for (const t of list) add(t);
    for (let i = 0; i < list.length - 1; i++) add(concatTokens(list, i, 2));
    return out;
  };
  const a = collect(aTokens);
  const b = collect(bTokens);
  for (const [x, y] of NEVER_SAME) {
    if ((a.has(x) && b.has(y)) || (a.has(y) && b.has(x))) return true;
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
  const sound = bengaliSoundKey(a);
  const soundB = bengaliSoundKey(b);
  if (sound === soundB) {
    // "anwar"/"anower" collapse to two consonants; still the same name when
    // the original words are long enough that a two-letter key is not noise.
    // "kobi"/"kabi" are four letters with the same two-consonant key.
    if (sound.length >= 3) return true;
    if (sound.length >= 2 && Math.min(a.length, b.length) >= 4) return true;
  } else {
    // Ahakhalia / Akholia: one extra leading consonant after the sound-key.
    // Originals must also be close in length so "line"+"narayanganj" cannot
    // absorb a lone "narayanganj" through the concatenated sound-key.
    const [shortKey, longKey] = sound.length <= soundB.length ? [sound, soundB] : [soundB, sound];
    if (
      shortKey.length >= 2 &&
      longKey.length - shortKey.length <= 1 &&
      longKey.endsWith(shortKey) &&
      Math.min(a.length, b.length) >= 6 &&
      Math.abs(a.length - b.length) <= 3
    ) {
      return true;
    }
    // Interior sound-key edit: transposition/substitution at length ≥5
    // (kamiz/kamis, Borkan/Bokran); insert/delete at length ≥7 (Barenda/
    // Barendra, Jamidia/Jamirdia) so Mirpur (6) cannot fuse with Mirzapur.
    if (sound.length >= 3 && soundB.length >= 3) {
      const d = levenshtein(sound, soundB);
      if (d === 1) {
        if (sound.length === soundB.length) {
          const sameLetters = [...sound].sort().join("") === [...soundB].sort().join("");
          if (sameLetters && Math.min(a.length, b.length) >= 6) return true;
          // Budichor/Burishchar, Dogorgaon/Dohargaon: one consonant swap.
          // kouchakuri/kaliakair do not share a 2-letter prefix or a locality tail.
          if (
            Math.min(a.length, b.length) >= 8 &&
            (a.slice(0, 2) === b.slice(0, 2) ||
              PLACE_TAILS.some((t) => a.endsWith(t) && b.endsWith(t)))
          ) {
            return true;
          }
        } else if (
          Math.min(a.length, b.length) >= 7 &&
          (a.slice(0, 3) === b.slice(0, 3) ||
            PLACE_TAILS.some((t) => a.endsWith(t) && b.endsWith(t)) ||
            // Shooghat/Saughatm: sgt ⊂ sgtm. satrapara/sreepur (strpr vs
            // srpr) and moishtek/mouchak (mstk vs msk) do not prefix-match.
            longKey.startsWith(shortKey))
        ) {
          // Barenda/Barendra share a 3-letter prefix. satrapara/sreepur
          // and moishtek/mouchak only share a sound-key insert.
          return true;
        }
      }
    }
  }
  // Khapur/Knanpur: same locality suffix, same first letter, two edits, and
  // the shorter stem is not a prefix of the longer (that is Mirpur⊂Mirzapur).
  // Must run before the Jaro-Winkler gate: these stems are not prefix-similar.
  for (const tail of PLACE_TAILS) {
    if (
      a.length > tail.length + 2 &&
      b.length > tail.length + 2 &&
      a.endsWith(tail) &&
      b.endsWith(tail) &&
      a[0] === b[0] &&
      levenshtein(a, b) <= 2 &&
      Math.min(a.length, b.length) >= 6
    ) {
      const sa = a.slice(0, -tail.length);
      const sb = b.slice(0, -tail.length);
      const [shortStem, longStem] = sa.length <= sb.length ? [sa, sb] : [sb, sa];
      if (!longStem.startsWith(shortStem)) return true;
    }
  }
  if (Math.abs(a.length - b.length) > 3) return false;
  if (jaroWinkler(a, b) < TOKEN_JW) return false;
  const ratio = 1 - levenshtein(a, b) / Math.max(a.length, b.length);
  if (ratio >= TOKEN_LEV) return true;
  // Ananna/Anannya: shared prefix of 4+ and a single letter insert.
  let prefix = 0;
  while (prefix < a.length && prefix < b.length && a[prefix] === b[prefix]) prefix += 1;
  if (prefix >= 4 && levenshtein(a, b) === 1 && Math.min(a.length, b.length) >= 6) return true;
  // Chadni/Chandni: one inserted letter after a 3-letter prefix. Both
  // ending in a locality suffix is Mirpur/Mirzapur (insert z) and must not
  // use this path.
  if (
    prefix >= 3 &&
    levenshtein(a, b) === 1 &&
    Math.min(a.length, b.length) >= 6 &&
    !PLACE_TAILS.some((t) => a.endsWith(t) && b.endsWith(t))
  ) {
    return true;
  }
  // Narsingpur/Narsimpur: same locality suffix, long shared prefix, two edits.
  for (const tail of PLACE_TAILS) {
    if (a.length > tail.length + 3 && b.length > tail.length + 3 && a.endsWith(tail) && b.endsWith(tail)) {
      if (prefix >= 4 && levenshtein(a, b) <= 2 && Math.min(a.length, b.length) >= 8) return true;
    }
  }
  return false;
}

// ---------- premises identifiers ------------------------------------------

// Registries write the label a dozen ways: "Plot # 9", "PLOT NO- B-336",
// "Plot-M-8", "House No. 39", "CH Plot # 1260", "Plot (Ka-12)". Swallow any
// run of separators after the label. Match the label anywhere in the segment
// so a two-letter industrial prefix ("CH Plot", "C H PLOT") still counts.
const LABELLED_ID_RE =
  /(?:plot|plots|holding|hold|house|hosue)\b[\s.:#-]*(?:no\.?|number|#|:)?[\s.:#-]*/i;

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

function parseIdPieceCore(piece: string): string[] {
  const raw = stripIdBrackets(piece.replace(/\((?:part|pt)\.?\)/gi, ""))
    .replace(/(\d)\s+([A-Za-z])\b/g, "$1$2")
    .replace(/\s*\/\s*/g, "/")
    .replace(/\s*-\s*/g, "-")
    .trim();
  if (!raw || !/\d/.test(raw)) return [];
  if (/^(?:\d+(?:st|nd|rd|th)|floor|fl|flr)$/i.test(raw)) return [];
  const letterSuffix = /^(\d+)([A-Za-z])$/.exec(raw);
  if (letterSuffix) return [normaliseId(letterSuffix[2]!, letterSuffix[1]!)];

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
      // "22/23" is a plot pair (same as 22-23). "50/1" and "2/1" are a
      // holding plus a unit suffix — minting 1 and 2 as extra ids fused
      // Mohammadpur 2/1 with Chattogram 2800/2.
      const nums = parts.map((p) => Number(p));
      const compound = nums.map(String).join("/");
      const looksLikeRange = nums.length >= 2 && nums.every((n) => n >= 10);
      if (looksLikeRange) return [compound, ...nums.map(String)];
      return [compound];
    }
    // "A-169/170" is the same plots as "A-169-170". "C-120/14" is holding
    // C-120 unit 14 — not plot C-14.
    const letterSlash = /^([A-Za-z]{1,3})[-]?(\d+)$/.exec(parts[0]!);
    if (letterSlash && parts.slice(1).every((p) => /^\d+$/.test(p))) {
      const prefix = letterSlash[1]!;
      const nums = [Number(letterSlash[2]!), ...parts.slice(1).map(Number)];
      const compound = `${canonicalLetterPrefix(prefix)}${nums.join("/")}`;
      const closeRange =
        nums.length >= 2 &&
        nums.every((n) => n >= 10) &&
        Math.abs(nums[0]! - nums[nums.length - 1]!) <= 30;
      if (closeRange) {
        return [compound, ...nums.map((n) => normaliseId(prefix, String(n)))];
      }
      return [compound];
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

/** A parenthetical after a house number is a block alias, not the only id:
 *  "House # 01 (D-1)" must still mint 1. A body that is only "(B-336)" still
 *  reads the inner plot. */
function parseIdPiece(piece: string): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  const add = (xs: string[]) => {
    for (const id of xs) {
      if (!seen.has(id)) {
        seen.add(id);
        ids.push(id);
      }
    }
  };
  const outside = piece.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
  if (outside) add(parseIdPieceCore(outside));
  else add(parseIdPieceCore(stripIdBrackets(piece)));
  for (const m of piece.matchAll(/\(([^)]*)\)/g)) {
    const inner = m[1]!.trim();
    add(parseIdPieceCore(inner));
    // C-120/14 (B) is the same holding as C-120/14 B.
    if (outside && /^[A-Za-z]$/.test(inner)) {
      add(parseIdPieceCore(`${outside} ${inner}`));
    }
  }
  return ids;
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
function looksLikeBareId(segment: string, allowFourDigit = false): boolean {
  const trimmed = segment.trim();
  if (!/\d/.test(trimmed)) return false;
  if (/^\d{4}$/.test(trimmed)) return allowFourDigit;
  if (/^-?\d{4}$/.test(trimmed)) return false;
  // Unlabelled 5+ digit runs are telephone / fax, not plot numbers.
  if (/^\d{5,}$/.test(trimmed)) return false;
  if (trimmed.split(/\s+/).length > 3) return false;
  return !/[A-Za-z]{3,}/.test(trimmed);
}

/** Not every registry puts a comma after the number: "68/V Sagarika Road"
 *  carries the same identifier as "68/V, Sagarica Road". */
const LEADING_ID_RE = /^([A-Za-z]{0,3}[-]?\d+(?:\/[A-Za-z0-9]+)?)\s+\S/;
const LEADING_RANGE_RE = /^(\d+)\s*[-–]\s*(\d+)(?:\b|$)/;

function plotBody(raw: string): string {
  // "Plot No: S-18-19 BSCIC I/E" — the estate name is not part of the id.
  const cut =
    /\s+(?:bscic|epz|kepz|depz|industrial|estate|hosiery|hosieryi|chittagong|chattogram|dhaka|gazipur|narayanganj|fatullah|konabari|shasongaon|shashongaon|enayetnagar)\b/i.exec(
      raw,
    );
  return (cut ? raw.slice(0, cut.index) : raw).trim();
}

function plotIdHead(body: string): string {
  const trimmed = body.trim();
  // Optional space before a single letter suffix ("12 P") but not before a
  // following place-name ("12 BSCIC" must not mint B12).
  const head =
    /^((?:[A-Za-z]{1,3}[\s./-]*)?\d+(?:[A-Za-z]|\s+[A-Za-z]\b)?(?:\s*(?:[-/&,]|to|and)\s*(?:[A-Za-z]{1,3}[\s./-]*)?\d+(?:[A-Za-z]|\s+[A-Za-z]\b)?)*)/i.exec(
      trimmed,
    );
  if (head?.[1] && /\d/.test(head[1]!)) return head[1]!.trim();
  return plotBody(trimmed);
}

function collectIdPieces(body: string, ids: Set<string>): void {
  const unwrapped = body.replace(/\(\s*([A-Za-z])\s*\)/g, " $1 ");
  for (const piece of plotIdHead(unwrapped).split(/\s*(?:&|,|\band\b)\s*/i)) {
    for (const id of parseIdPiece(piece.replace(/^([A-Za-z]{1,3})\s+(?=\d)/, "$1"))) ids.add(id);
  }
}

/** Cadastral dag/SA/RS lists, mouza serials and ward numbers are not plot
 *  identity. Leaving them in the identifier set blocked genuine premises
 *  merges (Holding 160 vs "7 No. Ward", DAG 2006 vs Telirchala). */
function stripNonPremisesNumbers(raw: string): string {
  return raw
    .replace(
      /\b(?:dag|dug|daag|khatian)\b[\s.:#-]*(?:no\.?|number|#|:)?[\s.:#-]*[a-z]{0,4}[\s./-]*\d+(?:\s*[,&/-]\s*\d+)*/gi,
      " ",
    )
    .replace(
      /\b(?:s\.?\s*a\.?|r\.?\s*s\.?|c\.?\s*s\.?|b\.?\s*s\.?)(?:\s*\/\s*(?:s\.?\s*a\.?|r\.?\s*s\.?|c\.?\s*s\.?|b\.?\s*s\.?)?)*\s+\d{2,}(?:\s*[-–]\s*\d{2,})?(?:\s*,\s*\d{2,}(?:\s*[-–]\s*\d{2,})?)*/gi,
      " ",
    )
    .replace(/(?:^|,\s*)(?:s\.?\s*a\.?|r\.?\s*s\.?|c\.?\s*s\.?|b\.?\s*s\.?)[-/\s]+\d{1,4}\b/gi, " ")
    .replace(/\b(?:mouza|mauza)\s*(?:no\.?|number|#|:)?\s*\d+\b/gi, " ")
    .replace(/\b\d+\s*(?:no\.?|number)\s+(?:[a-z]+\s+)?(?:mouza|mauza)\b/gi, " ")
    .replace(/\b(?:ward|word)\s*(?:no\.?|number|#|:)?\s*[-#:]?\s*\d+\b/gi, " ")
    .replace(/\b\d+\s*(?:no\.?|number)?\s*ward\b/gi, " ")
    .replace(/\b(?:mohalla|moholla|mahalla)\s*[-:]?\s*[a-z]?\s*\([^)]*\)/gi, " ");
}

/** Plot / holding / house numbers named by an address. Floor markers are
 *  stripped first so "House 42/A (5th Floor)" does not mint a phantom id. */
export function premisesIdentifiers(cleanedAddress: string): Set<string> {
  const { stripped } = extractFloors(cleanedAddress);
  const withHouseSlash = stripped.replace(/\bH\s*\/\s*[O0]\s*-?\s*(\d+)\b/gi, "H$1");
  const ids = new Set<string>();
  // Holding 574 (Former #295) and Plot 799 (Old #1010) keep the old number
  // as an alias so a later registry that still uses 295 / 1010 can merge.
  // "Holding-213/1 (Present-D-119/1)" is the same: present and old numbers
  // both name this premises.
  const RENUMBER_PAREN =
    /\((?:[^)]*\b(?:old|former|present)\b[^)]*)\)/gi;
  for (const m of withHouseSlash.matchAll(RENUMBER_PAREN)) {
    for (const n of m[0].match(/\d+/g) ?? []) {
      const value = Number(n);
      // The unit suffix in Present-D-119/1 is not house 1.
      if (value >= 10) ids.add(String(value));
    }
  }
  const withoutRenumber = stripNonPremisesNumbers(
    withHouseSlash
      .replace(/\b\d+\s*\(\s*new\s*\)/gi, " ")
      .replace(/\(\s*(?:old|new)\s*\)/gi, " ")
      .replace(RENUMBER_PAREN, " "),
  );
  const BUILDING_TRAIL =
    /\b(?:bhaban|bhawan|court|tower|plaza|complex|centre|center)\s+(\d{2,4})\s*$/i;
  const segmentList = withoutRenumber.split(",");
  const allowFourDigit = segmentList.filter((s) => /^\d{4}$/.test(s.trim())).length >= 2;
  for (const segment of segmentList) {
    const trimmed = collapsePlotInitials(segment.trim()).replace(
      /^(?:new|old|polo)[-\s]*/i,
      "",
    );
    if (!trimmed) continue;
    const trail = BUILDING_TRAIL.exec(trimmed);
    if (trail) ids.add(String(Number(trail[1]!)));
    const labelled = LABELLED_ID_RE.exec(trimmed);
    let body: string | null = null;
    if (labelled) {
      body = trimmed.slice(labelled.index + labelled[0].length).trim();
    } else if (looksLikeBareId(trimmed, allowFourDigit)) {
      body = trimmed;
    } else {
      const leadingSeg = trimmed.replace(/^(?:new|old|polo)[-\s]*/i, "");
      const range = LEADING_RANGE_RE.exec(leadingSeg);
      if (range) {
        for (const id of expandRange("", Number(range[1]), Number(range[2]))) ids.add(id);
        continue;
      }
      const leading = LEADING_ID_RE.exec(leadingSeg);
      if (leading && !/^\d{5,}$/.test(leading[1]!.replace(/-/g, ""))) {
        if (/^(?:po|gpo)[-]?\d{4}$/i.test(leading[1]!)) continue;
        collectIdPieces(leading[1]!, ids);
        const after = leadingSeg.slice(leading[1]!.length);
        for (const extra of after.split(/\s*(?:&|,|\band\b)\s*/i)) {
          const head = plotIdHead(extra.trim());
          if (head && /(?:[A-Za-z]{1,3}[-/\s]?)?\d/.test(head) && !/[A-Za-z]{4,}/.test(plotBody(head))) {
            collectIdPieces(head, ids);
          }
        }
        continue;
      }
    }
    if (body) collectIdPieces(body, ids);
  }

  // EPZ standard factory buildings only: FSSFB#2 ≡ FS-SFB-2 ≡ FSFB # 01.
  // Must not mint ids from "Dhaka-1230", "Gulshan-1", or "Annex-2".
  for (const m of withoutRenumber.matchAll(
    /\b((?:[A-Za-z]{1,4}[-/#.]*)?(?:FS)?SFB[-/#.\s]*(?:no\.?)?[-/#.\s]*\d+(?:\s*[&,]\s*\d+)*)\b/gi,
  )) {
    const prefix = m[1]!.toUpperCase().replace(/[^A-Z]/g, "").replace(/NO$/, "");
    if (!/(?:FS)?SFB$/i.test(prefix) && !prefix.includes("SFB")) continue;
    for (const n of m[1]!.match(/\d+/g) ?? []) ids.add(`${prefix}${Number(n)}`);
  }
  // G.P.TA-50 ≡ GPTA 50
  for (const m of withoutRenumber.matchAll(
    /\b([A-Za-z](?:\s*\.\s*[A-Za-z])+[A-Za-z]*)\s*-?\s*(\d{1,4})\b/g,
  )) {
    const letters = m[1]!.toUpperCase().replace(/[^A-Z]/g, "");
    if (letters.length >= 3 && letters.length <= 8) ids.add(`${letters}${Number(m[2])}`);
  }
  for (const m of withoutRenumber.matchAll(/\bzone[-/#.\s]*(\d{1,2})\b/gi)) {
    ids.add(`ZONE${Number(m[1])}`);
  }
  for (const m of withoutRenumber.matchAll(/\b([A-Za-z]{4,8})\s+(\d{1,3})\b/g)) {
    const letters = m[1]!.toLowerCase();
    if (!GENERIC_TOKENS.has(letters) && !ADMIN_TOKENS.has(letters)) {
      ids.add(`${m[1]!.toUpperCase()}${Number(m[2])}`);
    }
  }
  return ids;
}

function idParts(id: string): { letters: string; digits: string } {
  return {
    letters: canonicalLetterPrefix((id.match(/[A-Z]+/g) ?? []).join("")),
    digits: (id.match(/[0-9/]+/g) ?? []).join(""),
  };
}

function slashFragments(digits: string): string[] {
  return digits.split("/").filter(Boolean);
}

/** Plot pairs like 22/23 share any plot number. Holding/unit forms like
 *  50/1 overlap only when the first number matches (50/1 ≡ 50, not 51/1). */
function slashDigitsOverlap(leftDigits: string, rightDigits: string): boolean {
  if (leftDigits === rightDigits) return true;
  const ls = slashFragments(leftDigits);
  const rs = slashFragments(rightDigits);
  if (ls.length === 0 || rs.length === 0) return false;
  const rangeLike = (parts: string[]) =>
    parts.length >= 2 &&
    parts.every((p) => /^\d+$/.test(p) && Number(p) >= 10) &&
    Math.abs(Number(parts[0]) - Number(parts[parts.length - 1]!)) <= 30;
  if (rangeLike(ls) || rangeLike(rs)) {
    return ls.some((d) => rs.includes(d));
  }
  return ls[0] === rs[0];
}

function isUnitSuffixId(id: string): boolean {
  const parts = slashFragments(idParts(id).digits);
  return parts.length === 2 && Number(parts[1]) < 10;
}

/** Bare numbers that came from a 3+ consecutive plot range (12-14). */
function consecutiveBareRange(ids: Set<string>): Set<string> {
  const nums = [...ids]
    .filter((id) => /^\d+$/.test(id))
    .map(Number)
    .sort((a, b) => a - b);
  const inRange = new Set<string>();
  if (nums.length < 3) return inRange;
  let run: number[] = [nums[0]!];
  const flush = () => {
    if (run.length >= 3) for (const n of run) inRange.add(String(n));
  };
  for (let i = 1; i < nums.length; i++) {
    if (nums[i] === run[run.length - 1]! + 1) run.push(nums[i]!);
    else {
      flush();
      run = [nums[i]!];
    }
  }
  flush();
  return inRange;
}

/** Do two addresses name a plot in common?
 *
 *  "A-51" and "50-51" are the same premises: one registry carried the block
 *  letter, the other did not. But "A-23" and "B-23" are NOT — when both sides
 *  state a block, the blocks have to agree, or every estate collapses into
 *  one plot. So a bare number matches a lettered one, and two lettered ids
 *  must match exactly. */
export function idSetsOverlap(a: Set<string>, b: Set<string>): boolean {
  const rangeA = consecutiveBareRange(a);
  const rangeB = consecutiveBareRange(b);
  for (const left of a) {
    if (b.has(left)) return true;
    const l = idParts(left);
    for (const right of b) {
      const r = idParts(right);
      if (l.digits !== r.digits) {
        const lettersOk =
          l.letters === r.letters || l.letters === "" || r.letters === "";
        if (lettersOk && slashDigitsOverlap(l.digits, r.digits)) {
          // Holding 12/1 is not Plot 12-14 just because 12 is in the range.
          if (isUnitSuffixId(left) && rangeB.has(r.digits)) continue;
          if (isUnitSuffixId(right) && rangeA.has(l.digits)) continue;
          return true;
        }
        continue;
      }
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
const LABELLED_DIGIT_HEADS = new Set(["road", "sector"]);

function labelledDigits(tokens: string[]): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (let i = 0; i < tokens.length - 1; i++) {
    const head = tokens[i]!;
    if (!LABELLED_DIGIT_HEADS.has(head)) continue;
    const n = tokens[i + 1]!;
    if (!/^\d+$/.test(n)) continue;
    const set = out.get(head) ?? new Set<string>();
    set.add(String(Number(n)));
    out.set(head, set);
  }
  return out;
}

/** Both sides named a road (or sector/house) but the numbers never overlap. */
function labelledDigitConflict(a: Candidate, b: Candidate): boolean {
  const la = labelledDigits(a.tokens);
  const lb = labelledDigits(b.tokens);
  for (const [head, numsA] of la) {
    const numsB = lb.get(head);
    if (!numsB) continue;
    if (![...numsA].some((n) => numsB.has(n))) return true;
  }
  return false;
}

function extraDigitConflict(a: Candidate, b: Candidate): boolean {
  if (labelledDigitConflict(a, b)) return true;
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
  multiClause: boolean;
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

function isLocalityToken(token: string): boolean {
  // "bari" is usually a house name (Master Bari, Hobirbari), not the village.
  for (const tail of PLACE_TAILS) {
    if (tail === "bari") continue;
    if (token.length > tail.length + 2 && token.endsWith(tail)) return true;
  }
  return false;
}

/** Words that mark the previous token as a building, stop, house or
 *  junction rather than the village (Shamser Plaza, Sreepur Stand,
 *  Sarkar Bari). Used only when picking a leading place. */
const LANDMARK_FOLLOWERS = new Set([
  "plaza",
  "stand",
  "stadium",
  "mor",
  "chowrasta",
]);

function isLandmarkName(tokens: string[], i: number): boolean {
  return i + 1 < tokens.length && LANDMARK_FOLLOWERS.has(tokens[i + 1]!);
}

/** "Sharifpur Road" is a street, not a village named Sharifpur. */
const STREET_FOLLOWERS = new Set(["road", "street", "avenue", "rd", "lane"]);

function isStreetName(tokens: string[], i: number): boolean {
  return i + 1 < tokens.length && STREET_FOLLOWERS.has(tokens[i + 1]!);
}

function isStreetPhrase(tokens: string[], i: number): boolean {
  if (isStreetName(tokens, i)) return true;
  // "Nazrul Islam Road": the distinct tokens before the follower are the
  // street name. Stop if a generic or a locality sits in between (that is
  // "Eastern Housing Main Road", where Eastern is the estate).
  for (let j = i + 1; j <= i + 3 && j < tokens.length; j++) {
    const t = tokens[j]!;
    if (STREET_FOLLOWERS.has(t)) {
      for (let k = i + 1; k < j; k++) {
        const mid = tokens[k]!;
        // House 167 between "Peace Preenon" and "Road 01" is not a street
        // name. Nazrul Islam Road has only letters in between.
        if (/\d/.test(mid)) return false;
        if (isLocalityToken(mid)) return false;
        if (tokenWeight(mid) !== DISTINCT_WEIGHT) return false;
      }
      return true;
    }
    if (isLocalityToken(t)) return false;
  }
  return false;
}

/** Landmark heads that are buildings or stops, not the village they sit in.
 *  Junctions (Dhour Chowrasta) keep the place name in villageTokens so a
 *  plot at Dhour can still match. */
const BUILDING_LANDMARK_FOLLOWERS = new Set(["plaza", "stand", "stadium"]);

function isBuildingLandmarkName(tokens: string[], i: number): boolean {
  return i + 1 < tokens.length && BUILDING_LANDMARK_FOLLOWERS.has(tokens[i + 1]!);
}

/** Tokens that can name a village. Landmark heads (Shamser Plaza, Sreepur
 *  Stand) must not count as the other side's village. */
function villageTokens(tokens: string[]): string[] {
  return tokens.filter(
    (_, i) => !isBuildingLandmarkName(tokens, i) && !isStreetPhrase(tokens, i),
  );
}

function buildingLandmarkHeads(tokens: string[]): Array<{ name: string; kind: string }> {
  const out: Array<{ name: string; kind: string }> = [];
  for (let i = 0; i < tokens.length - 1; i++) {
    const kind = tokens[i + 1]!;
    if (!BUILDING_LANDMARK_FOLLOWERS.has(kind)) continue;
    let nameIdx = i;
    while (nameIdx > 0 && tokenWeight(tokens[nameIdx]!) === GENERIC_WEIGHT) nameIdx -= 1;
    const name = tokens[nameIdx]!;
    if (tokenWeight(name) === GENERIC_WEIGHT) continue;
    out.push({ name, kind });
  }
  return out;
}

/** Two named plazas (or stands) at the same village are still two buildings
 *  unless the names match. Mixed types (plaza vs stand) do not compete.
 *  Junctions (mor / chowrasta) are not competing buildings. */
function competingLandmarks(a: Candidate, b: Candidate): boolean {
  const ha = buildingLandmarkHeads(a.tokens);
  const hb = buildingLandmarkHeads(b.tokens);
  if (ha.length === 0 || hb.length === 0) return false;
  let sameKind = false;
  for (const x of ha) {
    for (const y of hb) {
      if (x.kind !== y.kind) continue;
      sameKind = true;
      if (sameWord(x.name, y.name)) return false;
    }
  }
  return sameKind;
}

function sameBuildingLandmark(a: Candidate, b: Candidate): boolean {
  const ha = buildingLandmarkHeads(a.tokens);
  const hb = buildingLandmarkHeads(b.tokens);
  for (const x of ha) {
    for (const y of hb) {
      if (x.kind === y.kind && sameWord(x.name, y.name)) return true;
    }
  }
  return false;
}

/** Fatullah BSCIC is recorded as Enayetnagar, Shasongaon, or the
 *  Hosiery Shilpanagary estate name on the same lettered plot. */
const ESTATE_UNION_CANON = [
  "enayetnagar",
  "shasongaon",
  "shashongaon",
  "shasangaon",
  "sashongaon",
  "shashangaon",
  "shilpanagary",
] as const;

function estateUnionAlias(a: string, b: string): boolean {
  const hit = (t: string) =>
    ESTATE_UNION_CANON.some((n) => t === n || sameWord(t, n));
  return hit(a) && hit(b);
}

function twoSidedTailedClash(a: Candidate, b: Candidate): boolean {
  const va = villageTokens(a.tokens);
  const vb = villageTokens(b.tokens);
  const ta = firstTailedPlace(a.tokens);
  const tb = firstTailedPlace(b.tokens);
  if (!ta || !tb) return false;
  if (sameWord(ta, tb)) return false;
  if (estateUnionAlias(ta, tb)) return false;
  if (tokenInList(ta, vb) || tokenInList(tb, va)) return false;
  const la = firstDistinctPlace(a.tokens);
  const lb = firstDistinctPlace(b.tokens);
  if (la && lb && sameWord(la, lb)) return false;
  if (la && lb && estateUnionAlias(la, lb)) return false;
  if (la && tokenInList(la, vb)) return false;
  if (lb && tokenInList(lb, va)) return false;
  return true;
}

function firstTailedPlace(tokens: string[]): string | null {
  for (let i = 0; i < tokens.length; i++) {
    if (isLandmarkName(tokens, i) || isStreetPhrase(tokens, i)) continue;
    const token = tokens[i]!;
    if (tokenWeight(token) !== DISTINCT_WEIGHT) continue;
    if (/\d/.test(token)) continue;
    if (isLocalityToken(token)) return token;
  }
  return null;
}

function firstDistinctPlace(tokens: string[]): string | null {
  let fallback: string | null = null;
  for (let i = 0; i < tokens.length; i++) {
    if (isLandmarkName(tokens, i) || isStreetPhrase(tokens, i)) continue;
    const token = tokens[i]!;
    if (tokenWeight(token) !== DISTINCT_WEIGHT) continue;
    if (/\d/.test(token)) continue;
    if (token.length < 5) continue;
    if (!fallback) fallback = token;
    if (isLocalityToken(token)) {
      if (fallback && fallback.length >= 6 && fallback !== token) return fallback;
      return token;
    }
  }
  return fallback;
}

/** Locality suffixes so "telirchala" also counts as "telir" + "chala". */
const PLACE_TAILS = [
  "para",
  "pur",
  "chala",
  "char",
  "bari",
  "bazar",
  "bazaar",
  "ganj",
  "gaon",
  "ghat",
  "hat",
  "dighi",
  "gram",
  "nagar",
  "khal",
  "danga",
  "chat",
  "diar",
] as const;

function withPlaceStems(token: string): string[] {
  const out = [token];
  for (const tail of PLACE_TAILS) {
    if (token.length > tail.length + 3 && token.endsWith(tail)) {
      out.push(token.slice(0, -tail.length));
    }
  }
  return out;
}

function tokenInList(token: string, tokens: string[]): boolean {
  const queries = withPlaceStems(token);
  for (const q of queries) {
    for (let i = 0; i < tokens.length; i++) {
      for (const cand of withPlaceStems(tokens[i]!)) {
        if (sameWord(q, cand)) return true;
      }
      if (i + 1 < tokens.length && sameWord(q, concatTokens(tokens, i, 2))) return true;
      if (i + 2 < tokens.length && sameWord(q, concatTokens(tokens, i, 3))) return true;
    }
  }
  return false;
}

/** Conflicting leading village names — Nayapara vs Bahadurpur — unless one
 *  side's leading name appears in the other (order-swap / nested locality).
 *  A shared plot number does not override a village clash. */
function leadingVillageConflict(a: Candidate, b: Candidate): boolean {
  const la = firstDistinctPlace(a.tokens);
  const lb = firstDistinctPlace(b.tokens);
  if (!la || !lb) return false;
  if (sameWord(la, lb)) return false;
  const va = villageTokens(a.tokens);
  const vb = villageTokens(b.tokens);
  if (tokenInList(lb, va) || tokenInList(la, vb)) return false;
  const ta = firstTailedPlace(a.tokens);
  const tb = firstTailedPlace(b.tokens);
  if (ta && (tokenInList(ta, vb) || (tb && sameWord(ta, tb)))) return false;
  if (tb && tokenInList(tb, va)) return false;
  // A tailed village named on only one side (Nandirhat vs Fatehabad,
  // Jogirchala vs Telirchala) still blocks, even inside the same thana.
  if (ta && !tokenInList(ta, vb)) return true;
  if (tb && !tokenInList(tb, va)) return true;
  // Untailed names in the same thana: village vs union/PO (Mahmudabad vs
  // Fatehabad at South Pahartali), not two competing villages.
  if (sharedFineAdmin(a, b)) return false;
  return true;
}

function competingAdminDistricts(a: Candidate, b: Candidate): boolean {
  // Division/country wrappers and estate labels sit on thousands of
  // unrelated rows. Gazipur vs Ashulia still compete; sharing "Dhaka"
  // or "EPZ" must not hide that. Comilla EPZ vs CEPZ Chattogram is the
  // same idea: skip epz, keep the districts.
  const skip = new Set(["bangladesh", "dhaka", "old", "new", "epz", "bscic", "dohs"]);
  const aa = a.tokens.filter((t) => ADMIN_TOKENS.has(t) && !skip.has(t));
  const bb = b.tokens.filter((t) => ADMIN_TOKENS.has(t) && !skip.has(t));
  if (aa.length === 0 || bb.length === 0) return false;
  return !aa.some((t) => bb.some((u) => sameWord(t, u)));
}

function sharedFineAdmin(a: Candidate, b: Candidate): boolean {
  for (const t of a.tokens) {
    if (!ADMIN_TOKENS.has(t) || COARSE_ADMIN.has(t)) continue;
    if (b.tokens.some((u) => sameWord(t, u))) return true;
  }
  return false;
}

function isSameLocation(a: Candidate, b: Candidate): boolean {
  // Concatenated two-campus wording ("Address 1st" + "Address 2nd") is not
  // the same row as a single-campus listing, even when one plot list overlaps.
  if (a.multiClause !== b.multiClause) return false;
  if (neverSameAcross(a.tokens, b.tokens)) return false;

  const bothHaveIds = a.ids.size > 0 && b.ids.size > 0;
  const idsOverlap = bothHaveIds && idSetsOverlap(a.ids, b.ids);

  // Hard discriminator: different plot numbers, different premises.
  if (bothHaveIds && !idsOverlap) return false;

  // Labelled road/sector conflict always wins, including overlapN ≥ 2
  // (Plot 12-14 Road 6 vs Road 3; House 17 Road 6 Sector 1 vs Road 3).
  if (labelledDigitConflict(a, b)) return false;

  const overlapN = idsOverlap ? overlappingIdCount(a.ids, b.ids) : 0;

  // Two named tailed villages stay apart even on a shared house/plot.
  // Enayetnagar vs Shasongaon is the only estate-union alias exception.
  if (twoSidedTailedClash(a, b)) return false;

  // Same named plaza/stand is the premises only inside the same fine
  // admin area (Sreepur Stand at Ganakbari). Sharing "Dhaka" is not
  // enough (Uttara vs Mirpur plaza; Gazipur vs Ashulia).
  if (sameBuildingLandmark(a, b)) {
    if (sharedFineAdmin(a, b)) return true;
    if (competingAdminDistricts(a, b)) return false;
  }

  if (leadingVillageConflict(a, b)) {
    const va = villageTokens(a.tokens);
    const vb = villageTokens(b.tokens);
    const ta = firstTailedPlace(a.tokens);
    const tb = firstTailedPlace(b.tokens);
    const tailedClash =
      Boolean(ta && !tokenInList(ta, vb)) || Boolean(tb && !tokenInList(tb, va));
    const la = firstDistinctPlace(a.tokens);
    const lb = firstDistinctPlace(b.tokens);
    const unionAlias = Boolean(
      (ta && tb && estateUnionAlias(ta, tb)) ||
        (la && lb && estateUnionAlias(la, lb)) ||
        (ta && lb && estateUnionAlias(ta, lb)) ||
        (la && tb && estateUnionAlias(la, tb)),
    );
    const competingPlaces = Boolean(
      la &&
        lb &&
        !sameWord(la, lb) &&
        !tokenInList(la, vb) &&
        !tokenInList(lb, va),
    );
    if (unionAlias) {
      // Fatullah BSCIC recorded under two union names
    } else if (tailedClash && overlapN < 2) {
      // One-sided tailed village + a single shared house number is still
      // two premises (Shamoli vs Mohammadpur). Two overlapping holdings
      // (present + old) may carry an extra landmark (Tecknogopara).
      return false;
    } else if (tailedClash && overlapN >= 2 && competingPlaces) {
      // Plot 12-14 at Nandirhat is not Plot 12-14 at Mahmudabad.
      return false;
    } else if (!idsOverlap) {
      return false;
    }
  }
  if (competingLandmarks(a, b)) return false;

  const { score, distinctHits } = similarity(a, b);
  const leadingMatch = (() => {
    const la = firstDistinctPlace(a.tokens);
    const lb = firstDistinctPlace(b.tokens);
    const va = villageTokens(a.tokens);
    const vb = villageTokens(b.tokens);
    if (la && lb && sameWord(la, lb)) return true;
    if (la && lb && estateUnionAlias(la, lb)) return true;
    if (la && tokenInList(la, vb)) return true;
    if (lb && tokenInList(lb, va)) return true;
    const ta = firstTailedPlace(a.tokens);
    const tb = firstTailedPlace(b.tokens);
    if (ta && tokenInList(ta, vb)) return true;
    if (tb && tokenInList(tb, va)) return true;
    return false;
  })();
  if (idsOverlap) {
    // Two named plots in common is the same campus even when one registry
    // listed extra neighbouring plots (Comilla EPZ 220-227 ⊂ 12-14, 220-227).
    // Different admin areas on the same plot numbers stay apart (Uttara vs CEPZ).
    if (overlapN >= 2) {
      if (extraDigitConflict(a, b)) return false;
      if (leadingMatch || sharedFineAdmin(a, b)) return true;
      const la = firstDistinctPlace(a.tokens);
      const lb = firstDistinctPlace(b.tokens);
      const va = villageTokens(a.tokens);
      const vb = villageTokens(b.tokens);
      if (
        la &&
        lb &&
        !sameWord(la, lb) &&
        !tokenInList(la, vb) &&
        !tokenInList(lb, va)
      ) {
        return false;
      }
      if (competingAdminDistricts(a, b)) return false;
      if (!adminCompatible(a, b)) return false;
      return true;
    }
    // overlapN == 1: a shared holding is identity. Do not require matching
    // thana tokens first — F-14 Pallabi vs Plot 14 Mirpur, Peace Preenon.
    if (leadingMatch) return true;
    if (extraDigitConflict(a, b)) return false;
    if (!adminCompatible(a, b)) return false;
    // Zone-6 + Mirsarai under two official estate names: the zone id and a
    // matching place word are enough; the estate title need not match.
    if (distinctHits > 0) return true;
    return score >= SHARED_ID_THRESHOLD;
  }
  // Near-identical wording is the same place even when every word is
  // administrative — "Plot # C5-C7, BSCIC I/A, Kalurghat, Chattogram" has no
  // distinguishing word at all, yet two copies of it are plainly one location.
  if (score >= 0.95) return true;
  // Shared leading village (Gajaria Para / Gojariapara) is enough identity
  // that extra unmatched words (Kauitis, Mouza) no longer veto.
  // Shared leading village is enough identity: extra landmarks (Master Bari,
  // Seed Store, Kauitis) must not keep the same premises apart.
  if (leadingMatch && distinctHits > 0) return true;
  // Village vs union/PO inside the same thana (Mahmudabad vs Fatehabad at
  // South Pahartali). Tailed-village clashes never reach here.
  if (sharedFineAdmin(a, b) && distinctHits > 0) return true;
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

function visibleSpellingKey(address: string): string {
  return address.replace(/\s+/g, " ").trim().toLowerCase();
}

function addVariant<T extends AddressRowRaw>(
  target: UniqueLocation<T>,
  address: string,
  authorities: readonly string[],
): void {
  const cleaned = cleanAddressString(address);
  if (!cleaned) return;
  if (visibleSpellingKey(cleaned) === visibleSpellingKey(target.displayAddress)) return;
  const existing = target.variants.find(
    (v) => visibleSpellingKey(v.address) === visibleSpellingKey(cleaned),
  );
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

function isMultiClauseAddress(display: string): boolean {
  const s = display.toLowerCase();
  if (/\baddress\s*1st\b/.test(s) && /\baddress\s*2nd\b/.test(s)) return true;
  // Two full addresses joined with " & " (Ramarbag … & G-88/1, Chandra …).
  // Floor lists ("4th & 5th Fl") and plot lists ("MSSFB # 1 & 2",
  // "Plot A-23, 24, 25 & 26") are not two campuses.
  const { stripped } = extractFloors(display);
  const ampersandParts = stripped.split(/\s+&\s+/);
  if (ampersandParts.length >= 2) {
    const looksLikeCampus = (part: string): boolean => {
      if (!part.includes(",")) return false;
      const words = part
        .toLowerCase()
        .replace(/[^a-z]+/g, " ")
        .split(/\s+/)
        .filter(
          (w) =>
            w.length >= 5 &&
            !["plot", "plots", "holding", "house", "block", "sector", "floor", "bscic"].includes(w),
        );
      return words.length >= 1;
    };
    if (ampersandParts.every(looksLikeCampus)) return true;
  }
  return false;
}

function candidateFor(display: string): Candidate {
  const { stripped } = extractFloors(display);
  return {
    tokens: tokens(normaliseAddressKey(stripped)),
    ids: premisesIdentifiers(stripped),
    multiClause: isMultiClauseAddress(display),
  };
}

function sourceRowsHaveConflictingIds<T extends AddressRowRaw>(
  left: readonly T[],
  right: readonly T[],
): boolean {
  for (const ra of left) {
    const ia = premisesIdentifiers(ra.address);
    if (ia.size === 0) continue;
    for (const rb of right) {
      const ib = premisesIdentifiers(rb.address);
      if (ib.size === 0) continue;
      if (!idSetsOverlap(ia, ib)) return true;
    }
  }
  return false;
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
      if (
        isSameLocation(candidates[i]!, candidate) &&
        !sourceRowsHaveConflictingIds(merged[i]!.source_rows, location.source_rows)
      ) {
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
