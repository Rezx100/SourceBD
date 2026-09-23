// The screenshot harness is what produces the evidence in the bundle, so what
// it answers the RPCs with is part of the claim "the six screens are rendered
// from real data" (handoff §7 item 1).
//
// It used to answer `rfq_list` with a hard-coded `[]`, and the RFQ screen then
// stated "0 sent · 0 quotes" and "No RFQs for this account yet" about an
// account that does not exist. Nothing tested the harness, so nothing noticed.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fs, { readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { loadGalleryData } from "@/lib/dashboard/gallery-data";
import { RFQ_ROWS, RFQ_TARGETS, TODAY } from "@/lib/dashboard/fixtures";
import { fixtureRpc, records } from "./render-gallery-fixtures";

/**
 * Every `*.test.ts(x)` under `root`, as root-relative paths. Two skip sets,
 * because a name is only safe to skip where it means what we think:
 * `node_modules`/`.git` are never ours at any depth, but `etl`, `ops` and the
 * rest are skipped only at the repo root — the Python tree and the ops
 * scripts — never `app/api/v1/admin/etl/`, a real route tree.
 */
function findTestFiles(root: string): string[] {
  const skipAnywhere = new Set(["node_modules", ".next", ".git"]);
  const skipAtRoot = new Set([".tests-build", ".claude", "etl", "ops", "prototypes"]);
  const found: string[] = [];
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
      if (skipAnywhere.has(e.name) || (dir === "" && skipAtRoot.has(e.name))) continue;
      const rel = dir ? `${dir}/${e.name}` : e.name;
      if (e.isDirectory()) walk(rel);
      else if (/\.test\.tsx?$/.test(e.name)) found.push(rel);
    }
  };
  walk("");
  return found;
}

describe("the screenshot harness answers every RPC from a production payload", () => {
  it("rfq_list returns the rows production holds, not an empty literal", async () => {
    const { data } = await fixtureRpc.rpc("rfq_list", {});
    assert.deepEqual(data, RFQ_ROWS);
    // Five: production's seven RFQs belong to three buyers, and `rfq_list` is
    // scoped to `auth.uid()`, so five is the largest list it can return.
    assert.ok(Array.isArray(data) && data.length === 5, "one buyer's five RFQs");
  });

  it("the screens it renders carry those rows, with their suppliers named", async () => {
    const d = await loadGalleryData(fixtureRpc as never, TODAY, RFQ_TARGETS);
    assert.equal(d.rfqError, false);
    assert.equal(d.rfqs.rows.length, 5);
    assert.equal(d.rfqs.sent, 5);
    assert.equal(d.rfqs.quotes, 0);
    assert.notEqual(d.rfqs.footer, "No RFQs for this account yet");
    assert.ok(d.rfqs.rows.every((r) => r.supplierName === "Thermax Woven Dyeing Ltd."), "every row's target is resolved");
    // Its only receipt is an OEKO-TEX certificate, so it ranks 3 — an earlier
    // cycle drew every RFQ target at rank 2 from a hand-written literal.
    assert.ok(d.rfqs.rows.every((r) => r.supplierTier === 3), "the rank is the target's own");
  });

  it("every other RPC is answered from a fixture, and an unknown slug is refused rather than invented", async () => {
    const { data: profile } = await fixtureRpc.rpc("buyer_supplier_profile", { p_slug: "aboni-knitwear" });
    assert.ok(profile && typeof profile === "object");
    const { data: missing, error } = await fixtureRpc.rpc("buyer_supplier_profile", { p_slug: "not-a-record" });
    assert.equal(missing, null);
    assert.ok(error);
    const { data: lines } = await fixtureRpc.rpc("supplier_epb_hscodes", { p_slug: "sm-knitwear" });
    assert.equal((lines as unknown[]).length, 24);
    // The four records the six screens render; a fifth would be a record the
    // bundle shows without reconciling.
    assert.deepEqual(Object.keys(records).sort(), [
      "aboni-knitwear",
      "ar-fashion",
      "sm-knitwear",
      "zaheen-knitwear-limited-shed-3-4-5-10-11-12-13-and-building-security-etp-and-fire-pump",
    ]);
  });

  it("the two counts it replays are the ones the queries beside them returned", async () => {
    const { data: filtered } = await fixtureRpc.rpc("discover_suppliers", { p_q: "knitted shirts" });
    assert.equal((filtered as { total_count: number }[])[0]!.total_count, 42);
    const { data: all } = await fixtureRpc.rpc("discover_suppliers", { p_q: null });
    assert.equal((all as { total_count: number }[])[0]!.total_count, 10266);
  });
});

