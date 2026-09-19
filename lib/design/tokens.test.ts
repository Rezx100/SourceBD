import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { borderRadius, boxShadow, contrastPairs, contrastRatio, fontSize, light, resolve, toRgb } from "./tokens";

// npm test runs from the repo root; the compiled test lives elsewhere.
const repoRoot = process.cwd();

// Spec ds-rebuild-must-stay.md §6: "Contrast check on every text colour pair."
for (const pair of contrastPairs) {
  test(`contrast: ${pair.fg} on ${pair.bg} is at least ${pair.min}:1 (${pair.use})`, () => {
    const ratio = contrastRatio(resolve(light, pair.fg), resolve(light, pair.bg));
    assert.ok(
      ratio >= pair.min,
      `${pair.fg} on ${pair.bg} is ${ratio.toFixed(2)}:1, needs ${pair.min}:1. Fix the value in lib/design/tokens.ts.`,
    );
  });
}

test("every token colour is a 6-digit hex", () => {
  for (const [group, keys] of Object.entries(light)) {
    for (const [key, hex] of Object.entries(keys as Record<string, string>)) {
      assert.doesNotThrow(() => toRgb(hex), `${group}.${key}`);
    }
  }
});

// A colour group and a shadow / size / radius key with the same name would
// compile to the same utility (`shadow-signal` was both the signal colour and
// the signal glow) and one silently wins.
test("no colour group shares its name with a shadow, size or radius token", () => {
  const groups = new Set(Object.keys(light));
  for (const key of [...Object.keys(boxShadow), ...Object.keys(fontSize), ...Object.keys(borderRadius)]) {
    assert.ok(!groups.has(key), `"${key}" is both a colour group and another token; the utilities collide`);
  }
});

test("the sanction red is used by no other role", () => {
  const reserved = new Set(Object.values(light.sanction).map((h) => h.toUpperCase()));
  reserved.delete(light.sanction.on.toUpperCase()); // plain white is shared
  for (const [group, keys] of Object.entries(light)) {
    if (group === "sanction") continue;
    for (const [key, hex] of Object.entries(keys as Record<string, string>)) {
      assert.ok(!reserved.has(hex.toUpperCase()), `${group}.${key} reuses a sanction colour`);
    }
  }
});

// Spec §2 + §6: no hand-typed colour outside the token file. The guarded set
// is every file the rebuild has written so far; it widens as pages are
// rebuilt and becomes repo-wide (as a lint rule) before the switch.
const GUARDED = [
  "tailwind.config.ts",
  "app/ds.css",
  "app/layout.tsx",
  "app/dev/ds",
  "components/ds",
  "components/dashboard",
  "lib/dashboard",
];
const HAND_TYPED = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab)\(\s*[\d.]/;
// Tailwind's own palette no longer exists; using it would silently render nothing.
const OLD_PALETTE =
  /\b(?:bg|text|border|ring|fill|stroke|from|via|to|divide|outline|decoration|shadow)-(?:white|black|(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3})\b/;

function walk(rel: string): string[] {
  const abs = path.join(repoRoot, rel);
  if (!existsSync(abs)) return [];
  if (statSync(abs).isFile()) return [rel];
  return readdirSync(abs).flatMap((name) => walk(path.posix.join(rel, name)));
}

for (const rel of GUARDED.flatMap(walk)) {
  test(`no hand-typed colour in ${rel}`, () => {
    const lines = readFileSync(path.join(repoRoot, rel), "utf8").split(/\r?\n/);
    lines.forEach((line, i) => {
      assert.ok(!HAND_TYPED.test(line), `${rel}:${i + 1} has a hand-typed colour: ${line.trim()}`);
      assert.ok(!OLD_PALETTE.test(line), `${rel}:${i + 1} uses a removed palette class: ${line.trim()}`);
    });
  });
}
