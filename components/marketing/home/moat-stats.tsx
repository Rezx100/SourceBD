"use client";

import { useId, useMemo } from "react";
import { useReducedMotion } from "motion/react";

import { BlurFade } from "@/components/ui/blur-fade";
import { cn } from "@/lib/utils";

type MoatStatsProps = {
  suppliersIndexed: number | null;
  corroborated: number | null;
  documentsMirrored: number | null;
  certificationsVerified: number | null;
  sanctionsListsScreened: number | null;
  lastRefreshedAt: string | null;
  className?: string;
};

/** Deterministic date rendering (fixed locale + UTC) — safe for hydration. */
function formatRefreshedAt(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}

const VIEW_W = 1728;
const VIEW_H = 576;
const CELL = 72;
const LINE_W = 1;

type Comet = {
  id: number;
  y: number;
  length: number;
  duration: number;
  delay: number;
  repeatDelay: number;
};

/** Line-only grid; 1px LTR hairline comets (no glow/belly). */
function StatsLineGrid({ className }: { className?: string }) {
  const uid = useId().replace(/:/g, "");
  const reduce = useReducedMotion();

  const { vLines, hLines, comets } = useMemo(() => {
    const cols = Math.ceil(VIEW_W / CELL);
    const rows = Math.ceil(VIEW_H / CELL);

    const vertical: number[] = [];
    for (let c = 0; c <= cols; c += 1) vertical.push(c * CELL);

    const horizontal: number[] = [];
    for (let r = 0; r <= rows; r += 1) horizontal.push(r * CELL);

    const nextComets: Comet[] = [];
    let cometId = 0;
    // Drop absolute edges, then also skip the outermost drawn rails
    // (visual very-top / very-bottom). Comets only on top-2 + bottom-2
    // of what's left — middle rail stays clear for stats text.
    const interior = horizontal.filter(
      (_, idx) => idx !== 0 && idx !== horizontal.length - 1,
    );
    const usable = interior.slice(1, -1);
    const cometRails = [...usable.slice(0, 2), ...usable.slice(-2)];

    cometRails.forEach((y, i) => {
      const n = Math.sin(i * 41.17 + 2.3) * 43758.5453;
      const t = n - Math.floor(n);

      nextComets.push({
        id: cometId++,
        y,
        length: 320 + Math.floor(t * 280),
        duration: 1.8 + t * 1.0,
        delay: t * 2,
        repeatDelay: 0.25 + t * 0.8,
      });
    });

    return { vLines: vertical, hLines: horizontal, comets: nextComets };
  }, []);

  return (
    <svg
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 h-full w-full [mask-image:linear-gradient(to_bottom,transparent_0%,black_15%,black_85%,transparent_100%)] [-webkit-mask-image:linear-gradient(to_bottom,transparent_0%,black_15%,black_85%,transparent_100%)]",
        className,
      )}
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      preserveAspectRatio="xMidYMid slice"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient
          id={`${uid}-fade`}
          x1="0"
          y1="0"
          x2="0"
          y2="1"
        >
          <stop offset="0%" stopColor="white" stopOpacity="0" />
          <stop offset="15%" stopColor="white" stopOpacity="1" />
          <stop offset="85%" stopColor="white" stopOpacity="1" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </linearGradient>
        <mask id={`${uid}-mask`}>
          <rect width={VIEW_W} height={VIEW_H} fill={`url(#${uid}-fade)`} />
        </mask>
        {/* RGB soft-peak — muted so AA doesn't bloom into a fat line */}
        {comets.map((comet) => (
          <linearGradient
            key={`g-${comet.id}`}
            id={`${uid}-comet-${comet.id}`}
            gradientUnits="userSpaceOnUse"
            x1={0}
            y1={0}
            x2={comet.length}
            y2={0}
          >
            <stop offset="0%" stopColor="rgb(31, 77, 58)" stopOpacity="0" />
            <stop offset="22%" stopColor="rgb(37, 99, 235)" stopOpacity="0.75" />
            <stop offset="50%" stopColor="rgb(22, 163, 74)" stopOpacity="0.85" />
            <stop offset="78%" stopColor="rgb(220, 38, 38)" stopOpacity="0.75" />
            <stop offset="100%" stopColor="rgb(31, 77, 58)" stopOpacity="0" />
          </linearGradient>
        ))}
      </defs>

      <g mask={`url(#${uid}-mask)`} strokeWidth={LINE_W} strokeLinecap="butt">
        {vLines.map((x) => (
          <line
            key={`v-${x}`}
            x1={x}
            y1={0}
            x2={x}
            y2={VIEW_H}
            stroke="rgba(15,15,20,0.07)"
            vectorEffect="nonScalingStroke"
          />
        ))}
        {hLines.map((y, idx) => {
          if (idx === 0 || idx === hLines.length - 1) return null;
          return (
            <line
              key={`h-${y}`}
              x1={0}
              y1={y}
              x2={VIEW_W}
              y2={y}
              stroke="rgba(15,15,20,0.07)"
              vectorEffect="nonScalingStroke"
            />
          );
        })}

        {!reduce
          ? comets.map((comet) => (
              <g key={comet.id}>
                <animateTransform
                  attributeName="transform"
                  type="translate"
                  from={`${-comet.length} 0`}
                  to={`${VIEW_W} 0`}
                  dur={`${comet.duration}s`}
                  begin={`${comet.delay}s`}
                  repeatCount="indefinite"
                  calcMode="linear"
                />
                <animate
                  attributeName="opacity"
                  values="0;1;0;1;0"
                  keyTimes="0;0.14;0.5;0.86;1"
                  dur={`${comet.duration}s`}
                  begin={`${comet.delay}s`}
                  repeatCount="indefinite"
                  calcMode="linear"
                />
                <line
                  x1={0}
                  y1={comet.y}
                  x2={comet.length}
                  y2={comet.y}
                  stroke={`url(#${uid}-comet-${comet.id})`}
                  vectorEffect="nonScalingStroke"
                  shapeRendering="crispEdges"
                />
              </g>
            ))
          : null}
      </g>
    </svg>
  );
}