describe("importing the harness renders nothing", () => {
  // `main()` used to run on import. Importing this module for the tests
  // therefore rendered the whole gallery: the suite needed `ds.css`, a
  // Tailwind artifact that exists only after regen.sh has run, and on a clean
  // checkout the import threw — taking all five of this file's tests out of
  // the count instead of failing one. It also rewrote `gallery.html`, the page
  // the evidence screenshots are taken from, every time the tests ran.
  it("a bare require of the compiled renderer exits clean and writes no page", () => {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), "gallery-import-"));
    const compiled = path.join(process.cwd(), ".tests-build/scripts/gallery/render-gallery-fixtures.js");
    assert.ok(fs.existsSync(compiled), "the suite compiles this file, so it is here");
    const r = spawnSync(
      process.execPath,
      ["--require", path.join(process.cwd(), "test-stubs/register-node-test-aliases.cjs"), "-e", `require(${JSON.stringify(compiled)})`],
      { env: { ...process.env, GALLERY_OUT: out }, encoding: "utf8" },
    );
    assert.equal(r.status, 0, `importing the renderer failed:\n${r.stderr}`);
    assert.deepEqual(fs.readdirSync(out), [], "importing it wrote into GALLERY_OUT");
  });
});

describe("the page and the harness render the same screens", () => {
  const read = (rel: string) => readFileSync(path.join(process.cwd(), rel), "utf8");

  it("both call loadGalleryData with the RFQ targets", () => {
    // The evidence in the bundle is the harness's output; the thing that ships
    // is the page. When the harness passed `RFQ_TARGETS` and the page did not,
    // every RFQ row on the real page read "1 supplier" while the screenshot
    // showed the suppliers named — and no test could tell them apart.
    for (const rel of ["app/dev/ds/page.tsx", "scripts/gallery/render-gallery-fixtures.ts"]) {
      const src = read(rel);
      const at = src.indexOf("loadGalleryData(");
      assert.ok(at >= 0, `${rel} does not call loadGalleryData`);
      // Split the argument list at top level, so `new Date()` is one argument.
      let depth = 0;
      const args: string[] = [];
      let current = "";
      for (let i = at + "loadGalleryData(".length; i < src.length; i++) {
        const ch = src[i]!;
        if (ch === "(" || ch === "[" || ch === "{") depth++;
        else if (ch === ")" && depth === 0) break;
        else if (ch === ")" || ch === "]" || ch === "}") depth--;
        if (ch === "," && depth === 0) {
          args.push(current.trim());
          current = "";
        } else current += ch;
      }
      args.push(current.trim());
      assert.equal(args.length, 3, `${rel} calls loadGalleryData with ${args.length} arguments: ${args.join(" | ")}`);
      assert.equal(args[2], "RFQ_TARGETS", `${rel} passes "${args[2]}" where the other passes RFQ_TARGETS`);
    }
  });

  it("the page is type-checked by the suite, so a change to the loader breaks it here", () => {
    const files = JSON.parse(read("tsconfig.npm-test.json")) as { files: string[] };
    for (const rel of ["app/dev/ds/page.tsx", "app/dev/ds/dashboard-screens.tsx", "scripts/gallery/render-gallery-fixtures.ts"]) {
      assert.ok(files.files.includes(rel), `${rel} is not in tsconfig.npm-test.json, so the suite never compiles it`);
    }
  });

  it("the test-file walk skips etl/ops only at the repo root, never a nested route tree of that name", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "walk-"));
    try {
      for (const rel of ["etl/a.test.ts", "ops/b.test.ts", "app/api/v1/admin/etl/c.test.ts", "lib/ops/d.test.ts", "node_modules/x/e.test.ts", "lib/f.test.tsx"]) {
        fs.mkdirSync(path.join(root, path.dirname(rel)), { recursive: true });
        fs.writeFileSync(path.join(root, rel), "export {};");
      }
      assert.deepEqual(findTestFiles(root).sort(), ["app/api/v1/admin/etl/c.test.ts", "lib/f.test.tsx", "lib/ops/d.test.ts"]);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("every *.test.ts in the repo is in the suite's file list, so none of them silently never runs", () => {
    // `pnpm test` compiles only the files named in tsconfig.npm-test.json, then
    // globs the output. A test file left off that list is typechecked by the
    // root tsconfig and never executed — it passes by not existing. That hid
    // load-buyer-shell's tests once, and hid the Discover selection tests on
    // their first run.
    const listed = new Set((JSON.parse(read("tsconfig.npm-test.json")) as { files: string[] }).files);
    const found = findTestFiles(process.cwd());
    assert.ok(found.length > 40, `found only ${found.length} test files — the walk is not looking where the tests are`);
    const missing = found.filter((f) => !listed.has(f));
    assert.deepEqual(missing, [], `not in tsconfig.npm-test.json, so pnpm test never runs them: ${missing.join(", ")}`);
  });
});
