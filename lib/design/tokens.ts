// SourceBD design tokens — THE one token file.
//
// Every colour value in the product lives here and nowhere else
// (spec `ds-rebuild-must-stay.md` §2: "No hand-typed colours anywhere except
// one token file"). `tailwind.config.ts` turns these into CSS variables and
// Tailwind class names; the gallery at /dev/ds renders them; and
// `tokens.test.ts` fails `pnpm test` when a text pair drops below the
// contrast standard or when a colour is typed by hand in a design-system file.
//
// SourceBD v4 (B0, 4 Oct 2026): the values are Paper's, exported by
// `get_tokens` from the "SourceBD v4" file and listed in `v4` below under
// Paper's own names (`ink-3`, `brand-wash`, `cert-valid-fg`). Paper is the
// source and is used as it is (handoff-ds-v4-build.md §2).
//
// Until the switch, the old pages still compile against this file, so the
// v3 names they use are kept in `legacy`, and `light` is `legacy` with every
// v4 colour laid over it: where the two share a name (`ink`, `line.strong`,
// `brand.hover`, `danger`…) the v4 value wins. B11 deletes `legacy` with the
// last old page.

export type ColorGroup = Record<string, string>;
export type ColorSet = Record<string, ColorGroup>;

/**
 * Paper's colour tokens, under Paper's names (`--color-<name>`), plus the one
 * colour DESIGN-v4.md §2 adds in code (`danger-active`, the pressed danger
 * button). A name splits at its first dash into group and key: `ink-3` is
 * `light.ink["3"]`, class `text-ink-3`, variable `--ds-ink-3`; `subtle` is
 * `light.subtle.DEFAULT`, class `bg-subtle`.
 */
export const v4Colors = {
  // Neutrals.
  surface: "#FFFFFF",
  subtle: "#F7F8F9",
  sunken: "#EEF0F2",
  line: "#DDE0E4",
  "line-strong": "#858C96",
  disabled: "#9AA0A8", // disabled controls only; exempt from the contrast rule
  "ink-3": "#59606A",
  "ink-2": "#3B4149",
  ink: "#15181C",
  // Brand.
  brand: "#1B5E20",
  "brand-hover": "#154A19",
  "brand-active": "#0F3812",
  "brand-tint": "#E8F2E8",
  "brand-wash": "#F4F9F4",
  // Signals.
  caution: "#8A4A00",
  "caution-icon": "#B25E00",
  "caution-tint": "#FFF3DC",
  danger: "#A8231B",
  "danger-solid": "#B42318",
  "danger-active": "#861C16", // not a Paper token: the pressed danger button Paper draws as a bare hex
  "danger-tint": "#FDECEA",
  sanction: "#6E0B1C",
  "sanction-tint": "#F8E5E9",
  info: "#1C4F8F",
  "info-tint": "#E9F1FB",
} as const;

/** Paper's certificate aliases: each is another v4 colour by name, never a value of its own. */
export const v4CertAliases = {
  "cert-valid-fg": "ink-2",
  "cert-valid-edge": "line",
  "cert-expiring-fg": "caution",
  "cert-expiring-bg": "caution-tint",
  // Founder, 8 Oct 2026: a date that passed is caution, as DESIGN.md's Colors says; red is a failed read, a form error.
  "cert-expired-fg": "caution",
  "cert-expired-bg": "caution-tint",
  "cert-no-expiry-fg": "ink-3",
  "cert-no-expiry-edge": "line-strong",
} as const satisfies Record<string, keyof typeof v4Colors>;

/**
 * Paper's one colour with alpha: `--color-scrim: rgb(21 24 28 / 40%)`, which
 * is `ink` at Paper's `--opacity-scrim` 40%. Kept as that pair so every value
 * in `light` stays 6-digit hex; `bg-scrim` carries the 40% itself.
 */
export const v4Alpha = { scrim: { color: "ink", alpha: 0.4 } } as const;

/** `ink-3` → `["ink", "3"]`; `subtle` → `["subtle", "DEFAULT"]`. */
export function splitColorName(name: string): [group: string, key: string] {
  const i = name.indexOf("-");
  return i < 0 ? [name, "DEFAULT"] : [name.slice(0, i), name.slice(i + 1)];
}

/** `ink-3` → `ink.3`, the form `resolve()` and the contrast table take. */
export function v4Ref(name: string): string {
  const [group, key] = splitColorName(name);
  return key === "DEFAULT" ? group : `${group}.${key}`;
}

