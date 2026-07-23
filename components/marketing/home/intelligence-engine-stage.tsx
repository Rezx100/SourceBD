"use client";

// The SourceBD "Intelligence Engine" — matches the founder's reference
// mockup, tuned to platform rules:
//
//   - Brand palette only: forest #1f4d3a / forest-mid #2d6a4f (no generic
//     greens).
//   - One tiny solid comet ball per trace (zero-length round dash traveling
//     the path) — GRAY on the ingest side (raw data in), brand GREEN on the
//     insight side (verified data out). Slow, staggered, calm.
//   - Radii follow the 5/6/8/22 token family (rounded-input / rounded-pill /
//     rounded-card / rounded-hero + --r-md for the inner frame).
//   - Engine card is compact; its five processing rows run a *sequential*
//     pipeline: one step is live at a time (bar filling), finished steps
//     show a check, later steps queue — then the cycle resets.
//   - Database emblem is small, brand-forest, and tight to the rows.
//   - Elevation via the shadow-l1 token only; hub glow is a whisper.
//
// Numbers stay real (28+/18.7M+/1.1M+/96%). Left source cards keep the real
// on-file provider logos via `sourceLogo()`.

import {
  createRef,
  forwardRef,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
  type RefObject,
} from "react";
import {
  ChartLineUp,
  CheckCircle,
  CopySimple,
  Database,
  IdentificationBadge,
  MapPin,
  Receipt,
  SealCheck,
  ShareNetwork,
  ShieldCheck,
  StackSimple,
  TextAa,
  Truck,
  UsersThree,
  type IconProps,
} from "@phosphor-icons/react";
import { motion, useReducedMotion } from "motion/react";

import { roundedElbowPath } from "@/components/ui/animated-beam";
import { NumberTicker } from "@/components/ui/number-ticker";
import { sourceLogo } from "@/lib/source-logos";
import { cn } from "@/lib/utils";

type PhosphorIcon = ComponentType<IconProps>;

/* ── palette: brand tokens only ──────────────────────────────────────── */

const BRAND = "#1f4d3a"; // --brand-forest
const BRAND_MID = "#2d6a4f"; // --brand-forest-mid
const COMET_GRAY = "#a1a1aa"; // neutral-400 — raw data in
const LINE_GRAY = "#dcdce1";

/* ── data ────────────────────────────────────────────────────────────── */

type SourceNode = {
  label: string;
  sublabel: string;
  /** Resolves a real provider mark via `sourceLogo()`. */
  logoTag?: string;
  /** Neutral fallback glyph when no on-file logo exists for this source. */
  icon: PhosphorIcon;
};

const LEFT_SOURCES: SourceNode[] = [
  { label: "BGMEA", sublabel: "Registry", logoTag: "BGMEA", icon: StackSimple },
  { label: "BGMEA", sublabel: "Members", logoTag: "BGMEA", icon: StackSimple },
  { label: "EPB", sublabel: "Export Data", logoTag: "EPB", icon: StackSimple },
  { label: "RSC", sublabel: "Trade License", logoTag: "RSC", icon: StackSimple },
  { label: "NBR", sublabel: "Tax Records", icon: Receipt },
  { label: "Certificates", sublabel: "Authorities", icon: SealCheck },
];

type VizKind = "map" | "lines" | "doc" | "bars" | "dots" | "check";

type OutputNode = {
  label: string;
  sublabel: string;
  icon: PhosphorIcon;
  viz: VizKind;
};

const RIGHT_OUTPUTS: OutputNode[] = [
  { label: "Addresses", sublabel: "Verified", icon: MapPin, viz: "map" },
  { label: "Directors", sublabel: "Matched", icon: IdentificationBadge, viz: "lines" },
  { label: "Certificates", sublabel: "Valid", icon: SealCheck, viz: "doc" },
  { label: "Export History", sublabel: "Shipments", icon: Truck, viz: "bars" },
  { label: "Associations", sublabel: "Companies", icon: UsersThree, viz: "dots" },
  { label: "Compliance", sublabel: "Up to date", icon: ShieldCheck, viz: "check" },
];

const ENGINE_ROWS: { label: string; icon: PhosphorIcon }[] = [
  { label: "Cross-source matching", icon: ShareNetwork },
  { label: "Duplicate removal", icon: StackSimple },
  { label: "Name normalization", icon: TextAa },
  { label: "Evidence validation", icon: ShieldCheck },
  { label: "Confidence scoring", icon: ChartLineUp },
];

