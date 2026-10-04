// The v4 Modern Slavery statement editor (B6c-2): how the draft is read into sections and claims, what a
// fill does to the text that downloads, the editor's markup (sections, the document with its claims in
// place, the rail with Download disabled and its reason), and what the route puts in the HTML for a
// filled, a tracker-less and a failed read. The draft's own text is pinned in `lib/msa-statement.test.ts`.

import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "node:test";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { buildStatement, countPlaceholders, type MsaInputs } from "@/lib/msa-statement";
import { StatementEditor } from "./editor";
import { ScreeningNote, StatementError, StatementHead, StatementSkeleton } from "./head";
import { claimKey, claimLabel, claimsOf, claimsToConfirm, downloadBlocked, fileName, finalText, openBySection, openClaims, parseStatement, subsOf } from "./words";

const OUT = path.join(process.cwd(), process.env.TEST_BUILD_DIR || ".tests-build");
type Answer = { data: unknown; error: unknown };
let rpcs: Record<string, Answer> = {};
const client = { rpc: async (fn: string) => rpcs[fn] ?? { data: null, error: { message: `no function ${fn}` } } };
{
  const id = require.resolve(path.join(OUT, "lib/supabase/server.js"));
  require.cache[id] = { id, filename: id, loaded: true, exports: { createSupabaseServerClient: async () => client }, children: [], paths: [] } as unknown as NodeJS.Module;
}
// eslint-disable-next-line @typescript-eslint/no-require-imports -- the stub must be installed before the route module loads.
const route = (p: string) => require(path.join(OUT, p)).default as (props?: unknown) => ReactElement | Promise<ReactElement>;
const router = { push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} };
const render = (el: ReactElement) => renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: router as never }, el));
const plain = (s: string) => s.replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"');
const html = (el: ReactElement) => plain(render(el));
const text = (markup: string) => markup.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");

const INPUTS: MsaInputs = {
  total_saved: 16,
  total_published: 16,
  by_country: [{ country: "Bangladesh", count: 16 }],
  by_entity_type: [{ entity_type: "factory", count: 16 }],
  by_register: [{ register: "BGMEA", count: 11 }],
  by_certification: [],
  top_regions: [],
  top_parent_groups: [],
  rsc_covered: 11,
  rsc_avg_progress_pct: null,
  sanctions_hits: 0,
  expiring_certs_90d: 0,
};
const SCREENING = { total: 16, hits: 0, flags: 1, clear: 15 };
const args = (over: Partial<Parameters<typeof buildStatement>[0]> = {}) => ({ org: "", year: "2025", signerName: "", signerRole: "Director", asOf: "2026-10-04", inputs: INPUTS, screening: SCREENING, ...over });
const draft = (over: Partial<Parameters<typeof buildStatement>[0]> = {}) => buildStatement(args(over));

