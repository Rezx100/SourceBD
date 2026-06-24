---
name: magicui
description: >-
  Add animated React UI components for landing pages and marketing sites with Magic UI.
  Use when: adding animated UI components, building impressive landing pages, creating
  particle effects, text animations, number counters, shimmer buttons, and visual
  effects in React. Tailwind CSS based and shadcn/ui compatible.
  SourceBD specifics: Magic UI is the APPROVED component lib for new visual/layout
  components per frontend-design-spec.md §1. Always combine with Archivo (display),
  Hanken Grotesk (body), IBM Plex Mono (data labels) and Phosphor Icons. Never use
  shadcn primitives for layout/visual — use Magic UI. Motion must honour
  prefers-reduced-motion (settle to final state). Never animate fabricated data.
  Scope: (marketing) route group + auth shell; buyer/supplier/admin app surfaces use
  CSS + IntersectionObserver islands unless a future spec extends this.
license: Apache-2.0
compatibility: "Requires React 18+, Tailwind CSS 3+, Node.js 18+"
metadata:
  author: terminal-skills (adapted for SourceBD)
  version: "1.0.0"
  category: design
  tags: ["magicui", "react", "animations", "ui-components", "tailwind"]
  use-cases:
    - "Add a particle/confetti effect to a landing page hero section"
    - "Create an animated number counter for displaying stats (e.g. 10,121 verified suppliers)"
    - "Build a shimmer button with gradient animation for CTAs"
    - "Add a scrolling marquee for logos or testimonials"
    - "Create sparkle text for highlighting key phrases"
  agents: [claude-code, openai-codex, gemini-cli, cursor]
---

# Magic UI — SourceBD Integration Guide

## Overview

Magic UI is a collection of animated React components built on Tailwind CSS and shadcn/ui.
Components are installed via CLI directly into your project — you own the source code and
can customize freely.

**Per `frontend-design-spec.md` §1 (Stack locked by architecture.md):**
- Magic UI = approved for **new visual/layout components**
- shadcn/ui (Radix) = for **controls / dialogs / forms**
- Motion scope = `(marketing)` route group + auth shell ONLY
- All animation must honour `prefers-reduced-motion`
- Never animate fabricated/placeholder data

**Key traits:**
- CLI-based install (no runtime package dependency)
- Tailwind CSS + CSS variables for theming
- shadcn/ui compatible
- TypeScript first

## SourceBD Design Tokens (from frontend-design-spec.md)

| Token | Value |
|-------|-------|
| Display font | Archivo |
| Body font | Hanken Grotesk |
| Mono font | IBM Plex Mono |
| Icons | Phosphor Icons (`@phosphor-icons/react`) |
| Mode | Light only (no dark mode in v1) |

Always combine Magic UI components with these tokens. Never introduce new fonts or icon sets.

## Setup

### Prerequisites

```bash
# Must have Tailwind CSS configured
# Must have shadcn/ui initialized (cn utility required)
npx shadcn@latest init
```

### Install a component

```bash
npx magicui-cli add <component-name>
```

This copies the component source into `components/magicui/`.

## Component Catalog & Examples

### 1. AnimatedBeam — connecting lines between elements

```bash
npx magicui-cli add animated-beam
```

```tsx
import { AnimatedBeam } from "@/components/magicui/animated-beam";
import { useRef } from "react";

export function BeamDemo() {
  const containerRef = useRef<HTMLDivElement>(null);
  const fromRef = useRef<HTMLDivElement>(null);
  const toRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={containerRef} className="relative flex h-64 items-center justify-between p-10">
      <div ref={fromRef} className="h-12 w-12 rounded-full bg-blue-500" />
      <div ref={toRef} className="h-12 w-12 rounded-full bg-purple-500" />
      <AnimatedBeam containerRef={containerRef} fromRef={fromRef} toRef={toRef} />
    </div>
  );
}
```

### 2. Marquee — infinite scrolling ticker

```bash
npx magicui-cli add marquee
```

```tsx
import Marquee from "@/components/magicui/marquee";

const logos = ["BGMEA", "BKMEA", "RSC", "OEKO-TEX", "GOTS", "WRAP"];

export function RegistryMarquee() {
  return (
    <Marquee pauseOnHover className="[--duration:20s]">
      {logos.map((name) => (
        <div key={name} className="mx-8 font-mono text-sm text-muted-foreground">
          {name}
        </div>
      ))}
    </Marquee>
  );
}
```