/** Real, audited metric values — same set the section shipped with. */
const METRICS: {
  icon: PhosphorIcon;
  value: number;
  decimals: number;
  suffix: string;
  label: string;
  ring?: boolean;
}[] = [
  { icon: ShareNetwork, value: 28, decimals: 0, suffix: "+", label: "Data sources" },
  { icon: Database, value: 18.7, decimals: 1, suffix: "M+", label: "Records processed" },
  { icon: CopySimple, value: 1.1, decimals: 1, suffix: "M+", label: "Duplicates removed" },
  { icon: ChartLineUp, value: 96, decimals: 0, suffix: "%", label: "Avg. confidence", ring: true },
];

/* ── beams: solid gray trace + ONE slow comet ball per trace ─────────── */

/** Staggered elbow fractions — outer cards run further before bending, so
 *  the fan-in nests cleanly instead of overlapping (mirrors the mockup). */
const ELBOW_STAGGER = [0.82, 0.62, 0.42, 0.42, 0.62, 0.82];

/** Comet cadence — one ball per trace, slow travel, generous stagger. */
const COMET_DURATION = 6.5;
const COMET_STAGGER = 1.05;

function PacketBeam({
  containerRef,
  fromRef,
  toRef,
  tone,
  axis = "horizontal",
  elbowAt = 0.5,
  cornerRadius = 10,
  duration = COMET_DURATION,
  delay = 0,
}: {
  containerRef: RefObject<HTMLElement | null>;
  fromRef: RefObject<HTMLElement | null>;
  toRef: RefObject<HTMLElement | null>;
  /** "gray" = raw data flowing in; "green" = verified data flowing out. */
  tone: "gray" | "green";
  axis?: "horizontal" | "vertical";
  elbowAt?: number;
  cornerRadius?: number;
  duration?: number;
  delay?: number;
}) {
  const reduce = useReducedMotion() ?? false;
  const [pathD, setPathD] = useState("");
  const [dims, setDims] = useState({ width: 0, height: 0 });
  const cometColor = tone === "green" ? BRAND_MID : COMET_GRAY;

  useEffect(() => {
    const update = () => {
      if (!containerRef.current || !fromRef.current || !toRef.current) return;
      const containerRect = containerRef.current.getBoundingClientRect();
      const rectA = fromRef.current.getBoundingClientRect();
      const rectB = toRef.current.getBoundingClientRect();
      setDims({ width: containerRect.width, height: containerRect.height });
      const startX = rectA.left - containerRect.left + rectA.width / 2;
      const startY = rectA.top - containerRect.top + rectA.height / 2;
      const endX = rectB.left - containerRect.left + rectB.width / 2;
      const endY = rectB.top - containerRect.top + rectB.height / 2;
      setPathD(
        roundedElbowPath(startX, startY, endX, endY, elbowAt, cornerRadius, axis),
      );
    };
    const observer = new ResizeObserver(update);
    if (containerRef.current) observer.observe(containerRef.current);
    update();
    return () => observer.disconnect();
  }, [containerRef, fromRef, toRef, axis, elbowAt, cornerRadius]);

  return (
    <svg
      fill="none"
      width={dims.width}
      height={dims.height}
      viewBox={`0 0 ${dims.width} ${dims.height}`}
      xmlns="http://www.w3.org/2000/svg"
      shapeRendering="geometricPrecision"
      className="pointer-events-none absolute left-0 top-0 transform-gpu"
      aria-hidden
    >
      {/* Base trace — thin, solid, light gray, rounded elbows. */}
      <path
        d={pathD}
        stroke={LINE_GRAY}
        strokeWidth={1.25}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Comet — a single tiny solid ball: a zero-length dash with a round
          cap travels the whole path once per cycle. Static midway dot under
          reduced motion. */}
      {reduce ? (
        <path
          d={pathD}
          pathLength={100}
          stroke={cometColor}
          strokeWidth={4.5}
          strokeLinecap="round"
          strokeDasharray="0.01 99.99"
          strokeDashoffset={-50}
        />
      ) : (
        <motion.path
          d={pathD}
          pathLength={100}
          stroke={cometColor}
          strokeWidth={4.5}
          strokeLinecap="round"
          strokeDasharray="0.01 99.99"
          initial={{ strokeDashoffset: 0 }}
          animate={{ strokeDashoffset: -100 }}
          transition={{ duration, ease: "linear", repeat: Infinity, delay }}
        />
      )}
    </svg>
  );
}

