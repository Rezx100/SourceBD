// One certificate component, one radius, one date form (the critique of 7 Oct 2026, item 4: one
// certificate was drawn four ways with three date forms, and Saved was a second table of the same
// entity). Results, the pane list, the phone list and Saved all call `CertSummaryCell`; the short
// words live only inside its 6px pill, with the full date in the cell's title and sr-only sentence;
// the record's chip shares the radius; Saved's columns are the results' columns, width for width.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { CertChip } from "@/components/kit";
import { CertSummaryCell, certShort, certSummary, certWords } from "@/components/patterns";

const TODAY = new Date("2026-10-03T00:00:00Z");
const read = (...p: string[]) => readFileSync(path.join(process.cwd(), "components", ...p), "utf8");
const CERTS = [
  { scheme: "WRAP", expiresOn: "2026-09-29", markCode: "WRAP" },
  { scheme: "GOTS", expiresOn: "2026-10-31", markCode: "GOTS" },
  { scheme: "SA8000", expiresOn: null },
];

describe("one certificate component", () => {
  it("the short words sit only inside a 6px pill; the full date is the cell's title and its sr-only sentence", () => {
    const cert = certSummary(CERTS, TODAY)!;
    const out = renderToStaticMarkup(createElement(CertSummaryCell, { cert }));
    const full = certWords("2026-09-29", TODAY).label;
    assert.equal(full, "Expired 29 Sep 2026");
    assert.equal(cert.short, certShort("2026-09-29", TODAY));
    assert.match(out, new RegExp(`title="WRAP expired 29 Sep 2026 · 2 more certificates"><span class="sr-only">3 certificates: WRAP expired 29 Sep 2026;`));
    assert.match(out, /<span class="inline-flex whitespace-nowrap rounded-md [^"]*">Expired 29 Sep<\/span>/, "the pill is 6px and holds the short words");
    assert.doesNotMatch(out, /rounded-full/);
    // The full date is never printed twice: once in the title, once for a screen reader, and the pill says the short form.
    assert.equal((out.match(/29 Sep 2026/g) ?? []).length, 2);
  });

  it("the record's chip shares the radius: every chip in the kit is 6px, none 4px or a pill", () => {
    assert.match(renderToStaticMarkup(createElement(CertChip, { state: "expired" } as Parameters<typeof CertChip>[0], "Expired 29 Sep 2026")), /rounded-md/);
    const chip = read("kit", "chip.tsx");
    assert.doesNotMatch(chip, /rounded-sm|rounded-full/);
    assert.doesNotMatch(read("patterns", "certificate.tsx"), /rounded-full|rounded-sm px/);
  });

  it("results, the pane list, the phone list and Saved all call CertSummaryCell; CertProblem is gone", () => {
    for (const f of [["search", "table.tsx"], ["search", "list.tsx"], ["saved", "table.tsx"]] as const) {
      const src = read(...f);
      assert.match(src, /CertSummaryCell/, f.join("/"));
      assert.doesNotMatch(src, /CertProblem/, f.join("/"));
    }
    assert.doesNotMatch(read("patterns", "index.ts"), /CertProblem/);
    assert.doesNotMatch(read("patterns", "certificate.tsx"), /export function CertProblem/);
  });
});

describe("Saved is the same table as the results", () => {
  const widths = (src: string) => [...src.matchAll(/<Th([^>]*)>\s*([^<]+?)\s*</g)].map((m) => [m[2]!.trim(), /className="([^"]*)"/.exec(m[1]!)?.[1]?.split(" ").find((c) => /^w-/.test(c)) ?? null]);
  it("copies the results' columns and widths exactly, and heads the certificate column 'Certificates'", () => {
    const results = widths(read("search", "table.tsx"));
    const saved = widths(read("saved", "table.tsx"));
    assert.deepEqual(
      results.map(([h]) => h),
      ["Supplier", "Type", "Location", "Workers", "Sources", "Certificates"],
    );
    assert.deepEqual(saved.slice(0, results.length), results, "Saved's first six columns are the results' six, width for width");
    assert.deepEqual(saved.map(([h]) => h), ["Supplier", "Type", "Location", "Workers", "Sources", "Certificates", "Saved on"]);
    // Workers is 110: at 100 "Not published" wrapped and the rows alternated 40 and 57px.
    assert.equal(results.find(([h]) => h === "Workers")![1], "w-[110px]");
  });

  it("results rows end in the ⋯ menu Saved's rows have, with the same three actions", () => {
    const src = read("search", "table.tsx");
    assert.match(src, /label=\{`More actions for \$\{r\.name\}`\}/);
    for (const item of [">Save<", ">Send RFQ<", ">Open full page<"]) assert.ok(src.includes(item), item);
    assert.match(read("saved", "table.tsx"), /label=\{`More actions for \$\{i\.name\}`\}/);
  });
});