### 3. NumberTicker — animated counting up

```bash
npx magicui-cli add number-ticker
```

```tsx
import NumberTicker from "@/components/magicui/number-ticker";

// Use for real data only — never fabricated numbers
export function SupplierCount({ count }: { count: number }) {
  return (
    <div className="text-center">
      <NumberTicker value={count} className="text-5xl font-bold font-display" />
      <p className="font-body text-muted-foreground">verified suppliers</p>
    </div>
  );
}
```

### 4. BlurIn — text fade-in with blur

```bash
npx magicui-cli add blur-in
```

```tsx
import BlurIn from "@/components/magicui/blur-in";

export function HeroHeading() {
  return (
    <BlurIn
      word="Verified Bangladesh RMG Suppliers"
      className="text-5xl font-bold font-display tracking-tight"
      duration={1.2}
    />
  );
}
```

### 5. Ripple — pulsing circle effect

```bash
npx magicui-cli add ripple
```

```tsx
import { Ripple } from "@/components/magicui/ripple";

export function HeroBackground() {
  return (
    <div className="relative flex h-96 items-center justify-center overflow-hidden bg-background">
      <Ripple mainCircleSize={200} numCircles={8} />
      <p className="z-10 text-4xl font-bold font-display">Receipts, Not Opinions</p>
    </div>
  );
}
```

### 6. Globe — 3D interactive globe

```bash
npx magicui-cli add globe
```

```tsx
import Globe from "@/components/magicui/globe";

export function GlobalSection() {
  return (
    <div className="flex flex-col items-center">
      <h2 className="text-3xl font-bold font-display">Bangladesh → Global Buyers</h2>
      <Globe className="h-[500px] w-[500px]" />
    </div>
  );
}
```

### 7. BorderBeam — animated border glow

```bash
npx magicui-cli add border-beam
```

```tsx
import { BorderBeam } from "@/components/magicui/border-beam";

export function HighlightCard() {
  return (
    <div className="relative overflow-hidden rounded-xl border bg-background p-6">
      <BorderBeam size={250} duration={8} />
      <h3 className="font-display font-semibold">10,121 Published Suppliers</h3>
      <p className="font-body text-muted-foreground">Every one with ≥1 Tier 1–3 verified source</p>
    </div>
  );
}
```

### 8. Meteors — falling meteor streaks background

```bash
npx magicui-cli add meteors
```

```tsx
import { Meteors } from "@/components/magicui/meteors";

export function HeroCard() {
  return (
    <div className="relative overflow-hidden rounded-2xl border bg-background p-8">
      <Meteors number={20} />
      <h2 className="relative z-10 text-3xl font-bold font-display">SourceBD</h2>
      <p className="relative z-10 mt-2 text-muted-foreground font-body">
        B2B intelligence for Bangladesh RMG
      </p>
    </div>
  );
}
```

### 9. SparklesText — glittering highlight text

```bash
npx magicui-cli add sparkles-text
```

```tsx
import SparklesText from "@/components/magicui/sparkles-text";

export function HeroHeading() {
  return (
    <h1 className="text-6xl font-bold font-display">
      Source Bangladesh{" "}
      <SparklesText text="with confidence" />
    </h1>
  );
}
```

### 10. MagicCard — hover gradient card

```bash
npx magicui-cli add magic-card
```

```tsx
import { MagicCard } from "@/components/magicui/magic-card";

export function FeatureCard({ title, description }: { title: string; description: string }) {
  return (
    <MagicCard className="rounded-xl border p-6" gradientColor="#e2e8f0">
      <h3 className="font-display font-semibold">{title}</h3>
      <p className="font-body text-muted-foreground mt-2">{description}</p>
    </MagicCard>
  );
}
```

## Full SourceBD Marketing Landing Pattern

