import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { borderRadius, boxShadow, contrastPairs, contrastRatio, cssVarName, density, densitySizes, fontSize, light, maxWidth, resolve, tiers, toRgb, transitionDuration } from "./tokens";

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
// Tailwind's preflight sets `::placeholder` to `theme(colors.gray.400)`, and
// `tailwind.config.ts` REPLACES `theme.colors` rather than extending it, so
// `colors.gray` does not exist and the emitted value is a hard-coded grey
// at 2.54:1 on `surface`. Every field in the app inherited that except the two
// that happened to set `placeholder:text-ink-subtle` themselves. `app/ds.css`
// now sets it once in @layer base; this holds that rule to the same threshold
// as any other text, by resolving the token it names rather than by matching
// the text of the rule. Deleting the rule, or pointing it at `ink.disabled`,
// turns this red.
test("the placeholder colour is a token, and readable on every ground", () => {
  const css = readFileSync(path.join(repoRoot, "app/ds.css"), "utf8");
  // The selector matters as much as the colour. Preflight's
  // `input::placeholder, textarea::placeholder` lives in the same `@layer
  // base`, and is one element-selector more specific than a bare
  // `::placeholder`, so it wins however late ours comes — the first attempt
  // at this fix compiled to a stylesheet that still served preflight's grey.
  // Exactly ONE placeholder colour rule, and it is the token one.
  //
  // Two earlier versions of this guard were beaten. `exec` read only the
  // first block, so appending an equal-specificity rule later won the
  // cascade with the test green. Taking the LAST rule that sets a colour
  // fixed that and lost twice more: `input[type="text"]::placeholder` is
  // more specific and the selector regex could not even see it, and an
  // `!important` rule placed EARLIER wins the cascade while the test still
  // reads the last one.
  //
  // Counting them removes the whole class. There is no cascade to reason
  // about when there is only one rule, so a second one — wherever it sits,
  // however it is spelled, important or not — fails here and has to be
  // argued for rather than slipped in.
  // Comments stripped first. The prose above the rule in app/ds.css explains
  // the cascade and therefore contains the literal selector, and `[^{}]*`
  // swept it into the captured selector — so weakening the real selector to a
  // bare `::placeholder` still "matched", because the comment did.
  const cssCode = css.replace(new RegExp(String.raw`/\*[\s\S]*?\*/`, "g"), "");
  const placeholderRules = [
    ...cssCode.matchAll(/([^{}]*::placeholder[^{}]*)\{([^}]*)\}/g),
  ].filter((r) => /(^|[;\s])color\s*:/.test(r[2] ?? ""));
  assert.equal(
    placeholderRules.length,
    1,
    `app/ds.css sets a placeholder colour in ${placeholderRules.length} rules; exactly one may, or the cascade decides: ${placeholderRules
      .map((r) => (r[1] ?? "").trim())
      .join(" | ")}`,
  );
  const winning = placeholderRules[0]!;
  assert.match(
    winning[1] ?? "",
    /input::placeholder\s*,\s*textarea::placeholder/,
    `the rule must match Tailwind preflight's own selector or preflight out-specifies it: ${(winning[1] ?? "").trim()}`,
  );
  assert.doesNotMatch(
    winning[2] ?? "",
    /!important/,
    "the placeholder colour should win on order and specificity, not on !important",
  );
  const rule: [unknown, string] = [null, winning[2] ?? ""];
  const varName = /color:\s*rgb\(\s*var\(\s*(--ds-[a-z0-9-]+)\s*\)/i.exec(rule[1]);
  assert.ok(varName, `the placeholder rule does not set a --ds- token: ${rule[1].trim()}`);
  const token = Object.entries(light).flatMap(([group, keys]) =>
    Object.keys(keys as Record<string, string>).map((key) => ({
      ref: key === "DEFAULT" ? group : `${group}.${key}`,
      cssVar: cssVarName(group, key),
    })),
  ).find((t) => t.cssVar === varName[1]);
  assert.ok(token, `${varName[1]} is not a token in lib/design/tokens.ts`);
  for (const bg of ["surface", "canvas", "surface.sunken"]) {
    const ratio = contrastRatio(resolve(light, token.ref), resolve(light, bg));
    assert.ok(
      ratio >= 4.5,
      `placeholder ${token.ref} on ${bg} is ${ratio.toFixed(2)}:1, needs 4.5:1`,
    );
  }
  assert.match(
    rule[1] ?? "",
    /opacity:\s*1/,
    "Firefox dims placeholders by default; the rule must reset opacity or the ratio above is not what ships",
  );
});

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

