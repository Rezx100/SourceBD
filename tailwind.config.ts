import type { Config } from "tailwindcss";

// Tokens ported from prototypes/_tokens.css and locked by
// context/design-brief-phase1.md §21 (forest-green brand, indigo as
// interaction-only, L0–L3 elevation, 6/8/12/20 radii family, font triad,
// motion tokens per §19.2's 12-motion budget).

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      screens: {
        // Spec R1: extra-small phone breakpoint (iPhone SE 1st gen, small
        // Androids). `sm` (640) was previously the smallest target which
        // left ~320–639 unaddressed; the R-series mobile-first work
        // explicitly targets 320 / 360 / 390 / 414 / 430 etc.
        xs: "360px",
      },
      colors: {
        // Surfaces (§16.3)
        "bg-l0": "var(--bg-l0)",
        "surface-l1": "var(--surface-l1)",
        "surface-l2": "var(--surface-l2)",
        // Ink
        "ink-primary": "var(--ink-primary)",
        "ink-secondary": "var(--ink-secondary)",
        "ink-tertiary": "var(--ink-tertiary)",
        "ink-on-accent": "var(--ink-on-accent)",
        // Brand — forest (§21.1)
        "brand-forest": "var(--brand-forest)",
        "brand-forest-mid": "var(--brand-forest-mid)",
        "brand-forest-soft": "var(--brand-forest-soft)",
        "brand-forest-tint": "var(--brand-forest-tint)",
        // Interaction-only accent (§21.1)
        "accent-indigo": "var(--accent-indigo)",
        "accent-teal": "var(--accent-teal)",
        // Semantic states
        "sem-red": "var(--sem-red)",
        "sem-red-soft": "var(--sem-red-soft)",
        "sem-amber": "var(--sem-amber)",
        "sem-amber-soft": "var(--sem-amber-soft)",
        "sem-green": "var(--sem-green)",
        "sem-green-soft": "var(--sem-green-soft)",
        // Categorical tier badges (Bronze/Silver/Gold/Platinum — admin only)
        "tier-bronze": "var(--tier-bronze)",
        "tier-silver": "var(--tier-silver)",
        "tier-gold": "var(--tier-gold)",
        "tier-platinum": "var(--tier-platinum)",
        // Hairlines
        hairline: "var(--hairline)",
        "hairline-strong": "var(--hairline-strong)",
      },
      fontFamily: {
        display: ["var(--font-display)"],
        body: ["var(--font-body)"],
        mono: ["var(--font-mono)"],
      },
      borderRadius: {
        // 6/8/12/20 radii family (§16.3)
        input: "var(--r-input)", // 6
        pill: "var(--r-pill)", // 8
        card: "var(--r-card)", // 12
        hero: "var(--r-hero)", // 20
      },
      boxShadow: {
        // L0–L3 elevation
        l1: "var(--shadow-l1)",
        l2: "var(--shadow-l2)",
      },
      backgroundImage: {
        "brand-grad": "var(--accent-grad)",
      },
      transitionTimingFunction: {
        // Motion tokens (§19)
        smooth: "var(--ease)",
      },
      transitionDuration: {
        hover: "var(--dur-hover)", // 120ms
        tab: "var(--dur-tab)", // 160ms
        press: "var(--dur-press)", // 80ms
      },
      letterSpacing: {
        tightish: "-0.005em",
      },
    },
  },
  plugins: [],
};

export default config;