/* ── small pieces ────────────────────────────────────────────────────── */

/** Connection port on a card edge — gray on the ingest side, brand green on
 *  the insight side, matching the comet tones. */
const Port = forwardRef<
  HTMLSpanElement,
  { position: "left" | "right" | "top" | "bottom"; tone: "gray" | "green" }
>(function Port({ position, tone }, ref) {
  const pos = {
    right: "-right-[3px] top-1/2 -translate-y-1/2",
    left: "-left-[3px] top-1/2 -translate-y-1/2",
    top: "left-1/2 -top-[3px] -translate-x-1/2",
    bottom: "left-1/2 -bottom-[3px] -translate-x-1/2",
  }[position];
  return (
    <span
      ref={ref}
      aria-hidden
      className={cn(
        "absolute z-20 size-[7px] rounded-full ring-2 ring-white",
        pos,
      )}
      style={{ backgroundColor: tone === "green" ? BRAND : COMET_GRAY }}
    />
  );
});

/** Left column — provider card with the real on-file logo in a round chip. */
function SourceCard({
  node,
  portRef,
  portPosition,
}: {
  node: SourceNode;
  portRef: RefObject<HTMLSpanElement | null>;
  portPosition: "right" | "bottom";
}) {
  const Icon = node.icon;
  const logo = node.logoTag ? sourceLogo(node.logoTag) : null;
  return (
    <div className="relative z-10 flex w-full items-center gap-2.5 rounded-card border border-neutral-200 bg-white px-3 py-2.5 shadow-l1">
      <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-neutral-200/70 bg-neutral-50 text-neutral-500">
        {logo ? (
          // Real, on-file provider marks — same convention as data-pipeline /
          // trust-orbit elsewhere on this page.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logo}
            alt=""
            className="size-full rounded-full object-contain p-1.5"
            draggable={false}
          />
        ) : (
          <Icon size={15} aria-hidden />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12.5px] font-semibold leading-tight text-neutral-900">
          {node.label}
        </span>
        <span className="block truncate text-[11px] leading-tight text-neutral-500">
          {node.sublabel}
        </span>
      </span>
      <Port ref={portRef} position={portPosition} tone="gray" />
    </div>
  );
}

/** Tiny decorative graphics on the right cards (map / skeleton lines /
 *  doc-with-check / bar chart / scatter dots / check) — pure illustration. */
function MiniViz({ kind }: { kind: VizKind }) {
  switch (kind) {
    case "map":
      return (
        <svg width="26" height="26" viewBox="0 0 18 18" aria-hidden>
          <path
            d="M6 2 C9 0.5 12.5 1 13.5 3.5 C14.5 5.5 13.5 8 14.5 10.5 C15.5 13.5 13 15.5 11 14.5 C9.5 13.8 8.5 15.5 6.5 15 C3.5 14 2.5 11 3.5 8 C4.2 6 4.5 3.5 6 2 Z"
            fill={BRAND}
            fillOpacity={0.14}
            stroke={BRAND}
            strokeOpacity={0.4}
            strokeWidth={0.8}
          />
        </svg>
      );
    case "lines":
      return (
        <span className="flex flex-col items-end gap-1" aria-hidden>
          <span className="h-1 w-8 rounded-full bg-neutral-200" />
          <span className="h-1 w-5 rounded-full bg-neutral-200" />
          <span className="h-1 w-6 rounded-full bg-neutral-200/70" />
        </span>
      );
    case "doc":
      return (
        <span className="relative flex h-[26px] w-[20px] flex-col gap-[3px] rounded-[3px] border border-neutral-200 bg-white p-[4px]" aria-hidden>
          <span className="h-[2px] w-full rounded-full bg-neutral-200" />
          <span className="h-[2px] w-3/4 rounded-full bg-neutral-200" />
          <span className="h-[2px] w-full rounded-full bg-neutral-200/80" />
          <CheckCircle
            size={11}
            weight="fill"
            className="absolute -bottom-1 -right-1"
            style={{ color: BRAND_MID }}
          />
        </span>
      );
    case "bars":
      return (
        <span className="flex items-end gap-[3px]" aria-hidden>
          {[6, 10, 8, 13].map((h, i) => (
            <span
              key={i}
              className="w-[4px] rounded-sm"
              style={{
                height: `${h}px`,
                backgroundColor: BRAND,
                opacity: i === 3 ? 1 : 0.4 + i * 0.15,
              }}
            />
          ))}
        </span>
      );
    case "dots":
      return (
        <span className="relative block h-[22px] w-[26px]" aria-hidden>
          {[
            [2, 4, true],
            [12, 1, false],
            [20, 6, true],
            [7, 13, false],
            [17, 15, true],
            [24, 12, false],
          ].map(([x, y, green], i) => (
            <span
              key={i}
              className="absolute size-[4px] rounded-full"
              style={{
                left: `${x}px`,
                top: `${y}px`,
                backgroundColor: green ? BRAND_MID : "#d4d4d8",
              }}
            />
          ))}
        </span>
      );
    case "check":
      return (
        <CheckCircle size={20} weight="fill" style={{ color: BRAND_MID }} aria-hidden />
      );
  }
}

/** Right column — verified-insight card with an icon tile + mini graphic. */
function OutputCard({
  node,
  portRef,
  portPosition,
}: {
  node: OutputNode;
  portRef: RefObject<HTMLSpanElement | null>;
  portPosition: "left" | "top";
}) {
  const Icon = node.icon;
  return (
    <div className="relative z-10 flex w-full items-center gap-2.5 rounded-card border border-neutral-200 bg-white px-3 py-2.5 shadow-l1">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-pill border border-neutral-200/80 bg-neutral-50 text-neutral-600">
        <Icon size={15} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12.5px] font-semibold leading-tight text-neutral-900">
          {node.label}
        </span>
        <span className="block truncate text-[11px] leading-tight text-neutral-500">
          {node.sublabel}
        </span>
      </span>
      <span className="shrink-0 opacity-80">
        <MiniViz kind={node.viz} />
      </span>
      <Port ref={portRef} position={portPosition} tone="green" />
    </div>
  );
}

