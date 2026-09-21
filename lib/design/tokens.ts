// SourceBD design tokens — THE one token file.
//
// Every colour value in the product lives here and nowhere else
// (spec `ds-rebuild-must-stay.md` §2: "No hand-typed colours anywhere except
// one token file"). `tailwind.config.ts` turns these into CSS variables and
// Tailwind class names; the gallery at /dev/ds renders them; and
// `tokens.test.ts` fails `pnpm test` when a text pair drops below the
// contrast standard or when a colour is typed by hand in a design-system file.
//
// Values are the Design System artifact's v3 token set (project/tokens.json,
// light theme), which the approved v3.2 dashboard screens were rendered with
// (founder decision 19 Sep 2026: the code port follows the artifact tokens).
// Colours are named by ROLE, never by hue, so the artifact's dark set can be
// added later by adding a second map with the same keys — no component changes.
//
// Alpha tokens in the artifact (`surface-glass`, `signal-glow`, `highlight`)
// are not listed: every value here is 6-digit hex. The frosted panel is the
// `.glass` utility in app/ds.css (surface at 80 % + blur), the signal glow is
// the `bloom` shadow below, and a highlight box is `bg-signal/[0.16]`.

export type ColorGroup = Record<string, string>;
export type ColorSet = Record<string, ColorGroup>;

