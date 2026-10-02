// The Modern Slavery Act statement at its output boundary: the text a buyer
// copies or downloads (`buildStatement`). Nothing fake (PRODUCT.md): a claim
// about the buyer that SourceBD cannot know — a policy, training, board
// approval, a compliance team — may appear only inside a `[Confirm: …]`
// placeholder, and the UFLPA result must disclose region flags, not only
// matches. The route-level case (the page passes the tracker's counts in) is
// in `app/(app)/app/buyer-pages-routes.test.ts`.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildStatement, countPlaceholders, type MsaInputs, type MsaScreening, type StatementArgs } from "./msa-statement";

const INPUTS: MsaInputs = {
  total_saved: 17,
  total_published: 16,
  by_country: [{ country: "Bangladesh", count: 16 }],
  by_entity_type: [
    { entity_type: "factory", count: 12 },
    { entity_type: "buying_house", count: 4 },
  ],
  by_register: [
    { register: "BGMEA", count: 11 },
    { register: "BKMEA", count: 3 },
  ],
  by_certification: [{ kind: "wrap", count: 4 }],
  top_regions: [{ city: "Gazipur", district: "Gazipur", count: 6 }],
  top_parent_groups: [{ parent_group_name: "Ha-Meem Group", count: 2 }],
  rsc_covered: 11,
  rsc_avg_progress_pct: 87.25,
  sanctions_hits: 0,
  expiring_certs_90d: 0,
};

// What the UFLPA tracker showed for the founder's account: "0 hits · 1 region flag · 15 clear".
const ONE_FLAG: MsaScreening = { total: 16, hits: 0, flags: 1, clear: 15 };

function draft(over: Partial<StatementArgs> = {}): string {
  return buildStatement({
    org: "Example Apparel Ltd",
    year: "2025",
    signerName: "Jane Smith",
    signerRole: "Director",
    asOf: "2026-10-03",
    inputs: INPUTS,
    screening: ONE_FLAG,
    ...over,
  });
}

/**
 * The prose a reader would take as the buyer's own statement of fact: every
 * `[Confirm: …]` placeholder cut out (brackets counted, so a nested one
 * cannot leak its tail), headings and the draft note dropped.
 */
function prose(text: string): string {
  let out = "";
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    if (text.startsWith("[Confirm:", i)) depth++;
    if (depth === 0) out += text[i];
    else if (text[i] === "]") depth--;
  }
  return out
    .split("\n")
    .filter((line) => !line.startsWith("#") && !line.startsWith(">"))
    .join("\n");
}

/** Claims about the buyer's own organisation that SourceBD has no record of. */
const UNCONFIRMED_CLAIMS: [string, RegExp][] = [
  ["a policy", /\bpolic(y|ies)\b|code of conduct|whistleblow/i],
  ["training", /\btrain(s|ed|ing)?\b/i],
  ["board approval", /\bboard\b|\bapproved\b/i],
  ["a compliance process", /compliance team|monitors|engages suppliers|we escalate|we review|deterioration|in line with our policy/i],
  ["a commitment", /increasing our coverage|we conduct|we assess|we track/i],
  ["a list SourceBD does not screen", /denied-party|OFAC|OFSI|\bWRO\b|EU sanctions|TVPRA/i],
  ["certificates all current", /remain current|zero active hits/i],
];

function unconfirmedClaims(text: string): string[] {
  const p = prose(text);
  return UNCONFIRMED_CLAIMS.filter(([, re]) => re.test(p)).map(([name]) => name);
}

function section(text: string, n: number): string {
  const start = text.indexOf(`## ${n}.`);
  const end = text.indexOf(`## ${n + 1}.`);
  assert.ok(start >= 0, `no section ${n}`);
  return text.slice(start, end < 0 ? undefined : end);
}