/** The old pages' names (v3). Delete with the last old page (B11). */
const legacy = {
  // Page and panel backgrounds. Canvas is true-neutral paper; brand green is
  // the only green in the UI.
  canvas: { DEFAULT: "#F7F7F6" },
  surface: {
    DEFAULT: "#FFFFFF",
    sunken: "#EEEEEC", // filter rails, table headers, code, the locked ground
    inverse: "#111411", // dark bands, toasts
    "inverse-raised": "#181C18", // a card on a dark band
  },

  // Text.
  ink: {
    strong: "#0F130F", // headings, company names, key numbers
    DEFAULT: "#262B26", // body
    muted: "#545C54", // secondary text, labels
    subtle: "#626B62", // captions, source marks — still passes on every background
    disabled: "#9AA39A", // disabled controls only; exempt from the contrast rule
    inverse: "#F2F4EE",
    "inverse-muted": "#A9B1A8",
    "inverse-subtle": "#8A938A",
  },

  // Borders and dividers.
  line: {
    subtle: "#E7E7E4",
    DEFAULT: "#D8D8D4",
    strong: "#79837A", // input and control outlines (3:1 against surface)
    "inverse-subtle": "#1F241F",
    inverse: "#2B302B",
  },

  // The dot-grid texture on marketing bands. Decoration, never a chart.
  grid: { dot: "#D2D2CE", "dot-inverse": "#2A2F2A" },

  // Brand green (fixed, founder decision 18 Sep 2026): primary action, logo,
  // active nav mark, link text. Never a state colour and never a badge fill,
  // so it cannot be read as "verified" (spec §9).
  brand: {
    DEFAULT: "#1B5E20",
    hover: "#17511B",
    active: "#113E15",
    on: "#FFFFFF",
    tint: "#E6F2E6",
    "tint-strong": "#CFE6D0",
    ink: "#1B5E20",
    "ink-inverse": "#8BE39A", // link text and the wordmark on a dark band
    line: "#A3CFA6",
  },
  focus: { DEFAULT: "#2E7D32" },

  // The buyer app's state role: selection, the active nav row, set filters,
  // links, tabs, focus and the ticked box. No hue of its own: the founder
  // dropped "B Slate" on 29 Sep 2026 ("use different shades of black and
  // white"), so state is depth on the ink and paper scale: a light grey for
  // selected, a darker grey for set, near-black for the mark. Green is kept for
  // the one primary action and the logo, so a selected row never reads as
  // "verified". Hover is `surface.sunken`, one step lighter than `tint`.
  accent: {
    DEFAULT: "#0F130F", // focus ring, active tab indicator, ticked box, the selected bar
    on: "#FFFFFF",
    ink: "#0F130F", // link text (underlined: `.link`), selected label
    tint: "#E9E9E6", // selected row, active nav row (an ink-subtle caption on it passes 4.5:1)
    "tint-strong": "#DADAD6", // set filter, active chip
  },

  // The one decorative flourish: the live dot, the arrow disc. Always
  // icon-sized, always beside a word. Never body text, never a status.
  signal: {
    DEFAULT: "#3FE374",
    on: "#0F130F",
    deep: "#12903F", // as a line or stroke on a light ground
  },

  // The wash stops (marketing hero and foot). Background only.
  meadow: { "100": "#F1FAE8", "200": "#DAF6C6", "300": "#B7F0A4", "400": "#8CE88C" },

  // Verified fact · valid certificate. A teal-green, chosen to sit apart from forest.
  positive: {
    DEFAULT: "#0B7A5C",
    on: "#FFFFFF",
    ink: "#075C45",
    tint: "#E1F4EC",
    line: "#9EDCC6",
  },

  // Contradicted fact · expired or expiring certificate.
  caution: {
    DEFAULT: "#A65A05",
    on: "#FFFFFF",
    ink: "#7A4300",
    tint: "#FDF3DE",
    line: "#F3C77E",
  },

  // System and form errors. NOT sanctions — see below.
  danger: {
    DEFAULT: "#D92D20",
    on: "#FFFFFF",
    ink: "#B42318",
    tint: "#FDF2F0",
    line: "#FDA29B",
  },

  // Sanctioned supplier. Reserved: nothing else in the product may use these,
  // so the warning can never be mistaken for an ordinary error.
  sanction: {
    DEFAULT: "#8F1711",
    on: "#FFFFFF",
    ink: "#8F1711",
    tint: "#FAE6E3",
    line: "#8F1711",
  },

  // Locked (needs plan or login). A real state with its own plain surface —
  // never a blur over real data. The stripes went (founder's video, 29 Sep
  // 2026: they read as decoration, not as a state).
  locked: {
    DEFAULT: "#EEEEEC",
    ink: "#545C54",
    line: "#C1C7B9",
  },

  // Unverified fact · empty state. Deliberately quiet: no proof is not a warning.
  quiet: {
    DEFAULT: "#F7F7F6",
    ink: "#545C54",
    line: "#C1C7B9",
  },

  // AI-assisted surfaces only (the Ask stop, "why matched", drafts), always
  // with the V2 tag. The one hue that is neither brand nor status; never on a fact.
  smart: {
    DEFAULT: "#6B3FA0",
    tint: "#F1E8FA",
    line: "#D6C2EE",
  },

  // Loading skeleton.
  skeleton: { DEFAULT: "#E7E7E4", shine: "#F7F7F6" },

  // Source trust rank. A neutral lightness ramp on the ink scale, darkest =
  // most trusted, so the order reads at a glance, survives colour-blindness,
  // and leaves colour free for status (spec §9: near-monochrome shell).
  tier: {
    "1": "#0F130F",
    "1-on": "#FFFFFF",
    "2": "#262B26",
    "2-on": "#FFFFFF",
    "3": "#545C54",
    "3-on": "#FFFFFF",
    "4": "#DDE0D5",
    "4-on": "#0F130F",
    "5": "#FFFFFF",
    "5-on": "#262B26",
    "5-line": "#79837A",
  },
} satisfies ColorSet;

