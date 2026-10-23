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
  homeGrounds,
  letterSpacing,
  light,
  maxWidth,
  motion,
  NIGHT_INHERITS,
  paneMaterial,
  resolve,
  screens,
  spacing,
  toChannels,
  transitionDuration,
  transitionTimingFunction,
  v4Alpha,
  zIndex,
  type ColorSet,
  type HomeGround,
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

/**
 * A home ground's colour set (`homeGrounds`) over `base`: the ground under everything and the panel raised on it, the
 * three inks and the hairline, each under the names the page's classes read (`text-ink`, `text-ink-2`, `bg-sunken`, …).
 */
function groundVars(tone: HomeGround, base: Record<string, string>): Record<string, string> {
  const g = homeGrounds[tone];
  return {
    ...base,
    "--mk-ground": toChannels(g.ground),
    "--mk-rule": toChannels(g.rule),
    "--ds-canvas": toChannels(g.ground),
    "--ds-surface": toChannels(g.ground),
    "--ds-sunken": toChannels(g.raised),
    "--ds-surface-sunken": toChannels(g.raised),
    "--ds-ink": toChannels(g.ink),
    "--ds-ink-strong": toChannels(g.ink),
    "--ds-ink-2": toChannels(g["ink-2"]),
    "--ds-ink-muted": toChannels(g["ink-2"]),
    "--ds-ink-3": toChannels(g["ink-3"]),
    "--ds-ink-subtle": toChannels(g["ink-3"]),
    "--ds-line": toChannels(g.line),
    "--ds-line-subtle": toChannels(g.line),
  };
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
  // A regex in lib/ledger/tsa.ts reads as an arbitrary property and became `-: T`, which Turbopack's CSS parser refuses.
  blocklist: ["[-:T]"],
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
        // Marketing (`motion` in the token file): a block rising into view, and a tab's content swapping.
        "mk-reveal": { from: { opacity: "0", transform: `translateY(${motion.risePx}px)`, filter: `blur(${motion.revealBlurPx}px)` }, to: { opacity: "1", transform: "none", filter: "blur(0)" } },
        "mk-swap-out": { from: { opacity: "1", filter: "blur(0)" }, to: { opacity: "0", filter: `blur(${motion.swapBlurPx}px)` } },
        "mk-click": { from: { opacity: "1", transform: "scale(0.4)" }, to: { opacity: "0", transform: "scale(1.4)" } },
        "mk-swap-in": { from: { opacity: "0", transform: `translateY(${motion.swapRisePx}px)` }, to: { opacity: "1", transform: "none" } },
        // The home's brands strip drifting left by one copy of its list.
        "mk-marquee": { from: { transform: "translateX(0)" }, to: { transform: "translateX(-50%)" } },
      },
      animation: {
        fade: `ds-fade ${transitionDuration.DEFAULT} ${transitionTimingFunction.out} both`,
        rise: `ds-rise ${transitionDuration.slow} ${transitionTimingFunction.out} both`,
        "sheet-in": `ds-sheet-in ${transitionDuration.slow} cubic-bezier(0.16, 1, 0.3, 1) both`,
        "scrim-in": `ds-scrim-in ${transitionDuration.DEFAULT} ${transitionTimingFunction.out} both`,
        pending: "ds-pending 1.1s ease-in-out infinite",
        reveal: `mk-reveal ${transitionDuration.reveal} ${transitionTimingFunction.reveal} both`,
        "swap-out": `mk-swap-out ${motion.swapOutMs}ms ${transitionTimingFunction.in} both`,
        click: `mk-click ${motion.clickMs}ms ${transitionTimingFunction.out} both`,
        "swap-in": `mk-swap-in ${motion.swapInMs}ms ${transitionTimingFunction.reveal} both`,
        marquee: `mk-marquee ${motion.marqueeMs}ms linear infinite`,
      },
    },
  },
  plugins: [
    plugin(({ addBase }) => {
      // The dark set is the same variables again, in two places: where the
      // system asks for dark and the page has opted in with `data-theme-auto`
      // (CSS only, so no flash and no script), and inside a night scene, which
      // is dark in either theme. Every page without the attribute stays light.
      // A night scene keeps the page's own brand fill (founder's video, 7 Oct 2026: the hero's button must be the
      // nav's button, the same green): those variables are not set there, so they inherit the theme's. The dark
      // theme itself sets every one, so in a dark page the nav, the hero and the close share the dark set's green.
      const darkSet = { ...colorVars(dark), ...paneMaterial.dark, "color-scheme": "dark" };
      const night = Object.fromEntries(Object.entries(darkSet).filter(([name]) => !NIGHT_INHERITS.includes(name)));
      addBase({
        // `--mk-ground-*`: the marketing site's two grounds, fixed in either scene; the night is mercury.com's since the
        // founder's walkthrough of 23 Oct 2026 (`homeGrounds.night`).
        ":root": { ...colorVars(light), ...paneMaterial.light, "--mk-ground-paper": toChannels(resolve(light, "canvas")), "--mk-ground-night": toChannels(homeGrounds.night.ground) },
        "@media (prefers-color-scheme: dark)": { ":root:has([data-theme-auto])": darkSet },
        '[data-ground="night"]': night,
        // A marketing section in the dark tone (components/site/motion.tsx, `PageMain`): the night set, its ground and
        // its ink, fixed, so nothing crossfades between paper and dark as the page scrolls (founder's video, 22 Oct 2026).
        '[data-tone="dark"]': { ...night, "background-color": "rgb(var(--mk-ground-night))", color: "rgb(var(--ds-ink))" },
        // The product's own pieces, staged in the film on a night ground: the app has no dark theme, so a window
        // of it is light in either theme and inside any night scene.
        '[data-ground="day"]': { ...colorVars(light), ...paneMaterial.light, "color-scheme": "light" },
        // The home page's three grounds (mercury.com's, `homeGrounds`). With no script each section stands on its own
        // (`data-mk-tone`); once `HomeMain` runs, the page takes the tone of the section at the window's middle
        // (`data-mk-page` on the root), the sections let it show through, and every colour fades to the next tone.
        ...Object.fromEntries(
          (Object.keys(homeGrounds) as HomeGround[]).flatMap((tone) => {
            const set = groundVars(tone, tone === "night" ? night : { ...colorVars(light), ...paneMaterial.light, "color-scheme": "light" });
            return [
              [`[data-mk-tone="${tone}"]:not([data-mk-page] *)`, { ...set, "background-color": "rgb(var(--mk-ground))", color: "rgb(var(--ds-ink))" }],
              // On the root without `color-scheme`, so the window's scrollbar does not flip as the page changes tone.
              [`[data-mk-page="${tone}"]`, Object.fromEntries(Object.entries(set).filter(([name]) => name !== "color-scheme"))],
            ];
          }),
        ),
        "[data-mk-page] body": { "background-color": "rgb(var(--mk-ground))", transition: `background-color ${motion.toneMs}ms ${transitionTimingFunction.out}` },
        // Zero specificity: an element with a transition of its own keeps it. Only where the tone shows: the page's
        // frame, the bar and the main (the footer and the cookie banner keep their own sets).
        ":where([data-mk-page] body > div, [data-mk-page] header *, [data-mk-page] main *)": { transition: `color ${motion.toneMs}ms, background-color ${motion.toneMs}ms, border-color ${motion.toneMs}ms, fill ${motion.toneMs}ms` },
      });
    }),
  ],
};

export default config;