// ---------------------------------------------------------------------------
// Cycle 9. An independent mutation sweep found every non-colour token in this
// file unguarded: renaming every default CSS variable, doubling the body font
// size, changing the table-row height, the sidebar width, the content width
// and the fast transition all left the suite green, because no test renders a
// token through to a class and nothing pins the values. Each of these is a
// literal, so a change to the scale is a change to a test.
// ---------------------------------------------------------------------------

test("the contrast table lists every pair it is meant to, at the threshold its use needs", () => {
  // Generated from `contrastPairs`, which is exported from the file under
  // test: deleting a pair deletes its test, and lowering a `min` lowers the
  // bar. A `length >=` backstop cannot catch either (49 >= 12 always holds).
  const listed = contrastPairs.map((p) => `${p.fg} on ${p.bg} @${p.min}`).sort();
  // The whole table, as literals. Deleting a pair deletes its generated
  // test and lowering a `min` lowers the bar it is checked against; neither
  // shows up as a failure while the expectation is derived from the table.
  const expected = [
    "brand.ink on brand.tint @4.5",
    "brand.ink on brand.tint-strong @4.5",
    "brand.ink on canvas @4.5",
    "brand.ink on locked @4.5",
    "brand.ink on quiet @4.5",
    "brand.ink on surface @4.5",
    "brand.ink on surface.sunken @4.5",
    "brand.ink-inverse on surface.inverse @4.5",
    "brand.on on brand @4.5",
    "brand.on on brand.active @4.5",
    "brand.on on brand.hover @4.5",
    "caution.ink on canvas @4.5",
    "caution.ink on caution.tint @4.5",
    "caution.ink on surface @4.5",
    "caution.on on caution @4.5",
    "danger.ink on danger.tint @4.5",
    "danger.ink on surface @4.5",
    "danger.on on danger @4.5",
    "focus on canvas @3",
    "focus on surface @3",
    "ink on canvas @4.5",
    "ink on locked @4.5",
    "ink on quiet @4.5",
    "ink on surface @4.5",
    "ink on surface.sunken @4.5",
    "ink.inverse on surface.inverse @4.5",
    "ink.inverse on surface.inverse-raised @4.5",
    "ink.inverse-muted on surface.inverse @4.5",
    "ink.inverse-subtle on surface.inverse @4.5",
    "ink.muted on canvas @4.5",
    "ink.muted on locked @4.5",
    "ink.muted on quiet @4.5",
    "ink.muted on surface @4.5",
    "ink.muted on surface.sunken @4.5",
    "ink.strong on canvas @4.5",
    "ink.strong on locked @4.5",
    "ink.strong on locked.stripe @4.5",
    "ink.strong on quiet @4.5",
    "ink.strong on surface @4.5",
    "ink.strong on surface.sunken @4.5",
    "ink.subtle on canvas @4.5",
    "ink.subtle on locked @4.5",
    "ink.subtle on quiet @4.5",
    "ink.subtle on surface @4.5",
    "ink.subtle on surface.sunken @4.5",
    "line.strong on surface @3",
    "locked.ink on locked @4.5",
    "locked.ink on locked.stripe @4.5",
    "positive.ink on positive.tint @4.5",
    "positive.on on positive @4.5",
    "quiet.ink on quiet @4.5",
    "quiet.ink on surface @4.5",
    "sanction.ink on sanction.tint @7",
    "sanction.ink on surface @7",
    "sanction.line on surface @3",
    "sanction.on on sanction @7",
    "signal.deep on surface @3",
    "signal.on on signal @4.5",
    "smart on canvas @4.5",
    "smart on smart.tint @4.5",
    "smart on surface @4.5",
    "tier.1-on on tier.1 @4.5",
    "tier.2-on on tier.2 @4.5",
    "tier.3-on on tier.3 @4.5",
    "tier.4-on on tier.4 @4.5",
    "tier.5-line on surface @3",
    "tier.5-on on tier.5 @4.5",
  ];
  assert.deepEqual(listed, expected, "contrastPairs and this list must be the same set; a pair in one and not the other is unchecked or unlisted");
});

