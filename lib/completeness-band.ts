// Semantic banding for `suppliers.completeness_pct`, per
// frontend-design-spec.md §14.2 (buyer-facing "quality" indicator — the only
// one permitted outside /admin). Bands: <40 red · 40–69 amber · 70–89 green ·
// ≥90 emerald.

export type CompletenessBand = "red" | "amber" | "green" | "emerald";

export function completenessBand(pct: number): CompletenessBand {
  if (pct < 40) return "red";
  if (pct < 70) return "amber";
  if (pct < 90) return "green";
  return "emerald";
}

export const COMPLETENESS_BAND_CLASSES: Record<
  CompletenessBand,
  { border: string; text: string; icon: string }
> = {
  red: {
    border: "border-sem-red/30",
    text: "text-sem-red",
    icon: "text-sem-red",
  },
  amber: {
    border: "border-sem-amber/30",
    text: "text-ink-tertiary",
    icon: "text-sem-amber",
  },
  green: {
    border: "border-sem-green/30",
    text: "text-ink-tertiary",
    icon: "text-sem-green",
  },
  emerald: {
    border: "border-sem-emerald/30",
    text: "text-ink-tertiary",
    icon: "text-sem-emerald",
  },
};
