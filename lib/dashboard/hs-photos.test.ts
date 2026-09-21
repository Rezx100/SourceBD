import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import { HS_CATALOGUE } from "@/lib/hs-catalogue";
import { hsExporterCount, hsPhotoSrc, hsShortLabel, photoTiles, rarestFirst } from "./hs-photos";

const repoRoot = process.cwd();

describe("HS photo catalogue (handoff §6)", () => {
  it("lib/hs-catalogue.ts matches the manifest, and every hasPhoto row has both files under /public", () => {
    const manifest = JSON.parse(readFileSync(path.join(repoRoot, "design/assets/products/hs/manifest.json"), "utf8")) as {
      products: { hs: string; short: string; heading: string; exporters: number }[];
    };
    assert.equal(HS_CATALOGUE.length, manifest.products.length);
    for (const p of manifest.products) {
      const row = HS_CATALOGUE.find((r) => r.hs === String(p.hs));
      assert.ok(row, `heading ${p.hs} missing from lib/hs-catalogue.ts — re-run scripts/build-hs-photos.mjs`);
      assert.equal(row.short, p.short);
      assert.equal(row.exporters, Number(p.exporters));
      if (row.hasPhoto) {
        for (const f of [`hs-${row.hs}.webp`, `hs-${row.hs}-128.webp`]) {
          assert.ok(existsSync(path.join(repoRoot, "public/products/hs", f)), `public/products/hs/${f} missing`);
        }
      }
    }
  });

  it("orders a supplier's lines least-common first, by EPB exporter count, ties on the code", () => {
    // Aboni's twelve lines: socks (6115) and babies' knitwear (6111) are rarer than T-shirts (6109).
    const codes = ["6102", "6103", "6104", "6105", "6106", "6107", "6108", "6109", "6110", "6111", "6114", "6115"];
    const ordered = rarestFirst(codes);
    assert.equal(ordered.length, 12);
    for (let i = 1; i < ordered.length; i += 1) {
      const a = ordered[i - 1]!;
      const b = ordered[i]!;
      assert.ok(
        hsExporterCount(a) < hsExporterCount(b) || (hsExporterCount(a) === hsExporterCount(b) && a < b),
        `${a} (${hsExporterCount(a)}) should come before ${b} (${hsExporterCount(b)})`,
      );
    }
    assert.notEqual(ordered[0], "6109", "the most common line must not lead");
    assert.deepEqual(rarestFirst(codes, 3), ordered.slice(0, 3));
  });

  it("collapses 6-digit codes to their heading and drops junk", () => {
    assert.deepEqual(rarestFirst(["610510", "6105", "61", "abcd", "6109"]).sort(), ["6105", "6109"]);
  });

  it("a heading outside the catalogue keeps its place, counts as rarest, and gets no substitute photo", () => {
    const tiles = photoTiles(["6109", "9999"], 6);
    assert.equal(tiles[0]!.hs, "9999");
    assert.equal(tiles[0]!.src, null);
    assert.equal(tiles[0]!.thumb, null);
    assert.equal(tiles[1]!.src, "/products/hs/hs-6109.webp");
    assert.equal(tiles[1]!.thumb, "/products/hs/hs-6109-128.webp");
    assert.equal(hsPhotoSrc("9999"), null);
    assert.equal(hsShortLabel("6105"), "Men's knitted shirts");
  });
});
