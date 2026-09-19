import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { borderRadius, boxShadow, contrastPairs, contrastRatio, fontSize, light, resolve, tiers, toRgb } from "./tokens";

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
  // Generated and tooling files the rebuild owns. `lib/hs-catalogue.ts` is
  // written by `scripts/build-hs-photos.mjs`, and both were outside the guard.
  "lib/hs-catalogue.ts",
  "scripts/build-hs-photos.mjs",
  "scripts/gallery",
];
const HAND_TYPED = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab)\(\s*[\d.]/;
/**
 * Files on the guarded list that hold data rather than markup or styles.
 *
 * A Bangladeshi address reads "BLOCK NO #H, HOLDING NO #121" and a register
 * label reads "BGMEA General member #", so `HAND_TYPED` fires on values read
 * straight out of production — in the fixture file and in the JSON read it is
 * reconciled against. A colour written into a data file renders as the
 * characters of a colour, not as a colour, so the rule has nothing to catch
 * there — but only for as long as the file stays free of markup, which the
 * test below checks rather than trusting.
 */
const NO_MARKUP = ["lib/dashboard/fixtures.ts", "lib/dashboard/fixtures.production.json"];
const MARKUP = /className=|class="|style=\{|<[a-z][a-z0-9]*\s[^>]*>/;
/**
 * An arbitrary radius in square brackets. §9 fixes the radius scale, and the
 * cycle-1 defect was exactly this (`rounded-[4px]` where `rounded-xs` was
 * meant); nothing stopped it coming back.
 */
const OFF_TOKEN_RADIUS = /\brounded(?:-[trbl]{1,2})?-\[[^\]]+\]/;
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
  const dataOnly = NO_MARKUP.includes(rel);
  test(`no hand-typed colour in ${rel}`, () => {
    const body = readFileSync(path.join(repoRoot, rel), "utf8");
    if (dataOnly) {
      assert.ok(
        !MARKUP.test(body),
        `${rel} is exempt from the hand-typed-colour rule because it holds no markup; it does now, so take it off NO_MARKUP`,
      );
    }
    body.split(/\r?\n/).forEach((line, i) => {
      if (!dataOnly) assert.ok(!HAND_TYPED.test(line), `${rel}:${i + 1} has a hand-typed colour: ${line.trim()}`);
      assert.ok(!OLD_PALETTE.test(line), `${rel}:${i + 1} uses a removed palette class: ${line.trim()}`);
      assert.ok(!OFF_TOKEN_RADIUS.test(line), `${rel}:${i + 1} has an off-token radius: ${line.trim()}`);
    });
  });
}

// The exemption above is a list of paths; a path that no longer exists would
// silently stop guarding nothing, but a typo in it would silently stop guarding
// a real file that still needs the rule.
test("every file exempted from the hand-typed-colour rule is on the guarded list", () => {
  const guarded = new Set(GUARDED.flatMap(walk));
  for (const rel of NO_MARKUP) assert.ok(guarded.has(rel), `${rel} is exempted but is not a guarded file`);
});

// §2: "Works without animation when the user's device asks for that." The
// stylesheet the kit ships must honour prefers-reduced-motion; nothing asserted
// it, so removing the block would have gone unnoticed.
test("the kit's stylesheet honours prefers-reduced-motion", () => {
  const css = readFileSync(path.join(repoRoot, "app/ds.css"), "utf8");
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/, "app/ds.css has no reduced-motion block");
});

// ---------------------------------------------------------------------------
// Cycle 6: §9 says the rank ramp "reads without a legend". That is a claim
// about lightness, not about five colours being different — five distinguishable
// greens would satisfy "no two are equal" and still not read as an order.
// ---------------------------------------------------------------------------

/** How dark a colour is, as a number that grows with darkness: its contrast against white. */
const darkness = (hex: string) => contrastRatio(hex, "#FFFFFF");

test("the source-rank ramp is a real lightness ramp, darkest = most trusted", () => {
  const ramp = tiers.map((t) => ({ rank: t.rank, hex: resolve(light, `tier.${t.rank}`) }));
  for (let i = 1; i < ramp.length; i++) {
    const prev = ramp[i - 1]!;
    const here = ramp[i]!;
    assert.ok(
      darkness(prev.hex) > darkness(here.hex),
      `tier ${prev.rank} (${prev.hex}) is not darker than tier ${here.rank} (${here.hex}); the ramp does not read as an order`,
    );
  }
  // And the ends are far enough apart that the order is visible, not merely measurable.
  assert.ok(darkness(ramp[0]!.hex) / darkness(ramp[4]!.hex) > 10, "the ramp's ends are too close to tell apart");
});