/** Collector / distributor — dark core dot inside a brand ring. Glow is a
 *  whisper (single faint tint, no heavy drop shadow). */
const HubNode = forwardRef<HTMLDivElement, { label: string }>(
  function HubNode({ label }, ref) {
    const reduce = useReducedMotion() ?? false;
    return (
      <div
        ref={ref}
        className="relative z-10 flex size-10 shrink-0 items-center justify-center"
      >
        <motion.span
          aria-hidden
          className="absolute inset-[3px] rounded-full blur-[3px]"
          style={{ backgroundColor: BRAND, opacity: 0.1 }}
          animate={reduce ? undefined : { opacity: [0.06, 0.14, 0.06] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        />
        <span
          aria-hidden
          className="absolute inset-[9px] rounded-full border-[1.5px] bg-white"
          style={{ borderColor: BRAND }}
        />
        <span className="relative z-10 size-[7px] rounded-full bg-neutral-900" />
        <span className="sr-only">{label}</span>
      </div>
    );
  },
);

/* ── engine card: sequential, meaningful pipeline ────────────────────── */

/** How long each pipeline step stays live before completing. */
const STEP_MS = 2000;

/** Sequential step index: 0..4 = that row is processing, 5 = all complete
 *  (brief settle), then the cycle resets. */
function useEngineStep(reduce: boolean) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (reduce) return;
    const id = setInterval(
      () => setStep((s) => (s + 1) % (ENGINE_ROWS.length + 1)),
      STEP_MS,
    );
    return () => clearInterval(id);
  }, [reduce]);
  return step;
}

/** One engine processing row. Exactly one row is "live" at a time — its bar
 *  fills left→right over the step window; finished rows hold a full brand
 *  bar + check; later rows queue empty. Reads as an actual pipeline pass. */