/**
 * The home film's additions (handoff-home-film §3.1, 6 Oct 2026), in Paper's
 * tokens too. `brand-ink` is green as TEXT: v4's `brand` is a fill and a text
 * colour at once, and the fill fails as text on a dark ground. The `map-*`
 * colours paint our own cartography: land, water (the one quiet blue-grey the
 * film allows) and the light a supplier cell gives off.
 */
export const filmColors = {
  "brand-ink": "#1B5E20",
  "map-land": "#ECEEF1",
  "map-water": "#DCE4EC",
  "map-light": "#15181C",
} as const;

/**
 * The dark values, under the same names. A fill that carries `text-surface`
 * (the primary and the danger button) turns light here, so its label, which
 * turns dark with `surface`, still reads.
 */
export const darkColors: Record<keyof typeof v4Colors | keyof typeof filmColors, string> = {
  surface: "#101214",
  subtle: "#16191C",
  sunken: "#1D2125",
  line: "#2A2F35",
  "line-strong": "#6F7780",
  disabled: "#5C636C",
  "ink-3": "#9AA1AA",
  "ink-2": "#C5CAD0",
  ink: "#F2F4F6",
  brand: "#6FCF7F",
  "brand-hover": "#86DA94",
  "brand-active": "#5ABD6B",
  "brand-tint": "#14251A",
  "brand-wash": "#111B14",
  caution: "#F2B866",
  "caution-icon": "#E9A23B",
  "caution-tint": "#2C210E",
  danger: "#FF9A90",
  "danger-solid": "#F2776B",
  "danger-active": "#E0665B",
  "danger-tint": "#2E1614",
  sanction: "#FFB3C0",
  "sanction-tint": "#2F0F17",
  info: "#8FBDF5",
  "info-tint": "#111E30",
  "brand-ink": "#7BD389",
  "map-land": "#1B1F24",
  "map-water": "#0C1116",
  "map-light": "#FFF1D6",
};

function overlay<T extends ColorSet>(base: T, colors: Record<string, string>, scrim: string): T {
  const out: ColorSet = Object.fromEntries(Object.entries(base).map(([g, keys]) => [g, { ...keys }]));
  const all: Record<string, string> = { ...colors };
  for (const [alias, target] of Object.entries(v4CertAliases)) all[alias] = colors[target]!;
  all.scrim = scrim;
  for (const [name, hex] of Object.entries(all)) {
    const [group, key] = splitColorName(name);
    (out[group] ??= {})[key] = hex;
  }
  return out as T;
}

/** Every colour the product may use: `legacy` with the v4 set and the film's additions laid over it. */
export const light = overlay(legacy, { ...v4Colors, ...filmColors }, v4Colors[v4Alpha.scrim.color]);

/**
 * The old pages' neutral, brand and state-role names, pointed at the dark
 * values, so the chrome a dark page shares (the focus ring, the selection, a
 * placeholder, a kit button) follows. The old status groups (`positive`,
 * `tier`, `meadow`, `smart`…) keep their light values: no dark page draws
 * them, and they go with the last old page (B11).
 */
function darkLegacy(): typeof legacy {
  const d = darkColors;
  const out: ColorSet = Object.fromEntries(Object.entries(legacy).map(([g, keys]) => [g, { ...keys }]));
  const set = (group: string, keys: Record<string, string>) => Object.assign((out[group] ??= {}), keys);
  set("canvas", { DEFAULT: d.surface });
  set("surface", { sunken: d.sunken, inverse: d.ink, "inverse-raised": v4Colors.surface });
  set("ink", { strong: d.ink, muted: d["ink-2"], subtle: d["ink-3"], disabled: d.disabled, inverse: v4Colors.ink, "inverse-muted": v4Colors["ink-2"], "inverse-subtle": v4Colors["ink-3"] });
  set("line", { subtle: d.line, "inverse-subtle": v4Colors.line, inverse: v4Colors["line-strong"] });
  set("grid", { dot: d.line, "dot-inverse": v4Colors.line });
  set("brand", { on: d.surface, "tint-strong": d["brand-tint"], "ink-inverse": v4Colors.brand, line: d["brand-active"] });
  set("focus", { DEFAULT: d["brand-ink"] });
  set("accent", { DEFAULT: d.ink, on: d.surface, ink: d.ink, tint: d.sunken, "tint-strong": d.line });
  set("locked", { DEFAULT: d.sunken, ink: d["ink-2"], line: d["line-strong"] });
  set("quiet", { DEFAULT: d.subtle, ink: d["ink-2"], line: d["line-strong"] });
  set("skeleton", { DEFAULT: d.sunken, shine: d.line });
  return out as typeof legacy;
}

