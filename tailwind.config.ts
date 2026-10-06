import type { Config } from "tailwindcss";
import plugin from "tailwindcss/plugin";
import {
  borderRadius,
  boxShadow,
  containers,
  cssVarName,
  dark,
  densitySizes,
  fontFamily,
  fontSize,
  fontWeight,
  letterSpacing,
  light,
  maxWidth,
  paneMaterial,
  screens,
  spacing,
  toChannels,
  transitionDuration,
  transitionTimingFunction,
  v4Alpha,
  zIndex,
  type ColorSet,
} from "./lib/design/tokens";

// Design-system rebuild (spec `ds-rebuild-must-stay.md`). This file holds no
// values of its own: everything comes from `lib/design/tokens.ts`.
//
// `theme.colors` REPLACES Tailwind's palette rather than extending it, so the
// stock white / neutral / red / blue classes no longer exist. The only colour
// classes are the role names in the token file.

/**
 * `{ ink: { muted: "#…", DEFAULT: "#…" } }` →
 * `{ "ink-muted": "rgb(var(--ds-ink-muted) / <alpha-value>)", ink: "rgb(var(--ds-ink) / <alpha-value>)" }`.
 * Flat, not nested: the classes are the same (`text-ink-muted`), and Paper's
 * arbitrary values name colours as `theme(colors.line-strong)`, which only a
 * flat key resolves (a nested `line.strong` makes Tailwind drop the class).
 */
function colorClasses(set: ColorSet) {
  return Object.fromEntries(
    Object.entries(set).flatMap(([group, keys]) =>
      Object.keys(keys).map((key) => [
        key === "DEFAULT" ? group : `${group}-${key}`,
        `rgb(var(${cssVarName(group, key)}) / <alpha-value>)`,
      ]),
    ),
  );
}

/** Paper's colours with alpha (`scrim`): the channel variable at a fixed opacity. */
function alphaClasses() {
  return Object.fromEntries(
    Object.keys(v4Alpha).map((name) => [name, `rgb(var(${cssVarName(name, "DEFAULT")}) / ${v4Alpha[name as keyof typeof v4Alpha].alpha})`]),
  );
}

/** Each token colour becomes a CSS variable holding its three channels, e.g. `--ds-ink-muted`. */
function colorVars(set: ColorSet): Record<string, string> {
  return Object.fromEntries(
    Object.entries(set).flatMap(([group, keys]) =>
      Object.entries(keys).map(([key, hex]) => [cssVarName(group, key), toChannels(hex)]),
    ),
  );
}

const config: Config = {
  // `hover:` only where a pointer can hover. Without it a tap leaves the hover
  // style on: a Save just un-saved still looked saved on a phone.
  future: { hoverOnlyWhenSupported: true },
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    colors: {
      transparent: "transparent",
      current: "currentColor",
      inherit: "inherit",
      ...colorClasses(light),
      ...alphaClasses(),
    },
    screens,
    fontFamily,
    fontSize,
    fontWeight,
    borderRadius,
    boxShadow,
    transitionDuration,
    transitionTimingFunction,
    zIndex,
    extend: {
      letterSpacing,
      spacing,
      maxWidth,
      // The old pages' density stops (`h-row-dense`, `min-h-fact-row`, …), then
      // Paper's containers as widths (`w-pane`, `w-dialog`, `w-sidebar`).
      height: densitySizes,
      minHeight: densitySizes,
      width: { ...densitySizes, ...containers },
      minWidth: { ...densitySizes, ...containers },
      flexGrow: { 2: "2" }, // Paper's `grow-2`
      ringColor: { DEFAULT: "rgb(var(--ds-focus) / <alpha-value>)" },
      borderColor: { DEFAULT: "rgb(var(--ds-line) / <alpha-value>)" },
      // The kit's motion grammar, one place. Entrances only: an exit is a
      // navigation and lands at once (exit faster than entrance). Every
      // entrance starts from an opacity of 0 and settles at 1 with `both`
      // fill, so a failed stylesheet or a reduced-motion device (app/ds.css
      // zeroes every duration) still shows the element.
      keyframes: {
        "ds-fade": { from: { opacity: "0" }, to: { opacity: "1" } },
        "ds-rise": { from: { opacity: "0", transform: "translateY(8px)" }, to: { opacity: "1", transform: "none" } },
        "ds-sheet-in": { from: { opacity: "0", transform: "translateX(32px)" }, to: { opacity: "1", transform: "none" } },
        "ds-scrim-in": { from: { opacity: "0" }, to: { opacity: "0.32" } },
        "ds-pending": { from: { transform: "translateX(-100%)" }, to: { transform: "translateX(300%)" } },
      },
      animation: {
        fade: `ds-fade ${transitionDuration.DEFAULT} ${transitionTimingFunction.out} both`,
        rise: `ds-rise ${transitionDuration.slow} ${transitionTimingFunction.out} both`,
        "sheet-in": `ds-sheet-in ${transitionDuration.slow} cubic-bezier(0.16, 1, 0.3, 1) both`,
        "scrim-in": `ds-scrim-in ${transitionDuration.DEFAULT} ${transitionTimingFunction.out} both`,
        pending: "ds-pending 1.1s ease-in-out infinite",
      },
    },
  },
  plugins: [
    plugin(({ addBase }) => {
      // The dark set is the same variables again, in two places: where the
      // system asks for dark and the page has opted in with `data-theme-auto`
      // (CSS only, so no flash and no script), and inside a night scene, which
      // is dark in either theme. Every page without the attribute stays light.
      const night = { ...colorVars(dark), ...paneMaterial.dark, "color-scheme": "dark" };
      addBase({
        ":root": { ...colorVars(light), ...paneMaterial.light },
        "@media (prefers-color-scheme: dark)": { ":root:has([data-theme-auto])": night },
        '[data-ground="night"]': night,
      });
    }),
  ],
};

export default config;