export const light = {
  // Page and panel backgrounds. Canvas is warm paper with a green cast — the
  // ledger's page.
  canvas: { DEFAULT: "#F6F7F2" },
  surface: {
    DEFAULT: "#FFFFFF",
    sunken: "#ECEEE7", // filter rails, table headers, code, the locked ground
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
    subtle: "#E6E8DF",
    DEFAULT: "#D5D9CC",
    strong: "#79837A", // input and control outlines (3:1 against surface)
    "inverse-subtle": "#1F241F",
    inverse: "#2B302B",
  },

  // The dot-grid texture on marketing bands. Decoration, never a chart.
  grid: { dot: "#CFD4C6", "dot-inverse": "#2A2F2A" },

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

  // Locked (needs plan or login). A real state with its own surface and
  // stripe pattern — never a blur over real data.
  locked: {
    DEFAULT: "#ECEEE7",
    stripe: "#DDE0D5",
    ink: "#545C54",
    line: "#C1C7B9",
  },

  // Unverified fact · empty state. Deliberately quiet: no proof is not a warning.
  quiet: {
    DEFAULT: "#F6F7F2",
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
  skeleton: { DEFAULT: "#E6E8DF", shine: "#F6F7F2" },

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

type FontSize = [string, { lineHeight: string; letterSpacing?: string }];

/**
 * The artifact's type styles, on Tailwind's size names so `cn()` /
 * tailwind-merge keeps working, plus the named styles the dashboard uses
 * (`text-title`, `text-eyebrow`) that have no standard slot.
 */
export const fontSize: Record<string, FontSize> = {
  eyebrow: ["0.6875rem", { lineHeight: "1rem", letterSpacing: "0.08em" }], // 11 — mono, uppercase
  xs: ["0.75rem", { lineHeight: "1rem" }], // 12 — caption
  sm: ["0.8125rem", { lineHeight: "1.25rem" }], // 13 — label, table, code
  base: ["0.875rem", { lineHeight: "1.375rem" }], // 14 — body
  title: ["0.9375rem", { lineHeight: "1.375rem", letterSpacing: "-0.005em" }], // 15 — card title, tab
  lg: ["1.0625rem", { lineHeight: "1.6875rem", letterSpacing: "-0.005em" }], // 17 — body-lg
  xl: ["1.125rem", { lineHeight: "1.625rem", letterSpacing: "-0.01em" }], // 18 — heading-sm
  "2xl": ["1.375rem", { lineHeight: "1.875rem", letterSpacing: "-0.015em" }], // 22 — heading
  "3xl": ["1.75rem", { lineHeight: "2.25rem", letterSpacing: "-0.02em" }], // 28 — heading-lg
  "4xl": ["2.25rem", { lineHeight: "2.625rem", letterSpacing: "-0.025em" }], // 36 — display
  "5xl": ["2.75rem", { lineHeight: "3rem", letterSpacing: "-0.03em" }], // 44 — stat
  "6xl": ["3rem", { lineHeight: "3.375rem", letterSpacing: "-0.03em" }], // 48 — display-lg
  "7xl": ["4.25rem", { lineHeight: "4.5rem", letterSpacing: "-0.035em" }], // 68 — display-xl
};

export const fontWeight = {
  light: "300", // marketing display only
  normal: "400",
  medium: "500", // labels, links, app headings and company names (Geist at 600 reads heavy)
  semibold: "600",
  bold: "700",
};

/** Artifact v3 radii: xs skeleton bars and 16px marks · sm controls, badges, marks, chips · md cards, inputs, panels · lg dialogs · xl marketing frames. */
export const borderRadius = {
  none: "0",
  xs: "0.1875rem", // 3
  sm: "0.375rem", // 6
  DEFAULT: "0.375rem", // 6
  md: "0.625rem", // 10
  lg: "0.875rem", // 14
  xl: "1.25rem", // 20
  full: "9999px",
};

/** Shadows carry a colour, so they live here too. Tinted with `ink.strong`. */
export const boxShadow = {
  none: "none",
  xs: "0 1px 2px 0 rgb(15 19 15 / 0.06)",
  sm: "0 1px 3px 0 rgb(15 19 15 / 0.08), 0 1px 2px -1px rgb(15 19 15 / 0.05)",
  md: "0 6px 14px -4px rgb(15 19 15 / 0.12), 0 2px 4px -2px rgb(15 19 15 / 0.06)",
  lg: "0 16px 32px -8px rgb(15 19 15 / 0.16), 0 4px 8px -4px rgb(15 19 15 / 0.06)",
  bloom: "0 0 0 4px rgb(63 227 116 / 0.28)", // the signal dot's glow (artifact `shadow-signal`; named apart from the colour group so the utilities cannot collide)
  glass: "inset 0 1px 0 rgb(255 255 255 / 0.7), 0 1px 3px rgb(15 19 15 / 0.08)",
};

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

export const maxWidth = {
  prose: "68ch",
  content: "75rem", // 1200
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
};

/** The density stops as Tailwind size utilities (`h-control`, `w-sidebar`, …). */
export const densitySizes: Record<string, string> = {
  "row-dense": `${density.tableRow}px`,
  "row-relaxed": `${density.tableRowRelaxed}px`,
  control: `${density.control}px`,
  "control-lg": `${density.controlLarge}px`,
  sidebar: `${density.sidebar}px`,
  topbar: `${density.topbar}px`,
  "fact-row": `${density.factRow}px`,
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
  { fg: "brand.on", bg: "brand.hover", min: TEXT, use: "primary button, hover" },
  { fg: "brand.on", bg: "brand.active", min: TEXT, use: "primary button, pressed" },
  { fg: "brand.ink", bg: "brand.tint", min: TEXT, use: "info note, active nav" },
  { fg: "brand.ink", bg: "brand.tint-strong", min: TEXT, use: "selected row, active chip" },
  { fg: "signal.on", bg: "signal", min: TEXT, use: "icon on the signal disc" },
  { fg: "positive.on", bg: "positive", min: TEXT, use: "verified, solid" },
  { fg: "positive.ink", bg: "positive.tint", min: TEXT, use: "verified / valid" },
  { fg: "caution.on", bg: "caution", min: TEXT, use: "contradicted, solid" },
  { fg: "caution.ink", bg: "caution.tint", min: TEXT, use: "contradicted / expired" },
  { fg: "caution.ink", bg: "surface", min: TEXT, use: "missing-field note" },
  { fg: "caution.ink", bg: "canvas", min: TEXT, use: "missing-field note on the rail" },
  { fg: "danger.on", bg: "danger", min: TEXT, use: "error, solid" },
  { fg: "danger.ink", bg: "danger.tint", min: TEXT, use: "error message" },
  { fg: "danger.ink", bg: "surface", min: TEXT, use: "field error text" },
  { fg: "sanction.on", bg: "sanction", min: 7, use: "sanction banner (held to AAA)" },
  { fg: "sanction.ink", bg: "sanction.tint", min: 7, use: "sanction note (held to AAA)" },
  { fg: "sanction.ink", bg: "surface", min: 7, use: "sanction line on a card (held to AAA)" },
  { fg: "locked.ink", bg: "locked", min: TEXT, use: "locked field" },
  { fg: "locked.ink", bg: "locked.stripe", min: TEXT, use: "locked field, on the stripe" },
  { fg: "ink.strong", bg: "locked.stripe", min: TEXT, use: "locked card label, on the stripe" },
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
];