/**
 * The dark set: a value for every name in `light`. `tailwind.config.ts` emits
 * it where the system asks for dark AND the page carries `data-theme-auto`
 * (the home page first; every other page stays light until its own spec opts
 * in), and inside any `data-ground="night"` scene in either theme.
 */
export const dark: typeof light = overlay(darkLegacy(), darkColors, "#000000");

/**
 * The variables a night scene does not set, so they come from the page's theme: the primary button's fill and
 * its label. A night scene in a light page draws the nav's own forest green with a white label (founder's video,
 * 7 Oct 2026: "the colour is different"); in a dark page both are the dark set's.
 */
export const NIGHT_INHERITS: readonly string[] = ["--ds-brand", "--ds-brand-hover", "--ds-brand-active", "--ds-brand-on"];

export type TierRank = 1 | 2 | 3 | 4 | 5;

/** The five buyer-visible source tiers, in rank order (spec §2). */
export const tiers: ReadonlyArray<{ rank: TierRank; label: string }> = [
  { rank: 1, label: "Government" },
  { rank: 2, label: "Industry bodies" },
  { rank: 3, label: "Certification bodies" },
  { rank: 4, label: "Brand lists" },
  { rank: 5, label: "Foreign regulators" },
];

// ---------------------------------------------------------------------------
// Non-colour tokens
// ---------------------------------------------------------------------------

/**
 * Two faces (artifact v3): Geist for everything, Geist Mono for the ledger's
 * stamps — eyebrows, source marks, register and certificate numbers, HS codes.
 * Both are self-hosted variable fonts loaded once in `app/layout.tsx`; the
 * Tailwind stacks read the CSS variables they set. Numbers use tabular figures.
 */
export const fontFamily = {
  sans: [
    "var(--font-sans)",
    "ui-sans-serif",
    "system-ui",
    "-apple-system",
    "Segoe UI",
    "Roboto",
    "sans-serif",
  ],
  mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
};

type FontSize = [string, { lineHeight?: string; letterSpacing?: string }];

/**
 * Paper's type scale (`--text-*` with `--text-*-line-height`; Paper dropped the
 * second dash Tailwind 4 pairs them by, restored here as one entry each).
 * These REPLACE Tailwind's defaults: Tailwind's `text-sm` is 14px, Paper's 13.
 * The display sizes carry no line height in Paper; a board that sets one says
 * so with `leading-[…]`. Nothing is scaled per shell: Paper draws the desktop
 * and phone boards with their own sizes, so each width uses its board's class.
 *
 * The keys after the v4 ones are the old pages' (v3). Delete in B11.
 */
export const fontSize: Record<string, FontSize> = {
  xs: ["12px", { lineHeight: "16px" }], // labels, column heads, source lines
  sm: ["13px", { lineHeight: "18px" }], // fact values in chips, mono codes, captions
  base: ["14px", { lineHeight: "20px" }], // cells, controls, body
  md: ["16px", { lineHeight: "24px" }], // prose, phone body, phone rows
  lg: ["20px", { lineHeight: "28px" }], // section titles
  xl: ["24px", { lineHeight: "32px" }], // page title, the record's name in the pane
  "2xl": ["32px", { lineHeight: "40px" }], // the record's name on the full page
  "3xl": ["40px", { lineHeight: "48px" }], // site only
  "display-1": ["72px", {}], // marketing only, from here down
  "display-2": ["56px", {}],
  "display-3": ["40px", {}],
  // The home film only (handoff-home-film §3.2), desktop then phone.
  "film-hero": ["104px", { lineHeight: "1.02" }],
  "film-hero-phone": ["44px", { lineHeight: "1.04" }],
  "film-figure": ["200px", { lineHeight: "0.9" }],
  "film-figure-phone": ["96px", { lineHeight: "0.9" }],
  "film-scene": ["64px", { lineHeight: "1.06" }],
  "film-scene-phone": ["32px", { lineHeight: "1.06" }],
  // legacy (v3)
  eyebrow: ["0.6875rem", { lineHeight: "1rem", letterSpacing: "0.08em" }],
  title: ["0.9375rem", { lineHeight: "1.375rem", letterSpacing: "-0.005em" }],
  "page-title": ["1.125rem", { lineHeight: "1.625rem", letterSpacing: "-0.01em" }],
  "nav-label": ["0.6875rem", { lineHeight: "0.875rem" }],
  "4xl": ["2.25rem", { lineHeight: "2.625rem", letterSpacing: "-0.025em" }],
  "5xl": ["2.75rem", { lineHeight: "3rem", letterSpacing: "-0.03em" }],
  "6xl": ["3rem", { lineHeight: "3.375rem", letterSpacing: "-0.03em" }],
  "7xl": ["4.25rem", { lineHeight: "4.5rem", letterSpacing: "-0.035em" }],
};

/** Paper's `--tracking-*`. Tailwind's own `tight` is -0.025em; Paper's is -0.01em. */
export const letterSpacing = {
  tight: "-0.01em",
  tighter: "-0.02em",
};

