// Population guard for `lib/contact-text.ts` (REZ-C, audit cycle 4). Run by
// `ops/verify_contact_text.py`, which reads the rows; this runs the real
// `withoutContactDetails` over every published address text and every
// principal product entry, and fails on any contact value that survives it.
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

const rows = JSON.parse(readFileSync(process.argv[2], "utf8"));
const digitsOf = (s) => s.replace(/\D/g, "");
const domainOf = (w) =>
  w.toLowerCase().trim().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");

const failures = [];
let texts = 0;
let changed = 0;
for (const r of rows) {
  const filed = [
    ...[r.address_raw, ...(r.addresses ?? [])].filter(Boolean).map((t) => ["address", t]),
    ...(r.principal_products ?? []).filter(Boolean).map((t) => ["product", t]),
  ];
  const phones = (r.phones ?? []).map(digitsOf).filter((d) => d.length >= 7);
  const emails = String(r.email_primary ?? "").toLowerCase().match(/[^@\s,;]+@[^@\s,;]+/g) ?? [];
  const site = r.website ? domainOf(r.website) : "";
  const name = String(r.contact_name ?? "").trim().toLowerCase();
  for (const [kind, text] of filed) {
    texts++;
    const out = withoutContactDetails(text);
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
    if (found.length) failures.push({ slug: r.slug, kind, text: text.slice(0, 200), shown: out.slice(0, 200), found });
  }
}

console.log(`published records: ${rows.length.toLocaleString("en")}; texts checked: ${texts.toLocaleString("en")}; changed by the stripper: ${changed}`);
for (const f of failures) console.log(`LEAK ${f.slug} (${f.kind}): ${f.found.join(", ")}\n  filed: ${JSON.stringify(f.text)}\n  shown: ${JSON.stringify(f.shown)}`);
console.log(failures.length ? `${failures.length} texts still carry contact detail.` : "0 texts carry contact detail after the stripper. OK");
process.exit(failures.length ? 1 : 0);
