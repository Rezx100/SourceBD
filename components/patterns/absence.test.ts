// One word for "nothing on file" (the critique of 7 Oct 2026, item 5: fourteen phrasings, and
// absence out-shouting presence). The vocabulary is `ABSENT` in `components/patterns/words.ts`;
// a cell draws the dash with the words behind it; a sentence is allowed only in the record's empty
// sections and in Compliance. This guard greps the buyer app's components for the retired strings
// and fails on any, so a fifteenth phrasing cannot come back.

import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { Unpublished } from "@/components/kit";
import { ABSENT, certShort, certWords } from "@/components/patterns";

const ROOTS = ["search", "saved", "record", "patterns", "kit", "compliance", "rfqs", "messages", "discover", "frame"];
const RETIRED = ["No certificates found", "None found", "No expiry given", "No expiry date published", "Not set yet", "Source not linked", "Nothing on file yet"];
/** Allowed only through `ABSENT`: a literal of these outside words.ts is a second spelling waiting to drift. */
const ONLY_VIA_ABSENT = ["Issuer not published", "Nothing to check", "Not dated", "No certificates on file", "No expiry on file"];

function sources(): [string, string][] {
  const out: [string, string][] = [];
  for (const dir of ROOTS) {
    const root = path.join(process.cwd(), "components", dir);
    for (const f of readdirSync(root)) {
      if (!/\.tsx?$/.test(f) || /\.test\.ts$/.test(f)) continue;
      out.push([`${dir}/${f}`, readFileSync(path.join(root, f), "utf8")]);
    }
  }
  return out;
}

describe("one word for nothing on file", () => {
  it("no component says it any of the retired ways", () => {
    const hits: string[] = [];
    for (const [name, src] of sources()) for (const r of RETIRED) if (src.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, "").includes(r)) hits.push(`${name}: "${r}"`);
    assert.deepEqual(hits, []);
  });

  it("the kept words are typed once, in ABSENT, never as a literal elsewhere", () => {
    const hits: string[] = [];
    for (const [name, src] of sources()) {
      if (name === "patterns/words.ts") continue;
      // A doc comment may quote the words; a string literal may not.
      const code = src.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, "");
      for (const w of ONLY_VIA_ABSENT) if (new RegExp(`["'\`>]${w}["'\`<]`).test(code)) hits.push(`${name}: "${w}"`);
    }
    assert.deepEqual(hits, []);
  });

  it("a cell's absence is a dash in ink-subtle with the words in its title and for a screen reader", () => {
    const out = renderToStaticMarkup(createElement(Unpublished, null));
    assert.equal(out, '<span class="text-sm text-ink-3" title="Not published"><span aria-hidden="true">–</span><span class="sr-only">Not published</span></span>');
    assert.match(renderToStaticMarkup(createElement(Unpublished, null, ABSENT.certificates)), /title="No certificates on file"/);
  });

  it("the two 'No expiry' phrasings are one, in the chip and in the pill", () => {
    const today = new Date("2026-10-03T00:00:00Z");
    assert.equal(certWords(null, today).label, ABSENT.expiry);
    assert.equal(certShort(null, today), ABSENT.expiry);
    assert.equal(ABSENT.expiry, "No expiry on file");
  });

  it("'Not listed' (a finding) and 'Not read just now' (a failed check) are kept, and are not in the absence set", () => {
    assert.equal(ABSENT.unread, "Not read just now");
    assert.ok(!Object.values(ABSENT).includes("Not listed" as never));
    assert.equal(Object.keys(ABSENT).length, 11);
  });
});
