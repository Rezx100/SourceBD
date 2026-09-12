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
  "bhaban",
  "bhawan",
  "union",
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
  "biazid",
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
  // Baridhara DOHS is not Mirpur/Pallabi DOHS (Caretex House 161).
  // BARIDARA is the same neighbourhood misspelt; a Narayanganj tail on
  // one House 365/4 string must not split it from Baridhara DOHS.
  "baridhara",
  "baridara",
  // Post-office tail at Turag. One-sided Nishatnagar must not block once
  // Dhour/Turag already matches (plot vs Sarkar Bari at Dhour Chowrasta).
  "nishatnagar",
  // Dhaka thanas. Sharing Gulshan must not count as a leading village
  // (Plot 27 Holding 1 vs House 1 at Gulshan).
  "gulshan",
  "tejgaon",
]);

/** Urban housing neighbourhoods. "13 Niketon" / "187 Badda" is a second
 *  house, not extra village detail after Turag. Keep this list in this
 *  file — do not put it in the geocode lexicon. */
const HOUSING_CAMPUS_PLACES = new Set([
  "niketon",
  "nikunja",
  "badda",
  "eskaton",
  "banani",
  "mohakhali",
  "farmgate",
  "kazipara",
  "kalabagan",
  "dhanmondi",
  "mohammadpur",
  "lalmatia",
  "malibagh",
  "malibag",
  "mogbazar",
  "moghbazar",
  "kakrail",
  "khilgaon",
  "rampura",
  "shantinagar",
  "segunbagicha",
  "paltan",
  "motijheel",
  "dilkusha",
  "wari",
  "kallyanpur",
  "shamoli",
  "shyamoli",
  "adabor",
  "cantonment",
  "hatirjheel",
  "hatirjhil",
  "karwan",
]);

/** Village tails after a named house (12 Dhour after Turag, 13 Demra
 *  after Dailla). A number here is extra geography of the same premises,
 *  including 30 Dhour and No. 12 Dhour. */
const VILLAGE_EXTRA_PLACES = new Set([
  "dhour",
  "dailla",
  "dalla",
  "demra",
  "turag",
  "amtola",
  "kewa",
]);

/** Pallabi is the thana inside Mirpur. Same house at those two labels is
 *  one premises; Uttara vs Mirpur is not. */
const NESTED_ADMIN: ReadonlyArray<readonly [string, string]> = [["pallabi", "mirpur"]];

function nestedAdminCompatible(a: { tokens: string[] }, b: { tokens: string[] }): boolean {
  const aa = a.tokens.filter((t) => ADMIN_TOKENS.has(t));
  const bb = b.tokens.filter((t) => ADMIN_TOKENS.has(t));
  for (const [x, y] of NESTED_ADMIN) {
    const aHas = aa.includes(x) || aa.includes(y);
    const bHas = bb.includes(x) || bb.includes(y);
    if (!aHas || !bHas) continue;
    const pairAndCoarse = new Set<string>([x, y, ...COARSE_ADMIN, "dohs"]);
    const aExtra = aa.filter((t) => !pairAndCoarse.has(t));
    const bExtra = bb.filter((t) => !pairAndCoarse.has(t));
    // Pallabi vs Mirpur-12 is nested. Pallabi vs Uttara+Mirpur is not,
    // and neither is Pallabi+Uttara vs Mirpur+Uttara — a shared third
    // thana is not the nested pair.
    if (aExtra.length > 0 || bExtra.length > 0) continue;
    if (
      (aa.includes(x) && bb.includes(y)) ||
      (aa.includes(y) && bb.includes(x)) ||
      (aa.includes(x) && bb.includes(x)) ||
      (aa.includes(y) && bb.includes(y))
    ) {
      return true;
    }
  }
  return false;
}

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
  // Gulshan and Tejgaon are thanas, not a reason to skip a plot-vs-house
  // conflict (Moyeen Center House 9B vs Bilquis Tower Plot 6).
  "gulshan",
  "tejgaon",
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

const GROUND_FLOOR_SPAN_RE =
  /\bground\s+to\s+\d+\s*(?:st|nd|rd|th)?\s*floor(?:\s*(?:&|and)\s*\d+\s*(?:st|nd|rd|th)?\s*floor(?:\s+to\s+\d+\s*(?:st|nd|rd|th)?\s*floor)?)*/gi;

const GROUND_AND_FLOOR_RE =
  /\(?\s*\b(?:ground|gr|gf)\.?\s*(?:floor|fl|flr)?\s*(?:&|and)\s*\d+\s*(?:st|nd|rd|th)?\s*(?:floor|fl|flr)?\b\.?\s*\)?/gi;

