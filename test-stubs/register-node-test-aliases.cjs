"use strict";

const Module = require("module");
const path = require("path");

const repoRoot = path.join(__dirname, "..");
const outDir = path.join(repoRoot, "node_modules", ".cache", "sourcebd-tests");
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
  if (request === "@phosphor-icons/react") {
    return path.join(__dirname, "phosphor-icons-react.cjs");
  }
  if (typeof request === "string" && request.endsWith(".css")) {
    return path.join(__dirname, "empty-css.cjs");
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
