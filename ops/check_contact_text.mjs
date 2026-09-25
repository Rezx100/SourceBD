// Population guard for `lib/contact-text.ts` (REZ-C, audit cycles 4–5). Run by
// `ops/verify_contact_text.py`, which reads the rows; this runs the real
// `withoutContactDetails` over every published address text and every
// principal product entry, and fails on any contact value that survives it,
// on any text naming a person whose output is not reviewed below, and on any
// cut that removed something that does not look like contact detail.
//
// The unit tests in `lib/contact-text.test.ts` pin the rows someone thought
// of. This is the one that sees the rows nobody did: cycle 4 found a gated
// website filed as a product, names filed as addresses, and four phone
// layouts the first version let through — all live, none in a fixture.
//
//   node ops/check_contact_text.mjs <rows.json>
//
// Node 22.18+ imports the TypeScript module directly (type stripping).

import { readFileSync } from "node:fs";

const { withoutContactDetails } = await import(new URL("../lib/contact-text.ts", import.meta.url).href);

// Contact-shaped text a register filed that is not a contact detail, checked by
// hand on 25 Sep 2026. Keyed by slug and the exact text.
const KNOWN_NOT_CONTACT = new Map([
  // The industrial park is named after the person the record names as contact.
  ["powertex-fashions", /Assaduzzaman Industrial Park/i],
]);

// A text that names a role files a PERSON, and no pattern can prove it removed
// every name (cycle 5: "Saddam Hossain, 60, …, Proprietor" kept the name once
// the role word was gone, and a check for role words could no longer see it).
// So every such text's output is reviewed by hand and pinned here, exactly; a
// new one — or a changed output — fails until someone reads it and adds it.
// Every role the stripper removes, anywhere, and a standalone "Chairman" /
// "Director" / "Owner" / "CEO" / "MD" part (not "Chairman Bari", a place), a
// role labelling a name ("Owner-Abdul Karim", "CEO: …", "MD: …"), a role after
// a name ("… - Owner", "…- Owner", "… — Owner"), a role in brackets anywhere
// ("(MD)", "[CEO]", "(Chairman & MD)"; not "(Chairman Bari)", a place), and
// "Contact:". The dash classes carry the em dash the stripper splits on.
const NAMES_A_PERSON = /\b(?:proprietor|managing director|your contact|contact person|attn|c\/o)\b|(?:^|,)\s*(?:chairman|director|ceo|owner|md)\s*(?:,|$)|\b(?:chairman|director|ceo|owner|gm|general manager|md)\b(?:\s*:|\s+[-–—]|[-–—](?!\s*(?:bari|market|road|para|bazar)\b))|\s*[-–—]\s*(?:chairman|director|ceo|owner|gm|general manager|md)\b\s*(?:[,.;]|$)|[([](?![^)\]]*\b(?:bari|market|road|para|bazar|plaza)\b)[^)\]]*\b(?:chairman|director|ceo|owner|gm|general manager|md|m\.d|executive|manager)\b[^)\]]*[)\]]|\bcontact(?:\s+name)?\s*:/im;
/** A role word in what the stripper removed: the cut was a person's. */
const ROLE_IN_CUT = /\b(?:proprietor|managing director|chairman|director|ceo|owner|gm|general manager|md|m\.d|attn|attention|contact|c\/o|manager|executive)\b/i;
const REVIEWED = new Map([
  ["saaf-sweater", ["ABDUR RAZZAK MASTER'S HOUSE, NEAR ASHULIA BUS STAND, ASHULIA, SAVAR, DHAKA"]],
  ["bdg-textilien-bd", ["263, Bara Moghbazar, (3rd Floor), Moghbazar, Dhaka"]],
  ["babulakhtar-international", [""]],
  [
    "international-trimmings-and-labels-bangladesh",
    [
      "41, Tangra Mouza, RS-350, Sreepur, Gazipur. Sreepur PS, Gazipur - 1740, Bangladesh, International Trimmings & Labels Bangladesh Private Limited, 41, Tangra Mouza, RS-350, Sreepur, Gazipur. Sreepur PS, Gazipur - 1740, Bangladesh",
    ],
  ],
  [
    "a-and-b-apparels",
    ["House # 26, Road # 3, Block-C, Flat # 4A, A K Tex Trading (Reg:, Bonasree Project, Section 10, Block C, Road, Rampura, Dhaka, Mirpur, Dhaka"],
  ],
  ["qsl-s-garment", ["PLOT NO: 55-56, MONGLA EPZ, 9351, MONGLA, BAGERHAT, Bangladesh"]],
  ["backstage-readywear", ["# 132, Gulshan"]],
  ["babylon-buying-services", [""]],
  ["bts-global-exim", ["# 08, Rd # 01"]],
  [
    "etafil-bangladesh",
    [
      "Plot No. 132 (New), 206 (Old), Mouza-Bhadam, Tongi, Gazipur - 1711, Bangladesh, Etafil (Bangladesh) Limited, Plot No. 132 (New), 206 (Old), Mouza-Bhadam, Tongi, Gazipur - 1711, Bangladesh",
    ],
  ],
  [
    "7-mark",
    ["7-9, Kawran Bazar, BTMC Bahaban (7th, A I Fashion Tex (Reg:, Floor), Iris United, House # 46-47, Kawran Bazar, Dhaka, Nasirabad Proprieties"],
  ],
  ["bd-tex", ["60, Gausul Azam Avenue, Sector # 13, Uttara, Dhaka, Beetex Sourcing (Reg:"]],
  // The whole filed address is "Chairman, Chairman": nothing left to show.
  ["bunano-classic", [""]],
]);