test("the ramp is neutral, so colour stays free for status (§9)", () => {
  for (const t of tiers) {
    const [r, g, b] = toRgb(resolve(light, `tier.${t.rank}`));
    const spread = Math.max(r, g, b) - Math.min(r, g, b);
    assert.ok(spread <= 20, `tier ${t.rank} is a colour, not a step on the neutral ramp (channel spread ${spread})`);
  }
});

test("every rank has a fill, an ink and enough contrast between them", () => {
  for (const t of tiers) {
    const bg = resolve(light, `tier.${t.rank}`);
    const fg = resolve(light, `tier.${t.rank}-on`);
    assert.doesNotThrow(() => toRgb(bg), `tier.${t.rank}`);
    assert.doesNotThrow(() => toRgb(fg), `tier.${t.rank}-on`);
    assert.ok(contrastRatio(fg, bg) >= 4.5, `tier ${t.rank}'s two letters are unreadable on their own square`);
  }
  // Tier 5 is white on white canvas, so it needs its outline or it disappears.
  assert.equal(resolve(light, "tier.5"), resolve(light, "surface"));
  assert.ok(contrastRatio(resolve(light, "tier.5-line"), resolve(light, "surface")) >= 3);
});

// Cycle 8: the contrast suite is generated by iterating `contrastPairs`, which
// is exported from the file under test — deleting a pair deletes its test, and
// lowering a `min` lowers the bar it is checked against. Neither shows up as a
// failure, which is the self-comparison class the cycle-5 audit found in
// `discoverArgs()`. These pin the pairs and the thresholds as literals.
test("the contrast table covers every pair the kit needs, at the WCAG threshold for its use", () => {
  const byPair = new Map(contrastPairs.map((p) => [`${p.fg} on ${p.bg}`, p]));
  // 4.5:1 is WCAG AA for body text, 3:1 for large text and UI boundaries.
  const REQUIRED: [string, number][] = [
    ["ink on canvas", 4.5],
    ["ink on surface", 4.5],
    ["ink.strong on surface", 4.5],
    ["ink.muted on surface", 4.5],
    ["ink.subtle on surface", 4.5],
    ["brand.on on brand", 4.5],
    ["sanction.on on sanction", 4.5],
    ["tier.1-on on tier.1", 4.5],
    ["tier.2-on on tier.2", 4.5],
    ["tier.3-on on tier.3", 4.5],
    ["tier.4-on on tier.4", 4.5],
    ["tier.5-on on tier.5", 4.5],
  ];
  for (const [key, min] of REQUIRED) {
    const pair = byPair.get(key);
    assert.ok(pair, `"${key}" is not in contrastPairs, so nothing checks it`);
    assert.ok(pair!.min >= min, `"${key}" is checked at ${pair!.min}:1, below the ${min}:1 its use needs`);
    assert.ok(contrastRatio(resolve(light, pair!.fg), resolve(light, pair!.bg)) >= min, `"${key}" does not meet ${min}:1`);
  }
  assert.ok(contrastPairs.length >= REQUIRED.length, "pairs were removed from the table");
  // Every pair states a threshold that means something.
  for (const p of contrastPairs) assert.ok(p.min >= 3, `${p.fg} on ${p.bg} is checked at ${p.min}:1, which no WCAG rule asks for`);
});

// Cycle 8: §9 fixes the radius scale and `OFF_TOKEN_RADIUS` stops an arbitrary
// value being written into markup — but nothing pinned the scale itself, so
// changing `rounded-sm` from 6px to 4px was the cycle-1 defect again, applied
// everywhere at once and invisibly.
test("the radius scale is the one the founder approved on 19 Sep", () => {
  assert.deepEqual(
    { ...borderRadius },
    {
      none: "0",
      xs: "0.1875rem", // 3
      sm: "0.375rem", // 6
      DEFAULT: "0.375rem", // 6
      md: "0.625rem", // 10
      lg: "0.875rem", // 14
      xl: "1.25rem", // 20
      full: "9999px",
    },
    "the v3 scale; §9's 5/6/8 was superseded by the founder's decision of 19 Sep",
  );
});