describe("the draft as sections and claims", () => {
  it("an opening and the seven numbered sections, in the draft's order", () => {
    const sections = parseStatement(draft());
    assert.deepEqual(sections.map((s) => [s.number, s.title]), [
      [null, "Statement"],
      ["1", "Organisation and supply chain structure"],
      ["2", "Policies in relation to slavery and human trafficking"],
      ["3", "Due diligence processes"],
      ["4", "Risk assessment"],
      ["5", "Training"],
      ["6", "Effectiveness — key performance indicators"],
      ["7", "Approval"],
    ]);
    assert.ok(sections.every((s) => s.blocks.length > 0), "an empty section");
  });

  it("neither the title line nor the DRAFT note is drawn; the page says how many claims are open", () => {
    const sections = parseStatement(draft());
    const all = JSON.stringify(sections);
    assert.doesNotMatch(all, /Section 54 Transparency Statement/);
    assert.doesNotMatch(all, /DRAFT: /);
  });

  it("every distinct claim once, with a short line and its section; the four details are the details card's", () => {
    const claims = claimsOf(parseStatement(draft()));
    assert.deepEqual([claims[0]!.label, claims[0]!.detail], ["Organisation name", "org"]);
    assert.deepEqual(claims.filter((c) => c.detail).map((c) => c.detail), ["org", "signerName"], "the year and the role were typed, so they are not asked");
    assert.ok(claims.some((c) => c.label === "The result of checking your suppliers against the UFLPA Entity List") === false, "the tracker loaded, so that claim is not asked");
    const sec = claims.find((c) => c.label === "What your organisation does")!;
    assert.equal(sec.section, "Section 1 · Organisation and supply chain structure");
    assert.equal(new Set(claims.map((c) => c.key)).size, claims.length);
    assert.ok(claims.length < countPlaceholders(draft()), "the organisation name is asked once however often the text names it");
  });

  it("claimLabel: the details' own names, else the first clause, capitalised and cut at 80 characters", () => {
    assert.equal(claimLabel("organisation name"), "Organisation name");
    assert.equal(claimLabel("financial year"), "Reporting financial year");
    assert.equal(claimLabel("what your organisation does: what it sells, where it operates."), "What your organisation does");
    const long = claimLabel("x".repeat(200));
    assert.equal(long.length, 80);
    assert.ok(long.endsWith("..."));
  });

  it("a fill closes its claim everywhere it appears; the section counts follow", () => {
    const sections = parseStatement(draft());
    const before = openClaims(sections);
    assert.ok(before.length >= 6);
    const key = before.find((c) => c.label === "What your organisation does")!.key;
    const after = parseStatement(draft(), { [key]: "We design and sell knitwear in the UK." });
    assert.equal(openClaims(after).length, before.length - 1);
    assert.equal(openBySection(after)[after[1]!.id] ?? 0, (openBySection(sections)[sections[1]!.id] ?? 0) - 1);
    const claim = JSON.stringify(after).match(/"claim":"what your organisation does[^"]*","text":"[^"]*","fill":"([^"]*)"/);
    assert.equal(claim?.[1], "We design and sell knitwear in the UK.");
  });

  it("an answer survives a corrected organisation name or year: it is kept under the claim with the typed details as tokens", () => {
    const first = { org: "Example Apparel", year: "2025" };
    const d1 = draft({ org: first.org, year: first.year });
    const s1 = parseStatement(d1, {}, subsOf(first));
    const does = openClaims(s1).find((c) => c.label.startsWith("What Example Apparel does"))!;
    assert.equal(does.key, "what {org} does: what it sells, where it operates, its annual turnover and how many people it employs.");
    const fills = { [does.key]: "We design knitwear." };
    // The buyer corrects the name: the claim's own text changes, its key does not, and the answer still applies.
    const second = { org: "Example Apparel Ltd", year: "2026" };
    const d2 = draft({ org: second.org, year: second.year });
    const s2 = parseStatement(d2, fills, subsOf(second));
    assert.equal(openClaims(s2).some((c) => c.key === does.key), false, "the answer was lost with the correction");
    assert.match(finalText(d2, fills, subsOf(second)), /We design knitwear\./);
    // Without the tokens the answer is lost, which is what this guards.
    assert.equal(openClaims(parseStatement(d2, fills)).length > openClaims(s2).length, true);
    assert.equal(claimKey("a b", [["", "{x}"]]), "a b", "an empty detail swaps nothing");
  });

  it("bold labels and bullets are read as such, not as stray asterisks and dashes", () => {
    const sections = parseStatement(draft());
    const json = JSON.stringify(sections);
    assert.match(json, /"kind":"bold","text":"Organisation:"/);
    assert.match(json, /"kind":"ul"/);
    assert.doesNotMatch(json, /\*\*/);
  });

  it("the words: how many claims, and why Download is held", () => {
    assert.equal(claimsToConfirm(1), "1 claim to confirm");
    assert.equal(claimsToConfirm(3), "3 claims to confirm");
    assert.equal(downloadBlocked(3), "Confirm 3 claims to download.");
    assert.equal(downloadBlocked(1), "Confirm 1 claim to download.");
  });
});