export function MoatStats({
  suppliersIndexed,
  corroborated,
  documentsMirrored,
  certificationsVerified,
  sanctionsListsScreened,
  lastRefreshedAt,
  className,
}: MoatStatsProps) {
  // Short primary label + optional detail keeps the four columns one visual
  // weight. "Register-backed" = ≥1 Tier 1/2 source — deliberately NOT
  // "corroborated" (that would imply multi-source cross-confirmation the
  // RPC field does not measure).
  const columns = [
    {
      value: suppliersIndexed,
      fallback: "10,000+",
      label: "Suppliers indexed",
      detail: null as string | null,
    },
    {
      value: corroborated,
      fallback: "9,000+",
      label: "Register-backed",
      detail: "Government or association source",
    },
    {
      value: certificationsVerified,
      fallback: "4,000+",
      label: "Certificates verified",
      detail: "OEKO-TEX, GOTS, WRAP, SA8000",
    },
    {
      value: documentsMirrored,
      fallback: "7,000+",
      label: "Documents mirrored",
      detail: "Compliance PDFs on file",
    },
  ] as const;

  // Live 0 reads as a broken metric on a proof band — hide that column.
  // null still shows the rounded fallback (RPC unavailable).
  const visibleColumns = columns.filter((col) => col.value !== 0);

  // Match column count so 3 live metrics never leave a lone orphan cell
  // in a 2-column grid. 4-up stays 2×2 below lg, then a full row.
  const gridCols =
    visibleColumns.length >= 4
      ? "grid-cols-2 gap-y-10 sm:gap-y-12 lg:grid-cols-4"
      : visibleColumns.length === 3
        ? "grid-cols-1 gap-y-8 min-[480px]:grid-cols-3 min-[480px]:gap-y-10 sm:gap-y-12"
        : visibleColumns.length === 2
          ? "grid-cols-2 gap-y-10 sm:gap-y-12"
          : "grid-cols-1 gap-y-10";

  const refreshedLabel = lastRefreshedAt
    ? formatRefreshedAt(lastRefreshedAt)
    : null;

  // Freshness strip sits under the whole band so narrow half-columns
  // don't wrap "Screened · Refreshed" into a left-heavy stack.
  const freshnessMeta = [
    sanctionsListsScreened != null
      ? `Screened on ${sanctionsListsScreened} lists`
      : null,
    refreshedLabel ? `Refreshed ${refreshedLabel}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <section
      aria-label="Data moat"
      className={cn(
        "relative isolate overflow-hidden border-b border-neutral-200 bg-white py-16 sm:py-20 md:py-28",
        className,
      )}
    >
      <StatsLineGrid />

      <div className="relative z-10 mx-auto w-full max-w-[1200px] px-4 sm:px-6">
        <div
          className={cn(
            "grid w-full gap-x-4 sm:gap-x-8",
            gridCols,
          )}
        >
          {visibleColumns.map((col, i) => (
            <BlurFade
              key={col.label}
              delay={0.08 + i * 0.1}
              duration={0.6}
              offset={10}
              blur="6px"
              inView
              inViewMargin="-40px"
              className="h-full"
            >
              <div className="flex h-full flex-col items-center text-center">
                <p className="font-display text-3xl font-bold tabular-nums leading-none tracking-[-0.04em] text-neutral-950 min-[420px]:text-4xl sm:text-5xl lg:text-[3.5rem]">
                  {typeof col.value === "number" ? (
                    // SSR-visible exact value — no 0→N flash before JS/inView.
                    // Animation is the surrounding BlurFade, not a count-up.
                    <span className="tabular-nums tracking-[-0.04em] text-neutral-950">
                      {col.value.toLocaleString("en-US")}
                    </span>
                  ) : (
                    col.fallback
                  )}
                </p>
                <div className="mt-4 flex w-full max-w-[16rem] flex-col items-center gap-1 lg:max-w-none">
                  <p className="font-body text-sm font-medium leading-snug text-neutral-700">
                    {col.label}
                  </p>
                  {col.detail ? (
                    <p className="font-body text-[12px] leading-snug text-neutral-500">
                      {col.detail}
                    </p>
                  ) : null}
                </div>
              </div>
            </BlurFade>
          ))}
        </div>

        {freshnessMeta ? (
          <p className="mt-14 text-center font-mono text-[12px] leading-snug text-neutral-500 sm:mt-16">
            {freshnessMeta}
          </p>
        ) : null}
      </div>
    </section>
  );
}