const rows = JSON.parse(readFileSync(process.argv[2], "utf8"));
const digitsOf = (s) => s.replace(/\D/g, "");
const domainOf = (w) =>
  w.toLowerCase().trim().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");

/** What `text` lost on its way to `out`: the characters left once `out` is matched through it in order. */
function removedFrom(text, out) {
  let j = 0;
  let cut = "";
  for (const c of text) {
    if (j < out.length && c === out[j]) j++;
    else cut += c;
  }
  return cut;
}

const failures = [];
let texts = 0;
let changed = 0;
for (const r of rows) {
  const filed = [
    ...[r.address_raw, ...(r.addresses ?? [])].filter(Boolean).map((t) => ["address", t]),
    // The Facilities section prints each building's first filed address.
    ...(r.building_addresses ?? []).filter(Boolean).map((t) => ["building", t]),
    ...(r.principal_products ?? []).filter(Boolean).map((t) => ["product", t]),
  ];
  const phones = (r.phones ?? []).map(digitsOf).filter((d) => d.length >= 7);
  const emails = String(r.email_primary ?? "").toLowerCase().match(/[^@\s,;]+@[^@\s,;]+/g) ?? [];
  const site = r.website ? domainOf(r.website) : "";
  const name = String(r.contact_name ?? "").trim().toLowerCase();
  for (const [kind, text] of filed) {
    texts++;
    // As `build-models.ts` calls it: a product entry keeps its long numbers (HS codes).
    const out = withoutContactDetails(text, kind === "product" ? { bareNumbers: false } : {});
    if (out !== text) changed++;
    const low = out.toLowerCase();
    const runs = (out.replace(/(\d)[\s.\-()/]+(?=\d)/g, "$1").match(/\d+/g) ?? []).filter((x) => x.length >= 7);
    const found = [];
    for (const p of phones) if (runs.some((x) => x.endsWith(p.slice(-7)) || p.endsWith(x.slice(-7)))) found.push("a gated phone number");
    for (const e of emails) if (low.includes(e)) found.push("the gated e-mail");
    if (site.includes(".") && low.includes(site)) found.push("the gated website");
    if (name.length >= 5 && low.includes(name) && !(KNOWN_NOT_CONTACT.get(r.slug)?.test(out))) found.push("the gated contact name");
    if (/[\w.+-]+@[\w-]+\.[a-z]/i.test(out)) found.push("an e-mail address");
    if (/\bwww\.|https?:\/\//i.test(out)) found.push("a URL");
    // A Bangladeshi mobile starts 01 (or 8801); "18926-18930", a plot range, does not.
    if (/(?:^|[^\d])(?:88)?01[3-9]\d{8}(?!\d)/.test(out.replace(/(\d)[\s.\-]+(?=\d)/g, "$1"))) found.push("a mobile number");
    if (/\byour contact\b|\bproprietor\b|\bmanaging director\b/i.test(out)) found.push("a named contact");
    // A person: a text the detector above names, OR any text the stripper cut
    // a role word out of, whatever its shape. The detector alone mirrored the
    // stripper's rules and fell behind them (cycle 9: em dashes, "Owner - Road
    // Karim"); what the stripper actually removed cannot fall behind.
    const cut = out === text ? "" : removedFrom(text, out);
    const person = NAMES_A_PERSON.test(text) || ROLE_IN_CUT.test(cut);
    if (person && !(REVIEWED.get(r.slug) ?? []).includes(out)) found.push("a text naming a person whose output nobody has reviewed");
    // The other direction (cycle 4 found "Plot # 110072" cut to "Plot #"): what
    // the stripper took out must look like contact detail. A role word is not
    // contact detail here — that cut is a person's, and is reviewed above.
    if (out !== text && !person) {
      if (!/\d{7}|(?<!\d)0\d{5}|@|\bat\b|\.[a-z]{2,}|\b(?:tel|fax|mob|phone|pho|cell|hotline|contact|web|email|e-mail|skype|whatsapp|pabx)\b/i.test(cut.replace(/(\d)[\s.\-()/]+(?=\d)/g, "$1"))) {
        found.push(`an over-strip: removed ${JSON.stringify(cut.trim().slice(0, 80))}`);
      }
    }
    if (found.length) failures.push({ slug: r.slug, kind, text: text.slice(0, 200), shown: out.slice(0, 200), found });
  }
}

console.log(`published records: ${rows.length.toLocaleString("en")}; texts checked: ${texts.toLocaleString("en")}; changed by the stripper: ${changed}`);
for (const f of failures) console.log(`FAIL ${f.slug} (${f.kind}): ${f.found.join(", ")}\n  filed: ${JSON.stringify(f.text)}\n  shown: ${JSON.stringify(f.shown)}`);
console.log(failures.length ? `${failures.length} texts fail: contact detail left in, an unreviewed named person, or an over-strip.` : "0 texts carry contact detail after the stripper, and nothing else was cut. OK");
process.exit(failures.length ? 1 : 0);
