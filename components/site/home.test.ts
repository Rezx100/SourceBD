// The home page (B9b): Paper's nine chapters and the copy under them, the one real record that grows chapter by
// chapter (captured 3 Oct 2026, dated), live figures only when they were read, and nothing invented: no score,
// no count-up, no figure for the export records (they are v2), no district total.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { NO_FACTS, parseFacts } from "@/lib/site-facts";

const router = { push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} };
const plain = (s: string) => s.replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"');
const draw = (el: ReactElement) => plain(renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: router as never }, el)));
const text = (m: string) => m.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
// eslint-disable-next-line @typescript-eslint/no-require-imports -- loaded after the test build exists.
const { Home, FAQ_ITEMS } = require("@/components/site/home") as typeof import("@/components/site/home");

const FACTS = parseFacts(
  { suppliers_indexed: 10268, last_refreshed_at: "2026-10-02T05:48:07Z" },
  { sources_listed: 25, sources_with_records: 14, certificates_on_file: 4275, certificates_expired: 518, rsc_records: 2331, latest_read: "2026-10-02T05:48:07Z", sources: [] },
);

describe("the home page", () => {
  const out = draw(createElement(Home, { facts: FACTS }));
  const t = text(out);

  it("opens with Paper's headline, the live count and a search that runs on public Discover", () => {
    assert.match(out, /<h1[^>]*>Know who you.re buying from\.<\/h1>/);
    assert.match(t, /10,268 Bangladesh garment suppliers, each checked against the registers that list them\./);
    assert.match(out, /<form[^>]*action="\/discover"/);
    assert.match(out, /<form[^>]*role="search"/);
    assert.match(out, /name="q"/);
    assert.match(t, /Try .knit dresses Gazipur. or .GOTS./);
    assert.match(out, /href="\/signup"[^>]*>Start free/);
    assert.match(out, /href="\/contact"[^>]*>Book a demo/);
  });

  it("the nine chapters, each a question as Paper asks it", () => {
    for (const q of ["02 · Who are they?", "03 · Is that true?", "04 · Where are they?", "05 · Who do they ship to?", "06 · Will it still be true next month?", "07 · Can they make my order?", "08 · Why should I trust you?", "09 · The whole record"]) assert.match(t, new RegExp(q.replace(/[?·]/g, (c) => `\\${c}`)));
    assert.match(t, /Most sit in four districts\./);
    assert.match(t, /Now you know who you.re buying from\./);
  });

  it("the one record is real and dated: the registers, the numbers, the day they were read", () => {
    assert.match(t, /Mondol Fabrics Ltd\./);
    assert.match(t, /A real record, as it stands on 3 Oct 2026\./);
    for (const fact of ["BGMEA 4002", "EPB 2798", "RSC 10861", "GOTS-19020", "valid until 15 Dec 2026", "reg. no. 4002", "GSCS International Ltd.", "checked 24 Jul 2026", "1004-B/2006"]) assert.ok(t.includes(fact), fact);
    assert.match(t, /2 sources differ/);
    assert.match(t, /RSC counted 2,060 workers in 2 buildings\. BGMEA has 4,200 employees, as declared by the factory\./);
  });

  it("the record gains a row in each chapter, so the last card holds them all", () => {
    const cards = [...out.matchAll(/<figure[^>]*aria-label="Supplier record: Mondol Fabrics Ltd\."[^>]*>([\s\S]*?)<\/figure>/g)].map((m) => m[1]!);
    const rowsOf = (c: string) => (c.match(/<dt /g) ?? []).length;
    const counts = cards.map(rowsOf);
    assert.equal(counts[0], 0, "the first card is the dot becoming a record: a name and no rows");
    assert.ok(counts.slice(1).every((n, i) => i === 0 || n >= counts[i]!), `rows never fall: ${counts.join(",")}`);
    assert.ok(counts[counts.length - 1]! >= 8, "the last card is the whole record, the RFQ included");
    assert.match(cards[cards.length - 1]!, /Waiting for a quote/);
  });

  it("export records are v2: no figure, no buyer, no destination anywhere", () => {
    assert.match(t, /Export records are coming\./);
    assert.match(t, /Coming in v2/);
    assert.doesNotMatch(t, /FOB per piece \d|\bSpain\b|\bCanada\b/);
  });

  it("the UFLPA line says what was found, never 'clear'", () => {
    assert.match(t, /No link found/);
    assert.match(t, /our copy from 14 May 2026/);
    assert.doesNotMatch(t, /UFLPA[^.]{0,80}\bclear(ed)?\b/i);
  });

  it("never scores, never counts up: the three promises are said, and no grade, star or rating appears as a claim", () => {
    for (const p of ["No scores.", "No paid placement.", "No fact without a source and a date."]) assert.ok(t.includes(p), p);
    assert.doesNotMatch(out, /count-?up|data-count|aria-valuenow/);
  });

  it("the live figures are the site's facts, each with what it counts, and dated", () => {
    assert.match(t, /certificates on file, 518 already expired/);
    assert.match(t, /4,275/);
    assert.match(t, /25 sources listed, 14 hold supplier records/);
    assert.match(t, /2,331/);
    assert.match(t, /Updated 2 Oct 2026 · latest register read 2 Oct 2026/);
    assert.match(out, /href="\/methodology"/);
  });

  it("the district counts are a dated snapshot with no district total (the column mixes spellings)", () => {
    for (const n of ["4,421", "1,819", "1,628", "1,080"]) assert.ok(t.includes(n), n);
    assert.match(t, /as counted on 3 Oct 2026/);
    assert.doesNotMatch(t, /\b4[0-9] districts\b|districts in all|districts mapped/);
  });

  it("the role tabs carry both panels and the two real screens, with alt text", () => {
    assert.match(out, /role="tablist"/);
    assert.match(out, /src="[^"]*saved-selected[^"]*"/);
    assert.match(out, /src="[^"]*compliance-hub[^"]*"/);
    assert.match(out, /alt="The Saved page with three suppliers picked/);
    assert.match(out, /alt="The Compliance page: certificates that need a look/);
    assert.match(t, /Real v4 screen · Saved suppliers, 3 picked for one RFQ/);
    assert.match(t, /Same loop, for compliance\./);
  });

  it("the FAQ is native details, every answer in the page, with the live source counts in the first", () => {
    assert.equal((out.match(/<details/g) ?? []).length, 6);
    assert.match(t, /From 25 public sources, 14 of them holding supplier records/);
    assert.match(t, /How do I contact a supplier\?/);
  });
});

describe("without the live figures", () => {
  const out = draw(createElement(Home, { facts: NO_FACTS }));
  const t = text(out);

  it("it still stands, and no figure is printed that was not read", () => {
    assert.match(out, /<h1[^>]*>Know who you.re buying from\.<\/h1>/);
    assert.doesNotMatch(t, /10,268|certificates on file|sources listed|RSC factory records/);
    assert.match(t, /Bangladesh garment suppliers, each checked against the registers that list them\./);
    assert.doesNotMatch(t, /Updated \d/);
  });

  it("the FAQ answers do not carry a count or a date that is not there", () => {
    const [first, , , fresh] = FAQ_ITEMS(NO_FACTS);
    assert.match(String(first!.a), /From our public sources/);
    assert.doesNotMatch(String(fresh!.a), /latest register read/);
  });
});