function EngineRow({
  row,
  status,
  reduce,
}: {
  row: (typeof ENGINE_ROWS)[number];
  status: "done" | "active" | "pending";
  reduce: boolean;
}) {
  const Icon = row.icon;
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-pill border px-2.5 py-[7px] transition-colors duration-300",
        status === "active"
          ? "border-brand-forest/20 bg-brand-forest/[0.04]"
          : "border-neutral-100 bg-neutral-50/90",
      )}
    >
      <span
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-pill border bg-white transition-colors duration-300",
          status === "active"
            ? "border-brand-forest/25 text-brand-forest"
            : "border-neutral-200 text-neutral-600",
        )}
      >
        <Icon size={13} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[11.5px] font-medium leading-none text-neutral-800">
          {row.label}
        </span>
        <span className="relative mt-[6px] block h-[3px] w-full overflow-hidden rounded-full bg-neutral-200/70">
          {reduce ? (
            <span
              className="absolute left-0 top-0 h-full rounded-full"
              style={{ width: "62%", backgroundColor: BRAND }}
            />
          ) : status === "done" ? (
            <span
              className="absolute left-0 top-0 h-full w-full rounded-full"
              style={{ backgroundColor: BRAND, opacity: 0.85 }}
            />
          ) : status === "active" ? (
            <motion.span
              className="absolute left-0 top-0 h-full rounded-full"
              style={{ backgroundColor: BRAND }}
              initial={{ width: "0%" }}
              animate={{ width: "100%" }}
              transition={{ duration: STEP_MS / 1000, ease: "linear" }}
            />
          ) : null}
        </span>
      </span>
      {reduce || status === "active" ? (
        <span className="flex shrink-0 items-center gap-1 self-start rounded-full border border-brand-forest/20 bg-white px-1.5 py-[2px] text-[8px] font-medium leading-none text-brand-forest">
          <span
            className="size-[4px] rounded-full motion-safe:animate-pulse"
            style={{ backgroundColor: BRAND_MID }}
          />
          Live
        </span>
      ) : status === "done" ? (
        <CheckCircle
          size={13}
          weight="fill"
          className="shrink-0 self-start"
          style={{ color: BRAND_MID }}
          aria-hidden
        />
      ) : (
        <span className="shrink-0 self-start rounded-full border border-neutral-200 bg-white px-1.5 py-[2px] text-[8px] font-medium leading-none text-neutral-400">
          Queued
        </span>
      )}
    </div>
  );
}

/** Where the pipeline lands — a compact footer row in the same idiom as
 *  the processing rows above it. While steps run it reads "assembling";
 *  the moment all five steps complete, the record commits (check pops in)
 *  before the next pass starts. No orbit circle, no dead space. */
