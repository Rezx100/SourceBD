// The site's type (founder, 9 Oct 2026): Geist and Geist Mono everywhere, and a caption that is a
// sentence is never mono. Mono is for what a register filed and for labels of a few words.

import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

describe("type", () => {
  it("loads Geist and Geist Mono, not IBM Plex", () => {
    const layout = readFileSync(join(process.cwd(), "app/layout.tsx"), "utf8");
    assert.match(layout, /Geist-Variable[.]woff2/);
    assert.match(layout, /GeistMono-Variable[.]woff2/);
    assert.doesNotMatch(layout, /ibm-plex/i);
  });

  it("sets no figcaption on the site in mono", () => {
    const dir = join(process.cwd(), "components/site");
    const files = readdirSync(dir, { recursive: true }).map(String).filter((f) => f.endsWith(".tsx"));
    assert.ok(files.length > 10, "site sources found");
    for (const f of files) assert.doesNotMatch(readFileSync(join(dir, f), "utf8"), /<figcaption[^>]*font-mono/, f);
  });
});
