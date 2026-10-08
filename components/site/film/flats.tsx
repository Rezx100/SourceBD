// The overlock (handoff-home-film §3.7; founder's video, 7 Oct 2026: "I like this cute machine with scroll, but it
// needs to be way larger, prominent, integrated with the scroll story"). A line drawing in the film's own ink, fills
// from the surface roles, green only for thread. Each of the five sources is a cone with its tag, and its thread
// runs from the cone through its tension disc to the needle; the scroll threads them in one after another
// (engine/chapters.ts writes `--t` on each), turns the handwheel and drops the needle (`--wheel`, `--needle`), and
// draws the seam (`--p`). Out of the seam comes the record, sewn in as a woven label (`CareLabel`), one line per
// source. With nothing written every part rests and every thread is in, which is what the lite and still tiers and a
// still page show. The drawing is decoration: its caption and the label carry the words.

import { SEAM_END } from "@/components/site/film/engine/chapters";
import { NAME, SOURCE_DATES } from "@/components/site/film/record";
import { cn } from "@/lib/utils";

/** The cones' centres, left to right, and the source whose tag hangs on each thread with the number it files the factory under. */
const CONES = [70, 150, 230, 310, 390] as const;
export const TAGS: readonly [source: string, number: string][] = [["BGMEA", "4002"], ["EPB", "2798"], ["BKMEA", "1004-B"], ["GOTS", "19020"], ["RSC", "10861"]];
const DISCS = [196, 242, 288, 334, 380] as const;
/** From each disc to the take-up lever, each its own curve, so the five threads stay apart. */
const TO_LEVER = ["M183 214C165 214 150 204 127 206", "M229 214C200 228 160 212 127 206", "M275 214C230 236 165 216 127 206", "M321 214C250 244 170 220 127 206", "M367 214C270 252 175 224 127 206"] as const;
/** One thread, cone to needle: up to its guide, down to its disc, across to the lever, down to the needle. */
export const threadPath = (i: number) => {
  const x = CONES[i]!, d = DISCS[i]!;
  return `M${x} 50 ${x + 8} -30M${x + 8} -30C${x + 8} 150 ${d} 110 ${d} 201${TO_LEVER[i]}M127 206C118 232 113 262 113 314`;
};

