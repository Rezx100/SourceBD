# SourceBD Frontend Design System

## UI/UX Standard: Magic UI + Light Mode Only

All UI and UX work MUST use [Magic UI](https://magicui.design) as the primary component library.

### Rules

1. **Magic UI first** — Use Magic UI components (`components/ui/` from magicui) for all animations, layouts, cards, grids, buttons, and decorative elements.
2. **Light mode only** — No dark mode. Use `bg-white`, `bg-neutral-50`, `border-neutral-200`, `text-neutral-900/800/700/500` palette.
3. **No old design system** — Do not use the legacy forest-green/indigo token system for new UI. Existing pages will be migrated incrementally.
4. **shadcn/ui for primitives** — Use shadcn/ui (already installed) for form controls, dialogs, dropdowns, etc. Style them in light mode.
5. **motion/react for animation** — Magic UI uses `motion/react` (already installed). No other animation libraries.
6. **Tailwind CSS** — All styling via Tailwind utility classes. No custom CSS unless absolutely necessary.

### Installed Magic UI Components

Located in `components/ui/`:
- `animated-grid-pattern.tsx` — Animated background grids
- `number-ticker.tsx` — Animated number counters
- `marquee.tsx` — Infinite scroll marquees
- `border-beam.tsx` — Animated border beams
- `blur-fade.tsx` — Blur + fade reveal animations
- `shimmer-button.tsx` — Shimmer effect buttons
- `dot-pattern.tsx` — Dot pattern backgrounds
- `magic-card.tsx` — Cards with mouse-follow gradient
- `animated-list.tsx` — Staggered list animations
- `retro-grid.tsx` — Retro perspective grids
- `text-reveal.tsx` — Text reveal on scroll
- `bento-grid.tsx` — Bento grid layouts

### Adding New Magic UI Components

```bash
pnpm dlx magicui-cli@latest add <component-name>
```

### Typography

- Headings: Archivo (font-display)
- Body: Hanken Grotesk
- Mono: IBM Plex Mono