describe("MSA statement — nothing the buyer has not confirmed reads as fact", () => {
  it("the oracle catches every claim the old template printed as plain prose", () => {
    // Sentences the generator printed before 3 Oct 2026, one per class.
    const old = [
      "Example Apparel Ltd maintains a formal Modern Slavery and Human Trafficking Policy, a Supplier Code of Conduct, a Whistleblowing Policy and a Recruitment Policy.",
      "Example Apparel Ltd provides training on modern slavery awareness to all staff involved in procurement.",
      "This statement was approved by the Board of Directors of Example Apparel Ltd and is signed on its behalf.",
      "Our compliance team monitors renewal status and engages suppliers ahead of expiry.",
      "We are increasing our coverage by the RMG Sustainability Council (RSC) safety remediation programme.",
      "against the U.S. Department of Homeland Security UFLPA Entity List and other relevant denied-party lists",
      "All recognised social and environmental certifications across our saved supplier base remain current.",
    ];
    assert.deepEqual(
      old.map((s) => unconfirmedClaims(s).length > 0),
      old.map(() => true),
    );
    // …and lets the same sentence through once it sits in a placeholder.
    assert.deepEqual(unconfirmedClaims(`[Confirm: ${old[2]}]`), []);
  });

  for (const [label, screening] of [
    ["one region flag", ONE_FLAG],
    ["a match and a flag", { total: 16, hits: 1, flags: 1, clear: 14 }],
    ["all clear", { total: 16, hits: 0, flags: 0, clear: 16 }],
    ["the tracker did not load", null],
  ] as const) {
    it(`no policy, training, board or process claim outside a [Confirm: …] placeholder (${label})`, () => {
      assert.deepEqual(unconfirmedClaims(draft({ screening })), []);
      assert.deepEqual(unconfirmedClaims(draft({ screening, org: "", year: "", signerName: "", signerRole: "" })), []);
    });
  }

  it("the policy, training and board sections are placeholders the buyer fills in", () => {
    const text = draft();
    assert.match(section(text, 2), /\[Confirm: the policies Example Apparel Ltd has in force/);
    assert.match(section(text, 5), /\[Confirm: the training on modern slavery Example Apparel Ltd gave during 2025/);
    assert.match(section(text, 7), /\[Confirm: This statement was approved by the board of directors \(or equivalent\) of Example Apparel Ltd on \(date of approval\)\.\]/);
    assert.match(section(text, 1), /\[Confirm: Example Apparel Ltd sources from the suppliers described below\.\]/);
  });

  it("an empty field becomes a placeholder, never a value the buyer did not type", () => {
    const text = draft({ org: " ", year: "", signerName: "", signerRole: "" });
    assert.match(text, /\*\*Organisation:\*\* \[Confirm: organisation name\]/);
    assert.match(text, /\*\*Financial year:\*\* \[Confirm: financial year\]/);
    assert.match(text, /\*\*Signed:\*\* \[Confirm: signatory name\]/);
    assert.match(text, /\*\*Role:\*\* \[Confirm: signatory role\]/);
    // Placeholders never nest, so each one can be filled in on its own.
    let depth = 0;
    for (const ch of text.replace(/\[Confirm:/g, "\u0001")) {
      if (ch === "\u0001") depth++;
      else if (ch === "]") depth--;
      assert.ok(depth <= 1, "a placeholder opened inside another");
    }
  });

  it("a square bracket the buyer types cannot close a placeholder early", () => {
    const text = draft({ org: "Acme [UK] Ltd", signerName: "J. Smith [CEO]" });
    assert.match(text, /\*\*Organisation:\*\* Acme \(UK\) Ltd/);
    assert.match(text, /\[Confirm: Acme \(UK\) Ltd sources from the suppliers described below\.\]/);
    assert.match(text, /\*\*Signed:\*\* J\. Smith \(CEO\)/);
    assert.deepEqual(unconfirmedClaims(text), []);
  });

  it("the draft note counts the placeholders still in the text, so a pasted copy carries the warning", () => {
    const text = draft();
    const n = Number(text.match(/^> DRAFT: (\d+) items marked "Confirm" still need your answer\./m)?.[1]);
    assert.ok(n > 0);
    assert.equal(n, countPlaceholders(text));
  });
});

describe("MSA statement — the UFLPA result as the tracker shows it", () => {
  it("discloses a region flag in the risk section and the KPIs, and asks what was done about it", () => {
    const text = draft();
    const risk = section(text, 4);
    assert.match(risk, /UFLPA Entity List\. As at 3 Oct 2026 it shows 0 matches, 1 region flag and 15 with neither\./);
    assert.match(risk, /A region flag means the supplier's record on SourceBD \(its group name or address\) mentions Xinjiang or the Uyghur region\./);
    assert.match(risk, /\[Confirm: what Example Apparel Ltd did about each match and region flag/);
    assert.match(section(text, 6), /- UFLPA region flags: \*\*1\*\*/);
  });

  it("every count the tracker returns reaches the risk section", () => {
    for (const s of [
      { total: 16, hits: 0, flags: 0, clear: 16 },
      { total: 16, hits: 2, flags: 3, clear: 11 },
      { total: 1, hits: 1, flags: 0, clear: 0 },
    ]) {
      const risk = section(draft({ screening: s }), 4);
      assert.match(risk, new RegExp(`${s.hits} match(es)?, ${s.flags} region flags? and ${s.clear} with neither\\.`));
      assert.equal(/did about each match and region flag/.test(risk), s.hits + s.flags > 0);
    }
  });

  it("names only the UFLPA Entity List, and still discloses a match on another list SourceBD holds", () => {
    const text = draft({ inputs: { ...INPUTS, sanctions_hits: 3 }, screening: { total: 16, hits: 1, flags: 0, clear: 15 } });
    const risk = section(text, 4);
    assert.match(risk, /2 further saved suppliers match an entry on another sanctions or forced-labour list held by SourceBD\./);
    assert.match(risk, /\[Confirm: what Example Apparel Ltd did about each match/);
    assert.match(section(text, 6), /- Matches on another sanctions or forced-labour list: \*\*2\*\*/);
  });

  it("when the tracker did not load, states no UFLPA result, yet still discloses the matches SourceBD knows of", () => {
    const text = draft({ screening: null });
    assert.match(section(text, 4), /\[Confirm: the result of checking your suppliers against the UFLPA Entity List\. SourceBD's UFLPA tracker did not load/);
    assert.doesNotMatch(text, /\bmatches?\b,|region flags?:|UFLPA Entity List matches/);
    assert.match(section(text, 6), /- Matches on any sanctions or forced-labour list held by SourceBD: \*\*0\*\*/);
    const three = draft({ screening: null, inputs: { ...INPUTS, sanctions_hits: 3 } });
    assert.match(section(three, 4), /3 saved suppliers match an entry on a sanctions or forced-labour list held by SourceBD\./);
    assert.match(section(three, 4), /\[Confirm: what Example Apparel Ltd did about each match/);
    assert.match(section(three, 6), /- Matches on any sanctions or forced-labour list held by SourceBD: \*\*3\*\*/);
  });
});

describe("MSA statement — the figures say what they count", () => {
  it("no certificate expiring is not 'all current': lapsed certificates are said to be left out", () => {
    const text = draft();
    assert.match(section(text, 4), /No certificate on SourceBD's records for our saved suppliers expires within the next 90 days\. Certificates that have already lapsed are not counted here\./);
    assert.match(section(text, 6), /Certificates expiring within 90 days \(lapsed certificates not counted\): \*\*0\*\*/);
    const three = section(draft({ inputs: { ...INPUTS, expiring_certs_90d: 3 } }), 4);
    assert.match(three, /3 certificates held by our saved suppliers expire within the next 90 days, according to SourceBD's certificate records\./);
  });

  it("empty register and certification lists name no register or standard", () => {
    const text = draft({ inputs: { ...INPUTS, by_register: [], by_certification: [], rsc_covered: 0, rsc_avg_progress_pct: null } });
    const dd = section(text, 3);
    assert.match(dd, /SourceBD holds no BGMEA, BKMEA, BTMA, BGAPMEA, EPB or RSC record for these suppliers\./);
    assert.match(dd, /SourceBD holds no certification record for these suppliers\./);
    assert.match(dd, /None of these suppliers is in the RMG Sustainability Council \(RSC\) safety remediation programme, according to RSC records on SourceBD\./);
    assert.doesNotMatch(text, /recognised social and environmental standards|industry registers \(/);
  });

  it("top locations name places only: an unknown city is left out and an equal district is not repeated", () => {
    const loc = section(
      draft({
        inputs: {
          ...INPUTS,
          top_regions: [
            { city: "Unknown", district: "", count: 9 },
            { city: "Gazipur", district: "Gazipur", count: 6 },
            { city: "Savar", district: "Dhaka", count: 1 },
          ],
        },
      }),
      1,
    );
    assert.match(loc, /Top locations:\n\n- Gazipur: 6 suppliers\n- Savar, Dhaka: 1 supplier\n/);
    assert.doesNotMatch(loc, /Unknown/);
  });

  it("register, certification and RSC figures carry their source", () => {
    const dd = section(draft(), 3);
    assert.match(dd, /Register records on SourceBD for these suppliers \(suppliers on each\): BGMEA \(11\), BKMEA \(3\)\./);
    assert.match(dd, /Certification records on SourceBD \(suppliers with each; lapsed certificates included\): WRAP \(4\)\./);
    assert.match(dd, /11 of these suppliers are in the RMG Sustainability Council \(RSC\) safety remediation programme, with average remediation progress of 87\.3%, according to RSC records on SourceBD\./);
  });
});
