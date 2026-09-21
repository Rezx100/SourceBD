"use strict";
// Module aliases for a gallery render: the same `@/` mapping the test runner
// uses, plus the real Phosphor icon set in place of the test stub. Repo-relative
// on purpose — the copy this replaced hard-coded one container's paths.
const Module = require("module");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..", "..");
const outDir = path.join(repoRoot, process.env.RENDER_BUILD_DIR || ".render-build");
const stub = (name) => path.join(repoRoot, "test-stubs", name);
const orig = Module._resolveFilename;

Module._resolveFilename = function resolveWithGalleryAliases(request, parent, isMain, options) {
  if (request === "server-only") return stub("server-only.cjs");
  if (request === "next/headers") return stub("next-headers.cjs");
  if (request === "next/cache") return stub("next-cache.cjs");
  if (request === "@phosphor-icons/react" || request === "@phosphor-icons/react/dist/ssr") {
    return path.join(__dirname, "phosphor-real.cjs");
  }
  if (typeof request === "string" && request.endsWith(".css")) return stub("empty-css.cjs");
  if (typeof request === "string" && request.startsWith("@/")) {
    return orig.call(this, path.join(outDir, request.slice(2)), parent, isMain, options);
  }
  return orig.call(this, request, parent, isMain, options);
};
