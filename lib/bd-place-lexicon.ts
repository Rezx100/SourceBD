// Shared BD place canonicalization lexicon (REZ-28).
//
// Approved by founder 28 Jul 2026. Do NOT add pairs that are not in the
// confirmed checklist. Negatives are enforced by omission:
//   - Sreepur ≠ Sripur → neither appears here.
//   - Bare "Nawabganj" ≠ Chapainawabganj → only "Chapai Nawabganj" → "chapainawabganj".
//
// USAGE: call `applyPlaceLexicon(lowercasedInput)`.
//   - Input MUST be pre-lowercased (the function does not lowercase).
//   - All replacements produce lowercase canonical output.
//   - Raw registry strings are NEVER overwritten by callers — this is used
//     only for comparison keys (dedup-addresses) and geocode cache keys (barikoi).
//
// LOCKSTEP: keep in sync with `etl/lib/bd_place_lexicon.py`.

export const BD_PLACE_LEXICON: ReadonlyArray<readonly [RegExp, string]> = [
  // ---- Multi-word long forms first (order matters) ----
  // EPZ long names → canonical before acronym rules run
  [/\bkorean\s+export\s+processing\s+zone\b/g, "karnaphuli epz"],
  [/\bkorean\s+epz\b/g, "karnaphuli epz"],
  // Two-word → single canonical (before single-word rules)
  [/\bchapai\s+nawabganj\b/g, "chapainawabganj"],
  [/\bnational\s+university\b/g, "board bazar"],
  // B.Baria / B Baria → Brahmanbaria
  [/\bb\.?\s*baria\b/g, "brahmanbaria"],
  // Cox's Bazar variants (apostrophe optional, s optional)
  [/\bcox'?s?\s+bazar\b/g, "cox's bazar"],

  // ---- EPZ acronyms (longest first to avoid partial matches) ----
  [/\bccepz\b/g, "cumilla epz"],
  [/\bdepz\b/g, "savar"],
  [/\baepz\b/g, "adamjee epz"],
  [/\bcepz\b/g, "chattogram epz"],
  [/\bkepz\b/g, "karnaphuli epz"],
  [/\bmepz\b/g, "mongla epz"],
  [/\biepz\b/g, "ishwardi epz"],
  [/\buepz\b/g, "uttara epz"],

  // ---- Single-word aliases that expand (use negative lookahead for EPZ) ----
  // Bare "Adamjee" → "Adamjee EPZ" only when not followed by "epz" already.
  [/\badamjee(?!\s+epz)\b/g, "adamjee epz"],
  // Karnaphuli (river / thana) as EPZ locality alias per founder confirmation.
  [/\bkarnaphuli(?!\s+epz)\b/g, "karnaphuli epz"],
  // Mongla (port / upazila) as EPZ locality alias per founder confirmation.
  [/\bmongla(?!\s+epz)\b/g, "mongla epz"],
  // Locality aliases
  [/\bdhour\b/g, "turag"],
  [/\bbanasree\b/g, "rampura"],
  [/\bbsmrau\b/g, "salna"],

  // ---- Romanization / transliteration corrections ----
  // Major city / division names
  [/\bchittagong\b/g, "chattogram"],
  [/\bctg\b/g, "chattogram"],
  [/\bdacca\b/g, "dhaka"],
  // Locality names
  [/\bbayzid\b/g, "baizid"],
  [/\bdhanmandi\b/g, "dhanmondi"],
  // Narayanganj: bare abbreviation "N.ganj" / "N ganj" and gonj spelling
  [/\bn[\s.]?ganj\b/g, "narayanganj"],
  [/\bnarayangonj\b/g, "narayanganj"],
  // Siddhirganj
  [/\bsiddirgonj\b/g, "siddhirganj"],
  [/\bsiddhirgonj\b/g, "siddhirganj"],
  // Mymensingh variants
  [/\bmaymashingo\b/g, "mymensingh"],
  [/\bmaymanshingh\b/g, "mymensingh"],
  [/\bmymensing\b/g, "mymensingh"],
  // New pairs (A1–A2 from checklist)
  [/\bvaluka\b/g, "bhaluka"],
  [/\bjamairdia\b/g, "jamirdia"],
  // District corrections (C1 from checklist)
  [/\bkishorganj\b/g, "kishoreganj"],
  [/\bmanikgonj\b/g, "manikganj"],
  [/\bmunshigonj\b/g, "munshiganj"],
  [/\bnarshingdi\b/g, "narsingdi"],
  [/\bcomilla\b/g, "cumilla"],
  [/\bkhagrachari\b/g, "khagrachhari"],
  [/\blaxmipur\b/g, "lakshmipur"],
  [/\bbogra\b/g, "bogura"],
  [/\bjaipurhat\b/g, "joypurhat"],
  [/\bsirajgonj\b/g, "sirajganj"],
  [/\bjessore\b/g, "jashore"],
  [/\bjhenidah\b/g, "jhenaidah"],
  [/\bbarisal\b/g, "barishal"],
  [/\bjhalokathi\b/g, "jhalokati"],
  [/\bhabigonj\b/g, "habiganj"],
  [/\bmoulavibazar\b/g, "moulvibazar"],
  [/\bsunamgonj\b/g, "sunamganj"],
  [/\bpanchagar\b/g, "panchagarh"],
  [/\bnetrakona\b/g, "netrokona"],
  // Locality corrections (C2 from checklist)
  [/\bkaliakoir\b/g, "kaliakair"],
  [/\brupgonj\b/g, "rupganj"],
  [/\bsitakundu\b/g, "sitakunda"],
  [/\bmirsharai\b/g, "mirsarai"],
  [/\basadgonj\b/g, "asadganj"],
  [/\bkeraneganj\b/g, "keraniganj"],
];

/**
 * Apply the approved BD place canonicalization lexicon to a pre-lowercased
 * address string. Returns the string with all matched variants replaced by
 * their canonical forms.
 *
 * IMPORTANT: input must already be lowercased. This function does not
 * lowercase the input because callers have already done so and may have
 * applied further normalization steps in between.
 */
export function applyPlaceLexicon(lowercasedInput: string): string {
  let s = lowercasedInput;
  for (const [pat, rep] of BD_PLACE_LEXICON) {
    s = s.replace(pat, rep);
  }
  return s;
}