describe("what downloads", () => {
  it("each answered claim is replaced by its fill, a typed bracket made round, and the note counts what is left", () => {
    const d = draft();
    const keys = openClaims(parseStatement(d)).map((c) => c.key);
    const some = finalText(d, { [keys[2]!]: "Our own words [with brackets]." });
    assert.match(some, /Our own words \(with brackets\)\./);
    assert.equal(countPlaceholders(some), countPlaceholders(d) - 1);
    assert.match(some, new RegExp(`> DRAFT: ${countPlaceholders(some)} items marked "Confirm"`));
    assert.equal(some.split("\n\n")[0], "# Modern Slavery Act 2015 — Section 54 Transparency Statement");
  });

  it("with every claim answered the text holds no placeholder and no DRAFT note", () => {
    const d = draft();
    const fills = Object.fromEntries(openClaims(parseStatement(d)).map((c) => [c.key, `Answer to ${c.label}`]));
    const done = finalText(d, fills);
    assert.equal(countPlaceholders(done), 0);
    assert.doesNotMatch(done, /DRAFT:|Confirm/);
    assert.match(done, /^# Modern Slavery Act 2015/);
  });

  it("an empty or blank fill answers nothing; the file is named from what was typed", () => {
    const d = draft();
    const key = openClaims(parseStatement(d))[0]!.key;
    assert.equal(finalText(d, { [key]: "   " }), finalText(d, {}));
    assert.equal(fileName("Example Apparel Ltd", "2025"), "example-apparel-ltd-2025.md");
    assert.equal(fileName("", ""), "msa-statement.md");
    assert.equal(fileName("", "2025"), "msa-statement-2025.md");
  });
});

describe("the editor as drawn", () => {
  const out = () => html(createElement(StatementEditor, { inputs: INPUTS, screening: SCREENING }));

  it("sections on the left with their open claims, the draft in the middle with its claims in place", () => {
    const o = out();
    assert.match(o, /<nav aria-label="Sections"/);
    assert.match(text(o), /1\. Organisation and supply chain structure \d+ claims? to confirm/);
    assert.match(text(o), /Section 1 Organisation and supply chain structure/);
    assert.match(o, /\[Confirm: What your organisation does\]/);
    assert.match(text(o), /Dashed amber: only you can confirm it\. Underlined: you confirmed it\./);
    assert.doesNotMatch(o, /<textarea[^>]*aria-label="Statement preview"/);
  });

  it("the rail: the open claims with a Fill in each, Download held with its reason, a copy, the format and the approval", () => {
    const o = out();
    const n = openClaims(parseStatement(draft({ year: String(new Date().getFullYear() - 1), signerRole: "Director", asOf: new Date().toISOString().slice(0, 10) }))).length;
    assert.match(text(o), new RegExp(`Before you download · ${n} claims to confirm`));
    assert.equal(o.match(/>Fill in</g)?.length, n);
    assert.match(o, /<button[^>]*disabled=""[^>]*>Download statement<\/button>/);
    assert.match(text(o), new RegExp(`Confirm ${n} claims to download\\.`));
    assert.match(o, /aria-describedby="[^"]+"[^>]*disabled|disabled=""[^>]*aria-describedby=/);
    assert.match(text(o), /Copy draft/);
    assert.match(text(o), /Markdown \(\.md\)/);
    assert.match(text(o), /Your board approves it and a director signs it\./);
  });

  it("the details card has the four fields; the year and the role start filled, the name and the organisation do not", () => {
    const o = out();
    assert.match(o, /aria-label="Your details"/);
    for (const label of ["Organisation name", "Reporting financial year", "Signatory name", "Signatory role"]) assert.match(text(o), new RegExp(label));
    assert.match(o, /value="Director"/);
  });

  it("a phone's rail leads with the claims and 'Read the whole draft', and promises no PDF or Word", () => {
    const o = out();
    assert.match(text(o), /Read the whole draft/);
    assert.match(o, /href="#draft"/);
    assert.doesNotMatch(text(o), /Download a PDF|Word \(DOCX\)/);
  });
});

describe("the states", () => {
  it("the head names the act and says nothing leaves the browser; a failed read is an error; a missing tracker is a note", () => {
    assert.match(text(html(createElement(StatementHead))), /Modern slavery statement UK Modern Slavery Act 2015, section 54 · composed from your saved suppliers · nothing leaves your browser/);
    const err = html(createElement(StatementError));
    assert.match(err, /role="alert"/);
    assert.match(text(err), /We couldn't load the statement inputs\./);
    assert.match(err, /href="\/app\/compliance\/msa"[^>]*>Try again/);
    assert.match(text(html(createElement(ScreeningNote))), /The UFLPA check did not load, so the draft leaves its result for you to confirm\./);
    assert.match(html(createElement(StatementSkeleton)), /role="status" aria-busy="true"/);
  });
});

describe("/app/compliance/msa", () => {
  const MSA_INPUTS: Answer = { data: INPUTS, error: null };
  const page = async () => plain(render(await route("app/(app)/app/compliance/msa/page.js")()));

  it("a region flag on the tracker reaches the risk section; no policy, training or board claim is plain prose", async () => {
    rpcs = { compliance_msa_inputs: MSA_INPUTS, compliance_uflpa_tracker: { data: SCREENING, error: null } };
    const out = await page();
    assert.match(text(out), /Section 4 Risk assessment/);
    assert.match(text(out), /0 matches, 1 region flag and 15 with neither\./);
    assert.match(out, /\[Confirm: What your organisation did about each match and region flag/);
    for (const old of [/maintains a formal/, /provides training/, /approved by the Board/, /remain current/, /denied-party/, /zero active hits/]) assert.doesNotMatch(text(out), old);
    assert.doesNotMatch(text(out), /The UFLPA check did not load/);
  });

  it("a tracker that fails is said so, and the draft states no screening result", async () => {
    rpcs = { compliance_msa_inputs: MSA_INPUTS, compliance_uflpa_tracker: { data: null, error: { message: "boom" } } };
    const out = await page();
    assert.match(text(out), /The UFLPA check did not load, so the draft leaves its result for you to confirm\./);
    assert.match(out, /\[Confirm: The result of checking your suppliers against the UFLPA Entity List\]/);
    assert.doesNotMatch(text(out), /region flags?:|UFLPA Entity List matches/);
  });

  it("a footprint that fails is an error and no editor", async () => {
    rpcs = { compliance_msa_inputs: { data: null, error: { message: "down" } }, compliance_uflpa_tracker: { data: SCREENING, error: null } };
    const out = await page();
    assert.match(out, /role="alert"/);
    assert.match(text(out), /We couldn't load the statement inputs\./);
    assert.doesNotMatch(out, /Before you download/);
  });
});