```tsx
// app/(marketing)/page.tsx — hero section with Magic UI
import BlurIn from "@/components/magicui/blur-in";
import { Ripple } from "@/components/magicui/ripple";
import Marquee from "@/components/magicui/marquee";
import NumberTicker from "@/components/magicui/number-ticker";
import { BorderBeam } from "@/components/magicui/border-beam";

// Real data only — never fabricated
const SUPPLIER_COUNT = 10121;
const DOC_COUNT = 7049;

const registries = ["BGMEA", "BKMEA", "BTMA", "BGAPMEA", "RSC", "EPB"];
const certBodies = ["GOTS", "OEKO-TEX", "WRAP", "SA8000"];

export default function LandingPage() {
  return (
    <main>
      {/* Hero */}
      <section className="relative flex min-h-screen flex-col items-center justify-center text-center px-4">
        <Ripple mainCircleSize={300} numCircles={6} />
        <BlurIn
          word="Verified Bangladesh RMG Suppliers"
          className="z-10 text-6xl font-bold font-display tracking-tight"
        />
        <p className="z-10 mt-4 text-xl text-muted-foreground font-body max-w-2xl">
          Source-linked compliance evidence on every Bangladesh factory — receipts, not opinions.
        </p>
      </section>

      {/* Stats — real numbers only */}
      <section className="py-20 text-center">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-12 max-w-4xl mx-auto">
          <div>
            <NumberTicker value={SUPPLIER_COUNT} className="text-4xl font-bold font-display" />
            <p className="font-body text-muted-foreground">Verified Suppliers</p>
          </div>
          <div>
            <NumberTicker value={DOC_COUNT} className="text-4xl font-bold font-display" />
            <p className="font-body text-muted-foreground">Mirrored Compliance Docs</p>
          </div>
        </div>
      </section>

      {/* Registry marquee */}
      <section className="py-12 border-t border-b">
        <Marquee className="[--duration:30s]">
          {[...registries, ...certBodies].map((name) => (
            <span key={name} className="mx-12 font-mono text-sm text-muted-foreground">
              {name}
            </span>
          ))}
        </Marquee>
      </section>
    </main>
  );
}
```

## Available Components (full list)

```bash
# Run to see all available components
npx magicui-cli list
```

Popular ones: `animated-beam`, `animated-gradient-text`, `animated-grid-pattern`, `animated-list`,
`animated-shiny-text`, `aurora-text`, `blur-in`, `blur-fade`, `border-beam`,
`confetti`, `cool-mode`, `dock`, `dot-pattern`, `file-tree`, `flip-text`,
`globe`, `grid-pattern`, `hyper-text`, `interactive-hover-button`, `letter-pullup`,
`magic-card`, `marquee`, `meteors`, `morphing-text`, `neon-gradient-card`,
`number-ticker`, `orbiting-circles`, `particles`, `pointer`, `pulsating-button`,
`rainbow-button`, `retro-grid`, `ripple`, `safari`, `scroll-based-velocity`,
`shimmer-button`, `shine-border`, `shiny-button`, `sparkles-text`,
`spinning-text`, `terminal`, `text-reveal`, `ticker`, `typing-animation`,
`vanish-input`, `wavy-text`, `word-fade-in`, `word-pull-up`, `word-rotate`

## SourceBD Constraint Checklist

Before shipping any Magic UI component:

- [ ] `prefers-reduced-motion` honoured — animation settles to final state, does not loop forever
- [ ] Only real data animated — no fabricated numbers, no placeholder counts
- [ ] No SBI numeric, pillar values, or the string "SBI" / "Score" / "Rating" anywhere
- [ ] Fonts: Archivo (display), Hanken Grotesk (body), IBM Plex Mono (mono/data)
- [ ] Icons: Phosphor only — no other icon set introduced
- [ ] Scope: marketing `(marketing)` + auth shell only; do NOT drop Magic UI components into `/app/*`, `/supplier/*`, `/admin/*` without a spec extension
- [ ] Light mode only — no dark-mode toggling in v1

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `cn` not found | Install `clsx` + `tailwind-merge` and add `lib/utils.ts` |
| Animation not working | Check `tailwind.config.ts` has CSS vars defined |
| Component not found | Run `npx magicui-cli@latest add <name>` (use `@latest`) |
| Peer dep warnings | Magic UI needs React 18+ and Tailwind 3+ |
| Motion leaks into app shell | Check import is inside `(marketing)` or auth only |