/** Paper's `regular|medium|semibold`; `normal`, `light` and `bold` are the old pages' (v3). */
export const fontWeight = {
  regular: "400",
  light: "300", // marketing display only
  normal: "400",
  medium: "500", // labels, links, app headings and company names (Geist at 600 reads heavy)
  semibold: "600",
  bold: "700",
};

/** Paper's radii: sm controls and chips, md tables and source-mark frames, lg panels, dialogs, cards. `none`, `xs`, `DEFAULT` and `xl` are the old pages' (v3). */
export const borderRadius = {
  none: "0",
  sm: "4px",
  md: "6px",
  lg: "8px",
  full: "9999px",
  pane: "20px", // the film's Pane; `pane-phone` below 640
  "pane-phone": "16px",
  // legacy (v3)
  xs: "0.1875rem",
  DEFAULT: "0.375rem",
  xl: "1.25rem",
};

/**
 * Shadows carry a colour, so they live here too. Paper has no shadow tokens;
 * `menu` and `dialog` are the two DESIGN-v4.md §2 names (menus; dialogs, the
 * docked pane and phone sheets), tinted with v4 `ink` (21 24 28). The rest are
 * the old pages' (v3), tinted with `ink.strong`.
 */
export const boxShadow = {
  none: "none",
  menu: "0 4px 12px rgb(21 24 28 / 0.12)",
  dialog: "0 12px 32px rgb(21 24 28 / 0.18)",
  xs: "0 1px 2px 0 rgb(15 19 15 / 0.06)",
  sm: "0 1px 3px 0 rgb(15 19 15 / 0.08), 0 1px 2px -1px rgb(15 19 15 / 0.05)",
  md: "0 6px 14px -4px rgb(15 19 15 / 0.12), 0 2px 4px -2px rgb(15 19 15 / 0.06)",
  lg: "0 16px 32px -8px rgb(15 19 15 / 0.16), 0 4px 8px -4px rgb(15 19 15 / 0.06)",
  // The soft edge of a secondary button and a segmented control: the `line`
  // token (v4's value) at 70 %, inset, so a tone button reads as a control on canvas too
  // without adding a hairline.
  edge: "inset 0 0 0 1px rgb(221 224 228 / 0.7)",
  bloom: "0 0 0 4px rgb(63 227 116 / 0.28)", // the signal dot's glow (artifact `shadow-signal`; named apart from the colour group so the utilities cannot collide)
  glass: "inset 0 1px 0 rgb(255 255 255 / 0.7), 0 1px 3px rgb(15 19 15 / 0.08)",
};

/**
 * The Pane's two materials (handoff-home-film §3.3), per theme, as the CSS
 * variables `.pane` reads in `app/ds.css`. Glass is a tint of the ground over
 * a backdrop blur, a lit edge, a top highlight and a long soft shadow; solid
 * is the surface with a hairline and the same shadow. The tint is as thin as
 * body text allows: `paneBehind` names the brightest and the darkest thing
 * that may pass behind a pane, and `tokens.test.ts` holds every text colour to
 * 4.5:1 on the tint laid over both.
 */
const WHITE = "255 255 255";

/** How much of the ground the glass keeps (`tint`) and the white laid over it (`sheen`), per theme. */
export const paneGlass = { light: { tint: 0.68, sheen: 0 }, dark: { tint: 0.7, sheen: 0.06 } } as const;

export const paneMaterial = {
  light: {
    "--pane-tint": String(paneGlass.light.tint),
    "--pane-sheen": `rgb(${WHITE} / ${paneGlass.light.sheen})`,
    "--pane-filter": "blur(24px) saturate(150%)",
    "--pane-edge": `rgb(${WHITE} / 0.6)`,
    "--pane-hairline": "rgb(21 24 28 / 0.06)",
    "--pane-highlight": `rgb(${WHITE} / 0.8)`,
    "--pane-shadow": "0 24px 60px -20px rgb(21 24 28 / 0.22)",
    "--pane-mark": "none", // the one-colour source marks are drawn dark
  },
  dark: {
    "--pane-tint": String(paneGlass.dark.tint),
    "--pane-sheen": `rgb(${WHITE} / ${paneGlass.dark.sheen})`,
    "--pane-filter": "blur(28px) saturate(130%)",
    "--pane-edge": `rgb(${WHITE} / 0.14)`,
    "--pane-hairline": "rgb(0 0 0 / 0.4)",
    "--pane-highlight": `rgb(${WHITE} / 0.1)`,
    "--pane-shadow": "0 30px 80px -24px rgb(0 0 0 / 0.6)",
    "--pane-mark": "invert(1)",
  },
} as const;

/** What may pass behind a glass pane, per theme: the film keeps every backdrop inside these two. */
export const paneBehind = {
  light: { brightest: "#FFFFFF", darkest: "#858C96" },
  dark: { brightest: "#5B626B", darkest: "#000000" },
} as const;

