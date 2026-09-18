import type { Config } from "tailwindcss";
import plugin from "tailwindcss/plugin";
import {
  borderRadius,
  boxShadow,
  cssVarName,
  fontFamily,
  fontSize,
  fontWeight,
  light,
  maxWidth,
  toChannels,
  transitionDuration,
  transitionTimingFunction,
  zIndex,
  type ColorSet,
} from "./lib/design/tokens";

// Design-system rebuild (spec `ds-rebuild-must-stay.md`). This file holds no
// values of its own: everything comes from `lib/design/tokens.ts`.
//
// `theme.colors` REPLACES Tailwind's palette rather than extending it, so the
// stock white / neutral / red / blue classes no longer exist. The only colour
// classes are the role names in the token file.

/** `{ ink: { muted: "#…" } }` → `{ ink: { muted: "rgb(var(--ds-ink-muted) / <alpha-value>)" } }` */
function colorClasses(set: ColorSet) {
  return Object.fromEntries(
    Object.entries(set).map(([group, keys]) => [
      group,
      Object.fromEntries(
        Object.keys(keys).map((key) => [
          key,
          `rgb(var(${cssVarName(group, key)}) / <alpha-value>)`,
        ]),
      ),
    ]),
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
    },
    fontFamily,
    fontSize,
    fontWeight,
    borderRadius,
    boxShadow,
    transitionDuration,
    transitionTimingFunction,
    zIndex,
    extend: {
      maxWidth,
      ringColor: { DEFAULT: "rgb(var(--ds-focus) / <alpha-value>)" },
      borderColor: { DEFAULT: "rgb(var(--ds-line) / <alpha-value>)" },
    },
  },
  plugins: [
    plugin(({ addBase }) => {
      // A dark set, when it comes, is a second block here keyed on `.dark`.
      addBase({ ":root": colorVars(light) });
    }),
  ],
};

export default config;