/** A five-thread overlock, side on: thread stand, five cones with their tags, the head, the handwheel, the cloth and its seam. */
export function Overlock({ className }: { className?: string }) {
  return (
    <svg data-overlock aria-hidden viewBox="0 -70 460 490" className={cn("block overflow-visible", className)}>
      {/* The thread stand: the centre post, the rail with its guides, the cone shelf and the cone posts. */}
      <g className="fill-none stroke-ink" strokeWidth={1.4} strokeLinecap="round">
        <path d="M230 170V-30M46 -30H438M40 120H420" />
        <path d={CONES.map((x) => `M${x} 62V50`).join("")} />
      </g>
      {/* The head, the bed, the needle head, the handwheel with its crank, and the feet. */}
      <g className="stroke-ink" strokeWidth={1.4} strokeLinejoin="round">
        <rect x={150} y={160} width={246} height={150} rx={14} className="fill-surface" />
        <rect x={96} y={300} width={300} height={100} rx={10} className="fill-subtle" />
        <rect x={84} y={176} width={84} height={98} rx={10} className="fill-surface" />
        <rect x={396} y={236} width={24} height={92} rx={9} className="fill-ink" />
        <rect x={420} y={268} width={7} height={28} rx={2} className="fill-ink" />
        <rect x={118} y={400} width={36} height={8} rx={2} className="fill-ink" />
        <rect x={338} y={400} width={36} height={8} rx={2} className="fill-ink" />
      </g>
      <g className="fill-none stroke-line-strong" strokeWidth={0.9}>
        <rect x={94} y={188} width={50} height={72} rx={6} className="fill-subtle" />
        <rect x={236} y={332} width={86} height={24} rx={4} className="fill-surface" />
        <rect x={110} y={314} width={70} height={34} rx={6} className="fill-surface" />
        <path d="M340 252h38M340 260h38M340 268h38" />
      </g>
      {/* The handwheel's rim: two lights and the groove that turns with the scroll. */}
      <path d="M402 246v72M414 246v72" className="fill-none stroke-surface" strokeOpacity={0.28} strokeWidth={1} />
      <path d="M408 246v72" className="ov-wheel fill-none stroke-surface" strokeOpacity={0.5} strokeWidth={2} strokeDasharray="3 5" />
      {/* Each source: its cone, its tag, and its thread from the cone to the needle, threaded in by the scroll. */}
      {TAGS.map(([source, number], i) => {
        const x = CONES[i]!;
        return (
          <g key={source} data-source={source} className="ov-source">
            <path d={`M${x - 17} 120 ${x - 8} 62H${x + 8}L${x + 17} 120Z`} className="fill-brand stroke-ink" strokeWidth={1.2} strokeLinejoin="round" />
            <path d={`M${x - 10} 76H${x + 10}M${x - 12} 90H${x + 12}M${x - 14} 104H${x + 14}`} className="fill-none stroke-surface" strokeOpacity={0.3} strokeWidth={1} />
            <path d={threadPath(i)} pathLength={1} className="ov-thread fill-none stroke-brand-ink" strokeWidth={1.3} strokeLinecap="round" />
            {/* The tag, on its thread: the source and the number it files the factory under. 13 units: at the size the full tier draws the machine, never under the system's 12 px floor. */}
            <path d={`M${x + 8} -30V-24`} className="fill-none stroke-ink" strokeWidth={1} />
            <rect x={x + 8 - 37} y={-24} width={74} height={36} rx={3} className="fill-surface stroke-ink" strokeWidth={1} />
            <text x={x + 8} y={-7} textAnchor="middle" fontSize={13} fontWeight={600} className="fill-ink font-sans">
              {source}
            </text>
            <text x={x + 8} y={7} textAnchor="middle" fontSize={13} className="fill-ink-3 font-mono">
              {number}
            </text>
          </g>
        );
      })}
      {/* The tension discs, the guides on the rail, and the dial on the bed. */}
      <g className="fill-surface stroke-ink" strokeWidth={1.3}>
        {DISCS.map((x) => (
          <circle key={x} cx={x} cy={214} r={13} />
        ))}
        {CONES.map((x) => (
          <circle key={x} cx={x + 8} cy={-30} r={3.4} />
        ))}
        <circle cx={362} cy={344} r={8} />
      </g>
      <g className="fill-ink">
        {DISCS.map((x) => (
          <circle key={x} cx={x} cy={214} r={5} />
        ))}
        <circle cx={127} cy={206} r={3} />
        <circle cx={362} cy={344} r={2.6} />
      </g>
      {/* The take-up lever rocks with the needle. */}
      <path d="M132 198q-12 16 0 34" className="ov-lever fill-none stroke-ink" strokeWidth={1.2} />
      {/* The needle bar drops one stitch per step. */}
      <g className="ov-needle stroke-ink" strokeLinejoin="round">
        <rect x={110} y={274} width={6} height={36} className="fill-line" strokeWidth={0.9} />
        <rect x={128} y={274} width={5} height={64} className="fill-line" strokeWidth={0.9} />
        <rect x={105} y={306} width={16} height={8} rx={1.5} className="fill-ink" strokeWidth={0.9} />
        <path d="M110 314V352M116 314V352" className="fill-none" strokeWidth={1.1} />
      </g>
      {/* The presser foot. */}
      <path d="M98 346h46l6 10H92z" className="fill-sunken stroke-ink" strokeWidth={1.2} strokeLinejoin="round" />
      {/* The cloth comes in from the left, passes under the foot and leaves at the right as one seam. */}
      <path d={`M18 356H${SEAM_END.x}V367H18Z`} className="fill-sunken" />
      <path d={`M${SEAM_END.x} 356H18V367H${SEAM_END.x}`} className="fill-none stroke-ink" strokeWidth={1.4} strokeLinejoin="round" />
      <path data-seam d={`M113 ${SEAM_END.y}H${SEAM_END.x}`} pathLength={1} className="ov-seam fill-none stroke-brand-ink" strokeWidth={1.6} strokeLinecap="round" />
    </svg>
  );
}

/**
 * The record as the seam gives it: a woven label sewn in at the seam's end, the factory's name and one line per
 * source with its number and the day we read it. Real type, so it is the page's list of the five sources, read by
 * a screen reader; on the full tier each line lights as its source's thread is in (`data-on`, by the engine).
 */
export function CareLabel({ className }: { className?: string }) {
  return (
    <figure data-label aria-label={`${NAME}: the five sources that file it`} className={cn("care-label flex w-[300px] max-w-full flex-col rounded-md bg-ink py-4 pl-6 pr-5 text-surface shadow-dialog", className)}>
      <figcaption className="flex flex-col gap-0.5">
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-surface/70">One record</span>
        <span className="text-lg font-medium tracking-[-0.01em]">{NAME}</span>
      </figcaption>
      <ul className="mt-3 flex flex-col gap-1.5 border-t border-surface/20 pt-3">
        {SOURCE_DATES.map(([source, filed]) => (
          <li key={source} data-line className="flex items-baseline justify-between gap-3 transition-opacity duration-slow film-full:opacity-30 film-full:data-[on]:opacity-100">
            <span className="text-sm font-semibold">{source}</span>
            <span className="font-mono text-xs text-surface/75">{filed}</span>
          </li>
        ))}
      </ul>
    </figure>
  );
}