const LEVEL_LIST_RE =
  /\blevels?\s*[-#:]?\s*\d+(?:\s*(?:st|nd|rd|th))?(?:\s*(?:,|&|and)\s*\d+(?:\s*(?:st|nd|rd|th))?)*/gi;

const ROOM_LIST_RE =
  /\broom\s*(?:no\.?|number|#|:)?\s*[-:]?\s*\d+(?:\s*(?:,|&|and)\s*\d+)*/gi;

/** Pull "(4th & 5th Fl)" out of the match key and keep it as a detail. */
export function extractFloors(address: string): {
  stripped: string;
  floors: string[];
} {
  const floors: string[] = [];
  const remember = (label: string) => {
    const normalised = label.replace(/\s+/g, " ").trim();
    if (normalised && !floors.includes(normalised)) floors.push(normalised);
  };
  const stripped = address
    .replace(GROUND_FLOOR_SPAN_RE, (match) => {
      remember(match);
      return " ";
    })
    .replace(GROUND_AND_FLOOR_RE, (match) => {
      remember(match);
      return " ";
    })
    .replace(LEVEL_LIST_RE, (match) => {
      remember(match);
      return " ";
    })
    .replace(ROOM_LIST_RE, (match) => {
      remember(match);
      return " ";
    })
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
  if (a.endsWith("gaht") || b.endsWith("gaht")) {
    return sameWord(a.replace(/gaht$/, "ghat"), b.replace(/gaht$/, "ghat"));
  }
  if (/^\d+$/.test(a) && /^\d+$/.test(b)) return Number(a) === Number(b);
  if (/\d/.test(a) || /\d/.test(b)) return false;
  // "bari"/"para" as their own token are house suffixes, not villages.
  // sameWord("bora","bari") would otherwise clear Comilla vs Ashulia.
  if (
    (PLACE_TAILS as readonly string[]).includes(a) ||
    (PLACE_TAILS as readonly string[]).includes(b)
  ) {
    return false;
  }
  // "bora" is a village; "boro"/"baro"/"bara" are size adjectives on Bari.
  const sizeAdj = new Set(["baro", "boro", "bara", "choto", "chhoto"]);
  if (sizeAdj.has(a) !== sizeAdj.has(b)) return false;
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
    const sharedLocalityTail = PLACE_TAILS.some(
      (t) => t.length >= 3 && a.endsWith(t) && b.endsWith(t) && a !== b,
    );
    if (
      !sharedLocalityTail &&
      shortKey.length >= 2 &&
      longKey.length - shortKey.length <= 1 &&
      longKey.endsWith(shortKey) &&
      Math.min(a.length, b.length) >= 6 &&
      Math.abs(a.length - b.length) <= 3
    ) {
      return true;
    }
    // Emeraid / Emerald: one letter in a 7+ letter building name.
    if (
      levenshtein(a, b) === 1 &&
      Math.min(a.length, b.length) >= 7 &&
      a.slice(0, 4) === b.slice(0, 4)
    ) {
      return true;
    }
    // MALANCHANAGAR / Malanacho Nagar: compare the nagar-stripped stems.
    const nagarStem = (w: string) =>
      w.endsWith("nagar") && w.length > 8 ? w.slice(0, -5) : w;
    const na = nagarStem(a);
    const nb = nagarStem(b);
    if (na !== a || nb !== b) return sameWord(na, nb);
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
            // Shooghat/Saughatm: sgt ⊂ sgtm. satrapara/sreepur (strpr vs
            // srpr) and moishtek/mouchak (mstk vs msk) do not prefix-match.
            longKey.startsWith(shortKey) ||
            // Horihorpara/Harihapara, Rugunathpur/Ragunahpur: same tail and
            // a 4-letter prefix one edit apart. Sonargaon/Sashongaon (sona
            // vs sash) is a different place and must not use this path.
            (PLACE_TAILS.some((t) => a.endsWith(t) && b.endsWith(t)) &&
              levenshtein(a.slice(0, 4), b.slice(0, 4)) <= 1))
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
  if (prefix >= 4 && levenshtein(a, b) === 1 && Math.min(a.length, b.length) >= 5) return true;
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

function completeRangeEnd(from: number, to: number): number {
  const fromS = String(from);
  const toS = String(to);
  // 1703-04 → 1704 (leftover prefix ≥2). 371-72 → 372 (2-digit abbreviated
  // end). "62-8" is not 62-68: a 1-digit end with leftover 1 stays 8.
  if (
    toS.length < fromS.length &&
    to < from &&
    (fromS.length - toS.length >= 2 || toS.length >= 2)
  ) {
    const completed = Number(fromS.slice(0, fromS.length - toS.length) + toS);
    if (completed > from && completed - from <= 30) return completed;
  }
  return to;
}

function expandRange(prefix: string, from: number, to: number): string[] {
  const end = completeRangeEnd(from, to);
  if (end > from && end - from <= 30) {
    const out: string[] = [];
    for (let n = from; n <= end; n++) out.push(normaliseId(prefix, String(n)));
    return out;
  }
  return [normaliseId(prefix, String(from)), normaliseId(prefix, String(end))];
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
      const looksLikeRange =
        nums.length >= 2 &&
        nums.every((n) => n >= 10) &&
        Math.abs(nums[0]! - nums[nums.length - 1]!) <= 30;
      if (looksLikeRange) return [compound, ...nums.map(String)];
      // Cadastral 793/120: the head is the plot, 120 is the mouza sheet.
      // Minting 120 fused 792/120 with 793/120 on a shared sheet number.
      if (
        nums.length === 2 &&
        nums.every((n) => n >= 10) &&
        Math.abs(nums[0]! - nums[1]!) > 30
      ) {
        return [compound, String(nums[0])];
      }
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
  const withHouseSlash = stripped.replace(/\bH\s*[./]?\s*[O0]\s*[./]?\s*-?\s*(\d+)\b/gi, "H$1");
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
      // Present-D-119/12 is not house 12.
      if (value < 10) continue;
      const slashUnit = new RegExp(String.raw`(^|[\D])\d+/${value}(?:\D|$)`, "i");
      if (slashUnit.test(m[0])) continue;
      ids.add(String(value));
    }
  }
  const withoutRenumber = stripNonPremisesNumbers(
    withHouseSlash
      // Unlabelled "86 (NEW)" on B.B. Road is the later holding number of
      // "60 (OLD)" — drop it so the shared 60 still matches. A labelled
      // "Plot-6 ( New)" is the plot itself and must stay (Bilquis Tower).
      .replace(
        /(?<!(?:plot|plots|holding|house|unit)(?:[\s#.:-]*(?:no\.?|number|#|:))*[\s#.:-]*)\b\d+\s*\(\s*new\s*\)/gi,
        " ",
      )
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
  // "87, New Eskaton Road" and "87 New Eskaton Road" are a second holding.
  for (const m of withoutRenumber.matchAll(
    /(?:^|,\s*)(\d{1,4})\s*,\s*(?:new\s+)?[A-Za-z][^,]{0,40}?\s+Road\b/gi,
  )) {
    ids.add(String(Number(m[1]!)));
  }
  for (const m of withoutRenumber.matchAll(
    /(?:^|,\s*)(\d{1,4})\s+(?:new\s+)?[A-Za-z][^,]{0,40}?\s+Road\b/gi,
  )) {
    ids.add(String(Number(m[1]!)));
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
 *  50/1 overlap a lone parent or a 2-wide range only when an old/present
 *  alias sits on the same row (Holding 574 (Former #295) ≡ 574/1). */
function slashDigitsOverlap(leftDigits: string, rightDigits: string): boolean {
  if (leftDigits === rightDigits) return true;
  const ls = slashFragments(leftDigits);
  const rs = slashFragments(rightDigits);
  if (ls.length === 0 || rs.length === 0) return false;
  const rangeLike = (parts: string[]) =>
    parts.length >= 2 &&
    parts.every((p) => /^\d+$/.test(p) && Number(p) >= 10) &&
    Math.abs(Number(parts[0]) - Number(parts[parts.length - 1]!)) <= 30;
  // Holding C-120/14 is a subunit of 120, not plots 120 and 14. A suffix
  // ≥10 still counts as a unit when the gap is wider than a plot range.
  const unitLike = (parts: string[]) =>
    parts.length === 2 &&
    /^\d+$/.test(parts[0]!) &&
    /^\d+$/.test(parts[1]!) &&
    (Number(parts[1]) < 10 || Math.abs(Number(parts[0]) - Number(parts[1]!)) > 30);
  const leftUnit = unitLike(ls);
  const rightUnit = unitLike(rs);
  if (rangeLike(ls) || rangeLike(rs)) {
    if (leftUnit || rightUnit) return false;
    return ls.some((d) => rs.includes(d));
  }
  if (leftUnit || rightUnit) return false;
  return ls[0] === rs[0];
}

function isUnitSuffixId(id: string): boolean {
  const parts = slashFragments(idParts(id).digits);
  return parts.length === 2 && Number(parts[1]) < 10;
}

function unitParentPair(left: string, right: string): boolean {
  const L = idParts(left);
  const R = idParts(right);
  if (L.letters && R.letters && L.letters !== R.letters) return false;
  if (isUnitSuffixId(left) && !isUnitSuffixId(right)) {
    return slashFragments(L.digits)[0] === R.digits;
  }
  if (isUnitSuffixId(right) && !isUnitSuffixId(left)) {
    return slashFragments(R.digits)[0] === L.digits;
  }
  return false;
}

function hasCompanionAlias(ids: Set<string>, id: string): boolean {
  const parent = isUnitSuffixId(id) ? slashFragments(idParts(id).digits)[0] : idParts(id).digits;
  for (const other of ids) {
    if (other === id) continue;
    const od = idParts(other).digits;
    if (od === parent) continue;
    if (isUnitSuffixId(other) && slashFragments(od)[0] === parent) continue;
    return true;
  }
  return false;
}

/** Bare / lettered numbers that came from a 3+ consecutive plot range (12-14). */
function consecutiveBareRange(ids: Set<string>): Set<string> {
  const nums = consecutiveNumericValues(ids);
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

function twoWideBareRange(ids: Set<string>): Set<string> {
  const nums = consecutiveNumericValues(ids);
  const out = new Set<string>();
  for (let i = 0; i < nums.length - 1; i++) {
    if (nums[i + 1] === nums[i]! + 1) {
      out.add(String(nums[i]));
      out.add(String(nums[i + 1]));
    }
  }
  return out;
}

function consecutiveNumericValues(ids: Set<string>): number[] {
  const nums = new Set<number>();
  for (const id of ids) {
    const digits = idParts(id).digits;
    if (/^\d+$/.test(digits)) nums.add(Number(digits));
  }
  return [...nums].sort((a, b) => a - b);
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
  const twoA = twoWideBareRange(a);
  const twoB = twoWideBareRange(b);
  const blockedParent = (unitSide: "a" | "b", parentDigits: string): boolean => {
    const range = unitSide === "a" ? rangeB : rangeA;
    const two = unitSide === "a" ? twoB : twoA;
    return range.has(parentDigits) || two.has(parentDigits);
  };
  for (const left of a) {
    if (b.has(left)) return true;
    const l = idParts(left);
    for (const right of b) {
      const r = idParts(right);
      const lettersOk =
        l.letters === r.letters || l.letters === "" || r.letters === "";
      if (l.digits !== r.digits) {
        if (lettersOk && slashDigitsOverlap(l.digits, r.digits)) {
          if (isUnitSuffixId(left) && blockedParent("a", r.digits)) continue;
          if (isUnitSuffixId(right) && blockedParent("b", l.digits)) continue;
          return true;
        }
        if (lettersOk && unitParentPair(left, right)) {
          const parentDigits = isUnitSuffixId(left)
            ? slashFragments(l.digits)[0]!
            : l.digits;
          if (isUnitSuffixId(left) && blockedParent("a", parentDigits)) continue;
          if (isUnitSuffixId(right) && blockedParent("b", parentDigits)) continue;
          if (!hasCompanionAlias(a, left) && !hasCompanionAlias(b, right)) continue;
          return true;
        }
        continue;
      }
      if ((l.letters === "") !== (r.letters === "")) return true;
    }
  }
  return false;
}

/** 132/142 vs 135/142 (and 792/120 vs 793/120) share a slash tail but name
 *  different heads. Overlap on the tail must not fuse those plots. */
export function leftoverUniqueDigitConflict(a: Set<string>, b: Set<string>): boolean {
  const compounds = (ids: Set<string>): Array<readonly [number, number]> => {
    const out: Array<readonly [number, number]> = [];
    for (const id of ids) {
      const m = /^(\d+)\/(\d+)$/.exec(id);
      if (!m) continue;
      out.push([Number(m[1]), Number(m[2])]);
    }
    return out;
  };
  const ca = compounds(a);
  const cb = compounds(b);
  for (const [ah, at] of ca) {
    for (const [bh, bt] of cb) {
      if (at !== bt || ah === bh || ah < 10 || bh < 10) continue;
      const aHasB = ca.some(([h, t]) => h === bh && t === bt);
      const bHasA = cb.some(([h, t]) => h === ah && t === at);
      if (!aHasB && !bHasA) return true;
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
const LABELLED_DIGIT_HEADS = new Set(["road", "sector", "house"]);

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

/** Two concatenations that share one house but name different second
 *  holdings (House 62+87 Eskaton vs House 62+82 Niketon). Avenue or
 *  Mirpur-12 leftovers are not holdings — those stay extraDigitConflict. */
function extraHoldingConflict(a: Candidate, b: Candidate): boolean {
  if (a.ids.size === 0 || b.ids.size === 0) return false;
  if (renumberAliasHint(a, b)) return false;
  const aOnly = [...a.ids].filter((id) => !idSetsOverlap(new Set([id]), b.ids));
  const bOnly = [...b.ids].filter((id) => !idSetsOverlap(new Set([id]), a.ids));
  const digitExtra = (ids: string[]) => ids.filter((id) => /^\d+$/.test(id));
  if (digitExtra(aOnly).length > 0 && digitExtra(bOnly).length > 0) return true;
  // Plot 389 vs Plot 389 House 6 is the same campus, not two holdings.
  // Neighbour plot lists (M-16 vs M-8,9 & 16) are not house campuses.
  if (a.plotIds.size > 0 && b.plotIds.size > 0) return false;
  if (campusHouseIds(a).size === 0 || campusHouseIds(b).size === 0) return false;
  const houseScale = (ids: string[]) => ids.filter((id) => /^\d{1,3}$/.test(id));
  const oneSided =
    (houseScale(aOnly).length > 0 && houseScale(bOnly).length === 0) ||
    (houseScale(bOnly).length > 0 && houseScale(aOnly).length === 0);
  if (!oneSided) return false;
  const campusExtras = (ids: string[]) =>
    ids.filter(
      (id) =>
        !villageExtraDigit(id, a.display) &&
        !villageExtraDigit(id, b.display) &&
        !roadExtraSharedWith(id, a.display, b) &&
        !roadExtraSharedWith(id, b.display, a),
    );
  const extras = campusExtras(houseScale(aOnly).length > 0 ? houseScale(aOnly) : houseScale(bOnly));
  // House 62 vs 87 Tejgaon (same thana, second house). Not House 10 vs 13
  // Dailla / 390 Dhour (extra village) or House 50 vs 7 Gulshan Avenue.
  if (sharedFineAdmin(a, b) && extras.length > 0) return true;
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
    return true;
  }
  // House 62 vs 13 Niketon / 187 Badda: extra house at the same first place.
  // 12 Dhour / 30 Dhour / No. 12 Dhour after Turag are village detail.
  return Boolean(la && lb && sameWord(la, lb) && extras.length > 0);
}

function renumberAliasHint(a: Candidate, b: Candidate): boolean {
  const hint = (tokens: string[]) =>
    tokens.some((t) => t === "former" || t === "formerly" || t === "previously");
  return hint(a.tokens) || hint(b.tokens);
}

/** Pallabi vs Mirpur with Uttara (or any third thana) on either side. */
function nestedPairCrossWithExtra(a: Candidate, b: Candidate): boolean {
  const aa = a.tokens.filter((t) => ADMIN_TOKENS.has(t));
  const bb = b.tokens.filter((t) => ADMIN_TOKENS.has(t));
  for (const [x, y] of NESTED_ADMIN) {
    const cross =
      (aa.includes(x) && !aa.includes(y) && bb.includes(y) && !bb.includes(x)) ||
      (aa.includes(y) && !aa.includes(x) && bb.includes(x) && !bb.includes(y));
    if (!cross) continue;
    const pairAndCoarse = new Set<string>([x, y, ...COARSE_ADMIN, "dohs"]);
    const aExtra = aa.filter((t) => !pairAndCoarse.has(t));
    const bExtra = bb.filter((t) => !pairAndCoarse.has(t));
    if (aExtra.length > 0 || bExtra.length > 0) return true;
  }
  return false;
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
  plotIds: Set<string>;
  houseIds: Set<string>;
  holdingIds: Set<string>;
  multiClause: boolean;
  twoCampus: boolean;
  display: string;
};

function campusHouseIds(c: Candidate): Set<string> {
  return new Set([...c.houseIds, ...c.holdingIds]);
}

/** Dag 1977-1978 on a holding-only row is the same cadastral as Plot 1977-1978. */
function cadastralDagIdsFromDisplay(display: string): Set<string> {
  const out = new Set<string>();
  const re =
    /\b(?:dag|dug|daag)\b[\s.:#-]*(?:no\.?|number|#|:)?[\s.:#-]*(\d+)(?:\s*[-–/,]\s*(\d+))?/gi;
  for (const m of display.matchAll(re)) {
    out.add(String(Number(m[1]!)));
    if (m[2]) out.add(String(Number(m[2]!)));
  }
  return out;
}

/** Plot 27 + Holding 1 is not House 1. Plot 10 & 14 vs Plot 14 is not this.
 *  Holding 137 + Plot 1977 vs Holding 137 + Dag 1977 is the same premises:
 *  leftover plots that the holding-only row names as cadastral ids stay one.
 *  A road or house digit in undifferentiated ids does not cover a leftover plot. */
function leftoverPlotOnHouseOnly(a: Candidate, b: Candidate): boolean {
  const hasPlots = (c: Candidate) => c.plotIds.size > 0;
  const noPlots = (c: Candidate) => c.plotIds.size === 0 && campusHouseIds(c).size > 0;
  const houseExtra = (c: Candidate) =>
    campusHouseIds(c).size > 0 || cadastralDagIdsFromDisplay(c.display).size > 0;
  const leftoverPlot = (plotSide: Candidate, houseSide: Candidate) => {
    const cover = new Set(houseSide.plotIds);
    // House 14 covers Plot 14 on the same road. HOLDING NO-08 is not plot 8.
    for (const id of houseSide.houseIds) cover.add(id);
    // Plot 49/1 vs Holding 49/1 is the same cadastral id, two labels.
    for (const id of houseSide.holdingIds) cover.add(id);
    // Holding-only cover is cadastral dag numbers from the display, not
    // undifferentiated ids (HOLDING NO-08 is not plot 8; Banani road 10
    // is not leftover plot 10). Nilorn Dag 1977-1978 still covers Plot 1977.
    if (houseSide.houseIds.size === 0 && houseSide.holdingIds.size > 0) {
      for (const id of cadastralDagIdsFromDisplay(houseSide.display)) cover.add(id);
    }
    if ([...plotSide.plotIds].some((id) => !idSetsOverlap(new Set([id]), cover))) {
      return true;
    }
    // Plot 8 + Holding 1 is not House 8 / Holding 8 / HO-08 even when the
    // plot number matches. Plot 49/1 vs Holding 49/1 has no extra holding.
    if (plotSide.holdingIds.size > 0) {
      const houseCover = campusHouseIds(houseSide);
      if (
        [...plotSide.holdingIds].some(
          (id) =>
            !idSetsOverlap(new Set([id]), houseCover) &&
            !idSetsOverlap(new Set([id]), cover),
        )
      ) {
        return true;
      }
      // Plot 8 + Holding 1 is not House 1 + House 8 restating both numbers.
      if (
        houseCover.size >= 2 &&
        [...plotSide.plotIds].every((id) => idSetsOverlap(new Set([id]), houseCover)) &&
        [...plotSide.holdingIds].some((id) => idSetsOverlap(new Set([id]), houseCover))
      ) {
        return true;
      }
    }
    return false;
  };
  // Plot # 8 & 10 vs House 10 even when the plot side has no Holding label.
  if (hasPlots(a) && noPlots(b) && leftoverPlot(a, b)) return true;
  if (hasPlots(b) && noPlots(a) && leftoverPlot(b, a)) return true;
  // Plot 10 + Dag/Holding must not then absorb Plot 8 & 10 as a neighbour
  // list (overlap 1). Plot 23-24 vs Plot 23, 24, 25 is a neighbour list
  // (overlap 2) even when one spelling also names Holding 87.
  if (hasPlots(a) && hasPlots(b) && houseExtra(a) !== houseExtra(b)) {
    const plotOnly = houseExtra(a) ? b : a;
    const withExtra = houseExtra(a) ? a : b;
    if (
      leftoverPlot(plotOnly, withExtra) &&
      overlappingIdCount(a.ids, b.ids) < 2
    ) {
      return true;
    }
  }
  return false;
}

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
  "bhaban",
  "bhawan",
  "union",
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
  const token = tokens[i]!;
  // A village sitting before "N.K. Link Road" is still the village. Only an
  // immediate "Sharifpur Road" follower makes the token a street name.
  if (
    isLocalityToken(token) &&
    !(i + 1 < tokens.length && STREET_FOLLOWERS.has(tokens[i + 1]!))
  ) {
    return false;
  }
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
        // Comma-stripped "Malanacho Nagar, Road 03" is not "Malanacho Nagar Road".
        if ((PLACE_TAILS as readonly string[]).includes(mid)) return false;
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
const BUILDING_LANDMARK_FOLLOWERS = new Set(["plaza", "stand", "stadium", "bhaban", "bhawan"]);

function isBuildingLandmarkName(tokens: string[], i: number): boolean {
  return i + 1 < tokens.length && BUILDING_LANDMARK_FOLLOWERS.has(tokens[i + 1]!);
}

/** Tokens that can name a village. Landmark heads (Shamser Plaza, Sreepur
 *  Stand) must not count as the other side's village. */
function villageTokens(tokens: string[]): string[] {
  return tokens.filter(
    (_, i) =>
      !isBuildingLandmarkName(tokens, i) &&
      (!isStreetPhrase(tokens, i) || isLocalityToken(tokens[i]!)),
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
    if (nameIdx > 0 && tokenWeight(tokens[nameIdx - 1]!) === DISTINCT_WEIGHT) {
      out.push({ name: concatTokens(tokens, nameIdx - 1, 2), kind });
    }
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
  return ESTATE_UNION_CANON.includes(a as (typeof ESTATE_UNION_CANON)[number]) &&
    ESTATE_UNION_CANON.includes(b as (typeof ESTATE_UNION_CANON)[number]);
}

function fatullahBscicEstatePair(a: Candidate, b: Candidate): boolean {
  if (!a.tokens.includes("bscic") || !b.tokens.includes("bscic")) return false;
  const aFat = a.tokens.includes("fatullah");
  const bFat = b.tokens.includes("fatullah");
  const aEst = a.tokens.some((t) =>
    ESTATE_UNION_CANON.includes(t as (typeof ESTATE_UNION_CANON)[number]),
  );
  const bEst = b.tokens.some((t) =>
    ESTATE_UNION_CANON.includes(t as (typeof ESTATE_UNION_CANON)[number]),
  );
  return (aFat && bEst) || (bFat && aEst);
}

function twoSidedTailedClash(a: Candidate, b: Candidate): boolean {
  const va = villageTokens(a.tokens);
  const vb = villageTokens(b.tokens);
  const ta = firstTailedPlace(a.tokens);
  const tb = firstTailedPlace(b.tokens);
  if (!ta || !tb) return false;
  if (sameWord(ta, tb)) return false;
  if (estateUnionAlias(ta, tb)) return false;
  if (fatullahBscicEstatePair(a, b)) return false;
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

const NOT_A_PLACE = new Set([
  "spinners",
  "knitters",
  "garments",
  "fashion",
  "limited",
  "ltd",
  "pvt",
  "apparels",
  "textiles",
  "mills",
  "knitting",
  "composite",
  "knitwear",
  "hosiery",
  "company",
  "tel",
  "fax",
]);

/** Thanas that follow a mouza in "Kewa, Sreepur, Gazipur". Not ADMIN_TOKENS:
 *  putting Sreepur there would also treat it as a shared district. */
function isLeadingThanaToken(token: string): boolean {
  if (ADMIN_TOKENS.has(token)) return true;
  return token === "sreepur" || token === "sripur";
}

/** "Sura Bari" / "Kaicha Bari" is the village, not the following thana. */
function isBariVillageHead(tokens: string[], i: number): boolean {
  const token = tokens[i]!;
  if (!token || token.length < 3 || token.length > 12 || /\d/.test(token)) return false;
  if (ADMIN_TOKENS.has(token) || NOT_A_PLACE.has(token)) return false;
  return i + 1 < tokens.length && tokens[i + 1] === "bari";
}

function firstDistinctPlace(tokens: string[]): string | null {
  let fallback: string | null = null;
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;
    if (isLandmarkName(tokens, i)) continue;
    // "Degerchala Road" is still Degerchala. "Nazrul Islam Road" is not a village.
    if (isStreetPhrase(tokens, i) && !isLocalityToken(token) && !isBariVillageHead(tokens, i)) continue;
    if (tokenWeight(token) !== DISTINCT_WEIGHT) continue;
    if (/\d/.test(token)) continue;
    if (NOT_A_PLACE.has(token)) continue;
    const bariHead = isBariVillageHead(tokens, i);
    // Four-letter mouza names (Kewa Mouja, Kewa, Sreepur, Mouza Kewa).
    // Shee-101 stays skipped: next is a digit, not a place.
    // "Bora Dharmapur" skips Bora: Dharmapur is the village, not a thana.
    // "Sura Bari, Kashimpur" keeps Sura: Bari is the house-suffix, not a skip.
    if (token.length < 5 && !bariHead) {
      const next = tokens[i + 1];
      const prev = i > 0 ? tokens[i - 1] : undefined;
      const mouzaNext = next === "mouza" || next === "mouja";
      const mouzaPrev = prev === "mouza" || prev === "mouja";
      const nextIsThana = Boolean(next && isLeadingThanaToken(next));
      const nextIsPlace = Boolean(
        next &&
          !/\d/.test(next) &&
          (isLocalityToken(next) || ADMIN_TOKENS.has(next)),
      );
      const nextIsLocality = Boolean(next && isLocalityToken(next));
      if (!mouzaNext && !mouzaPrev && !nextIsPlace) continue;
      if (!mouzaNext && !mouzaPrev && !nextIsThana && nextIsLocality) continue;
    }
    if (!fallback) fallback = token;
    if (isLocalityToken(token) || bariHead) {
      // Untailed villages (Vogra, Mouna, Dhanua, Kewa) win over a later thana.
      // Four-letter Bora must not beat Dharmapur.
      if (
        fallback &&
        fallback !== token &&
        !isLocalityToken(fallback) &&
        (fallback.length >= 5 || isLeadingThanaToken(token))
      ) {
        return fallback;
      }
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
  "shail",
  "mail",
] as const;

function withPlaceStems(token: string): string[] {
  const out = [token];
  for (const tail of PLACE_TAILS) {
    if (token.length > tail.length + 3 && token.endsWith(tail)) {
      out.push(token.slice(0, -tail.length));
    }
  }
  const prefix = /^(?:uttor|uttar|dakshin|dakkhin|dokkhin|purbo|purba)(.+)$/.exec(token);
  const rest = prefix?.[1];
  if (rest && rest.length >= 6) {
    if (!out.includes(rest)) out.push(rest);
    for (const tail of PLACE_TAILS) {
      if (rest.length > tail.length + 3 && rest.endsWith(tail)) {
        const stem = rest.slice(0, -tail.length);
        if (!out.includes(stem)) out.push(stem);
      }
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

/** Id-less village vs plotted campus that never names that village.
 *  Only a tailed locality on the id-less side is identity (Nayamati's
 *  Kutubpur vs B-94 BSCIC). Untailed house names (Sarkar Bari at Dhour)
 *  may still nest into a plotted row that already names the village. */
function idlessVillageAgainstPlots(a: Candidate, b: Candidate): boolean {
  const idless = a.ids.size === 0 && b.ids.size > 0 ? a : b.ids.size === 0 && a.ids.size > 0 ? b : null;
  const plotted = a.ids.size > 0 && b.ids.size === 0 ? a : b.ids.size > 0 && a.ids.size === 0 ? b : null;
  if (!idless || !plotted) return false;
  const villages = villageTokens(plotted.tokens);
  const lead = firstDistinctPlace(idless.tokens);
  if (lead && tokenInList(lead, villages)) return false;
  const tailed = firstTailedPlace(idless.tokens);
  if (!tailed) return false;
  return !tokenInList(tailed, villages);
}

/** Conflicting leading village names — Nayapara vs Bahadurpur — unless one
 *  side's leading name appears in the other (order-swap / nested locality).
 *  A shared plot number does not override a village clash. */
function leadingVillageConflict(a: Candidate, b: Candidate): boolean {
  const la = firstDistinctPlace(a.tokens);
  const lb = firstDistinctPlace(b.tokens);
  if (!la || !lb) return false;
  if (sameWord(la, lb)) return false;
  if (estateUnionAlias(la, lb)) return false;
  const va = villageTokens(a.tokens);
  const vb = villageTokens(b.tokens);
  if (tokenInList(lb, va) || tokenInList(la, vb)) return false;
  const competingLead =
    !tokenInList(la, vb) &&
    !tokenInList(lb, va) &&
    !estateUnionAlias(la, lb);
  const ta = firstTailedPlace(a.tokens);
  const tb = firstTailedPlace(b.tokens);
  if (ta && (tokenInList(ta, vb) || (tb && sameWord(ta, tb)))) {
    // Shared later Kashimpur must not clear South Bagber vs Shibrampur.
    if (!competingLead) return false;
  }
  if (tb && tokenInList(tb, va) && !competingLead) return false;
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
    if (
      b.tokens.some(
        (u) => ADMIN_TOKENS.has(u) && !COARSE_ADMIN.has(u) && sameWord(t, u),
      )
    ) {
      return true;
    }
  }
  return false;
}

function isSameLocation(a: Candidate, b: Candidate): boolean {
  // Concatenated two-campus wording ("Address 1st" + "Address 2nd") is not
  // the same row as a single-campus listing, even when one plot list overlaps.
  // House 50 + 7 Gulshan written with or without a comma still is one
  // premises; EPZ Ext vs Ext+Old is not, even on the same plot numbers.
  if (a.multiClause !== b.multiClause) {
    const bothNamed = a.ids.size > 0 && b.ids.size > 0;
    const overlap = bothNamed ? overlappingIdCount(a.ids, b.ids) : 0;
    const sameHoldings =
      bothNamed && overlap === a.ids.size && overlap === b.ids.size;
    // Ext+Old / Address 1st+2nd stay apart even on a shared plot list.
    if (a.twoCampus || b.twoCampus) return false;
    // Idless Hariken Road vs Plot 70 is not a two-campus XOR; other gates decide.
    if (bothNamed) {
      // House 50 + 7 Gulshan Avenue is one premises when one spelling omits
      // the avenue number. House 62 vs 87 Eskaton is not.
      if (!sameHoldings) {
        const extras = [...a.ids, ...b.ids].filter(
          (id) =>
            !(
              idSetsOverlap(new Set([id]), a.ids) &&
              idSetsOverlap(new Set([id]), b.ids)
            ),
        );
        const multi = a.multiClause ? a : b;
        const other = a.multiClause ? b : a;
        const onlyRoadExtras =
          extras.length > 0 &&
          extras.every((id) => roadExtraSharedWith(id, multi.display, other));
        if (!onlyRoadExtras) return false;
      }
      const extraWording = (multi: Candidate, other: Candidate) =>
        [...holdingWordingDigits(multi.display)].some(
          (digit) =>
            !idSetsOverlap(new Set([digit]), other.ids) &&
            !roadExtraSharedWith(digit, multi.display, other),
        );
      if (a.multiClause && extraWording(a, b)) return false;
      if (b.multiClause && extraWording(b, a)) return false;
    }
  }
  if (neverSameAcross(a.tokens, b.tokens)) return false;
  if (nestedPairCrossWithExtra(a, b)) return false;

  const bothHaveIds = a.ids.size > 0 && b.ids.size > 0;
  const idsOverlap = bothHaveIds && idSetsOverlap(a.ids, b.ids);

  // Hard discriminator: different plot numbers, different premises.
  if (bothHaveIds && leftoverUniqueDigitConflict(a.ids, b.ids)) return false;
  if (bothHaveIds && !idsOverlap) return false;

  // Labelled road/sector conflict always wins, including overlapN ≥ 2
  // (Plot 12-14 Road 6 vs Road 3; House 17 Road 6 Sector 1 vs Road 3).
  if (labelledDigitConflict(a, b)) return false;

  const overlapN = idsOverlap ? overlappingIdCount(a.ids, b.ids) : 0;

  // Two named tailed villages stay apart even on a shared house/plot.
  // Enayetnagar vs Shasongaon is the only estate-union alias exception.
  if (twoSidedTailedClash(a, b)) return false;

  // Plot+Holding vs House/Holding-only must not merge just because they share
  // a plaza/stand in the same thana (Shamser Plaza Uttara leftover plots).
  if (leftoverPlotOnHouseOnly(a, b) && !renumberAliasHint(a, b)) return false;

  // Same named plaza/stand is the premises only inside the same fine
  // admin area (Sreepur Stand at Ganakbari). Sharing "Dhaka" is not
  // enough (Uttara vs Mirpur plaza; Gazipur vs Ashulia). Pallabi vs
  // Mirpur-12 is the same thana under two labels, not a global ids gate.
  if (sameBuildingLandmark(a, b)) {
    if (sharedFineAdmin(a, b) || nestedAdminCompatible(a, b)) return true;
    if (competingAdminDistricts(a, b)) return false;
  }

  if (!idsOverlap && idlessVillageAgainstPlots(a, b)) return false;

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
        (la && tb && estateUnionAlias(la, tb)) ||
        (overlapN >= 2 && fatullahBscicEstatePair(a, b)),
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
    const competingLead =
      Boolean(la) &&
      Boolean(lb) &&
      !sameWord(la!, lb!) &&
      !estateUnionAlias(la!, lb!) &&
      !tokenInList(la!, vb) &&
      !tokenInList(lb!, va);
    if (competingLead) return false;
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
      // Plot 8 & 10 + Holding 1 is not House 1 and House 10. Neighbour plot
      // lists (Plot 10 & 14 vs Plot 14) are not House-only, so they pass.
      if (leftoverPlotOnHouseOnly(a, b) && !renumberAliasHint(a, b)) return false;
      if (leadingMatch || sharedFineAdmin(a, b) || fatullahBscicEstatePair(a, b)) return true;
      const la = firstDistinctPlace(a.tokens);
      const lb = firstDistinctPlace(b.tokens);
      const va = villageTokens(a.tokens);
      const vb = villageTokens(b.tokens);
      if (
        la &&
        lb &&
        !sameWord(la, lb) &&
        !tokenInList(la, vb) &&
        !tokenInList(lb, va) &&
        !NOT_A_PLACE.has(la) &&
        !NOT_A_PLACE.has(lb)
      ) {
        return false;
      }
      if (competingAdminDistricts(a, b)) return false;
      if (!adminCompatible(a, b)) return false;
      return true;
    }
    // overlapN == 1: a shared holding is identity. Do not require matching
    // thana tokens first — F-14 Pallabi vs Plot 14 Mirpur, Peace Preenon.
    // Competing thanas that are not nested (Uttara vs Mirpur Anwar Tower)
    // still stay apart.
    if (competingAdminDistricts(a, b) && !nestedAdminCompatible(a, b) && !sharedFineAdmin(a, b)) {
      return false;
    }
    if (extraHoldingConflict(a, b)) return false;
    // Plot+Holding vs House-only is two premises even when the leftover plot
    // sits close to the house number or they share Niketon/Banani.
    // Neighbour plot lists and House 6 on Plot 389 are not this shape.
    if (leftoverPlotOnHouseOnly(a, b) && !renumberAliasHint(a, b)) {
      return false;
    }
    if (leadingMatch) return true;
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

function isNumericOrFloorAtom(raw: string): boolean {
  const t = raw.toLowerCase().replace(/[.,;:]+$/g, "").trim();
  if (!t) return false;
  if (/^(?:ground|floor|fl|flr|level|lvl|room|rooms|to)$/.test(t)) return true;
  if (/^\d+[a-z]?$/.test(t)) return true;
  if (/^[a-z]\d+[a-z]?$/.test(t)) return true;
  if (/^\d+(?:st|nd|rd|th)$/.test(t)) return true;
  return false;
}

function isNumericAmpersandJoin(left: string, right: string): boolean {
  const leftToks = left.trim().split(/\s+/).filter(Boolean);
  const rightToks = right.trim().split(/\s+/).filter(Boolean);
  if (leftToks.length === 0 || rightToks.length === 0) return false;
  return (
    isNumericOrFloorAtom(leftToks[leftToks.length - 1]!) &&
    isNumericOrFloorAtom(rightToks[0]!)
  );
}

function looksLikeCampusPart(part: string): boolean {
  // Plot 31-32 Sector 01 & Plot 29 Sector 05 is two campuses, not a plot list.
  if (/\b(?:plot|plots)\b/i.test(part) && /\b(?:sector|block)\b/i.test(part)) return true;
  const words = part
    .toLowerCase()
    .replace(/[^a-z]+/g, " ")
    .split(/\s+/)
    .filter(
      (w) =>
        w.length >= 5 &&
        !["plot", "plots", "holding", "house", "block", "sector", "floor", "bscic", "level", "office", "factory", "factories", "mailing"].includes(
          w,
        ),
    );
  if (part.includes(",")) {
    if (words.length >= 1) return true;
    // "G-88/1, BSCIC" after the repeated thana was dropped.
    // Floor leftovers "(GR &" are not a second campus.
    // "PLOT NO-215, 216" is a plot list: "no-215" is not G-88.
    if (/\b(?:gr|gf|fl|floor)\b/i.test(part)) return false;
    const holding = part.replace(/\b(?:plot|plots|holding|house|no|number|#)\b/gi, " ");
    return /[a-z]-\d|\d\/\d/i.test(holding);
  }
  // After clean drops a repeated thana, the second campus may be one village
  // ("Meherbari"). Floor atoms are already stripped. "Office" is not a campus.
  return words.length === 1 && words[0]!.length >= 6;
}

function plotSectorCampusCount(display: string): number {
  const parts = display.toLowerCase().split(/\b(?:plot|plots)\b/);
  let n = 0;
  for (let i = 1; i < parts.length; i++) {
    if (/\b(?:sector|block)\b/.test(parts[i]!.slice(0, 80))) n += 1;
  }
  return n;
}

function hasTwoCampusWording(display: string): boolean {
  const s = display.toLowerCase();
  // "Plot 31-32, Sector 01, Plot 29, Sector 05" is two campuses even without &.
  if (plotSectorCampusCount(display) >= 2) return true;
  if (/\baddress\s*1st\b/.test(s) && /\baddress\s*2nd\b/.test(s)) return true;
  if (/\bextended\s+address\b/.test(s)) return true;
  if (/\bmailing\s+address\s*:/.test(s)) return true;
  if (/\band\s+extended\b/.test(s)) return true;
  const unitHits = [/\brotor\s+unit\b/, /\bfabric\s+unit\b/, /\bdyeing\s+unit\b/].filter((re) =>
    re.test(s),
  ).length;
  if (unitHits >= 2) return true;
  if (/\bdyeing\s+unit\b/.test(s) && /\b(?:germents?|garments?)\s+section\b/.test(s)) return true;
  const unitNums = s.match(/\bunit-\d+\b/g) ?? [];
  if (new Set(unitNums).size >= 2) return true;
  if (/\bext(?:ended)?\.?\s*area\b/.test(s) && /\bold\.?\s*area\b/.test(s)) return true;
  // Two full addresses joined with "&" or " AND " (Ramarbag … & G-88/1).
  // Floor lists ("4th & 5th Fl", "LEVEL # 6 & 7") and plot lists
  // ("PLOT # 215,216 & 217/B") are not two campuses.
  const { stripped } = extractFloors(display);
  const ampersandParts = stripped
    .split(/\s*(?:&|\band\b)\s*/i)
    .map((part) => part.trim())
    .filter(Boolean);
  if (ampersandParts.length >= 2) {
    let numericJoin = false;
    for (let i = 0; i < ampersandParts.length - 1; i++) {
      if (isNumericAmpersandJoin(ampersandParts[i]!, ampersandParts[i + 1]!)) numericJoin = true;
    }
    if (!numericJoin && ampersandParts.every(looksLikeCampusPart)) return true;
  }
  return false;
}

function roadHoldingEntries(display: string): Array<{ digit: string; tail: string }> {
  const s = display.toLowerCase();
  return [
    ...s.matchAll(/(?:^|,\s*)(\d{1,3})\s*,\s*(?:new\s+)?([a-z][^,]{0,40}?)\s+road\b/g),
    ...s.matchAll(/(?:^|,\s*)(\d{1,3})\s+(?:new\s+)?([a-z][^,]{0,40}?)\s+road\b/g),
    ...s.matchAll(/(?:^|,\s*)(\d{1,3})\s*,\s*(?:new\s+)?([a-z][^,]{0,40}?)\s+rd\b/g),
    ...s.matchAll(/(?:^|,\s*)(\d{1,3})\s+(?:new\s+)?([a-z][^,]{0,40}?)\s+rd\b/g),
    ...s.matchAll(/(?:^|,\s*)(\d{1,3})\s*,\s*(?:new\s+)?([a-z][^,]{0,40}?)\s+avenue\b/g),
    ...s.matchAll(/(?:^|,\s*)(\d{1,3})\s+(?:new\s+)?([a-z][^,]{0,40}?)\s+avenue\b/g),
    ...s.matchAll(/(?:^|,\s*)(\d{1,3})\s*,\s*(?:new\s+)?([a-z][^,]{0,40}?)\s+ave\.?\b/g),
    ...s.matchAll(/(?:^|,\s*)(\d{1,3})\s+(?:new\s+)?([a-z][^,]{0,40}?)\s+ave\.?\b/g),
  ].map((m) => ({ digit: m[1]!, tail: m[2]! }));
}

function roadHoldingDigits(display: string): Set<string> {
  return new Set(roadHoldingEntries(display).map((e) => String(Number(e.digit))));
}

/** Unlabelled "7 Gulshan" / "7, Gulshan-1" of a Gulshan-only campus. */
function adminPlaceExtraEntries(display: string): Array<{ digit: string; tail: string }> {
  const s = display.toLowerCase();
  const out: Array<{ digit: string; tail: string }> = [];
  for (const m of s.matchAll(
    /(?:^|,\s*)(\d{1,3})\s*,?\s*(?:new\s+)?([a-z]{3,})(?:-\d+)?\b/g,
  )) {
    const place = m[2]!;
    if (!ADMIN_TOKENS.has(place)) continue;
    out.push({ digit: m[1]!, tail: place });
  }
  return out;
}

function hasForeignHousingCampus(other: Candidate, place: string): boolean {
  for (const t of other.tokens) {
    if (HOUSING_CAMPUS_PLACES.has(t) && t !== place) return true;
  }
  return false;
}

function placeTokensFromTail(tail: string): string[] {
  return tail.split(/[^a-z]+/).filter(
    (t) => t.length >= 3 && !GENERIC_TOKENS.has(t) && t !== "new",
  );
}

function villageExtraDigit(digit: string, display: string): boolean {
  const s = display.toLowerCase();
  const re = new RegExp(
    `(?:^|[,\\s])0*${digit}(?:[\\/.\\-][a-z]|\\/[a-z0-9]+)?\\s*,?\\s+(?:(?:new|east|west|inner)\\s+)?([a-z]{3,})\\b`,
    "g",
  );
  for (const m of s.matchAll(re)) {
    if (VILLAGE_EXTRA_PLACES.has(m[1]!)) return true;
  }
  return false;
}

/** House 50 + 7 Gulshan / 7 Gulshan Avenue / 7 Gulshan-1 is extra detail of
 *  a Gulshan-only campus. 7 Tejgaon, 7 Dhaka, and 10 Gulshan Avenue are not. */
function roadExtraSharedWith(digit: string, display: string, other: Candidate): boolean {
  if (String(Number(digit)) !== "7") return false;
  const n = Number(digit);
  const entries = [
    ...roadHoldingEntries(display).filter((e) => Number(e.digit) === n),
    ...adminPlaceExtraEntries(display).filter((e) => Number(e.digit) === n),
  ];
  if (entries.length === 0) return false;
  return entries.some((e) => {
    const places = placeTokensFromTail(e.tail);
    return places.some(
      (p) =>
        p === "gulshan" &&
        other.tokens.some((t) => t === "gulshan" || sameWord(t, "gulshan")) &&
        !hasForeignHousingCampus(other, "gulshan"),
    );
  });
}

function holdingWordingDigits(display: string): Set<string> {
  const s = display.toLowerCase();
  // Rewrite H/O, H/0, HO-62, H.O. 87 to house so House 62 + H/O-87 is two
  // holdings. Comma 13, Dalla after H/O-10 is still skipped below.
  const withHo = s.replace(/\bh\s*[./]?\s*[o0]\s*[./]?\s*-?\s*(\d+)/g, "house $1");
  const houseNums = [
    ...withHo.matchAll(
      /\b(?:house|hosue|holding|hold)\s*(?:#|no\.?|number)?[\s.-]*(\d+)\b/g,
    ),
  ].map((m) => m[1]!);
  const skipPlace = (place: string) =>
    GENERIC_TOKENS.has(place) ||
    place === "storied" ||
    place === "storey" ||
    place === "rd" ||
    place === "st" ||
    place === "old" ||
    place === "new";
  const labelledAdminBefore = (before: string) =>
    /(?:ward|block|sector|section|plot|plots|union|dag|dug|road|rd|avenue)\s*(?:#|no\.?|number)?[\s.:-]*$/i.test(
      before,
    );
  const plotListTail = (before: string) => {
    const lower = before.toLowerCase();
    const lastHouse = Math.max(lower.lastIndexOf("house"), lower.lastIndexOf("holding"));
    const lastPlot = lower.lastIndexOf("plot");
    return lastPlot >= 0 && lastPlot > lastHouse;
  };
  // Housing-campus / thana numbers are a second house (13 Niketon, 187
  // Badda, 87 Tejgaon). Village tails after a named house (12 Dhour, 30
  // Dhour, No. 12 Dhour) are extra geography. A following road word keeps
  // 292 Inner Circular Rd as a second campus.
  const acceptPlaceHolding = (
    before: string,
    place: string,
    prefixed: boolean,
    unit: boolean,
    after: string,
  ) => {
    if (skipPlace(place)) return false;
    if (labelledAdminBefore(before) || plotListTail(before)) return false;
    if (/^(?:road|rd|avenue|ave)\b/.test(after.trimStart())) return true;
    if (VILLAGE_EXTRA_PLACES.has(place)) return false;
    if (HOUSING_CAMPUS_PLACES.has(place)) return true;
    if (ADMIN_TOKENS.has(place)) return true;
    // No.187 Bashundhara is a second house. No.793 Amtola / No.12 Kewa are
    // village-extra above. Prefixed 87 Eskaton is ADMIN/housing above.
    return Boolean(prefixed);
  };
  const placeHoldings = [
    ...withHo.matchAll(
      /(?:^|,\s*|(?<=[a-z])\s+)((?:no\s*[:.\-]?|number|#)\s*)?(\d{1,3})([\/.\-]?[a-z]|\/[a-z0-9]+)?\s+(?:(?:new|east|west|inner)\s+)?([a-z]{3,})\b/g,
    ),
  ]
    .filter((m) =>
      acceptPlaceHolding(
        withHo.slice(0, m.index ?? 0),
        m[4]!,
        Boolean(m[1]),
        Boolean(m[3]),
        withHo.slice((m.index ?? 0) + m[0].length),
      ),
    )
    .map((m) => m[2]!);
  const commaHoldings = [
    ...withHo.matchAll(
      /(?:^|,\s*)((?:no\s*[:.\-]?|number|#)\s*)?(\d{1,3})\s*,\s*(?:new\s+)?([a-z]{2,})/g,
    ),
  ]
    .filter((m) =>
      acceptPlaceHolding(
        withHo.slice(0, m.index ?? 0),
        m[3]!,
        Boolean(m[1]),
        false,
        withHo.slice((m.index ?? 0) + m[0].length),
      ),
    )
    .map((m) => m[2]!);
  const roadHoldings = [...roadHoldingDigits(display)];
  return new Set(
    [...houseNums, ...placeHoldings, ...commaHoldings, ...roadHoldings].map((d) =>
      String(Number(d)),
    ),
  );
}

function hasTwoHoldings(display: string): boolean {
  return holdingWordingDigits(display).size >= 2;
}

function isMultiClauseAddress(display: string): boolean {
  return hasTwoCampusWording(display) || hasTwoHoldings(display);
}

function labelledRoleIds(cleanedAddress: string): {
  plotIds: Set<string>;
  houseIds: Set<string>;
  holdingIds: Set<string>;
} {
  const plotIds = new Set<string>();
  const houseIds = new Set<string>();
  const holdingIds = new Set<string>();
  const { stripped } = extractFloors(cleanedAddress);
  const withHouseSlash = stripped.replace(
    /\bH\s*[./]?\s*[O0]\s*[./]?\s*-?\s*(\d+)\b/gi,
    "House $1",
  );
  for (const segment of withHouseSlash.split(",")) {
    const trimmed = collapsePlotInitials(segment.trim());
    if (!trimmed) continue;
    const labelled = LABELLED_ID_RE.exec(trimmed);
    if (!labelled) continue;
    const body = trimmed.slice(labelled.index + labelled[0].length).trim();
    if (!body) continue;
    const label = labelled[0]!;
    const bucket = /plot/i.test(label) ? plotIds : /hold/i.test(label) ? holdingIds : houseIds;
    collectIdPieces(body, bucket);
  }
  return { plotIds, houseIds, holdingIds };
}

function candidateFor(display: string): Candidate {
  const { stripped } = extractFloors(display);
  const twoCampus = hasTwoCampusWording(display);
  const roles = labelledRoleIds(stripped);
  return {
    tokens: tokens(normaliseAddressKey(stripped)),
    ids: premisesIdentifiers(stripped),
    plotIds: roles.plotIds,
    houseIds: roles.houseIds,
    holdingIds: roles.holdingIds,
    multiClause: twoCampus || hasTwoHoldings(display),
    twoCampus,
    display: stripped,
  };
}

export function isRenumberAliasRow(address: string): boolean {
  return /\((?:[^)]*\b(?:old|former|present)\b[^)]*)\)/i.test(address);
}

export function sourceRowsHaveConflictingIds<T extends AddressRowRaw>(
  left: readonly T[],
  right: readonly T[],
): boolean {
  const hinges = [...left, ...right].filter((row) => isRenumberAliasRow(row.address));
  const hingeIds = hinges.map((row) => premisesIdentifiers(row.address));
  for (const ra of left) {
    const ia = premisesIdentifiers(ra.address);
    if (ia.size === 0) continue;
    for (const rb of right) {
      const ib = premisesIdentifiers(rb.address);
      if (ib.size === 0) continue;
      if (leftoverUniqueDigitConflict(ia, ib)) return true;
      if (idSetsOverlap(ia, ib)) continue;
      const bridged = hingeIds.some((ih) => idSetsOverlap(ia, ih) && idSetsOverlap(ib, ih));
      if (!bridged) return true;
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
      for (const id of candidate.plotIds) candidates[target]!.plotIds.add(id);
      for (const id of candidate.houseIds) candidates[target]!.houseIds.add(id);
      for (const id of candidate.holdingIds) candidates[target]!.holdingIds.add(id);
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