test("the pairs held above AA are still held above AA", () => {
  // §2 reserves the sanction red; §6 asks for AAA on it. A silent drop from 7
  // to 4.5 leaves the comment true and the check weaker.
  for (const key of ["sanction.on on sanction", "sanction.ink on sanction.tint"]) {
    const pair = contrastPairs.find((p) => `${p.fg} on ${p.bg}` === key);
    assert.ok(pair, `"${key}" is not checked at all`);
    assert.equal(pair!.min, 7, `"${key}" is checked at ${pair!.min}:1, not the AAA the spec asks for`);
  }
  for (const key of ["line.strong on surface", "tier.5-line on surface"]) {
    const pair = contrastPairs.find((p) => `${p.fg} on ${p.bg}` === key);
    assert.ok(pair, `"${key}" is not checked at all`);
    assert.equal(pair!.min, 3, `"${key}" is a UI boundary and needs 3:1`);
  }
});

test("a colour group's default variable keeps its bare name", () => {
  // `--ds-ink` is what `text-ink` resolves to. Renaming it `--ds-ink-DEFAULT`
  // breaks every default colour in the product and no test noticed.
  assert.equal(cssVarName("ink", "DEFAULT"), "--ds-ink");
  assert.equal(cssVarName("ink", "muted"), "--ds-ink-muted");
  assert.equal(cssVarName("brand", "DEFAULT"), "--ds-brand");
  assert.equal(cssVarName("tier", "1-on"), "--ds-tier-1-on");
});

test("the density stops are the ones the artifact fixed", () => {
  assert.deepEqual({ ...density }, {
    tableRow: 36,
    tableRowRelaxed: 44,
    control: 32,
    controlLarge: 40,
    cardPadding: 16,
    panelPadding: 20,
    gutter: 24,
    sidebar: 232,
    topbar: 56,
    factRow: 28,
  });
  // The Tailwind utilities are derived from them, so the two cannot drift.
  for (const [util, px] of [
    ["row-dense", density.tableRow],
    ["row-relaxed", density.tableRowRelaxed],
    ["control", density.control],
    ["control-lg", density.controlLarge],
    ["sidebar", density.sidebar],
    ["topbar", density.topbar],
    ["fact-row", density.factRow],
  ] as const) {
    assert.equal(densitySizes[util], `${px}px`, util);
  }
});

test("the type scale, the widths and the durations are the approved ones", () => {
  assert.equal(fontSize.base?.[0], "0.875rem", "body text is 14px");
  assert.equal(fontSize.sm?.[0], "0.8125rem");
  assert.equal(fontSize.xs?.[0], "0.75rem");
  assert.equal(fontSize.title?.[0], "0.9375rem");
  assert.equal(fontSize.eyebrow?.[0], "0.6875rem");
  assert.equal(maxWidth.content, "75rem");
  assert.equal(maxWidth.prose, "68ch");
  assert.deepEqual({ ...transitionDuration }, { fast: "120ms", DEFAULT: "200ms", slow: "320ms", reveal: "640ms" });
});

test("the source-rank labels are the five §2 names", () => {
  assert.deepEqual(
    tiers.map((t) => [t.rank, t.label]),
    [
      [1, "Government"],
      [2, "Industry bodies"],
      [3, "Certification bodies"],
      [4, "Brand lists"],
      [5, "Foreign regulators"],
    ],
  );
});

test("no role outside the signal group paints the reserved sanction red", () => {
  // The live dot's bloom is a shadow, not a colour group, so the
  // sanction-reuse test above cannot see it.
  const sanction = new Set(Object.values(light.sanction).map((h) => h.toUpperCase().replace("#", "")));
  sanction.delete(light.sanction.on.toUpperCase().replace("#", ""));
  for (const [key, value] of Object.entries(boxShadow)) {
    for (const m of String(value).matchAll(/rgb\(\s*(\d+)\s+(\d+)\s+(\d+)/g)) {
      const hex = [m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, "0").toUpperCase()).join("");
      assert.ok(!sanction.has(hex), `the "${key}" shadow paints the reserved sanction red`);
    }
  }
});
