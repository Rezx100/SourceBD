// SourceBD design tokens — THE one token file.
//
// Every colour value in the product lives here and nowhere else
// (spec `ds-rebuild-must-stay.md` §2: "No hand-typed colours anywhere except
// one token file"). `tailwind.config.ts` turns these into CSS variables and
// Tailwind class names; the gallery at /dev/ds renders them; and
// `tokens.test.ts` fails `pnpm test` when a text pair drops below the
// contrast standard or when a colour is typed by hand in a design-system file.
//
// Colours are named by ROLE, never by hue, so a dark set can be added later
// (founder decision 18 Sep 2026: dark mode "later") by adding a second map
// with the same keys — no component changes.

export type ColorGroup = Record<string, string>;
export type ColorSet = Record<string, ColorGroup>;

export const light = {
  // Page and panel backgrounds.
  canvas: { DEFAULT: "#F6F7F9" },
  surface: {
    DEFAULT: "#FFFFFF",
    sunken: "#EEF1F4",
    inverse: "#12171D",
  },

  // Text.
  ink: {
    strong: "#12171D", // headings, company names, key numbers
    DEFAULT: "#2A323B", // body
    muted: "#4A5561", // secondary text, labels
    subtle: "#5F6B78", // captions, source marks — still passes on every background
    disabled: "#8D99A6", // disabled controls only; exempt from the contrast rule
    inverse: "#FFFFFF",
    "inverse-muted": "#C3CBD4",
  },

  // Borders and dividers.
  line: {
    subtle: "#E6EAEE",
    DEFAULT: "#D5DBE2",
    strong: "#7F8B98", // input and control outlines (3:1 against surface)
  },

  // Brand green (fixed, founder decision 18 Sep 2026): primary action, logo,
  // active nav mark, link text. Never a state colour and never a badge fill,
  // so it cannot be read as "verified" (spec §9).
  brand: {
    DEFAULT: "#1B5E20",
    hover: "#164D1A",
    active: "#103A13",
    on: "#FFFFFF",
    tint: "#E9F3EA",
    "tint-strong": "#D3E7D5",
    ink: "#1B5E20",
    line: "#A7CFAB",
  },
  focus: { DEFAULT: "#2E7D32" },

  // Verified fact · valid certificate.
  positive: {
    DEFAULT: "#0F7A45",
    on: "#FFFFFF",
    ink: "#0B5F36",
    tint: "#E7F6EC",
    line: "#A6DDB9",
  },

  // Contradicted fact · expired or expiring certificate.
  caution: {
    DEFAULT: "#A85604",
    on: "#FFFFFF",
    ink: "#7A4300",
    tint: "#FFF4E0",
    line: "#F5C982",
  },

  // System and form errors. NOT sanctions — see below.
  danger: {
    DEFAULT: "#D92D20",
    on: "#FFFFFF",
    ink: "#B42318",
    tint: "#FEF3F2",
    line: "#FDA29B",
  },

  // Sanctioned supplier. Reserved: nothing else in the product may use these,
  // so the warning can never be mistaken for an ordinary error.
  sanction: {
    DEFAULT: "#8F1711",
    on: "#FFFFFF",
    ink: "#8F1711",
    tint: "#FDE8E6",
    line: "#8F1711",
  },

  // Locked (needs plan or login). A real state with its own surface and
  // stripe pattern — never a blur over real data.
  locked: {
    DEFAULT: "#EEF1F4",
    stripe: "#DDE3E9",
    ink: "#4A5561",
    line: "#BCC5CF",
  },

  // Unverified fact · empty state. Deliberately quiet: no proof is not a warning.
  quiet: {
    DEFAULT: "#F6F7F9",
    ink: "#4A5561",
    line: "#BCC5CF",
  },

  // Loading skeleton.
  skeleton: { DEFAULT: "#E6EAEE", shine: "#F6F7F9" },

  // Source trust rank. A neutral lightness ramp on the ink scale, darkest =
  // most trusted, so the order reads at a glance, survives colour-blindness,
  // and leaves colour free for status (spec §9: near-monochrome shell).
  tier: {
    "1": "#12171D",
    "1-on": "#FFFFFF",
    "2": "#2A323B",
    "2-on": "#FFFFFF",
    "3": "#4A5561",
    "3-on": "#FFFFFF",
    "4": "#DDE3E9",
    "4-on": "#12171D",
    "5": "#FFFFFF",
    "5-on": "#2A323B",
    "5-line": "#7F8B98",
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

/** One family, Inter (founder decision 18 Sep 2026, §7 Q2). Numbers use its tabular figures. */
export const fontFamily = {
  sans: [
    "var(--font-sans)",
    "ui-sans-serif",
    "system-ui",
    "-apple-system",
    "Segoe UI",
    "Roboto",
    "Helvetica Neue",
    "Arial",
    "sans-serif",
  ],
  mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
};

type FontSize = [string, { lineHeight: string; letterSpacing?: string }];

/** Standard Tailwind size names on purpose, so `cn()` / tailwind-merge keeps working. */
export const fontSize: Record<string, FontSize> = {
  xs: ["0.75rem", { lineHeight: "1rem" }], // 12 — captions, source marks
  sm: ["0.8125rem", { lineHeight: "1.25rem" }], // 13 — table cells, labels
  base: ["0.875rem", { lineHeight: "1.375rem" }], // 14 — app body
  lg: ["1rem", { lineHeight: "1.625rem" }], // 16 — marketing body
  xl: ["1.125rem", { lineHeight: "1.75rem" }], // 18
  "2xl": ["1.25rem", { lineHeight: "1.75rem", letterSpacing: "-0.005em" }], // 20
  "3xl": ["1.5rem", { lineHeight: "2rem", letterSpacing: "-0.01em" }], // 24
  "4xl": ["1.875rem", { lineHeight: "2.375rem", letterSpacing: "-0.015em" }], // 30
  "5xl": ["2.25rem", { lineHeight: "2.75rem", letterSpacing: "-0.02em" }], // 36
  "6xl": ["3rem", { lineHeight: "3.5rem", letterSpacing: "-0.025em" }], // 48
  "7xl": ["3.75rem", { lineHeight: "4rem", letterSpacing: "-0.03em" }], // 60
};

export const fontWeight = {
  normal: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
};

export const borderRadius = {
  none: "0",
  sm: "0.1875rem", // 3
  DEFAULT: "0.3125rem", // 5
  md: "0.375rem", // 6
  lg: "0.5rem", // 8
  xl: "0.75rem", // 12
  full: "9999px",
};

/** Shadows carry a colour, so they live here too. Tinted with `ink.strong`. */
export const boxShadow = {
  none: "none",
  xs: "0 1px 2px 0 rgb(18 23 29 / 0.06)",
  sm: "0 1px 3px 0 rgb(18 23 29 / 0.10), 0 1px 2px -1px rgb(18 23 29 / 0.06)",
  md: "0 4px 8px -2px rgb(18 23 29 / 0.10), 0 2px 4px -2px rgb(18 23 29 / 0.06)",
  lg: "0 12px 24px -6px rgb(18 23 29 / 0.14), 0 4px 8px -4px rgb(18 23 29 / 0.06)",
};

export const transitionDuration = {
  fast: "120ms",
  DEFAULT: "200ms",
  slow: "320ms",
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
 * Density (spec §9). Fixed heights and paddings the rebuilt pieces share, in
 * px, so a table row, a card and a control line up from one page to the next.
 * Tailwind spacing stays on the default 4px grid; these are the named stops.
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
  factRow: 28, // label/value row in the facts panel
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

const BACKGROUNDS = ["canvas", "surface", "surface.sunken"];

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
  { fg: "brand.on", bg: "brand", min: TEXT, use: "primary button" },
  { fg: "brand.on", bg: "brand.hover", min: TEXT, use: "primary button, hover" },
  { fg: "brand.on", bg: "brand.active", min: TEXT, use: "primary button, pressed" },
  { fg: "brand.ink", bg: "brand.tint", min: TEXT, use: "info note" },
  { fg: "brand.ink", bg: "brand.tint-strong", min: TEXT, use: "selected row" },
  { fg: "positive.on", bg: "positive", min: TEXT, use: "verified, solid" },
  { fg: "positive.ink", bg: "positive.tint", min: TEXT, use: "verified / valid" },
  { fg: "caution.on", bg: "caution", min: TEXT, use: "contradicted, solid" },
  { fg: "caution.ink", bg: "caution.tint", min: TEXT, use: "contradicted / expired" },
  { fg: "danger.on", bg: "danger", min: TEXT, use: "error, solid" },
  { fg: "danger.ink", bg: "danger.tint", min: TEXT, use: "error message" },
  { fg: "danger.ink", bg: "surface", min: TEXT, use: "field error text" },
  { fg: "sanction.on", bg: "sanction", min: 7, use: "sanction banner (held to AAA)" },
  { fg: "sanction.ink", bg: "sanction.tint", min: 7, use: "sanction note (held to AAA)" },
  { fg: "locked.ink", bg: "locked", min: TEXT, use: "locked field" },
  { fg: "locked.ink", bg: "locked.stripe", min: TEXT, use: "locked field, on the stripe" },
  { fg: "quiet.ink", bg: "quiet", min: TEXT, use: "unverified / empty" },
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
];
