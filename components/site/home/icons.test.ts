// The home page's icon family and its assets: every icon draws, hidden from a screen reader, with no hand-typed
// colour; every file under public/site/home is named in its PROVENANCE.md and every file named there exists.

import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

// eslint-disable-next-line @typescript-eslint/no-require-imports -- loaded after the test build exists.
const { HomeIcon, ICONS } = require("@/components/site/home/icons") as typeof import("@/components/site/home/icons");

const root = process.cwd();

describe("the home icon family", () => {
  it("has the 22 icons of the Paper set", () => {
    assert.equal(Object.keys(ICONS).length, 22);
  });

  it("draws each icon at 24 and 40, hidden from screen readers, with one green detail", () => {
    for (const name of Object.keys(ICONS) as (keyof typeof ICONS)[]) {
      for (const size of [24, 40] as const) {
        const svg = renderToStaticMarkup(createElement(HomeIcon, { name, size }));
        assert.match(svg, /^<svg aria-hidden="true"/, name);
        assert.match(svg, new RegExp(`width="${size}" height="${size}"`), name);
        assert.equal((svg.match(/class="text-brand"/g) ?? []).length, 1, `${name} has one green detail`);
      }
    }
  });

  it("no file in the home folder carries mangled text (UTF-8 read as Windows-1252: \"Â·\", \"â€™\")", () => {
    for (const f of readdirSync(join(root, "components/site/home"))) assert.doesNotMatch(readFileSync(join(root, "components/site/home", f), "utf8"), /Â|â€/, f);
  });

  it("names no colour by hex", () => {
    const src = readFileSync(join(root, "components/site/home/icons.tsx"), "utf8");
    assert.doesNotMatch(src, /#[0-9a-f]{3,8}\b/i);
  });
});

describe("the home assets", () => {
  const dir = join(root, "public/site/home");
  const files = readdirSync(dir).filter((f) => f !== "PROVENANCE.md");
  const note = readFileSync(join(dir, "PROVENANCE.md"), "utf8");

  it("every file is named in PROVENANCE.md", () => {
    for (const f of files) assert.ok(note.includes(f), `${f} is not in PROVENANCE.md`);
  });

  it("every file PROVENANCE.md names exists", () => {
    // The sources (`hf-*`) live outside the repo; every other file named is one of ours.
    const named = (note.match(/`[\w.@-]+\.(?:webp|avif|mp4|webm)`/g) ?? []).filter((n) => !n.startsWith("`hf-"));
    assert.ok(named.length > 0);
    for (const n of named) assert.ok(files.includes(n.slice(1, -1)), `${n} is named but missing`);
  });

  it("keeps every file at web size: no still over 600 KB, the loop under 2.5 MB", () => {
    for (const f of files) {
      const kb = statSync(join(dir, f)).size / 1024;
      assert.ok(kb < (/\.(mp4|webm)$/.test(f) ? 2560 : 600), `${f} is ${Math.round(kb)} KB`);
    }
  });
});
