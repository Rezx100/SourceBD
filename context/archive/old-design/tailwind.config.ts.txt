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
        "sem-emerald": "var(--sem-emerald)",
        "sem-emerald-soft": "var(--sem-emerald-soft)",
        // Categorical tier badges (Bronze/Silver/Gold/Platinum — admin only)
        "tier-bronze": "var(--tier-bronze)",
        "tier-silver": "var(--tier-silver)",
        "tier-gold": "var(--tier-gold)",
        "tier-platinum": "var(--tier-platinum)",
        // Hairlines
        hairline: "var(--hairline)",
        "hairline-strong": "var(--hairline-strong)",
        // shadcn/ui semantic colors
        border: "var(--border)",
        ring: "var(--ring)",
        background: "var(--background)",
        foreground: "var(--foreground)",
      },
      fontFamily: {
        brand: ["var(--font-brand)"],
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
      fontSize: {
        caption: ["var(--text-caption)", { lineHeight: "1.35" }],
        meta: ["var(--text-meta)", { lineHeight: "1.4" }],
        "body-sm": ["var(--text-body-sm)", { lineHeight: "1.5" }],
        body: ["var(--text-body)", { lineHeight: "1.6" }],
        "body-lg": ["var(--text-body-lg)", { lineHeight: "1.55" }],
        "title-sm": ["var(--text-title-sm)", { lineHeight: "1.3" }],
        title: ["var(--text-title)", { lineHeight: "1.25" }],
        "title-lg": ["var(--text-title-lg)", { lineHeight: "1.2" }],
        display: ["var(--text-display)", { lineHeight: "1.15" }],
      },
      animation: {
        marquee: "marquee var(--duration, 40s) infinite linear",
        "marquee-vertical": "marquee-vertical var(--duration, 40s) linear infinite",
        "shimmer-slide": "shimmer-slide var(--speed, 2s) ease-in-out infinite alternate",
        "spin-around": "spin-around calc(var(--speed, 2s) * 2) infinite linear",
        "border-beam": "border-beam calc(var(--duration, 4s) * 1s) infinite linear",
        orbit: "orbit calc(var(--duration, 20s) * 1s) linear infinite",
      },
      keyframes: {
        marquee: {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(calc(-100% - var(--gap, 1rem)))" },
        },
        "marquee-vertical": {
          from: { transform: "translateY(0)" },
          to: { transform: "translateY(calc(-100% - var(--gap, 1rem)))" },
        },
        "shimmer-slide": {
          to: { transform: "translate(calc(100cqw - 100%), 0)" },
        },
        "spin-around": {
          "0%": { transform: "translateZ(0) rotate(0)" },
          "15%, 35%": { transform: "translateZ(0) rotate(90deg)" },
          "65%, 85%": { transform: "translateZ(0) rotate(270deg)" },
          "100%": { transform: "translateZ(0) rotate(360deg)" },
        },
        "border-beam": {
          "100%": { "offset-distance": "100%" },
        },
        orbit: {
          "0%": {
            transform:
              "rotate(calc(var(--angle) * 1deg)) translateY(calc(var(--radius) * 1px)) rotate(calc(var(--angle) * -1deg))",
          },
          "100%": {
            transform:
              "rotate(calc(var(--angle) * 1deg + 360deg)) translateY(calc(var(--radius) * 1px)) rotate(calc((var(--angle) * -1deg) - 360deg))",
          },
        },
      },
    },
  },
  plugins: [],
};

export default config;
