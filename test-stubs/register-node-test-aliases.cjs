"use strict";

const Module = require("module");
const path = require("path");

const repoRoot = path.join(__dirname, "..");
// Outside node_modules on purpose: Node >= 22 test runner refuses to load
// test files from under node_modules ("Could not find ...").
const outDir = path.join(repoRoot, ".tests-build");
const orig = Module._resolveFilename;
Module._resolveFilename = function resolveWithTestAliases(
  request,
  parent,
  isMain,
  options,
) {
  if (request === "server-only") {
    return path.join(__dirname, "server-only.cjs");
  }
  if (request === "next/headers") {
    return path.join(__dirname, "next-headers.cjs");
  }
  if (request === "next/cache") {
    return path.join(__dirname, "next-cache.cjs");
  }
  if (request.startsWith("@/")) {
    return orig.call(
      this,
      path.join(outDir, request.slice(2)),
      parent,
      isMain,
      options,
    );
  }
  return orig.call(this, request, parent, isMain, options);
};
