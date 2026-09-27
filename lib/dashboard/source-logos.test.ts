// logos.lock.md §5.1: "No row in this file → no render in product." Every
// logo the kit draws must be a locked row in the lock file, and its file must
// exist — a missing file draws an empty frame where a register's mark was.

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import { sourceLogo } from "./source-logos";

const CODES = ["BEPZA", "DIFE", "EPB", "RSC", "BGMEA", "BKMEA", "BTMA", "BGAPMEA", "WRAP", "GOTS", "OEKO_TEX"];

describe("register logos are the locked ones, and they exist", () => {
  const lock = readFileSync(path.join(process.cwd(), "context", "logos.lock.md"), "utf8");
  for (const code of CODES) {
    it(code, () => {
      const file = sourceLogo(code);
      assert.ok(file, `${code} has no logo`);
      assert.ok(existsSync(path.join(process.cwd(), "public", file!)), `${file} is missing`);
      const row = lock.split("\n").find((l) => l.startsWith(`| \`${code}\` |`));
      assert.ok(row, `${code} has no row in logos.lock.md`);
      assert.match(row!, /\| locked/, `${code} is not locked in logos.lock.md`);
      assert.ok(row!.includes(file!.replace("/icons/", "")), `${code}'s lock row names another file`);
    });
  }
  it("a source with no approved mark has no logo", () => {
    assert.equal(sourceLogo("RJSC"), null);
    assert.equal(sourceLogo("BRAND_HM"), null, "buyer brands are typography only (§1)");
  });
});