/** The pane's ground as text sees it: the tint, then the white sheen, over what is behind. */
export function paneGround(theme: "light" | "dark", behind: string): string {
  const { tint, sheen } = paneGlass[theme];
  const s = toRgb(resolve(theme === "light" ? light : dark, "surface"));
  const mixed = toRgb(behind).map((b, i) => Math.round(255 * sheen + (s[i]! * tint + b * (1 - tint)) * (1 - sheen)));
  return `#${mixed.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

export const transitionDuration = {
  fast: "120ms",
  DEFAULT: "200ms",
  slow: "320ms",
  reveal: "640ms",
};

export const transitionTimingFunction = {
  DEFAULT: "cubic-bezier(0.2, 0, 0, 1)",
  in: "cubic-bezier(0.4, 0, 1, 1)",
  out: "cubic-bezier(0, 0, 0.2, 1)",
};

export const zIndex = {
  base: "0",
  raised: "10",
  sticky: "100",
  overlay: "200",
  modal: "300",
  toast: "400",
};

/**
 * Paper's `--container-*`, as width, min-width and max-width utilities
 * (`w-pane`, `max-w-prose`): the boards size panes and dialogs with `w-`.
 */
export const containers = {
  sidebar: "224px",
  details: "344px",
  // The filter panel laid over the results at 1280 and over (`Filters panel open` board, 360
  // wide). Paper draws it at that width without a container of its own; this names it.
  panel: "360px",
  dialog: "480px",
  prose: "544px",
  pane: "640px",
};

export const maxWidth = {
  ...containers, // Paper's `prose` (544px) replaces Tailwind's 65ch
  content: "75rem", // 1200 (v3)
};

/**
 * Paper's named spacing (`--spacing-*`), as spacing utilities: `h-touch`,
 * `min-h-row`, `py-row-head`. The numbered steps are Tailwind's own 4px scale,
 * which Paper's `--spacing: 4px` matches.
 */
export const spacing = {
  "control-sm": "24px",
  control: "32px",
  "row-head": "36px",
  row: "40px",
  "control-lg": "40px",
  touch: "44px",
  "input-touch": "48px",
  "row-tall": "56px",
  topbar: "56px",
  tabbar: "56px",
  "action-bar": "64px",
};

/** Paper's breakpoints. They REPLACE Tailwind's (whose `2xl` is 1536). */
export const screens = {
  xs: "320px",
  sm: "640px",
  md: "768px",
  lg: "1024px",
  xl: "1280px",
  "2xl": "1440px",
};

/**
 * Density (spec §9 / artifact). Fixed heights and paddings the rebuilt pieces
 * share, in px, so a table row, a card and a control line up from one page to
 * the next. Tailwind spacing stays on the default 4px grid; these are the
 * named stops, exposed as `h-control`, `w-sidebar`, `min-h-fact-row`, ….
 */
export const density = {
  tableRow: 36, // admin and directory rows, 13px text
  tableRowRelaxed: 44, // buyer-facing lists
  control: 32, // inputs, filters, secondary buttons
  controlLarge: 40, // primary buttons, marketing forms
  cardPadding: 16, // supplier card
  panelPadding: 20, // profile sections
  gutter: 24, // page side padding at ≥1024px; 16 below
  sidebar: 232, // app shell nav width
  topbar: 56, // the sticky bar
  factRow: 28, // label/value row in the facts panel
  // On a phone (D10): what a finger has to hit, and the bars and rows built for it.
  tabbar: 56, // the bottom tab bar, above the safe area
  topbarPhone: 52, // the app's top bar
  target: 44, // the smallest thing a finger must hit (Apple 44pt, Material 48dp)
  barButton: 48, // a button in a sticky bar
  chipTouch: 32, // a chip
  sheetHead: 56, // a bottom sheet's header
  sheetRow: 52, // a bottom sheet's row
  rowPhone: 72, // a two-line result row
};

/** The old pages' density stops as size utilities (`h-row-dense`, `min-h-fact-row`, …). `w-sidebar` is Paper's container now (224). */
export const densitySizes: Record<string, string> = {
  "row-dense": `${density.tableRow}px`,
  "row-relaxed": `${density.tableRowRelaxed}px`,
  control: `${density.control}px`,
  "control-lg": `${density.controlLarge}px`,
  topbar: `${density.topbar}px`,
  "fact-row": `${density.factRow}px`,
  tabbar: `${density.tabbar}px`,
  "topbar-phone": `${density.topbarPhone}px`,
  target: `${density.target}px`,
  "bar-button": `${density.barButton}px`,
  "chip-touch": `${density.chipTouch}px`,
  "sheet-head": `${density.sheetHead}px`,
  "sheet-row": `${density.sheetRow}px`,
  "row-phone": `${density.rowPhone}px`,
};

// ---------------------------------------------------------------------------
// Helpers (used by tailwind.config.ts, the gallery and the tests)
// ---------------------------------------------------------------------------

/** `ink` + `muted` → `--ds-ink-muted`; `ink` + `DEFAULT` → `--ds-ink`. */
export function cssVarName(group: string, key: string): string {
  return key === "DEFAULT" ? `--ds-${group}` : `--ds-${group}-${key}`;
}

/** `#1E3AA3` → `30 58 163`, the form Tailwind needs for `bg-brand/50`. */
export function toChannels(hex: string): string {
  const [r, g, b] = toRgb(hex);
  return `${r} ${g} ${b}`;
}

export function toRgb(hex: string): [number, number, number] {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m || !m[1]) throw new Error(`Token colour must be 6-digit hex, got "${hex}"`);
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function luminance(hex: string): number {
  const [r, g, b] = toRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.x contrast ratio between two token colours. */
export function contrastRatio(fg: string, bg: string): number {
  const a = luminance(fg);
  const b = luminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** Look up `"ink.muted"` or `"canvas"` in a colour set. */
export function resolve(set: ColorSet, ref: string): string {
  const [group, key = "DEFAULT"] = ref.split(".");
  const value = group ? set[group]?.[key] : undefined;
  if (!value) throw new Error(`Unknown colour token "${ref}"`);
  return value;
}

export type ContrastPair = { fg: string; bg: string; min: number; use: string };

const TEXT = 4.5; // WCAG AA, normal text
const UI = 3; // WCAG AA, control outlines and large text

const BACKGROUNDS = ["canvas", "surface", "surface.sunken", "locked", "quiet"];

/**
 * Every text/background pair the system allows. If a pair is not listed here
 * it has not been checked — add it before using it. Spec §6: "Contrast check
 * on every text colour pair."
 */
export const contrastPairs: ContrastPair[] = [
  ...BACKGROUNDS.flatMap((bg) =>
    ["ink.strong", "ink", "ink.muted", "ink.subtle", "brand.ink"].map((fg) => ({
      fg,
      bg,
      min: TEXT,
      use: "text",
    })),
  ),
  { fg: "ink.inverse", bg: "surface.inverse", min: TEXT, use: "text on dark panel" },
  { fg: "ink.inverse-muted", bg: "surface.inverse", min: TEXT, use: "muted text on dark panel" },
  { fg: "ink.inverse-subtle", bg: "surface.inverse", min: TEXT, use: "caption on dark panel" },
  { fg: "ink.inverse", bg: "surface.inverse-raised", min: TEXT, use: "text on a raised dark card" },
  { fg: "brand.ink-inverse", bg: "surface.inverse", min: TEXT, use: "link on dark panel" },
  { fg: "brand.on", bg: "brand", min: TEXT, use: "primary button" },
  { fg: "ink", bg: "line", min: TEXT, use: "secondary button, hover" },
  { fg: "ink.strong", bg: "line", min: TEXT, use: "secondary button, hover" },
  { fg: "danger.on", bg: "danger", min: TEXT, use: "danger button, hover; error, solid" },
  { fg: "brand.on", bg: "brand.hover", min: TEXT, use: "primary button, hover" },
  { fg: "brand.on", bg: "brand.active", min: TEXT, use: "primary button, pressed" },
  { fg: "brand.ink", bg: "brand.tint", min: TEXT, use: "info note, active nav" },
  { fg: "brand.ink", bg: "brand.tint-strong", min: TEXT, use: "selected row, active chip" },
  { fg: "accent.on", bg: "accent", min: TEXT, use: "ticked box" },
  { fg: "accent.ink", bg: "accent.tint", min: TEXT, use: "selected row, active nav" },
  { fg: "accent.ink", bg: "accent.tint-strong", min: TEXT, use: "set filter, active chip" },
  { fg: "accent.ink", bg: "surface", min: TEXT, use: "link" },
  { fg: "accent.ink", bg: "canvas", min: TEXT, use: "link on the canvas" },
  { fg: "ink.strong", bg: "accent.tint-strong", min: TEXT, use: "name on a set filter" },
  { fg: "ink.subtle", bg: "accent.tint", min: TEXT, use: "a caption in a selected row" },
  { fg: "ink.muted", bg: "accent.tint-strong", min: TEXT, use: "a count on the current tab" },
  { fg: "accent", bg: "surface", min: UI, use: "focus ring, tab indicator, the selected bar" },
  { fg: "accent", bg: "canvas", min: UI, use: "focus ring on the canvas" },
  { fg: "accent", bg: "locked", min: UI, use: "focus ring on the locked card" },
  { fg: "signal.on", bg: "signal", min: TEXT, use: "icon on the signal disc" },
  { fg: "positive.on", bg: "positive", min: TEXT, use: "verified, solid" },
  { fg: "positive.ink", bg: "positive.tint", min: TEXT, use: "verified / valid" },
  { fg: "caution.on", bg: "caution", min: TEXT, use: "contradicted, solid" },
  { fg: "caution.ink", bg: "caution.tint", min: TEXT, use: "contradicted / expired" },
  { fg: "caution.ink", bg: "surface", min: TEXT, use: "missing-field note" },
  { fg: "caution.ink", bg: "canvas", min: TEXT, use: "missing-field note on the rail" },
  { fg: "danger.ink", bg: "danger.tint", min: TEXT, use: "error message" },
  { fg: "danger.ink", bg: "surface", min: TEXT, use: "field error text" },
  { fg: "sanction.on", bg: "sanction", min: 7, use: "sanction banner (held to AAA)" },
  { fg: "sanction.ink", bg: "sanction.tint", min: 7, use: "sanction note (held to AAA)" },
  { fg: "sanction.ink", bg: "surface", min: 7, use: "sanction line on a card (held to AAA)" },
  { fg: "locked.ink", bg: "locked", min: TEXT, use: "locked field" },
  { fg: "quiet.ink", bg: "quiet", min: TEXT, use: "unverified / empty" },
  { fg: "quiet.ink", bg: "surface", min: TEXT, use: "empty value in a tile" },
  { fg: "smart", bg: "smart.tint", min: TEXT, use: "V2 tag" },
  { fg: "smart", bg: "surface", min: TEXT, use: "why-matched line" },
  { fg: "smart", bg: "canvas", min: TEXT, use: "V2 step on the composer rail" },
  { fg: "tier.1-on", bg: "tier.1", min: TEXT, use: "tier 1 mark" },
  { fg: "tier.2-on", bg: "tier.2", min: TEXT, use: "tier 2 mark" },
  { fg: "tier.3-on", bg: "tier.3", min: TEXT, use: "tier 3 mark" },
  { fg: "tier.4-on", bg: "tier.4", min: TEXT, use: "tier 4 mark" },
  { fg: "tier.5-on", bg: "tier.5", min: TEXT, use: "tier 5 mark" },
  { fg: "line.strong", bg: "surface", min: UI, use: "input outline" },
  { fg: "focus", bg: "surface", min: UI, use: "focus ring" },
  { fg: "focus", bg: "canvas", min: UI, use: "focus ring" },
  { fg: "sanction.line", bg: "surface", min: UI, use: "sanction outline" },
  { fg: "tier.5-line", bg: "surface", min: UI, use: "tier 5 outline" },
  { fg: "signal.deep", bg: "surface", min: UI, use: "signal as a stroke" },
  ...v4Pairs(),
];

/** The film's own pairs, held in both themes. The light on the land is a mark, not text. */
export const filmPairs: ContrastPair[] = [
  ...["surface", "subtle", "sunken", "brand.tint", "brand.wash"].map((bg) => ({ fg: "brand.ink", bg, min: TEXT, use: "film: green text, the thread's label" })),
  { fg: "brand.ink", bg: "surface", min: UI, use: "film: the thread, the rail's dot" },
  { fg: "map.light", bg: "map.land", min: UI, use: "film: a supplier light on the land" },
  { fg: "map.light", bg: "map.water", min: UI, use: "film: a supplier light by the coast" },
  { fg: "ink.3", bg: "map.land", min: TEXT, use: "film: a caption on the map" },
];

/** Every pair the dark set is held to: Paper's v4 pairs again, and the film's. */
export const darkPairs: ContrastPair[] = [...v4Pairs(), ...filmPairs];

/**
 * The v4 pairs Paper draws (B0), written with Paper's names. Text is held to
 * 4.5:1, the caution icon and the no-expiry certificate edge (UI marks) to
 * 3:1, the sanction red to AAA as before. `disabled` is exempt, as `ink.disabled`.
 */
function v4Pairs(): ContrastPair[] {
  const p = (fg: string, bg: string, min: number, use: string): ContrastPair => ({ fg: v4Ref(fg), bg: v4Ref(bg), min, use: `v4: ${use}` });
  return [
    ...["subtle", "sunken"].map((bg) => p("ink", bg, TEXT, "text")),
    ...["surface", "subtle", "sunken"].flatMap((bg) => [p("ink-2", bg, TEXT, "secondary text"), p("ink-3", bg, TEXT, "labels, captions")]),
    p("ink-3", "brand-wash", TEXT, "a caption on the selected row"),
    ...["surface", "subtle", "brand-tint", "brand-wash"].map((bg) => p("brand", bg, TEXT, "link, active nav")),
    ...["brand", "brand-hover", "brand-active"].map((bg) => p("surface", bg, TEXT, "primary button")),
    ...["danger-solid", "danger-active"].map((bg) => p("surface", bg, TEXT, "danger button")),
    p("caution", "caution-tint", TEXT, "expiring, caution note"),
    p("caution", "surface", TEXT, "caution line"),
    p("caution-icon", "caution-tint", UI, "caution icon"),
    p("caution-icon", "surface", UI, "caution icon"),
    p("danger", "danger-tint", TEXT, "error note"),
    p("danger", "surface", TEXT, "field error"),
    p("sanction", "sanction-tint", 7, "sanction note (held to AAA)"),
    p("sanction", "surface", 7, "sanction line (held to AAA)"),
    p("surface", "sanction", 7, "sanction banner (held to AAA)"),
    p("info", "info-tint", TEXT, "info note"),
    p("info", "surface", TEXT, "info line"),
    p("cert-valid-fg", "surface", TEXT, "valid certificate"),
    p("cert-expiring-fg", "cert-expiring-bg", TEXT, "expiring certificate"),
    p("cert-expired-fg", "cert-expired-bg", TEXT, "expired certificate"),
    p("cert-no-expiry-fg", "surface", TEXT, "certificate with no expiry"),
    p("cert-no-expiry-edge", "surface", UI, "no-expiry certificate edge"),
  ];
}