function RecordFooter({
  committed,
  reduce,
}: {
  committed: boolean;
  reduce: boolean;
}) {
  const settled = committed || reduce;
  return (
    <div
      className={cn(
        "mt-2 flex items-center gap-2.5 rounded-pill border px-2.5 py-[7px] transition-colors duration-300",
        settled
          ? "border-brand-forest/25 bg-brand-forest/[0.06]"
          : "border-brand-forest/10 bg-brand-forest/[0.03]",
      )}
    >
      <span
        className="flex size-7 shrink-0 items-center justify-center rounded-pill text-white"
        style={{ backgroundColor: BRAND }}
      >
        <Database size={13} weight="fill" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[11.5px] font-semibold leading-tight text-neutral-900">
          Canonical record
        </span>
        <span className="block truncate text-[10px] leading-tight text-neutral-500">
          {settled ? "Verified profile committed" : "Assembling evidence…"}
        </span>
      </span>
      {settled ? (
        <motion.span
          key="committed"
          className="shrink-0"
          initial={reduce ? false : { scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 420, damping: 22 }}
        >
          <CheckCircle
            size={15}
            weight="fill"
            style={{ color: BRAND_MID }}
            aria-hidden
          />
        </motion.span>
      ) : (
        <motion.span
          key="assembling"
          aria-hidden
          className="size-[6px] shrink-0 rounded-full"
          style={{ backgroundColor: BRAND_MID }}
          animate={{ opacity: [0.35, 1, 0.35] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
    </div>
  );
}

/** Center engine card — compact double frame with corner ticks. */
function EngineCard({
  inRef,
  outRef,
  anchorAxis = "horizontal",
  className,
}: {
  inRef: RefObject<HTMLSpanElement | null>;
  outRef: RefObject<HTMLSpanElement | null>;
  anchorAxis?: "horizontal" | "vertical";
  className?: string;
}) {
  const reduce = useReducedMotion() ?? false;
  const step = useEngineStep(reduce);
  return (
    <div
      className={cn(
        "relative z-10 w-[300px] shrink-0 rounded-hero border border-neutral-200 bg-white p-2.5 shadow-l1",
        className,
      )}
    >
      {anchorAxis === "horizontal" ? (
        <>
          <span ref={inRef} aria-hidden className="absolute -left-px top-1/2 size-px -translate-y-1/2" />
          <span ref={outRef} aria-hidden className="absolute -right-px top-1/2 size-px -translate-y-1/2" />
        </>
      ) : (
        <>
          <span ref={inRef} aria-hidden className="absolute -top-px left-1/2 size-px -translate-x-1/2" />
          <span ref={outRef} aria-hidden className="absolute -bottom-px left-1/2 size-px -translate-x-1/2" />
        </>
      )}

      {/* Inner frame with tiny corner ticks — the mockup's viewfinder look. */}
      <div className="relative rounded-[var(--r-md)] border border-neutral-200/80 px-3 pb-3.5 pt-4">
        {[
          "-left-[2px] -top-[2px]",
          "-right-[2px] -top-[2px]",
          "-left-[2px] -bottom-[2px]",
          "-right-[2px] -bottom-[2px]",
        ].map((pos) => (
          <span
            key={pos}
            aria-hidden
            className={cn("absolute size-[4px] rounded-[1px] bg-neutral-300", pos)}
          />
        ))}

        <div className="text-center">
          <p className="font-display text-[19px] font-bold leading-none tracking-[-0.015em] text-neutral-900">
            Source
            <span className="text-brand-forest">BD</span>
          </p>
          <p className="mt-1.5 text-[9px] font-semibold uppercase tracking-[0.24em] text-neutral-400">
            Intelligence Engine
          </p>
        </div>

        <div className="mt-3.5 flex flex-col gap-1.5">
          {ENGINE_ROWS.map((row, i) => (
            <EngineRow
              key={row.label}
              row={row}
              status={i < step ? "done" : i === step ? "active" : "pending"}
              reduce={reduce}
            />
          ))}
        </div>

        <RecordFooter committed={step === ENGINE_ROWS.length} reduce={reduce} />
      </div>
    </div>
  );
}

/* ── chrome: pill, labels, decorations, metrics ──────────────────────── */

function LivePill() {
  const reduce = useReducedMotion() ?? false;
  return (
    <span className="relative z-10 inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-[5px] text-[11px] font-medium leading-none text-neutral-600 shadow-l1">
      <motion.span
        aria-hidden
        className="size-[6px] shrink-0 rounded-full"
        style={{ backgroundColor: BRAND_MID }}
        animate={reduce ? undefined : { opacity: [1, 0.35, 1] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      />
      Live reconciliation
    </span>
  );
}

/** Column label with its corner mark inline — both sides render the exact
 *  same flex row (mirrored), so the marks always align with each other. */
function ColumnLabel({
  children,
  align = "left",
}: {
  children: ReactNode;
  align?: "left" | "right";
}) {
  return (
    <p
      className={cn(
        "relative z-10 flex items-center gap-2",
        align === "right" && "flex-row-reverse",
      )}
    >
      <span aria-hidden className="size-[6px] shrink-0 rounded-[1px] bg-neutral-800/75" />
      <span className="bg-white/90 font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-neutral-500">
        {children}
      </span>
    </p>
  );
}

/** Faint dotted-grid patches, matching the mockup's engineering-paper
 *  flourishes. (Corner marks live in the column labels for alignment.) */
function StageDecorations() {
  const dotPatch = {
    backgroundImage: "radial-gradient(circle, #c9c9cf 1px, transparent 1px)",
    backgroundSize: "9px 9px",
  } as const;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
      <span className="absolute left-[22%] top-6 hidden h-14 w-24 opacity-30 lg:block" style={dotPatch} />
      <span className="absolute right-[24%] top-10 hidden h-14 w-20 opacity-30 lg:block" style={dotPatch} />
      <span className="absolute bottom-8 left-[30%] hidden h-12 w-20 opacity-25 lg:block" style={dotPatch} />
      <span className="absolute bottom-16 right-[8%] hidden h-12 w-24 opacity-25 lg:block" style={dotPatch} />
    </div>
  );
}

/** Tiny confidence ring — the one place a percentage gets a visual. */
function ConfidenceRing({ value }: { value: number }) {
  const radius = 15;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  return (
    <svg width="30" height="30" viewBox="0 0 36 36" className="shrink-0" aria-hidden>
      <circle cx="18" cy="18" r={radius} fill="none" stroke="rgb(228 228 231)" strokeWidth="3.5" />
      <motion.circle
        cx="18"
        cy="18"
        r={radius}
        fill="none"
        stroke={BRAND}
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeDasharray={circumference}
        initial={{ strokeDashoffset: circumference }}
        whileInView={{ strokeDashoffset: offset }}
        viewport={{ once: true, amount: 0.6 }}
        transition={{ duration: 0.8, ease: "easeOut", delay: 0.4 }}
        transform="rotate(-90 18 18)"
      />
    </svg>
  );
}

/** Real, audited metrics — chrome-free, full-width row so the section shell
 *  can lay it on the open section surface. Cells are left-aligned and flush
 *  with the container edges, matching the step columns beneath it. */
export function EngineMetricsRow() {
  return (
    <div className="grid grid-cols-2 gap-y-6 sm:grid-cols-4 sm:divide-x sm:divide-neutral-200/80">
      {METRICS.map((m, i) => (
        <div
          key={m.label}
          className={cn(
            "flex items-center gap-3",
            i === 0 ? "sm:pr-6" : "sm:px-6",
          )}
        >
          {m.ring ? (
            <ConfidenceRing value={m.value} />
          ) : (
            <m.icon size={20} className="shrink-0 text-neutral-700" aria-hidden />
          )}
          <span className="min-w-0">
            <p className="flex items-baseline gap-px font-display text-[15px] font-bold tabular-nums leading-none text-neutral-900 sm:text-[17px]">
              <NumberTicker value={m.value} decimalPlaces={m.decimals} />
              <span>{m.suffix}</span>
            </p>
            <p className="mt-1 truncate text-[10px] leading-none text-neutral-500 sm:text-[10.5px]">
              {m.label}
            </p>
          </span>
        </div>
      ))}
    </div>
  );
}

/* ── stages ──────────────────────────────────────────────────────────── */

function DesktopStage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const collectorRef = useRef<HTMLDivElement>(null);
  const distributorRef = useRef<HTMLDivElement>(null);
  const cardInRef = useRef<HTMLSpanElement>(null);
  const cardOutRef = useRef<HTMLSpanElement>(null);
  const leftPorts = useMemo(
    () => LEFT_SOURCES.map(() => createRef<HTMLSpanElement>()),
    [],
  );
  const rightPorts = useMemo(
    () => RIGHT_OUTPUTS.map(() => createRef<HTMLSpanElement>()),
    [],
  );

  return (
    <div ref={containerRef} className="relative hidden lg:block">
      <StageDecorations />

      <div className="mb-7 grid grid-cols-[1fr_auto_1fr] items-center px-1">
        <ColumnLabel>Data sources</ColumnLabel>
        <LivePill />
        <div className="flex justify-end">
          <ColumnLabel align="right">Verified supplier insights</ColumnLabel>
        </div>
      </div>

      <div className="flex items-stretch justify-center">
        {/* Sources */}
        <div className="flex w-[188px] shrink-0 flex-col justify-between gap-3">
          {LEFT_SOURCES.map((node, i) => (
            <SourceCard
              key={`${node.label}-${node.sublabel}`}
              node={node}
              portRef={leftPorts[i]!}
              portPosition="right"
            />
          ))}
        </div>

        {/* Collector — placed close to the engine, like the mockup. */}
        <div className="flex min-w-[120px] flex-1 items-center justify-end pr-3 xl:min-w-[150px]">
          <HubNode ref={collectorRef} label="Collector node" />
        </div>

        <EngineCard inRef={cardInRef} outRef={cardOutRef} />

        {/* Distributor */}
        <div className="flex min-w-[120px] flex-1 items-center justify-start pl-3 xl:min-w-[150px]">
          <HubNode ref={distributorRef} label="Distributor node" />
        </div>

        {/* Outputs */}
        <div className="flex w-[212px] shrink-0 flex-col justify-between gap-3">
          {RIGHT_OUTPUTS.map((node, i) => (
            <OutputCard
              key={node.label}
              node={node}
              portRef={rightPorts[i]!}
              portPosition="left"
            />
          ))}
        </div>
      </div>

      {/* Beams — rendered last, under the z-10 cards. Gray comets in,
          brand-green comets out. */}
      {leftPorts.map((ref, i) => (
        <PacketBeam
          key={`l-${i}`}
          containerRef={containerRef}
          fromRef={ref}
          toRef={collectorRef}
          tone="gray"
          axis="horizontal"
          elbowAt={ELBOW_STAGGER[i] ?? 0.5}
          cornerRadius={10}
          delay={i * COMET_STAGGER}
        />
      ))}
      <PacketBeam
        containerRef={containerRef}
        fromRef={collectorRef}
        toRef={cardInRef}
        tone="gray"
        elbowAt={0.5}
        cornerRadius={0}
        duration={2.4}
      />
      <PacketBeam
        containerRef={containerRef}
        fromRef={cardOutRef}
        toRef={distributorRef}
        tone="green"
        elbowAt={0.5}
        cornerRadius={0}
        duration={2.4}
      />
      {rightPorts.map((ref, i) => (
        <PacketBeam
          key={`r-${i}`}
          containerRef={containerRef}
          fromRef={distributorRef}
          toRef={ref}
          tone="green"
          axis="horizontal"
          elbowAt={1 - (ELBOW_STAGGER[i] ?? 0.5)}
          cornerRadius={10}
          delay={i * COMET_STAGGER + 0.5}
        />
      ))}
    </div>
  );
}

function MobileStage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const collectorRef = useRef<HTMLDivElement>(null);
  const distributorRef = useRef<HTMLDivElement>(null);
  const cardInRef = useRef<HTMLSpanElement>(null);
  const cardOutRef = useRef<HTMLSpanElement>(null);
  const leftPorts = useMemo(
    () => LEFT_SOURCES.map(() => createRef<HTMLSpanElement>()),
    [],
  );
  const rightPorts = useMemo(
    () => RIGHT_OUTPUTS.map(() => createRef<HTMLSpanElement>()),
    [],
  );
  /** Row-staggered elbows for the 2-col grid: lower rows bend earlier. */
  const rowElbow = (i: number) => [0.78, 0.6, 0.42][Math.floor(i / 2)] ?? 0.5;

  return (
    <div ref={containerRef} className="relative lg:hidden">
      <div className="mb-4 flex justify-center">
        <LivePill />
      </div>

      <div className="mb-3 px-0.5">
        <ColumnLabel>Data sources</ColumnLabel>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {LEFT_SOURCES.map((node, i) => (
          <SourceCard
            key={`${node.label}-${node.sublabel}`}
            node={node}
            portRef={leftPorts[i]!}
            portPosition="bottom"
          />
        ))}
      </div>

      <div className="flex justify-center py-4">
        <HubNode ref={collectorRef} label="Collector node" />
      </div>

      <div className="flex justify-center">
        <EngineCard
          inRef={cardInRef}
          outRef={cardOutRef}
          anchorAxis="vertical"
          className="w-full max-w-[300px]"
        />
      </div>

      <div className="flex justify-center py-4">
        <HubNode ref={distributorRef} label="Distributor node" />
      </div>

      <div className="mb-3 px-0.5">
        <ColumnLabel>Verified supplier insights</ColumnLabel>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {RIGHT_OUTPUTS.map((node, i) => (
          <OutputCard
            key={node.label}
            node={node}
            portRef={rightPorts[i]!}
            portPosition="top"
          />
        ))}
      </div>

      {leftPorts.map((ref, i) => (
        <PacketBeam
          key={`ml-${i}`}
          containerRef={containerRef}
          fromRef={ref}
          toRef={collectorRef}
          tone="gray"
          axis="vertical"
          elbowAt={rowElbow(i)}
          cornerRadius={8}
          delay={i * COMET_STAGGER}
        />
      ))}
      <PacketBeam
        containerRef={containerRef}
        fromRef={collectorRef}
        toRef={cardInRef}
        tone="gray"
        axis="vertical"
        elbowAt={0.5}
        cornerRadius={0}
        duration={2.4}
      />
      <PacketBeam
        containerRef={containerRef}
        fromRef={cardOutRef}
        toRef={distributorRef}
        tone="green"
        axis="vertical"
        elbowAt={0.5}
        cornerRadius={0}
        duration={2.4}
      />
      {rightPorts.map((ref, i) => (
        <PacketBeam
          key={`mr-${i}`}
          containerRef={containerRef}
          fromRef={distributorRef}
          toRef={ref}
          tone="green"
          axis="vertical"
          elbowAt={1 - rowElbow(i)}
          cornerRadius={8}
          delay={i * COMET_STAGGER + 0.5}
        />
      ))}
    </div>
  );
}

export function IntelligenceEngineStage({ className }: { className?: string }) {
  return (
    <div
      role="img"
      aria-label="Trusted data sources continuously feed evidence into the SourceBD intelligence engine, which reconciles it into verified supplier insight."
      className={cn("relative w-full", className)}
    >
      <DesktopStage />
      <MobileStage />
    </div>
  );
}
