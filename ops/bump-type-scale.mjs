/**
 * One-shot typography scale bump — preserves hierarchy, shifts every tier up ~1px.
 * Run: node ops/bump-type-scale.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const TEXT_REPLACEMENTS = [
  ["11.5px", "13px"],
  ["13.5px", "15px"],
  ["12.5px", "14px"],
  ["10.5px", "12px"],
  ["28px", "30px"],
  ["24px", "26px"],
  ["22px", "24px"],
  ["21px", "23px"],
  ["20px", "22px"],
  ["19px", "20px"],
  ["18px", "19px"],
  ["17px", "18px"],
  ["16px", "17px"],
  ["15px", "16px"],
  ["14px", "15px"],
  ["13px", "14px"],
  ["12px", "13px"],
  ["11px", "12px"],
  ["10px", "12px"],
  ["9px", "10px"],
  ["7px", "8px"],
];

/** Small inline icons (Phosphor size prop) — meta rows, chips, etc. */
const ICON_SIZE_REPLACEMENTS = [
  [10, 12],
  [11, 13],
  [12, 14],
  [13, 15],
  [14, 16],
  [15, 17],
];

const SKIP_DIRS = new Set(["node_modules", ".next", ".git", "dist", "coverage"]);
const EXT = new Set([".tsx", ".ts", ".css"]);

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walk(full, out);
    else if (EXT.has(path.extname(name))) out.push(full);
  }
  return out;
}

function bumpText(content) {
  let next = content;
  for (const [from, to] of TEXT_REPLACEMENTS) {
    next = next.replaceAll(from, to);
  }
  return next;
}

function bumpIconSizes(content) {
  let next = content;
  for (const [from, to] of ICON_SIZE_REPLACEMENTS) {
    const re = new RegExp(`size=\\{${from}\\}`, "g");
    next = next.replace(re, `size={${to}}`);
  }
  return next;
}

const files = [
  ...walk(path.join(ROOT, "app")),
  ...walk(path.join(ROOT, "components")),
  ...walk(path.join(ROOT, "lib")),
];

let changed = 0;
for (const file of files) {
  const original = fs.readFileSync(file, "utf8");
  let updated = bumpText(original);
  if (file.endsWith(".tsx")) updated = bumpIconSizes(updated);
  if (updated !== original) {
    fs.writeFileSync(file, updated);
    changed += 1;
  }
}

console.log(`Updated ${changed} files.`);
