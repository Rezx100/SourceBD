// I-027 — Shared skeleton primitive used by every `loading.tsx` to render
// silhouettes pixel-matched to the real components they replace. Pure CSS
// (`.skel` in globals.css does the shimmer); zero JS, server-safe.

import { cn } from "@/lib/utils";

type Shape = "bar" | "pill" | "circle" | "card" | "hero";
type Tone = "default" | "soft" | "card";

type Props = {
  /** Inline width — px number or any CSS length. Omit for full-width. */
  w?: number | string;
  /** Inline height — px number or any CSS length. Default 12px (text-bar). */
  h?: number | string;
  shape?: Shape;
  tone?: Tone;
  className?: string;
  style?: React.CSSProperties;
  "aria-hidden"?: boolean;
};

export function Skeleton({
  w,
  h = 12,
  shape = "bar",
  tone = "default",
  className,
  style,
  "aria-hidden": ariaHidden = true,
}: Props) {
  const inline: React.CSSProperties = {
    width: typeof w === "number" ? `${w}px` : w,
    height: typeof h === "number" ? `${h}px` : h,
    ...style,
  };
  return (
    <span
      aria-hidden={ariaHidden}
      className={cn(
        "skel",
        shape !== "bar" && shape,
        tone !== "default" && `tone-${tone}`,
        className,
      )}
      style={inline}
    />
  );
}

/** Live-region wrapper for a skeleton block. Adds the SR-only "Loading" label
 *  + `role="status"` + `aria-busy` so the user gets one polite announcement
 *  per route boundary instead of one per skel element. */
export function SkeletonRegion({
  label = "Loading",
  className,
  children,
}: {
  label?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div role="status" aria-busy="true" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}
