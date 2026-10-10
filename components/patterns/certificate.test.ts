// One certificate component, one radius, one date form (the critique of 7 Oct 2026, item 4: one
// certificate was drawn four ways with three date forms, and Saved was a second table of the same
// entity). Results, the pane list, the phone list and Saved all call `CertSummaryCell`: marks only,
// lit when a certificate has lapsed or is lapsing, the full date behind a hover or a tap;
// the record's chip shares the radius; Saved's columns are the results' columns, width for width.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { CertChip } from "@/components/kit";
import { CertSummaryCell, NeedsAttention, certShort, certSummary, certWords } from "@/components/patterns";
import { v4CertAliases } from "@/lib/design/tokens";

const TODAY = new Date("2026-10-03T00:00:00Z");
const read = (...p: string[]) => readFileSync(path.join(process.cwd(), "components", ...p), "utf8");
const CERTS = [
  { scheme: "WRAP", expiresOn: "2026-09-29", markCode: "WRAP" },
  { scheme: "GOTS", expiresOn: "2026-10-31", markCode: "GOTS" },
  { scheme: "SA8000", expiresOn: null },
];

describe("one certificate component", () => {
  // Critique of 8 Oct 2026, item 3 (founder: amber): expired was danger red in the build and Amber
  // Caution in DESIGN.md, so on a record the only red things were dates that had passed.
  it("an expired certificate is caution everywhere it is drawn, with the XCircle keeping it apart from expiring; red is never a date", () => {
    assert.equal(v4CertAliases["cert-expired-fg"], "caution");
    assert.equal(v4CertAliases["cert-expired-bg"], "caution-tint");
    const chip = renderToStaticMarkup(createElement(CertChip, { state: "expired" } as Parameters<typeof CertChip>[0], "Expired 29 Sep 2026"));
    const pill = renderToStaticMarkup(createElement(CertSummaryCell, { cert: certSummary(CERTS, TODAY)! }));
    const rows = renderToStaticMarkup(
      createElement(NeedsAttention, {
        items: [
          { state: "expired", supplier: "Aboni Knitwear Ltd.", what: "WRAP 7865 expired 29 Sep 2026.", note: "No renewal on file.", action: createElement("button", null, "Ask") },
          { state: "expiring", supplier: "Fakir Apparels Ltd", what: "GOTS expires in 29 days, 1 Nov 2026.", action: createElement("button", null, "Ask") },
        ],
        scope: "Your saved suppliers",
      } as Parameters<typeof NeedsAttention>[0]),
    );
    for (const [name, out] of [["chip", chip], ["pill", pill], ["attention rows", rows]] as const) assert.doesNotMatch(out, /danger/, `${name} draws a date in red`);
    assert.match(chip, /text-caution-icon/);
    assert.match(rows, /text-caution-icon/);
    // Shape still tells them apart (the test stub draws every icon as an empty svg, so the source is read).
    assert.match(read("patterns", "attention.tsx"), /const Glyph = it\.state === "expired" \? XCircle : Clock;/);
    assert.match(read("kit", "chip.tsx"), /expired: \{ box: "border-caution-icon bg-cert-expired-bg text-cert-expired-fg", icon: XCircle/);
  });

  // Founder, 9 Oct 2026: the pill beside the first mark read as a stray warning. Only the mark
  // lights up; the words open on hover (desktop) or tap (touch), and never print in the row.
  it("only the marks show; a mark with a problem lights up; the words are the title and the sr-only sentence, never printed", () => {
    const cert = certSummary(CERTS, TODAY)!;
    assert.equal(certWords("2026-09-29", TODAY).label, "Expired 29 Sep 2026");
    assert.equal(cert.short, certShort("2026-09-29", TODAY));
    // Inside a link (the pane and phone lists) the cell is not a button: a button cannot nest in a link.
    const still = renderToStaticMarkup(createElement(CertSummaryCell, { cert }));
    assert.doesNotMatch(still, /<button/);
    assert.match(still, new RegExp(`title="WRAP expired 29 Sep 2026 · 2 more certificates"><span class="sr-only">3 certificates: WRAP expired 29 Sep 2026;`));
    // In a table it is one button over the marks that opens the details.
    const out = renderToStaticMarkup(createElement(CertSummaryCell, { cert, reveal: true }));
    assert.match(out, /<button type="button" aria-haspopup="dialog" aria-expanded="false"/);
    for (const html of [still, out]) {
      assert.doesNotMatch(html, />Expired 29 Sep</, "no pill");
      assert.deepEqual([...html.matchAll(/data-lit="(\w+)"/g)].map((m) => m[1]), ["expired", "expiring"], "WRAP lapsed and GOTS lapsing both light up");
      assert.match(html, /border-caution-icon/);
      // SA8000 has no approved mark and is not the worst: it is counted, not drawn.
      assert.match(html, />\+1</);
    }
    // The popover's words: every body's whole sentence, read from the source (closed, it is not rendered).
    assert.match(read("patterns", "cert-summary.tsx"), /\{b\.words\}/);
    assert.match(read("patterns", "cert-summary.tsx"), /onPointerEnter=\{\(e\) => e\.pointerType === "mouse" && setOpen\(true\)\}/, "a mouse opens it on hover");
    // Founder, 10 Oct 2026: left open on a scroll, it rode over the sticky search bar. Any scroll closes it.
    assert.match(read("patterns", "cert-summary.tsx"), /addEventListener\("scroll", close, \{ capture: true, passive: true \}\)/);
  });

  it("the record's chip shares the radius: every chip in the kit is 6px, none 4px or a pill", () => {
    assert.match(renderToStaticMarkup(createElement(CertChip, { state: "expired" } as Parameters<typeof CertChip>[0], "Expired 29 Sep 2026")), /rounded-md/);
    const chip = read("kit", "chip.tsx");
    assert.doesNotMatch(chip, /rounded-sm|rounded-full/);
    assert.doesNotMatch(read("patterns", "certificate.tsx"), /rounded-full|rounded-sm px/);
  });

  it("results, the pane list, the phone list and Saved all call CertSummaryCell; CertProblem is gone", () => {
    for (const f of [["search", "table.tsx"], ["search", "pane-rows.tsx"], ["saved", "table.tsx"]] as const) {
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
    // A menu item may sit on its own line between its tags.
    for (const item of ["Save", "Send RFQ", "Open full page"]) assert.match(src, new RegExp(">[^<]*" + item + "[^<]*<"), item);
    assert.match(read("saved", "table.tsx"), /label=\{`More actions for \$\{i\.name\}`\}/);
  });
});
